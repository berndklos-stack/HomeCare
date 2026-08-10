# Changelog

Alle nennenswerten Änderungen an der Kolaretorp Service App werden hier
protokolliert. Die App zeigt die aktuelle Version zusätzlich direkt in der
Oberfläche an.

## 1.40.0 - 2026-08-10

- Objektbearbeitung zeigt keinen doppelten Kopf mit Objektstammdaten und Objekt bearbeiten mehr.
- Objektbild ist kompakter in den oberen Bearbeitungskopf integriert.
- Tests wurden auf den neuen aufgeräumten Objektkopf angepasst.

## 1.39.0 - 2026-08-10

- Dokumente in der Objektakte öffnen beim Anklicken eine Vorschau mit Druckfunktion.
- Objektfotos öffnen beim Anklicken einen großen Fotoviewer mit Druckfunktion.
- PDF-, Bild- und Textdateien werden im Viewer direkt dargestellt, große Office-Dateien als Metadatenvorschau.

## 1.38.0 - 2026-08-10

- Objekthistorie ist jetzt eingeklappt und zeigt Berichte kompakt zweizeilig an.
- Berichtsdetails klappen erst nach Klick auf den Historieneintrag auf.
- Aktiver Einsatz wird lokal gespeichert und nach Reload oder Versionswechsel wiederhergestellt.
- Vor-Ort-Fotos werden vor dem Speichern verkleinert, damit Status und Bilder stabil erhalten bleiben.

## 1.37.0 - 2026-08-10

- Der Abschnitt Dokumente in der Objektakte wurde aus dem Kundenbericht entfernt.
- PDF-Druck erhält eine Seitenfußzeile mit Seite x von y Seiten.
- Drucklayout blendet die restliche App-Struktur aus, damit nach den Kontrollpunkten keine leeren Seiten entstehen.
- Der Senden-Button protokolliert den Versand jetzt mit sichtbarer Rückmeldung.

## 1.36.0 - 2026-08-10

- Aufträge, Status, Berichte und Einsatzfotos werden jetzt lokal gespeichert und nach Reload wiederhergestellt.
- Kunden, Leistungen, Pakete und Mobil-vor-Ort-Fortschritt bleiben ebenfalls erhalten.
- Test prüft jetzt, dass ein abgeschlossener Einsatzbericht inklusive Foto und Kommentar nach Seitenreload bestehen bleibt.

## 1.35.0 - 2026-08-10

- Arbeitszeit im Einsatzbericht zählt nur noch ausgeführte Checklistenpunkte.
- Nicht ausgeführte Punkte bleiben im Bericht sichtbar, werden aber mit 0 Minuten ausgewiesen.
- Minutenfelder nicht ausgeführter Punkte sind in Mobil vor Ort deaktiviert.

## 1.34.0 - 2026-08-10

- Der Abschnitt Bilder zum Objekt / Einsatz wurde aus dem Bericht entfernt.
- Das Objektbild erscheint nur noch oben im Berichtskopf.
- Kontrollpunktfotos werden sofort und direkt am jeweiligen Einsatzpunkt angezeigt.

## 1.33.0 - 2026-08-10

- Fotos aus Kontrollpunkten werden jetzt direkt beim jeweiligen Punkt im Bericht angezeigt.
- Berichtskopf zeigt das Objektbild oben mit klarer Objekt- und Auftragskennung.
- Berichtsinformationen wurden in kompakte professionelle Karten für Objekt, Kunde, Auftrag und Leistung aufgeteilt.

## 1.32.0 - 2026-08-10

- PDF-Bericht verwendet echte Bild-Elemente, damit Fotos im Chrome-PDF zuverlässig erscheinen.
- PDF-Bericht wurde kompakter gestaltet mit dichterer Kopfzeile, kleineren Einzelpunkten und reduzierten Abständen.
- Bildergalerien im Bericht nutzen im Druck bis zu drei Spalten.

## 1.31.0 - 2026-08-10

- Mobil-vor-Ort-Eingaben werden jetzt pro Auftrag gespeichert, auch beim Wechsel zwischen Menüpunkten.
- Abhakungen, Zeiten, Hinweise und Fotos werden vollständig in den Einsatzbericht übernommen.
- Fotos aus Checklistenpunkten werden im Kundenbericht mit Dateiname und Vorschau angezeigt.

## 1.30.0 - 2026-08-10

- Einsatzabschluss erzeugt jetzt einen strukturierten Bericht aus allen Checklistenpunkten.
- Bericht zeigt pro Punkt Status, Zeit, Hinweis und erfasste Bilder, auch wenn ein Punkt nicht ausgeführt wurde.
- Zu jedem Bericht kann vor dem Senden ein Kundenkommentar gepflegt werden.

## 1.29.0 - 2026-08-10

- Mobil-vor-Ort-Ansicht verwendet jetzt die normalen App-Farben statt einer separaten dunklen Geräteoptik.
- Checklisten, Eingabefelder, Foto-Buttons und Foto-Bestätigung passen sich nun sauber an Hell- und Dunkelmodus an.

## 1.28.0 - 2026-08-10

- PDF-Ausgabe nutzt jetzt einen professionell gestalteten Kundenbericht statt der normalen App-Ansicht.
- Einsatzbericht enthält Berichtsnummer, Kunde, Objekt, Auftrag, Termin, Priorität, Abrechnung, Checkliste, Medien und Bilder.
- Drucklayout blendet Navigation und Bearbeitungsflächen aus und fokussiert auf den PDF-Bericht.

## 1.27.0 - 2026-08-10

- Kundendaten enthalten jetzt einen individuell anpassbaren Mailtext für Einsatzberichte.
- Der Berichtversand ersetzt den Platzhalter `{Vorname}` automatisch durch den Ansprechpartner des Kunden.
- Objektberichte verwenden Empfänger und Mailtext aus den zugeordneten Kundenstammdaten.

## 1.26.0 - 2026-08-10

- Kundenbericht zeigt eine professionellere Einsatzbericht-Karte mit Objekt, Auftrag, Zeiten, Material, Checkliste und Medien.
- Berichtversand protokolliert Zeitstempel, Betreff, Empfänger, Kopie und PDF-Anhang.
- E-Mail-Betreff folgt dem Format Einsatzbericht - Kolaretorp Service AB - Objektbezeichnung.
- Beim Berichtversand wird info@kolaretorp.se als Kopie ausgewiesen.
- E-Mail-Body enthält eine persönliche Anrede mit Berichtshinweis und Rückfragen-Satz.

## 1.25.0 - 2026-08-10

- Fotos zum Objekt enthalten den Button Neues Foto hinzufügen direkt im Abschnitt.
- Dokumente zum Objekt haben einen eigenen Abschnitt mit Büroklammer-Upload.
- Separate Upload-Kacheln oberhalb der Foto- und Dokumentbereiche wurden entfernt.

## 1.24.0 - 2026-08-09

- Objektbild wird in der Objektbearbeitung rechts oben ohne Dateinamen angezeigt.
- Fotos zum Objekt werden als eigene Galerie dargestellt.
- Dokumente und Grundrisse bleiben getrennt in der Medienakte.

## 1.23.0 - 2026-08-09

- Objektbilder werden vor dem lokalen Speichern automatisch verkleinert.
- Lokales Speichern fängt Speicherlimit-Fehler ab, damit die App nicht mehr abstürzt.
- Test prüft jetzt auch das Speichern eines Objektbildes an einem zweiten Objekt.

## 1.22.0 - 2026-08-09

- Objekte werden beim Bearbeiten jetzt als eigene Seite statt als Popup geöffnet.
- Zurück-Pfeil führt aus der Objektbearbeitung zurück in die Objektübersicht.
- Historie und Verlauf sind direkt in der Objektbearbeitung eingebettet.
- Objektbilder werden in Übersicht und Bearbeitungsmodus angezeigt.
- Hochgeladene Objektbilder bleiben nach dem Aktualisieren lokal erhalten.
- Bilder können als Objektbild gesetzt und Medien in der Akte verschoben werden.
- Intervall- und Jahresrhythmusfelder im Serienauftrag wurden weiter verkleinert.

## 1.21.0 - 2026-08-09

- Intervall- und Jahresrhythmusfelder im Serienauftrag sind jetzt kompakt.
- Zahlenfelder im Serienblock werden nicht mehr auf volle Spaltenbreite gestreckt.

## 1.20.0 - 2026-08-09

- Serienaufträge können jetzt auf einen saisonalen Zeitraum begrenzt werden.
- Gültigkeit wie Mai bis September wird in der Auftragsübersicht mit angezeigt.
- Jahresrhythmus unterstützt jedes Jahr oder alle x Jahre.
- Intervallfeld im Serienblock wurde schmaler gestaltet.

## 1.19.0 - 2026-08-09

- Auftragsanlage zeigt Einmalauftrag oder Serienauftrag jetzt klar als Kalenderblock.
- Serienauftrag erhält eine sofort sichtbare Zusammenfassung aus Rhythmus, Intervall, Wochentagen und Ende.
- Intervallfeld wurde für die wiederkehrende Planung eindeutiger beschriftet.

## 1.18.0 - 2026-08-09

- Objektakte zeigt jetzt eine Historie aus Aufträgen und Berichten.
- Verlaufseinträge öffnen alle relevanten Details inklusive Auftragsdaten, Bericht, internen Notizen und Medien.
- Berichte können aus der Objektakte per PDF-Ausgabe vorbereitet und als an Kunden gesendet markiert werden.
- Auftragsübersicht wurde auf kompakte zweizeilige Zeilen mit Aktionsicons verdichtet.

## 1.17.0 - 2026-08-09

- Bild erfassen ist jetzt pro Checklistenpunkt als Kamera-Icon verfügbar.
- Aufgenommene Fotos werden direkt am jeweiligen Checklistenpunkt bestätigt oder neu erfasst.
- Allgemeiner Foto-Button am Ende der mobilen Einsatzkarte wurde entfernt.

## 1.16.0 - 2026-08-09

- Preis und Währung im Leistungsformular stehen jetzt kompakt in einer Zeile.
- Währungsfeld wurde auf eine schmale Auswahl neben dem Preis reduziert.

## 1.15.0 - 2026-08-09

- Standardzeit-Feld im Leistungs-Checklisten-Editor kompakter gestaltet.
- Checklistenformular verhindert horizontales Überlaufen der Eingabefelder.

## 1.14.0 - 2026-08-09

- Aufträge können als einmaliger Auftrag oder Serienauftrag angelegt werden.
- Serienaufträge erhalten Kalender-ähnliche Wiederholung mit Frequenz, Intervall, Wochentagen und Ende.
- Mobile Auftragsbearbeitung unterstützt Bild erfassen, Foto benutzen und neues Foto.
- Zeitfeld in der mobilen Checkliste ist kompakter und überlappt den Hinweisbereich nicht mehr.

## 1.13.0 - 2026-08-09

- Leistungen enthalten jetzt detaillierte Checklistenpunkte mit Hinweis und Standardzeit.
- Leistungspreise haben ein separates Währungsfeld.
- Mobile Auftragsbearbeitung zeigt beim Start die Checklistenpunkte aus dem Objektpaket.
- Einsatzkräfte können pro Punkt abhaken, Zeit erfassen und Hinweise notieren.
- Gestartete Aufträge öffnen zuverlässig den ausgewählten Auftrag statt den ersten laufenden Einsatz.

## 1.12.0 - 2026-08-09

- Aktionsbuttons werden in Listen und Stammdaten konsistent als Iconbuttons dargestellt.
- Iconbuttons zeigen beim Hover und Tastaturfokus einen Tooltip mit der jeweiligen Funktion.
- Auftragsaktionen nutzen jetzt ebenfalls Iconbuttons für Bearbeiten und Starten.
- Entfernen-Aktionen in Objekt- und Kundenformularen nutzen die gleiche Buttonlogik.

## 1.11.0 - 2026-08-09

- Neue Leistungen starten ohne vorbelegte Kategorie und Einheit.
- Leistung, Kategorie und Einheit sind Pflichtfelder ohne automatische Fallback-Werte.
- Einheit ist jetzt ebenfalls ein lernendes Dropdownfeld aus vorhandenen Einheiten.
- Kategorie- und Einheitsvorschläge öffnen beim Fokus, wenn der Browser dies unterstützt.

## 1.10.0 - 2026-08-09

- Archivierte Objekte, Kunden, Leistungen und Pakete können weiterhin bearbeitet werden.
- Archivierte Datensätze lassen sich per Reaktivieren-Button wieder in die aktiven Übersichten zurückholen.
- Speichern archivierter Datensätze erhält den Archivstatus bis zur bewussten Reaktivierung.
- Playwright-Test prüft Bearbeiten und Reaktivieren archivierter Stammdaten.

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
