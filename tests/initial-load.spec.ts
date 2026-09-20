import { expect, test } from "@playwright/test";

test("Programmstart zeigt einen vorhandenen Cache ohne veralteten Demo-Hinweis", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  const startedAt = Date.now();
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 2_000 });

  expect(Date.now() - startedAt).toBeLessThan(2_000);
  await expect(page.getByText(/Demo-Daten mit echten Daten verwechselt/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Homecare" })).toBeVisible();
});
