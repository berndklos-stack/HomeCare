# Persoenliche Blockanordnung per langem Druecken

Die direkte Ziehbedienung ohne sichtbare Pfeile/Griffe ist fuer Release
1.427.48 vorbereitet und geprueft. Datenbank und persoenliche Reihenfolgen
bleiben unveraendert; keine zusaetzliche Migration erforderlich.

## Bedienung

Es gibt keinen Einstiegsknopf Anordnen mehr. Etwa 500 ms Halten auf einem
Menuepunkt, einer Bereichsueberschrift, einer freigegebenen Uebersichtskarte
oder neutralem Blockhintergrund hebt den Bereich direkt zum Ziehen an. Bewegung vor
der Haltefrist bricht die Aktivierung ab, sodass normales Scrollen erhalten
bleibt. Kurzes Tippen navigiert oder oeffnet wie bisher.

Ohne Loslassen direkt zur Zielposition ziehen und dort loslassen. Die Zeile
behaelt dabei ihre Groesse und wirkt durch Schatten angehoben. Es erscheinen
keine sichtbaren Ziehgriffe, Auf-/Ab-Pfeile, doppelten Titel oder Fertig-Buttons.
Loslassen beendet das Ziehen automatisch und speichert die Position.
Eine gestrichelte Umrandung kennzeichnet das Ablageziel. Escape bricht ab.
Ein per Tab erreichbarer, nur fuer Tastatur und Screenreader vorgesehener
Sortierfokus ermoeglicht weiterhin Leertaste/Pfeiltasten/Leertaste. Die
Fokusanzeige umrahmt die zugehoerige Zeile, ohne Platz zu beanspruchen.
Auch die Speicheranzeige aendert keine Zeilenhoehen; Fehler bleiben mit
erneuter Lademoeglichkeit sichtbar. Kein dauerhaft eingeschalteter Modus.

Inputs, Textfelder, Auswahllisten, Tabellen und fachliche Aktionsbuttons
aktivieren kein Verschieben. Nur ausdruecklich freigegebene Navigationskarten
sind auch als ganzer Button per Halten verschiebbar. Fachliche Zeilen,
Scan-/Assistentenschritte und Dokumentvorschauen bleiben unveraendert.

## Bereiche

- Hauptnavigation und Fahrzeugbloecke nutzen ihre vorhandenen persoenlichen
  Reihenfolgen weiter; gespeicherte Werte bleiben erhalten.
- Dashboard: Kennzahlen, Arbeitsuebersicht, Navigationskarten, Einsatzliste,
  Erste Schritte und Hinweise.
- Auswertung: Kennzahlen und Kunden-/Objekt-/Personalbereiche.
- Positionen: Zusammenfassung, Karte und Fahrzeugliste.
- Stammdaten: Leistungen und Pakete.
- Objekt-, Kunden- und Auftragsformulare: vollstaendige zusammengehoerige
  Gruppen, keine isolierte Verschiebung einzelner Felder.
- Lager und Einkauf: Bestandsauswahl/Bestandsdetails und Bestellungen/Lieferungen.

Ein Bereich kann nur innerhalb seiner eigenen Gruppe verschoben werden.
Ueberschriften und Bedienaktionen der Seite bleiben ihrer Funktion zugeordnet.
Leere Hinweise werden nicht als leere Karte angezeigt. Gespeicherte Positionen
momentan ausgeblendeter Gruppen bleiben beim Sortieren sichtbarer Gruppen
erhalten. Laufende Formulare behalten ihre React-Keys und Eingaben; offener
Standardfahrtenentwurf sperrt weiterhin die zugehoerige Fahrzeuganordnung.

## Direkte Ziehbedienung: Verifikation

- 33 Sortier-/Layouttests in Chromium und WebKit erfolgreich; drei CDP-Tests
  unter WebKit erwartungsgemaess uebersprungen, in Chromium erfolgreich.
- Echte Touchgesten verschieben Hauptmenue und Fahrzeugbloecke bei 390/820 px.
  Normales Scrollen vor der Haltefrist startet kein Ziehen; kurze Klicks nach
  dem Ablegen funktionieren sofort wieder. Kein Bestaetigungsbutton notwendig.
- Tests messen unveraenderte Breite/Hoehe waehrend des Haltens und pruefen,
  dass weder Pfeile noch zusaetzliche sichtbare Griffe erscheinen.
- Tastatursteuerung, Escape, Ablegen ausserhalb, fehlgeschlagenes Speichern,
  bestaetigte Reihenfolgen nach Reload und gesperrte Entwuerfe geprueft.
  Bei unterschiedlich hohen Bloecken darf die alte Position das per Tastatur
  angesteuerte Ziel nicht verdecken; die Zielerkennung beruecksichtigt dies.
- 24 zusaetzliche Vor-Ort-Eingabe-/iPad-/Layout-Grenztests erfolgreich.
- Desktop- und iPhone-Screenshots waehrend des Haltens visuell geprueft.
- TypeScript, Produktionsbuild, gezieltes ESLint und `git diff --check`
  erfolgreich.
- Keine Migration und keine Aenderung der vorhandenen Daten oder Schreibrechte.

## Speicherung

Versionierte Migration: `20261014150000_personal_block_layouts.sql`.
Eigene Tabelle `homecare_user_block_layouts` mit typisierten Spalten
`tenant_id uuid`, `user_id uuid`, `scope_key text`, `block_order text[]`.
Keine fachlichen Werte oder Anordnungen in Sammel-JSON speichern.

Ein Datensatz pro Benutzer, Mandant und UI-Gruppe. RLS verlangt eigene
Benutzer-ID, ausgewaehlten Mandanten und aktive Mitgliedschaft. Authentifizierte
Benutzer haben SELECT/INSERT/UPDATE fuer eigene Zeilen, kein DELETE. Anon hat
keinen Tabellen-/RPC-Zugriff. Invoker-RPC mit festem search_path und begrenzten,
eindeutigen ASCII-IDs; maximal 64 Eintraege, keine NULLs oder mehrdimensionalen
Arrays. Fremde Eigentuemerschluessel oder Mandanten sind nicht schreibbar.

GET/PATCH `/api/block-layouts` verwenden die validierte Sitzung, keine
frei waehlbare Benutzer-ID. API und Hook projizieren die eigenen typisierten
Zeilen auf UI-Reihenfolgen. Private, nicht cachebare Antworten; kein lokaler,
benutzeruebergreifender Einstellungscache. Erst bestaetigte Serverantworten
aendern die sichtbare Anordnung. Fehler behalten bestaetigte Werte, auch beim
erneuten Laden. Lokaler E2E-Bypass liest nur Defaults und schreibt nie real.

Die Tabelle ist im relationalen Backup-/Restore-Register enthalten.
Migration vor Auslieferung des Anwendungscodes anwenden. Migration
`20261014150000` wurde am 15.10.2026 zuerst auf Staging und anschliessend
auf Produktion angewendet und in der Migrationshistorie bestaetigt.

## Pruefung

`node scripts/test-operations-database.mjs --full-chain` prueft Migration,
Wiederholbarkeit, RLS, Fremdbenutzer/-mandanten, Anon, ungueltige Arrays,
getrennte Gruppen und Backup-/Restore-Rundlauf.

`block-layouts.spec.ts` und `personal-layout.spec.ts` pruefen langes Druecken,
kurzes Tippen, Speicherfehler, Reload, Formulareingaben, versteckte Positionen,
Maus/Tastatur und echte CDP-Touchgesten inklusive Scroll-Abbruch. CDP-Tests
werden in WebKit uebersprungen; normale Browserpruefungen laufen dort weiter.
Auf dem iPhone muss ein Zielpunkt im sichtbaren Bereich unterhalb der
feststehenden Kopfzeile liegen. Tests warten auf die sichtbare Zielmarkierung
und das Ende der Positionsanimation, bevor sie loslassen oder Screenshots
aufnehmen. Layout-/Lager-/Fahrzeug-/Dashboard-Regressionen bleiben enthalten.

### Verifikation am 15.10.2026

- Vollstaendiger lokaler SQL-/RLS-Migrationslauf inklusive Wiederholung und
  Backup-/Restore-Rundlauf erfolgreich.
- Breiter Browserlauf: 167 bestanden, 3 erwartete CDP-WebKit-Skips. Alle
  8 dabei fehlgeschlagenen Tests bestanden im gezielten Nachlauf. Alte
  Strukturselektoren und eine veraltete Konfliktfixture wurden angepasst;
  lokale Dev-Server-Ladefehler waren im Nachlauf nicht reproduzierbar.
- Abschliessender Layoutlauf: 38 bestanden, 3 CDP-WebKit-Skips und ein
  Desktop-Haltetest fehlgeschlagen. Nach Warten auf die stabile,
  erreichbare Schaltflaeche per Playwright-Hover bestand auch dieser Nachlauf.
  Touchgesten auf 390/820 px, Tastatur, Formularentwuerfe, Reload und
  Speicher-/Ladefehler sind abgedeckt.
- Desktop- und iPhone-Screenshots visuell geprueft.
- `npx tsc --noEmit` erfolgreich; `git diff --check` erfolgreich.
- `npm run build` erfolgreich, einschliesslich Produktions-TypeScript und
  aller 38 statischen Seiten/API-Eintraege.
- ESLint fuer die weiteren geaenderten TypeScript-/Testdateien erfolgreich.
  `app/page.tsx` hat weiterhin dieselben 12 Fehler und 28 Warnungen wie HEAD
  (Regeln, Schweregrade und Meldungstypen verglichen, nur Zeilen verschoben).
  Keine neuen Lint-Meldungen; bestehende fachfremde Stellen nicht veraendert.

### Freigabe 1.427.46

- Erneuter Produktionsbuild mit Versionsnummer 1.427.46 erfolgreich.
- `scripts/verify-personal-block-layouts.mjs` prueft Projektidentitaet,
  Migrations-/Test-Digests, Bestandsdaten, typisierte Spalten, Policies,
  Rechte, Backup-Register und Security Advisor vor/nach der Migration.
- Staging: RLS-Regressionen erfolgreich, alle 67 registrierten
  Bestandstabellen unveraendert. Security Advisor: 0 Fehler, 7 bestehende
  Warnungen vor und nach Anwendung.
- Produktion: identische auf Staging gepruefte Migration angewendet;
  alle 73 registrierten Bestandstabellen unveraendert. RLS aktiv,
  drei eigene SELECT-/INSERT-/UPDATE-Policies, kein Anon-Tabellen-/RPC-Zugriff,
  kein Client-DELETE, Invoker-RPC und Backup-Registrierung bestaetigt.
  Security Advisor: 0 Fehler, 7 bestehende Warnungen, keine neuen.
- Produktive Tests mit kuenstlichen Benutzer-/Mandantendaten wurden bewusst
  nicht ausgefuehrt; diese Regressionen liefen auf Staging und lokal.
- Bestehende lokale Fremddateien wurden nicht veraendert oder aufgenommen.
