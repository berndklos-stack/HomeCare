# Apple Erinnerungen fuer die Tagesmail

## Zugang in WorkCore

Als Inhaber unter Stammdaten > Tagesmail auf **iPhone verbinden** klicken.
URL, Mandantenkennung (`X-WorkCore-Tenant`) und den kopierten Authorization-Wert
nur in den eigenen Kurzbefehl eintragen. Der Zugang erlaubt ausschliesslich
die Uebertragung einer Erinnerungs-Momentaufnahme, keinen Zugriff auf Auftraege.
Er wird nur einmal angezeigt, serverseitig nur als SHA-256 gespeichert und kann
in WorkCore widerrufen werden. Keine Supabase-Schluessel oder Apple-Passwoerter verwenden.

Alle Listen bedeutet auch private Listen. Saemtliche uebertragene Titel, Notizen
und Listennamen koennen in der Mail an alle konfigurierten To-/CC-Empfaenger erscheinen.

## Fertige Vorlage importieren

Unter Stammdaten > Tagesmail **Kurzbefehl herunterladen** waehlen oder
[die signierte Vorlage oeffnen](https://homecare-xi.vercel.app/shortcuts/workcore-erinnerungen.shortcut).
Die heruntergeladene Datei auf dem iPhone in Kurzbefehle oeffnen und hinzufuegen.
Beim Import den Authorization-Wert inklusive `Bearer ` und die Mandantenkennung
aus WorkCore eintragen. Falls iOS keine Einrichtungsfragen zeigt, die ersten
beiden Textaktionen bearbeiten. Die oeffentliche Vorlage enthaelt keine Zugangsdaten.

Einmal manuell ausfuehren, den Zugriff auf Erinnerungen und die Verbindung zu
WorkCore erlauben. Danach in WorkCore den Abrufstatus aktualisieren und Anzahl
pruefen. Der native Lauf auf dem eigenen iPhone ist der abschliessende Funktionstest;
die Apple-Signierung allein bestaetigt nicht die Ausfuehrung auf jeder iOS-Version.
Erst danach die unten beschriebene taegliche Automation anlegen.

Die Datei wird aus `scripts/build-apple-reminders-shortcut.mjs` erzeugt.
Auf macOS mit `node scripts/build-apple-reminders-shortcut.mjs` neu erzeugen und
ueber Apples Signierdienst signieren (Netzwerk erforderlich). Die lesbare
Workflow-Definition liegt unter `docs/shortcuts/workcore-erinnerungen.workflow.json`.
Keine persoenlichen Zugaenge in diese Dateien eintragen.

Die Vorlage wird vor der Signierung mit Apples WorkflowKit deserialisiert und
wieder serialisiert, ohne sie auszufuehren. Leere Arrays muessen im nativen
`WFArrayParameterState` als `Value: []` vorliegen. Ein Woerterbuch an dieser Stelle
kann Kurzbefehle beim Bearbeiten einer beliebigen Aktion zum Absturz bringen.
Nach einem Download der ersten fehlerhaften Vorlage die alte Kopie ersetzen;
die neue Datei erneut herunterladen, nicht nur die Eingaben wiederholen.
Auch die sieben Wenn-Eingaben werden mit Apples nativer Bibliothek geprueft:
Sie brauchen eine zusaetzliche `Type: Variable`-Huelle um den Variablenbezug.
Ein nackter `WFTextTokenAttachment` wird hier als leere Bedingung gelesen,
obwohl er als Eingabe anderer Aktionen gueltig ist.
Das Wertefeld von "Woerterbuchwert konfigurieren" verwendet dagegen einen
`WFTextTokenString` mit genau einer Inhaltsvariable. Ein direkter
`WFTextTokenAttachment` wird dort als fehlender Wert gelesen. Die native Pruefung
verifiziert auch, dass Testlisten mit 0, 1 und 5 Woerterbuechern ihre Inhaltstypen
und Werte behalten; sie liest keine Apple-Erinnerungen und sendet nichts.

## Manuelle Alternative

Die Bezeichnungen einzelner Aktionen unterscheiden sich je nach iOS-Version.

1. Kurzbefehle > neuer Kurzbefehl, Name **WorkCore Erinnerungen senden**.
2. Aktion **Erinnerungen suchen**: Filter **Ist abgeschlossen = Nein**.
   Keine Einschraenkung auf eine Liste, kein Ergebnislimit. Nicht nach Faelligkeit
   filtern: Auch Erinnerungen ohne Datum oder mit spaeterem Datum uebertragen.
3. Aktion **Mit jedem wiederholen** fuer die gefundenen Erinnerungen.
4. Innerhalb der Wiederholung Details der aktuellen Erinnerung lesen:
   Titel, Liste (deren Namen als Text), Notizen und Faelligkeitsdatum.
5. Wenn ein Faelligkeitsdatum vorhanden ist: **Datum formatieren**, Format
   **Benutzerdefiniert**, `yyyy-MM-dd`. Ohne Datum einen leeren Text verwenden.
6. Pro Erinnerung ein **Woerterbuch** mit vier Textfeldern erstellen:
   `title` = Titel, `list` = Listenname, `notes` = Notizen oder leer,
   `date` = formatiertes Datum oder leer. Das Woerterbuch als letztes Ergebnis
   der Wiederholung verwenden. Nicht manuell JSON-Text zusammenbauen.
7. Nach der Wiederholung **Aktuelles Datum** > **Datum formatieren** mit
   **ISO 8601**, inklusive Uhrzeit und Zeitzone. Als `generatedAt` merken.
8. Ein weiteres **Woerterbuch** anlegen:
   `generatedAt` (Text) = ISO-Zeit; `reminders` (Array) = Wiederholungsergebnisse.
   Falls keine offenen Erinnerungen gefunden wurden, hier explizit ein leeres
   Array einsetzen. Diese leere Momentaufnahme entfernt alte Erinnerungen aus
   WorkCore, nicht aus Apple.
9. **Inhalt von URL abrufen**, URL aus WorkCore, Methode **PUT**:
   Header `Authorization` = kopierter Wert inklusive `Bearer `,
   Header `X-WorkCore-Tenant` = Mandantenkennung,
   Header `Content-Type` = `application/json`.
   Anfragetext **JSON**, die zwei Felder aus Schritt 8 einsetzen
   (`reminders` muss ein Array von Woerterbuechern bleiben, kein Text).
10. Antwort pruefen: `accepted: true` und `count`. Bei einer Fehlerantwort
    keine Erfolgsmeldung anzeigen. Den ersten Lauf manuell starten und den
    Zugriff auf Erinnerungen sowie die Netzwerkverbindung erlauben.
11. In WorkCore den Abrufstatus aktualisieren und Anzahl/Datum kontrollieren.

Beispiel des Anfragetexts (keine echten Daten):

```json
{
  "generatedAt": "2026-10-07T05:45:00+02:00",
  "reminders": [
    { "title": "Material bestellen", "list": "Arbeit", "date": "2026-10-07", "notes": "" },
    { "title": "Rueckruf", "list": "Privat", "date": "", "notes": "" }
  ]
}
```

## Automatisch vor der Tagesmail

Auf diesem iPhone eine persoenliche Automation **Tageszeit**, taeglich **05:45**
anlegen und den Kurzbefehl ausfuehren. Bei Tagesmail um 06:00 ist so etwas
Zeitreserve vorhanden. **Sofort ausfuehren** bzw. **Vor Ausfuehren bestaetigen**
ausschalten, je nach iOS. Falls angeboten Ausfuehrung bei Sperre erlauben.

Mit gesperrtem Bildschirm testen. iPhone muss eingeschaltet und online sein;
Ausfuehrung und Freigaben koennen von iOS abhaengen. Keine Ausfuehrungsgarantie.
Die Automation ist geraetespezifisch, der Mac muss nicht laufen.

## Darstellung und Grenzen

- Mail zeigt offene Eintraege bis fuenf Tage voraus, ueberfaellige und undatierte
  Eintraege. Spaeter faellige Eintraege bleiben gespeichert bis sie relevant sind.
- Jede Uebertragung ersetzt nur die vorherige Integration-Momentaufnahme.
  Sie aendert keine Auftraege und hakt keine Apple-Erinnerung ab.
- Wiederholung derselben Uebertragung erzeugt keine Duplikate. Aeltere
  Momentaufnahmen ueberschreiben keinen neueren Stand.
- Maximal 2000 Eintraege und 1 MB pro Uebertragung. Momentaufnahme beim Senden
  maximal 15 Minuten alt. Bei Ueberschreitung wird nichts teilweise gespeichert.
- Mail nennt den letzten Empfang; bei mehr als 26 Stunden Alter mit Warnung.
  Ausbleibende Uebertragung ist nicht gleichbedeutend mit leerer Erinnerungsliste.
- Noch vorhandene ICS-Aufgabenquellen werden weiterhin separat gelesen. Dieselbe
  Liste nicht gleichzeitig per ICS und Kurzbefehl anbinden, sonst doppelte Anzeige.
- Der Zugang laeuft bis zum Widerruf; Kurzbefehle mit Zugang nicht teilen.
