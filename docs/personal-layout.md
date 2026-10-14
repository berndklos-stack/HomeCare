# Persoenliche Anordnung

## Bedienung

Standardfahrten, Fahrzeugdokumente und Termine/Wartung beginnen in den
Fahrzeugstammdaten eingeklappt. Ein-/Ausklappen entfernt keine Formulare aus dem
DOM: Eingaben bleiben beim Ein-/Ausklappen und Umordnen erhalten. Ein offener
Standardfahrtenentwurf sperrt das Einklappen dieses Blocks und das Umsortieren,
bis er gespeichert oder verworfen wird.

Anordnen zeigt Ziehgriffe und Auf-/Ab-Pfeile fuer Fahrzeugbloecke beziehungsweise
Menuepunkte. Drag-and-drop verwendet dnd-kit mit Pointer- und Tastatursensoren.
Die Griffe unterstuetzen Maus und Touch; nur dort ist Touch-Scrollen gesperrt.
Alternativ: Griff fokussieren, Leertaste, Pfeiltasten, Leertaste; Escape bricht ab.
Abbrechen oder Ablegen ausserhalb der Ziele schreibt nichts. Gespeichert wird
nur nach dem Ablegen, nicht waehrend des Ziehens. Die Pfeile bleiben als
Alternative erhalten. Jede erfolgreiche Bewegung
wird persoenlich gespeichert; Standardreihenfolge setzt nur den jeweiligen
Bereich zurueck. Bei Speicherfehlern bleibt die bisher bestaetigte Anordnung
erhalten und die App meldet Nicht gespeichert. Keine vorgetaeuschte Offline-
Speicherung. Es gibt keinen benutzeruebergreifenden lokalen Einstellungscache.
Ein-/Ausklappzustand wird nur fuer das offene Fahrzeugformular gehalten.

## Datenbank und API

Migration: `20261014140000_personal_layout_preferences.sql`.
`homecare_user_layout_preferences` hat eigene `text[]`-Spalten
`navigation_order` und `vehicle_block_order`; Schluessel sind `tenant_id`
und `user_id`. Keine Speicherung neuer Werte ausschliesslich in Sammel-JSON.
Ungueltige, doppelte und NULL-IDs werden durch Constraints abgewiesen. Fehlende
bekannte Eintraege werden beim Lesen angehaengt, unbekannte IDs ignoriert.

RLS erlaubt ausschliesslich die eigene Zeile im angefragten Mandanten mit
aktiver Mitgliedschaft. Adminrollen bekommen keinen Einblick in fremde
persoenliche Anordnungen. Anon hat weder Tabellen- noch RPC-Zugriff. Der
Invoker-RPC `homecare_update_layout_preference` arbeitet unter RLS und schreibt
jeweils nur eine freigegebene Spalte atomar. Eine Menueaenderung ueberschreibt
keine gleichzeitig geaenderte Blockreihenfolge. Aenderungen derselben Spalte
werden in Datenbankreihenfolge gespeichert; der letzte Schreibvorgang gilt.

GET/PATCH `/api/layout-preferences` leiten Benutzer und Mandant nur aus der
validierten Sitzung ab und verlangen `data.read`. Keine frei waehlbare Benutzer-
ID im Request. Antworten sind privat und nicht cachebar. Kundenportalansichten
laden diese Mitarbeiter-Einstellungen nicht. Im lokalen E2E-Bypass liefert
GET nur Standardwerte und PATCH schreibt niemals gegen echte Daten.

Die Tabelle ist in relationalen Backups und Wiederherstellung enthalten.
Migration vor dem Anwendungscode ausrollen. Das Verifikationsskript
`scripts/verify-personal-layout.mjs` verlangt fuer Produktion einen passenden
Staging-Nachweis (gleiche Migrations- und Test-Pruefsummen).

## Pruefungen

`node scripts/test-operations-database.mjs --full-chain` prueft Migration und
Wiederholung, Benutzer-/Mandantentrennung, Anon-Sperre, ungueltige IDs,
unabhaengige Spaltenaenderungen und den Backup-/Restore-Rundlauf.
`personal-layout.spec.ts` prueft Ein-/Ausklappen, Touch-Groessen, Anordnung,
Reload, Ruecksetzen, Speicherfehler, Auth und Testbypass auf Desktop, iPad und
iPhone. Bestehende Standardfahrten-, Sprachen-, iPad- und Kopfzeilentests
bleiben Teil der Regression.

Baseline vor Drag-and-drop am 14.10.2026: 78 betroffene Browserpruefungen erfolgreich;
zusaetzlicher Lauf mit 24 Ressourcen-/Dashboard-/Layoutpruefungen erfolgreich.
Ein zwischenzeitlicher Dev-Chunk-Ladefehler bei parallelen Erstaufrufen wurde
mit begrenzter Parallelitaet reproduzierbar erfolgreich nachgeprueft. Veraltete
generierte Dev-CSS wurde verworfen; Darstellung und 16px-Blocktitel werden
explizit geprueft. SQL-Vollkette, Wiederholung, RLS, Backup-/Restore,
TypeScript, Produktionsbuild und `git diff --check` erfolgreich. Die neuen
Layout-Selektoren sind auch im Produktions-CSS vorhanden. Keine produktive
Migration, kein Commit und kein Push Bestandteil dieser lokalen Umsetzung.

Drag-and-drop-Zusatzpruefung: Maus- und Tastatursortierung fuer Menue und
Fahrzeugbloecke bei 1440, 820 und 390px in Chromium und WebKit; echte CDP-
Touchgesten bei 390 und 820px in Chromium erfolgreich. Die CDP-Tests werden
unter WebKit bewusst uebersprungen, Maus/Tastatur dort nicht. Abbruch per
Escape und Ablegen ausserhalb der Ziele schreiben nichts. Ein Speicherfehler
erhaelt die bestaetigte Anordnung; offene Standardfahrtenentwuerfe sperren
Ziehgriffe, Pfeile und Ruecksetzen. Reload und getrennte Bereichsspeicherung
sind abgedeckt. Screenshots fuer Desktop und Mobil wurden geprueft.
Betroffene Standardfahrten-, Sprachen- und iPad-Drehtests nachgeprueft.
Lokale Next-Dev-Chunk-Ladefehler beziehungsweise noch nicht abgeschlossene
Hydrierung fuehrten zu einzelnen Fehlstarts; Wiederholungen erfolgreich.
Reload-Pruefungen warten explizit auf App-Bereitschaft (wie der bestehende
Testhelfer maximal 30 Sekunden). Kein Auth-Bypass wurde erweitert.

ESLint fuer Drag-Komponente und Tests erfolgreich. npm audit meldet fuer die
vier neuen dnd-kit-Pakete keine Advisories. Es bleiben 16 Meldungen anderer,
unveraenderter Abhaengigkeiten (2 niedrig, 1 mittel, 12 hoch, 1 kritisch).
Kein pauschales audit fix und keine fachfremden Paketupdates ausgefuehrt.

## Freigabe 1.427.45

Auf ausdruecklichen Veroeffentlichungsauftrag am 14.10.2026 wurde die Migration
zuerst auf Staging und anschliessend produktiv angewendet und im Migrations-
journal registriert. Die SQL/RLS-Tests liefen auf Staging mit Rollback der
Testdaten. Produktiv wurden keine Testbenutzer oder Testeinstellungen angelegt.
Pruefsummen bestaetigen unveraenderte Bestandsdaten: 66 registrierte Tabellen
auf Staging, 72 in Produktion. RLS, eigene typisierte Spalten, kein Anon-Zugriff,
Invoker-RPC und Einbeziehung in Backups sind in beiden Umgebungen bestaetigt.
Security Advisor: jeweils 0 Fehler und unveraendert 7 Warnungen.
Der Produktionsbuild mit Versionsnummer 1.427.45, TypeScript, gezielte ESLint-
Pruefung und `git diff --check` sind erfolgreich. Die Browserpruefungen und
Nachpruefungen sind oben dokumentiert. Auslieferung erfolgt ueber `main`.
