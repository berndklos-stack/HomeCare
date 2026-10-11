# Projektvorgaben

- Immer auf Deutsch antworten.
- Verbindliche Vorgabe ab 2026-10-11: Jedes neu eingefuehrte fachliche Feld muss eine eigene, passend typisierte Spalte in der zustaendigen Datenbanktabelle erhalten. Die Spalte ist durch eine versionierte Datenbankmigration anzulegen.
- Neue Felder nicht ausschliesslich als Schluessel in `record_data`, `custom_fields`, `metadata` oder anderen Sammelfeldern speichern.
- Bei neuen Feldern die Schreibwege, Lesemappings, Synchronisierung, Validierung und relevanten Tests gemeinsam aktualisieren. Die eigene Datenbankspalte ist die massgebliche Datenquelle.
- Bestehende Sammelfeldwerte bei einer Ueberfuehrung erhalten und widerspruechliche Werte nicht ungeprueft ueberschreiben.
