import { expect, test } from "@playwright/test";

test("Fahrtenbuch verwendet die am Fahrzeug gespeicherte Sprache", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  await page.getByLabel("Sprache").selectOption("sv");
  await page.getByRole("button", { name: "Grunddata", exact: true }).click();
  await page.getByRole("button", { name: "Resurser", exact: true }).click();
  await page.locator("article").filter({ hasText: "Servicebil Kolaretorp" }).first().click();

  const resourceDialog = page.getByRole("dialog");
  await expect(resourceDialog.getByText("Tillverkningsår", { exact: true })).toBeVisible();
  await resourceDialog.getByLabel("Körjournalspråk").selectOption("sv");
  await resourceDialog.getByRole("button", { name: "Spara resurs", exact: true }).click();
  await resourceDialog.getByRole("button", { name: "Körjournal", exact: true }).click();
  await expect(resourceDialog.getByRole("cell", { name: "Tjänsteresa", exact: true })).toBeVisible();
  await resourceDialog.getByRole("button", { name: "Stäng resurs" }).click();

  await page.getByLabel("Språk").selectOption("de");
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();

  const tripDialog = page.locator("section.quick-trip-modal");
  await expect(tripDialog.getByRole("heading", { name: "Registrera körning" })).toBeVisible();
  await expect(tripDialog.getByText("Start i bilen", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Måladress", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Tankning / laddning", { exact: true })).toBeVisible();
  await expect(tripDialog.getByRole("option", { name: "Tjänsteresa" })).toHaveCount(1);
  await expect(tripDialog.getByRole("option", { name: "Privat resa" })).toHaveCount(1);
  await expect(tripDialog.getByRole("option", { name: "Arbetsresa" })).toHaveCount(1);
});
