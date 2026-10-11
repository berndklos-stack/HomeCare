import { expect, test } from "@playwright/test";
import { jsPDF } from "jspdf";

for (const mobile of [false, true]) test(`Einkauf verwendet gemeinsame Reiter ${mobile ? "mobil" : "desktop"}`, async ({ page }, info) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.route("**/api/operations?**", (route) => route.fulfill({ json: { active: true, rows: [], count: 0 } }));
  await page.route("**/api/goods-receipts?**", (route) => route.fulfill({ json: { rows: [], count: 0 } }));
  await page.route("**/api/supplier-damage-cases**", (route) => route.fulfill({ json: { rows: [], count: 0 } }));
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click(); await page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true }).click();
  const tabs = page.getByRole("tablist", { name: "Lieferanten & Einkauf", exact: true });
  await expect(tabs.getByRole("tab")).toHaveCount(3);
  for (const name of ["Lieferanten", "Bestellungen", "Schadensakten", "Lieferanten"]) {
    await tabs.getByRole("tab", { name, exact: true }).click(); await expect(tabs.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel", { name, exact: true }); await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible(); await expect(page.locator("dialog[open]")).toHaveCount(0);
    if (name !== "Schadensakten") await expect(panel.getByRole("button", { name: "Neu", exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath(`purchasing-tabs-${mobile}.png`), fullPage: true });
  await page.getByRole("button", { name: "Material & Lager", exact: true }).click(); await page.getByRole("tab", { name: "Lagerplätze", exact: true }).click();
  await page.getByRole("button", { name: "Neuer Lagerplatz", exact: true }).click();
  const form = page.getByRole("dialog"); await form.getByLabel("Lagerplatzart", { exact: true }).selectOption("vehicle");
  await expect(form.getByLabel("Lagerplatzart", { exact: true })).toHaveValue("vehicle");
  await form.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("tab", { name: "Standorte", exact: true }).click();
  await page.getByRole("button", { name: "Neuer Lagerort", exact: true }).click();
  await form.getByLabel("Als Fahrzeuglager verwenden", { exact: true }).check();
  await expect(form.getByLabel("Als Fahrzeuglager verwenden", { exact: true })).toBeChecked();
});

for (const mobile of [false, true]) test(`Lieferant und Schadensakten ohne gestapelte Fenster ${mobile ? "mobil" : "desktop"}`, async ({ page }, info) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const supplier = { id: "22222222-2222-4222-8222-222222222222", supplier_number: "0001", company: "Snickare Jocke", revision: 1 };
  const damage = { id: "55555555-5555-4555-8555-555555555555", revision: 1, status: "completed", description: "3 Latten gebrochen", created_at: "2026-10-11T09:00:16Z", supplier: { company: supplier.company }, receipt: { delivery_number: "4321" } };
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: { active: true, rows: entity === "suppliers" ? [supplier] : [], count: entity === "suppliers" ? 1 : 0 } });
  });
  await page.route("**/api/supplier-damage-cases**", (route) => route.fulfill({ json: { rows: [damage], count: 1, photos: [], events: [] } }));
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true }).click();
  await page.getByRole("table", { name: "Lieferanten", exact: true }).getByText(supplier.company, { exact: true }).click();
  const form = page.locator('dialog[open][aria-labelledby="operations-form-title"]');
  await form.getByLabel("Unternehmen", { exact: true }).fill("Snickare Jocke Entwurf");
  if (!mobile) expect(await form.evaluate((element) => element.clientWidth)).toBeGreaterThan(1000);
  await form.getByRole("button", { name: "Schadensakten", exact: true }).click();
  const dialog = page.locator('dialog[open][aria-labelledby="damage-title"]');
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(dialog.getByRole("table")).toContainText("3 Latten gebrochen");
  if (!mobile) {
    expect(await dialog.evaluate((element) => element.clientWidth)).toBeGreaterThan(1000);
    expect(await dialog.getByRole("table").evaluate((element) => element.scrollWidth <= element.parentElement!.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath(`supplier-damage-${mobile}.png`), fullPage: true });
  await dialog.getByRole("button", { name: "Zurück zum Lieferanten", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(form.getByLabel("Unternehmen", { exact: true })).toHaveValue("Snickare Jocke Entwurf");
});

for (const mobile of [false, true]) test(`Schadensakte direkt aus Lagerbuchung ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const damage = { id: "55555555-5555-4555-8555-555555555555", revision: 1, status: "open", description: "3 Latten gebrochen", created_at: "2026-10-11T09:00:16Z", supplier: { company: "Snickare Jocke" }, receipt: { delivery_number: "4321" } };
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: { active: true, count: entity === "stock_movements" ? 1 : 0, rows: entity === "stock_movements" ? [{ id: "movement-1", material_id: "MAT-1", quantity: 60, occurred_at: "2026-10-11T09:00:16Z", actor_name: "Bernd Klos", source_id: null, destination_id: "LOCATION-1", note: "Lieferschein 4321", damage_case: damage }] : [] } });
  });
  await page.route("**/api/supplier-damage-cases**", (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.has("summary") ? { count: 1 } : { rows: [damage], count: 1, photos: [], events: [] } }));
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  const table = page.getByRole("table", { name: "Buchungen", exact: true });
  await expect(table).toContainText("Offen · 3 Latten gebrochen");
  await table.getByText("Lieferschein 4321", { exact: true }).click();
  const detail = page.locator('dialog[open][aria-labelledby="stock-details-title"]');
  await expect(detail).toContainText("Offen · 3 Latten gebrochen");
  await detail.getByRole("button", { name: "Schadensakten", exact: true }).click();
  const damageDialog = page.locator('dialog[open][aria-labelledby="damage-title"]');
  await expect(damageDialog).toContainText("3 Latten gebrochen");
  await expect(damageDialog.getByLabel("Status", { exact: true })).toHaveValue("open");
});

for (const mobile of [false, true]) test(`Schadensakte Dashboard Status und Fotos ${mobile ? "mobil" : "desktop"}`, async ({ page }, info) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const item = { id: "55555555-5555-4555-8555-555555555555", revision: 1, status: "open", description: "Verpackung beschädigt", created_at: "2026-10-11T12:00:00Z", supplier: { company: "Testlieferant" }, receipt: { delivery_number: "LS-123" } };
  const events = [{ id: "event-1", status: "open", note: "", actor_name: "Bernd Klos", created_at: "2026-10-11T12:00:00Z" }];
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/operations?**", (route) => route.fulfill({ json: { rows: [], count: 0, active: true } }));
  await page.route("**/api/supplier-damage-cases**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON(); writes.push(input); item.status = input.status; item.revision++;
      events.push({ id: `event-${events.length + 1}`, status: input.status, note: input.note, actor_name: "Bernd Klos", created_at: "2026-10-11T12:15:00Z" });
      return route.fulfill({ json: { revision: item.revision } });
    }
    if (params.get("summary") === "1") return route.fulfill({ json: { count: item.status === "completed" ? 0 : 1 } });
    return route.fulfill({ json: { rows: [item], count: 1, events, photos: [{ id: "photo-1", name: "Schaden.jpg", storage_path: "test/photo.jpg" }], document: { id: "document-1", name: "Lieferschein.pdf", storage_path: "test/delivery.pdf" } } });
  });
  await page.route("**/api/private-media?**", (route) => {
    if (new URL(route.request().url()).searchParams.get("path") === "test/photo.jpg") return route.fulfill({ body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAusAAAAASUVORK5CYII=", "base64"), contentType: "image/png" });
    const pdf = new jsPDF(); pdf.text("Lieferschein LS-123", 20, 20);
    return route.fulfill({ body: Buffer.from(pdf.output("arraybuffer")), contentType: "application/pdf" });
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: /Offene Schadensfälle bei Lieferanten/ }).click();
  const dialog = page.locator('dialog[open][aria-labelledby="damage-title"]');
  await expect(dialog.getByRole("heading", { name: "Schadensakten", exact: true })).toBeVisible();
  await dialog.getByRole("table").getByText("Verpackung beschädigt", { exact: true }).click();
  await expect(dialog.getByText("Lieferscheinnummer: LS-123", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Schadensfoto 1", exact: true }).click();
  const preview = page.locator('dialog[open][aria-labelledby="damage-preview-title"]');
  await expect(preview.getByRole("img", { name: "Schaden.jpg" })).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect.poll(() => preview.getByRole("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await preview.getByRole("button", { name: "Schließen", exact: true }).click();
  await dialog.getByRole("button", { name: "Lieferschein (Foto oder PDF)", exact: true }).click();
  await expect(preview.locator("iframe")).toHaveAttribute("src", /^blob:/);
  await preview.getByRole("button", { name: "Schließen", exact: true }).click();
  const download = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Herunterladen: Schadensfoto 1", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Schaden.jpg");
  await dialog.getByLabel("Status", { exact: true }).selectOption("in_progress", { timeout: 10000 });
  await dialog.getByLabel("Bearbeitungsnotiz", { exact: true }).fill("Lieferant informiert");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog.getByText("Lieferant informiert", { exact: true })).toBeVisible();
  expect(writes[0]).toEqual({ id: item.id, revision: 1, status: "in_progress", note: "Lieferant informiert" });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`damage-${mobile}.png`) });
  await dialog.getByLabel("Status", { exact: true }).selectOption("completed");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog.getByLabel("Status", { exact: true })).toHaveValue("completed");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(page.getByRole("button", { name: /Offene Schadensfälle bei Lieferanten/ })).toHaveCount(0);
});
