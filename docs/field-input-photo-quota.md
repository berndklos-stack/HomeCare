# Vor-Ort-Eingaben bei wartenden Fotodrafts

## Fehler und Korrektur

`persistFieldProgressRelational` erzwang bei jeder Fortschrittsaenderung einen
vollstaendigen Fotodraft-Schreibvorgang, sobald irgendwo ein noch nicht
hochgeladenes Data-URL-Foto vorhanden war. Ein `QuotaExceededError` brach den
Handler vor dem Zustandsupdate ab: aktive Checkboxen blieben unveraendert und
kontrollierte Hinweisfelder nahmen keinen Text an.

`needsProgressPhotoDraftWrite` verlangt diesen verpflichtenden Schreibvorgang
nur fuer tatsaechlich geaenderte lokale Fotolisten. Unveraenderte Fotodaten
blockieren keine Haken, Zeiten oder Hinweise. Diese Aenderungen bleiben ueber
die kompakte relationale Sync-Queue dauerhaft gesichert, auch wenn der grosse
Lesecache nicht aktualisiert werden kann. Die normale Quota-Warnung bleibt
sichtbar. Neue oder geaenderte lokale Fotodaten werden weiterhin vor Annahme
gesichert; keine Queue-, Foto- oder Entwurfsdaten werden geloescht.

Keine neuen fachlichen Felder und keine Datenbankmigration erforderlich.

## Nachweis

- Safari/iPhone-Test mit bereits gespeichertem wartendem Foto und simuliertem
  Fotocache-Speicherfehler scheiterte vor der Korrektur unmittelbar beim Anhaken
  mit einem unbehandelten `QuotaExceededError`; nach der Korrektur erfolgreich.
- `field-inputs.spec.ts`: echtes Tippen, Checkbox, Zeit, Text und Reload fuer
  390/820 px, ein-/mehrtaegige Auftraege, mit/ohne Fotocache-Speicherfehler.
- 62 Eingabe-, Foto-, Sync-Konflikt- und Auftragsregressionen geprueft:
  60 im ersten Lauf erfolgreich; zwei lokale Seitenladeabbrueche in Chromium
  anschliessend ohne Sourceaenderung im Einzel-Nachlauf erfolgreich.
- Neue/geaenderte Fotodrafts, Offline-Replay, Fotoaufnahme, private Referenzen,
  Upload-Retry und Pflichtsicherung bei Speicherfehlern weiterhin abgedeckt.
- TypeScript, Produktionsbuild, gezieltes ESLint und `git diff --check`
  erfolgreich.

Der konkrete Speicherzustand des betroffenen Endgeraets konnte nicht direkt
ausgelesen werden; der beschriebene Eingabefehler ist unter dieser Bedingung
reproduziert und korrigiert.
