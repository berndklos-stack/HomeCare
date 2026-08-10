# Kolaretorp Service App

Web-App fuer Kolaretorp Service AB zur Ferienhausverwaltung, Einsatzplanung,
Kundenkommunikation und mobilen Dokumentation vor Ort.

## Funktionen in der ersten Version

- Verwaltungsansicht fuer Objekte, Auftraege, Status und Dienstleistungskatalog
- Kundenportal-Ansicht mit Objektstatus, Auftragsverlauf und Berichtsvorschau
- Mobile Einsatzansicht mit Checkliste, Berichtsvorbereitung und Freigabeaktion
- Kolaretorp-Logo und Inhalte aus der bestehenden Website
- Supabase-Client und Startschema fuer die spaetere echte Datenhaltung

## Lokaler Start

```bash
npm install
npm run dev
```

Die lokale App laeuft standardmaessig unter `http://localhost:3000`.

## Build fuer Vercel

```bash
npm run build
```

Vercel kann das Projekt als normales Next.js-Projekt importieren.

## Benötigte Zugangsdaten

In `.env.local` werden spaeter diese Werte gebraucht:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
REPORT_SENDER_EMAIL=info@kolaretorp.se
DAILY_JOB_LIST_EMAIL=info@kolaretorp.se
CRON_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` darf nur serverseitig verwendet werden und gehoert
nicht in Browser-Code.

## Tägliche Auftragsmail

Vercel ruft `/api/cron/daily-jobs` einmal taeglich um `06:00 UTC` auf. Das ist
in der schwedischen Sommerzeit 08:00 Uhr. Der Endpunkt merkt sich den
Versandtag in `public.app_state`, damit keine doppelte Tagesmail entsteht.

Benötigt werden:

- `RESEND_API_KEY` fuer den Mailversand
- `REPORT_SENDER_EMAIL`, idealerweise eine bei Resend verifizierte Adresse
- `DAILY_JOB_LIST_EMAIL`, standardmaessig `info@kolaretorp.se`
- optional `CRON_SECRET`, wenn der Cron-Endpunkt per Bearer-Token geschuetzt
  werden soll

## Datenbank

Das Startschema liegt in `supabase/schema.sql`. Es enthaelt Tabellen fuer:

- Profile und Rollen
- Ferienhausobjekte
- Dienstleistungskategorien
- Auftraege
- Checklisten
- Berichte mit Freigabe- und Mailstatus
- `app_state` als zentraler Snapshot der aktuellen Demo-/Arbeitsdaten inklusive
  Objekte, Dokumente, Fotos, Auftraege, Berichte und Mobil-vor-Ort-Fortschritt

Die Row-Level-Security-Regeln sind als Anfangspunkt enthalten und muessen vor
dem Produktivbetrieb mit echten Rollen und Admin-Policies erweitert werden.

Damit Dokumente und Bilder nach Deploys/Versionswechseln erhalten bleiben, muss
`supabase/schema.sql` einmal in der Supabase-Datenbank ausgefuehrt werden. Die
App synchronisiert danach automatisch in die Tabelle `public.app_state` und
nutzt `localStorage` nur noch als Fallback/offline Zwischenspeicher.
