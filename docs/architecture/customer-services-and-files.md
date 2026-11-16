# Kundenkonditionen Und Dateien

## Datenhaltung

`homecare_customer_service_conditions` verknuepft Kunde und Leistung innerhalb
eines Mandanten. `unit_price` und `currency` sind die massgeblichen nativen
Spalten. Beide NULL bedeutet Stammdatenpreis; Null als Zahl ist ein gueltiger
kostenloser Kundenpreis. Die Einheit und Umsatzsteuer stammen aus der Leistung.
Bestehende Rechnungspositionen werden nicht nachtraeglich umgerechnet.

Zuordnungen verwenden eigene Synchronisierungsmutationen mit Revision,
Idempotenzjournal und Tombstone. Neu angelegte Kunden und Leistungen muessen
vor ihren Zuordnungen synchronisiert sein. Der bisherige Kunden-JSON-Payload
enthaelt die Konditionen ausdruecklich nicht. Die neue Tabelle ist Bestandteil
der relationalen Mandantensicherung.

Das Speichern anderer Kundenfelder uebernimmt keine Preise aus einem veralteten
Formular. Bei expliziten Preisänderungen bleiben zwischenzeitlich geaenderte
Serverpreise geschuetzt; Dezimalkomma und native Nachkommastellen verursachen
keine wiederholten inhaltlich identischen Mutationen.

## Leistungsberichte

Die Leistung wird zuerst gespeichert. Der Bericht verwendet die bestehende
Berichtsstruktur und eine pro Buchung stabile Kennung, getrennt von Tages- und
Wochenberichten. Er ist bis zum bestaetigten Versand nicht im Kundenportal
sichtbar. Taetigkeit, Zeiten und Entfernung werden uebernommen, nicht interne
Stunden- oder Kilometersaetze. Bilder und Dokumente koennen vor dem Versand aus
dem Bericht entfernt werden, ohne die Buchungsanhaenge zu loeschen.

Bereits vorbereitete Berichte werden unveraendert wieder geoeffnet. Auch spaetere
Aenderungen der Leistung ueberschreiben den Bericht nicht automatisch. Gesendete
Berichte bleiben gesperrt. Ein erneuter Versandversuch verwendet denselben
Idempotenzschluessel. Kommunikationsanhaenge besitzen eigene Datensatzkennungen.

## Dateiuebersichten

Die interne Kundenansicht sammelt Objektmedien, Berichtsfotos, Berichtsanhaenge,
Leistungsanhaenge und versendete Berichtsdateien. Die Portalansicht verwendet
nur freigegebene Berichte und deren versendete Kommunikation.

`/api/portal/files` prueft Kundenzugang, Mandant, aktuelle Objektzuordnung,
Berichtsfreigabe und Tombstones bei jedem Abruf erneut. Downloads adressieren
eine Medienkennung, keinen frei uebergebenen Speicherpfad. Die interne Ansicht
verwendet denselben Leser unter `/api/customer-files`, mit eigener Mitarbeiter-
Authentifizierung und expliziter Kundenzuordnung. Native private Pfade bleiben
mandantengebunden. Alte Dateien duerfen ausschliesslich ueber eine bestehende,
lebende Medienzeile des berechtigten Kunden aus derselben Supabase-Installation
geladen werden. Externe URLs, fremde Mandanten, Pfadnavigation und nicht
freigegebene Berichte autorisieren keinen Download.

Die Uebersicht hat die Gruppen Einsatzberichte, Bilder und Dokumente, jeweils
neueste zuerst; Auftrag und Datum stehen an jeder Datei. Gespeicherte versendete
Berichts-PDFs werden bevorzugt. Fuer andere berechtigte Berichte entsteht beim
Download ein PDF aus Titel, Datum, Zusammenfassung und Checklisten, ohne interne
Notizen oder Abrechnungssaetze. Die separat gelisteten Bilder werden dabei nicht
erneut eingebettet. Kundeneditor und Neuanlage verwenden eine eigene Seitenansicht.

Die Inhaltspruefung verwendet Storage-ETags fuer einfache MD5-Objekte, andernfalls
den Hash heruntergeladener Originalbytes. Gleiche Namen allein sind kein
Duplikatnachweis. Gleiche Inhalte werden pro Auftrag zusammengefasst, ohne
Originale oder Datenbankzeilen zu loeschen. Die technische Inhaltskennung wird
nicht in fachlichen Sammelfeldern persistiert. Fehlende Dateien bleiben sichtbar,
sind aber nicht auswaehlbar; der Sammeldownload nennt dann ausdruecklich nur
verfuegbare Dateien.

ZIP-Dateien werden lokal im Browser mit fflate erzeugt. Bereits komprimierte
Bilder und PDFs werden ohne erneute Kompression gruppiert. Grenzen: 500 Dateien
und 100 MB je Download. Eine fehlgeschlagene Datei fuehrt zum Abbruch statt zu
einem stillschweigend unvollstaendigen Archiv. Dateinamen werden bereinigt und
Namenskollisionen eindeutig aufgeloest. Originaldateien im Speicher bleiben
unveraendert.

## Freigabe

Vor einem Produktionsrelease muss die Migration
`20261116120000_customer_service_conditions.sql` nach Staging-Test und
Produktionssicherung eingespielt werden. Ohne die Tabelle darf die neue
Kundenprojektion nicht veroeffentlicht werden. Lokaler SQL-Test:
`node scripts/test-customer-service-conditions.mjs`.

Browserabdeckung: `consulting-customer-report`, `customer-conditions-ui`,
`customer-files`, `customer-service-conditions` und `cancelled-series`.
