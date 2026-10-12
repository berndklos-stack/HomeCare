# Zwischenstand: Fahrten und Projektbilder

Produktive Daten, Migrationen und Storage-Dateien wurden nicht veraendert. Die
sicheren App-Korrekturen werden als 1.427.35 veroeffentlicht; die neue SQL-Migration
wird dabei nicht automatisch angewendet.

## Nachgewiesene Codeprobleme

- `homecare_apply_sync_mutation` vergleicht beim Anlegen jeder Fahrt den Startstand mit dem Endstand der neuesten abgeschlossenen Fahrt (Sortierung nach Ende/Aenderungszeit), nicht mit den chronologischen Nachbarn. Die lokale Testimplementierung in `lib/vehicleSync.ts` verwendet denselben ungeeigneten Vergleich.
- `resetLogbookForm`, der Datumswechsel und `saveLogbookEntry` verwenden den letzten Fahrzeugstand unabhaengig vom historischen Datum. Bestehende Sortierung nimmt am selben Tag den Kilometerstand vor der Startzeit; eine neue historische Fahrt besitzt derzeit keine bearbeitbare Startzeit.
- Der Objektleseweg wandelte einen fehlgeschlagenen Medienabruf in eine leere Bildliste um. Lokal korrigiert: Fehler werden weitergegeben, keine scheinbar erfolgreiche Leerprojektion.
- Die Offline-Objektprojektion blendete auch noch nicht aufgeloeste Konflikte aus. Lokal korrigiert: Erfassungen und Aenderungen bleiben sichtbar; Konfliktloeschungen verstecken keine vorhandenen Servermedien.
- Alte Medien besitzen weiterhin ausschliesslich eine exakte `preview_url` auf `migrated-app-state/...`. Die Projektion signiert diese Dateien fuer 15 Minuten, lieferte jedoch keinen dauerhaften Speicherpfad. Der private Fallback erlaubte nur mandantenpraefixierte `storage_path`-Referenzen. Lokal korrigiert: stabiler Pfad in der Leseprojektion und expliziter Legacy-Zugriff ausschliesslich mit exakter aktiver Referenz, Tenant/RLS-Pruefung und lesbarem, nicht geloeschtem Eigentuemerobjekt. Keine Rechteerweiterung fuer beliebige Altpfade.

## Lesende Produktionspruefung

Mandant: `00000000-0000-0000-0000-000000000001`.
Referenzsnapshot: `/private/tmp/workcore-project-media-audit-20261012.json`, Dateimodus 0600.
SHA-256: `9caefb728a87b2033c0000ac61782b17eebe545cbd3cd8742ea2a9351ca67fc8`.

- 12 Objekte, davon eines mit gespeichertem Typ Projekt; 18 aktive Medienreferenzen, keine fehlenden Eigentuemer.
- 11 referenzierte Dateien per Storage-Metadatenabruf bestaetigt, darunter 10 alte Bilddateien und das neuere Projektfoto von Kaehrs. Die bekannten alten Bildzuordnungen muessen nicht geraten oder neu geschrieben werden.
- Sieben Referenzen ohne nachweisbaren privaten Speicherpfad: ein Inline-Bild, eine externe Bildadresse und fuenf Referenzen ohne Vorschau. Daraus folgt nicht, dass Originaldateien geloescht wurden. Weitere Storage-/Backup-Pruefung erforderlich.
- Die beiden konkret gemeldeten TRIP-IDs existieren noch nicht in der Server-Fahrttabelle. Ihre lokalen Inhalte und Warteschlangeneintraege wurden nicht aus dem Browser ausgelesen. Kein Wiederholungsversuch und keine Konfliktaufloesung ausgefuehrt.

Der Snapshot sichert Referenzen, ist aber **kein vollstaendiges Datenbank- und Datei-Backup** und keine bestaetigte Wiederherstellungsprobe.

## Weiter offen vor Freigabe

- Chronologische Vorschlaege, Zeitwahl und Lueckenanzeige sind implementiert. Bestehende Fahrten werden nicht automatisch angepasst; manuelle Datums-/Zeit-/Kilometeraenderungen erhalten Audit-Eintraege. Die versionierte SQL-Korrektur `20261012120000_vehicle_trip_chronology.sql` prueft vorherige und naechste Fahrt, serialisiert Fahrzeugmutationen und verhindert ein Zuruecksetzen des Fahrzeugstands durch historische Updates. Sie aendert bei ihrer Installation ausschliesslich Funktionsdefinitionen, keine bestehenden Zeilen. Noch nicht produktiv angewendet.
- Bestehende Mutationsantworten sind idempotent journalisiert. Ein bereits journalisierter Konflikt wird durch erneutes Senden derselben Mutations-ID nicht automatisch neu bewertet. Sicheren, dokumentierten erneuten Versuch separat entwerfen; lokale Originaldaten erhalten.
- `prepareObjectMutations` erhaelt fehlende Medien, solange kein ausdruecklicher, zur Medienrevision passender Loeschauftrag vorliegt. Entfernen im Objektformular erfordert Bestaetigung. Revisionsabweichungen erhalten das Bild statt eine veraltete Loeschabsicht auf einen inzwischen geaenderten Datensatz anzuwenden. Der komplette Upload-/Offline-/Wiederholungsablauf und vorhandene unreferenzierte Dateien bleiben weiter zu pruefen.
- Bilder eines neuen Objekts warten auf dessen bestaetigte Anlage. Ein Konflikt dieses Objekts blockiert unabhaengige Fahrten nicht. Die bestehenden Netzwerk-Wiederholungen behalten ihre Identitaet; Konflikte werden nicht automatisch verworfen.
- Vollstaendiges Backup samt Storage-Dateien und Wiederherstellungsprobe vor produktiven Datenkorrekturen oder SQL-Migrationen. Keine Produktionseinspielung oder Datenreparatur ohne diese Klaerung.

## Lokale Zwischenpruefung

- 45 Tests fuer Chronologie, Kilometerluecken, Objekt-/Medienabgleich, stabile Altpfade, exakte Zugriffsnachweise, PDF-Medien, Projektfotovorschau und Synchronisationsregressionen erfolgreich.
- 17 weitere Pruefungen fuer bestehende Fahrten-Dialoge, Sprachen und Bildschutz erfolgreich. Zwei neue Oberflaechentests nach Korrektur ihrer Testdaten erfolgreich: historische Zeitwahl, vorheriger Kilometerstand, leeres Feld ohne Vorgaenger und sichtbare 185-km-Luecke auf Desktop/Handy.
- TypeScript-Pruefung erfolgreich.
- Abschliessende Kernpruefung: 44 Tests erfolgreich; 12 weitere Safari-Pruefungen erfolgreich. Produktionsbuild erfolgreich. Desktop-/Handy-Screenshots der historischen Fahrterfassung visuell geprueft, kein horizontaler Ueberlauf.
- Vollstaendige Migrationskette und relationale Backup-/Restore-Rundreise im wegwerfbaren lokalen PostgreSQL-Cluster erfolgreich. Die neue Fahrtenpruefung akzeptiert historische Einfuegungen und Kilometerluecken, verhindert doppelte Wiederholungen und echte Ueberschneidungen/veraltete Revisionen und erhaelt den aktuellen Fahrzeugstand bei historischen Updates. Dies ist kein Nachweis einer vorhandenen produktiven Vollsicherung einschliesslich Originaldateien.
- Keine Behauptung einer abgeschlossenen Gesamtpruefung: produktive Fahrtenmigration, sichere erneute Bewertung der beiden bereits journalisierten Konflikte, produktive Backup-Wiederherstellungsprobe und restliche Upload-Szenarien sind noch offen. Bis zur produktiven Migration kann die alte Serverpruefung historische Fahrten weiterhin ablehnen.
