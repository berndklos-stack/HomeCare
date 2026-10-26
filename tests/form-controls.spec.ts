import { expect, test, type Locator } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

async function expectEqualHeights(scope: Locator) {
  const controls = scope.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), select:not([multiple]):not([size])');
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    if (!await control.isVisible()) continue;
    expect((await control.boundingBox())!.height).toBe(44);
  }
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/layout-preferences", route => route.fulfill({ json: { preferences: {} } }));
  await page.route("**/api/block-layouts", route => route.fulfill({ json: { orders: {} } }));
  await page.route("**/api/resource-types", route => route.fulfill({ json: { types: defaultResourceTypes } }));
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "HEIGHT-C", name: "Testkunde", personalNumber: "001", company: "", contact: "Demo", email: "kunde@example.invalid", language: "Deutsch", objects: [], balance: "0 SEK", portalStatus: "einladen", portalLoginHistory: [], notes: "", createdAt: "2026-10-26T08:00:00Z" }]));
    localStorage.setItem("kolaretorp-billing", "[]");
  });
});

for (const width of [320, 390, 820, 1440]) {
  test(`Suchfelder und Filter mit Textabstand bei ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    for (const [section, selector] of [["customers", ".list-toolbar"], ["communication", ".communication-toolbar"], ["billing", ".billing-ledger-filters"]]) {
      await page.getByTestId(`nav-${section}`).click();
      const toolbar = page.locator(selector).first();
      await expect(toolbar).toBeVisible();
      await expectEqualHeights(toolbar);
      for (const control of await toolbar.locator('input[type="search"], select').all()) {
        if (!await control.isVisible()) continue;
        const style = await control.evaluate(e => ({ padding: parseFloat(getComputedStyle(e).paddingLeft), appearance: getComputedStyle(e).appearance }));
        expect(style.padding).toBeGreaterThanOrEqual(12);
        expect(style.appearance).toBe("none");
      }
      if (section === "billing") expect(await toolbar.locator('input[type="search"]').evaluate(e => parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThanOrEqual(34);
      await toolbar.screenshot({ path: info.outputPath(`${section}-filters-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  test(`Rechnungsfelder gleich hoch und Kommentare je Position freiwillig bei ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-billing").click();
    await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
    const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
    await editor.getByRole("combobox", { name: "Kunde", exact: true }).selectOption("HEIGHT-C");
    await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Montage");
    await expect(editor.getByRole("textbox", { name: "Kommentar", exact: true })).toHaveCount(0);
    await expectEqualHeights(editor);
    await editor.getByRole("combobox", { name: "Art", exact: true }).selectOption("Material");
    await editor.locator('.billing-editor-head input[type="date"]').nth(0).fill("2026-10-26");
    await editor.locator('.billing-editor-head input[type="date"]').nth(1).fill("2026-11-26");
    await expectEqualHeights(editor);
    await editor.locator("fieldset").screenshot({ path: info.outputPath(`equal-controls-${width}.png`) });
    await editor.getByRole("button", { name: "Position hinzufügen", exact: true }).click();
    await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).nth(1).fill("Anfahrt");
    const comments = editor.getByRole("textbox", { name: "Kommentar", exact: true });
    await expect(comments).toHaveCount(0);
    await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
    await expect(comments).toHaveCount(1);
    for (const comment of await comments.all()) await expect(comment).toHaveJSProperty("required", false);
    await comments.nth(0).fill("Nur bei der Montage");
    await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
    await expect(comments).toHaveCount(0);
    await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
    await expect(comments.first()).toHaveValue("Nur bei der Montage");
    await expect(editor.getByRole("button", { name: "Kommentar zu Position 2", exact: true })).toHaveAttribute("aria-expanded", "false");
    expect((await comments.first().boundingBox())!.height).toBeGreaterThan(44);
    await expectEqualHeights(editor);
    await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const lines = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]")[0].lines);
    expect(lines[0].comment).toBe("Nur bei der Montage"); expect(lines[1].comment || "").toBe("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`Firmenfelder auch im Dunkelmodus gleich hoch bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-masterData").click();
    await page.getByRole("navigation", { name: "Stammdaten", exact: true }).getByRole("button", { name: "Firma", exact: true }).click();
    const form = page.locator(".company-details-form");
    await expectEqualHeights(form);
    await page.getByRole("button", { name: "Dunkelmodus", exact: true }).click();
    await expectEqualHeights(form);
    const select = form.getByRole("combobox", { name: "Standardwährung", exact: true });
    await select.selectOption("EUR"); await expect(select).toHaveValue("EUR");
    expect(await select.evaluate(element => getComputedStyle(element).backgroundImage)).toContain("form-select-chevron.svg");
    const asset = await page.request.get("/form-select-chevron.svg"); expect(asset.ok()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
