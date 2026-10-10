# Release-Prozess

Vor jedem Release:

-   Tests erfolgreich
-   Synchronisation geprüft
-   Mehrsprachigkeit geprüft
-   Mobile Darstellung geprüft
-   Build erfolgreich
-   Changelog aktualisieren
-   Vor Datenbankmigrationen das verbundene Projekt mit `databaseProject` unter `/api/version` der Live-App vergleichen. Bei Abweichung stoppen und die Verbindung korrigieren.
-   Nach Migrationen Funktionen und Migrationseintraege im bestaetigten Produktionsprojekt pruefen; erst danach die App veroeffentlichen.
