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

  const tripDialog = page.locator(".quick-trip-modal");
  await expect(tripDialog.getByRole("heading", { name: "Registrera körning" })).toBeVisible();
  await expect(tripDialog.getByText("Start i bilen", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Måladress", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Tankning / laddning", { exact: true })).toBeVisible();
  await expect(tripDialog.getByRole("option", { name: "Tjänsteresa" })).toHaveCount(1);
  await expect(tripDialog.getByRole("option", { name: "Privat resa" })).toHaveCount(1);
  await expect(tripDialog.getByRole("option", { name: "Arbetsresa" })).toHaveCount(1);
  await expect(tripDialog.getByRole("button", { name: "Avsluta och spara körning", exact: true })).toBeVisible();
  await expect(tripDialog.getByLabel("Välj standardresa", { exact: true })).toBeVisible();
  await tripDialog.getByLabel("Spara som standardresa", { exact: true }).check();
  await expect(tripDialog.getByLabel("Vad ska standardresan heta?", { exact: true })).toBeVisible();
});

test("Neue Fahrtaktionen werden auf Englisch angezeigt", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByLabel("Sprache").selectOption("en");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await page.locator("article").filter({ hasText: "Servicebil Kolaretorp" }).first().click();
  const resourceDialog = page.getByRole("dialog");
  await resourceDialog.getByLabel("Logbook language").selectOption("en");
  await resourceDialog.getByRole("button", { name: "Save resource", exact: true }).click();
  await resourceDialog.getByRole("button", { name: "Close resource" }).click();
  await page.getByRole("button", { name: "Trip", exact: true }).click();
  const tripDialog = page.locator(".quick-trip-modal");
  await expect(tripDialog.getByRole("button", { name: "Finish and save trip", exact: true })).toBeVisible();
  await expect(tripDialog.getByLabel("Select standard trip", { exact: true })).toBeVisible();
  await tripDialog.getByLabel("Save as standard trip", { exact: true }).check();
  await expect(tripDialog.getByLabel("What should the standard trip be called?", { exact: true })).toBeVisible();
});
