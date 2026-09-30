import { expect, test } from "@playwright/test";

test("Login-Seite bleibt in WebKit geladen und bedienbar", async ({ page }) => {
  let requestCount = 0;
  page.on("request", () => { requestCount += 1; });

  await page.goto("/?workcore-auth-test=login");
  await expect(page.locator("main.auth-app")).toHaveAttribute("data-ready", "false");
  await expect(page.getByLabel("E-Mail")).toBeEnabled({ timeout: 10_000 });
  const settledRequestCount = requestCount;

  await page.waitForTimeout(10_000);

  await expect(page.locator("main.auth-app")).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeEnabled();
  expect(requestCount - settledRequestCount).toBeLessThan(4);
});

test("authentifizierte App bleibt ohne Render- oder Request-Schleife stabil", async ({ page }) => {
  let requestCount = 0;
  let legacyWrites = 0;
  page.on("request", (request) => {
    requestCount += 1;
    if (request.url().includes("/api/sync-sections") && request.method() !== "GET") legacyWrites += 1;
  });

  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  const settledRequestCount = requestCount;

  await page.waitForTimeout(10_000);

  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  expect(requestCount - settledRequestCount).toBeLessThan(8);
  expect(legacyWrites).toBe(0);
});
