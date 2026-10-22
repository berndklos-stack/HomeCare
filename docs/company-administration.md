# Firmen- und Benutzeradministration

## Umfang

- `/administration`: Firmen, System / Branding, Rollen, Module und Feedback.
- Benutzer und Kontoeinstellungen sind direkt bei der ausgewählten Firma integriert.
- Benutzer werden auf jeder Ergebnisseite in aktive und inaktive Zugänge gruppiert.
  Offene Einladungen, deaktivierte und entzogene Zugänge zählen zu inaktiv; Suche,
  Status-/Rollenfilter und Seitennavigation bleiben unverändert.
- Feedback hat einen eigenen Reiter und bleibt an die aktive Firma und
  `tenant.admin` gebunden, statt unter Firmen als ausklappbarer Bereich zu stehen.
- `/feedback`: explizit eingegebenes Feedback; technischer Kontext ohne Kundeninhalte.
- `/auth/accept`: Supabase-Einladungsannahme und optionale Passwortvergabe.
- Bestehende Supabase-Identitäten, Rollen und Mandantenzuordnungen bleiben maßgeblich.
- Keine eigenen Passwortspeicher, kein zweites Benutzer-/Membership-Modell.

## Datenmodell und Migrationen

`20261015140000_company_administration.sql` erweitert:

- `homecare_tenants`: typisierte Spalten für Land, Sprache, Zeitzone, Kontotyp,
  Pilotbeginn/-ende, Ansprechpartner, interne Bezeichnung/Notizen und Ersteller.
- `homecare_tenant_memberships.employee_id`: optionale Mitarbeiterverknüpfung mit
  mandantenübergreifend unmöglichem FK und eindeutiger Belegung je Firma.
- `homecare_user_invitations`: Rollen-FK, Auth-Benutzer, Versandstatus/-zeit und
  Versandfehler. Alte Einladungen bleiben als `legacy` erhalten; keine alten
  Einladungstokens werden neu verwendet. Neue Tokens stammen nur aus Supabase Auth.
- `homecare_feedback`: eigene Spalten für Kategorie, Nachricht, Version,
  technische Seitenkategorie, Browser, Firma, Benutzer und Erstellungszeit.
- Feedback ist im relationalen Sicherungsregister enthalten.

Gültige alte Profil-Mitarbeiterverknüpfungen werden übernommen. Ungültige alte
Referenzen bleiben im alten Profil unverändert; sie werden nicht erfunden oder
automatisch anderen Personen zugewiesen. Doppelte Verknüpfungen oder bestehende
mandantenfremde Rollen-FKs brechen die Migration ab und verlangen eine Prüfung.

`20261015143000_administration_directory.sql` ergänzt eine service-exklusive,
mandantengeprüfte Benutzerabfrage mit Suche, Status-/Rollenfilter und 50er-Seiten.
Es wird kein globales Auth-Benutzerverzeichnis an Clients weitergegeben.

Neue Firmen erhalten fünf Standardrollen, ausgewählte Module, sieben bestehende
Ressourcentypen samt Felddefinitionen und initiale Firmen-/Branding-Einstellungen.
Die vorhandene Settings-Projektion wird aus den relationalen Firmenfeldern
aufgebaut; Änderungen über den bestehenden Settings-Sync aktualisieren diese
Spalten. Wiederholte Sync-Mutationen erhöhen die Firmenrevision nicht erneut.
Vorhandene Kolaretorp-Daten und Einstellungen werden nicht umgedeutet.

## Rechte und Eigentümerschutz

- Benutzerverwaltung: `members.manage`; Rollenanzeige: `roles.manage`;
  Firmen-/Modulverwaltung und Feedbackübersicht: `tenant.admin`.
- Nur Eigentümer dürfen Eigentümerzuordnungen ändern oder neu vergeben.
- Der letzte aktive Eigentümer darf weder deaktiviert, entfernt noch degradiert
  werden. Trigger und Firmenzeilensperren schützen auch parallele Schreibwege.
- Clients können Rollen/Memberships/Einladungen nicht direkt schreiben.
- Verwaltungs-RPCs prüfen Akteur und Firma erneut und sind nur `service_role`
  zugänglich. Fester `search_path`, keine anonyme Ausführung.
- Rollen werden zunächst nur angezeigt. Ein Editor für eigene Rollen wird nicht
  eingeführt, solange Rechteeskalation und Eigentümerschutz dafür nicht separat
  abgesichert sind. Bestehende zusätzliche Rollen bleiben lesbar/verwendbar.
- Zugriff entziehen setzt die Membership auf `revoked`, löst die Mitarbeiter-
  verknüpfung und widerruft offene Einladungen. Mitarbeiter und Auth-Identität
  werden nicht gelöscht. Andere Firmenzugänge bleiben erhalten.

## Firmenanlage und Versand

Neue Firmen dürfen ausschließlich ausdrücklich freigeschaltete Plattformadmins
mit bestehendem `tenant.admin` anlegen. Die serverseitige Konfiguration lautet:

```text
WORKCORE_PLATFORM_ADMIN_USER_IDS=<Kommagetrennte Supabase-Auth-UUIDs>
WORKCORE_APP_URL=https://<freigegebene-App-Domain>
RESEND_API_KEY=<bestehender geheimer Mailzugang>
RESEND_FROM_EMAIL=<verifizierter Absender>
```

Ohne Plattformfreischaltung gibt es keinen Anlagezugriff. Keine Benutzer-ID wird
automatisch aus der bisherigen Firmeninhaberschaft als Plattformadmin abgeleitet.
In Supabase Auth muss `/auth/accept` auf der App-Domain als Redirect erlaubt sein.
Für den zusätzlichen passwortlosen Login muss der Supabase-Auth-Mailversand
eingerichtet sein; `shouldCreateUser:false` verhindert Selbstregistrierung.

1. Vorhandene Identität per serverexklusiver E-Mail-Auflösung wiederverwenden;
   sonst Supabase Auth `generateLink(type:invite)` verwenden.
2. Firma, Rollen, Module, Defaults, suspendierte Owner-Membership und offene
   Einladung werden in einer einzigen Datenbanktransaktion angelegt.
3. Danach Supabase-generierten Anmeldelink über den vorhandenen Resend-Zugang
   versenden. Keine Tokens oder Links in API-Antworten/Anwendungstabellen ablegen.
4. Bei Versandfehler bleibt die Firma ausdrücklich sichtbar und die Einladung
   erhält `failed`; die UI meldet den Fehler und erlaubt erneutes Senden.
5. Erst bestätigte Identität, passende E-Mail und gültige offene Einladung
   aktivieren die Membership. Annahme ist idempotent.

Auth und Mailanbieter können nicht an derselben PostgreSQL-Transaktion teilnehmen.
Eine vor einem DB-Fehler erzeugte Auth-Identität erhält keinen Firmenzugriff und
wird beim nächsten Versuch wiederverwendet, nicht gelöscht oder dupliziert.
Die Firmenanlage nutzt eine stabile Vorgangs-UUID gegen Doppelanlage nach einem
unsicheren Netzwerkresultat. Versand hat CAS-Sperre und eine Minute Mindestabstand.

API-Referenz: [Supabase Auth generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).

## Firmenwechsel und Feedback

Der aktive Firmenkontext ist tabgebunden. Ein Wechsel wird zunächst nur vorgemerkt;
erst nach vollständigem Reload und erneuter Membership-Prüfung wird er wirksam.
Laufende Anfragen behalten dadurch ihre bisherige Firma. Cache und SyncQueue
bleiben firmenspezifisch. Entwürfe anderer Firmen werden nicht gelöscht.
Die letzte Auswahl wird lokal je Benutzer gespeichert. Ein Identitätswechsel
demontiert die bisherige Oberfläche, bevor andere Firmendaten geladen werden.

Feedback speichert nur die explizite Nachricht und die feste Seitenkategorie,
App-Version, User-Agent und serverseitig bestimmte Firmen-/Benutzerkennung.
Querystrings, URL-Fragmente, Kundenkennungen, Fotos und Geschäftsdatensätze werden
nicht automatisch angehängt. Eigene Einträge sind für den Absender lesbar;
`tenant.admin` sieht Feedback der eigenen Firma. Kein anonymes Lesen/Schreiben.

## Prüfung und Freigabe

- Lokale vollständige Migrationskette: `node scripts/test-operations-database.mjs --full-chain`.
- Staging: `node scripts/verify-company-administration.mjs --apply-staging`.
  Das Skript akzeptiert ausschließlich `ealfegjvbyiiporettpq`, vergleicht
  Bestandsfingerprints, führt transaktionale SQL/RLS-Tests und echte Supabase-
  Link-/Auth-/Mandantentrennungstests aus und entfernt seine Testfirmen/-benutzer.
  Es sendet keine echten E-Mails. Migrationsdigests und Advisor-Ausgaben werden
  in einem privaten temporären Prüfverzeichnis protokolliert.
- Playwright: `administration`, `auth-security`, `field-inputs`, `tablet-layout`
  und `personal-layout`; Chromium/WebKit und 390/820/1440px.
- TypeScript, gezieltes ESLint, Produktionsbuild und `git diff --check`.

Staging hatte vor der Erweiterung 0 Security-Fehler und 7 Warnungen. Danach:
0 Fehler und 8 Warnungen. Die zusätzliche Warnung
`authenticated_security_definer_function_executable` betrifft ausschließlich
`homecare_accept_invitations()`. Sie ist beabsichtigt: Die Funktion akzeptiert
keine frei gewählten Benutzer-/Firmenparameter, nutzt ausschließlich `auth.uid()`,
prüft bestätigte passende E-Mail, Status und Ablauf und sperrt die betroffenen
Einladungen. `anon` besitzt kein EXECUTE. Eine Umstellung auf Invoker würde
direkte Membership-Schreibrechte benötigen und wäre hier die schlechtere Grenze.
Die sieben bestehenden Warnungen bleiben unverändert; siehe die vorherige
Security-Advisor-Dokumentation. Es wurden keine Rechte zum Verstummenlassen des
Advisors erweitert.

## Grenzen der ersten Version

- Anlage unterstützt SE/DE/AT/CH/GB/US, Sprachen de/sv/en und gültige IANA-Zeitzonen.
  Länderwährung wird initial zugeordnet; keine länderspezifische Rechts-/Steuerberatung.
- Die neuen Administrations-, Einladungs- und Feedbackseiten sind zunächst deutsch.
  Die eingestellte Firmensprache wird an die bestehende mehrsprachige Hauptapp übergeben.
- Freigeschaltete Plattformadmins sehen alle Firmen mit Suche und Seitennavigation.
  Firmenmetadaten und Module sind revisionsgeschützt bearbeitbar. Logo und weitere
  allgemeine Firmenstammdaten werden weiterhin in Stammdaten bearbeitet; es entsteht
  kein neuer Zugriff auf fremde Kunden-/Auftragsdaten oder Abonnements.
- Mitarbeiter-Auswahl: bis 1000 aktive Mitarbeiter; Feedbackübersicht: letzte 100.
- Modulauswahl nutzt den vorhandenen Konfigurationsmechanismus, keine neue
  Lizenz-/Abrechnungslogik. Module ersetzen keine serverseitigen Berechtigungen.
- Kein tatsächlicher Mailzustelltest an ein externes Postfach. Einladungen nutzen
  den bestehenden Resend-Zugang und den ausdrücklich freigegebenen Mailabsender.
  Die Live-App und ihr exakter `/auth/accept`-Callback sind in Supabase hinterlegt.
- Supabase hat keinen eigenen SMTP-Server konfiguriert. Die zusätzliche
  passwortlose Loginfunktion unterliegt daher weiterhin den Einschränkungen des
  Supabase-Standardmaildienstes. Dies betrifft nicht die über Resend versandten
  administrativen Einladungen.
- Ohne explizit freigegebene Benutzer-UUID in `WORKCORE_PLATFORM_ADMIN_USER_IDS`
  bleibt die Firmenanlage gesperrt. Bestehende Eigentümer erhalten diese
  Plattformberechtigung nicht automatisch.

## Ergebnis vom 15.10.2026

- Vollständige lokale SQL-Migrations-/RLS-Kette erfolgreich, einschließlich
  Einladungen, Rollenwechsel, Deaktivieren/Reaktivieren, Mitarbeiterverknüpfung,
  Eigentümerschutz, Mehrfirmenzugriff, Suchfilter und Settings-Replays.
- Beide Migrationen sind auf Staging angewendet. Echte Supabase-Auth-Link-Annahme,
  Wiederverwendung derselben Identität, Duplikatverhinderung und RLS bestanden.
- Privater letzter Staging-Nachweis:
  `/private/tmp/workcore-administration-staging-Z8TO6m/verification.json`.
- 80 Playwright-Tests erfolgreich, 2 erwartete WebKit-CDP-Touch-Skips.
  iPhone-, iPad- und Desktopdarstellung visuell kontrolliert. Die zusätzlichen
  Navigationslinks verursachen keine neue Menüzeile im iPad-Hochformat.
- TypeScript, Produktionsbuild und gezieltes ESLint erfolgreich.
- Bestehende Lint-Baseline gegen HEAD geprüft und unverändert:
  `app/page.tsx` 12 Fehler/28 Warnungen, Sync-Sections 13 Warnungen.
- `git diff --check` und zusätzliche Whitespace-Prüfung neuer Quelldateien sauber.
- Veröffentlichung als Version `1.428.0` nach gesonderter Benutzerfreigabe.
  Der Produktionslauf `scripts/release-company-administration.mjs` prüft die
  exakten Staging-Digests, exportiert nach ausdrücklicher Freigabe eine private
  Sicherung, vergleicht deren SHA-256 und verhindert innerhalb der
  Migrationstransaktion Änderungen an bisherigen Geschäftsspalten. Danach werden
  Schema, RLS, Grants und Security Advisor erneut kontrolliert.
- Produktionsnachweis:
  `/private/tmp/workcore-administration-production-Q0eHl6/verification.json`.
  Beide Migrationen angewendet, eine private Firmensicherung mit identischer
  Prüfsumme exportiert, Bestandsdaten unverändert. Security Advisor danach:
  0 Fehler, 8 Warnungen (Anzahl gegenüber dem Produktionsvorzustand unverändert).
  RLS aktiv; kein anonymer Feedbackzugriff oder Einladungs-RPC-Zugriff, keine
  direkten Membership-Schreibrechte oder Directory-RPC-Rechte für Browserclients.

## Firmenbezogene Benutzerverwaltung ab 21.10.2026

Die Hauptreiter Firma, Benutzer und Pilot/Test entfallen. In Firmen stehen je Firma
Einstellungen und Benutzer bereit; nach erfolgreicher Firmenanlage öffnet sich
direkt die Benutzerverwaltung der neuen Firma. Einladungsfehler bleiben sichtbar.
Die Kontobezeichnungen lauten Produktion, Testkonto und Demo. Bestehende native
`account_type`- und `pilot_*`-Spalten sowie deren Werte werden nicht umgeschrieben.

`20261021120000_platform_company_members.sql` ergänzt ausschließlich zwei
service-exklusive RPCs: `homecare_platform_member_directory` und
`homecare_platform_member_command`. Beide haben einen festen Suchpfad und prüfen
die aktive Administrationsberechtigung in der Heimatfirma erneut. Die API verlangt
zusätzlich die ausdrückliche Plattform-Allowlist. Der tatsächliche Akteur wird
protokolliert; es gibt weder fingierte Eigentümer noch künstliche Mitgliedschaften
in fremden Firmen. Firmenwechsel und normaler Mandantenkontext bleiben unverändert.

Rollenzuordnungen, Mitarbeiter und Einladungen sind an die Zielfirma gebunden.
Letzter Eigentümer, bestätigte Identität und Einladungsannahme bleiben geschützt.
`anon`, `authenticated` und `PUBLIC` erhalten kein EXECUTE auf die neuen Funktionen.
Bestehende Tabellen-RLS und Grants werden nicht verbreitert.

Prüfung: vollständige lokale SQL-/RLS-Kette, API-Regressionsprüfung und mobile
Administrationsprüfungen in Chromium/WebKit. Der Release-Prüfer
`scripts/verify-company-members-release.mjs` vergleicht Staging-Digests, prüft
transaktionale Bestandsfingerprints, erzeugt vor Produktion serverseitige
Firmensicherungen mit Prüfsummenprüfung und vergleicht den Security Advisor.

## Freigabe vom 22.10.2026

- Globale Administration erfordert die feste Kolaretorp-Firmen-ID, die explizite
  Benutzer-Allowlist und die vorhandene Administrationsberechtigung. Firmenname
  und vom Client angegebene Zielmandanten koennen diese Grenze nicht aendern.
- Jede Firma verwaltet eigene Benutzer unter Stammdaten / Benutzer. Die zentrale
  Firmenansicht nutzt dieselben Memberships und Einladungen, keine Kopien.
- `20261022090000_company_user_limits.sql` speichert die maximale Benutzerzahl in
  `homecare_company_user_limits.max_users`, einer typisierten Integer-Spalte mit
  mandantengebundenem Primaer-/Fremdschluessel, RLS und Backupregistrierung.
  Fehlende Konfiguration bzw. `NULL` bedeutet unbegrenzt; Altzugriffe bleiben
  erhalten. Aktiv, deaktiviert und offen eingeladen belegen einen Platz;
  `revoked` nicht. Firmensperren serialisieren parallele Einladungen und
  Limitwechsel. Ein zu niedriges Limit rollt die gesamte Einstellungsaktion zurueck.
- `authenticated` darf Limits nur mit `members.manage` in der eigenen Firma
  lesen, aber keine Limits oder Modulfreigaben direkt schreiben. Alle globalen
  Konfigurationsaenderungen bleiben serverseitig abgesichert.
- Passwort-Reset verwendet die bestaetigte kanonische Supabase-Identitaet. Nur
  ein sicherer Recovery-Link wird per bestehendem Resend-Absender versandt.
  Tokens/Passwoerter erscheinen nicht in API-Antworten. Eine Minute Cooldown und
  Audit schuetzen den Versand; gesperrte/offene Einladungen werden nicht umgangen.
  `/auth/accept` unterstuetzt Recovery mit Passwortbestaetigung. Bestehende
  Passwoerter sind weder auslesbar noch administrativ sichtbar.
- Pruefung: vollstaendige lokale SQL-/RLS-Kette, Staging-Fingerprints und Advisor,
  synthetischer echter Supabase-Recovery/Login mit anschliessender Loeschung,
  API- und Chromium/WebKit-Regressionen, TypeScript und Produktionsbuild.
  `scripts/verify-company-members-release.mjs --user-limits` protokolliert den
  abgesicherten Staging-/Produktionslauf. Staging: 0 Fehler, unveraendert 8 Warnungen.
- Die separate unfertige Migration `20261020160000_administration_access.sql`
  und deren Auth-Middleware sind ausdruecklich nicht Teil dieser Freigabe.
