import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) test(`Dashboard-Einsatz öffnet ohne Datenänderung bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const rows = page.locator(".dashboard-work-list > button");
  await expect(rows.first()).toBeVisible();
  const queue = () => page.evaluate(() => localStorage.getItem("workcore-sync-mutations-v1"));
  const before = await queue();
  for (let index = 0; index < Math.min(2, await rows.count()); index++) {
    const row = rows.nth(index);
    const title = await row.locator("strong").innerText();
    if (index === 0) await row.click();
    else { await row.focus(); await page.keyboard.press("Enter"); }
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Auftrag bearbeiten", exact: true })).toBeVisible();
    await expect(dialog.locator("input").filter({ visible: true }).first()).toBeVisible();
    await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue(title);
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(await queue()).toBe(before);
  await page.screenshot({ path: `test-results/dashboard-jobs-${width}-${test.info().project.name}.png` });
});
