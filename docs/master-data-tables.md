# Stammdatentabellen

## Datenbankvorgabe ab 2026-10-11

Neue fachliche Felder erhalten eigene typisierte Datenbankspalten samt Migration,
Validierung, Lesemapping und Synchronisierungstest. Sammelfelder dienen nur noch
der Kompatibilitaet, nicht als Ersatz fuer neue Spalten.

Die Migration `20261011070000_master_data_columns.sql` ergaenzt `scan_code` bei
Material, Auftrag und Objekt. Sie korrigiert die Aktualisierung der bereits
vorhandenen Spalten bei Material, Personal, Leistungen, Paketen, Konten und
Standorten. Datenbankspalten sind beim Lesen massgeblich. Direkte Spaltenupdates
und kompatible Stammdatenmutationen werden im selben Schreibvorgang abgeglichen.

Vor der Uebernahme wird je Mandant eine relationale Sicherung angelegt. Vorhandene
Hauptlager-Namen stehen in `homecare_materials.primary_location_name`, nicht im
Fremdschluessel `primary_location_id`. Das bisherige Namensfeld bleibt dadurch
verlustfrei nutzbar; bestehende technische Lager-Verweise bleiben unveraendert.
Codes werden ohne Aenderung von Revision oder Zeitstempel uebernommen. Bereits
belegte, widerspruechliche Spalten werden nicht automatisch ueberschrieben.
Echte Synchronisierungskonflikte bleiben bis zur ausdruecklichen Entscheidung
erhalten. Ein bislang ignorierter Objektcode kann aus der letzten erfolgreich
bestaetigten Objektmutation wiederhergestellt werden; gescheiterte oder
konfliktbehaftete Mutationen werden dafuer nicht verwendet.

## Standard

Stammdaten und vergleichbare Uebersichten werden als semantische Tabelle dargestellt.
Unter den Spaltenkoepfen steht eine anfangs leere Filterzeile. Filter werden mit UND
kombiniert, einzeln geloescht und vor der Seiteneinteilung angewendet. Aktionsspalten
haben keinen Filter. Mobile Ansichten scrollen die Tabelle horizontal, nicht die Seite.
Telefon und E-Mail bleiben direkt nutzbar; bestehende Berechtigungen und Mutationen
werden nicht durch den Tabellenumbau veraendert.

## Aktuell umgestellt

- Bestellungen
- Lieferanten
- Lieferantenkontakte
- Material-Einkaufsdaten
- Standortdetails
- Ressourcendetails

## Weitere gefundene Ansichten

In app/page.tsx gibt es weiterhin eigenstaendige Listen fuer Kunden, Personal,
Ressourcen, Leistungen und Materialstammdaten. Ressourcentypen verwenden eine eigene
Liste in components/ResourceTypes.tsx. Diese sind noch nicht auf Spaltenfilter umgestellt.
Die Formular- und Berechtigungsablaeufe sind separat und wurden in diesem Paket
nicht pauschal ersetzt. Fahrtenbuch und Leistungsnachweise sind Bewegungsdaten und
bleiben von diesem Stammdatenumbau unberuehrt.
