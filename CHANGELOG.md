# Changelog

Alle nennenswerten Änderungen an der Kolaretorp Service App werden hier
protokolliert. Die App zeigt die aktuelle Version zusätzlich direkt in der
Oberfläche an.

## 1.9.0 - 2026-08-09

- Leistungen im Paket werden über einen Plus-Button in einem Auswahl-Popup gepflegt.
- Leistungsauswahl ist nach Kategorie gruppiert und alphabetisch sortiert.
- Paketformular zeigt nur noch eine kompakte Zusammenfassung der ausgewählten Leistungen.
- Playwright-Test prüft den neuen Paket-Leistungswähler.

## 1.8.0 - 2026-08-09

- Doppelten Firmennamen aus dem Kopfbereich entfernt.
- Dashboard-Arbeitskacheln zentrieren ihre Inhalte.
- Leistungen und Pakete nutzen Icon-Buttons zum Bearbeiten und Archivieren.
- Archivierung prüft aktive Nutzung bei Kunden, Objekten und Paketen.
- Archivierte Leistungen, Pakete, Kunden und Objekte können endgültig gelöscht werden.

## 1.7.0 - 2026-08-09

- Objektakte wird nur noch im Menüpunkt Objekte angezeigt.
- Alle anderen Menüpunkte nutzen wieder die volle Arbeitsbreite ohne Objektakten-Seitenblock.
- Playwright-Test prüft die eingeschränkte Sichtbarkeit der Objektakte.

## 1.6.0 - 2026-08-09

- Leistungen können in den Stammdaten bearbeitet und gespeichert werden.
- Pakete können bearbeitet und mit geänderten Leistungszuordnungen gespeichert werden.
- Kategorie-Feld der Leistungen als lernendes Dropdown mit bestehenden Kategorien umgesetzt.
- Playwright-Test prüft Bearbeitung von Leistungen, Paketbearbeitung und neue Kategorien.

## 1.5.0 - 2026-08-09

- Kunden können im Bearbeiten-Dialog Objekte per Dropdown zugeordnet bekommen.
- Kunden-Objekt-Zuordnung synchronisiert Eigentümerdaten zurück in die Objektstammdaten.
- Zugeordnete Objekte können aus der Kundenmaske wieder entfernt werden.
- Kundenübersicht kompakter gestaltet: Bearbeiten-Button rechts und Kundendaten auf zwei Zeilen begrenzt.

## 1.4.0 - 2026-08-09

- Stammdatenmodul in einzelne Leistungen und Leistungspakete aufgeteilt.
- Neue Leistungen können mit Kategorie, Einheit, Preis und Beschreibung angelegt werden.
- Pakete können aus mehreren vorhandenen Leistungen zusammengestellt werden.
- Paketkarten zeigen die enthaltenen Leistungen als Tags.
- Playwright-Test prüft Leistungserfassung und Paketbildung.

## 1.3.0 - 2026-08-09

- Objektübersicht zeigt je Objektzeile einen eigenen Bearbeiten-Button.
- Objekt-Bearbeitung öffnet in einem deutlich größeren Dialog.
- Rechte Objektakte wurde auf Hauptstammdaten bis einschließlich Objektadresse gekürzt.
- Globaler Neuer-Auftrag-Button aus der Kopfzeile entfernt; Aufträge werden im Auftragsbereich angelegt.

## 1.2.0 - 2026-08-09

- Objekte können einem Eigentümer aus den Kundenstammdaten zugeordnet werden.
- Objektadresse, Eigentümeradresse und Rechnungsadresse werden getrennt gepflegt.
- Rechnungsadresse kann aus Objektadresse, Eigentümeradresse oder einer abweichenden Adresse gewählt werden.
- Bilder, Handy-Fotos, Dokumente und Grundrisse können in der Objektmaske erfasst werden.
- Dokumente erhalten eine Kurzbeschreibung und erscheinen in der Objektakte.
- Objektakte zeigt ein Objektfoto als Vorschau und einen Korrespondenzverlauf aus Nachrichten und gesendeten Einsatzberichten.
- Kundenformular zeigt nur zugeordnete Objekte und enthält ein internes Notizfeld.
- Farbsystem an Apple-nahe neutrale Grautöne mit sparsamer blauer Aktionsfarbe angepasst.
- Kolaretorp-Logo aus der Website als App-Branding eingebunden.

## 1.1.0 - 2026-08-09

- Objekte können direkt aus der Objektakte heraus bearbeitet und gespeichert werden.
- Objektformular um Eigentümerkontakt, Status, Baujahr, Zugang, Technik, Medienzahlen und Besuchsplanung erweitert.
- Stammdatenänderungen aktualisieren die bestehende Objektakte statt ein neues Objekt anzulegen.
- Kunden können angelegt und bearbeitet werden, inklusive Kontakt, Portalstatus und Objektzuordnung.
- Aufträge können angelegt und bearbeitet werden.
- Berichte und Kommunikation hängen nun objektbezogen in der Objektakte und sind nicht mehr als eigene Hauptmenüpunkte sichtbar.
- Die Objektakte wird nur noch in Bereichen mit echtem Objektkontext angezeigt, nicht mehr in Stammdaten, Kunden, Aufträgen oder Abrechnung.
- Übersichtskacheln im Kopfbereich sind jetzt klickbare, zentrierte Sprungbuttons zu Objekten, Einsatzplanung, Berichten und Abrechnung.
- Versionsanzeige in der unteren Menüspalte deutlicher dargestellt.
- Playwright-Test prüft Objekt-, Kunden- und Auftragsanlage inklusive Bearbeitung und Quickbar-Navigation.

## 1.0.0 - 2026-07-31

- App-Oberfläche als ruhige, tabellenorientierte Arbeitssoftware neu aufgebaut.
- Objektakte als zentrale Detailansicht mit Stammdaten, Eigentümer, Zugang, Technik, Ausstattung, Risiken, Medien und Protokoll umgesetzt.
- Objektanlage fachlich neu strukturiert mit sinnvollen Feldern für Ferienhausverwaltung.
- Auftragsanlage, Einsatzplanung, mobile Bearbeitung, Berichte, Kommunikation, Abrechnung und Stammdaten neu ausgerichtet.
- E2E-Test auf die neuen Kernflows Objektanlage, Auftrag, Planung, mobile Bearbeitung und Stammdaten umgestellt.

## 0.9.0 - 2026-07-31

- Dashboard in Richtung einer HERO-artigen Funktionszentrale weiterentwickelt.
- Drei Kernmodule für Kommunikation, Finanzen und Automatisierung ergänzt.
- Feature-Gruppen für Büro, Vor-Ort-Arbeit, Team, Objekte/Kunden und Finanzen ergänzt.
- Schnittstellen bewusst nicht als eigener Bereich aufgenommen.
- Playwright-Test prüft die neue Funktionszentrale.

## 0.8.1 - 2026-07-31

- Kopfbereich kompakter gestaltet und Überschrift auf maximal zwei Zeilen begrenzt.
- Sprachumschaltung von einzelnen Buttons auf ein Dropdownfeld umgestellt.
- Versionschip aus der Topbar entfernt, weil die Version bereits in der Sidebar verfügbar ist.
- Dashboard-Hero und Übersichtsdaten deutlich kompakter dargestellt.

## 0.8.0 - 2026-07-31

- Leistungskatalog aus der Kolaretorp-Broschüre als Stammdaten ergänzt.
- Betreuungspakete Basis, Plus, Komfort und Premium mit Preisen, Kontrollanzahl und Leistungsumfang angelegt.
- Zusatzleistungen Hauskontrolle, Gartenpflege, Schlüsselservice, Hausmeisterservice, Reinigung und Notdienst ergänzt.
- Neue Leistungen können im Katalog lokal angelegt und danach für Aufträge genutzt werden.
- Objektstammdaten um Eigentümer, Adresse, Größe, Räume, Betten, Betreuungspaket, Zugang, Ausstattung, Hinweise, Bilder und Dokumente erweitert.
- Objektakte zeigt verknüpfte Einsätze, Berichte, Kommunikation und Abrechnungspositionen.
- Supabase-Objekttabelle um technische Stammdaten, Medien- und Hinweisfelder erweitert.
- Supabase-Servicekategorien um Paket-, Preis-, Intervall-, SLA- und Leistungsumfangfelder erweitert.
- Playwright-Test prüft Sichtbarkeit der Broschürenleistungen, Neuanlage einer Leistung und umfangreiche Objektanlage.

## 0.6.0 - 2026-07-31

- Berichtsmodul mit Kunden- und interner Sicht, Medienübersicht und PDF-Vorbereitung ergänzt.
- Auftragsanlage um Priorität, Fälligkeitsdatum, Zuständigkeit, Beschreibung und interne Notizen erweitert.
- Einsatzplanung um Filter nach Mitarbeiter, Dienstleistung und Status sowie Kennzahlen für offen, heute und überfällig ergänzt.
- Mobile Einsatzbearbeitung mit Start, Pause, Abschluss, Arbeitszeit, Material, Notizen und Medien-Zählern ausgebaut.
- Kundenanlage und Kundenportal-Auftragsanfrage ergänzt.
- Abrechnungspositionen können aus Einsätzen entstehen oder manuell ergänzt werden.
- Supabase-Schema um Medien, Kundenkommunikation, Abrechnung, Rollen und Sichtbarkeitsfelder erweitert.

## 0.5.0 - 2026-07-31

- Dashboard als Sprungbrett in Stammdaten, Objekte, Kunden, Leistungskatalog, Aufträge, Termine, Kommunikation, Abrechnung und Freigaben erweitert.
- Stammdatenübersicht mit logischen Schnellaktionen ergänzt.
- Kundenübersicht mit Kontakt, Sprache, Objektbezug, Portalaktion und Saldo aufgebaut.
- Dienstleistungskatalog mit Kategorien, Intervallen, Preisen, Einheiten und SLA ergänzt.
- Kommunikationsübersicht und Abrechnungsmodul mit klickbaren Vorgängen ergänzt.
- Farbsystem harmonisch überarbeitet und Darkmode beibehalten.
- Playwright-E2E-Test um neue Modulnavigation und zentrale Aktionen erweitert.

## 0.4.0 - 2026-07-30

- Hauptnavigation in fachliche Bereiche umgebaut.
- Auftragsübersicht, Objektübersicht, Einsatzplan und Freigabeübersicht ergänzt.
- `Aufträge` öffnet jetzt eine Übersicht statt direkt den Neuanlage-Dialog.
- Neue Objektanlage mit eigenem Formular ergänzt.
- Objektakte zeigt jetzt echte Objektdaten.
- Aufträge können in die mobile Einsatzansicht gestartet und zur Freigabe markiert werden.
- Freigaben können in der Freigabeübersicht abgeschlossen werden.
- Playwright-E2E-Test für zentrale Button- und Navigationspfade ergänzt.

## 0.3.0 - 2026-07-30

- Versionsanzeige in Sidebar und Topbar ergänzt.
- Versionsdialog mit aktuellem Änderungsverlauf eingebaut.
- Zentrale Versionsdaten unter `lib/appVersion.ts` angelegt.
- `package.json` und `package-lock.json` auf Version `0.3.0` gesetzt.

## 0.2.0 - 2026-07-30

- Harmonisches neues Farbsystem eingebaut.
- Darkmode mit gespeicherter Browser-Auswahl ergänzt.
- Objekt-Auswahl und Leistungsfilter verbessert.
- UI-Zustände für aktive Karten und Listen poliert.

## 0.1.0 - 2026-07-30

- Erste Ferienhausverwaltungs-App für Kolaretorp Service AB erstellt.
- Mehrsprachige Verwaltung, Kundenportal-Ansicht und mobile Einsatzansicht aufgebaut.
- Supabase-Datenquelle mit Demo-Fallback angebunden.
- Wichtige Dashboard-Buttons und lokale Auftragsanlage klickbar gemacht.
