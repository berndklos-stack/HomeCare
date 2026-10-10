# Stammdatentabellen

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
