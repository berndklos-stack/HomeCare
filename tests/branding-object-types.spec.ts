import { expect, test } from "@playwright/test";
import { resolveAppBranding } from "../lib/branding";
import { defaultObjectTypeDefinitions, normalizeObjectTypeDefinitions } from "../lib/objectTypes";

test("Branding wird aus Unternehmensland und Sprache zentral aufgelöst", () => {
  expect(resolveAppBranding({ countryCode: "SE" }, "sv")).toMatchObject({
    brandName: "Koll",
    claim: "Full koll på jobbet",
  });
  expect(resolveAppBranding({ countryCode: "SE" }, "de")).toMatchObject({
    brandName: "Koll",
    claim: "Aufträge. Projekte. Service. Abrechnung.",
  });
  expect(resolveAppBranding({ countryCode: "DE" }, "en")).toMatchObject({
    brandName: "WorkCore",
    claim: "Jobs. Projects. Service. Billing.",
  });
  expect(resolveAppBranding({
    brandNameInternational: "FieldSuite",
    claimGerman: "Alles im Blick.",
    countryCode: "DE",
  }, "de")).toMatchObject({ brandName: "FieldSuite", claim: "Alles im Blick." });
});

test("Objekttypen erhalten robuste Standardfelder", () => {
  const definitions = normalizeObjectTypeDefinitions(undefined);
  expect(definitions).toEqual(defaultObjectTypeDefinitions);
  expect(definitions.find((definition) => definition.id === "Projekt")?.fieldGroups).toContain("project");
  expect(definitions.find((definition) => definition.id === "Projekt")?.fieldGroups).not.toContain("property");
  expect(definitions.find((definition) => definition.id === "Anlage")?.fieldGroups).toContain("asset");
});

test("Branding und Objekttyp bleiben nach dem Speichern erhalten", async ({ page }) => {
  const originalResponse = await page.request.get("/api/sync-sections?keys=companySettings,objects,customers");
  const originalPayload = await originalResponse.json() as { data: Record<string, { value: unknown }> };
  const originalPatch = Object.fromEntries(
    ["companySettings", "objects", "customers"].map((key) => [key, originalPayload.data[key]?.value]),
  );

  try {
    await page.goto("/");
    await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Koll" })).toBeVisible();
    await expect(page.getByText("Aufträge. Projekte. Service. Abrechnung.", { exact: true })).toBeVisible();

    await page.getByTestId("nav-masterData").click();
    await page.getByRole("button", { name: "System / Branding", exact: true }).click();
    await page.getByLabel("Internationaler Markenname").fill("FieldSuite");
    await page.getByLabel("Deutscher Claim").fill("Alles im Blick.");
    await page.getByRole("button", { name: "Branding speichern", exact: true }).click();
    await page.getByRole("button", { name: "Firma", exact: true }).click();
    await page.getByLabel("Unternehmensland (ISO)").fill("DE");
    await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
    await expect(page.getByRole("heading", { name: "FieldSuite" })).toBeVisible();
    await expect(page.getByText("Alles im Blick.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Projekt-/Objekttypen", exact: true }).click();
    const projectTypeCard = page.getByLabel("Deutsch Projekt").locator("xpath=ancestor::article");
    await page.getByLabel("Deutsch Projekt").fill("Kundenprojekt");
    await projectTypeCard.getByText("Felder bearbeiten", { exact: true }).click();
    await projectTypeCard.getByLabel("Feldname Projekt projectManager").fill("Verantwortlich");
    const projectFieldsBlock = projectTypeCard.locator(".object-type-block").filter({ hasText: "Projektangaben" });
    await projectFieldsBlock.getByRole("button", { name: "Feld hinzufügen", exact: true }).click();
    await projectFieldsBlock.getByRole("textbox").last().fill("Auftragsnummer");
    await page.getByRole("button", { name: "Projekt-/Objekttypen speichern", exact: true }).click();

    await page.getByTestId("nav-objects").click();
    await page.getByRole("button", { name: "Neues Projekt / Objekt", exact: true }).click();
    await page.getByLabel("Typ").selectOption("Projekt");
    await expect(page.getByLabel("Projektbeginn")).toBeVisible();
    await expect(page.getByLabel("Größe m²")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Kundenprojekt", exact: true }).fill("Logistik-Hub Süddeutschland");
    await page.getByLabel("Verantwortlich").fill("Bernd Klos");
    await page.getByLabel("Auftragsnummer").fill("AUF-42");
    await page.getByRole("button", { name: "Projekt / Objekt anlegen", exact: true }).click();
    await expect(page.getByText("Kundenprojekt · Logistik-Hub Süddeutschland", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 2_000 });
    await expect(page.getByRole("heading", { name: "FieldSuite" })).toBeVisible();
    await page.getByTestId("nav-objects").click();
    const projectRow = page.getByText("Kundenprojekt · Logistik-Hub Süddeutschland", { exact: true });
    await expect(projectRow).toBeVisible();
    await projectRow.click();
    await expect(page.getByLabel("Verantwortlich")).toHaveValue("Bernd Klos");
    await expect(page.getByLabel("Auftragsnummer")).toHaveValue("AUF-42");
  } finally {
    await page.request.post("/api/sync-sections", { data: { patch: originalPatch } });
  }
});

test("Kundenportal zeigt keine Branding-Administration", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByRole("button", { name: "System / Branding", exact: true })).toHaveCount(0);
});
