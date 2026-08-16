# Changelog

Alle nennenswerten Änderungen an der Kolaretorp Service App werden hier
protokolliert. Die App zeigt die aktuelle Version zusätzlich direkt in der
Oberfläche an.

## 1.81.0 - 2026-08-17

- Archivierte Kunden, Objekte, Leistungen und Pakete werden kompakter dargestellt.
- Archiv-Aktionsbuttons stehen jetzt kleiner und einzeilig in einer gemeinsamen Buttonzeile.
- Löschen, Bearbeiten und Reaktivieren nutzen in Archivlisten dieselbe kompakte Icon-Darstellung.

## 1.80.0 - 2026-08-17

- Überschrift der Leistungsanfrage im Kundenportal lautet jetzt Nachricht an Kolaretorp Service AB.

## 1.79.0 - 2026-08-17

- Kundenportal-Texte wurden auf Du-Form umgestellt.
- Leistungsanfrage im Portal spricht Kunden jetzt direkt und persönlicher an.
- Leere Zustände und Bestätigungsmeldungen im Portal sind kundenfreundlicher formuliert.
- Einsatzberichte können jetzt direkt als PDF heruntergeladen werden.

## 1.78.0 - 2026-08-17

- Auftragsanlage im Kundenportal wurde entfernt.
- Kunden fragen Leistungen jetzt über den Nachrichtenbereich an.
- Portal-Anfragen erhalten automatisch einen passenden Betreff, wenn keiner eingegeben wurde.
- Portal-Willkommen zeigt nur noch Välkommen im Kundenportal, da das Logo die Firma bereits sichtbar macht.

## 1.77.0 - 2026-08-17

- Kundenportal-Login wurde gestalterisch neu aufgebaut.
- Vor dem Login erscheint keine doppelte Portal-Headline mehr.
- Logo und Willkommenszeile stehen jetzt fokussiert in der Login-Karte.
- Login-Formular und Einloggen-Button sind kompakter und sauber ausgerichtet.

## 1.76.0 - 2026-08-17

- Erfolgreiche Kundenportal-Logins werden mit Zeitstempel, Login-E-Mail und Gerätehinweis protokolliert.
- Der Login-Verlauf ist nur intern in den Kundenstammdaten sichtbar.
- Beim Speichern von Kundenstammdaten bleibt der Login-Verlauf erhalten.

## 1.75.0 - 2026-08-17

- Kundenportal zeigt Serienaufträge kompakt als Hauptauftrag mit ausklappbaren Teilaufträgen.
- Kunden können freigegebene Berichte öffnen und über die PDF-/Druckausgabe herunterladen.
- Auftragsanlage im Kundenportal nutzt jetzt die vollständige Admin-Logik mit Leistungen, eigener Leistung, Checkliste und Serienauftrag.
- Kunden können im Portal ihre E-Mail-Adresse und Telefonnummer selbst aktualisieren.
- Portal-Kopf zeigt das Kolaretorp-Logo mit Willkommenszeile.
- Anmeldemaske im Kundenportal zeigt jetzt das Logo korrekt, ohne doppelte Willkommenszeile und ohne Demo-Zugänge.

## 1.74.0 - 2026-08-17

- Offene App-Fenster aktualisieren Daten jetzt automatisch aus Supabase.
- Beim Zurückkehren in die App und regelmäßig im Hintergrund werden neuere Daten anderer Geräte übernommen.
- Remote-Aktualisierungen lösen keinen unnötigen Gegenspeicher-Lauf mehr aus.
- Offene Teilaufträge von Serienaufträgen übernehmen jetzt alle Leistungen und Checklistenpunkte des Hauptauftrags.
- Wöchentliche Serienaufträge erzeugen jetzt Teilaufträge für alle ausgewählten Wochentage statt nur für das Startdatum.
- In der Auftragsanlage kann Mo-Fr direkt über die Auswahl Werktage gesetzt werden.
- Archivierte, aber bereits zugeordnete Leistungen bleiben in bestehenden Aufträgen und Einsätzen auswertbar.

## 1.73.0 - 2026-08-17

- Kundenportal ist jetzt direkt über die eigene URL `/portal` erreichbar.
- Die Portal-URL öffnet eine eigenständige Kundenansicht ohne interne Verwaltungsnavigation.
- Portal-Seite verwendet das Kolaretorp-Logo und eine reduzierte Kopfzeile für Kunden.

## 1.72.0 - 2026-08-16

- Kundenportal als eigener Bereich mit Kundenanmeldung per E-Mail ergänzt.
- Kunden sehen im Portal nur ihre zugeordneten Objekte, freigegebenen Berichte, offene Aufträge und vorbereitete Rechnungspositionen.
- Portal-Login-E-Mail und Passwort können intern in den Kundenstammdaten gepflegt werden.
- Kunden sehen im Portal ihre eigenen Stammdaten, aber keine internen Zugangsdaten.
- Kunden können Nachrichten und neue Aufträge anlegen; Kolaretorp erhält dazu eine E-Mail an info@kolaretorp.se.
- Portal-Nachrichten werden im App-Snapshot gespeichert und bleiben nach Versionswechseln erhalten.

## 1.71.0 - 2026-08-16

- Kundenberichte zeigen im Kopf jetzt das Kolaretorp-Logo statt nur Text.
- PDF-Berichte verwenden das Kolaretorp-Logo im Header mit Text-Fallback.

## 1.70.0 - 2026-08-16

- Beim Berichtversand wird jetzt die aktuelle E-Mail-Adresse aus den Objektstammdaten bevorzugt verwendet.
- Versandvorschau, Objektverlauf, Berichtsanzeige und tatsächlicher Mailversand zeigen dieselbe Empfängeradresse.
- Der Versand meldet einen klaren Fehler, wenn weder Objekt noch Kunde eine E-Mail-Adresse enthalten.

## 1.69.0 - 2026-08-16

- Doppelte Berichte werden beim Laden, Synchronisieren und Speichern fachlich zusammengeführt.
- Bericht-Dubletten mit deutschem und ISO-Datumsformat werden als gleicher Bericht erkannt.
- Mobil vor Ort zeigt abgeschlossene Berichte mit Berichtszustand statt irreführendem Auftragsstatus an.
- Stammdatenfelder behalten beim Versionswechsel den neueren lokalen oder Supabase-Stand statt pauschal überschrieben zu werden.

## 1.68.0 - 2026-08-16

- Objektbilder werden beim Zusammenführen von lokalen Daten und Supabase-Daten nicht mehr durch ältere Objektstände verdrängt.
- Objekt-Mediendaten werden pro Objekt zusammengeführt und vorhandene Bildvorschauen bevorzugt erhalten.
- Neue Objektbilder werden stärker komprimiert, damit iPhone-Fotos stabil im Supabase-Snapshot gespeichert werden können.

## 1.67.0 - 2026-08-16

- Mobil vor Ort speichert Einsatznotizen jetzt als eigenen Zwischenstand in LocalStorage und Supabase.
- Minuten und Hinweise der Checklistenpunkte werden beim Verlassen des Feldes nochmals gespeichert.
- Zwischenstände bleiben beim Abwählen oder Verlassen des Einsatzes erhalten, bis der Einsatz abgeschlossen wird.

## 1.66.0 - 2026-08-16

- Aufgenommene Kontrollpunkt-Fotos werden in Mobil vor Ort direkt als Vorschau angezeigt.
- Die Foto-Aktionsbuttons im Kontrollpunkt sind jetzt kompakte Icon-Buttons.

## 1.65.0 - 2026-08-16

- Nach dem Abschließen eines Einsatzes fragt die App jetzt, ob der erzeugte Bericht geöffnet werden soll.
- Der Abschlussdialog zeigt direkt eine Berichtsvorschau.
- Aus dem Abschlussdialog kann direkt die Versandvorschau zum Kundenbericht geöffnet werden.

## 1.64.0 - 2026-08-16

- Bericht senden öffnet jetzt zuerst eine Versandvorschau mit Empfänger, CC, Betreff, Body und PDF-Anhang.
- Der Versand wird erst nach Bestätigung in der Vorschau ausgelöst.
- In der Vorschau ist der Kundenbericht vor dem Senden sichtbar.

## 1.63.0 - 2026-08-16

- Berichtversand läuft jetzt über einen serverseitigen API-Endpunkt mit PDF-Anhang.
- Kundenberichte werden nur nach erfolgreichem Mailversand als gesendet markiert und gesperrt.
- Für Kundenberichte wird kein Resend-Testabsender mehr verwendet, damit die Domain-Verifizierung sauber erzwungen wird.

## 1.62.0 - 2026-08-16

- Bericht senden erzeugt jetzt eine PDF-Datei und übergibt sie per Geräte-Teilen als Anhang.
- Mailtext und Betreff werden nach Kolaretorp-Vorgabe vorbereitet.
- Gesendete Berichte werden gesperrt und können danach nicht mehr verändert werden.
- Bericht senden ist jetzt auch in Mobil vor Ort verfügbar.

## 1.61.0 - 2026-08-16

- Abgeschlossene Berichte können in Mobil vor Ort wieder mit ihrer Checkliste nachbearbeitet werden.
- Die mobile Berichtsbearbeitung findet abgeschlossene Aufträge jetzt auch dann, wenn sie nicht in der gekürzten offenen Arbeitsliste stehen.

## 1.60.0 - 2026-08-16

- Auftragsübersicht bietet jetzt eine Statusfilter-Leiste.
- Erledigte, abgerechnete und stornierte Aufträge werden in der Übersicht unten einsortiert.
- Serienaufträge werden beim Filtern berücksichtigt, wenn ein Teilauftrag den gewählten Status hat.

## 1.59.0 - 2026-08-16

- Erledigte, abgerechnete und stornierte Einsätze werden in der Dashboard-Arbeitsliste nicht mehr angezeigt.
- Dashboard zeigt einen leeren Zustand, wenn keine offenen Einsätze vorhanden sind.

## 1.58.0 - 2026-08-16

- Auftragsübersicht ist jetzt nach dem nächsten relevanten Termin sortiert.
- Bei Serienaufträgen zählt dafür der nächste offene Teilauftrag.

## 1.57.0 - 2026-08-16

- Serieninformationen in der Auftragsübersicht stehen jetzt direkt in der Titelzeile neben dem Auftragstitel.
- Die rechte Aktionsspalte bleibt dadurch kompakter und besser scannbar.

## 1.56.0 - 2026-08-16

- Serienaufträge werden in der Auftragsübersicht kompakter mit separaten Chips für Rhythmus, letzten und nächsten Teilauftrag dargestellt.
- Die Auftragszeilen brechen auf kleineren Bildschirmen sauber um, statt lange Serienhinweise abzuschneiden.

## 1.55.0 - 2026-08-16

- Dashboard, Einsatzplanung und Mobil vor Ort zeigen pro Serienauftrag nur noch den nächsten relevanten Teilauftrag.
- Offene Listen kennzeichnen Teilaufträge jetzt als Serienauftrag mit dem hinterlegten Rhythmus.
- Die vollständige interne Auftragsliste der Serie bleibt in der Auftragsübersicht aufklappbar.

## 1.54.0 - 2026-08-16

- Auftragsübersicht zeigt Serien wieder als Hauptauftrag mit aufklappbaren Teilaufträgen.
- Serienstatus nennt letzten erledigten Teilauftrag und den nächsten offenen oder laufenden Teilauftrag.
- Teilaufträge können aus der aufgeklappten Serienansicht direkt bearbeitet, gestartet, storniert oder reaktiviert werden.

## 1.53.0 - 2026-08-16

- Serienaufträge erzeugen jetzt konkrete interne Teilaufträge, die einzeln bearbeitet, gestartet oder storniert werden können.
- Der Serienauftrag Bolet - Rasenmähen erzeugt die noch offenen Termine 27.08.2026 und 10.09.2026 bis zum Enddatum.
- Nie endende Serien werden rollierend für die nächsten 6 Monate als interne Auftragsliste vorbereitet.
- Aufträge können jetzt storniert und bei Bedarf wieder reaktiviert werden.

## 1.52.0 - 2026-08-16

- Serienaufträge bleiben nach einem erledigten Termin offen, wenn weitere Termine folgen.
- Bei Serienaufträgen wird der nächste Fälligkeitstermin automatisch fortgeschrieben.
- Mobil vor Ort zeigt abgeschlossene Berichte zur Nachbearbeitung an.
- Bestehende Einsatzberichte können mobil geöffnet, geändert und erneut gespeichert werden.

## 1.51.0 - 2026-08-12

- Aufträge können jetzt konkrete Leistungen aus den Stammdaten enthalten.
- In der Auftragsanlage können eigene Leistungen mit eigenen Checklistenpunkten erfasst werden.
- Mobil vor Ort zeigt nur noch die Checklistenpunkte der im Auftrag hinterlegten Leistungen.

## 1.50.0 - 2026-08-12

- Geräte-Synchronisation führt lokale und Supabase-Daten beim Start zusammen.
- Aufträge, Kunden, Objekte und Berichte, die nur auf einem Gerät vorhanden sind, werden nicht mehr verdrängt.
- Fehlende lokale Datensätze werden nach dem Öffnen automatisch nach Supabase übernommen.

## 1.49.0 - 2026-08-12

- Tägliche Auftragsmail nutzt jetzt eine explizite Empfängeradresse.
- Mailversand fällt bei noch nicht verifizierter Kolaretorp-Domain auf die Resend-Testadresse zurück.
- Cron-Endpunkt gibt Versanddetails für den Testlauf zurück.

## 1.48.0 - 2026-08-10

- Supabase-Projekt wurde verknüpft und die app_state Tabelle per Migration angelegt.
- Serverseitige App-State-API normalisiert gespeicherte Snapshots robuster.
- Dauerhafte Speicherung von Kunden, Objekten, Aufträgen, Bildern und Dokumenten ist wieder aktiv.

## 1.47.0 - 2026-08-10

- App-Daten werden jetzt über eine serverseitige App-State-API in Supabase gespeichert.
- Vercel-Production nutzt nun die Supabase-Umgebungsvariablen für dauerhafte Kunden, Objekte, Aufträge, Bilder und Dokumente.

## 1.46.0 - 2026-08-10

- Vercel Cron auf Hobby-kompatiblen täglichen Lauf umgestellt.
- Cachefreier Versions-Endpunkt zur Prüfung des live deployten Stands ergänzt.

## 1.45.0 - 2026-08-10

- Tägliche Auftragsliste per Vercel Cron und Resend vorbereitet.
- Änderungsverlauf zeigt nun alle Versionen scrollbar an.
- Dashboard-Arbeitsliste ist kompakter und auf maximal zwei Zeilen pro Auftrag ausgelegt.

## 1.44.0 - 2026-08-10

- Beim Abwählen eines mobilen Auftrags springt der Status von in Arbeit zurück auf geplant.
- Aktionsbuttons in der Auftragsübersicht sind kleiner und kompakt in der oberen rechten Zeile platziert.

## 1.43.0 - 2026-08-10

- Berichte aus Objektakte und Berichte-Menü verwenden jetzt dieselbe Einsatzbericht-Komponente.
- Berichte-Menü zeigt nun ebenfalls Objektbild, Objektinformationen und Kontrollpunkt-Fotos.
- Mobil vor Ort kann einen geöffneten Auftrag wieder abwählen und zur Auftragsliste zurückkehren.
- Info-Kacheln im oberen Bereich sind kompakter gestaltet.
- Test prüft, dass die Berichtsliste Objektbild und Einsatzfotos anzeigt.

## 1.42.0 - 2026-08-10

- Mobil vor Ort zeigt jetzt alle offenen Aufträge als klickbare Liste.
- Beim Anklicken eines offenen Auftrags wird dieser direkt als aktiver Vor-Ort-Einsatz geöffnet.
- Der Mobilbereich zeigt einen leeren Zustand, wenn keine offenen Aufträge vorhanden sind.

## 1.41.0 - 2026-08-10

- App-Daten werden als zentraler Snapshot nach Supabase synchronisiert.
- Objekte, Dokumente, Fotos, Aufträge, Berichte und Vor-Ort-Fortschritt bleiben dadurch nach Versionswechseln erhalten.
- Berichte-Zähler öffnet jetzt eine eigene Berichtsliste mit Objektzuordnung und Detailansicht.
- Supabase-Schema enthält eine app_state Tabelle für die aktuelle Arbeitsdaten-Persistenz.

## 1.40.0 - 2026-08-10

- Objektbearbeitung zeigt keinen doppelten Kopf mit Objektstammdaten und Objekt bearbeiten mehr.
- Objektbild ist kompakter in den oberen Bearbeitungskopf integriert.
- Tests wurden auf den neuen aufgeräumten Objektkopf angepasst.

## 1.39.0 - 2026-08-10

- Dokumente in der Objektakte öffnen beim Anklicken eine Vorschau mit Druckfunktion.
- Objektfotos öffnen beim Anklicken einen großen Fotoviewer mit Druckfunktion.
- PDF-, Bild- und Textdateien werden im Viewer direkt dargestellt, große Office-Dateien als Metadatenvorschau.

## 1.38.0 - 2026-08-10

- Objekthistorie ist jetzt eingeklappt und zeigt Berichte kompakt zweizeilig an.
- Berichtsdetails klappen erst nach Klick auf den Historieneintrag auf.
- Aktiver Einsatz wird lokal gespeichert und nach Reload oder Versionswechsel wiederhergestellt.
- Vor-Ort-Fotos werden vor dem Speichern verkleinert, damit Status und Bilder stabil erhalten bleiben.

## 1.37.0 - 2026-08-10

- Der Abschnitt Dokumente in der Objektakte wurde aus dem Kundenbericht entfernt.
- PDF-Druck erhält eine Seitenfußzeile mit Seite x von y Seiten.
- Drucklayout blendet die restliche App-Struktur aus, damit nach den Kontrollpunkten keine leeren Seiten entstehen.
- Der Senden-Button protokolliert den Versand jetzt mit sichtbarer Rückmeldung.

## 1.36.0 - 2026-08-10

- Aufträge, Status, Berichte und Einsatzfotos werden jetzt lokal gespeichert und nach Reload wiederhergestellt.
- Kunden, Leistungen, Pakete und Mobil-vor-Ort-Fortschritt bleiben ebenfalls erhalten.
- Test prüft jetzt, dass ein abgeschlossener Einsatzbericht inklusive Foto und Kommentar nach Seitenreload bestehen bleibt.

## 1.35.0 - 2026-08-10

- Arbeitszeit im Einsatzbericht zählt nur noch ausgeführte Checklistenpunkte.
- Nicht ausgeführte Punkte bleiben im Bericht sichtbar, werden aber mit 0 Minuten ausgewiesen.
- Minutenfelder nicht ausgeführter Punkte sind in Mobil vor Ort deaktiviert.

## 1.34.0 - 2026-08-10

- Der Abschnitt Bilder zum Objekt / Einsatz wurde aus dem Bericht entfernt.
- Das Objektbild erscheint nur noch oben im Berichtskopf.
- Kontrollpunktfotos werden sofort und direkt am jeweiligen Einsatzpunkt angezeigt.

## 1.33.0 - 2026-08-10

- Fotos aus Kontrollpunkten werden jetzt direkt beim jeweiligen Punkt im Bericht angezeigt.
- Berichtskopf zeigt das Objektbild oben mit klarer Objekt- und Auftragskennung.
- Berichtsinformationen wurden in kompakte professionelle Karten für Objekt, Kunde, Auftrag und Leistung aufgeteilt.

## 1.32.0 - 2026-08-10

- PDF-Bericht verwendet echte Bild-Elemente, damit Fotos im Chrome-PDF zuverlässig erscheinen.
- PDF-Bericht wurde kompakter gestaltet mit dichterer Kopfzeile, kleineren Einzelpunkten und reduzierten Abständen.
- Bildergalerien im Bericht nutzen im Druck bis zu drei Spalten.

## 1.31.0 - 2026-08-10

- Mobil-vor-Ort-Eingaben werden jetzt pro Auftrag gespeichert, auch beim Wechsel zwischen Menüpunkten.
- Abhakungen, Zeiten, Hinweise und Fotos werden vollständig in den Einsatzbericht übernommen.
- Fotos aus Checklistenpunkten werden im Kundenbericht mit Dateiname und Vorschau angezeigt.

## 1.30.0 - 2026-08-10

- Einsatzabschluss erzeugt jetzt einen strukturierten Bericht aus allen Checklistenpunkten.
- Bericht zeigt pro Punkt Status, Zeit, Hinweis und erfasste Bilder, auch wenn ein Punkt nicht ausgeführt wurde.
- Zu jedem Bericht kann vor dem Senden ein Kundenkommentar gepflegt werden.

## 1.29.0 - 2026-08-10

- Mobil-vor-Ort-Ansicht verwendet jetzt die normalen App-Farben statt einer separaten dunklen Geräteoptik.
- Checklisten, Eingabefelder, Foto-Buttons und Foto-Bestätigung passen sich nun sauber an Hell- und Dunkelmodus an.

## 1.28.0 - 2026-08-10

- PDF-Ausgabe nutzt jetzt einen professionell gestalteten Kundenbericht statt der normalen App-Ansicht.
- Einsatzbericht enthält Berichtsnummer, Kunde, Objekt, Auftrag, Termin, Priorität, Abrechnung, Checkliste, Medien und Bilder.
- Drucklayout blendet Navigation und Bearbeitungsflächen aus und fokussiert auf den PDF-Bericht.

## 1.27.0 - 2026-08-10

- Kundendaten enthalten jetzt einen individuell anpassbaren Mailtext für Einsatzberichte.
- Der Berichtversand ersetzt den Platzhalter `{Vorname}` automatisch durch den Ansprechpartner des Kunden.
- Objektberichte verwenden Empfänger und Mailtext aus den zugeordneten Kundenstammdaten.

## 1.26.0 - 2026-08-10

- Kundenbericht zeigt eine professionellere Einsatzbericht-Karte mit Objekt, Auftrag, Zeiten, Material, Checkliste und Medien.
- Berichtversand protokolliert Zeitstempel, Betreff, Empfänger, Kopie und PDF-Anhang.
- E-Mail-Betreff folgt dem Format Einsatzbericht - Kolaretorp Service AB - Objektbezeichnung.
- Beim Berichtversand wird info@kolaretorp.se als Kopie ausgewiesen.
- E-Mail-Body enthält eine persönliche Anrede mit Berichtshinweis und Rückfragen-Satz.

## 1.25.0 - 2026-08-10

- Fotos zum Objekt enthalten den Button Neues Foto hinzufügen direkt im Abschnitt.
- Dokumente zum Objekt haben einen eigenen Abschnitt mit Büroklammer-Upload.
- Separate Upload-Kacheln oberhalb der Foto- und Dokumentbereiche wurden entfernt.

## 1.24.0 - 2026-08-09

- Objektbild wird in der Objektbearbeitung rechts oben ohne Dateinamen angezeigt.
- Fotos zum Objekt werden als eigene Galerie dargestellt.
- Dokumente und Grundrisse bleiben getrennt in der Medienakte.

## 1.23.0 - 2026-08-09

- Objektbilder werden vor dem lokalen Speichern automatisch verkleinert.
- Lokales Speichern fängt Speicherlimit-Fehler ab, damit die App nicht mehr abstürzt.
- Test prüft jetzt auch das Speichern eines Objektbildes an einem zweiten Objekt.

## 1.22.0 - 2026-08-09

- Objekte werden beim Bearbeiten jetzt als eigene Seite statt als Popup geöffnet.
- Zurück-Pfeil führt aus der Objektbearbeitung zurück in die Objektübersicht.
- Historie und Verlauf sind direkt in der Objektbearbeitung eingebettet.
- Objektbilder werden in Übersicht und Bearbeitungsmodus angezeigt.
- Hochgeladene Objektbilder bleiben nach dem Aktualisieren lokal erhalten.
- Bilder können als Objektbild gesetzt und Medien in der Akte verschoben werden.
- Intervall- und Jahresrhythmusfelder im Serienauftrag wurden weiter verkleinert.

## 1.21.0 - 2026-08-09

- Intervall- und Jahresrhythmusfelder im Serienauftrag sind jetzt kompakt.
- Zahlenfelder im Serienblock werden nicht mehr auf volle Spaltenbreite gestreckt.

## 1.20.0 - 2026-08-09

- Serienaufträge können jetzt auf einen saisonalen Zeitraum begrenzt werden.
- Gültigkeit wie Mai bis September wird in der Auftragsübersicht mit angezeigt.
- Jahresrhythmus unterstützt jedes Jahr oder alle x Jahre.
- Intervallfeld im Serienblock wurde schmaler gestaltet.

## 1.19.0 - 2026-08-09

- Auftragsanlage zeigt Einmalauftrag oder Serienauftrag jetzt klar als Kalenderblock.
- Serienauftrag erhält eine sofort sichtbare Zusammenfassung aus Rhythmus, Intervall, Wochentagen und Ende.
- Intervallfeld wurde für die wiederkehrende Planung eindeutiger beschriftet.

## 1.18.0 - 2026-08-09

- Objektakte zeigt jetzt eine Historie aus Aufträgen und Berichten.
- Verlaufseinträge öffnen alle relevanten Details inklusive Auftragsdaten, Bericht, internen Notizen und Medien.
- Berichte können aus der Objektakte per PDF-Ausgabe vorbereitet und als an Kunden gesendet markiert werden.
- Auftragsübersicht wurde auf kompakte zweizeilige Zeilen mit Aktionsicons verdichtet.

## 1.17.0 - 2026-08-09

- Bild erfassen ist jetzt pro Checklistenpunkt als Kamera-Icon verfügbar.
- Aufgenommene Fotos werden direkt am jeweiligen Checklistenpunkt bestätigt oder neu erfasst.
- Allgemeiner Foto-Button am Ende der mobilen Einsatzkarte wurde entfernt.

## 1.16.0 - 2026-08-09

- Preis und Währung im Leistungsformular stehen jetzt kompakt in einer Zeile.
- Währungsfeld wurde auf eine schmale Auswahl neben dem Preis reduziert.

## 1.15.0 - 2026-08-09

- Standardzeit-Feld im Leistungs-Checklisten-Editor kompakter gestaltet.
- Checklistenformular verhindert horizontales Überlaufen der Eingabefelder.

## 1.14.0 - 2026-08-09

- Aufträge können als einmaliger Auftrag oder Serienauftrag angelegt werden.
- Serienaufträge erhalten Kalender-ähnliche Wiederholung mit Frequenz, Intervall, Wochentagen und Ende.
- Mobile Auftragsbearbeitung unterstützt Bild erfassen, Foto benutzen und neues Foto.
- Zeitfeld in der mobilen Checkliste ist kompakter und überlappt den Hinweisbereich nicht mehr.

## 1.13.0 - 2026-08-09

- Leistungen enthalten jetzt detaillierte Checklistenpunkte mit Hinweis und Standardzeit.
- Leistungspreise haben ein separates Währungsfeld.
- Mobile Auftragsbearbeitung zeigt beim Start die Checklistenpunkte aus dem Objektpaket.
- Einsatzkräfte können pro Punkt abhaken, Zeit erfassen und Hinweise notieren.
- Gestartete Aufträge öffnen zuverlässig den ausgewählten Auftrag statt den ersten laufenden Einsatz.

## 1.12.0 - 2026-08-09

- Aktionsbuttons werden in Listen und Stammdaten konsistent als Iconbuttons dargestellt.
- Iconbuttons zeigen beim Hover und Tastaturfokus einen Tooltip mit der jeweiligen Funktion.
- Auftragsaktionen nutzen jetzt ebenfalls Iconbuttons für Bearbeiten und Starten.
- Entfernen-Aktionen in Objekt- und Kundenformularen nutzen die gleiche Buttonlogik.

## 1.11.0 - 2026-08-09

- Neue Leistungen starten ohne vorbelegte Kategorie und Einheit.
- Leistung, Kategorie und Einheit sind Pflichtfelder ohne automatische Fallback-Werte.
- Einheit ist jetzt ebenfalls ein lernendes Dropdownfeld aus vorhandenen Einheiten.
- Kategorie- und Einheitsvorschläge öffnen beim Fokus, wenn der Browser dies unterstützt.

## 1.10.0 - 2026-08-09

- Archivierte Objekte, Kunden, Leistungen und Pakete können weiterhin bearbeitet werden.
- Archivierte Datensätze lassen sich per Reaktivieren-Button wieder in die aktiven Übersichten zurückholen.
- Speichern archivierter Datensätze erhält den Archivstatus bis zur bewussten Reaktivierung.
- Playwright-Test prüft Bearbeiten und Reaktivieren archivierter Stammdaten.

## 1.9.0 - 2026-08-09

- Leistungen im Paket werden über einen Plus-Button in einem Auswahl-Popup gepflegt.
- Leistungsauswahl ist nach Kategorie gruppiert und alphabetisch sortiert.
- Paketformular zeigt nur noch eine kompakte Zusammenfassung der ausgewählten Leistungen.
- Playwright-Test prüft den neuen Paket-Leistungswähler.

## 1.8.0 - 2026-08-09

- Doppelten Firmennamen aus dem Kopfbereich entfernt.
- Dashboard-Arbeitskacheln zentrieren ihre Inhalte.
- Leistungen und Pakete nutzen Icon-Buttons zum Bearbeiten und Archivieren.
- Archivierung prüft aktive Nutzung bei Kunden, Objekten und Paketen.
- Archivierte Leistungen, Pakete, Kunden und Objekte können endgültig gelöscht werden.

## 1.7.0 - 2026-08-09

- Objektakte wird nur noch im Menüpunkt Objekte angezeigt.
- Alle anderen Menüpunkte nutzen wieder die volle Arbeitsbreite ohne Objektakten-Seitenblock.
- Playwright-Test prüft die eingeschränkte Sichtbarkeit der Objektakte.

## 1.6.0 - 2026-08-09

- Leistungen können in den Stammdaten bearbeitet und gespeichert werden.
- Pakete können bearbeitet und mit geänderten Leistungszuordnungen gespeichert werden.
- Kategorie-Feld der Leistungen als lernendes Dropdown mit bestehenden Kategorien umgesetzt.
- Playwright-Test prüft Bearbeitung von Leistungen, Paketbearbeitung und neue Kategorien.

## 1.5.0 - 2026-08-09

- Kunden können im Bearbeiten-Dialog Objekte per Dropdown zugeordnet bekommen.
- Kunden-Objekt-Zuordnung synchronisiert Eigentümerdaten zurück in die Objektstammdaten.
- Zugeordnete Objekte können aus der Kundenmaske wieder entfernt werden.
- Kundenübersicht kompakter gestaltet: Bearbeiten-Button rechts und Kundendaten auf zwei Zeilen begrenzt.

## 1.4.0 - 2026-08-09

- Stammdatenmodul in einzelne Leistungen und Leistungspakete aufgeteilt.
- Neue Leistungen können mit Kategorie, Einheit, Preis und Beschreibung angelegt werden.
- Pakete können aus mehreren vorhandenen Leistungen zusammengestellt werden.
- Paketkarten zeigen die enthaltenen Leistungen als Tags.
- Playwright-Test prüft Leistungserfassung und Paketbildung.

## 1.3.0 - 2026-08-09

- Objektübersicht zeigt je Objektzeile einen eigenen Bearbeiten-Button.
- Objekt-Bearbeitung öffnet in einem deutlich größeren Dialog.
- Rechte Objektakte wurde auf Hauptstammdaten bis einschließlich Objektadresse gekürzt.
- Globaler Neuer-Auftrag-Button aus der Kopfzeile entfernt; Aufträge werden im Auftragsbereich angelegt.

## 1.2.0 - 2026-08-09

- Objekte können einem Eigentümer aus den Kundenstammdaten zugeordnet werden.
- Objektadresse, Eigentümeradresse und Rechnungsadresse werden getrennt gepflegt.
- Rechnungsadresse kann aus Objektadresse, Eigentümeradresse oder einer abweichenden Adresse gewählt werden.
- Bilder, Handy-Fotos, Dokumente und Grundrisse können in der Objektmaske erfasst werden.
- Dokumente erhalten eine Kurzbeschreibung und erscheinen in der Objektakte.
- Objektakte zeigt ein Objektfoto als Vorschau und einen Korrespondenzverlauf aus Nachrichten und gesendeten Einsatzberichten.
- Kundenformular zeigt nur zugeordnete Objekte und enthält ein internes Notizfeld.
- Farbsystem an Apple-nahe neutrale Grautöne mit sparsamer blauer Aktionsfarbe angepasst.
- Kolaretorp-Logo aus der Website als App-Branding eingebunden.

## 1.1.0 - 2026-08-09

- Objekte können direkt aus der Objektakte heraus bearbeitet und gespeichert werden.
- Objektformular um Eigentümerkontakt, Status, Baujahr, Zugang, Technik, Medienzahlen und Besuchsplanung erweitert.
- Stammdatenänderungen aktualisieren die bestehende Objektakte statt ein neues Objekt anzulegen.
- Kunden können angelegt und bearbeitet werden, inklusive Kontakt, Portalstatus und Objektzuordnung.
- Aufträge können angelegt und bearbeitet werden.
- Berichte und Kommunikation hängen nun objektbezogen in der Objektakte und sind nicht mehr als eigene Hauptmenüpunkte sichtbar.
- Die Objektakte wird nur noch in Bereichen mit echtem Objektkontext angezeigt, nicht mehr in Stammdaten, Kunden, Aufträgen oder Abrechnung.
- Übersichtskacheln im Kopfbereich sind jetzt klickbare, zentrierte Sprungbuttons zu Objekten, Einsatzplanung, Berichten und Abrechnung.
- Versionsanzeige in der unteren Menüspalte deutlicher dargestellt.
- Playwright-Test prüft Objekt-, Kunden- und Auftragsanlage inklusive Bearbeitung und Quickbar-Navigation.

## 1.0.0 - 2026-07-31

- App-Oberfläche als ruhige, tabellenorientierte Arbeitssoftware neu aufgebaut.
- Objektakte als zentrale Detailansicht mit Stammdaten, Eigentümer, Zugang, Technik, Ausstattung, Risiken, Medien und Protokoll umgesetzt.
- Objektanlage fachlich neu strukturiert mit sinnvollen Feldern für Ferienhausverwaltung.
- Auftragsanlage, Einsatzplanung, mobile Bearbeitung, Berichte, Kommunikation, Abrechnung und Stammdaten neu ausgerichtet.
- E2E-Test auf die neuen Kernflows Objektanlage, Auftrag, Planung, mobile Bearbeitung und Stammdaten umgestellt.

## 0.9.0 - 2026-07-31

- Dashboard in Richtung einer HERO-artigen Funktionszentrale weiterentwickelt.
- Drei Kernmodule für Kommunikation, Finanzen und Automatisierung ergänzt.
- Feature-Gruppen für Büro, Vor-Ort-Arbeit, Team, Objekte/Kunden und Finanzen ergänzt.
- Schnittstellen bewusst nicht als eigener Bereich aufgenommen.
- Playwright-Test prüft die neue Funktionszentrale.

## 0.8.1 - 2026-07-31

- Kopfbereich kompakter gestaltet und Überschrift auf maximal zwei Zeilen begrenzt.
- Sprachumschaltung von einzelnen Buttons auf ein Dropdownfeld umgestellt.
- Versionschip aus der Topbar entfernt, weil die Version bereits in der Sidebar verfügbar ist.
- Dashboard-Hero und Übersichtsdaten deutlich kompakter dargestellt.

## 0.8.0 - 2026-07-31

- Leistungskatalog aus der Kolaretorp-Broschüre als Stammdaten ergänzt.
- Betreuungspakete Basis, Plus, Komfort und Premium mit Preisen, Kontrollanzahl und Leistungsumfang angelegt.
- Zusatzleistungen Hauskontrolle, Gartenpflege, Schlüsselservice, Hausmeisterservice, Reinigung und Notdienst ergänzt.
- Neue Leistungen können im Katalog lokal angelegt und danach für Aufträge genutzt werden.
- Objektstammdaten um Eigentümer, Adresse, Größe, Räume, Betten, Betreuungspaket, Zugang, Ausstattung, Hinweise, Bilder und Dokumente erweitert.
- Objektakte zeigt verknüpfte Einsätze, Berichte, Kommunikation und Abrechnungspositionen.
- Supabase-Objekttabelle um technische Stammdaten, Medien- und Hinweisfelder erweitert.
- Supabase-Servicekategorien um Paket-, Preis-, Intervall-, SLA- und Leistungsumfangfelder erweitert.
- Playwright-Test prüft Sichtbarkeit der Broschürenleistungen, Neuanlage einer Leistung und umfangreiche Objektanlage.

## 0.6.0 - 2026-07-31

- Berichtsmodul mit Kunden- und interner Sicht, Medienübersicht und PDF-Vorbereitung ergänzt.
- Auftragsanlage um Priorität, Fälligkeitsdatum, Zuständigkeit, Beschreibung und interne Notizen erweitert.
- Einsatzplanung um Filter nach Mitarbeiter, Dienstleistung und Status sowie Kennzahlen für offen, heute und überfällig ergänzt.
- Mobile Einsatzbearbeitung mit Start, Pause, Abschluss, Arbeitszeit, Material, Notizen und Medien-Zählern ausgebaut.
- Kundenanlage und Kundenportal-Auftragsanfrage ergänzt.
- Abrechnungspositionen können aus Einsätzen entstehen oder manuell ergänzt werden.
- Supabase-Schema um Medien, Kundenkommunikation, Abrechnung, Rollen und Sichtbarkeitsfelder erweitert.

## 0.5.0 - 2026-07-31

- Dashboard als Sprungbrett in Stammdaten, Objekte, Kunden, Leistungskatalog, Aufträge, Termine, Kommunikation, Abrechnung und Freigaben erweitert.
- Stammdatenübersicht mit logischen Schnellaktionen ergänzt.
- Kundenübersicht mit Kontakt, Sprache, Objektbezug, Portalaktion und Saldo aufgebaut.
- Dienstleistungskatalog mit Kategorien, Intervallen, Preisen, Einheiten und SLA ergänzt.
- Kommunikationsübersicht und Abrechnungsmodul mit klickbaren Vorgängen ergänzt.
- Farbsystem harmonisch überarbeitet und Darkmode beibehalten.
- Playwright-E2E-Test um neue Modulnavigation und zentrale Aktionen erweitert.

## 0.4.0 - 2026-07-30

- Hauptnavigation in fachliche Bereiche umgebaut.
- Auftragsübersicht, Objektübersicht, Einsatzplan und Freigabeübersicht ergänzt.
- `Aufträge` öffnet jetzt eine Übersicht statt direkt den Neuanlage-Dialog.
- Neue Objektanlage mit eigenem Formular ergänzt.
- Objektakte zeigt jetzt echte Objektdaten.
- Aufträge können in die mobile Einsatzansicht gestartet und zur Freigabe markiert werden.
- Freigaben können in der Freigabeübersicht abgeschlossen werden.
- Playwright-E2E-Test für zentrale Button- und Navigationspfade ergänzt.

## 0.3.0 - 2026-07-30

- Versionsanzeige in Sidebar und Topbar ergänzt.
- Versionsdialog mit aktuellem Änderungsverlauf eingebaut.
- Zentrale Versionsdaten unter `lib/appVersion.ts` angelegt.
- `package.json` und `package-lock.json` auf Version `0.3.0` gesetzt.

## 0.2.0 - 2026-07-30

- Harmonisches neues Farbsystem eingebaut.
- Darkmode mit gespeicherter Browser-Auswahl ergänzt.
- Objekt-Auswahl und Leistungsfilter verbessert.
- UI-Zustände für aktive Karten und Listen poliert.

## 0.1.0 - 2026-07-30

- Erste Ferienhausverwaltungs-App für Kolaretorp Service AB erstellt.
- Mehrsprachige Verwaltung, Kundenportal-Ansicht und mobile Einsatzansicht aufgebaut.
- Supabase-Datenquelle mit Demo-Fallback angebunden.
- Wichtige Dashboard-Buttons und lokale Auftragsanlage klickbar gemacht.
