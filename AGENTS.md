# Projektvorgaben

- Immer auf Deutsch antworten.
- Verbindliche Vorgabe ab 2026-10-11: Jedes neu eingefuehrte fachliche Feld muss eine eigene, passend typisierte Spalte in der zustaendigen Datenbanktabelle erhalten. Die Spalte ist durch eine versionierte Datenbankmigration anzulegen.
- Neue Felder nicht ausschliesslich als Schluessel in `record_data`, `custom_fields`, `metadata` oder anderen Sammelfeldern speichern.
- Bei neuen Feldern die Schreibwege, Lesemappings, Synchronisierung, Validierung und relevanten Tests gemeinsam aktualisieren. Die eigene Datenbankspalte ist die massgebliche Datenquelle.
- Bestehende Sammelfeldwerte bei einer Ueberfuehrung erhalten und widerspruechliche Werte nicht ungeprueft ueberschreiben.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
