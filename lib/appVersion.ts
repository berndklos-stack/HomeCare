export const appVersion = {
  version: "1.1.0",
  releaseDate: "2026-08-09",
  label: "Kolaretorp Service App",
};

export const versionHistory = [
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
