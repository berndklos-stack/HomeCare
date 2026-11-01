import { expect, test, type Locator } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

async function alignedActions(list: Locator, width: number) {
  const rows = list.locator(":scope > article");
  expect(await rows.count()).toBeGreaterThan(1);
  const positions: number[][] = [];
  for (const row of await rows.all()) {
    const box = (await row.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(width > 600 ? 100 : 140);
    const controls = await row.locator(":scope > .row-actions button").all();
    expect(controls).toHaveLength(2);
    const columns: number[] = [];
    for (const control of controls) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.width).toBe(44); expect(bounds.height).toBe(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width);
      columns.push(bounds.x);
    }
    positions.push(columns);
  }
  for (const columns of positions) for (let i = 0; i < columns.length; i++) expect(Math.abs(columns[i] - positions[0][i])).toBeLessThan(1);
}

for (const width of [320, 390, 820, 1440]) {
  test(`Leistungen kompakt, feste Aktionen und eigene Bearbeitung ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.evaluate(() => localStorage.setItem("kolaretorp-services", JSON.stringify([
      { id: "CATALOG-1", name: "Anfahrt", description: "Anfahrt zur Baustelle mit ausfuehrlicher Beschreibung, die die Aktionsspalte nicht verschieben darf.", category: "Fahrt", unit: "Einsatz", price: "144", currency: "SEK", taxRate: "25", accountingAccount: "3041", checklist: [] },
      { id: "CATALOG-2", name: "Montage und Reparatur", description: "Montage vor Ort", category: "Handwerk", unit: "Stunde", price: "640", currency: "EUR", taxRate: "25", accountingAccount: "3041", checklist: [] },
    ])));
    await page.reload();
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-masterData").click();
    await page.getByRole("navigation", { name: "Stammdaten", exact: true }).getByRole("button", { name: "Leistungen", exact: true }).click();
    const list = page.locator(".service-master-rows");
    await expect(list).toBeVisible();
    await alignedActions(list, width);
    await list.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("services.png") });
    await page.getByRole("button", { name: "Leistung Anfahrt öffnen", exact: true }).focus();
    await page.keyboard.press("Enter");
    const editor = page.locator(".service-editor-workspace");
    await expect(editor).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(list).toHaveCount(0);
    await editor.getByRole("textbox", { name: "Leistung", exact: true }).fill("Anfahrt aktualisiert");
    await editor.getByRole("button", { name: "Leistung speichern", exact: true }).click();
    await expect(page.getByRole("button", { name: "Leistung Anfahrt aktualisiert öffnen", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Leistung Anfahrt aktualisiert bearbeiten", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: "Leistung", exact: true })).toHaveValue("Anfahrt aktualisiert");
    await editor.getByRole("textbox", { name: "Leistung", exact: true }).fill("Nicht speichern");
    await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(list).not.toContainText("Nicht speichern");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Leistung Anfahrt aktualisiert archivieren", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(list.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: "Archivierte Leistung Anfahrt aktualisiert reaktivieren", exact: true }).click();
    await expect(list.locator("article")).toHaveCount(2);
    await page.getByRole("button", { name: "Neue Leistung anlegen", exact: true }).click();
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Zurück", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Ressourcen kompakt, feste Aktionen und eigene Bearbeitung ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/resource-types", route => route.fulfill({ json: { types: defaultResourceTypes } }));
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-masterData").click();
    await page.getByRole("navigation", { name: "Stammdaten", exact: true }).getByRole("button", { name: "Ressourcen", exact: true }).click();
    const list = page.locator(".resource-master-rows");
    await expect(list).toBeVisible();
    await alignedActions(list, width);
    await list.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("resources.png") });
    await page.getByRole("button", { name: "Ressource Servicebil Kolaretorp öffnen", exact: true }).click();
    const editor = page.locator(".resource-editor-workspace");
    await expect(editor).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(list).toHaveCount(0);
    await editor.getByRole("textbox", { name: "Name", exact: true }).fill("Fahrzeug aktualisiert");
    await editor.getByRole("button", { name: "Ressource speichern", exact: true }).click();
    await expect(editor.locator('p[role="status"]')).toContainText("wurde gespeichert");
    await editor.getByRole("button", { name: "Ressource schließen", exact: true }).click();
    await page.getByRole("button", { name: "Ressource Fahrzeug aktualisiert öffnen", exact: true }).click();
    await expect(editor.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Fahrzeug aktualisiert");
    await editor.getByRole("button", { name: "Fahrtenbuch", exact: true }).click();
    await expect(editor.getByRole("heading", { name: "Fahrtenbuch", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await editor.getByRole("button", { name: "Stammdaten", exact: true }).click();
    await editor.getByRole("textbox", { name: "Name", exact: true }).fill("Nicht speichern");
    await editor.getByRole("button", { name: "Bearbeitung abbrechen", exact: true }).click();
    await expect(list).not.toContainText("Nicht speichern");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
