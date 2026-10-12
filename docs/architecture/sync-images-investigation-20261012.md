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

## Bolet 4 und Fahrtenseiten (1.427.36)

- Bolet 4 (`OBJ-1004`, `MED-1786914919908-0-IMG_1373.jpeg`) besitzt weiterhin eine gueltige Originaldatei. Die scheinbar externe Bildadresse ist in Wirklichkeit ein abgelaufener signierter Link des eigenen Supabase-Projekts auf `migrated-app-state/2026-08-30/29b1bd0c-b0e3-445f-a2b5-d53c614b6c19-objects-1-media-items-0-previewUrl.jpg`.
- Lesende Pruefung der Produktivdatei: alter Link HTTP 400, frisch signierter Link auf dieselbe Datei HTTP 200 mit `image/jpeg`. Kein Datei-Upload, keine Datenbankkorrektur oder Neuverknuepfung ausgefuehrt.
- Der Projektionsweg erkennt diesen Sonderfall nur beim eigenen Supabase-Origin und privaten Bucket. Die urspruengliche Altzuordnung in den vorhandenen Migrationsdaten muss zum signierten Pfad passen. Zugriff weiterhin nur ueber aktive Objektzuordnung und Benutzer-/Mandantenpruefung; fremde URLs, geloeschte Referenzen oder abweichende Altzuordnungen berechtigen nicht zum Signieren.
- Quickbutton Fahrt, Fahrtenbuch und Fahrt nachtragen sind normale Seitenansichten. Ressourcendetails bleiben in ihrem vorhandenen Dialog; beim Wechsel ins Fahrtenbuch endet dieser Dialog. Fokus kehrt beim Abbrechen zur ausloesenden Aktion zurueck, Fahrtenentwuerfe und Speicher-/Abschlusswege bleiben erhalten.
- iPhone: kompakte Kopfzeile ohne Suche/Markenblock waehrend der Fahrtbearbeitung, einspaltige 16-Pixel-Eingaben, mindestens 44-Pixel-Bedienelemente und erreichbare Speicheraktionen. Desktop-/Mobile-/Touch-Ansichten und Safari gesondert geprueft. Keine Anwendung der weiterhin gesperrten Fahrten-Datenbankmigration.
- 34 Oberflaechen-/Medientests in Chromium/WebKit erfolgreich, darunter echte Touch-Kontextemulation mit iPhone-Abmessungen, Popup-Abwesenheit, Formularlesbarkeit, Speicher-/Abschlusswege, Entwurferhalt und Fokus-Rueckkehr. Zusaetzlich 14 Medien-Sicherheitspruefungen erfolgreich (davon vier erneut ausgefuehrt). Dynamische signierte Links werden nicht als neue Dateizuordnung gespeichert; bewusste Beschreibungsbearbeitung verwendet die bestaetigte permanente Altreferenz.

## Nachkorrektur der tatsaechlichen Bild-Ladeabfrage (1.427.37)

- Die Hilfsfunktion aus 1.427.36 war korrekt, erhielt aber vom Objekt-Ladeendpunkt nicht die benoetigte `metadata.previewUrl`: `loadObjectMediaRows` liess `metadata` in der Spaltenauswahl aus. Dadurch wurde der signierte Bolet-4-Link trotz vorhandener Originaldatei nicht erneuert. Die vorherigen Hilfsfunktionstests deckten diese Anbindung nicht ab.
- Gemeinsame Spaltenauswahl `objectMediaReadColumns` enthaelt nun die bestehende Altzuordnung. Neuer Regressionstest bildet genau diese Spaltenprojektion vor der Signierung nach und prueft ihre Verwendung im Endpunkt. Keine neuen Geschaeftsfelder und keine Datenbank-/Storage-Schreibzugriffe.
- Lesender Produktivtest mit derselben Spaltenauswahl und den tatsaechlichen Projektionsfunktionen: Bolet 4, Revision 2, HTTP 200, `image/jpeg`, 92169 Bytes, JPEG-Signatur gueltig. 15 Medien-/Datenerhalt-Tests und TypeScript-Pruefung erfolgreich.
- Beide konkret gemeldeten Fahrten weiterhin nicht auf dem Server. Die alte produktive Validierung sowie journalisierte Konfliktantworten werden durch einen reinen App-Release nicht korrigiert. Migrationszugang, verifizierte Sicherung/Wiederherstellung und sichere erneute Bewertung bleiben Voraussetzungen; lokale Konflikte nicht verwerfen.

## iPhone-Nachkorrektur (1.427.38)

- Schwebende Quick-Fahrt-Aktionen bleiben erhalten; Formularende und Standardfahrt-Option erhalten ausreichend Scrollreserve, damit Checkbox und Namensfeld oberhalb der Leiste bedient werden koennen.
- Quick-Fahrt und Fahrtenbuch folgen der globalen App-Sprache statt der gesonderten Fahrzeug-/Export-Sprache. Kilometerluecken, Zeitraum-Verbindung und Tank-/Ladebeispiel sind uebersetzt; deutsche Zweckbezeichnung nicht mehr zweisprachig. Exportfunktion und gespeicherte Sprachwahl bleiben unveraendert.
- Mobile Fahrtenliste zeigt beschriftete Zweispalten-Angaben mit vollstaendiger Route, Zweck, Belegen und 44-Pixel-Aktionen; Desktop bleibt Tabelle. Keine Fahrtdaten geaendert.
- Supabase-Verwaltungszugang ist bereits angemeldet. Lesende Pruefung der produktiven Funktionsdefinition bestaetigt weiterhin `chronological_validation_live=false`. Die vorherige Bitte um neuen Zugang war voreilig; Sicherungs-/Wiederherstellungs- und Konflikt-Neubewertungspruefung bleiben offen.
- Abschliessender Testlauf: 37 Tests erfolgreich, einschliesslich Chrome/Safari, iPhone-Touch-Kontext, erreichbarem Standardfahrt-Namensfeld oberhalb der schwebenden Leiste, vollstaendigen langen Adressen ohne seitlichen Ueberlauf, DE/SV/EN und unveraenderten Offline-/Speicherablaeufen. Screenshots der Standardfahrt-Option und mobilen Liste visuell geprueft.

## Fahrten-Synchronisation (1.427.39)

- Neue relationale Produktionssicherung `ef8f255a-0c09-4581-9959-ebea96103199` angelegt, Server-Pruefsumme bestaetigt, geschuetzte lokale Kopie `/private/tmp/workcore-trip-backup-20261012.json.restore.json`, SHA-256 `5b4d63383ccdbbc294f0bd6934f05523ce67759349eba8e959c288cb26f1bf8b`. Vollstaendige lokale Wiederherstellung aller 70 gesicherten Tabellen mit Vergleich aller Datensatzwerte erfolgreich. UTC und mengenbasierter Vergleich vermeiden Unterschiede durch lokale Zeitzone/Sortierung. Originaldateien werden von diesen Funktionsmigrationen nicht beruehrt; keine Storage-Wiederherstellung behauptet.
- Bisherige Produktionsfunktion gesichert und lokal wieder eingespielt; Rueckkehr zur alten Funktionsdefinition geprueft. Produktive Anwendung der zwei gezielten Migrationen ist an diese Sicherung, Originalfunktionsvergleich und Transaktion gebunden; vorhandene Fahrten werden innerhalb der Transaktion vor/nachher auf Unveraendertheit geprueft.
- Neuer service-role-exklusiver Fahrten-RPC bewertet nur urspruengliche `create`-Konflikte der exakten alten Kilometerregel neu. Payload, Datensatz, Operation und Revisionsbedingung muessen unveraendert sein. Originalantwort, Fahrzeugzuordnung, neue Antwort und Bewertungszeit stehen in eigenen Spalten der neuen RLS-geschuetzten Tabelle `homecare_trip_validation_rechecks`; Tabelle in relationale Sicherungen aufgenommen. Wiederholungen behalten dieselbe Mutationskennung, echte Konflikte bleiben bestehen.
- App wiederholt diese alten Konflikte automatisch nur ohne ueberschneidende lokale Kandidaten. Beide konkreten Eingaben am 5.10. starten bei 202947, enden jedoch bei 202949 bzw. 202950. Simulation auf der wiederhergestellten Produktionskopie: erste Eingabe zulaessig, zweite kollidiert danach mit dem Endstand der ersten. Keine produktive Uebernahme dieser widerspruechlichen Auswahl ohne Nutzerklaerung; beide Originalanfragen bleiben gesichert.
- Anzeige der Fahrtenkonflikte mit Fahrzeugname, Datum und Kilometerstaenden. Historische Serverbestaetigungen setzen auch den lokalen Fahrzeugstand nicht zurueck. 40 fokussierte Chrome-Tests und vollstaendige lokale SQL-Migrationskette mit Chronologie-, Idempotenz-, Ueberschneidungs- und Recheck-Pruefungen erfolgreich.
- Beide Migrationen am 12.10. produktiv in einer einzigen abgesicherten Transaktion angewendet und registriert. Ausgangsfunktion entsprach der gesicherten Definition; vorhandene Fahrten vor/nachher identisch. Keine Uebernahme der beiden strittigen Eingaben. Zusaetzliche 23 Chrome-/Safari-Pruefungen und Produktionsbuild erfolgreich. Entscheidung ueber den richtigen Endstand der zwei ueberschneidenden Eingaben weiterhin beim Nutzer.

## Fehlende Startzeit (1.427.40)

- Quick-Fahrt ohne aktive Startbuchung liefert keine Startzeit. Die bisherige Nachbarpruefung ordnete sie deshalb um Mitternacht vor bereits gefahrenen Tagesstrecken ein. Zusaetzlich ersetzte der Schreibweg fehlende Startzeiten durch den Speicherzeitpunkt.
- Neue versionierte Migration prueft Tage mit unbekannten Fahrtzeiten anhand der Kilometerintervalle. Echte Ueberschneidungen, Tagesgrenzen, Revisionen, Idempotenz und aktive Fahrten bleiben geschuetzt. Fehlende Startzeiten bleiben unbekannt; keine Pflichtzeit und keine erfundenen historischen Zeiten.
- Exakt passende alte Ablehnungen wegen der vermeintlichen naechsten Fahrt werden mit unveraenderten Anfragen erneut geprueft. Originalantwort bleibt im Recheck-Protokoll erhalten. Ungeklaerte ueberschneidende lokale Eingaben werden nicht automatisch ausgewaehlt.
- Vollstaendige lokale SQL-Testkette, 21 Chrome-Fahrten-/Konflikttests, 7 Safari-/iPhone-Tests, Typpruefung und Produktionsbuild erfolgreich.
- Aktuelle Produktionssicherung `d5533b35-121a-4821-9d53-da7e7d4fa096`: 71 Tabellenwerte lokal vollstaendig wiederhergestellt, alle drei ersetzten Funktionen fuer Rueckkehr gesichert und eingespielt. SHA-256 der privaten Kopie: `7718134623fe98df303618a8b7312637789a8d256b5ab32b66f7a4ddaaed2357`.
- Simulation der konkreten neuen Anfrage `TRIP-45f91b9c-2476-46f2-9ef6-1d1cb418d942` auf dieser Kopie erfolgreich; Transaktion danach zurueckgerollt. Keine produktive Fahrt in dieser Probe angelegt.
