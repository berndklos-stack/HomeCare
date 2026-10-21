# Version 1.428.10

## Umfang

- Projekt-/Objektbilder laden bei abgelaufenen Links über den authentifizierten
  dauerhaften Speicherpfad nach. Legacy-Pfade verwenden den geschützten
  Private-Media-Endpunkt. Keine neuen öffentlichen Storagefreigaben.
- Firmenlogo aus den aktuellen mandantengebundenen Stammdaten oben rechts in
  erzeugten PDF-Berichten, Druckberichten und Excel-Berichten. PDF-Logos werden
  auf jeder Seite eingebettet; Originalbelege werden nicht verändert.
- Administration: Firmen, System / Branding, Rollen, Module. Benutzer und
  Kontoeinstellungen direkt bei der Firma; keine Pilot/Test-Hauptansicht.
- Firmenbenutzerzugriffe über explizite Plattform-Allowlist und service-exklusive
  RPCs. Heimatfirma, tatsächlicher Akteur und Zielmandant bleiben getrennt.

## Prüfungen

- Vollständige lokale Migrations-/SQL-/RLS-Kette einschließlich neuer
  Firmenbenutzerprüfungen erfolgreich.
- Stagingmigration und transaktionale SQL-Tests erfolgreich; Bestandsdaten
  unverändert. Security Advisor vorher/nachher: 0 Fehler, 8 Warnungen.
- Abschließender vollständiger Browser-/Sicherheitslauf in Chromium und
  Safari/WebKit: alle 120 Prüfungen erfolgreich. Zwei vorhandene
  Ausrichtungsprüfungen prüfen jetzt die von CSS vorgegebene vertikale Zentrierung
  statt identischer Oberkanten.
- Bilder mit abgelaufenen Links und reine Speicherpfad-Bilder auf iPhone-Größe;
  authentifizierte Abrufe, begrenzte Fehlerwiederholung und PDF-Bildeinbettung geprüft.
- Firmenlogo im Druckbericht sowie tatsächliche PNG-Einbettung in allen drei
  Excel-Blättern geprüft, nicht nur Dateiname oder Download.
- Gezieltes ESLint der neuen/geänderten Hilfsmodule, Verwaltungs-, Test- und
  Release-Dateien ohne Fehler/Warnungen. Globales ESLint ist wegen vorhandener
  Altfehler nicht grün. Gegenvergleich für `app/page.tsx`: vorher 12 Fehler,
  nachher 11; keine neue Fehlerklasse. Unabhängige Altfehler bleiben unberührt.
- TypeScript und Produktionsbuild erfolgreich. `git diff --check` sauber.

## Veröffentlichung

Nur die geprüften Dateien veröffentlichen. Die separat begonnenen Änderungen an
`apiAuth.ts`, `accountSecurity.ts`, der Passwortmigration `20261020160000` und dem
zugehörigen Bootstrap sind ausdrücklich nicht Teil dieses Releases.

Die Produktionsmigration enthält keine Datenkorrektur und verändert keine
bestehenden Geschäftsdatensätze. Anwendung erst nach Stagingnachweis und
Produktionsbuild; vor Anwendung werden Sicherungen und Bestandsfingerprints
geprüft. App anschließend ausschließlich aus dem exakten Git-Commit deployen.

Stagingnachweis: `/private/tmp/workcore-company-members-staging-aYySTf/verification.json`.
Produktionsnachweis: `/private/tmp/workcore-company-members-production-o4qwTE/verification.json`.
Zwei serverseitige Firmensicherungen mit gültiger Prüfsumme; Bestandsdaten unverändert.
Bei einem ersten Timeout wurde vor Wiederholung geprüft, dass keine Sicherungsabfrage
mehr lief und die Migration noch nicht gestartet war. Der Release-Prüfer verwendet
bereits abgeschlossene aktuelle Sicherungen bei Wiederholung erneut.
