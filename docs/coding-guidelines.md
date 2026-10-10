# Coding Guidelines

-   Keine unnötigen Refactorings.
-   Bestehende Komponenten wiederverwenden.
-   Keine parallelen Speicherlösungen.
-   Performance beachten.
-   Änderungen klein und gezielt halten.
-   Mehrsprachigkeit (DE/SV/EN) berücksichtigen.
-   Vor jeder Änderung prüfen, ob bestehende Logik genutzt werden kann.

## Dialoge

-   Kleine Detail- und Bestätigungsdialoge richten ihre Höhe nach dem Inhalt;
    keine Bildschirmhöhe oder gestreckten Rasterzeilen für wenige Angaben.
-   Titel links, Schließen-Button oben rechts, klare Abstände und Aktionen am Ende.
-   Lange Inhalte scrollen innerhalb der verfügbaren Höhe. Ränder, Bedienelemente
    und Texte bleiben auf Desktop und Mobil erreichbar und lesbar.
-   Neue und geänderte Dialoge mit Chromium und WebKit sowie Desktop- und
    Mobil-Screenshots prüfen; Öffnen allein ist keine ausreichende Layoutprüfung.
-   Gemeinsame Modal-Regeln nicht ohne Regressionstests für bestehende Dialoge ändern.
# Stammdaten-Standard

Stammdatenlisten als Tabellen mit Spaltenkoepfen und direkt darunter einer leeren
Filterzeile je Datenspalte gestalten. Filter kombinieren, vor der Pagination anwenden
und einzeln loeschen koennen. Aktionsspalten bleiben filterfrei. Auf schmalen Geraeten
nur den Tabellenbereich horizontal scrollen. Siehe `master-data-tables.md`.
