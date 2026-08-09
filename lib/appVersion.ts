export const appVersion = {
  version: "1.14.0",
  releaseDate: "2026-08-09",
  label: "Kolaretorp Service App",
};

export const versionHistory = [
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
