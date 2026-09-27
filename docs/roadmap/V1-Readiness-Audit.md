# WorkCore V1 Readiness Audit

Stand: 26. September 2026
Codebasis: `origin/main` (`e40dd62`) zuzüglich der lokalen, noch nicht committeten Sync-Foundation-Änderungen.

## Zweck und Bewertungsmaßstab

Dieser Audit bewertet den tatsächlich vorhandenen Code gegen die WorkCore Product Foundation v2. Besonders maßgeblich sind `Non-Negotiables.md`, `Product-Requirements.md`, `Quality-and-Release-Principles.md` und `Security-and-Compliance-Principles.md`.

Die Einstufung bedeutet:

- `READY`: Der Bereich erfüllt den für V1 erkennbaren Kernumfang einschließlich serverseitiger Regeln, Berechtigungen, Fehlerzuständen und kritischer Tests.
- `PARTIAL`: Nutzbare Teile sind vorhanden, für V1 fehlen aber wesentliche Funktionen oder Qualitätsnachweise.
- `MISSING`: Es gibt keine belastbare fachliche Implementierung; einzelne Felder oder Platzhalter zählen nicht.
- `BLOCKED`: Eine relevante Implementierung existiert, darf aber wegen eines kritischen Sicherheits-, Datenintegritäts-, Migrations- oder Betriebsrisikos nicht als V1-fähig freigegeben werden.

Ein globaler Launch kann auch dann blockiert sein, wenn ein einzelner Bereich nur `PARTIAL` ist. Sichtbare UI allein ist kein Readiness-Nachweis.

## Ergebnisübersicht

| Status | Anzahl |
| --- | ---: |
| `READY` | 0 |
| `PARTIAL` | 17 |
| `MISSING` | 6 |
| `BLOCKED` | 12 |
| **Gesamt** | **35** |

## Bereichsaudit

### 1. Customers / contacts — `BLOCKED`

- **Ort:** `app/page.tsx` (`CustomerRecord`, `CustomersView`, `CustomerForm`), `app/api/sync-sections/route.ts`, `homecare_customers`.
- **Funktioniert:** Kunden-CRUD, Archivierung, Kontakt- und Rechnungsadressen, Sprache, Mailvorlagen, Zuordnung zu Objekten und Portalstatus.
- **Fehlt für V1:** getrennte Ansprechpartner, Dublettenprüfung, belastbare Historie, serverseitige Validierung und berechtigte Benutzeraktionen.
- **Daten/Sync:** komplette Kundenliste wird per Legacy-Section-Sync geschrieben; keine Revisionen oder konfliktfähigen Einzelmutationen. Portalpasswörter liegen im Kundenrecord.
- **Security:** API nutzt Service Role ohne Benutzer-/Tenant-Prüfung; personenbezogene Daten und Klartext-Portalpasswörter sind dadurch nicht freigabefähig.
- **Mobile/Offline, Tests, Legacy:** lokale Speicherung funktioniert grundsätzlich, aber ohne konfliktfeste Queue; keine Kunden-Sync-, Berechtigungs- oder Mobile-Tests; Legacy aktiv.

### 2. Jobs / orders — `BLOCKED`

- **Ort:** `JobRecord`, `JobsView`, `PlanningView`, `FieldView` in `app/page.tsx`; `homecare_jobs`; Section-Sync.
- **Funktioniert:** Anlegen/Bearbeiten, Status, Priorität, Termine, Zuweisung, Leistungen, Material, Angebot/Auftragsbestätigung, Feldausführung und Abrechnungsübergang.
- **Fehlt für V1:** serverseitige Statusmaschine, atomare Übergänge, Rollenfreigaben, Datensatzrevisionen und belastbare Audit-Historie.
- **Daten/Sync:** Jobs und verschachtelte Listen werden abschnittsweise gespeichert; parallele Geräte können neuere Änderungen überschreiben oder semantisch falsch zusammenführen.
- **Security:** keine serverseitige Zugriffsprüfung; interne Notizen, Preise und Kundendaten sind über ungeschützte Routen erreichbar.
- **Mobile/Offline, Tests, Legacy:** Feldansicht ist mobil gedacht, aber Offline-Mutationen sind nicht dauerhaft datensatzweise; nur schmale UI-/Onboarding-Tests; Legacy aktiv.

### 3. Projects / objects / construction sites — `BLOCKED`

- **Ort:** `ObjectRecord`, `ObjectEditorPage`, `ObjectsView`, `lib/objectTypes.ts`, `homecare_objects` und `homecare_media`.
- **Funktioniert:** konfigurierbare Objekttypen, Stammdaten, Adressen, Risiken, Ausstattung, Archivierung und Medien.
- **Fehlt für V1:** revisionssichere Einzelmutationen, serverseitige Typ-/Pflichtfeldvalidierung, belastbare Lösch-/Wiederherstellungsregeln und eigene Projektbeziehungen.
- **Daten/Sync:** kompletter Objektabschnitt plus relationaler Spiegel; polymorphe Medienzuordnung ohne Fremdschlüssel; Merge-Heuristiken ersetzen Konfliktstrategie.
- **Security:** Zugangsdaten wie Schlüsselsafe/Alarm liegen hinter APIs ohne Authentisierung oder Tenant-Autorisierung.
- **Mobile/Offline, Tests, Legacy:** responsive Ansätze und lokale Speicherung vorhanden; keine Offline-/Konflikt-/Medienintegrationstests; Legacy aktiv.

### 4. Recurring jobs — `PARTIAL`

- **Ort:** `JobSchedule`, `ensureSeriesOccurrences`, Serienansichten in `JobsView`, Tagesmail-Cron.
- **Funktioniert:** tägliche/wöchentliche/monatliche/jährliche Serien, Saison, Ausschlüsse und abgeleitete Teilaufträge.
- **Fehlt für V1:** serverseitige, idempotente Generierung, Zeitzonen-/DST-Regeln, Änderungsregeln für Serie versus Folge und Duplikatschutz in der DB.
- **Daten/Sync:** Generierung und Serienbeziehungen sind clientseitig und im Legacy-Jobabschnitt gespeichert; `series_master_id` besitzt keinen FK/Unique-Schutz.
- **Security:** keine serverseitige Rollenprüfung für Serienänderungen oder Cron-Auslösung.
- **Mobile/Offline, Tests, Legacy:** UI nutzbar; Tagesmail testet Teilmengen, aber keine Parallel-/Offline-/DST-Fälle; Legacy aktiv.

### 5. Calendar / scheduling — `PARTIAL`

- **Ort:** `PlanningView`, Job-Termin-/Ausführungsfelder, `app/api/cron/daily-jobs/route.ts`.
- **Funktioniert:** Einsatzplanung nach Datum, Personal und Ressourcen; Überfälligkeit; read-only ICS/VTODO-Inhalte in der Tagesmail.
- **Fehlt für V1:** echte Kalenderansicht, Konfliktprüfung, Kapazität, Drag-and-drop-Persistenz, Zeitzonenmodell und serverseitige Terminregeln.
- **Daten/Sync:** Planung ist Teil des Job-Gesamtdatensatzes und damit konfliktanfällig.
- **Security:** keine rollenbasierte Disposition oder geschützte Kalenderquellen.
- **Mobile/Offline, Tests, Legacy:** responsive Planung ist nur begrenzt nachgewiesen; ein Tagesmail-Zeittest, keine Mobile-/Offline-Planungstests; Legacy aktiv.

### 6. Time tracking — `PARTIAL`

- **Ort:** `ConsultingTimeEntry`, `JobConsulting`, `FieldTaskProgress`, Job-/Feldansichten.
- **Funktioniert:** Consulting-Zeiteinträge sowie Minuten pro Checklistenpunkt; Übergabe ausgewählter Consulting-Zeiten in Abrechnung.
- **Fehlt für V1:** allgemeine Start/Stop-Zeiterfassung, Mitarbeiter-Timesheets, Pausen, Korrekturfreigaben, Abwesenheit und serverseitige Zeitvalidierung.
- **Daten/Sync:** Zeiten liegen teils verschachtelt im Job, teils im Field-Progress-Abschnitt; keine Revisionen oder atomare Abrechnungsmarkierung.
- **Security:** keine Mitarbeiter-/Manager-Berechtigungen oder serverseitige Freigaben.
- **Mobile/Offline, Tests, Legacy:** Felderfassung mobil angelegt; keine Offline-/Doppelabrechnungs-/Freigabetests; Legacy aktiv.

### 7. Service reports — `BLOCKED`

- **Ort:** `ReportRecord`, `ReportsView`, `FieldView`, PDF-/Mailfunktionen, `homecare_reports`, `/api/reports/send`.
- **Funktioniert:** Bericht aus Feldfortschritt, Checklisten, Fotos, interne/Kundentexte, PDF, E-Mail und Kundenfreigabe.
- **Fehlt für V1:** revisionsfeste Bearbeitung, rechtssichere Freigabe/Sperre, persistente Versand-Idempotenz und Audit-Trail.
- **Daten/Sync:** Reports werden per Merge-Heuristik als kompletter Abschnitt synchronisiert; Anhänge liegen als JSON und können zwischen Cache, Storage und Spiegel divergieren.
- **Security:** Versandroute ist unauthentisiert; Entsperrroute hat ein hartes Fallback-Passwort; Kundensichtbarkeit wird nicht durch serverseitige Policies abgesichert.
- **Mobile/Offline, Tests, Legacy:** Feld-UX vorhanden, Upload-Queue nur teilweise; keine End-to-End-Bericht-/Mail-/Berechtigungstests; Legacy aktiv.

### 8. Offers — `PARTIAL`

- **Ort:** Angebotsfelder im `JobRecord`, PDF-/Mailfunktionen und Aktionen in `JobsView`.
- **Funktioniert:** Angebotsstatus, Nummer, Positionen, Rabatte, PDF, Mailvorschau und Umwandlung zum Auftrag.
- **Fehlt für V1:** eigene versionierte Angebotsentität, Gültigkeit, Annahme/Ablehnung, revisionssichere Nummern, Freigaben und unveränderbarer Versandstand.
- **Daten/Sync:** Angebot ist Teil des Legacy-Jobrecords; Nummern und Zustandswechsel erfolgen clientseitig.
- **Security:** keine Berechtigungen; Mailroute kann ohne Sitzung angesprochen werden.
- **Mobile/Offline, Tests, Legacy:** PDF/Workflow nicht auf Mobile/Offline getestet; keine fachlichen Angebotstests; Legacy aktiv.

### 9. Invoices — `BLOCKED`

- **Ort:** `BillingRecord`, `BillingView`, PDF-/Nummern-/Ausgangsbuchlogik, `homecare_billing_items`.
- **Funktioniert:** Entwurf, Buchen, PDF, Senden-Markierung, Zahlung, Storno, Ausgangsbuch, Kontierung, Währung und Steuerzeilen.
- **Fehlt für V1:** transaktionale serverseitige Rechnungsnummern, Unveränderbarkeit gebuchter Belege, Gutschriften, Steuer-/Rundungsvalidierung, Audit und rechtliche Länderprüfung.
- **Daten/Sync:** komplette Rechnungsliste wird per Section-Sync geschrieben; Finanzstatus und Jobstatus werden nicht atomar geändert; keine Revision.
- **Security:** keine Finanzrolle oder Freigabe; unauthentisierte Service-Role-API ermöglicht kritische Änderungen.
- **Mobile/Offline, Tests, Legacy:** UI ist responsive gestylt, aber finanzielles Offline-Verhalten ist nicht definiert; keine Rechnungs-/Parallel-/Rundungstests; Legacy aktiv.

### 10. Payment status / dunning — `PARTIAL`

- **Ort:** Rechnungsstatus, `paidAt`, Fälligkeitsberechnung und Filter in `BillingView`.
- **Funktioniert:** manuelles Markieren als bezahlt, Fälligkeit und rechnerische Anzeige „überfällig“.
- **Fehlt für V1:** Teilzahlungen, Zahlungsabgleich, Mahnstufen, Mahndokumente/-versand, Gebühren/Zinsen und Historie.
- **Daten/Sync:** Statusänderungen sind clientseitig, abschnittsweise und nicht transaktional.
- **Security:** keine Freigabe-/Finanzberechtigung.
- **Mobile/Offline, Tests, Legacy:** kein definierter Offline-Finanzworkflow und keine Tests; Legacy aktiv.

### 11. Accounting export / integrations — `PARTIAL`

- **Ort:** Kontenplan in Stammdaten, `createSpirisSieFile`, Exportstatus in `BillingRecord`.
- **Funktioniert:** SIE4-Datei pro Rechnung, Kontierung für Leistung/Material/Rabatt, Visma-/Spiris-Markierung und Rücksetzen.
- **Fehlt für V1:** echte Adapterintegration, serverseitige Export-ID/Journal, persistente Idempotenz, Fehlerreconciliation, Sammel-/Deltaexport und geprüfte SIE-Konformität.
- **Daten/Sync:** Exportstatus liegt in der Legacy-Rechnungsliste; Download und „gesendet“ können auseinanderfallen.
- **Security:** keine Buchhaltungsrolle, keine Freigabe und keine Integration-Credential-Verwaltung.
- **Mobile/Offline, Tests, Legacy:** Desktop-orientiert; keine Exportparser-/Doppelübergabe-/Fehlertests; Legacy aktiv.

### 12. Customer portal — `BLOCKED`

- **Ort:** `CustomerPortalView`, `/portal`, Kundenfelder und `/api/portal/notify`.
- **Funktioniert:** clientseitiger Login, kundenzugeordnete Objekte/Aufträge/Berichte/Rechnungsinfos sowie Nachrichten.
- **Fehlt für V1:** echte Authentisierung, Passwort-Hashing/Reset, sichere Sessions, serverseitige Objektfilter, Rate Limits und Einladungsworkflow.
- **Daten/Sync:** Portal lädt denselben App-Snapshot; Nachrichten und Login-Historie sind Legacy-Abschnitte.
- **Security:** Klartextpasswortvergleich im Browser und fehlende serverseitige Autorisierung sind ein unmittelbarer Launch-Blocker.
- **Mobile/Offline, Tests, Legacy:** Portal ist responsive angelegt; nur ein Branding-Sichtbarkeitstest, keine Auth-/Isolationstests; Legacy aktiv.

### 13. Inventory / materials — `BLOCKED`

- **Ort:** `MaterialItem`, `MaterialInventoryEntry`, `InventoryView`, Tabellen für Materialien, Orte und Bewegungen.
- **Funktioniert:** Materialstamm, Lagerorte, Ein-/Ausgang/Korrektur/Inventur, FIFO-Wert, Reservierungen und Beleganhang.
- **Fehlt für V1:** transaktionales Bestandsledger, serverseitiger Negativbestands-/Reservierungsschutz, Revisionen, belastbare Bewertung und Inventurabschluss.
- **Daten/Sync:** UI pflegt Bewegungen verschachtelt im Materialrecord, obwohl eine relationale Bewegungstabelle existiert; Ganzabschnitt-Sync kann Bewegungen verlieren oder doppeln.
- **Security:** keine Lager-/Einkaufsberechtigungen oder serverseitige Validierung.
- **Mobile/Offline, Tests, Legacy:** mobile Buchung nicht nachgewiesen; keine Bestands-, Parallel- oder Offline-Tests; Legacy aktiv.

### 14. Suppliers / purchasing — `MISSING`

- **Ort:** nur freie `supplier`-Strings und Einkaufspreisfelder in Material-/Lagerbuchungen.
- **Funktioniert:** Lieferantenname und Einkaufswerte können als Text erfasst werden.
- **Fehlt für V1:** Lieferantenstamm, Bestellungen, Wareneingang, Status, Dokumente, Konditionen und Beziehungen.
- **Daten/Sync:** keine eigene Entität oder Integritätsregeln.
- **Security:** keine Einkaufsrollen oder Freigaben.
- **Mobile/Offline, Tests, Legacy:** nicht vorhanden; Lieferantenstrings laufen über den Legacy-Materialabschnitt.

### 15. Resources / equipment — `PARTIAL`

- **Ort:** `ResourceRecord`, `MasterDataView`, `homecare_resources`, Ressourcenmedien und Fahrzeugpositionen.
- **Funktioniert:** Fahrzeuge/Maschinen/Geräte, Verantwortung, Standort, Status, Medien und Zuordnung zu Aufträgen.
- **Fehlt für V1:** Einzelmutationen, Revision für den gesamten Ressourcenworkflow, Verfügbarkeits-/Buchungskonflikte und serverseitige Regeln.
- **Daten/Sync:** Ressourcenstamm bleibt ausdrücklich Legacy-Section-Sync; Fahrten sind als Übergang herausgelöst, Medien nur teilweise.
- **Security:** keine rollen- oder tenantbasierte API-Autorisierung.
- **Mobile/Offline, Tests, Legacy:** Fahrzeugdialog mobil geprüft, sonst keine Geräte-/Konflikttests; Legacy aktiv.

### 16. Maintenance / inspections — `PARTIAL`

- **Ort:** `ResourceMaintenanceItem` als JSON im Ressourcenrecord und Ressourcenformular.
- **Funktioniert:** Wartungspunkte mit Ziel, Einheit, Notiz und offen/erledigt.
- **Fehlt für V1:** Fälligkeit, Intervall, Verantwortliche, Nachweise, Inspektionshistorie, Erinnerungen und Freigabe.
- **Daten/Sync:** eingebettete Liste ohne eigene IDs/Revisionen auf Serverebene; Änderungen kollidieren im Ressourcenabschnitt.
- **Security:** keine Rollen oder Auditierung.
- **Mobile/Offline, Tests, Legacy:** einfache UI, keine Wartungs-/Mobile-/Offline-Tests; Legacy aktiv.

### 17. Drive log — `BLOCKED`

- **Ort:** Fahrtenbuch in `app/page.tsx`, `/api/sync-mutations`, `lib/syncQueue.ts`, lokale Sync-Migration.
- **Funktioniert:** Start/Ende, Adressen/GPS, Kilometer, Fotos, Standardfahrten, Länderregeln, Offline-Mutationsqueue und Konfliktstatus im lokalen Code.
- **Fehlt für V1:** reale DB-Verifikation/Anwendung der neuen Migration, vollständige Konfliktauflösung, tenant-/usergebundene Mutationen und belastbare Korrekturfreigaben.
- **Daten/Sync:** neue datensatzweise Architektur ist noch uncommitted und unverified; Fahrzeugstamm/Positionen/Medien besitzen weiterhin Übergangswege.
- **Security:** Mutation-API nutzt Service Role ohne Benutzerauthentisierung; Mutation-Journal verwendet einen festen Tenant.
- **Mobile/Offline, Tests, Legacy:** stärkster Offline-Ansatz der App; 10 Modelltests, aber keine echten PostgreSQL-Integrationstests; teilweise Legacy.

### 18. Tasks / checklists — `PARTIAL`

- **Ort:** Leistungschecklisten, Jobcheckliste, `FieldTaskProgress`, `FieldView`.
- **Funktioniert:** Checklistenpunkte, Erledigung, Notizen, Minuten, Fotos und Übernahme in Berichte.
- **Fehlt für V1:** eigenständige Aufgaben, Fälligkeit, Verantwortliche, wiederkehrende Aufgaben, Abhängigkeiten, Kommentare und Eskalation.
- **Daten/Sync:** Checklisten sind in Service/Job/Progress verteilt; keine einheitliche Revision oder Löschstrategie.
- **Security:** keine aufgabenbezogenen Rechte.
- **Mobile/Offline, Tests, Legacy:** Feldansicht ist mobil ausgerichtet, aber Offline-Konflikte nicht getestet; Legacy aktiv.

### 19. Document management — `PARTIAL`

- **Ort:** `homecare_media`, `/api/media`, `/api/private-media`, Report-/Objekt-/Ressourcenanhänge.
- **Funktioniert:** Upload, Storage-Pfade, Bilder/Dokumente, Berichtsanlagen und erste Tombstones für Fahrzeugmedien.
- **Fehlt für V1:** zentrale Dokumentansicht, Versionierung, Kategorien, Retention, Checksums, resumierbare Uploads und konsistente Löschung aller Eigentümertypen.
- **Daten/Sync:** Datei, JSON-Anhang, relationaler Spiegel und Cache können auseinanderlaufen; polymorphe Eigentümerbeziehung ohne FK.
- **Security:** öffentlicher Medienbucket und unauthentisierte private Download-Proxyroute; keine serverseitige Besitzerprüfung.
- **Mobile/Offline, Tests, Legacy:** Kamera-Workflows vorhanden, Uploadfortsetzung nur teilweise; nur modellbasierter Fahrzeugbild-Löschtest; Legacy/Übergang.

### 20. Communication / email — `BLOCKED`

- **Ort:** `CommunicationView`, Portalnachrichten, `/api/reports/send`, `/api/portal/notify`, Resend.
- **Funktioniert:** interne/portalbezogene Nachrichten, Antworten sowie PDF-/Anhang-Mailversand.
- **Fehlt für V1:** Authentisierung, persistente Outbox, Zustell-/Retry-Job, Vorlagenversionen, Bounce-Verarbeitung und klare intern/extern-Rechte.
- **Daten/Sync:** Nachrichten sind Legacy-Section-Sync; Mail-Idempotenz lebt nur zehn Minuten im Prozessspeicher.
- **Security:** öffentliche Routen können E-Mails mit Server-Credentials auslösen; keine Rate Limits oder Absenderberechtigungen.
- **Mobile/Offline, Tests, Legacy:** Offline-Outbox fehlt; keine Versand-/Missbrauch-/Retry-E2E-Tests; Legacy aktiv.

### 21. CRM / leads — `MISSING`

- **Ort:** Kundenstamm und Notizen sind vorhanden, aber kein Lead-/Opportunity-Modell.
- **Funktioniert:** grundlegende Kundenkontakte.
- **Fehlt für V1:** Leads, Pipeline, Aktivitäten, nächste Schritte, Quelle, Verantwortliche und Umwandlung.
- **Daten/Sync:** keine Entität oder Beziehungen.
- **Security:** keine CRM-spezifischen Rechte.
- **Mobile/Offline, Tests, Legacy:** nicht vorhanden.

### 22. Calendar integrations — `PARTIAL`

- **Ort:** ICS-/VTODO-Parser und URL-Einstellungen in `daily-jobs`.
- **Funktioniert:** externe Kalender und Erinnerungen können read-only für die Tagesmail gelesen werden.
- **Fehlt für V1:** OAuth, Google/Outlook-Anbindung, bidirektionaler Sync, Webhooks, Tokenverwaltung, Mapping und Konfliktstrategie.
- **Daten/Sync:** Quellen sind freie Einstellungswerte; kein Integrationsjournal oder Cursor.
- **Security:** Secrets/URLs und Cronaufruf sind nicht rollenbasiert abgesichert.
- **Mobile/Offline, Tests, Legacy:** keine UI-Integration außer Tagesmail; Parser-Zeittest vorhanden, sonst keine Integrations-/Fehlertests; Settings-Legacy.

### 23. Digital signature — `MISSING`

- **Ort:** keine Signaturentität, Signaturkomponente oder unveränderbarer Signaturnachweis gefunden.
- **Funktioniert:** Berichte und PDFs können erzeugt werden.
- **Fehlt für V1:** Erfassung, Einwilligung, Unterzeichner, Zeit/Ort, Hash, Audit, Sperre und PDF-Einbettung.
- **Daten/Sync:** kein Modell.
- **Security:** keine Identitäts- oder Nachweisprüfung.
- **Mobile/Offline, Tests, Legacy:** nicht vorhanden.

### 24. Knowledge base — `MISSING`

- **Ort:** keine Wissensartikel-, Kategorien- oder Suchentität gefunden.
- **Funktioniert:** freie Notizen an einzelnen Datensätzen.
- **Fehlt für V1:** Wissensbasis, Versionen, Rechte, Verknüpfungen, Suche und Quellen.
- **Daten/Sync:** kein Modell.
- **Security:** keine Wissensrechte.
- **Mobile/Offline, Tests, Legacy:** nicht vorhanden.

### 25. AI assistance — `PARTIAL`

- **Ort:** `/api/odometer` mit OpenAI Responses API; clientseitige Foto-/Kilometerlogik.
- **Funktioniert:** Tachostand-OCR als klar begrenzte Hilfsfunktion mit manueller Kontrolle.
- **Fehlt für V1:** Authentisierung, tenantbezogene Limits, Consent/Datenschutzhinweise, Kostenkontrolle, Audit und weitere produktive Assistenzfunktionen.
- **Daten/Sync:** OCR-Ergebnis wird im Fahrtenworkflow gespeichert; keine eigene Provenienz oder Modellversion am Ergebnis.
- **Security:** öffentliche Route kann API-Kosten verursachen; Bilder werden ohne Benutzer-/Tenantprüfung weitergegeben.
- **Mobile/Offline, Tests, Legacy:** mobil sinnvoll, offline nicht verfügbar; keine API-/Privacy-/Limit-Tests; Fahrtenübergang.

### 26. Automation / workflows — `PARTIAL`

- **Ort:** tägliche Cron-Mail, Serienerzeugung und einige clientseitige Statusfolgen.
- **Funktioniert:** Tagesübersicht, wiederkehrende Aufträge und fest verdrahtete Übergänge.
- **Fehlt für V1:** Workflowmodell, Bedingungen/Aktionen, Freigaben, persistente Jobs, Retry/Dead Letter, Simulation und Verlauf.
- **Daten/Sync:** Automationen sind verteilte Speziallogik ohne Ereignisjournal.
- **Security:** Cron-/Aktionsaufrufe sind nicht durch Rollen und signierte Jobs abgesichert.
- **Mobile/Offline, Tests, Legacy:** kein eigener Mobile-Bereich; Tagesmail teilweise getestet, keine Failure-/Idempotenztests; Legacy-Daten.

### 27. Multi-company — `BLOCKED`

- **Ort:** Tenant-/Profil-/Modultabellen in `20260912102000_prepare_saas_tenants.sql`; `TenantSettings` im Client.
- **Funktioniert:** Schemaentwurf für Tenant, Pläne, Module und Profile; alle Bestandsdaten erhalten einen Default-Tenant.
- **Fehlt für V1:** tatsächliche Authentisierung, Tenant-Kontext, Policies, Firmenwechsel, getrennte Nummern/Steuern/Branding und Cross-Tenant-Tests.
- **Daten/Sync:** APIs lesen/schreiben ohne `tenant_id`-Filter; Sync-Mutation verwendet fest `000...001`.
- **Security:** Tenant-Isolation ist nicht implementiert und verletzt ein Non-Negotiable.
- **Mobile/Offline, Tests, Legacy:** keine Multi-Company-UX oder Tests; sämtliche Legacy-Abschnitte sind singleton-orientiert.

### 28. Dashboards / reporting — `PARTIAL`

- **Ort:** `Dashboard`, `AnalyticsView`, PDF-/Mailfunktionen.
- **Funktioniert:** operative Kennzahlen, offene Arbeit, Berichte nach Zeitraum, Foto-/Zeitdaten und PDF-/Mailausgabe.
- **Fehlt für V1:** zentrale Metrikdefinitionen, Permission-Filter, Datenfrischehinweis, Drill-down-Vollständigkeit und validierte Formeln.
- **Daten/Sync:** Auswertungen laufen clientseitig über lokal zusammengeführte Snapshots und können veraltete/inkonsistente Daten verwenden.
- **Security:** keine rollenbezogene Sichtbarkeit.
- **Mobile/Offline, Tests, Legacy:** responsive Darstellung vorhanden, aber keine Kennzahlen-/Mobile-/Freshness-Tests; Legacy-Datenquellen.

### 29. Custom reports — `MISSING`

- **Ort:** nur fest codierte Analytics-Auswertungen und Serviceberichte.
- **Funktioniert:** vordefinierte PDF-Ausgabe.
- **Fehlt für V1:** Report-Builder, gespeicherte Ansichten, Filter, Feldauswahl, Berechtigungen, Zeitplan und Exportformate.
- **Daten/Sync:** kein Modell.
- **Security:** keine reportbezogenen Rechte.
- **Mobile/Offline, Tests, Legacy:** nicht vorhanden.

### 30. Public API / webhooks — `MISSING`

- **Ort:** interne Next.js-Routen existieren, aber keine öffentliche versionierte API oder Webhook-Infrastruktur.
- **Funktioniert:** interne App-Endpunkte.
- **Fehlt für V1:** Auth-Schema, Scopes, Versionierung, Rate Limits, Webhook-Abos, Signaturen, Retry und Dokumentation.
- **Daten/Sync:** kein externes Änderungs-/Ereignismodell.
- **Security:** vorhandene interne Routen sind gerade nicht als sichere öffentliche API geeignet.
- **Mobile/Offline, Tests, Legacy:** nicht anwendbar; keine Contract-/Security-Tests.

### 31. Industry profiles — `PARTIAL`

- **Ort:** Onboarding-Geschäftstypen, konfigurierbare Objekttypen, Servicepakete und Modulschalter.
- **Funktioniert:** Terminologie und Objektfelder lassen sich teilweise anpassen.
- **Fehlt für V1:** versionierte Branchenprofile mit Defaults für Rollen, Status, Workflows, Felder, Leistungen und Migration.
- **Daten/Sync:** Konfiguration liegt in Company-/Service-Abschnitten ohne Versionierung oder Impact Preview.
- **Security:** keine Adminberechtigung für kritische Profiländerungen.
- **Mobile/Offline, Tests, Legacy:** Onboarding-/Objekttyp-Tests vorhanden; sonst Legacy.

### 32. Branding / white-label — `PARTIAL`

- **Ort:** `lib/branding.ts`, Company Settings, Layout/Portal, Logos und Brandfarben.
- **Funktioniert:** WorkCore/Koll-Auswahl nach Firmenland, Claims, Logo-/Farbwerte und Portalbranding.
- **Fehlt für V1:** sichere tenantbezogene Auslieferung, vollständige White-Label-Regeln, E-Mail-/PDF-Konsistenz und Brand-Asset-Verwaltung.
- **Daten/Sync:** Branding liegt im Legacy-Company-Settings-Abschnitt; einzelne PDFs/Mails enthalten weiterhin feste Kolaretorp-Texte.
- **Security:** keine Adminrolle für Brandingänderungen.
- **Mobile/Offline, Tests, Legacy:** einige Branding-/Portaltests vorhanden; keine vollständige DE/SV/EN-/Viewport-Matrix; Legacy aktiv.

### 33. Roles / permissions — `BLOCKED`

- **Ort:** Rollenfelder in Personal-/User-Profilen und Tenant-Schema; keine wirksame Durchsetzung in App/API.
- **Funktioniert:** Rollen können als Daten erfasst werden; DB-Enum und Profiltabellen existieren.
- **Fehlt für V1:** Login, Session, serverseitige Autorisierung, RLS-Policies, Scope-Matrix, Einladungen/Offboarding und sensible Re-Authentisierung.
- **Daten/Sync:** Client vertraut auf vollständigen Snapshot; Service Role umgeht RLS.
- **Security:** zentraler V1-Blocker; nahezu jeder API-Endpunkt ist ohne nachgewiesene Identität aufrufbar.
- **Mobile/Offline, Tests, Legacy:** keine Auth-/Rollen-/RLS-/Tenant-Isolationstests; Legacy und neue Mutation gleichermaßen betroffen.

### 34. Import / migration — `PARTIAL`

- **Ort:** SQL-Import von `app_state` in relationale Tabellen, Medienmigration und Onboarding.
- **Funktioniert:** einmalige technische Übernahme des bestehenden Snapshots und eingebetteter Medien.
- **Fehlt für V1:** nutzergeführter CSV/Excel-Import, Mapping, Dry Run, Dubletten, Batch/Provenienz, Validierung und Rollback.
- **Daten/Sync:** Importmigrationen mischen Snapshot und relationales Modell; Wiederholung und Datenkonsistenz sind nicht durch Integrationstests nachgewiesen.
- **Security:** Importendpunkte sind nicht admin-/tenantgeschützt.
- **Mobile/Offline, Tests, Legacy:** Onboarding getestet, Migration selbst nicht gegen reale DB; Legacy-Ausgangsmodell bleibt beteiligt.

### 35. Backup / export / restore — `BLOCKED`

- **Ort:** `/api/app-backups`, `/api/report-backups`, Backup-UI in Stammdaten, `app_state`/Storage.
- **Funktioniert:** manuelle/periodische Snapshot-Backups, komprimierte Chunks, Liste und Wiederherstellung des Hauptsnapshots.
- **Fehlt für V1:** vollständiges relationales Backup, unabhängiges Offsite-Backup, verschlüsselter Kundendatenexport, Restore-Probe, Retention und Recovery Runbook.
- **Daten/Sync:** Restore ersetzt nur `app_state`; relationale Tabellen können danach einen anderen Stand besitzen und den Restore wieder überlagern.
- **Security:** Backup-/Restore-Routen sind unauthentisiert und verwenden Service Role; ein externer Aufruf könnte Daten lesen oder ersetzen.
- **Mobile/Offline, Tests, Legacy:** Admin-UI vorhanden; keine Restore-/Berechtigungs-/Disaster-Recovery-Tests; vollständig vom Legacy-Snapshot abhängig.

## Querschnittsbefund

Kein Bereich erfüllt aktuell die strenge Definition von `READY`. Der vorhandene Funktionsumfang ist für interne Erprobung beachtlich, aber die Anwendung ist noch eine Single-Tenant-/Trusted-Client-Lösung mit breiter Service-Role-Nutzung, Legacy-Section-Sync und nur punktuellen Qualitätsnachweisen. Die lokale Sync Foundation verbessert das Fahrtenbuch konzeptionell, ist jedoch noch nicht gegen PostgreSQL verifiziert oder in einer sicheren Umgebung angewendet.

Vor neuen Business-Modulen müssen Authentisierung/Tenant-Isolation, DB-verifizierte Sync Foundation, konfliktfeste Kernentitäten, sichere Medien-/Kommunikationswege und ein belastbarer Backup-/Restore-Prozess gehärtet werden.
