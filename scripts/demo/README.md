# Handwerksbetrieb als getrennte Vorfuehrfirma

`handwerk-data.mjs` erzeugt ausschliesslich erfundene Datensaetze. Es liest keinen
Firmenexport und kopiert weder Kundendaten noch Fotos aus Bestandsfirmen.

Enthalten: 5 Kunden mit Kontakten, 4 Projekte/Objekte, 7 Auftraege,
4 Mitarbeiter, 45 Arbeits-/Pausenbuchungen, Urlaubskonten und Antraege,
4 abrechenbare Leistungsnachweise, 5 Ressourcen, 12 zusammenhaengende Fahrten,
eine Standardfahrt mit Entfernung, 8 Materialien, 3 Lagerorte, 20 Lagerbewegungen,
Lieferant, Bestellentwurf, Wartungsplan, 3 Berichte und 2 Abrechnungsbeispiele.

Alle vorhandenen Firmenmodule werden freigeschaltet. Globale Plattformrechte,
echte Kunden-Logins, Zahlungsanbieter, KI-Zugangsdaten, Buchhaltungsanbindungen
und automatischer Mailversand werden nicht uebernommen. Externe Dienste brauchen
weiterhin ihre eigene Einrichtung. Nur der echte Demo-Eigentuemer wird eingeladen;
die Beispieldaten verwenden nicht zustellbare `example.invalid`-Adressen.

## Sicherheitspruefungen

- Native Tabellen, Typen, Fremdschluessel und Trigger bleiben wirksam.
- Keine neuen fachlichen Felder oder Schemaaenderungen.
- Vorher-/Nachher-Fingerprints aller vorhandenen Mandanten; Abweichung bricht ab.
- RLS-Probe als Demo-Eigentuemer: nur eigene Firma, Kunden, Zeiten, Bestand und Module.
- Die temporaere Aktivierung fuer diese SQL-Probe wird per Savepoint zurueckgenommen.
- Der neue Zugang bleibt bis zur Annahme seiner Einladung gesperrt.
- Keine Passwoerter, Zugangstokens oder API-Schluessel in Ausgaben/Projektdateien.
- Staging-Firma und Buchungen werden zurueckgerollt; nur eigene Testbilder und
  die eigene synthetische Auth-Identitaet werden danach entfernt.
- Produktive Wiederholung bricht bei vorhandener Demo ab, statt sie zu ueberschreiben.

```sh
node --test tests/demo-handwerk.test.mjs
node scripts/demo/provision-handwerk.mjs --check-staging
```

Produktive Ausfuehrung erfordert `--apply-production`, `--email`, eine neue
explizite `--tenant`-UUID und `--staging-proof` mit uebereinstimmendem Digest und
hoechstens 24 Stunden Alter. Das Ziel muss dem produktiven `/api/version` entsprechen.
Nachweise liegen benutzerprivat unter `/private/tmp/workcore-handwerk-demo-*`.
Der getrennte Versand verwendet `send-handwerk-invitation.mjs --send-production
--invitation /private/tmp/workcore-handwerk-demo-.../invitation.json` und den
bereits eingerichteten Mailabsender oder, ohne lokale Mail-Zugangsdaten, den
vorhandenen Supabase-Auth-Mailversand. Es werden keine kompletten
Produktionsumgebungen exportiert. Kein bestehendes Passwort wird veraendert.

## Bilder

Die JPEGs unter `scripts/demo/assets/` wurden mit dem eingebauten ImageGen-Werkzeug
neu erzeugt und anschliessend nur auf 1200 Pixel Breite komprimiert:

- `ferienhaus.jpg`: fiktives rotes schwedisches Holzhaus mit weissen Fensterrahmen,
  neuer Holzterrasse und Garten; dokumentarische Tageslichtaufnahme, ohne Personen,
  Marken, Schrift oder Wasserzeichen.
- `servicewagen.jpg`: weisser unbeschrifteter Montagewagen vor einer skandinavischen
  Werkstatt, geoeffnete Hecktuer mit gesichertem Holz und Werkzeugkoffern; Tageslicht,
  ohne Menschen, Marken oder lesbares Kennzeichen.
- `kueche.jpg`: helle skandinavische Kueche im Umbau, Holzfronten, Arbeitsplatte,
  Akkuschrauber und Massband; dokumentarische Aufnahme ohne Personen oder Marken.

Die Dateien werden in `homecare-private-media/<tenant>/demo-handwerk/` abgelegt,
per Download und SHA-256 rueckgeprueft und ueber mandantengebundene Medienzeilen
an Objekte, Fahrzeug und Bericht gehaengt. Es gibt keine oeffentlichen Bild-URLs.
