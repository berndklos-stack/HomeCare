export const appVersion = {
  version: "1.75.0",
  releaseDate: "2026-08-17",
  label: "Kolaretorp Service App",
};

export const versionHistory = [
  {
    version: "1.75.0",
    date: "2026-08-17",
    changes: [
      "Kundenportal zeigt Serienaufträge kompakt als Hauptauftrag mit ausklappbaren Teilaufträgen",
      "Kunden können freigegebene Berichte öffnen und über die PDF-/Druckausgabe herunterladen",
      "Auftragsanlage im Kundenportal nutzt jetzt die vollständige Admin-Logik mit Leistungen, eigener Leistung, Checkliste und Serienauftrag",
      "Kunden können im Portal ihre E-Mail-Adresse und Telefonnummer selbst aktualisieren",
      "Portal-Kopf zeigt das Kolaretorp-Logo mit Willkommenszeile",
      "Anmeldemaske im Kundenportal zeigt jetzt das Logo und keine Demo-Zugänge mehr",
    ],
  },
  {
    version: "1.74.0",
    date: "2026-08-17",
    changes: [
      "Offene App-Fenster aktualisieren Daten jetzt automatisch aus Supabase",
      "Beim Zurückkehren in die App und regelmäßig im Hintergrund werden neuere Daten anderer Geräte übernommen",
      "Remote-Aktualisierungen lösen keinen unnötigen Gegenspeicher-Lauf mehr aus",
      "Offene Teilaufträge von Serienaufträgen übernehmen jetzt alle Leistungen und Checklistenpunkte des Hauptauftrags",
      "Wöchentliche Serienaufträge erzeugen jetzt Teilaufträge für alle ausgewählten Wochentage statt nur für das Startdatum",
      "In der Auftragsanlage kann Mo-Fr direkt über die Auswahl Werktage gesetzt werden",
      "Archivierte, aber bereits zugeordnete Leistungen bleiben in bestehenden Aufträgen und Einsätzen auswertbar",
    ],
  },
  {
    version: "1.73.0",
    date: "2026-08-17",
    changes: [
      "Kundenportal ist jetzt direkt über die eigene URL /portal erreichbar",
      "Die Portal-URL öffnet eine eigenständige Kundenansicht ohne interne Verwaltungsnavigation",
      "Portal-Seite verwendet das Kolaretorp-Logo und eine reduzierte Kopfzeile für Kunden",
    ],
  },
  {
    version: "1.72.0",
    date: "2026-08-16",
    changes: [
      "Kundenportal als eigener Bereich mit Kundenanmeldung per E-Mail ergänzt",
      "Kunden sehen im Portal nur ihre zugeordneten Objekte, freigegebenen Berichte, offene Aufträge und vorbereitete Rechnungspositionen",
      "Portal-Login-E-Mail und Passwort können intern in den Kundenstammdaten gepflegt werden",
      "Kunden sehen im Portal ihre eigenen Stammdaten, aber keine internen Zugangsdaten",
      "Kunden können Nachrichten und neue Aufträge anlegen; Kolaretorp erhält dazu eine E-Mail an info@kolaretorp.se",
      "Portal-Nachrichten werden im App-Snapshot gespeichert und bleiben nach Versionswechseln erhalten",
    ],
  },
  {
    version: "1.71.0",
    date: "2026-08-16",
    changes: [
      "Kundenberichte zeigen im Kopf jetzt das Kolaretorp-Logo statt nur Text",
      "PDF-Berichte verwenden das Kolaretorp-Logo im Header mit Text-Fallback",
    ],
  },
  {
    version: "1.70.0",
    date: "2026-08-16",
    changes: [
      "Beim Berichtversand wird jetzt die aktuelle E-Mail-Adresse aus den Objektstammdaten bevorzugt verwendet",
      "Versandvorschau, Objektverlauf, Berichtsanzeige und tatsächlicher Mailversand zeigen dieselbe Empfängeradresse",
      "Der Versand meldet einen klaren Fehler, wenn weder Objekt noch Kunde eine E-Mail-Adresse enthalten",
    ],
  },
  {
    version: "1.69.0",
    date: "2026-08-16",
    changes: [
      "Doppelte Berichte werden beim Laden, Synchronisieren und Speichern fachlich zusammengeführt",
      "Bericht-Dubletten mit deutschem und ISO-Datumsformat werden als gleicher Bericht erkannt",
      "Mobil vor Ort zeigt abgeschlossene Berichte mit Berichtszustand statt irreführendem Auftragsstatus an",
      "Stammdatenfelder behalten beim Versionswechsel den neueren lokalen oder Supabase-Stand statt pauschal überschrieben zu werden",
    ],
  },
  {
    version: "1.68.0",
    date: "2026-08-16",
    changes: [
      "Objektbilder werden beim Zusammenführen von lokalen Daten und Supabase-Daten nicht mehr durch ältere Objektstände verdrängt",
      "Objekt-Mediendaten werden pro Objekt zusammengeführt und vorhandene Bildvorschauen bevorzugt erhalten",
      "Neue Objektbilder werden stärker komprimiert, damit die Speicherung im Supabase-Snapshot stabiler bleibt",
    ],
  },
  {
    version: "1.67.0",
    date: "2026-08-16",
    changes: [
      "Mobil vor Ort speichert Einsatznotizen jetzt als eigenen Zwischenstand in LocalStorage und Supabase",
      "Minuten und Hinweise der Checklistenpunkte werden beim Verlassen des Feldes nochmals gespeichert",
      "Zwischenstände bleiben beim Abwählen oder Verlassen des Einsatzes erhalten, bis der Einsatz abgeschlossen wird",
    ],
  },
  {
    version: "1.66.0",
    date: "2026-08-16",
    changes: [
      "Aufgenommene Kontrollpunkt-Fotos werden in Mobil vor Ort direkt als Vorschau angezeigt",
      "Die Foto-Aktionsbuttons im Kontrollpunkt sind jetzt kompakte Icon-Buttons",
    ],
  },
  {
    version: "1.65.0",
    date: "2026-08-16",
    changes: [
      "Nach dem Abschließen eines Einsatzes fragt die App jetzt, ob der erzeugte Bericht geöffnet werden soll",
      "Der Abschlussdialog zeigt direkt eine Berichtsvorschau",
      "Aus dem Abschlussdialog kann direkt die Versandvorschau zum Kundenbericht geöffnet werden",
    ],
  },
  {
    version: "1.64.0",
    date: "2026-08-16",
    changes: [
      "Bericht senden öffnet jetzt zuerst eine Versandvorschau mit Empfänger, CC, Betreff, Body und PDF-Anhang",
      "Der Versand wird erst nach Bestätigung in der Vorschau ausgelöst",
      "In der Vorschau ist der Kundenbericht vor dem Senden sichtbar",
    ],
  },
  {
    version: "1.63.0",
    date: "2026-08-16",
    changes: [
      "Berichtversand läuft jetzt über einen serverseitigen API-Endpunkt mit PDF-Anhang",
      "Kundenberichte werden nur nach erfolgreichem Mailversand als gesendet markiert und gesperrt",
      "Für Kundenberichte wird kein Resend-Testabsender mehr verwendet, damit die Domain-Verifizierung sauber erzwungen wird",
    ],
  },
  {
    version: "1.62.0",
    date: "2026-08-16",
    changes: [
      "Bericht senden erzeugt jetzt eine PDF-Datei und übergibt sie per Geräte-Teilen als Anhang",
      "Mailtext und Betreff werden nach Kolaretorp-Vorgabe vorbereitet",
      "Gesendete Berichte werden gesperrt und können danach nicht mehr verändert werden",
      "Bericht senden ist jetzt auch in Mobil vor Ort verfügbar",
    ],
  },
  {
    version: "1.61.0",
    date: "2026-08-16",
    changes: [
      "Abgeschlossene Berichte können in Mobil vor Ort wieder mit ihrer Checkliste nachbearbeitet werden",
      "Die mobile Berichtsbearbeitung findet abgeschlossene Aufträge jetzt auch dann, wenn sie nicht in der gekürzten offenen Arbeitsliste stehen",
    ],
  },
  {
    version: "1.60.0",
    date: "2026-08-16",
    changes: [
      "Auftragsübersicht bietet jetzt eine Statusfilter-Leiste",
      "Erledigte, abgerechnete und stornierte Aufträge werden in der Übersicht unten einsortiert",
      "Serienaufträge werden beim Filtern berücksichtigt, wenn ein Teilauftrag den gewählten Status hat",
    ],
  },
  {
    version: "1.59.0",
    date: "2026-08-16",
    changes: [
      "Erledigte, abgerechnete und stornierte Einsätze werden in der Dashboard-Arbeitsliste nicht mehr angezeigt",
      "Dashboard zeigt einen leeren Zustand, wenn keine offenen Einsätze vorhanden sind",
    ],
  },
  {
    version: "1.58.0",
    date: "2026-08-16",
    changes: [
      "Auftragsübersicht ist jetzt nach dem nächsten relevanten Termin sortiert",
      "Bei Serienaufträgen zählt dafür der nächste offene Teilauftrag",
    ],
  },
  {
    version: "1.57.0",
    date: "2026-08-16",
    changes: [
      "Serieninformationen in der Auftragsübersicht stehen jetzt direkt in der Titelzeile neben dem Auftragstitel",
      "Die rechte Aktionsspalte bleibt dadurch kompakter und besser scannbar",
    ],
  },
  {
    version: "1.56.0",
    date: "2026-08-16",
    changes: [
      "Serienaufträge werden in der Auftragsübersicht kompakter mit separaten Chips für Rhythmus, letzten und nächsten Teilauftrag dargestellt",
      "Die Auftragszeilen brechen auf kleineren Bildschirmen sauber um, statt lange Serienhinweise abzuschneiden",
    ],
  },
  {
    version: "1.55.0",
    date: "2026-08-16",
    changes: [
      "Dashboard, Einsatzplanung und Mobil vor Ort zeigen pro Serienauftrag nur noch den nächsten relevanten Teilauftrag",
      "Offene Listen kennzeichnen Teilaufträge jetzt als Serienauftrag mit dem hinterlegten Rhythmus",
      "Die vollständige interne Auftragsliste der Serie bleibt in der Auftragsübersicht aufklappbar",
    ],
  },
  {
    version: "1.54.0",
    date: "2026-08-16",
    changes: [
      "Auftragsübersicht zeigt Serien wieder als Hauptauftrag mit aufklappbaren Teilaufträgen",
      "Serienstatus nennt letzten erledigten Teilauftrag und den nächsten offenen oder laufenden Teilauftrag",
      "Teilaufträge können aus der aufgeklappten Serienansicht direkt bearbeitet, gestartet, storniert oder reaktiviert werden",
    ],
  },
  {
    version: "1.53.0",
    date: "2026-08-16",
    changes: [
      "Serienaufträge erzeugen jetzt konkrete interne Teilaufträge, die einzeln bearbeitet, gestartet oder storniert werden können",
      "Der Serienauftrag Bolet - Rasenmähen erzeugt die noch offenen Termine 27.08.2026 und 10.09.2026 bis zum Enddatum",
      "Nie endende Serien werden rollierend für die nächsten 6 Monate als interne Auftragsliste vorbereitet",
      "Aufträge können jetzt storniert und bei Bedarf wieder reaktiviert werden",
    ],
  },
  {
    version: "1.52.0",
    date: "2026-08-16",
    changes: [
      "Serienaufträge bleiben nach einem erledigten Termin offen, wenn weitere Termine folgen",
      "Bei Serienaufträgen wird der nächste Fälligkeitstermin automatisch fortgeschrieben",
      "Mobil vor Ort zeigt abgeschlossene Berichte zur Nachbearbeitung an",
      "Bestehende Einsatzberichte können mobil geöffnet, geändert und erneut gespeichert werden",
    ],
  },
  {
    version: "1.51.0",
    date: "2026-08-12",
    changes: [
      "Aufträge können jetzt konkrete Leistungen aus den Stammdaten enthalten",
      "In der Auftragsanlage können eigene Leistungen mit eigenen Checklistenpunkten erfasst werden",
      "Mobil vor Ort zeigt nur noch die Checklistenpunkte der im Auftrag hinterlegten Leistungen",
    ],
  },
  {
    version: "1.50.0",
    date: "2026-08-12",
    changes: [
      "Geräte-Synchronisation führt lokale und Supabase-Daten beim Start zusammen",
      "Aufträge, Kunden, Objekte und Berichte, die nur auf einem Gerät vorhanden sind, werden nicht mehr verdrängt",
      "Fehlende lokale Datensätze werden nach dem Öffnen automatisch nach Supabase übernommen",
    ],
  },
  {
    version: "1.49.0",
    date: "2026-08-12",
    changes: [
      "Tägliche Auftragsmail nutzt jetzt eine explizite Empfängeradresse",
      "Mailversand fällt bei noch nicht verifizierter Kolaretorp-Domain auf die Resend-Testadresse zurück",
      "Cron-Endpunkt gibt Versanddetails für den Testlauf zurück",
    ],
  },
  {
    version: "1.48.0",
    date: "2026-08-10",
    changes: [
      "Supabase-Projekt wurde verknüpft und die app_state Tabelle per Migration angelegt",
      "Serverseitige App-State-API normalisiert gespeicherte Snapshots robuster",
      "Dauerhafte Speicherung von Kunden, Objekten, Aufträgen, Bildern und Dokumenten ist wieder aktiv",
    ],
  },
  {
    version: "1.47.0",
    date: "2026-08-10",
    changes: [
      "App-Daten werden jetzt über eine serverseitige App-State-API in Supabase gespeichert",
      "Vercel-Production nutzt nun die Supabase-Umgebungsvariablen für dauerhafte Kunden, Objekte, Aufträge, Bilder und Dokumente",
    ],
  },
  {
    version: "1.46.0",
    date: "2026-08-10",
    changes: [
      "Vercel Cron auf Hobby-kompatiblen täglichen Lauf umgestellt",
      "Cachefreier Versions-Endpunkt zur Prüfung des live deployten Stands ergänzt",
    ],
  },
  {
    version: "1.45.0",
    date: "2026-08-10",
    changes: [
      "Tägliche Auftragsliste per Vercel Cron und Resend vorbereitet",
      "Änderungsverlauf zeigt nun alle Versionen scrollbar an",
      "Dashboard-Arbeitsliste ist kompakter und auf maximal zwei Zeilen pro Auftrag ausgelegt",
    ],
  },
  {
    version: "1.44.0",
    date: "2026-08-10",
    changes: [
      "Beim Abwählen eines mobilen Auftrags springt der Status von in Arbeit zurück auf geplant",
      "Aktionsbuttons in der Auftragsübersicht sind kleiner und kompakt in der oberen rechten Zeile platziert",
    ],
  },
  {
    version: "1.43.0",
    date: "2026-08-10",
    changes: [
      "Berichte aus Objektakte und Berichte-Menü verwenden jetzt dieselbe Einsatzbericht-Komponente",
      "Berichte-Menü zeigt nun ebenfalls Objektbild, Objektinformationen und Kontrollpunkt-Fotos",
      "Mobil vor Ort kann einen geöffneten Auftrag wieder abwählen und zur Auftragsliste zurückkehren",
      "Info-Kacheln im oberen Bereich sind kompakter gestaltet",
      "Test prüft, dass die Berichtsliste Objektbild und Einsatzfotos anzeigt",
    ],
  },
  {
    version: "1.42.0",
    date: "2026-08-10",
    changes: [
      "Mobil vor Ort zeigt jetzt alle offenen Aufträge als klickbare Liste",
      "Beim Anklicken eines offenen Auftrags wird dieser direkt als aktiver Vor-Ort-Einsatz geöffnet",
      "Der Mobilbereich zeigt einen leeren Zustand, wenn keine offenen Aufträge vorhanden sind",
    ],
  },
  {
    version: "1.41.0",
    date: "2026-08-10",
    changes: [
      "App-Daten werden als zentraler Snapshot nach Supabase synchronisiert",
      "Objekte, Dokumente, Fotos, Aufträge, Berichte und Vor-Ort-Fortschritt bleiben dadurch nach Versionswechseln erhalten",
      "Berichte-Zähler öffnet jetzt eine eigene Berichtsliste mit Objektzuordnung und Detailansicht",
      "Supabase-Schema enthält eine app_state Tabelle für die aktuelle Arbeitsdaten-Persistenz",
    ],
  },
  {
    version: "1.40.0",
    date: "2026-08-10",
    changes: [
      "Objektbearbeitung zeigt keinen doppelten Kopf mit Objektstammdaten und Objekt bearbeiten mehr",
      "Objektbild ist kompakter in den oberen Bearbeitungskopf integriert",
      "Tests wurden auf den neuen aufgeräumten Objektkopf angepasst",
    ],
  },
  {
    version: "1.39.0",
    date: "2026-08-10",
    changes: [
      "Dokumente in der Objektakte öffnen beim Anklicken eine Vorschau mit Druckfunktion",
      "Objektfotos öffnen beim Anklicken einen großen Fotoviewer mit Druckfunktion",
      "PDF-, Bild- und Textdateien werden im Viewer direkt dargestellt, große Office-Dateien als Metadatenvorschau",
    ],
  },
  {
    version: "1.38.0",
    date: "2026-08-10",
    changes: [
      "Objekthistorie ist jetzt eingeklappt und zeigt Berichte kompakt zweizeilig an",
      "Berichtsdetails klappen erst nach Klick auf den Historieneintrag auf",
      "Aktiver Einsatz wird lokal gespeichert und nach Reload oder Versionswechsel wiederhergestellt",
      "Vor-Ort-Fotos werden vor dem Speichern verkleinert, damit Status und Bilder stabil erhalten bleiben",
    ],
  },
  {
    version: "1.37.0",
    date: "2026-08-10",
    changes: [
      "Der Abschnitt Dokumente in der Objektakte wurde aus dem Kundenbericht entfernt",
      "PDF-Druck erhält eine Seitenfußzeile mit Seite x von y Seiten",
      "Drucklayout blendet die restliche App-Struktur aus, damit nach den Kontrollpunkten keine leeren Seiten entstehen",
      "Der Senden-Button protokolliert den Versand jetzt mit sichtbarer Rückmeldung",
    ],
  },
  {
    version: "1.36.0",
    date: "2026-08-10",
    changes: [
      "Aufträge, Status, Berichte und Einsatzfotos werden jetzt lokal gespeichert und nach Reload wiederhergestellt",
      "Kunden, Leistungen, Pakete und Mobil-vor-Ort-Fortschritt bleiben ebenfalls erhalten",
      "Test prüft jetzt, dass ein abgeschlossener Einsatzbericht inklusive Foto und Kommentar nach Seitenreload bestehen bleibt",
    ],
  },
  {
    version: "1.35.0",
    date: "2026-08-10",
    changes: [
      "Arbeitszeit im Einsatzbericht zählt nur noch ausgeführte Checklistenpunkte",
      "Nicht ausgeführte Punkte bleiben im Bericht sichtbar, werden aber mit 0 Minuten ausgewiesen",
      "Minutenfelder nicht ausgeführter Punkte sind in Mobil vor Ort deaktiviert",
    ],
  },
  {
    version: "1.34.0",
    date: "2026-08-10",
    changes: [
      "Der Abschnitt Bilder zum Objekt / Einsatz wurde aus dem Bericht entfernt",
      "Das Objektbild erscheint nur noch oben im Berichtskopf",
      "Kontrollpunktfotos werden sofort und direkt am jeweiligen Einsatzpunkt angezeigt",
    ],
  },
  {
    version: "1.33.0",
    date: "2026-08-10",
    changes: [
      "Fotos aus Kontrollpunkten werden jetzt direkt beim jeweiligen Punkt im Bericht angezeigt",
      "Berichtskopf zeigt das Objektbild oben mit klarer Objekt- und Auftragskennung",
      "Berichtsinformationen wurden in kompakte professionelle Karten für Objekt, Kunde, Auftrag und Leistung aufgeteilt",
    ],
  },
  {
    version: "1.32.0",
    date: "2026-08-10",
    changes: [
      "PDF-Bericht verwendet echte Bild-Elemente, damit Fotos im Chrome-PDF zuverlässig erscheinen",
      "PDF-Bericht wurde kompakter gestaltet mit dichterer Kopfzeile, kleineren Einzelpunkten und reduzierten Abständen",
      "Bildergalerien im Bericht nutzen im Druck bis zu drei Spalten",
    ],
  },
  {
    version: "1.31.0",
    date: "2026-08-10",
    changes: [
      "Mobil-vor-Ort-Eingaben werden jetzt pro Auftrag gespeichert, auch beim Wechsel zwischen Menüpunkten",
      "Abhakungen, Zeiten, Hinweise und Fotos werden vollständig in den Einsatzbericht übernommen",
      "Fotos aus Checklistenpunkten werden im Kundenbericht mit Dateiname und Vorschau angezeigt",
    ],
  },
  {
    version: "1.30.0",
    date: "2026-08-10",
    changes: [
      "Einsatzabschluss erzeugt jetzt einen strukturierten Bericht aus allen Checklistenpunkten",
      "Bericht zeigt pro Punkt Status, Zeit, Hinweis und erfasste Bilder, auch wenn ein Punkt nicht ausgeführt wurde",
      "Zu jedem Bericht kann vor dem Senden ein Kundenkommentar gepflegt werden",
    ],
  },
  {
    version: "1.29.0",
    date: "2026-08-10",
    changes: [
      "Mobil-vor-Ort-Ansicht verwendet jetzt die normalen App-Farben statt einer separaten dunklen Geräteoptik",
      "Checklisten, Eingabefelder, Foto-Buttons und Foto-Bestätigung passen sich nun sauber an Hell- und Dunkelmodus an",
    ],
  },
  {
    version: "1.28.0",
    date: "2026-08-10",
    changes: [
      "PDF-Ausgabe nutzt jetzt einen professionell gestalteten Kundenbericht statt der normalen App-Ansicht",
      "Einsatzbericht enthält Berichtsnummer, Kunde, Objekt, Auftrag, Termin, Priorität, Abrechnung, Checkliste, Medien und Bilder",
      "Drucklayout blendet Navigation und Bearbeitungsflächen aus und fokussiert auf den PDF-Bericht",
    ],
  },
  {
    version: "1.27.0",
    date: "2026-08-10",
    changes: [
      "Kundendaten enthalten jetzt einen individuell anpassbaren Mailtext für Einsatzberichte",
      "Der Berichtversand ersetzt den Platzhalter {Vorname} automatisch durch den Ansprechpartner des Kunden",
      "Objektberichte verwenden Empfänger und Mailtext aus den zugeordneten Kundenstammdaten",
    ],
  },
  {
    version: "1.26.0",
    date: "2026-08-10",
    changes: [
      "Kundenbericht zeigt eine professionellere Einsatzbericht-Karte mit Objekt, Auftrag, Zeiten, Material, Checkliste und Medien",
      "Berichtversand protokolliert Zeitstempel, Betreff, Empfänger, Kopie und PDF-Anhang",
      "E-Mail-Betreff folgt dem Format Einsatzbericht - Kolaretorp Service AB - Objektbezeichnung",
      "Beim Berichtversand wird info@kolaretorp.se als Kopie ausgewiesen",
      "E-Mail-Body enthält eine persönliche Anrede mit Berichtshinweis und Rückfragen-Satz",
    ],
  },
  {
    version: "1.25.0",
    date: "2026-08-10",
    changes: [
      "Fotos zum Objekt enthalten den Button Neues Foto hinzufügen direkt im Abschnitt",
      "Dokumente zum Objekt haben einen eigenen Abschnitt mit Büroklammer-Upload",
      "Separate Upload-Kacheln oberhalb der Foto- und Dokumentbereiche wurden entfernt",
    ],
  },
  {
    version: "1.24.0",
    date: "2026-08-09",
    changes: [
      "Objektbild wird in der Objektbearbeitung rechts oben ohne Dateinamen angezeigt",
      "Fotos zum Objekt werden als eigene Galerie dargestellt",
      "Dokumente und Grundrisse bleiben getrennt in der Medienakte",
    ],
  },
  {
    version: "1.23.0",
    date: "2026-08-09",
    changes: [
      "Objektbilder werden vor dem lokalen Speichern automatisch verkleinert",
      "Lokales Speichern fängt Speicherlimit-Fehler ab, damit die App nicht mehr abstürzt",
      "Test prüft jetzt auch das Speichern eines Objektbildes an einem zweiten Objekt",
    ],
  },
  {
    version: "1.22.0",
    date: "2026-08-09",
    changes: [
      "Objekte werden beim Bearbeiten jetzt als eigene Seite statt als Popup geöffnet",
      "Zurück-Pfeil führt aus der Objektbearbeitung zurück in die Objektübersicht",
      "Historie und Verlauf sind direkt in der Objektbearbeitung eingebettet",
      "Objektbilder werden in Übersicht und Bearbeitungsmodus angezeigt",
      "Hochgeladene Objektbilder bleiben nach dem Aktualisieren lokal erhalten",
      "Bilder können als Objektbild gesetzt und Medien in der Akte verschoben werden",
      "Intervall- und Jahresrhythmusfelder im Serienauftrag wurden weiter verkleinert",
    ],
  },
  {
    version: "1.21.0",
    date: "2026-08-09",
    changes: [
      "Intervall- und Jahresrhythmusfelder im Serienauftrag sind jetzt kompakt",
      "Zahlenfelder im Serienblock werden nicht mehr auf volle Spaltenbreite gestreckt",
    ],
  },
  {
    version: "1.20.0",
    date: "2026-08-09",
    changes: [
      "Serienaufträge können jetzt auf einen saisonalen Zeitraum begrenzt werden",
      "Gültigkeit wie Mai bis September wird in der Auftragsübersicht mit angezeigt",
      "Jahresrhythmus unterstützt jedes Jahr oder alle x Jahre",
      "Intervallfeld im Serienblock wurde schmaler gestaltet",
    ],
  },
  {
    version: "1.19.0",
    date: "2026-08-09",
    changes: [
      "Auftragsanlage zeigt Einmalauftrag oder Serienauftrag jetzt klar als Kalenderblock",
      "Serienauftrag erhält eine sofort sichtbare Zusammenfassung aus Rhythmus, Intervall, Wochentagen und Ende",
      "Intervallfeld wurde für die wiederkehrende Planung eindeutiger beschriftet",
    ],
  },
  {
    version: "1.18.0",
    date: "2026-08-09",
    changes: [
      "Objektakte zeigt eine Historie aus Aufträgen und Berichten",
      "Verlaufseinträge öffnen Detailansicht mit Auftragsdaten, Bericht, internen Notizen und Medien",
      "Berichte können aus der Objektakte per PDF-Ausgabe vorbereitet und als an Kunden gesendet markiert werden",
      "Auftragsübersicht wurde auf kompakte zweizeilige Zeilen mit Aktionsicons verdichtet",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-08-09",
    changes: [
      "Bild erfassen ist jetzt pro Checklistenpunkt als Kamera-Icon verfügbar",
      "Aufgenommene Fotos werden direkt am jeweiligen Checklistenpunkt bestätigt oder neu erfasst",
      "Allgemeiner Foto-Button am Ende der mobilen Einsatzkarte wurde entfernt",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-08-09",
    changes: [
      "Preis und Währung im Leistungsformular stehen jetzt kompakt in einer Zeile",
      "Währungsfeld wurde auf eine schmale Auswahl neben dem Preis reduziert",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-08-09",
    changes: [
      "Standardzeit-Feld im Leistungs-Checklisten-Editor kompakter gestaltet",
      "Checklistenformular verhindert horizontales Überlaufen der Eingabefelder",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-08-09",
    changes: [
      "Aufträge können als einmaliger Auftrag oder Serienauftrag angelegt werden",
      "Serienaufträge erhalten Kalender-ähnliche Wiederholung mit Frequenz, Intervall, Wochentagen und Ende",
      "Mobile Auftragsbearbeitung unterstützt Bild erfassen, Foto benutzen und neues Foto",
      "Zeitfeld in der mobilen Checkliste ist kompakter und überlappt den Hinweisbereich nicht mehr",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-08-09",
    changes: [
      "Leistungen enthalten jetzt detaillierte Checklistenpunkte mit Hinweis und Standardzeit",
      "Leistungspreise haben ein separates Währungsfeld",
      "Mobile Auftragsbearbeitung zeigt beim Start die Checklistenpunkte aus dem Objektpaket",
      "Einsatzkräfte können pro Punkt abhaken, Zeit erfassen und Hinweise notieren",
      "Gestartete Aufträge öffnen zuverlässig den ausgewählten Auftrag statt den ersten laufenden Einsatz",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-08-09",
    changes: [
      "Aktionsbuttons werden in Listen und Stammdaten konsistent als Iconbuttons dargestellt",
      "Iconbuttons zeigen beim Hover und Tastaturfokus einen Tooltip mit der jeweiligen Funktion",
      "Auftragsaktionen nutzen jetzt ebenfalls Iconbuttons für Bearbeiten und Starten",
      "Entfernen-Aktionen in Objekt- und Kundenformularen nutzen die gleiche Buttonlogik",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-08-09",
    changes: [
      "Neue Leistungen starten ohne vorbelegte Kategorie und Einheit",
      "Leistung, Kategorie und Einheit sind Pflichtfelder ohne automatische Fallback-Werte",
      "Einheit ist jetzt ebenfalls ein lernendes Dropdownfeld aus vorhandenen Einheiten",
      "Kategorie- und Einheitsvorschläge öffnen beim Fokus, wenn der Browser dies unterstützt",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-08-09",
    changes: [
      "Archivierte Objekte, Kunden, Leistungen und Pakete können weiterhin bearbeitet werden",
      "Archivierte Datensätze lassen sich per Reaktivieren-Button wieder in die aktiven Übersichten zurückholen",
      "Speichern archivierter Datensätze erhält den Archivstatus bis zur bewussten Reaktivierung",
      "E2E-Test prüft Bearbeiten und Reaktivieren archivierter Stammdaten",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-08-09",
    changes: [
      "Leistungen im Paket werden über einen Plus-Button in einem Auswahl-Popup gepflegt",
      "Leistungsauswahl ist nach Kategorie gruppiert und alphabetisch sortiert",
      "Paketformular zeigt nur noch eine kompakte Zusammenfassung der ausgewählten Leistungen",
      "E2E-Test prüft den neuen Paket-Leistungswähler",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-08-09",
    changes: [
      "Doppelten Firmennamen aus dem Kopfbereich entfernt",
      "Dashboard-Arbeitskacheln zentrieren ihre Inhalte",
      "Leistungen und Pakete nutzen Icon-Buttons zum Bearbeiten und Archivieren",
      "Archivierung prüft aktive Nutzung bei Kunden, Objekten und Paketen",
      "Archivierte Leistungen, Pakete, Kunden und Objekte können endgültig gelöscht werden",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-08-09",
    changes: [
      "Objektakte wird nur noch im Menüpunkt Objekte angezeigt",
      "Alle anderen Menüpunkte nutzen wieder die volle Arbeitsbreite ohne Objektakten-Seitenblock",
      "E2E-Test prüft die eingeschränkte Sichtbarkeit der Objektakte",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-08-09",
    changes: [
      "Leistungen können in den Stammdaten bearbeitet und gespeichert werden",
      "Pakete können bearbeitet und mit geänderten Leistungszuordnungen gespeichert werden",
      "Kategorie-Feld der Leistungen als lernendes Dropdown mit bestehenden Kategorien umgesetzt",
      "E2E-Test prüft Bearbeitung von Leistungen, Paketbearbeitung und neue Kategorien",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-08-09",
    changes: [
      "Kunden können im Bearbeiten-Dialog Objekte per Dropdown zugeordnet bekommen",
      "Kunden-Objekt-Zuordnung synchronisiert Eigentümerdaten zurück in die Objektstammdaten",
      "Zugeordnete Objekte können aus der Kundenmaske wieder entfernt werden",
      "Kundenübersicht kompakter gestaltet: Bearbeiten-Button rechts und Kundendaten auf zwei Zeilen begrenzt",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-09",
    changes: [
      "Stammdatenmodul in einzelne Leistungen und Leistungspakete aufgeteilt",
      "Neue Leistungen können mit Kategorie, Einheit, Preis und Beschreibung angelegt werden",
      "Pakete können aus mehreren vorhandenen Leistungen zusammengestellt werden",
      "Paketkarten zeigen die enthaltenen Leistungen als Tags",
      "E2E-Test prüft Leistungserfassung und Paketbildung",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-09",
    changes: [
      "Objektübersicht zeigt je Objektzeile einen eigenen Bearbeiten-Button",
      "Objekt-Bearbeitung öffnet in einem deutlich größeren Dialog",
      "Rechte Objektakte wurde auf Hauptstammdaten bis einschließlich Objektadresse gekürzt",
      "Globaler Neuer-Auftrag-Button aus der Kopfzeile entfernt",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-09",
    changes: [
      "Objekte können einem Eigentümer aus den Kundenstammdaten zugeordnet werden",
      "Objektadresse, Eigentümeradresse und Rechnungsadresse werden getrennt gepflegt",
      "Rechnungsadresse kann aus Objektadresse, Eigentümeradresse oder abweichender Adresse gewählt werden",
      "Bilder, Handy-Fotos, Dokumente und Grundrisse können in der Objektmaske erfasst werden",
      "Dokumente erhalten eine Kurzbeschreibung und erscheinen in der Objektakte",
      "Objektakte zeigt ein Objektfoto als Vorschau und einen Korrespondenzverlauf aus Nachrichten und gesendeten Einsatzberichten",
      "Kundenformular zeigt nur zugeordnete Objekte und enthält ein internes Notizfeld",
      "Farbsystem an Apple-nahe neutrale Grautöne mit sparsamer blauer Aktionsfarbe angepasst",
      "Kolaretorp-Logo aus der Website als App-Branding eingebunden",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-09",
    changes: [
      "Objekte können aus der Objektakte heraus vollständig bearbeitet und gespeichert werden",
      "Objektformular um Eigentümerkontakt, Status, Baujahr, Zugang, Technik, Medien und Besuchsplanung erweitert",
      "Kunden und Aufträge können angelegt und bearbeitet werden",
      "Berichte und Kommunikation werden objektbezogen in der Objektakte angezeigt statt als eigene Hauptmenüpunkte",
      "Übersichtskacheln im Kopfbereich als zentrierte, klickbare Sprungbuttons umgesetzt",
      "Versionsanzeige in der unteren Menüspalte deutlicher dargestellt",
      "E2E-Test prüft Objekt-, Kunden- und Auftragsanlage inklusive Bearbeitung",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-31",
    changes: [
      "App-Oberfläche als ruhige Arbeitssoftware neu aufgebaut",
      "Objektakte als zentrale Detailansicht mit Stammdaten, Zugang, Technik, Medien und Protokoll umgesetzt",
      "Objekt- und Auftragsanlage fachlich neu strukturiert",
      "Dashboard, Auftragsliste, Einsatzplanung, mobile Bearbeitung, Berichte, Kommunikation, Abrechnung und Stammdaten neu ausgerichtet",
      "E2E-Test auf die neuen Kernflows umgestellt",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-31",
    changes: [
      "Dashboard in Richtung einer HERO-artigen Funktionszentrale weiterentwickelt",
      "Drei Kernmodule für Kommunikation, Finanzen und Automatisierung ergänzt",
      "Feature-Gruppen für Büro, Vor-Ort-Arbeit, Team, Objekte/Kunden und Finanzen ergänzt",
      "Schnittstellen bewusst nicht als eigener Bereich aufgenommen",
    ],
  },
  {
    version: "0.8.1",
    date: "2026-07-31",
    changes: [
      "Kopfbereich kompakter gestaltet",
      "Sprachumschaltung von Segment-Buttons auf Dropdown umgestellt",
      "Versionschip aus der Topbar entfernt, da Version bereits in der Sidebar steht",
      "Dashboard-Hero und Übersichtsdaten platzsparender dargestellt",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-07-31",
    changes: [
      "Leistungskatalog aus der Kolaretorp-Broschüre als Stammdaten ergänzt",
      "Betreuungspakete Basis, Plus, Komfort und Premium mit Preisen und Leistungsumfang angelegt",
      "Zusatzleistungen wie Hauskontrolle, Gartenpflege, Schlüsselservice, Hausmeisterservice, Reinigung und Notdienst ergänzt",
      "Neue Leistungen können in den Stammdaten lokal angelegt und danach für Aufträge genutzt werden",
      "Objektstammdaten um Eigentümer, Adresse, Größe, Räume, Betten, Zugang, Ausstattung, Hinweise und Medien erweitert",
      "Objektakte zeigt verknüpfte Einsätze, Berichte, Kommunikation und Abrechnungspositionen",
      "Supabase-Servicekategorien um Paket-, Preis-, Intervall- und Leistungsumfangfelder erweitert",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-07-31",
    changes: [
      "Berichtsmodul mit Kunden- und interner Sicht ergänzt",
      "Auftragsanlage um Priorität, Fälligkeit, Zuständigkeit, Beschreibung und interne Notizen erweitert",
      "Einsatzplanung um Filter, Kennzahlen und Zuständigkeiten ergänzt",
      "Mobile Einsatzbearbeitung mit Start, Pause, Abschluss, Medien, Material und Arbeitszeit ausgebaut",
      "Kundenanlage, Kundenportal-Auftragsanfrage und Abrechnungspositionen ergänzt",
      "Supabase-Schema um Medien, Kommunikation, Abrechnung und erweiterte Rollen ergänzt",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-31",
    changes: [
      "Dashboard als Sprungbrett in alle Verwaltungsbereiche erweitert",
      "Stammdaten-, Kunden-, Leistungskatalog-, Kommunikations- und Abrechnungsmodul ergänzt",
      "Neue Demo-Stammdaten für Kunden, Leistungen, Nachrichten und Rechnungen hinterlegt",
      "Farbsystem harmonisch überarbeitet und Darkmode beibehalten",
      "Button-Test um neue Modulnavigation und zentrale Aktionen erweitert",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-30",
    changes: [
      "Hauptnavigation in fachliche Bereiche umgebaut",
      "Auftrags-, Objekt-, Einsatzplan- und Freigabeübersichten ergänzt",
      "Lokale Objektanlage und Objektakte verbessert",
      "Automatischen Button-Klicktest mit Playwright ergänzt",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-07-30",
    changes: [
      "Versionsanzeige in der App ergänzt",
      "Änderungsverlauf im Repository dokumentiert",
      "Versionsdaten zentral gepflegt",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-30",
    changes: [
      "Neues harmonisches Farbsystem ergänzt",
      "Darkmode mit gespeicherter Auswahl eingebaut",
      "Objekt- und Leistungsfokus verbessert",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-30",
    changes: [
      "Mehrsprachige Demo- und Live-Datenansicht aufgebaut",
      "Dashboard-Bedienelemente klickbar gemacht",
      "Supabase-Datenquelle mit Demo-Fallback angebunden",
    ],
  },
];
