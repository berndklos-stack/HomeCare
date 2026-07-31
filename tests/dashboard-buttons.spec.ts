import { expect, test } from "@playwright/test";

test("new operations workspace supports core property and job flows", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");

  await expect(page.getByRole("heading", { name: "Ferienhausverwaltung" })).toBeVisible();
  await expect(page.getByText("Objektakte", { exact: true })).toBeVisible();
  await expect(page.getByText("Villa Långsjön")).toBeVisible();

  await page.getByTestId("nav-objects").click();
  await expect(page.getByRole("heading", { name: "Objektübersicht" })).toBeVisible();
  await page.getByRole("button", { name: "Neues Objekt" }).click();
  await page.getByLabel("Objekt").fill("Testhaus Smaland");
  await page.getByLabel("Eigentümer").fill("Familie Test");
  await page.getByLabel("Adresse").fill("Testvägen 12, Nybro");
  await page.getByLabel("Größe m²").fill("145");
  await page.getByLabel("Grundstück m²").fill("2300");
  await page.getByLabel("Zimmer").fill("6");
  await page.getByLabel("Betten").fill("9");
  await page.getByLabel("Betreuungspaket").selectOption("Premium");
  await page.getByLabel("Zugang / Schlüssel").fill("Schlüsselsafe am Carport");
  await page.getByLabel("Ausstattung").fill("Pool, Sauna, Kamin");
  await page.getByLabel("Hinweise / Risiken").fill("Poolpumpe regelmäßig prüfen");
  await page.getByRole("button", { name: "Objekt anlegen" }).click();

  await expect(page.getByRole("heading", { name: "Testhaus Smaland" })).toBeVisible();
  await expect(page.getByText("145 m² · 2300 m² Grundstück")).toBeVisible();
  await expect(page.getByText("Schlüsselsafe am Carport")).toBeVisible();
  await expect(page.getByText("Poolpumpe regelmäßig prüfen")).toBeVisible();

  await page.getByRole("button", { name: "Neuer Auftrag" }).first().click();
  await page.getByLabel("Titel").fill("Testauftrag Objektkontrolle");
  await page.getByLabel("Typ").fill("Hauskontrolle");
  await page.getByLabel("Priorität").selectOption("hoch");
  await page.getByLabel("Beschreibung").fill("Innen, außen und Zugang dokumentieren");
  await page.getByLabel("Interne Notizen").fill("Nur intern sichtbar");
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();

  await expect(page.getByRole("heading", { name: "Auftragsübersicht" })).toBeVisible();
  await expect(page.getByText("Testauftrag Objektkontrolle")).toBeVisible();

  await page.getByTestId("nav-planning").click();
  await expect(page.getByRole("heading", { name: "Einsatzplanung" })).toBeVisible();
  await page.getByRole("button", { name: /Testauftrag Objektkontrolle/ }).click();
  await expect(page.getByRole("button", { name: "Einsatz abschließen" })).toBeVisible();
  await page.getByRole("button", { name: "Einsatz abschließen" }).click();
  await expect(page.getByRole("heading", { name: "Berichtsübersicht" })).toBeVisible();

  await page.getByTestId("nav-masterData").click();
  await expect(page.getByRole("heading", { name: "Leistungen und Pakete" })).toBeVisible();
  await expect(page.locator(".service-catalog").getByText("Premium")).toBeVisible();
  await expect(page.locator(".service-catalog").getByText("Notdienst")).toBeVisible();

  await page.getByLabel("Sprache").selectOption("sv");
  await expect(page.getByRole("heading", { name: "Fritidshusförvaltning" })).toBeVisible();
});
