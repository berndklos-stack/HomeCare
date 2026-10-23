import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { stockOverviewRows } from "../lib/stockOverview";
import { inventoryLocationPath, orderInventoryItems } from "../lib/inventoryPlan";
test.beforeEach(async ({ page }) => { await page.addInitScript(() => {
  localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Lager Testfirma", logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }));
}); });

test("Inventur-Laufreihenfolge gruppiert Lagerplaetze und sortiert Codes natuerlich", () => {
  const locations = [{ id: "root", name: "Lager", location_code: "01" }, { id: "a", name: "Regal", location_code: "R2", parent_location_id: "root" }, { id: "b", name: "Regal", location_code: "R10", parent_location_id: "root" }];
  expect(inventoryLocationPath("a", locations)).toBe("01 · Lager / R2 · Regal");
  expect(orderInventoryItems([{ location_id: "b", material_id: "m", expected: 1, counted: null }, { location_id: "a", material_id: "m", expected: 1, counted: null }], locations, [{ id: "m", name: "Material" }], "de").map((item) => item.location_id)).toEqual(["a", "b"]);
});

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
  const requests: Record<string, unknown>[] = [];
  let savedPlan: Record<string, unknown> | null = null;
  let failure = true;
  await page.route("**/api/inventory-plans**", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: {
      rows: savedPlan ? [savedPlan] : [], items: savedPlan ? (savedPlan.items as { material_id: string; location_id: string; expected: number; counted: number | null }[]).map((item) => ({ ...item, expected_quantity: item.expected, counted_quantity: item.counted })) : [],
    } });
    const input = route.request().postDataJSON(); requests.push(input);
    if (input.revision && failure) return route.fulfill({ status: 503, json: { error: "PLAN_FAILED" } });
    savedPlan = { ...input, revision: input.revision + 1, created_at: "2026-10-10T10:00:00Z", completed_at: input.complete ? "2026-10-10T11:00:00Z" : null };
    return route.fulfill({ json: { id: input.id, revision: input.revision + 1 } });
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
    await page.getByLabel("Herunterladen", { exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(format === "PDF" ? /\.pdf$/ : /\.xlsx$/);
    await file.saveAs(`test-results/stock-overview-${mobile}-${testInfo.project.name}.${format === "PDF" ? "pdf" : "xlsx"}`);
    if (format === "PDF") expect((await readFile((await file.path())!)).toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  }
  await page.screenshot({ path: `test-results/stock-overview-${mobile}-${testInfo.project.name}.png` });
  await expect(page.getByRole("button", { name: "Neue Inventur", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Inventur", exact: true }).click();
  await expect(table).toHaveCount(0);
  await page.getByRole("button", { name: "Neue Inventur", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Inventurplanung", exact: true });
  await dialog.getByRole("checkbox", { name: "Testlager", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Materialien ohne Bestand einbeziehen", exact: true }).check();
  await expect(dialog).not.toContainText("Archiviertes Material");
  await dialog.getByRole("textbox", { name: "Inventurgrund" }).fill("Jahresinventur");
  await dialog.getByRole("button", { name: "Inventur anlegen", exact: true }).click();
  await expect(dialog).toContainText("Inventur-ID");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Herunterladen", exact: true }).click();
  const pdf = await download;
  await pdf.saveAs(`test-results/inventory-plan-${mobile}-${testInfo.project.name}.pdf`);
  expect((await readFile((await pdf.path())!)).toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  await dialog.getByRole("spinbutton", { name: "Gezählt: Aktives Material · Testlager", exact: true }).fill("8");
  await dialog.getByRole("spinbutton", { name: "Gezählt: Ohne Bestand · Testlager", exact: true }).fill("0");
  await expect(dialog).toContainText("-2");
  await page.screenshot({ path: `test-results/stock-inventory-${mobile}-${testInfo.project.name}.png` });
  await dialog.getByRole("button", { name: "Zählstände speichern" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nicht gespeichert");
  failure = false;
  await dialog.getByRole("button", { name: "Zählstände speichern" }).click();
  expect(requests).toHaveLength(3); expect(requests[1]).toEqual(requests[2]);
  expect(requests[1]).toMatchObject({ note: "Jahresinventur", items: [
    { material_id: "stock-a", location_id: "stock-location", expected: 10, counted: 8 }, { material_id: "stock-zero", location_id: "stock-location", expected: 0, counted: 0 },
  ] });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("table", { name: "Inventurplanung", exact: true }).getByRole("row").filter({ hasText: "Jahresinventur" }).click();
  await expect(dialog.getByRole("spinbutton", { name: "Gezählt: Aktives Material · Testlager", exact: true })).toHaveValue("8");
  await dialog.getByRole("button", { name: "Inventur abschließen" }).click();
  await expect(dialog.getByRole("spinbutton", { name: "Gezählt: Aktives Material · Testlager", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  const history = page.getByRole("table", { name: "Inventuren", exact: true });
  await expect(history).toContainText("Bernd Klos");
  const historyActions = page.getByRole("group", { name: "Dokumentaktionen", exact: true });
  await historyActions.getByLabel("Herunterladen", { exact: true }).click();
  const historyDownload = page.waitForEvent("download");
  await historyActions.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await readFile((await (await historyDownload).path())!)).toString("latin1")).toContain("Jahresinventur");
  await history.getByRole("row").filter({ hasText: "Jahresinventur" }).click();
  await expect(history).toContainText("Aktives Material"); await expect(history).toContainText("-2 Meter");
  for (const format of ["PDF", "Excel"]) {
    await historyActions.getByLabel("Herunterladen", { exact: true }).click();
    const exported = page.waitForEvent("download");
    await historyActions.getByRole("button", { name: format, exact: true }).click();
    const file = await exported;
    if (format === "PDF") expect((await readFile((await file.path())!)).toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
    else {
      const xml = execFileSync("unzip", ["-p", (await file.path())!, "xl/worksheets/sheet1.xml"], { encoding: "utf8" });
      expect(xml).toContain("-2");
      expect(execFileSync("unzip", ["-p", (await file.path())!, "xl/sharedStrings.xml"], { encoding: "utf8" })).toContain("Meter");
    }
  }
  await page.getByRole("button", { name: "Inventuren", exact: true }).click();
  await page.screenshot({ path: `test-results/inventory-block-${mobile}-${testInfo.project.name}.png` });
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await table.locator("tbody tr").filter({ hasText: "Aktives Material" }).click();
  await expect(page.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue("stock-a");
  await expect(table).toHaveCount(0);
  await page.getByRole("combobox", { name: "Bezeichnung", exact: true }).selectOption({ label: "Alle Materialien" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue("");
});
