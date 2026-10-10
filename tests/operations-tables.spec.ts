import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) test(`Materialstammdaten kehren ohne alten Lagerbildschirm zurueck ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  let statusReads = 0;
  await page.route("**/api/operations?**", async (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    if (entity === "stock_status") {
      statusReads++;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({ json: { active: true } });
    }
    if (entity === "stock_balances") return route.fulfill({ json: { rows: [{ location_id: "test-location", quantity: 55 }] } });
    if (entity === "stock_movements") return route.fulfill({ json: { rows: [{ id: "movement-1", quantity: 55, source_id: null, destination_id: "test-location", occurred_at: "2026-10-09T07:37:26Z", note: "Anlieferung", actor_user_id: "1924d8ca-0781-42e3-98cf-3aa69fcc1f90" }], count: 1 } });
    return route.fulfill({ json: { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  const material = page.getByRole("combobox", { name: "Material", exact: true });
  await expect(material).toBeVisible();
  const value = await material.locator("option").last().getAttribute("value");
  expect(value).toBeTruthy();
  await material.selectOption(value!);
  const bookings = page.getByRole("table", { name: "Buchungen", exact: true });
  await expect(bookings).toContainText("Anlieferung");
  await expect(bookings).not.toContainText("1924d8ca-0781-42e3-98cf-3aa69fcc1f90");
  await expect(bookings).not.toContainText("2026-10-09T07:37:26Z");
  await bookings.getByRole("searchbox", { name: "Filter: Buchungsgrund", exact: true }).fill("Anlieferung");
  const reads = statusReads;
  await page.getByRole("button", { name: "Materialstammdaten", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Material verwalten", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(material).toBeVisible();
  await expect(material).toHaveValue(value!);
  expect(statusReads).toBe(reads);
  await expect(bookings.getByRole("searchbox", { name: "Filter: Buchungsgrund", exact: true })).toHaveValue("Anlieferung");
  const overviewBounds = await page.getByRole("heading", { name: "Bestände und Buchungen", exact: true }).boundingBox();
  expect(overviewBounds!.x + overviewBounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1440);
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/material-return-${mobile}-${test.info().project.name}.png` });
});

for (const mobile of [false, true]) test(`Spaltenfilter kombinieren alle Lieferantenseiten ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const rows = Array.from({ length: 55 }, (_, i) => ({ id: `supplier-${i}`, company: `Supplier ${i}`, supplier_number: `S-${i}`, phone: `+46${i}`, email: i === 54 ? "target@example.test" : "other@example.test", revision: 1 }));
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("entity") === "stock_status") return route.fulfill({ json: { active: true } });
    const p = Number(params.get("page") ?? 0);
    return route.fulfill({ json: { rows: params.get("entity") === "suppliers" ? rows.slice(p * 50, p * 50 + 50) : [], count: params.get("entity") === "suppliers" ? rows.length : 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByRole("button", { name: "Beschaffung", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("searchbox")).toHaveCount(7);
  for (const input of await table.getByRole("searchbox").all()) await expect(input).toHaveValue("");
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("Supplier 5");
  await table.getByRole("searchbox", { name: "Filter: E-Mail", exact: true }).fill("target");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody")).toContainText("Supplier 54");
  await table.locator("tbody tr td").nth(1).click();
  await expect(page.getByRole("dialog", { name: "Lieferanten", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Unternehmen", { exact: true })).toHaveValue("Supplier 54");
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await table.locator("tbody tr").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Lieferanten", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("missing");
  await expect(table.locator("tbody")).toContainText("Keine Einträge");
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("");
  await expect(table.locator("tbody")).toContainText("Supplier 54");
  await page.screenshot({ path: `test-results/master-table-${mobile}-${test.info().project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [
    { id: "order-1", order_number: "B-100", supplier_id: "supplier-54", status: "received", order_date: "2026-10-08", expected_delivery: "2026-10-10", open_item_count: 0, item_count: 3 },
    { id: "order-2", order_number: "B-200", supplier_id: "supplier-1", status: "draft", order_date: "2026-10-09", open_item_count: 2, item_count: 2 },
  ], count: 2 } }));
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await expect(table.getByRole("searchbox")).toHaveCount(6);
  await table.getByRole("searchbox", { name: "Filter: Lieferant", exact: true }).fill("Supplier 54");
  await table.getByRole("searchbox", { name: "Filter: Bestelldatum", exact: true }).fill("8.10.2026");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody")).toContainText("B-100");
  await expect(table.locator("tbody")).not.toContainText("B-200");
  await page.screenshot({ path: `test-results/order-table-${mobile}-${test.info().project.name}.png` });
});
