import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) test(`Kommissionierung im Auftrag mit sichtbaren Aktionen ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const order = { id: "55555555-5555-4555-8555-555555555555", picking_code: "2026-10-11-00002", title: "Türen vom Gartenhaus richten", status: "loaded", revision: 1, created_at: "2026-10-11T09:00:00Z" };
  await page.route("**/api/picking-orders**", (route) => route.fulfill({ json: { rows: [order], count: 1, items: [], events: [] } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.locator(".dashboard-work-list > button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Kommissionierung", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Kommissionierung", exact: true });
  await expect(dialog.getByRole("table")).toContainText("Auf Fahrzeug bereitgestellt");
  await expect(dialog.getByRole("button", { name: "Kommissionierauftrag erstellen", exact: true })).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await dialog.getByRole("table").evaluate((node) => node.scrollWidth <= node.parentElement!.clientWidth)).toBe(true);
  const camera = dialog.getByRole("button", { name: "Mit Kamera scannen", exact: true });
  expect(["flex", "inline-flex"]).toContain(await camera.evaluate((node) => getComputedStyle(node).display));
  expect(await camera.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("6px");
  if (width > 600) expect(await dialog.evaluate((node) => node.clientWidth)).toBeGreaterThan(1000);
  await page.screenshot({ path: info.outputPath(`picking-layout-${width}.png`), fullPage: true });
});
