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

## Pruefungen

`node scripts/test-operations-database.mjs --full-chain` verwendet ausschliesslich
einen temporaeren lokalen PostgreSQL-Cluster. Es prueft die komplette
Migrationskette, die zweimalige Typmigration, Pflichtfelder, Idempotenz,
Revisionsschutz, RLS sowie Backup/Wiederherstellung.

Playwright: `resource-types.spec.ts`, `resource-types-ui.spec.ts`,
`resource-cutover.spec.ts`, `operations-ui.spec.ts`, `drive-log-ux.spec.ts`
und `logbook-language.spec.ts`. Die neuen API-Aufrufe sind in UI-Tests gemockt;
der E2E-Bypass darf keine produktiven Ressourcentypen lesen oder schreiben.
