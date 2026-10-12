import { expect, test } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/resource-types", (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
});

test("Bedienoberflaeche folgt der App-Sprache unabhaengig von der Fahrzeugsprache", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });

  await page.getByLabel("Sprache").selectOption("sv");
  await page.getByRole("button", { name: "Grunddata", exact: true }).click();
  await page.getByRole("button", { name: "Resurser", exact: true }).click();
  await page.locator("article").filter({ hasText: "Servicebil Kolaretorp" }).first().click();

  const resourceDialog = page.locator(".resource-editor-modal, .resource-editor-workspace");
  await expect(resourceDialog.getByText("Tillverkningsår", { exact: true })).toBeVisible();
  await resourceDialog.getByLabel("Körjournalens språk").selectOption("sv");
  await resourceDialog.getByRole("button", { name: "Spara resurs", exact: true }).click();
  await resourceDialog.getByRole("button", { name: "Körjournal", exact: true }).click();
  await expect(resourceDialog.getByRole("cell", { name: "Tjänsteresa", exact: true })).toBeVisible();
  await resourceDialog.getByRole("button", { name: "Stäng resurs" }).click();

  await page.getByLabel("Språk").selectOption("de");
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();

  const tripDialog = page.locator(".quick-trip-modal");
  await expect(tripDialog.getByRole("heading", { name: "Fahrt erfassen" })).toBeVisible();
  await expect(tripDialog.getByText("Start im Auto", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Zieladresse", { exact: true })).toBeVisible();
  await expect(tripDialog.getByText("Tanken / Laden", { exact: true })).toBeVisible();
  await expect(tripDialog.getByRole("option", { name: "Dienstfahrt" })).toHaveCount(1);
  await expect(tripDialog.getByRole("option", { name: "Privatfahrt" })).toHaveCount(1);
  await expect(tripDialog.getByRole("button", { name: "Fahrt abschließen & speichern", exact: true })).toBeVisible();
  await expect(tripDialog.getByLabel("Standardfahrt wählen", { exact: true })).toBeVisible();
  await tripDialog.getByLabel("Als Standardfahrt speichern", { exact: true }).check();
  await expect(tripDialog.getByLabel("Wie soll die Standardfahrt heißen?", { exact: true })).toBeVisible();
});

test("Neue Fahrtaktionen werden auf Englisch angezeigt", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByLabel("Sprache").selectOption("en");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await page.locator("article").filter({ hasText: "Servicebil Kolaretorp" }).first().click();
  const resourceDialog = page.locator(".resource-editor-modal, .resource-editor-workspace");
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
