import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { stockOverviewRows } from "../lib/stockOverview";

test("Bestandszeilen behalten Einheiten, Nullbestaende und Archivstatus", () => {
  const materials = [{ id: "b", name: "Material 10", unit: "Liter", archived: true }, { id: "a", name: "Material 2", unit: "Meter" }, { id: "c", name: "Leer" }];
  const rows = stockOverviewRows(materials, [{ id: "x", name: "Lager" }], [{ material_id: "a", location_id: "x", quantity: 5 }, { material_id: "b", location_id: "x", quantity: 2 }], "de");
  expect(rows.map((row) => row.designation)).toEqual(["Leer", "Material 2", "Material 10"]);
  expect(rows[0].quantity).toBe(0); expect(rows[1].unit).toBe("Meter"); expect(rows[2].archived).toBe(true);
});

for (const mobile of [false, true]) test(`Gesamtbestand Export und Inventur ${mobile ? "mobil" : "desktop"}`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-updated-at", "2026-10-10T10:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-test": {} }));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([
      { id: "stock-a", name: "Aktives Material", sku: "A-1", unit: "Meter", archived: false, inventory: [] },
      { id: "stock-zero", name: "Ohne Bestand", sku: "Z-1", unit: "Liter", archived: false, inventory: [] },
      { id: "stock-archive", name: "Archiviertes Material", sku: "B-1", unit: "Stk", archived: true, inventory: [] },
    ]));
    localStorage.setItem("kolaretorp-inventory-locations", JSON.stringify([{ id: "stock-location", name: "Testlager", archived: false }]));
  });
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : entity === "stock_summary" ? { rows: [
      { material_id: "stock-a", location_id: "stock-location", quantity: 10 }, { material_id: "stock-archive", location_id: "stock-location", quantity: 3 },
    ], capturedAt: "2026-10-10T10:00:00Z" } : entity === "stock_inventories" ? { rows: [{ id: "inventory-test", created_at: "2026-10-10T10:00:00Z", location_id: "stock-location", actor_name: "Bernd Klos", note: "Jahresinventur" }], count: 1 }
    : entity === "stock_inventory_items" ? { rows: [{ material_id: "stock-a", expected_quantity: 10, counted_quantity: 8 }], count: 1 } : { rows: [], count: 0 } });
  });
  const requests: unknown[] = [];
  let failure = true;
  await page.route("**/api/stock-inventory", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: failure ? 503 : 200, json: failure ? { error: "INVENTORY_FAILED" } : { id: "saved" } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const table = page.getByRole("table", { name: "Lagerbestandsübersicht", exact: true });
  await expect(table).toContainText("Aktives Material");
  await expect(table).not.toContainText("Archiviertes Material"); await expect(table).not.toContainText("Ohne Bestand");
  await page.getByRole("checkbox", { name: "Materialien ohne Bestand anzeigen" }).check();
  await page.getByRole("checkbox", { name: "Archivierte Materialien anzeigen" }).check();
  await expect(table).toContainText("Archiviertes Material"); await expect(table).toContainText("Ohne Bestand");
  for (const format of ["Excel", "PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(format === "PDF" ? /\.pdf$/ : /\.xlsx$/);
    await file.saveAs(`test-results/stock-overview-${mobile}-${testInfo.project.name}.${format === "PDF" ? "pdf" : "xlsx"}`);
    if (format === "PDF") expect((await readFile((await file.path())!)).toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  }
  await page.screenshot({ path: `test-results/stock-overview-${mobile}-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Inventur", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Inventur", exact: true });
  await dialog.getByRole("combobox", { name: "Lagerort", exact: true }).selectOption("stock-location");
  await expect(dialog).not.toContainText("Archiviertes Material");
  await dialog.getByRole("textbox", { name: "Inventurgrund" }).fill("Jahresinventur");
  await dialog.getByRole("spinbutton", { name: "Gezählt: Aktives Material" }).fill("8");
  await dialog.getByRole("spinbutton", { name: "Gezählt: Ohne Bestand" }).fill("0");
  await expect(dialog).toContainText("-2");
  await page.screenshot({ path: `test-results/stock-inventory-${mobile}-${testInfo.project.name}.png` });
  await dialog.getByRole("button", { name: "Inventur abschließen" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nicht gespeichert");
  await expect(dialog.getByRole("spinbutton", { name: "Gezählt: Aktives Material" })).toBeDisabled();
  failure = false;
  await dialog.getByRole("button", { name: "Übertragung erneut versuchen" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]);
  expect(requests[0]).toMatchObject({ location_id: "stock-location", note: "Jahresinventur", items: [
    { material_id: "stock-a", expected: 10, counted: 8 }, { material_id: "stock-zero", expected: 0, counted: 0 },
  ] });
  await expect(page.getByRole("status")).toContainText("Inventur gespeichert");
  await page.getByRole("button", { name: "Inventuren", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Inventuren", exact: true });
  await expect(history).toContainText("Bernd Klos");
  await history.getByRole("row").filter({ hasText: "Jahresinventur" }).click();
  await expect(history).toContainText("Aktives Material"); await expect(history).toContainText("-2 Meter");
  await history.getByRole("button", { name: "Schließen", exact: true }).last().click();
  await table.locator("tbody tr").filter({ hasText: "Aktives Material" }).click();
  await expect(page.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue("stock-a");
  await expect(table).toHaveCount(0);
  await page.getByRole("combobox", { name: "Bezeichnung", exact: true }).selectOption({ label: "Alle Materialien" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue("");
});
