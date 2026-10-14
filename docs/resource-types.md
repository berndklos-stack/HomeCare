# Typgesteuerte Ressourcen

## Modulgrenzen

- Materialstammdaten werden in **Lager & Material** gepflegt.
- Ressourcen, Zuweisungen, Ausstattung sowie Wartung und Pruefungen bleiben in **Stammdaten > Ressourcen**.
- **Stammdaten > Ressourcentypen** verwaltet frei benennbare Typen und deren Felder.

## Relationales Modell

`homecare_resource_types` hat einen mandantenbezogenen Primarschluessel,
Name, technische Kategorie, Archivierung und Revision. Die drei technischen
Kategorien dienen ausschliesslich der Kompatibilitaet mit bestehenden Fahrzeug-,
Maschinen- und Geraetefunktionen; die Benutzertypen sind nicht begrenzt.

`homecare_resource_type_fields` speichert je Typ und Katalogfeld eine eigene
relationale Zeile mit aktiviert, erforderlich und Anzeigereihenfolge.
`homecare_resource_field_catalog` beschreibt 34 bekannte Felder und deren
Zuordnung zu bestehenden oder additiv ergaenzten Ressourcenspalten.
Ressourcen erhalten einen mandantenbezogenen Fremdschluessel `resource_type_id`.

Typmutationen laufen ueber die bestehende dauerhafte Warteschlange, mit
Revisionsvergleich und Idempotenzjournal. Zugehoerige neue Ressourcen warten
bei einer fehlgeschlagenen oder konfliktbehafteten Typmutation. Andere
unabhaengige Mutationen laufen weiter. Der lokale Typcache ist nur ein Lesecache.

## Bestehende Daten und Einfuehrung

Die Migration `20261008100000_resource_types.sql` legt sieben editierbare
Starttypen je bestehendem Mandanten an. Bestehende Fahrzeug-, Maschinen- und
Geraetedatensaetze erhalten nur den neuen Typverweis; IDs, Fahrten, Fotos,
Messwerte und weitere Nutzdaten werden nicht umgeschrieben. Bestehende
Revisionen und Zeitstempel bleiben beim Backfill unveraendert; die beiden
Metadatentrigger werden nur innerhalb der gesperrten Migration deaktiviert und
in ihrem urspruenglichen Zustand wieder aktiviert.
Unbekannte Legacy-Typnamen werden nicht automatisch geraten oder ueberschrieben.
Neue Mandanten koennen eigene Typen anlegen; Standardvorlagen lassen sich mit
der service-exklusiven Seed-Funktion initialisieren.

Die Migration ist wiederholbar und ueberschreibt keine Benutzerkonfiguration.
Bestehende Offline-Ressourcenpatches ohne Typverweis werden nicht nachtraeglich
durch neu konfigurierte Pflichtfelder blockiert. Alte Typwechsel ohne explizite
neue Typauswahl werden nicht stillschweigend
ueberschrieben, sondern bleiben als fehlgeschlagene lokale Mutation erhalten.
Bei typgesteuerten Formularen
werden Pflichtfelder sowohl im Client als auch im Server geprueft. Ein Typwechsel
loescht keine verborgenen Feldwerte. Fahrzeughistorie verhindert den Wechsel
in eine Nicht-Fahrzeugkategorie. Typen mit zugeordneten Ressourcen behalten ihre
technische Kategorie.

Vor Veroeffentlichung: Migration zuerst auf Staging pruefen, bestehende
Ressourcen/Fahrten und offene Warteschlange vergleichen, Backup erstellen,
dann Migration vor dem dazugehoerigen Anwendungscode ausrollen. Der neue
Leseendpunkt benoetigt die neuen Spalten. Keine automatische Produktivmigration
oder Datenbereinigung ist Bestandteil der lokalen Umsetzung.

## Standardfahrten am Fahrzeug

Standardfahrten werden unter Ressourcen am jeweiligen Fahrzeug angelegt,
bearbeitet und geloescht. Im Dialog Fahrt bleibt die Auswahl gespeicherter
Standardfahrten erhalten; dort werden keine Vorlagen mehr angelegt.
Vorlagen enthalten nur Routendaten, keine aktuellen Kilometerstaende,
Fahrtzeiten oder Fotos. Routendefinitionen bleiben in der bestehenden Spalte
`homecare_resources.standard_trips`. Die optionale Entfernung steht dagegen
massgeblich in `homecare_resource_standard_trip_distances.distance_km`
(`numeric(12,3)`, Migration `20261014130000_standard_trip_distances.sql`).
Die Zuordnung verwendet Mandant, Fahrzeug und stabile Vorlagen-ID. RLS verlangt
Request-Mandant und `data.read`; anon und direkte Client-Schreibzugriffe sind
gesperrt. Vorlagenaenderungen laufen mit der bestehenden Ressourcenmutation
und deren Revisions-/Wiederholungsschutz atomar ueber einen internen Trigger.
Das JSON enthaelt einen Transport-/Backupspiegel; der Leseweg verwendet die
numerische Spalte. Aeltere Clients ohne Entfernungsfeld erhalten bestehende
Entfernungen, explizites `null` entfernt die Entfernung. Vorlagenloeschung
entfernt die zugeordnete Entfernung. Relationale Sicherung und Wiederherstellung
enthalten die neue Tabelle separat und stellen die numerischen Werte nach den
Fahrzeugen wieder her; der Trigger erzeugt beim geschuetzten Restore keine
doppelten Zeilen. Bestehende Vorlagen ohne Entfernung bleiben unveraendert nutzbar.

Unter Standardfahrten steht eine aufklappbare Fahrtenuebersicht bereit.
Abgeschlossene Fahrten koennen als bearbeitbare Vorlage uebernommen werden:
Route, Zweck, besuchte Person und Entfernung, aber keine Tachostaende,
Fahrtzeiten, GPS-Koordinaten oder Fotos. In Fahrt wird bei Vorlagenauswahl
und Aenderung des Startstands der Endstand aus Start plus Entfernung
vorgeschlagen. Eine manuelle Korrektur bleibt bis zur naechsten Aenderung
des Startstands erhalten. Ohne Entfernung gibt es keinen Vorschlag.
Die neue Datenbankmigration muss vor dem Anwendungscode ausgerollt werden,
da der Ressourcen-Leseweg die mandantengeschuetzte Entfernungstabelle mitliest.
Bei bestehenden Fahrzeugen werden Vorlagen separat gespeichert, bei neuen
Fahrzeugen zusammen mit der Fahrzeuganlage. Ein offener Vorlagenentwurf muss
zuerst gespeichert oder verworfen werden, bevor das Fahrzeug gespeichert wird.

## Pruefungen

`node scripts/test-operations-database.mjs --full-chain` verwendet ausschliesslich
einen temporaeren lokalen PostgreSQL-Cluster. Es prueft die komplette
Migrationskette, die zweimalige Typmigration, Pflichtfelder, Idempotenz,
Revisionsschutz, RLS sowie Backup/Wiederherstellung.

Playwright: `resource-types.spec.ts`, `resource-types-ui.spec.ts`,
`resource-cutover.spec.ts`, `operations-ui.spec.ts`, `drive-log-ux.spec.ts`
und `logbook-language.spec.ts`. Die neuen API-Aufrufe sind in UI-Tests gemockt;
der E2E-Bypass darf keine produktiven Ressourcentypen lesen oder schreiben.
`standard-trips.spec.ts` prueft Vorlagenuebernahme, Entfernung, Dezimalwerte,
Endstandsvorschlag und manuelle Korrektur auf Desktop und iPhone in Chrome
und Safari. `standard_trip_distances.sql` prueft den numerischen Schreibweg,
Wiederholungen, Revisionskonflikte, Altclient-Erhalt, Loeschung und RLS;
`operations_full_chain.sql` enthaelt einen Backup-/Restore-Rundlauf mit Entfernung.

### Entfernungs-Release 1.427.43

Am 14.10.2026 lokal erfolgreich: 39 Chrome-/Safari-Tests, vollstaendige
SQL-Migrationskette mit Wiederholung, RLS und Backup-/Restore, TypeScript,
Produktionsbuild und `git diff --check`.
Migration danach auf Staging und mit identischen Migrations-/Test-Pruefsummen
im bestaetigten Produktionsprojekt angewendet. Rollen-/RLS-Fixturetests liefen
nur auf Staging in zurueckgerollten Transaktionen, nicht auf Produktivdaten.
Ressourcen- und Fahrten-Fingerprints vor/nach Anwendung stimmen ueberein.
Security Advisor in Produktion unveraendert: 0 Fehler, 7 bestehende Warnungen.
Private Sicherungen und Nachweise:
`/private/tmp/workcore-standard-distance-staging-lxyrLt/verification.json` und
`/private/tmp/workcore-standard-distance-production-GO6sAv/verification.json`.
Die Produktionssicherung `backup-before.json` liegt im selben geschuetzten
Verzeichnis und wird nicht ins Repository aufgenommen.
