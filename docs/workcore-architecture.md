# WorkCore / Koll Architektur

## Grundsatz

Der Server ist die **Single Source of Truth**.

Clients (Web, iPhone, Android, Windows, Mac) sind nur Cache und
Offline-Arbeitskopie.

## Regeln

-   Merge immer per ID.
-   Nie komplette Listen überschreiben.
-   `updatedAt` berücksichtigen.
-   Soft Delete verwenden.
-   Offline-Änderungen als `pending` markieren und später
    synchronisieren.
-   Aktive Vorgänge (z. B. Fahrten) sind servergeführt.
-   Fotos dürfen nach dem Löschen nicht aus altem Cache zurückkehren.
-   Neue Module müssen diese Architektur einhalten.
