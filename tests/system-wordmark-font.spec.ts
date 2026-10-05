import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("Wortmarke verwendet Systemschrift ohne Syne-Abhaengigkeit", async ({ page }) => {
  const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");
  expect(layout).not.toMatch(/\bSyne\b|\bsyne\b/);

  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) {
      externalFontRequests.push(request.url());
    }
  });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  const wordmark = page.locator(".topbar h1.brand-wordmark");
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveCSS("font-weight", "800");
  expect(await wordmark.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("system-ui");
  expect(externalFontRequests).toEqual([]);
});
