# Zentrale Firmenverwaltung und Stammdatenlayout

## Bedienung

- Stammdaten verwenden die runden Reiter, Farben und kompakte Typografie der
  Lagerverwaltung. Inhaltsbereiche sind ohne schwebende Kartenrahmen gegliedert.
  Formulare, Speichern, Vorlagen und persoenliche Blockreihenfolgen bleiben erhalten.
- Administration > Firmen steht ausschliesslich freigeschalteten
  Plattformadministratoren zur Verfuegung. Die Uebersicht umfasst alle Firmen,
  auch Altbestand, Firmen anderer Ersteller und archivierte Firmen.
- Suche und Seitennavigation verwenden serverseitig 50 Eintraege pro Seite.
  Anklicken oeffnet eine eigene Bearbeitungsansicht, kein Popup und kein Wechsel
  des aktiven Mandanten.
- Bearbeitbar sind Firmenname, Land, Sprache, Zeitzone, Organisationsnummer,
  USt-ID, Ansprechpartner, Kontotyp, Pilotzeitraum, interne Angaben und Module.
  Die bestehende Eigentuemeridentitaet wird nicht durch das Formular geaendert.

## Daten und Sicherheit

- `20261020150000_platform_company_editor.sql` fuehrt zwei serverseitige RPCs ein.
  Beide haben einen festen Suchpfad und ausschliesslich `service_role`-Ausfuehrung.
  Bestehende RLS und Client-Grants werden nicht erweitert.
- Die API prueft Authentifizierung, `tenant.admin` im aktiven Verwaltungsmandanten
  und die explizite Plattformfreischaltung vor jedem Lesen und Schreiben.
  Die RPCs pruefen zusaetzlich den aktiven Verwaltungskontext des Akteurs.
- Bestehende typisierte Spalten in `homecare_tenants` und
  `homecare_tenant_modules` bleiben massgeblich; keine neuen fachlichen Felder.
  Die Kompatibilitaetsprojektion in `companySettings` wird nur fuer ausdruecklich
  geaenderte Identitaetsfelder aktualisiert. Fehlende native Organisations-/VAT-
  Angaben werden aus vorhandenen Altwerten gelesen und erhalten. Abweichende
  Altwerte bleiben bei reinen Notiz- oder Modulaenderungen unangetastet. Logo, Bankdaten und
  andere Einstellungen werden nicht durch einen leeren Formularstand ersetzt.
- Firmenrevision und Revision der Firmenstammdaten werden zusammen geprueft.
  Veraltete Versionen werden mit HTTP 409 abgewiesen; Eingaben bleiben sichtbar.
  Aenderungen und Modulzuordnungen erfolgen atomar mit Audit-Eintrag.

## Lokale Pruefung

`node scripts/test-operations-database.mjs --full-chain --through=20261020150000`

Dieser explizite Stichtag prueft den veroeffentlichten Bestand samt Firmeneditor,
nicht die separat vorbereitete, noch unfertige Passwort-/Zugangsverwaltung
`20261020160000_administration_access.sql`. Es werden weder Produktionsdaten
noch echte Auth-Identitaeten oder E-Mail-Empfaenger verwendet.

`CI=1 npx playwright test tests/master-data-design.spec.ts tests/company-directory.spec.ts tests/administration.spec.ts tests/company-logo.spec.ts tests/tablet-layout.spec.ts --workers=1`

Vor einer Veroeffentlichung ist die neue Firmeneditor-Migration separat auf
Staging und anschliessend kontrolliert auf Produktion anzuwenden. Die unfertige
Passwortmigration und die dazu gehoerenden API-Guards sind kein Bestandteil
dieses Pakets und duerfen nicht versehentlich mitveroeffentlicht werden.

`node scripts/verify-platform-company-editor.mjs --project staging` erstellt
einen privaten Pruefnachweis mit Migrations-/Test-Digest, SQL-Regressionen,
Rechtepruefung und Security Advisor. Produktion erfordert zusaetzlich
`--project production --apply-production --verified-staging <verification.json>`.
Der Release-Schritt sichert die Firmenbestaende serverseitig mit gepruefter
Pruefsumme, prueft unveraenderte Bestandsdaten in der Migrationstransaktion und
registriert ausschliesslich diese Migration. Es werden keine Produktions-
Geschaeftsdaten lokal exportiert.
