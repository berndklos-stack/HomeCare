# Lokaler Lesecache

Grosse Lesecache-Abschnitte werden ab 128 KiB JSON-Text in IndexedDB
(`workcore-read-cache`, Object Store `sections`) statt im begrenzten localStorage
aufbewahrt. Kleine Abschnitte verwenden weiterhin localStorage; bei einem
QuotaExceededError dient IndexedDB auch fuer sie als Fallback.

Vor dem Aufbau des App-Snapshots werden die exakten mandantengebundenen Keys
sowie bekannte alte ungebundene Cachekeys geladen. Alte Keys behalten ihre
urspruengliche Kennung und werden nicht dem aktiven Mandanten zugeordnet.

Die Uebernahme kopiert den vollstaendigen JSON-Text. Erst nach erfolgreichem
Abschluss der IndexedDB-Schreibtransaktion darf die bisherige localStorage-Kopie
entfernt werden. Zwischenzeitlich geaenderte lokale Werte werden nicht entfernt.
Generationskennungen verhindern, dass eine alte asynchrone Speicherung einen
neueren lokalen Stand entfernt. Kleinere neue lokale Kopien haben beim Lesen
Vorrang vor alten Datenbankkopien.

Die Synchronisationsqueue, Konflikte, Auth-Sitzungen und der Quick-Fahrtentwurf
gehoeren nicht zu diesen Cachekeys und werden nicht verschoben oder geloescht.
Ein Fehler beim Lesecache darf die Online-Synchronisierung nicht abschalten.
Warnungen beziehen sich auf weiterhin fehlgeschlagene Cachekeys; sie werden erst
nach erfolgreicher Speicherung dieser Keys aufgehoben. Wenn auch IndexedDB
scheitert, bleibt die urspruengliche lokale Kopie erhalten. Begrenzte Wartezeiten
verhindern unbegrenzte Startblockaden durch haengende Datenbankzugriffe.

Das ist eine technische Cache-Aenderung, kein neues fachliches Datenfeld und
keine Aenderung der SQL-Datenquellen oder RLS. Die dauerhafte Mutationsqueue
bleibt unveraendert: Reicht der Geraetespeicher auch fuer neue Offline-Aenderungen
nicht mehr aus, bleiben deren bestehende Fehlermeldungen und Schutzregeln aktiv.

Tests: grosse Cache-Uebernahme, vollstaendiger Inhalt, Offline-Neustart auf
iPhone-/iPad-Groessen in Chromium und WebKit, unveraenderte wartende Fahrt und
Entwurf, echte localStorage-Quota, fehlendes IndexedDB sowie abgelehnte
Schreiboperation. Foto-/Berichts- und Vor-Ort-Regressionsfaelle pruefen weiterhin
Haken, Zeiten, Hinweise, Fotos, Queuefehler und erneute Uploads.
