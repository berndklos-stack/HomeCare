import { expect, test } from "@playwright/test";

test("Auftrags- und Objektcodes bleiben beim Speichern und Wiedereroeffnen erhalten", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const row = page.locator(".dashboard-work-list > button").first();
  await row.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Auftragscode", { exact: true }).fill("001-JOB");
  await dialog.getByRole("button", { name: "Auftrag speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-jobs") ?? "[]").some((job: { scanCode?: string }) => job.scanCode === "001-JOB"))).toBe(true);
  await page.getByRole("button", { name: "Projekte & Objekte", exact: true }).click();
  const objectRow = page.locator(".object-list article").first();
  await objectRow.click();
  await page.getByLabel("Objektcode", { exact: true }).fill("001-OBJ");
  await page.getByRole("heading", { name: "Basisdaten", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-objects") ?? "[]").some((object: { scanCode?: string }) => object.scanCode === "001-OBJ"))).toBe(true);
  await page.getByRole("button", { name: "Zurück zu Projekte & Objekte", exact: true }).click();
  await objectRow.click();
  await expect(page.getByLabel("Objektcode", { exact: true })).toHaveValue("001-OBJ");
  const mutations = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(mutations.some((mutation: { entityType: string; payload: { scanCode?: string } }) => mutation.entityType === "job" && mutation.payload.scanCode === "001-JOB")).toBe(true);
  expect(mutations.some((mutation: { entityType: string; payload: { scanCode?: string } }) => mutation.entityType === "object" && mutation.payload.scanCode === "001-OBJ")).toBe(true);
});

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
