# Fahrten: Laden und Datumsvorschlaege

- Die Schnellfahrt zeigt ihre Seite sofort. Positionen und die relationale
  Ressourcenprojektion werden parallel geladen; kein Gesamtbestand wird extra
  fuer diese Aktion geladen oder erneut auf alle App-Bereiche angewendet.
  Bis die aktuellen Daten vorliegen, bleiben Eingaben und Speicheraktionen
  gesperrt. Schliessen bleibt moeglich; erledigte alte Anfragen oeffnen nichts neu.
- Start und Aktualisierung verwenden jeweils einen gemeinsamen Bereichsabruf.
  Ein manuelles Aktualisieren wartet auf einen bereits laufenden Abgleich und
  fordert danach einen frischen Stand an. Fehler werden sichtbar gemeldet und
  nicht als Erfolg ausgegeben. Die bestehende datensatzbezogene Queue wird vor
  der Anzeige weiterhin ueber den Serverstand gelegt.
- Bei einer neuen Fahrt setzt die Datumswahl Startort, Startkoordinaten und
  Startstand aus der letzten abgeschlossenen Fahrt bis zum gewaehlten Tag.
  Innerhalb eines Tages zaehlt der hoechste Endstand. Geloeschte und laufende
  Fahrten sind keine abgeschlossenen Ausgangsfahrten. Vor der ersten bekannten
  Fahrt bleiben Startvorschlaege leer statt heutige Werte einzusetzen.
- Gibt es spaetere Fahrten, ist deren kleinster Startstand die obere Grenze
  fuer den Endstand. Dieser wird als Vorschlag eingetragen und mit "Maximal"
  markiert. Ein niedrigerer tatsaechlicher Endstand bleibt eingebbar.
  Ohne spaetere Fahrt gibt es keinen erfundenen Endstand. Bestehende oder aktive
  Fahrten behalten ihre erfassten Werte; reine Zeitwahl ersetzt keine Eingaben.
- Es werden nur vorhandene Fahrtendaten ausgewertet, keine neuen fachlichen
  Felder oder Datenbankstrukturen eingefuehrt.
- Fahrtenanzeige und Kilometerluecken verwenden dieselbe Tagesreihenfolge:
  Sind alle Startzeiten eines Fahrzeugs am Tag vorhanden und passend zum Datum,
  gilt die Uhrzeit. Fehlt eine passende Startzeit, entscheidet fuer diesen Tag
  der Start-/Endkilometerstand statt der internen Kennung. Gespeicherte Zeiten
  und Kilometerstaende werden nicht geaendert. Echte Luecken bleiben sichtbar.

## Tests

Normale Fahrten-/Datumsfaelle: `npx playwright test tests/drive-log-ux.spec.ts tests/trip-chronology-ui.spec.ts tests/standard-trips.spec.ts --workers=1`.

Online-Ablauf mit vollstaendig simulierten APIs:
`WORKCORE_TEST_ONLINE=1 CI=1 npx playwright test tests/online/drive-log-ux.spec.ts --workers=1`.
Dieser Lauf benoetigt seinen eigenen neu gestarteten Testserver, da er anders
als die Standardsuite die Online-Lesewege aktiviert. Kein Produktiv-Backend
wird fuer diese Testdaten angesprochen.
