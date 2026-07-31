# Changelog

Alle nennenswerten Änderungen an der Kolaretorp Service App werden hier
protokolliert. Die App zeigt die aktuelle Version zusätzlich direkt in der
Oberfläche an.

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
