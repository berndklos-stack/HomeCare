# Firmenlogo in der Hauptnavigation

Release: 1.428.1, 15.10.2026.

- Die linke Hauptnavigation verwendet das Logo aus Stammdaten > Firma.
  Ohne ladbares Logo wird ausschliesslich der Name dieser Firma angezeigt.
- Upload, Vorschau und Entfernen sind Bestandteil der Firmenstammdaten.
  Die Navigation aendert sich erst nach dem Speichern, nicht schon bei der Dateiauswahl.
- PNG, JPEG, WebP und GIF bis 10 MB werden lokal zu einer verkleinerten PNG-Datei
  verarbeitet; Transparenz bleibt erhalten. Gespeicherte Bilddaten sind auf
  1.500.000 Zeichen begrenzt. Unsichere Bildquellen werden abgelehnt.
- Massgeblich ist die eigene Textspalte `homecare_settings.logo_url` in der
  mandantengebundenen Zeile `companySettings`. Das bisherige JSON-Feld ist eine
  Kompatibilitaetsprojektion. Trigger und Synchronisationsrevision verhindern,
  dass alte Clients oder wiederholte Mutationen das Logo unbeabsichtigt entfernen.
- Die Migration erhaelt vorhandene Werte, Revisionen und Zeitstempel. Nicht
  unterstuetzte Altwerte stoppen die Migration und erfordern eine Pruefung.
- Bestehende RLS und Grants bleiben unveraendert. Der neue Trigger laeuft als
  Invoker, ist nicht direkt fuer anonyme oder authentifizierte Clients aufrufbar
  und verwendet einen festen Suchpfad. Das relationale Backup umfasst die Spalte.
- Andere Logos in Dokumenten und Kundenportal sind nicht Teil dieser Aenderung.

## SVG-Import

Statische SVG-Dateien bis 2 MB werden vor dem Rendern als XML geprueft und
zusaetzlich mit DOMPurify bereinigt. Skripte, Ereignisattribute, eingebettetes
HTML, externe Bilder/Verweise, CSS-Imports und verschleierte CSS-URLs werden
abgewiesen. Lokale Fragmentverweise, Formen, Texte und einfache Styles bleiben
moeglich. SVG-Abmessungen werden vor dem Dekodieren auf maximal 900 Pixel
begrenzt; eine reine viewBox-Datei wird ebenfalls unterstuetzt.

Nur das daraus lokal erzeugte transparente PNG wird in der bestehenden
Logospalte gespeichert. SVG-Quelltext wird weder in die Seite eingefuegt noch
in der Datenbank abgelegt. Bestehende Bildquellenpruefung, Mandantenschutz,
Schreibwege und Entfernen bleiben unveraendert; keine neue Spalte erforderlich.
Browsertests pruefen PNG-Format, sichtbare Farbpixel, Transparenz, Neuladen und
Ablehnung aktiver/externer Inhalte ohne Netzabruf in Chromium und WebKit.

Die Navigation prueft nach dem Laden die alpha-gewichtete Helligkeit des
Logos auf einer kleinen Canvas. Dunkle, transparente monochrome Logos werden
auf dem in beiden Themes dunklen Menue invertiert, ohne zusaetzlichen Kasten.
Farbige dunkle Logos erhalten einen weissen Hintergrund, helle Logos bleiben
unveraendert auf dem dunklen Menue. Die Bilddaten werden dabei nicht
veraendert. Bei externen Bildern ohne CORS bleibt die bisherige Darstellung
erhalten, ohne den Upload oder die Bildanzeige zu blockieren.

## Pruefungen

- Vollstaendige lokale SQL-Migrationskette mit Altwertuebernahme, RLS,
  Revisionskonflikten, Replay, Nullwerten und Backup/Wiederherstellung bestanden.
- 34 Browser-/Auth-Tests bestanden, einschliesslich Chromium und WebKit,
  iPhone, iPad-Drehung, Upload, Entfernen, Neuladen und defektem Bild.
- TypeScript im Produktionsbuild, Produktionsbuild, gezieltes ESLint und
  `git diff --check` erfolgreich.
- Staging: `/private/tmp/workcore-company-logo-staging-DoQlsP/verification.json`.
  SQL/RLS bestanden; Bestandsdaten unveraendert; 0 Sicherheitsfehler, 8 Warnungen
  ohne zusaetzliche Meldungen.
- `scripts/verify-company-logo.mjs` erfordert vor Produktion einen passenden
  Staging-Digest, erstellt gepruefte serverseitige Firmensicherungen und prueft
  alte Einstellungen innerhalb der Migrationstransaktion auf Unveraendertheit.
- Produktion: `/private/tmp/workcore-company-logo-production-i5ck9H/verification.json`.
  Migration angewendet, zwei serverseitige Firmensicherungen mit gepruefter
  Pruefsumme, bisherige Einstellungen unveraendert. RLS aktiv, kein anonymer
  Zugriff, alle drei Einstellungstrigger aktiv; weiterhin 0 Fehler und 8 Warnungen.
