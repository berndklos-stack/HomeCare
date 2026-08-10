export const appVersion = {
  version: "1.43.0",
  releaseDate: "2026-08-10",
  label: "Kolaretorp Service App",
};

export const versionHistory = [
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
