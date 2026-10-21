# Zeiterfassung und Urlaub

Vorlage sind die fachlichen Ablaeufe aus `Farmmanger` (`driverTimeEntries.ts`,
`vacationRequests.ts`, Fahreransicht und Personalverwaltung), nicht dessen
Demo-Berechtigungen oder lokale Sammelspeicherung.

## Funktionsumfang

- Stammdaten > Personal > Zeiterfassung; Schnellbutton neben Fahrt zum Stempeln.
- Kein eigener Hauptmenuepunkt. Die alte interne Layoutkennung bleibt fuer
  gespeicherte Reihenfolgen kompatibel, wird aber nicht mehr angezeigt.
- Arbeit, Pause, Unterbrechung; Wechsel und Beenden atomar mit Serverzeit.
- Nachtragen, Korrigieren, Loeschen nicht freigegebener Zeiten; keine Ueberschneidungen.
- Monatsuebersicht, monatsanteilige Summen und Excel-Export.
  Wie in der Vorlage zaehlen Unterbrechungen zur Arbeitszeit, Pausen nicht.
- Tages- und Monatsbericht je Mitarbeiter sowie Personal-Monatsbericht fuer
  Firmenadministratoren: Zeiten, Freigabestatus, Arbeitszeit, Pausen,
  Unterbrechungen, Urlaub und verfuegbares Jahreskonto. Laufende Zeiten werden
  angezeigt, aber nicht summiert. Tages-/Monatsgrenzen werden lokal abgeschnitten.
- Druckvorschau (Drucken / als PDF sichern), Excel mit getrennten Blaettern fuer
  Uebersicht, Zeiten und Urlaub, E-Mail-/SMS-Entwurf und Teilen ueber das Betriebssystem.
  Kein automatischer Mailversand. Ausgabeinhalte werden HTML-maskiert.
- Der Sammelbericht liest ausschliesslich den authentifizierten Mandanten und
  erfordert serverseitig tenant.admin. Mitarbeiter behalten ihren eigenen Bereich.
- Firmenadministratoren koennen Zeiten freigeben/sperren und entsperren.
- Urlaubsantrag, Genehmigung, Ablehnung und Stornierung mit separatem Ereignisverlauf.
- Jahreskonto je Mitarbeiter: Anspruch, Uebertrag und bereits ausserhalb erfasste Tage.
- Genehmigte Antraege werden vom Konto abgezogen; offene Antraege separat angezeigt.
- Keine gesetzliche oder tarifliche Urlaubsregel wird automatisch angenommen.
  Der Vorschlag zaehlt Montag bis Freitag, die beantragten Tage sind editierbar,
  einschliesslich halber Tage. Feiertage werden nicht automatisch abgezogen.
  Jahresuebergreifende Antraege sind je Kalenderjahr aufzuteilen.
- Keine automatische Uebernahme in die Rechnungsstellung und keine Doppelung
  bestehender Auftragszeiten. Arbeitszeit und Kundenabrechnung bleiben getrennt.

## Sicherheit und Speicherung

Migration: `20261021100000_staff_time_and_leave.sql`.
Alle fachlichen Felder liegen in typisierten Spalten von
`homecare_staff_time_entries`, `homecare_staff_leave_requests`,
`homecare_staff_leave_balances` und `homecare_staff_leave_events`.
`homecare_staff_mutations` ist das technische Idempotenzjournal.
Alle fuenf Tabellen werden in den relationalen Sicherungen beruecksichtigt.
Die Dauer wird aus Beginn und Ende durch einen Trigger berechnet, damit die
vorhandene generische Wiederherstellung auch fuer diese Tabelle funktioniert.

RLS ist fuer alle Tabellen aktiv. Anon hat keine Rechte. Authenticated hat nur
Leserechte: aktive Mitgliedschaft, aktiviertes Modul `time_tracking`, angeforderter
Mandant und entweder `tenant.admin` oder die eigene `employee_id`-Zuordnung.
Auf dem technischen Journal bestehen keine Clientrechte.
Schreiben erfolgt nur ueber den Service-RPC `homecare_staff_command`, der diese
Pruefungen eigenstaendig wiederholt. Client-EXECUTE ist entzogen.

Mitarbeiterzuordnung: Administration > Benutzer > Mitarbeiter.
Firmenadministratoren waehlen beim Fehlen einer eigenen Zuordnung bewusst einen
Mitarbeiter aus. Es wird nicht automatisch fuer den ersten Mitarbeiter gestempelt.
Freigaben und Kontoeinstellungen erfordern `tenant.admin`.
Vorgaenge pro Mitarbeiter werden serialisiert, Entwuerfe per Revision geschuetzt;
Stempelaktionen pruefen die Identitaet und Revision der laufenden Zeit.
Wiederholte identische Requests mit derselben Vorgangskennung sind idempotent.

Die Oberflaeche speichert unmittelbar online. Bei Fehlern bleiben Formulare offen;
es wird kein erfolgreicher Offline-Abgleich vorgetaeuscht.

## Weitere Navigation

System / Branding liegt nun unter Administration. Die vorhandenen fuenf Markenfelder
werden mandantengebunden mit CAS gespeichert. Andere Firmenwerte und die native
Logospalte werden nicht ersetzt. Keine neuen Brandingfelder oder Schemaaenderungen.
Der Einrichtungsassistent bleibt ueber den bestehenden Dashboard-Einstieg erreichbar.
Ressourcentypen liegen als Unterreiter in Stammdaten > Ressourcen.

## Pruefung und Release

`node scripts/test-operations-database.mjs --full-chain --skip-migration=20261020160000`
prueft die veroeffentlichte Kette mit dem neuen Modul, ohne die unabhaengige,
noch unfertige Startpasswortmigration anzuwenden.
Die produktive Migration und Veroeffentlichung sind davon getrennte Schritte.
Vor einem Release muessen Staging, Sicherung und Migrationsstand geprueft werden;
die unfertige Passwortmigration darf nicht versehentlich mit ausgerollt werden.
