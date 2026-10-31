import { expect, test } from "@playwright/test";

for (const width of [1440, 820, 390]) {
  test(`Startuebersicht zeigt genau vier eindeutige Einstiege bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/block-layouts", route => route.fulfill({ json: { orders: {} } }));
    await page.route("**/api/layout-preferences", route => route.fulfill({ json: { preferences: {} } }));
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    const firstSteps = page.getByRole("button", { name: "Erste Schritte schließen", exact: true });
    if (await firstSteps.isVisible()) await firstSteps.click();
    await page.mouse.move(0, 0);
    await page.getByTestId("nav-dashboard").focus();
    const shortcuts = page.locator('[data-layout-scope="dashboard.shortcuts"]');
    await expect(shortcuts.locator(".workboard-card")).toHaveCount(4);
    await expect(page.locator('[data-layout-scope="dashboard.metrics"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Heute steuern|Projekte & Objekte pflegen|Berichte prüfen/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Nächste Einsätze", exact: true })).toBeVisible();
    const boxes = await shortcuts.locator(".workboard-card").evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { top: box.top, height: box.height, overflow: button.scrollWidth - button.clientWidth };
    }));
    await test.info().attach("shortcut-geometry", { body: JSON.stringify(boxes), contentType: "application/json" });
    await page.screenshot({ path: `test-results/dashboard-four-${width}-${test.info().project.name}.png`, fullPage: true });
    expect(new Set(boxes.map(box => Math.round(box.height))).size).toBe(1);
    expect(new Set(boxes.map(box => Math.round(box.top))).size).toBe(width > 1000 ? 1 : 2);
    expect(boxes.every(box => box.height >= 44 && box.height <= 112 && box.overflow <= 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const section of ["objects", "planning", "reports", "billing"]) {
      await shortcuts.locator(`[data-block-id="${section}"] .workboard-card`).click();
      if (section === "reports") {
        await expect(page.getByRole("heading", { name: "Berichtsübersicht", exact: true })).toBeVisible();
      } else {
        await expect(page.getByTestId(`nav-${section}`)).toHaveClass(/active/);
      }
      await page.getByTestId("nav-dashboard").click();
      await expect(shortcuts.locator(".workboard-card")).toHaveCount(4);
    }
  });
}
