# Abrechnung und Spiris

## Festgelegte Richtung

WorkCore stellt Rechnungen aus. Seine Rechnungsnummern, PDFs und das
Rechnungsausgangsbuch bleiben fuehrend. Bestehende Rechnungen werden weder
neu nummeriert noch automatisch in Spiris angelegt.

Die kompakte WorkCore-Uebersicht verwendet Entwuerfe, unbezahlte und alle
Rechnungen. Suche, Kategorie-, Status- und Uebergabefilter sind reine
Ansichtsoptionen. Waehrungen werden getrennt summiert; Stornos zaehlen nicht
in den Umsatz der angezeigten Auswahl. Details und Aktionen bleiben aufklappbar.

## Bereits vorhandener Dateiweg

### Bearbeitung von Rechnungsentwuerfen

"Neue Rechnung" erstellt einen manuellen Entwurf ohne Auftrag oder Bericht.
Ein bestehender Kunde ist erforderlich; Projekt/Objekt ist optional. Oeffnen und
Abbrechen schreiben keine leere Rechnung. Erst Speichern nutzt den vorhandenen
nativen Rechnungs-/Positions-Schreibweg. Es werden keine Ersatzobjekte angelegt.
Die Datenbank vergibt die Rechnungsnummer ueber den vorhandenen, mandantenbezogen
gesperrten Nummernkreis. Ohne bestaetigte Nummer kann der Entwurf noch nicht
gebucht werden. Kundenadresse, PDF, Vorschau und SIE-Datei funktionieren auch
ohne Objektzuordnung; der SIE-Download bestaetigt weiterhin keinen Import.

Die Bearbeitung erfolgt als eigene Ansicht innerhalb der Abrechnung, nicht als
Popup. Kunde, Projekt/Objekt, Rechnungs-, Faelligkeits- und Leistungsdatum,
Notizen und Rechnungspositionen verwenden ausschliesslich vorhandene native
Spalten. Neue Positionen und Loeschungen laufen ueber die bestehende
revisionsgesicherte Finanz-Synchronisierung. Summen werden wie in der Datenbank
je Position centgenau gerundet. Rabattpositionen verwenden negative Preise.

Bereits gebuchte oder als uebergeben markierte Rechnungen sind nicht editierbar.
Hat sich der Entwurf waehrend der Bearbeitung geaendert, wird Speichern abgelehnt;
die aktuelle Fassung muss erneut geoeffnet werden. Abbrechen bei Aenderungen
fragt nach und schreibt nichts. Rechnungsnummern werden nicht neu vergeben.
Die Ansicht ist kein neuer Rechnungsversand: Speichern stellt keine Rechnung
aus und uebertraegt nichts an Spiris. Wiederkehrende Rechnungen, neue Referenz-
felder und PDF-Anhaenge sind damit nicht eingefuehrt.

### SIE-Dateien

Die im Screenshot gezeigte Spiris-Funktion fuer SIE-Import ist ein manueller
Dateiweg, keine bestaetigte API-Verbindung.

- Herunterladen erzeugt nur die Datei und setzt keinen Uebergabestatus.
- Nach einer echten Pruefung in Spiris kann die Uebernahme bewusst bestaetigt
  werden. Abbrechen veraendert nichts.
- Der vorhandene Status `gesendet` wird als "Als uebergeben markiert" angezeigt,
  nicht als Nachweis einer automatischen API-Zustellung. Alte Markierungen werden
  nicht ungeprueft zurueckgesetzt.
- Die bestehende SIE-Vorlage ist auf SEK und 0/25 Prozent begrenzt. Abweichende
  Faelle sowie nicht ausgeglichene Rundungssummen werden vor dem Download gesperrt.
- Der Dateiweg ist noch nicht mit einem echten Import in das konkrete
  Spiris-Unternehmen abgenommen. Geschaeftsjahr, Kontenplan, Steuerfaelle und
  Belegserie muessen dort vor dem produktiven Import abgeglichen werden.

Alle gespeicherten Werte verwenden die vorhandenen nativen Rechnungs-, Positions-
und Exporttabellen und deren bestehende Synchronisierung. Es gibt keine neuen
fachlichen Datenfelder, keine neue JSON-Nebenablage und keine Schemaaenderung.

## Direkte Anbindung: Noch nicht aktiviert

Die offizielle Spiris-API benoetigt eine registrierte Partneranwendung mit
Sandbox-Zugang und spaeterer Produktionsfreigabe. Ein normales Firmenpasswort
ist kein API-Zugang. Zugangsdaten niemals in Chat, Browser-Storage oder
`record_data` speichern.

Ein entscheidender Unterschied aus der OpenAPI-Spezifikation:
`CustomerInvoiceApi.InvoiceNumber` ist schreibgeschuetzt und wird von Spiris
vergeben. `POST /customerinvoices` waere deshalb eine zweite Rechnung mit eigener
Spiris-Nummer. Das ist **nicht** der gewaehlte WorkCore-fuehrende Ablauf.

Der naechste abzusichernde Weg ist eine Buchungsuebergabe ueber `/vouchers` bzw.
zunaechst `/voucherdrafts`, mit WorkCore-Rechnungsnummer als Belegreferenz und
Rechnungs-PDF als Nachweis. Dieser Weg ist noch nicht implementiert oder fuer
produktive Buchungen freigeschaltet. Reine Sachkontenbuchungen erzeugen nicht
automatisch einen externen Kundenreskontra-Eintrag. Eine automatische
Zahlungszuordnung darf daraus nicht vorgetaeuscht werden.

Vor einer Umsetzung sind erforderlich:

1. Spiris-Partnerregistrierung und Sandbox-Client-ID/-Secret mit registrierter
   Callback-Adresse; danach getrennte Produktionsfreigabe.
2. Firma autorisiert ihre eigene Verbindung ueber OAuth mit expliziter
   Firmenauswahl. Rechte auf Buchhaltung beschraenken; nur zusaetzlich benoetigte
   Leserechte fuer Firmen-/Kontendaten anfordern.
3. Neue versionierte Migrationen fuer mandantengebundene Verbindung,
   externe Belegkennung, Uebergabeversuch, Zustand und bestaetigten Zeitpunkt.
   Tokens verschluesselt nur serverseitig, keine direkten Client-Schreibrechte.
4. Serverseitig aus den bestaetigten nativen Rechnungspositionen lesen; keine
   vom Browser mitgelieferten Buchungsbetraege vertrauen. Geschaeftsjahr,
   Buchungssperren, Waehrung, Steuerschluessel und Konten vorab validieren.
5. Eine Uebergabe pro Rechnung/Verbindung sperren. Nach unklarem Timeout zuerst
   abgleichen, niemals blind eine zweite Buchung anlegen. Externe Belegkennung
   und ausgewogene Soll-/Habensummen vor einer Erfolgsmarkierung speichern.
6. SQL/RLS-, OAuth-/CSRF-, Fremdmandanten-, Wiederholungs-, Timeout- und
   Sandbox-Buchungstests. Keine echten Firmen-/Kundendaten fuer Probelauf kopieren.

## Primaerquellen, geprueft am 25.10.2026

- [Spiris/eAccounting: Einstieg und Partnerregistrierung](https://developer.vismaonline.com/docs/spiris-eaccounting-api-documentation)
- [OAuth und Firmenauswahl](https://developer.vismaonline.com/docs/authentication)
- [Offizielle OpenAPI-Spezifikation](https://eaccountingapi.vismaonline.com/openapi/v2.json)
- [API-Referenz](https://eaccountingapi.vismaonline.com/scalar/v2)

Diese Pruefung liest ausschliesslich oeffentliche Dokumentation. Es wurden keine
Spiris-Anmeldedaten angefordert und keine echten Rechnungen uebertragen.
