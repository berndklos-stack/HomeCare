import { expect, test } from "@playwright/test";

test("Lageransicht verwendet die Panel- und Kennzahlgestaltung der Auswertung", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Auswertung", exact: true }).click();
  const panel = page.locator(".analytics-view > .panel").first();
  await expect(panel).toBeVisible();
  const appearance = (element: Element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, radius: style.borderRadius, border: style.border, padding: style.padding };
  };
  const panelStyle = await panel.evaluate(appearance);
  const metricStyle = await panel.locator(".analytics-summary-grid > div").first().evaluate(appearance);
  await page.screenshot({ path: `test-results/analytics-reference-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const stockPanel = page.getByRole("heading", { name: "Bestände und Buchungen", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(stockPanel).toBeVisible();
  expect(await stockPanel.evaluate(appearance)).toEqual(panelStyle);
  expect(await stockPanel.locator(".analytics-summary-grid > div").first().evaluate(appearance)).toEqual(metricStyle);
});

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
    if (entity === "stock_movements") return route.fulfill({ json: { rows: [
      { id: "movement-1", quantity: 55, source_id: null, destination_id: "test-location", occurred_at: "2026-10-09T07:37:26Z", note: "Anlieferung", actor_user_id: "1924d8ca-0781-42e3-98cf-3aa69fcc1f90" },
      { id: "movement-2", quantity: 5, source_id: "test-location", destination_id: null, occurred_at: "2026-10-09T08:37:26Z", note: "Verbrauch" },
      { id: "movement-3", quantity: 2, source_id: "test-location", destination_id: "other-location", occurred_at: "2026-10-09T09:37:26Z", note: "Transport" },
    ], count: 3 } });
    return route.fulfill({ json: { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  const material = page.getByRole("heading", { name: "Bestände und Buchungen", exact: true }).locator("xpath=ancestor::section[1]").getByRole("combobox", { name: "Bezeichnung", exact: true });
  await expect(material).toBeVisible();
  const value = await material.locator("option").last().getAttribute("value");
  expect(value).toBeTruthy();
  await material.selectOption(value!);
  const bookings = page.getByRole("table", { name: "Buchungen", exact: true });
  await expect(bookings).toContainText("Anlieferung");
  const filterBounds = await material.boundingBox();
  expect(filterBounds!.height).toBeGreaterThanOrEqual(48);
  if (!mobile) expect(filterBounds!.width).toBeGreaterThanOrEqual(400);
  const directionColors = [];
  for (const direction of ["Eingang", "Ausgang", "Umbuchung"]) {
    await expect(bookings.getByText(direction, { exact: true })).toBeVisible();
    const indicator = bookings.locator(`[title="${direction}"]`);
    await expect(indicator.locator("svg")).toHaveCount(1);
    directionColors.push(await indicator.evaluate((node) => getComputedStyle(node).color));
  }
  expect(new Set(directionColors).size).toBe(3);
  await bookings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/booking-directions-${mobile}-${test.info().project.name}.png` });
  await expect(bookings.getByRole("columnheader", { name: "Bezeichnung", exact: true })).toBeVisible();
  await expect(bookings.getByRole("columnheader", { name: "Material", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Bestände und Buchungen", exact: true }).locator("xpath=ancestor::section[1]")).toHaveClass(/panel/);
  await expect(page.getByRole("heading", { name: "Buchungen", exact: true }).locator("xpath=ancestor::section[1]")).toHaveClass(/panel/);
  await expect(page.locator(".analytics-summary-grid")).toBeVisible();
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
  const options = await material.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ id: (node as HTMLOptionElement).value, name: node.textContent ?? "" })).filter((row) => row.id));
  await page.route("**/api/operations?entity=material_details**", (route) => route.fulfill({ json: { rows: options.map((row) => ({ ...row, revision: 1 })), count: options.length } }));
  await page.getByRole("button", { name: "Materialstammdaten", exact: true }).locator("..").getByRole("button", { name: "Aktualisieren", exact: true }).click();
  const materialTable = page.getByRole("table", { name: "Beschaffung", exact: true });
  await expect(materialTable.locator("tbody tr")).toHaveCount(1);
  await expect(materialTable.locator("tbody")).toContainText(options.find((row) => row.id === value)!.name);
  await expect(bookings.locator("tbody")).toContainText(options.find((row) => row.id === value)!.name);
  await expect(page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Beschaffung", exact: true })).toBeVisible();
  await expect(materialTable.getByRole("columnheader", { name: "Bezeichnung", exact: true })).toBeVisible();
  await expect(materialTable.getByRole("columnheader", { name: "Name", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lagerbuchung", exact: true });
  await expect(dialog).toContainText(options.find((row) => row.id === value)!.name);
  await expect(dialog.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue(value!);
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await material.selectOption("");
  await expect(materialTable.locator("tbody tr")).toHaveCount(options.length);
  await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Speichern", exact: true })).toBeDisabled();
  const bookingMaterial = dialog.getByRole("combobox", { name: "Bezeichnung", exact: true });
  await bookingMaterial.selectOption(value!);
  await expect(dialog).toContainText(options.find((row) => row.id === value)!.name);
  await expect(material).toHaveValue("");
  await page.screenshot({ path: `test-results/global-booking-${mobile}-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await material.selectOption(value!);
  const overviewBounds = await page.getByRole("heading", { name: "Bestände und Buchungen", exact: true }).boundingBox();
  expect(overviewBounds!.x + overviewBounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1440);
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/material-return-${mobile}-${test.info().project.name}.png`, fullPage: true });
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
