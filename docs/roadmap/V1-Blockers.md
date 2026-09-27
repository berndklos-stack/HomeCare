# WorkCore V1 Blockers

Stand: 26. September 2026
Basis: `origin/main` (`e40dd62`) plus lokale, uncommittete Sync-Foundation-Änderungen.

## Launch-Entscheidung

**Aktuelle Empfehlung: kein V1-Launch und noch kein Commit der Sync Foundation als freigabefähige Lösung.**

Die Änderungen können nach der ausstehenden realen PostgreSQL-Prüfung als Entwicklungsstand committed werden. Eine V1-Freigabe benötigt zusätzlich Authentisierung, Tenant-Isolation, Berechtigungen, sichere Kern-APIs, die Konvergenz des Legacy-Syncs und Release-Gates.

## Top 10 V1-Blocker

1. **Keine durchgängige Authentisierung und serverseitige Autorisierung.** Fach-, Medien-, Mail-, Backup- und Sync-Routen akzeptieren Requests ohne verifizierte Sitzung und verwenden häufig die Service Role.
2. **Keine wirksame Tenant-Isolation.** `tenant_id` ist überwiegend ein fester Default; APIs filtern nicht nach Tenant und es fehlen durchsetzende RLS-Policies.
3. **Kundenportal ist sicherheitskritisch ungeeignet.** Passwörter werden im Klartext gespeichert und im Browser verglichen; Datenfilterung geschieht clientseitig.
4. **Legacy-Section-Sync kann parallele Änderungen verlieren.** Fast alle Kernmodule schreiben ganze Listen/Abschnitte ohne erwartete Revision oder konfliktfähige Einzelmutation.
5. **Sync-Foundation-Migration ist nicht real verifiziert.** RPC, Journal, Revisionen und Unique-Index wurden noch nicht erfolgreich gegen PostgreSQL/Supabase ausgeführt und unter echter Parallelität getestet.
6. **Rechnungen und finanzielle Zustände sind nicht transaktional abgesichert.** Nummern, Buchen, Storno, Zahlung, Export und Jobstatus werden clientseitig beziehungsweise in getrennten Abschnittsschreibvorgängen geändert.
7. **Backup/Restore deckt die führenden relationalen Tabellen nicht konsistent ab.** Ein Restore von `app_state` kann durch abweichende relationale Daten wieder überschrieben werden.
8. **Kommunikationsendpunkte sind missbrauchbar.** E-Mail-/Portalversand ist nicht authentisiert; Idempotenz liegt nur im Prozessspeicher und Rate Limits fehlen.
9. **Medienzugriff und -löschung sind nicht einheitlich abgesichert.** Öffentliche URLs, unauthentisierte private Proxy-Downloads, JSON-Spiegel und Tombstones koexistieren.
10. **Kritische Release-Gates fehlen.** Keine reale DB-Integrationstest-Suite, keine Auth/RLS-/Tenant-Tests, kein verifizierter Restore, keine umfassenden Finanz- oder Mobile-/Offline-Tests.

## Technische Risiken mit Datenverlust- oder Inkonsistenzpotenzial

1. `app_state`, relationale Tabellen und lokale Caches können unterschiedliche Wahrheiten enthalten.
2. Abschnittsweises Last-Writer-Verhalten kann Änderungen anderer Geräte still überschreiben.
3. Verschachtelte JSON-Listen für Zeiten, Checklisten, Wartung, Materialbewegungen und Anhänge haben keine datensatzweisen Revisionen.
4. Tombstones existieren nur punktuell; gelöschte Datensätze anderer Module können durch alte Clients wiederkehren.
5. Finanzielle Mehrfachaktionen sind nicht durch persistente Mutation-IDs oder DB-Transaktionen geschützt.
6. Rechnungs-/Angebots-/Ausgangsbuchnummern werden ohne tenantbezogene Unique-Constraints clientseitig erzeugt.
7. Service-Role-Zugriffe umgehen RLS und machen jeden Fehler in einer Route tenantübergreifend wirksam.
8. Backup-Restore aktualisiert nicht atomar Snapshot, relationale Tabellen und Storage-Dateien.
9. Mail-Idempotenz geht bei Neustart/Skalierung verloren; doppelte externe Zustellung ist möglich.
10. Die Fahrtenmigration beendet doppelte Legacy-Aktivfahrten automatisch; ohne Vorabbericht und Recovery-Nachweis ist dies eine fachliche Datenänderung.

## Module im alten Section-Sync

Folgende Schlüssel werden weiterhin über `/api/sync-sections` und lokale `pendingSyncKeys` als vollständige Abschnitte synchronisiert:

- `accountingAccounts`: Kontenplan und Buchhaltungsvorgaben
- `activeJobId`: aktuell geöffneter Feldeinsatz
- `billing`: Rechnungen, Zahlung und Accounting-Exportstatus
- `companySettings`: Firma, Branding, Objekttypen und Onboarding
- `customers`: Kunden, Kontakte und Portalzugangsdaten
- `dailyMailSettings`: Tagesmail und Kalenderquellen
- `deletedEntityIds`: Legacy-Löschmarker
- `deletedReportIds`: Legacy-Berichtslöschung
- `fieldNotes`: Feldnotizen
- `fieldProgress`: Checklisten, Zeiten und Fotos
- `inventoryLocations`: Lagerorte
- `jobs`: Aufträge, Angebote, Serien und Consulting-Zeiten
- `materials`: Materialstamm und verschachtelte Lagerbewegungen
- `objects`: Objekte/Projekte und Objektmedien
- `packages`: Leistungspakete
- `personnel`: Personalstamm und Rollenbezeichnung
- `portalMessages`: Kundenkommunikation
- `reports`: Serviceberichte und Anlagen
- `resources`: Ressourcenstamm, Wartung, Medien und Fahrzeugmetadaten
- `services`: Leistungen und Checklisten
- `tenantSettings`: Plan-/Modulschalter im Client
- `translationOverrides`: manuelle Übersetzungen

Nur `vehicle_trip` und vorbereitete `vehicle_media`-Mutationen besitzen in den lokalen Änderungen eine datensatzweise Queue/RPC-Architektur. Ressourcenstamm, Positionen und Teile der Medienlogik bleiben Übergangscode.

## Fehlende Datenbankregeln und Servervalidierung

- Tenantgebundene RLS-Policies für alle Fach- und Storage-Daten.
- Composite-FKs oder serverseitige Prüfung, dass referenzierte Datensätze demselben Tenant gehören.
- Revision und Tombstone für Kunden, Objekte, Jobs, Reports, Billing, Material, Lagerbewegungen, Kommunikation und Einstellungen.
- Check-Constraints/Enums für Status, Sprache, Währung, Steuersatz, Mengen und nichtnegative Beträge.
- Eindeutige tenantbezogene Kunden-, Personal-, Angebots-, Rechnungs- und Ausgangsbuchnummern.
- Serverseitige Rechnungsbuchung/Storno/Zahlung/Export als atomare Zustandsmaschine.
- FK für Serienmaster, `assigned_to`, Field Progress zu Job/Task sowie robuste Medien-Eigentümerbeziehungen.
- Transaktionales Lagerledger mit Duplikat-, Reservierungs- und Negativbestandsschutz.
- Gehashte Portal-Credentials beziehungsweise Supabase-Auth statt `portal_password`.
- Persistente Outbox/Idempotenz für E-Mail und externe Integrationen.
- Serverseitige Auditierung für kritische Fach- und Konfigurationsänderungen.
- Tenant-/Benutzerkontext im Mutation-Journal statt festem Default-Tenant.

## Fehlende kritische Tests

- Migration aller SQL-Dateien gegen frisches PostgreSQL sowie Upgrade mit realistischen Bestandsdaten.
- Echte konkurrierende Transaktionen für aktive Fahrt, Revision und Mutation-Journal.
- Authentisierung, Rollenmatrix, RLS und Cross-Tenant-Angriffsversuche für jede Route/Tabelle.
- Konflikt- und Offline-Wiederanlauf für Kunden, Objekte, Jobs, Reports, Billing, Material und Kommunikation.
- Rechnungsnummern, Steuer/Rundung, Buchen, Storno, Zahlung und doppelter Accounting-Export.
- Portal-Login, Passwort-Reset, Sessionablauf, Rate Limit und Datenisolation.
- Medienberechtigung, Uploadabbruch, Tombstone, Cache und physische Retention.
- Persistente Mail-Idempotenz, Providerfehler, Retry und Bounce-Verarbeitung.
- Backup-Erstellung, vollständiger Restore, relationaler Abgleich und unabhängige Restore-Probe.
- Wiederkehrende Aufträge über Zeitzonen/DST, Serienänderungen und konkurrierende Generatorläufe.
- Mobile Viewports für alle Kernworkflows und Browserneustart während Offline-Arbeit.
- Vollständige DE/SV/EN-Tests für UI, PDF, E-Mail, API-Fehler und dynamische Statuswerte.

## Fehlende Fehler- und Konfliktbehandlung

- Der neue `SyncStatus` zeigt Fehler/Konflikt, bietet aber keine fachliche Auflösung „Serverversion übernehmen“, „lokale Änderung verwerfen“ oder „gezielt zusammenführen“.
- Legacy-Abschnitte kennen nur pending/syncing/synced/failed, nicht den betroffenen Datensatz oder eine Revision.
- Manche Fehler landen nur in `console.warn`; eine dauerhafte Fehlerliste und Admin-Health-Sicht fehlen.
- Externe Aktionen wie Mail und SIE-Export besitzen keine persistente Outbox/Reconciliation.
- Uploadfehler sind teilweise sichtbar, aber kein zentraler Retry-/Abbruch-/Fortsetzungsworkflow existiert.
- Backup-Restore hat keinen Impact Preview, keine relationale Konsistenzprüfung und keinen atomaren Rollback.
- Kritische Konflikte in Rechnung, Lager, Planung und Serien werden nicht serverseitig erkannt.

## Fehlende Lokalisierung DE/SV/EN

- Viele sichtbare Texte in Billing, Inventory, Tracking, Master Data und Dialogen sind weiterhin fest auf Deutsch oder Schwedisch codiert.
- Rechnungs-PDF/-Vorschau enthält feste schwedische und feste Firmennamen statt konsistenter Kunden-/Tenant-Lokalisierung.
- API-Fehlertexte sind überwiegend nur Deutsch.
- Status-, Rollen-, Einheiten- und fachliche Freitextwerte werden nicht zentral als locale-unabhängige Codes modelliert.
- E-Mail-/PDF-Templates sind nicht vollständig für DE/SV/EN getestet.
- Übersetzungsüberschreibungen laufen selbst über Legacy-Sync und besitzen keine Version/Konfliktbehandlung.

## Fehlende Responsive-/Mobile-Absicherung

- Es gibt umfangreiche CSS-Breakpoints und eine mobile Feldansicht, aber keine systematische Viewport-Testmatrix.
- Breite Rechnungs-, Lager-, Planungs- und Stammdatenoberflächen sind nicht durch Mobile-E2E-Tests abgesichert.
- Modale Formulare und Tabellen haben keine automatisierten Prüfungen auf Überlauf, verdeckte Aktionen und Tastatur/Screenreader-Nutzung.
- Es gibt ein Manifest und Installationshinweise, aber keinen Service Worker; ein Kaltstart ohne Netz ist nicht abgesichert.
- Offline-Daten liegen teilweise als sensible vollständige Snapshots in `localStorage` ohne Nutzer-/Tenant-Trennung.
- App-Schließen, Sleep und Netzwerkwechsel sind nur beim Fahrtenqueue-Ansatz teilweise berücksichtigt.

## Empfohlene Implementierungsreihenfolge

1. **Security Foundation:** Supabase Auth/Sessions, serverseitiger User-/Tenant-Kontext, RLS, Rollenmatrix und Schutz aller API-Routen.
2. **DB-Verifikation Sync Foundation:** Migration in isoliertem PostgreSQL/Supabase ausführen, echte Konkurrenztests ergänzen, Recovery dokumentieren und gefundene SQL-Probleme beheben.
3. **Persistenzkonvergenz:** `app_state` als Schreibquelle beenden, klare Übergangsregeln definieren und keine weiteren parallelen Architekturen hinzufügen.
4. **Kernstammdaten härten:** Kunden und Objekte auf Einzelmutationen, Revisionen, Tombstones, Tenant-FKs und Konfliktauflösung migrieren.
5. **Aufträge/Planung/Serien härten:** serverseitige Statusregeln, datensatzweise Sync, idempotente Seriengenerierung und Planungskonflikte.
6. **Feldarbeit/Reports/Medien härten:** Offline-Queue, sichere Uploads, einheitliche Tombstones, Reportrevisionen und persistente Mail-Outbox.
7. **Finanzkern härten:** Rechnungszustandsmaschine, Nummernsequenzen, Steuer-/Rundungsregeln, Audit, Zahlungsstatus und idempotenter Accounting-Export.
8. **Lager/Ressourcen/Wartung härten:** transaktionale Bewegungen, Reservierungen, Revisionen und eigene Wartungsentitäten.
9. **Backup/Export/Recovery:** vollständige relationale Sicherung, Offsite-Kopie, Kundendatenexport und regelmäßig getesteter Restore.
10. **Release-Gates:** Staging, CI-Migrationen, Security-/Tenant-/Mobile-/Lokalisierungstests, Monitoring und dokumentierter Rollback.

## Vor neuen Modulen zu härten

Diese vorhandenen Bereiche haben Vorrang vor CRM, Einkauf, Wissensbasis, Signatur, Custom Reports oder Public API:

1. Rollen/Berechtigungen und Multi-Company-Grundlage
2. Kunden/Kontakte
3. Objekte/Projekte
4. Aufträge, Planung und Serien
5. Fahrtenbuch und Ressourcen
6. Serviceberichte, Medien und Kommunikation
7. Rechnungen, Zahlungen und Accounting-Export
8. Lager/Material
9. Backup/Export/Restore

## Freigabekriterien für den nächsten Entscheidungspunkt

- Sync-Migration läuft reproduzierbar auf PostgreSQL/Supabase und alle geforderten Konkurrenzfälle sind grün.
- Jede Fachroute verifiziert User, Tenant und Berechtigung; Cross-Tenant-Tests sind grün.
- Für den nächsten migrierten Kernbereich existieren Einzelmutationen, Revisionen, Tombstones, Idempotenz und sichtbare Konfliktauflösung.
- Backup und Restore umfassen die tatsächliche Source of Truth und wurden in Staging praktisch wiederhergestellt.
- Kritische Finanz-, Portal-, Medien- und Mailwege besitzen persistente Idempotenz und Auditierung.
- CI blockiert Releases bei fehlgeschlagenen Migrationen, Security-, Sync-, Mobile- oder Lokalisierungstests.
