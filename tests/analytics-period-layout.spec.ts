import { expect, test } from "@playwright/test";

for (const width of [320, 390, 820, 1440]) {
  test(`Zeitraumauswahl bleibt flach und auf einer Ebene bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/block-layouts", route => route.fulfill({ json: { orders: {} } }));
    await page.route("**/api/layout-preferences", route => route.fulfill({ json: { preferences: {} } }));
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    const firstSteps = page.getByRole("button", { name: "Erste Schritte schließen", exact: true });
    if (await firstSteps.isVisible()) await firstSteps.click();
    await page.getByTestId("nav-analytics").click();
    await page.getByRole("button", { name: "Freier Zeitraum", exact: true }).click();
    const fields = page.locator(".analytics-period-fields");
    const inputs = fields.locator("input");
    await expect(inputs).toHaveCount(2);
    await expect(inputs.nth(0)).toHaveCSS("font-size", width <= 380 ? "12px" : width <= 780 ? "14px" : "16px");
    const boxes = await fields.locator("input, button").evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { top: box.top, bottom: box.bottom, height: box.height, border: style.borderTopStyle, shadow: style.boxShadow };
    }));
    expect(new Set(boxes.map(box => Math.round(box.top))).size).toBe(1);
    expect(boxes.every(box => box.height === 44 && box.border === "solid" && box.shadow === "none")).toBe(true);
    const from = await inputs.nth(0).inputValue();
    await fields.getByRole("button", { name: "Weiter", exact: true }).click();
    await expect(inputs.nth(0)).not.toHaveValue(from);
    await fields.getByRole("button", { name: "Zurück", exact: true }).click();
    await expect(inputs.nth(0)).toHaveValue(from);
    await page.mouse.move(0, 0);
    await inputs.nth(0).focus();
    await fields.screenshot({ path: test.info().outputPath("period-fields.png") });
    await page.screenshot({ path: test.info().outputPath("analytics.png"), fullPage: true });
    const withinRow = await fields.evaluate(element => {
      const row = element.getBoundingClientRect();
      return [...element.querySelectorAll("input, button")].every(child => {
        const box = child.getBoundingClientRect();
        return box.left >= row.left - 1 && box.right <= row.right + 1;
      });
    });
    expect(withinRow).toBe(true);
  });
}
