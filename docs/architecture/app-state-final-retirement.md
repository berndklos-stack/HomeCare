# Final retirement of `app_state`

Stand: 29. September 2026. Wave 5 ist lokal vollständig implementiert und für
die abschließende Prüfung im dedizierten WorkCore-Staging vorbereitet. Diese
Änderungen wurden weder deployed noch gegen Produktion ausgeführt.

## Ergebnis

- `app_state` ist keine operative Datenquelle mehr. Anwendungsrollen,
  einschließlich `service_role`, besitzen keine Tabellenrechte mehr.
- `GET`, `POST` und `PUT /api/app-state` antworten nach Authentifizierung mit
  `410 APP_STATE_RETIRED`.
- Alte Medienmigration und JSON-Fotowiederherstellung antworten mit `410`;
  Berichtstext-Backups schreiben nicht mehr in JSON.
- `POST /api/sync-sections` antwortet mit `410
  SYNC_SECTION_WRITES_RETIRED`. Der verbliebene GET-Endpunkt ist ausschließlich
  eine relationale Leseprojektion für den bestehenden Client. Er liest keine
  Section-Zeilen und kennt keinen Legacy-Fallback.
- Offline-Änderungen laufen datensatzweise über die vorhandene dauerhafte
  Mutationsqueue mit stabilen IDs, erwarteten Revisionen und Konflikten.
- `activeJobId` ist lokaler Geräte-/UI-Zustand. Alte lokale Löschlisten sind
  keine Serverquelle; verbindlich sind relationale Tombstones.

## Domänenklassifikation

| Domäne | Status | Verbindliche relationale Quelle |
| --- | --- | --- |
| Mandant, Module, Abonnement | relational authoritative | `homecare_tenants`, `homecare_tenant_modules`, `homecare_subscriptions` |
| Firmen- und Tagesmail-Einstellungen | relational authoritative | `homecare_settings` |
| Übersetzungen | relational authoritative | `homecare_translations` |
| Kunden und Ansprechpartner | relational authoritative | `homecare_customers`, `homecare_customer_contacts` |
| Objekte, Projekte, Sites | relational authoritative | `homecare_objects` |
| Objekt-, Berichts- und allgemeine Medien | relational authoritative | `homecare_media`, privater Storage-Bucket |
| Ressourcen und Fahrzeuge | relational authoritative | `homecare_resources` |
| Fahrten und Positionen | relational authoritative | `homecare_vehicle_trips`, `homecare_vehicle_positions` |
| Fahrtenhistorie und Regeln | relational authoritative | `homecare_odometer_history`, `homecare_trip_audit_log`, `homecare_driving_log_regulations` |
| Aufträge und Planung | relational authoritative | `homecare_jobs` |
| Serienaufträge | relational authoritative | `homecare_jobs` mit eindeutiger Serienvorkommensregel |
| Tagesfortschritt | relational authoritative | `homecare_field_progress` und Orphan-Archiv |
| Zeiterfassung | relational authoritative | `homecare_job_time_entries` |
| Auftragsnotizen | relational authoritative | `homecare_job_notes` |
| Berichte | relational authoritative | `homecare_reports` |
| Kommunikation und Portalnachrichten | relational authoritative | `homecare_portal_messages`, `homecare_portal_message_replies` |
| Rechnungen und Rechnungszeilen | relational authoritative | `homecare_billing_items`, `homecare_invoice_lines` |
| Zahlungen und Buchhaltungsexporte | relational authoritative | `homecare_payments`, `homecare_accounting_exports` |
| Finanzhistorie | relational authoritative | `homecare_financial_audit` |
| Personal | relational authoritative | `homecare_personnel` |
| Leistungen und Pakete | relational authoritative | `homecare_services`, `homecare_service_packages` |
| Konten, Lagerorte und Material | relational authoritative | `homecare_accounting_accounts`, `homecare_inventory_locations`, `homecare_materials`, `homecare_inventory_movements` |
| Portalzugriff und Rollen | relational authoritative | `homecare_portal_access`, Rollen-, Profil- und Mitgliedschaftstabellen |
| Cron-Zustand | relational authoritative | `homecare_daily_mail_state`, immer mit `tenant_id` |
| Offline-Idempotenz | relational authoritative | `homecare_sync_mutations`; ausstehende Clientmutationen bleiben lokal dauerhaft |
| Backup/Restore | relational authoritative | `homecare_relational_backups` und Security-Definer-RPCs |
| `app_state`-Tabelle | retired legacy compatibility only | Historisches Archiv ohne Rechte für App-Rollen |
| Alte Importmigrationen | retired legacy compatibility only | Einmaliger Import bei Migration; kein Runtime-Pfad |
| `GET /api/sync-sections` | retired legacy compatibility only | Namenskompatible relationale Projektion, kein eigener Speicher |
| Historische Changelog-/Architekturtexte | retired legacy compatibility only | Dokumentieren frühere Zustände und sind nicht ausführbar |

Es gibt keine blockierte Geschäftsdomäne.

## Relationales Backup

`homecare_create_relational_backup` erstellt unter einer Transaktion ein
tenantbegrenztes, SHA-256-geprüftes Abbild aller 42 mandantenbezogenen Tabellen.
Das Manifest enthält pro Tabelle die Datensatzanzahl. Darin enthalten sind auch
Revisionen, Tombstones, Beziehungen, Portalzugriff, Auditdaten,
Mutationsjournal, Cron-Zustand und Fahrtenhistorien.

`homecare_restore_relational_backup` akzeptiert ausschließlich einen vollständig
leeren Zielmandanten. Es schreibt die gespeicherten IDs unverändert, ersetzt nur
`tenant_id` durch den Zielmandanten und stoppt bei jeder Abweichung zwischen
Manifest und tatsächlich wiederhergestellter Anzahl. Ein zweiter Restore in
einen nicht leeren Mandanten wird abgewiesen.

Da die Geschäfts-IDs datenbankweit eindeutig sind, setzt eine
Wegwerfmandantenprobe voraus, dass die entsprechenden Quelldatensätze in der
Testtransaktion zuvor entfernt wurden. Die lokale Probe führt genau diesen
Desaster-Recovery-Ablauf aus und rollt anschließend vollständig zurück.

## Vollständige Suche

Aktive Anwendungspfade enthalten keine `app_state`-Abfrage und keinen
Ganzbereichs-Write. Verbleibende Treffer sind:

- historische, bereits ausgeführte Importmigrationen;
- SQL-Regressionen, die beweisen, dass alte JSON-Zeilen keine Daten
  wiederauferstehen lassen;
- Changelog, frühere Phasenchecklisten und Architekturaudit;
- die stillgelegte Tabelle und ihre finale Rechteentziehung;
- Endpunktnamen in Tests und im relationalen GET-Kompatibilitätsadapter.

Frühere Sicherheits- und Reparaturskripte mit direktem `app_state`-Zugriff sind
explizit stillgelegt. Der Rehearsal-Export enthält `app_state` nicht mehr.

## Lokale Verifikation

- vollständige Migration von leerer PostgreSQL-Datenbank: bestanden;
- Wave-5-Migration wiederholt angewendet: idempotent;
- 11 SQL-/RLS-/Sync-Suiten: bestanden;
- relationales Backup und Restore in Wegwerfmandant: bestanden;
- stabile IDs, Beziehungen, Revisionen und Tombstones nach Restore: bestanden;
- Cross-Tenant-Zugriff und Cross-Tenant-Mutation: abgewiesen;
- `app_state` für `authenticated` und `service_role`: nicht lesbar;
- TypeScript: bestanden;
- Produktionsbuild: bestanden;
- vollständiges Playwright: 84 von 84 Tests bestanden;
- `git diff --check`: bestanden.

## Staging- und Produktionsgrenze

Offen ist ausschließlich die vom Auftrag getrennte Verifikation im dedizierten
WorkCore-Staging und danach die Produktions-Cutover-Planung. Wave 5 selbst
berührt weder Staging noch Produktion und führt keinen Deploy aus.
