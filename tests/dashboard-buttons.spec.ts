import { expect, test, type Page } from "@playwright/test";

async function clickButton(page: Page, name: string | RegExp) {
  await page
    .getByRole("button", { name })
    .first()
    .evaluate((element) => {
      if (element instanceof HTMLButtonElement) {
        element.click();
      }
    });
}

test("dashboard buttons navigate to the expected app areas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText("Betriebssystem für Ferienhausverwaltung")).toBeVisible();
  await expect(page.getByText("Dein Büro")).toBeVisible();
  await expect(page.getByText("Vor Ort arbeiten")).toBeVisible();
  await expect(page.getByText("Finanzen")).toBeVisible();

  await page.getByRole("button", { name: /Kundenübersicht/ }).click();
  await expect(page.getByRole("heading", { name: "Kundenübersicht" })).toBeVisible();
  await clickButton(page, "Portal öffnen");
  await expect(page.getByText("Kundenportal vorbereitet")).toBeVisible();
  await clickButton(page, "Verwaltung");

  await page.getByTestId("nav-masterData").click();
  await expect(page.getByRole("heading", { name: "Stammdatenübersicht" })).toBeVisible();
  await clickButton(page, "Neuer Kunde");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Kunde").fill("Familie Demo");
  await page.getByLabel("Eigentümer").fill("Dora Demo");
  await page.getByLabel("E-Mail").fill("demo@example.com");
  await clickButton(page, /Kunde anlegen/);
  await expect(page.getByRole("heading", { name: "Kundenübersicht" })).toBeVisible();
  await expect(page.getByText("Familie Demo")).toBeVisible();

  await page.getByTestId("nav-masterData").click();
  await clickButton(page, "Katalog öffnen");
  await expect(page.getByRole("heading", { name: "Dienstleistungskatalog" })).toBeVisible();

  await page.getByTestId("nav-services").click();
  await expect(page.getByRole("heading", { name: "Dienstleistungskatalog" })).toBeVisible();
  await expect(page.getByText("Basis")).toBeVisible();
  await expect(page.getByText("2.990 SEK")).toBeVisible();
  await clickButton(page, "Neue Leistung");
  await expect(page.getByRole("dialog")).toBeVisible();
  const serviceDialog = page.getByRole("dialog");
  await serviceDialog.getByLabel("Leistung", { exact: true }).fill("Fensterreinigung");
  await serviceDialog.locator("select").first().selectOption("Zusatzleistung");
  await serviceDialog.getByLabel("Kategorie", { exact: true }).fill("Innenbereich");
  await serviceDialog.getByLabel("Preis", { exact: true }).fill("650 SEK");
  await serviceDialog.getByLabel("Einheit", { exact: true }).fill("Stunde");
  await serviceDialog.getByLabel("Intervall", { exact: true }).fill("nach Bedarf");
  await serviceDialog.getByLabel("SLA", { exact: true }).fill("nach Vereinbarung");
  await serviceDialog.getByLabel("Enthalten", { exact: true }).fill("Fenster innen, Fenster außen, Fotodokumentation");
  await clickButton(page, /Leistung anlegen/);
  await expect(page.getByText("Fensterreinigung")).toBeVisible();
  await clickButton(page, "Gartenpflege");
  await expect(page.getByRole("heading", { name: "Auftragsübersicht" })).toBeVisible();

  await page.getByTestId("nav-communication").click();
  await expect(page.getByRole("heading", { name: "Kommunikation" })).toBeVisible();
  await page.locator(".communication-table article").first().getByRole("button", { name: "Details öffnen" }).click();
  await expect(page.getByText(/Nachricht vorbereitet/)).toBeVisible();

  await page.getByTestId("nav-billing").click();
  await expect(page.getByRole("heading", { name: "Abrechnung" })).toBeVisible();
  await clickButton(page, "Position ergänzen");
  await expect(page.getByText("Abrechnungsposition ergänzt")).toBeVisible();
  await page.getByRole("button", { name: "Details öffnen" }).last().click();
  await expect(page.getByText(/Rechnung vorbereitet/)).toBeVisible();

  await page.getByTestId("nav-jobs").click();
  await expect(page.getByRole("heading", { name: "Auftragsübersicht" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await clickButton(page, /Neuer Auftrag/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Titel").fill("Test Auftrag");
  await page.getByLabel("Priorität").selectOption("hoch");
  await page.getByLabel("Beschreibung").fill("Fenster prüfen und Fotos im Bericht ergänzen");
  await page.getByLabel("Interne Notizen").fill("Nur intern sichtbar");
  await clickButton(page, /Auftrag anlegen/);
  await expect(page.getByRole("button", { name: /Test Auftrag/ })).toBeVisible();

  await page.getByTestId("nav-objects").click();
  await expect(page.getByRole("heading", { name: "Objektübersicht" })).toBeVisible();
  await clickButton(page, /Neues Objekt/);
  await page.getByLabel("Objekt", { exact: true }).fill("Testhaus Smaland");
  await page.getByLabel("Eigentümer", { exact: true }).fill("Familie Test");
  await page.getByLabel("Ort", { exact: true }).fill("Nybro");
  await page.getByLabel("Adresse", { exact: true }).fill("Testvägen 12, Nybro");
  await page.getByLabel("Größe", { exact: true }).fill("145");
  await page.getByLabel("Zimmer", { exact: true }).fill("6");
  await page.getByLabel("Betten", { exact: true }).fill("9");
  await page.getByRole("dialog").locator("select").last().selectOption("Premium");
  await page.getByLabel("Zugang", { exact: true }).fill("Schlüsselsafe am Carport");
  await page.getByLabel("Ausstattung", { exact: true }).fill("Pool, Sauna, Kamin");
  await page.getByLabel("Hinweise", { exact: true }).fill("Poolpumpe regelmäßig prüfen");
  await clickButton(page, /Objekt anlegen/);
  await expect(page.getByRole("button", { name: /Testhaus Smaland/ })).toBeVisible();

  await clickButton(page, /Testhaus Smaland/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Familie Test")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("145 m²")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Premium")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Schlüsselsafe am Carport")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Poolpumpe regelmäßig prüfen")).toBeVisible();
  await clickButton(page, "Schließen");

  await page.getByTestId("nav-schedule").click();
  await expect(page.getByRole("heading", { name: "Einsatzplan" })).toBeVisible();
  await clickButton(page, "Einsatz starten");
  await expect(page.getByText("Aktueller Einsatz")).toBeVisible();
  await clickButton(page, "Pausieren");
  await expect(page.getByText("Einsatz wurde pausiert")).toBeVisible();
  await clickButton(page, "+ Foto");
  await clickButton(page, "Abschließen");
  await expect(page.getByRole("heading", { name: "Berichtsübersicht" })).toBeVisible();
  await expect(page.locator(".report-table").getByText("Test Auftrag").first()).toBeVisible();

  await clickButton(page, "Mobil vor Ort");
  await clickButton(page, /Zur Freigabe senden/);
  await expect(page.getByText("5/5")).toBeVisible();

  await clickButton(page, "Verwaltung");
  await page.getByTestId("nav-reports").click();
  await expect(page.getByRole("heading", { name: "Berichtsübersicht" })).toBeVisible();

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByRole("heading", { name: "Freigabeübersicht" })).toBeVisible();
  await clickButton(page, "Freigeben");

  await clickButton(page, /v0\./);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Änderungsverlauf", { exact: true }),
  ).toBeVisible();
  await clickButton(page, "Schließen");

  await clickButton(page, "Dunkelmodus");
  await expect(page.locator("main")).toHaveAttribute("data-theme", "dark");

  await page.getByLabel("Language").selectOption("sv");
  await expect(page.getByRole("heading", { name: "Servicecentral för fritidshus" })).toBeVisible();
});
