import { expect, test } from "@playwright/test";

test("new operations workspace supports core property and job flows", async ({ page }) => {
  const field = (name: string) => page.locator("label").filter({ hasText: name }).locator("input, textarea, select").first();
  const exactField = (name: string) => page.locator("label").filter({ hasText: new RegExp(`^${name}$`) }).locator("input, textarea, select").first();

  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true");

  await expect(page.getByRole("heading", { name: "Ferienhausverwaltung" })).toBeVisible();
  await expect(page.getByText("Objektakte", { exact: true })).toHaveCount(0);

  await page.getByTestId("nav-objects").click();
  await expect(page.getByRole("heading", { name: "Objektübersicht" })).toBeVisible();
  await expect(page.getByText("Objektakte", { exact: true })).toHaveCount(0);
  await expect(page.locator(".object-list article").filter({ hasText: "Villa Långsjön" })).toBeVisible();
  await page.locator(".object-list article").filter({ hasText: "Villa Långsjön" }).getByRole("button", { name: "Objekt Villa Långsjön bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Objekt bearbeiten" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historie / Verlauf" })).toBeVisible();
  await page.locator(".history-list").getByRole("button", { name: /Poolpflege und Wasserwerte/ }).click();
  await expect(page.getByText("Pool gereinigt, Werte stabilisiert, nächste Kontrolle geplant.")).toBeVisible();
  await expect(page.getByText("Filterdruck beobachten. Interner Hinweis nicht im Kundenportal.")).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF für Poolpflege und Wasserwerte ausgeben" })).toBeVisible();
  await page.getByRole("button", { name: "Bericht Poolpflege und Wasserwerte an Kunden senden" }).click();
  await expect(page.getByText("An eva.andersson@example.com gesendet")).toBeVisible();
  await page.getByRole("button", { name: "Zurück zur Objektübersicht" }).click();
  await expect(
    page.locator(".object-list article").filter({ hasText: "Villa Långsjön" }).getByRole("button", { name: "Objekt Villa Långsjön bearbeiten" }),
  ).toHaveAttribute("data-tooltip", "Objekt Villa Långsjön bearbeiten");
  await page.getByRole("button", { name: "Neues Objekt" }).click();
  await field("Objekt").fill("Testhaus Smaland");
  await field("Eigentümer aus Kunden").selectOption("CUS-2");
  await field("Objektadresse").fill("Testvägen 12, Nybro");
  await field("Rechnungsadresse verwenden").selectOption("Eigentümeradresse");
  await field("Größe m²").fill("145");
  await field("Grundstück m²").fill("2300");
  await field("Zimmer").fill("6");
  await field("Betten").fill("9");
  await field("Betreuungspaket").selectOption("Premium");
  await field("Zugang / Schlüssel").fill("Schlüsselsafe am Carport");
  await field("Dokument-Kurzbeschreibung").fill("Versicherungspolice Objekt");
  await page.getByLabel("Bilder hochladen").setInputFiles({
    name: "objektfoto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("demo"),
  });
  await page.getByLabel("Dokumente hochladen").setInputFiles({
    name: "versicherung.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("demo"),
  });
  await field("Ausstattung").fill("Pool, Sauna, Kamin");
  await field("Hinweise / Risiken").fill("Poolpumpe regelmäßig prüfen");
  await page.getByRole("button", { name: "Objekt anlegen" }).click();

  await expect(page.locator(".object-list article").filter({ hasText: "Testhaus Smaland" })).toBeVisible();
  await expect(page.getByText("145 m² · 2300 m² Grundstück")).toHaveCount(0);

  await page.locator(".object-list article").filter({ hasText: "Testhaus Smaland" }).getByRole("button", { name: "Objekt Testhaus Smaland bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Objekt bearbeiten" })).toBeVisible();
  await expect(page.getByText("Dokument: versicherung.pdf")).toBeVisible();
  await expect(field("Größe m²")).toHaveValue("145");
  await expect(field("Objektadresse")).toHaveValue("Testvägen 12, Nybro");
  await field("Telefon Eigentümer").fill("+46 70 123456");
  await field("Objektadresse").fill("Geänderter Weg 5, Nybro");
  await field("Alarmanlage").fill("Code im internen Tresor hinterlegt");
  await field("Internet").fill("Glasfaser, Router im Technikraum");
  await field("Nächster Besuch").fill("2026-08-12");
  await page.getByRole("button", { name: "Objekt speichern" }).click();

  await page.locator(".object-list article").filter({ hasText: "Testhaus Smaland" }).getByRole("button", { name: "Objekt Testhaus Smaland bearbeiten" }).click();
  await expect(field("Objektadresse")).toHaveValue("Geänderter Weg 5, Nybro");
  await expect(field("Telefon Eigentümer")).toHaveValue("+46 70 123456");
  await expect(page.getByText("Objektbild: objektfoto.jpg")).toBeVisible();
  await page.getByRole("button", { name: "Zurück zur Objektübersicht" }).click();

  await page.getByRole("button", { name: /\d+\s*Berichte/ }).click();
  await expect(page.getByRole("heading", { name: "Objektübersicht" })).toBeVisible();
  await page.getByRole("button", { name: /\d+\s*abrechenbar/ }).click();
  await expect(page.getByRole("heading", { name: "Abrechnung" })).toBeVisible();

  await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Neuer Auftrag" }).click();
  await field("Titel").fill("Testauftrag Objektkontrolle");
  await field("Typ").fill("Hauskontrolle");
  await field("Priorität").selectOption("hoch");
  await page.getByRole("button", { name: "Serienauftrag" }).click();
  await field("Wiederholen").selectOption("wöchentlich");
  await field("Intervall").fill("2");
  await page.getByRole("button", { name: "Mo", exact: true }).click();
  await page.getByRole("button", { name: "Fr", exact: true }).click();
  await field("Gültig von").selectOption("5");
  await field("Gültig bis").selectOption("9");
  await field("Jahresrhythmus").fill("2");
  await field("Ende").selectOption("nach");
  await field("Anzahl Termine").fill("6");
  await field("Beschreibung").fill("Innen, außen und Zugang dokumentieren");
  await field("Interne Notizen").fill("Nur intern sichtbar");
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();

  await expect(page.getByRole("heading", { name: "Auftragsübersicht" })).toBeVisible();
  await expect(page.getByText("Testauftrag Objektkontrolle")).toBeVisible();
  await expect(page.getByText(/Serie: alle 2 Wochen · Mo, Fr · gültig Mai bis September · alle 2 Jahre · 6 Termine/)).toBeVisible();
  await page.getByRole("button", { name: "Auftrag Testauftrag Objektkontrolle bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Auftrag bearbeiten" })).toBeVisible();
  await field("Titel").fill("Bearbeiteter Testauftrag");
  await page.getByRole("button", { name: "Auftrag speichern" }).click();
  await expect(page.getByText("Bearbeiteter Testauftrag")).toBeVisible();

  await page.getByTestId("nav-customers").click();
  await expect(page.getByRole("heading", { name: "Kundenübersicht" })).toBeVisible();
  await page.getByRole("button", { name: "Neuer Kunde" }).click();
  await field("Kunde").fill("Familie Beispiel");
  await field("Ansprechpartner").fill("Anna Beispiel");
  await field("E-Mail").fill("anna@example.com");
  await field("Telefon").fill("+46 70 998877");
  await field("Eigentümeradresse / Rechnungsadresse").fill("Beispielweg 4, 12345 Berlin");
  await field("Notizen / interne Info").fill("Bevorzugt E-Mail, keine Telefonate am Wochenende");
  await page.getByRole("button", { name: "Kunde anlegen" }).click();
  await expect(page.getByText("Familie Beispiel")).toBeVisible();
  await page.locator(".table-list article").filter({ hasText: "M. Schneider" }).getByRole("button", { name: "Kunde M. Schneider bearbeiten" }).click();
  await expect(page.getByRole("dialog").getByText("Stuga Nybro")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Testhaus Smaland")).toBeVisible();
  await field("Objekt zuordnen").selectOption("OBJ-1001");
  await expect(page.locator(".assigned-row").filter({ hasText: "Villa Långsjön" })).toBeVisible();
  await page.getByRole("button", { name: "Kunde speichern" }).click();
  await page.getByTestId("nav-objects").click();
  await page.locator(".object-list article").filter({ hasText: "Villa Långsjön" }).getByRole("button", { name: "Objekt Villa Långsjön bearbeiten" }).click();
  await expect(exactField("Eigentümer")).toHaveValue("M. Schneider");
  await page.getByRole("button", { name: "Zurück zur Objektübersicht" }).click();
  await page.getByTestId("nav-customers").click();
  await page.locator(".table-list article").filter({ hasText: "Familie Beispiel" }).getByRole("button", { name: "Kunde Familie Beispiel bearbeiten" }).click();
  await field("Telefon").fill("+46 70 112233");
  await page.getByRole("button", { name: "Kunde speichern" }).click();
  await expect(page.getByText("+46 70 112233")).toBeVisible();
  await page.locator(".table-list article").filter({ hasText: "M. Schneider" }).getByRole("button", { name: "Kunde M. Schneider archivieren" }).click();
  await expect(page.getByText(/Kunde "M. Schneider" kann nicht archiviert werden:/)).toBeVisible();
  await page.locator(".table-list article").filter({ hasText: "Familie Beispiel" }).getByRole("button", { name: "Kunde Familie Beispiel archivieren" }).click();
  await expect(page.getByText('Kunde "Familie Beispiel" wurde archiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Archivierten Kunden Familie Beispiel bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Kunde bearbeiten" })).toBeVisible();
  await field("Notizen / interne Info").fill("Archiviert geprüft, kann reaktiviert werden");
  await page.getByRole("button", { name: "Kunde speichern" }).click();
  await expect(page.getByRole("button", { name: "Archivierten Kunden Familie Beispiel reaktivieren" })).toBeVisible();
  await page.getByRole("button", { name: "Archivierten Kunden Familie Beispiel reaktivieren" }).click();
  await expect(page.getByText('Kunde "Familie Beispiel" wurde wieder aktiviert.')).toBeVisible();
  await page.locator(".table-list article").filter({ hasText: "Familie Beispiel" }).getByRole("button", { name: "Kunde Familie Beispiel archivieren" }).click();
  await page.getByRole("button", { name: "Archivierten Kunden Familie Beispiel löschen" }).click();
  await expect(page.getByText('Archivierter Kunde "Familie Beispiel" wurde endgültig gelöscht.')).toBeVisible();

  await page.getByTestId("nav-planning").click();
  await expect(page.getByRole("heading", { name: "Einsatzplanung" })).toBeVisible();
  await page.getByRole("button", { name: /Bearbeiteter Testauftrag/ }).click();
  await expect(page.getByRole("heading", { name: "Bearbeiteter Testauftrag" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Zugang prüfen" }).getByText("Hauskontrolle · Kontrolle · 795 SEK/Besuch")).toBeVisible();
  await page.getByLabel("Zeit Zugang prüfen").fill("22");
  await page.getByLabel("Hinweis Zugang prüfen").fill("Schlüsselsafe geprüft, Zugang ohne Problem.");
  await page.getByLabel("Bild zu Zugang prüfen erfassen").setInputFiles({
    name: "einsatzfoto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("demo"),
  });
  await expect(page.getByText("Neues Foto erfasst")).toBeVisible();
  await page.getByRole("button", { name: "Foto benutzen" }).click();
  await expect(page.getByText("Foto übernommen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Einsatz abschließen" })).toBeVisible();
  await page.getByRole("button", { name: "Einsatz abschließen" }).click();
  await expect(page.getByRole("heading", { name: "Objektübersicht" })).toBeVisible();
  await page.locator(".object-list article").filter({ hasText: "Villa Långsjön" }).getByRole("button", { name: "Objekt Villa Långsjön archivieren" }).click();
  await expect(page.getByText(/Objekt "Villa Långsjön" kann nicht archiviert werden:/)).toBeVisible();
  await page.locator(".object-list article").filter({ hasText: "Testhaus Smaland" }).getByRole("button", { name: "Objekt Testhaus Smaland archivieren" }).click();
  await expect(page.getByText('Objekt "Testhaus Smaland" wurde archiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Archiviertes Objekt Testhaus Smaland bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Objekt bearbeiten" })).toBeVisible();
  await field("Nächster Besuch").fill("2026-08-20");
  await page.getByRole("button", { name: "Objekt speichern" }).click();
  await expect(page.getByText('Objekt "Testhaus Smaland" wurde archiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Archiviertes Objekt Testhaus Smaland reaktivieren" }).click();
  await expect(page.getByText('Objekt "Testhaus Smaland" wurde wieder aktiviert.')).toBeVisible();

  await page.getByTestId("nav-masterData").click();
  await expect(page.getByRole("heading", { name: "Leistungen einzeln erfassen" })).toBeVisible();
  await expect(page.getByText("Objektakte", { exact: true })).toHaveCount(0);
  await expect(page.locator(".package-catalog").getByText("Premium")).toBeVisible();
  await expect(page.locator(".service-catalog article").filter({ hasText: "Sonderleistung" }).getByText("Notdienst")).toBeVisible();
  await expect(field("Kategorie")).toHaveValue("");
  await expect(field("Einheit")).toHaveValue("");
  await field("Leistung").fill("Fensterkontrolle");
  await field("Kategorie").fill("Kontrolle");
  await field("Einheit").fill("Kontrollgang");
  await field("Preis").fill("350");
  await field("Währung").selectOption("SEK");
  await field("Beschreibung").fill("Fenster schließen, Griffe prüfen und Auffälligkeiten dokumentieren");
  await field("Punkt").fill("Fensterstatus prüfen");
  await field("Standardzeit min.").fill("12");
  await field("Hinweis / Info").fill("Fenster schließen, Griffe prüfen und Schäden dokumentieren.");
  await page.getByRole("button", { name: "Checklistenpunkt hinzufügen" }).click();
  await expect(page.getByText("Fensterstatus prüfen")).toBeVisible();
  await page.getByRole("button", { name: "Leistung anlegen" }).click();
  await expect(page.locator(".service-catalog").getByText("Fensterkontrolle")).toBeVisible();
  await expect(page.locator(".service-catalog article").filter({ hasText: "Fensterkontrolle" }).getByText("1 Checklistenpunkte")).toBeVisible();
  await page.locator(".service-catalog article").filter({ hasText: "Fensterkontrolle" }).getByRole("button", { name: "Leistung Fensterkontrolle bearbeiten" }).click();
  await field("Kategorie").fill("Winterservice");
  await field("Preis").fill("375 SEK");
  await page.getByRole("button", { name: "Leistung speichern" }).click();
  await expect(page.locator("datalist#service-categories option[value='Winterservice']")).toHaveCount(1);
  await expect(page.locator("datalist#service-units option[value='Kontrollgang']")).toHaveCount(1);
  await expect(page.locator(".service-catalog article").filter({ hasText: "Fensterkontrolle" }).getByText("375 SEK/Kontrollgang")).toBeVisible();
  await field("Paketname").fill("Winterpaket");
  await field("Paketpreis").fill("3.990 SEK/Jahr");
  await field("Paketbeschreibung").fill("Winterkontrollen und schnelle Rückmeldung bei Schäden");
  await page.getByRole("button", { name: "Leistungen auswählen" }).click();
  await expect(page.getByRole("dialog", { name: "Leistungen auswählen" })).toBeVisible();
  await page.getByRole("dialog", { name: "Leistungen auswählen" }).getByLabel(/Fensterkontrolle/).check();
  await page.getByRole("dialog", { name: "Leistungen auswählen" }).getByLabel(/Hauskontrolle/).check();
  await page.getByRole("button", { name: "Auswahl übernehmen" }).click();
  await page.getByRole("button", { name: "Paket anlegen" }).click();
  await expect(page.locator(".package-catalog").getByText("Winterpaket")).toBeVisible();
  await expect(page.locator(".package-catalog").getByText("Fensterkontrolle")).toBeVisible();
  await page.locator(".package-catalog article").filter({ hasText: "Winterpaket" }).getByRole("button", { name: "Paket Winterpaket bearbeiten" }).click();
  await field("Paketpreis").fill("4.290 SEK/Jahr");
  await page.getByRole("button", { name: "Leistungen auswählen" }).click();
  await page.getByRole("dialog", { name: "Leistungen auswählen" }).getByLabel(/Notdienst/).check();
  await page.getByRole("button", { name: "Auswahl übernehmen" }).click();
  await page.getByRole("button", { name: "Paket speichern" }).click();
  await expect(page.locator(".package-catalog article").filter({ hasText: "Winterpaket" }).getByText("4.290 SEK/Jahr")).toBeVisible();
  await expect(page.locator(".package-catalog article").filter({ hasText: "Winterpaket" }).getByText("Notdienst")).toBeVisible();
  await page.getByRole("button", { name: "Leistung Hauskontrolle archivieren" }).click();
  await expect(page.getByText(/Leistung "Hauskontrolle" ist noch aktiv bei:/)).toBeVisible();
  await page.getByRole("button", { name: "Leistung Fensterkontrolle archivieren" }).click();
  await expect(page.getByText('Leistung "Fensterkontrolle" wurde archiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Archivierte Leistung Fensterkontrolle bearbeiten" }).click();
  await field("Preis").fill("390");
  await page.getByRole("button", { name: "Leistung speichern" }).click();
  await expect(page.getByText("390 SEK/Kontrollgang")).toBeVisible();
  await page.getByRole("button", { name: "Archivierte Leistung Fensterkontrolle reaktivieren" }).click();
  await expect(page.getByText('Leistung "Fensterkontrolle" wurde wieder aktiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Leistung Fensterkontrolle archivieren" }).click();
  await page.getByRole("button", { name: "Archivierte Leistung Fensterkontrolle löschen" }).click();
  await expect(page.getByText('Archivierte Leistung "Fensterkontrolle" wurde endgültig gelöscht.')).toBeVisible();
  await page.getByRole("button", { name: "Paket Komfort archivieren" }).click();
  await expect(page.getByText(/Paket "Komfort" ist noch aktiv bei:/)).toBeVisible();
  await page.getByRole("button", { name: "Paket Winterpaket archivieren" }).click();
  await expect(page.getByText('Paket "Winterpaket" wurde archiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Archiviertes Paket Winterpaket bearbeiten" }).click();
  await field("Paketpreis").fill("4.490 SEK/Jahr");
  await page.getByRole("button", { name: "Paket speichern" }).click();
  await expect(page.getByText("4.490 SEK/Jahr")).toBeVisible();
  await page.getByRole("button", { name: "Archiviertes Paket Winterpaket reaktivieren" }).click();
  await expect(page.getByText('Paket "Winterpaket" wurde wieder aktiviert.')).toBeVisible();
  await page.getByRole("button", { name: "Paket Winterpaket archivieren" }).click();
  await page.getByRole("button", { name: "Archiviertes Paket Winterpaket löschen" }).click();
  await expect(page.getByText('Archiviertes Paket "Winterpaket" wurde endgültig gelöscht.')).toBeVisible();

  await page.getByLabel("Sprache").selectOption("sv");
  await expect(page.getByRole("heading", { name: "Fritidshusförvaltning" })).toBeVisible();
});
