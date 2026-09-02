export const appVersion = {
  version: "1.298.0",
  releaseDate: "2026-08-31",
  label: "Homecare",
};

export const versionHistory = [
  {
    version: "1.298.0",
    date: "2026-09-02",
    changes: [
      "Ressourcenbild wird wieder kompakt rechts neben den neun Stammdatenfeldern dargestellt",
      "Ressourcenformular schuetzt seine Spaltenbreiten gegen allgemeine Formularregeln",
    ],
  },
  {
    version: "1.297.0",
    date: "2026-09-02",
    changes: [
      "Neun Ressourcen-Stammdatenfelder werden in einem eigenen 3x3-Raster gleich breit dargestellt",
      "Ressourcenbild verzerrt die Formularspalten nicht mehr",
      "Notizen, Dokumente, Wartung und Formularbuttons nutzen die verfuegbare Breite einheitlich",
    ],
  },
  {
    version: "1.296.0",
    date: "2026-09-02",
    changes: [
      "Fahrtenbuch-Jahr wurde im Ressourcenformular durch Baujahr ersetzt",
      "Obere Ressourcenfelder nutzen gleichmaessige Formularspalten",
      "Wartungsfelder nutzen die verfuegbare Blockbreite besser aus",
    ],
  },
  {
    version: "1.295.0",
    date: "2026-09-02",
    changes: [
      "Untere Fahrzeugbereiche nutzen die komplette Formularbreite",
      "Auswahlfelder im Ressourcenformular sind gleich hoch wie die uebrigen Eingabefelder",
      "Speichern- und Abbrechen-Buttons im Ressourcenformular sind zentriert",
    ],
  },
  {
    version: "1.294.0",
    date: "2026-09-02",
    changes: [
      "Ressourcenbilder koennen direkt im kleinen Bildslider geloescht werden",
      "Bildblock ist in das Ressourcenformular integriert statt frei angeheftet",
      "Fahrtenbuch-Kopfbuttons sind kompakter und werden nicht mehr abgeschnitten",
    ],
  },
  {
    version: "1.293.0",
    date: "2026-09-02",
    changes: [
      "Fahrzeug-Stammdaten werden kompakter dargestellt",
      "Ressourcenbilder sitzen oben rechts als kleine Slider-Galerie",
      "Fahrtenbuch-Kennzahlen, Tabelle, Dokumente und Wartungstermine nutzen dichtere Abstaende",
    ],
  },
  {
    version: "1.292.0",
    date: "2026-09-02",
    changes: [
      "Fahrtenbuch-Tabelle wird kompakter dargestellt",
      "Fahrzeugdokumente wie Werkstattrechnungen und Besiktningsprotokolle koennen gespeichert werden",
      "Fahrzeugtermine fuer Service, Oelwechsel oder Besiktning koennen mit lernender Einheit erfasst werden",
    ],
  },
  {
    version: "1.291.0",
    date: "2026-09-02",
    changes: [
      "Kennzahlenboxen im Fahrtenbuch werden pro Box zentriert dargestellt",
    ],
  },
  {
    version: "1.290.0",
    date: "2026-09-02",
    changes: [
      "Fahrtenbuch-Popup erhaelt eine manuelle Erfassung fuer neue Fahrten",
      "Bestehende Fahrten koennen direkt aus der Fahrtenbuch-Tabelle heraus bearbeitet werden",
      "Zwischenziele und Kilometerstaende sind auch bei manuellen Fahrtenbucheintraegen erfassbar",
    ],
  },
  {
    version: "1.289.0",
    date: "2026-09-02",
    changes: [
      "Fahrtenbuch-Popup zeigt im Logbuchmodus Fahrtenbuch als Hauptueberschrift",
      "Ressourcen-Popup ist breiter und hoeher",
      "Fahrtenbuch-Tabelle passt auf Desktop ohne horizontalen Scrollbalken in den Dialog",
    ],
  },
  {
    version: "1.288.0",
    date: "2026-09-02",
    changes: [
      "Ressourcen werden beim Anklicken in einem Popup geoeffnet",
      "Fahrtenbuch wird im Ressourcen-Popup als Tabelle angezeigt",
      "Fahrtenbuch kann als PDF ohne Bilder oder als PDF mit Bilderanhang heruntergeladen werden",
    ],
  },
  {
    version: "1.287.0",
    date: "2026-09-02",
    changes: [
      "Geloeschte Demo-Kunden, Demo-Objekte, Demo-Auftraege und Demo-Abrechnungseintraege werden dauerhaft gegen Ruecksynchronisation geschuetzt",
      "App-State-Merge filtert allgemeine Tombstones server- und clientseitig aus",
    ],
  },
  {
    version: "1.286.0",
    date: "2026-09-02",
    changes: [
      "Wieder geoeffnete Mobil-vor-Ort-Berichte erhalten eine dauerhafte Loeschmarke und kommen beim naechsten Sync nicht zurueck",
      "Laufender Field-Progress erzeugt keinen abgeschlossenen Bericht mehr, solange der Auftrag In Arbeit ist",
      "Supabase filtert geloeschte Berichtsversionen beim App-State-Merge serverseitig aus",
    ],
  },
  {
    version: "1.285.0",
    date: "2026-09-02",
    changes: [
      "Aktueller Status im Mobil-vor-Ort-Schliessen-Dialog wird als flache Infozeile angezeigt",
      "Statusdialog verhindert auf Mobilgeraeten das vertikale Aufziehen einzelner Statusbereiche",
      "Wieder geoeffnete Berichte werden aus der abgeschlossenen Mobil-vor-Ort-Liste entfernt und als laufender Fortschritt weitergefuehrt",
    ],
  },
  {
    version: "1.284.0",
    date: "2026-09-02",
    changes: [
      "Statusauswahl beim Schliessen in Mobil vor Ort zeigt den aktuellen Status als kompakte Infozeile",
      "Bewusst gewaehlte Statuswechsel auf In Arbeit oder Geplant werden serverseitig als Nutzerentscheidung uebernommen",
    ],
  },
  {
    version: "1.283.0",
    date: "2026-09-02",
    changes: [
      "Aktiver Mobil-vor-Ort-Auftrag wird serverseitig gegen Ruecksprung auf erledigt abgesichert",
    ],
  },
  {
    version: "1.282.0",
    date: "2026-09-02",
    changes: [
      "Komplette App-Speicherungen werden serverseitig konfliktgeschuetzt zusammengefuehrt, statt aeltere Status blind zu ueberschreiben",
      "Statusauswahl beim Schliessen in Mobil vor Ort ist kompakter und weniger hoch",
    ],
  },
  {
    version: "1.281.0",
    date: "2026-09-02",
    changes: [
      "Server ignoriert alte oder zeitgleiche Status-Patches, damit in Arbeit nicht wieder auf erledigt zurueckspringt",
    ],
  },
  {
    version: "1.280.0",
    date: "2026-09-02",
    changes: [
      "Statuswechsel von erledigt zurueck auf in Arbeit oder geplant werden serverseitig akzeptiert, wenn sie neuer sind",
      "Mobil-vor-Ort-Popup bleibt auf iPhone-Breite passend und kompakt",
    ],
  },
  {
    version: "1.279.0",
    date: "2026-09-02",
    changes: [
      "Mobil-vor-Ort-Popup passt auf iPhone-Breite und nutzt kompaktere Innenabstaende",
      "Fotozeilen im mobilen Einsatzdialog brechen sauber um, damit keine Breite erzwungen wird",
    ],
  },
  {
    version: "1.278.0",
    date: "2026-09-02",
    changes: [
      "Mobil vor Ort setzt nachbearbeitete Berichte beim Status Geplant wieder sauber in die Planung zurueck",
      "Dispokalender zeigt erledigte Auftraege in der Wochenansicht und oeffnet beim Klick den zugehoerigen Bericht",
      "Erledigte Kalenderkarten sind nicht mehr verschiebbar und optisch klarer markiert",
    ],
  },
  {
    version: "1.277.0",
    date: "2026-09-01",
    changes: [
      "Mobil vor Ort zeigt neue Einsatzfotos sofort als lokale Vorschau an, waehrend Supabase-Upload und Komprimierung im Hintergrund laufen",
      "Fotokacheln nutzen auch private Medienpfade als Bildquelle",
      "Mobil vor Ort trennt Auftraege in Arbeit klar von offenen Auftraegen und abgeschlossenen Berichten",
    ],
  },
  {
    version: "1.276.0",
    date: "2026-09-01",
    changes: [
      "Mobil vor Ort uebernimmt den zuletzt aktiven Einsatz nicht mehr als gemeinsamen Serverzustand fuer alle Geraete",
      "Alte aktive Einsaetze werden beim Laden nur wiederhergestellt, wenn sie wirklich noch in Arbeit sind",
    ],
  },
  {
    version: "1.275.0",
    date: "2026-09-01",
    changes: [
      "Berichte ergaenzen fehlende Bildquellen beim Laden aus den gespeicherten Mobil-vor-Ort-Fotos",
      "Berichte werden beim lokalen/online Zusammenfuehren fachlich statt nur nach ID zusammengefuehrt",
      "Server-Speicherung bevorzugt bei gleicher Foto-ID Eintraege mit echter Bildquelle",
      "Neue Einsatzfotos werden direkt als Originaldatei in Supabase gespeichert; Base64 bleibt nur Sofort-Vorschau",
    ],
  },
  {
    version: "1.274.0",
    date: "2026-09-01",
    changes: [
      "Foto-Zusammenfuehrung bevorzugt vollstaendige Bildquellen gegenueber lokalen Platzhaltern",
      "Bericht-Textbackups sichern Bildquellen mit und erzeugen keine leeren Fotoplatzhalter mehr",
    ],
  },
  {
    version: "1.273.0",
    date: "2026-09-01",
    changes: [
      "Berichtsfotos nutzen zusaetzlich gespeicherte Medienpfade, wenn keine direkte Vorschau-URL vorhanden ist",
      "Fehlende oder defekte Bildquellen werden in der Berichtsvorschau klar gekennzeichnet",
      "Medien-Endpunkt kann gespeicherte Dateien per Pfad ausliefern",
    ],
  },
  {
    version: "1.272.0",
    date: "2026-09-01",
    changes: [
      "Einsatzfotos erscheinen nach der Aufnahme sofort lokal in der mobilen Vorschau",
      "Foto-Upload laeuft im Hintergrund weiter, ohne die Notiz-Eingabe zu blockieren",
    ],
  },
  {
    version: "1.271.0",
    date: "2026-09-01",
    changes: [
      "Berichte zeigen die Fotoanzahl direkt in der Berichtsliste",
      "Berichtsvorschau zeigt alle Berichtsfotos zusaetzlich oben als eigene Bilduebersicht",
      "Checklistenpunkte zeigen Fotoanzahlen statt mehrfacher Standard-Dateinamen wie image.jpg",
    ],
  },
  {
    version: "1.270.0",
    date: "2026-08-31",
    changes: [
      "Tank- und Ladebelege koennen in der mobilen Fahrterfassung und im Fahrtenbuch als Foto gespeichert werden",
      "Fahrtenbuch zeigt Belegfotos zusammen mit Tachofotos und Zwischenziel-Fotos an",
    ],
  },
  {
    version: "1.269.0",
    date: "2026-08-31",
    changes: [
      "Fahrtenbuch zeigt gespeicherte Start-, End- und Zwischenziel-Fotos jetzt als Bildvorschau an",
      "Zwischenziele mit Foto bleiben auch ohne erkannte Adresse beim Speichern erhalten",
      "Mobile Fahrterfassung enthaelt jetzt ebenfalls Tanken / Laden und speichert den Wert im Fahrtenbuch",
    ],
  },
  {
    version: "1.268.0",
    date: "2026-08-31",
    changes: [
      "Fahrtenbuch zeigt gespeicherte Start-, End- und Zwischenziel-Fotos jetzt als Bildvorschau an",
      "Zwischenziele mit Foto bleiben auch ohne erkannte Adresse beim Speichern erhalten",
    ],
  },
  {
    version: "1.267.0",
    date: "2026-08-31",
    changes: [
      "Separaten Mikrofonbutton bei Name / besucht bei entfernt, damit die mobile Tastatur-Spracheingabe genutzt wird",
      "Zwischenziel-Felder auf Mobiltelefonen breiter und besser bedienbar angeordnet",
    ],
  },
  {
    version: "1.266.0",
    date: "2026-08-31",
    changes: [
      "Spracheingabe fuer Name / besucht bei schreibt erkannte Ergebnisse jetzt zuverlaessig direkt ins Feld",
    ],
  },
  {
    version: "1.265.0",
    date: "2026-08-31",
    changes: [
      "Zwischenziele im Fahrtenbuch koennen jetzt eigene KM-Staende erfassen",
      "KM-Staende der Zwischenziele werden beim Speichern und in der Fahrtenbuchliste mitgefuehrt",
    ],
  },
  {
    version: "1.264.0",
    date: "2026-08-31",
    changes: [
      "Gruppieren-Umschaltung aus der Abrechnungsansicht entfernt",
      "SIE-Export setzt #SIETYP jetzt auf 4 fuer Visma-kompatible SIE4-Dateien",
    ],
  },
  {
    version: "1.263.0",
    date: "2026-08-31",
    changes: [
      "Abrechnungsansicht mit zweizeiliger Toolbar und kompakten Statusfiltern ohne sichtbaren Scrollbalken aufgeraeumt",
      "Rechnungskarten strukturieren Details, Betrag und Aktionen klarer fuer eine professionellere Darstellung",
      "Fahrten-Entwurf wird laufend lokal gesichert und Tachofotos koennen KM-Staende mit Tageslimit automatisch oder manuell uebernehmen",
      "Zwischenziele koennen Fotos mit Standortauslesung erhalten",
    ],
  },
  {
    version: "1.262.0",
    date: "2026-08-31",
    changes: [
      "Abrechnungsansicht mit zweizeiliger Toolbar und voll sichtbaren Statusfiltern aufgeraeumt",
      "Rechnungskarten strukturieren Details, Betrag und Aktionen klarer fuer eine professionellere Darstellung",
      "Fahrten-Entwurf wird laufend lokal gesichert und Tachofotos koennen KM-Staende automatisch uebernehmen",
      "Zwischenziele koennen Fotos mit Standortauslesung erhalten",
    ],
  },
  {
    version: "1.261.0",
    date: "2026-08-31",
    changes: [
      "Abrechnungsfilter bleibt einzeilig und horizontal scrollbar",
      "Rechnungsaktionen bleiben in einer Iconzeile und SIE-Export nutzt ein eigenes Datei-Ausgabe-Icon",
    ],
  },
  {
    version: "1.260.0",
    date: "2026-08-31",
    changes: [
      "Spiris-Uebergabe erstellt jetzt eine SIE-Importdatei pro gebuchter Rechnung",
      "Exportstatus wird erst nach Erstellung der Datei gesetzt und der Button als Datei-Export beschriftet",
    ],
  },
  {
    version: "1.259.0",
    date: "2026-08-31",
    changes: [
      "Auftragskarten richten Datum, Prioritaet und Status in einer gemeinsamen Kopfzeile aus",
      "Abrechnung startet standardmaessig mit dem Statusfilter Entwurf",
    ],
  },
  {
    version: "1.258.0",
    date: "2026-08-31",
    changes: [
      "Kunden verwalten Mailtexte fuer Einzelbericht, Wochenbericht, Offerte und Auftragsbestaetigung in einem aufklappbaren Bereich",
      "Abrechnungsfreigabe im Kundenformular ruhiger integriert und Auftragskarten mit rechtsbuendiger Icon-Zeile verdichtet",
    ],
  },
  {
    version: "1.257.0",
    date: "2026-08-31",
    changes: [
      "Offene Abrechnungsentwuerfe koennen direkt aus der Abrechnung entfernt werden",
      "Beim Entfernen eines Entwurfs wird der zugehoerige Auftrag auf nicht abrechenbar gesetzt",
    ],
  },
  {
    version: "1.256.0",
    date: "2026-08-31",
    changes: [
      "Tagesmail kann Erinnerungsquellen aus Apple/VTODO-ICS lesen",
      "Faellige Erinnerungen der naechsten 5 Tage werden in die taegliche Mail aufgenommen",
    ],
  },
  {
    version: "1.255.0",
    date: "2026-08-31",
    changes: [
      "Serienauftraege vererben die Abrechnungsfreigabe auch auf bestehende Teilauftraege",
      "Beim Ausschliessen aus der Abrechnung werden offene Abrechnungsentwuerfe der betroffenen Teilauftraege entfernt",
    ],
  },
  {
    version: "1.254.0",
    date: "2026-08-30",
    changes: [
      "Abrechnungs-Haken im Kunden- und Auftragsformular bleiben kompakt und sauber in einer Reihe",
    ],
  },
  {
    version: "1.253.0",
    date: "2026-08-30",
    changes: [
      "Checkbox-Zeilen fuer Abrechnungsfreigaben dezenter und sauber einzeilig gestaltet",
    ],
  },
  {
    version: "1.252.0",
    date: "2026-08-30",
    changes: [
      "Abrechnung erhaelt Suchfilter, Statusfilter und Gruppierung nach Rechnungsstatus",
      "Kunden koennen eine Abrechnungs-Voreinstellung setzen und Auftraege koennen einzeln von der Abrechnung ein- oder ausgeschlossen werden",
    ],
  },
  {
    version: "1.251.0",
    date: "2026-08-30",
    changes: [
      "Abrechnungsliste uebersichtlicher strukturiert und Rechnungsvorschau als Popup ergaenzt",
      "Automatische Server-Backups werden gedrosselt und gleiche Datenstaende nicht erneut gesichert",
    ],
  },
  {
    version: "1.250.0",
    date: "2026-08-30",
    changes: [
      "Aktualisiert- und Backup-Zeitpunkte zeigen Sekunden an",
      "Backup-Anzeige stellt klar, dass technische Backup-Teile automatisch zusammengehoeren",
    ],
  },
  {
    version: "1.249.0",
    date: "2026-08-30",
    changes: [
      "Statusoptionen im Mobil-vor-Ort-Schliessen-Dialog werden untereinander angezeigt",
    ],
  },
  {
    version: "1.248.0",
    date: "2026-08-30",
    changes: [
      "Beim Nachbearbeiten von Berichten bleibt der aktuelle Auftragsstatus vorausgewaehlt und unveraendert",
      "Der Statusdialog zeigt den aktuellen Status als erste Option und deaktiviert bereits aktive Statusoptionen",
    ],
  },
  {
    version: "1.247.0",
    date: "2026-08-30",
    changes: [
      "Bericht-Backups mit fehlenden Foto-Feldern werden beim Start robust normalisiert",
      "Die Ladeansicht zeigt bei Fehlern eine konkrete Meldung mit Neu-laden und Cache-leeren Aktionen",
    ],
  },
  {
    version: "1.246.0",
    date: "2026-08-30",
    changes: [
      "Die App zeigt den geladenen Online-Datenbestand sofort an und wartet beim Start nicht mehr auf einen Hintergrund-Speicherabgleich",
      "Der Startbildschirm kann dadurch nicht mehr durch Backup- oder Sync-Arbeit blockieren",
    ],
  },
  {
    version: "1.245.0",
    date: "2026-08-30",
    changes: [
      "Private Medienroute fuer geschuetzte Fotos aus Supabase Storage ergaenzt",
      "Base64-Migration nutzt einen privaten Medien-Bucket und ersetzt alte Bilddaten durch geschuetzte App-URLs",
    ],
  },
  {
    version: "1.244.0",
    date: "2026-08-30",
    changes: [
      "Admin-Migration lagert alte eingebettete Base64-Medien aus dem App-State in Supabase Storage aus",
      "Der App-State speichert nach der Migration nur noch Medien-URLs statt grosser eingebetteter Bilddaten",
    ],
  },
  {
    version: "1.243.0",
    date: "2026-08-30",
    changes: [
      "Der App-Start lädt den Online-Datenbestand schlank ohne alte eingebettete Bilddaten",
      "Kunden, Objekte und Aufträge werden dadurch wieder schnell angezeigt",
    ],
  },
  {
    version: "1.242.0",
    date: "2026-08-30",
    changes: [
      "Verdächtige lokale Demo- oder Teilstände werden beim Start nicht mehr mit dem Online-Datenbestand zusammengeführt",
      "Bei erreichbarem Server gilt der Online-Datenbestand als führender App-Stand",
    ],
  },
  {
    version: "1.241.0",
    date: "2026-08-30",
    changes: [
      "Beim Start wird kein Demo-Datenbestand mehr angezeigt, solange der Online-Datenstand noch lädt",
      "Der Online-Datenabruf wartet länger auf den großen aktuellen App-State",
      "Backups werden in kleine Supabase-Teilzeilen gespeichert und können daraus wiederhergestellt werden",
    ],
  },
  {
    version: "1.240.0",
    date: "2026-08-30",
    changes: [
      "Grosse Backups werden als komprimierte Teilzeilen in Supabase gespeichert, wenn Storage-Grenzen greifen",
      "Backup-Wiederherstellung erkennt komprimierte Teilzeilen eindeutig",
    ],
  },
  {
    version: "1.239.0",
    date: "2026-08-30",
    changes: [
      "Backup-Teildateien werden auf 512 KB begrenzt, damit Supabase-Groessengrenzen eingehalten werden",
    ],
  },
  {
    version: "1.238.0",
    date: "2026-08-30",
    changes: [
      "Lokal gespeicherte Demo-Fallbackdaten werden beim Start als ungueltig erkannt und nicht mehr angezeigt",
    ],
  },
  {
    version: "1.237.0",
    date: "2026-08-30",
    changes: [
      "Backup-Teildateien werden als echte kleine Buffer hochgeladen",
    ],
  },
  {
    version: "1.236.0",
    date: "2026-08-30",
    changes: [
      "Demo-Fallback-Daten werden beim Start nicht mehr als aktueller Datenstand angezeigt, wenn kein lokaler Speicher existiert",
      "Sehr grosse Server-Backups werden in mehrere kleine komprimierte Teile zerlegt",
      "Backup-Wiederherstellung setzt geteilte Backup-Dateien wieder zusammen",
    ],
  },
  {
    version: "1.235.0",
    date: "2026-08-30",
    changes: [
      "Server-Backups werden komprimiert als JSON-Gzip gespeichert, damit auch grosse App-Staende gesichert werden koennen",
      "Backup-Wiederherstellung kann komprimierte Backup-Dateien lesen",
      "Backup-Anzeige zeigt gespeicherte und originale Groesse",
    ],
  },
  {
    version: "1.234.0",
    date: "2026-08-30",
    changes: [
      "Stammdaten zeigen einen Backup-Bereich mit aktuellem Server-Backup-Stand",
      "Backups koennen in den Stammdaten manuell erstellt und gezielt wiederhergestellt werden",
      "Nach einer Wiederherstellung wird der lokale Browser-Speicher geleert und die App neu geladen",
    ],
  },
  {
    version: "1.233.0",
    date: "2026-08-30",
    changes: [
      "Manuelle Backup-Erstellung gibt bei Serverfehlern eine konkrete Fehlermeldung zurueck",
    ],
  },
  {
    version: "1.232.0",
    date: "2026-08-30",
    changes: [
      "Backup-API kann ein Server-Backup manuell erzeugen und gibt dabei konkrete Fehler zurueck",
      "Fehler beim Schreiben des Backup-Index werden nicht mehr still ignoriert",
    ],
  },
  {
    version: "1.231.0",
    date: "2026-08-30",
    changes: [
      "Vor dem Online-Speichern wird automatisch ein Server-Backup des vorherigen App-Stands erstellt",
      "Backups werden als Dateien in Supabase Storage abgelegt und ueber eine Backup-API wieder auffindbar",
      "Ein gespeichertes Backup kann serverseitig wieder als aktueller App-Stand hergestellt werden",
    ],
  },
  {
    version: "1.230.0",
    date: "2026-08-30",
    changes: [
      "Leerer lokaler Browser-Speicher wird beim Start nicht mehr als gueltiger Datenbestand angezeigt",
      "Nach einem fehlgeschlagenen Serverabruf wird ein leerer lokaler Stand nicht automatisch als geladen markiert",
    ],
  },
  {
    version: "1.229.0",
    date: "2026-08-30",
    changes: [
      "Bericht-Backups werden direkt beim Start ueber lokale Daten gelegt",
      "Gunnabo 26./27./28.08 wurden als kleine Bericht-Backups gesichert",
    ],
  },
  {
    version: "1.228.0",
    date: "2026-08-29",
    changes: [
      "Test-Versionswechsel zur Kontrolle der Bericht-Backup-Stabilitaet",
    ],
  },
  {
    version: "1.227.0",
    date: "2026-08-29",
    changes: [
      "Redeploy fuer neu gesetzten Supabase Service Role Key angestossen",
      "Medien-Storage kann nach Vercel-Environment-Aktualisierung den Bucket automatisch vorbereiten",
    ],
  },
  {
    version: "1.226.0",
    date: "2026-08-29",
    changes: [
      "Berichtstexte und Checklisten-Bemerkungen werden zusaetzlich in kleinen separaten Backup-Zeilen gesichert",
      "Beim Laden und Synchronisieren werden Bericht-Backups ueber den grossen Snapshot gelegt",
      "Die Medien-Upload-API meldet fehlende Supabase-Storage-Rechte klarer",
    ],
  },
  {
    version: "1.225.0",
    date: "2026-08-29",
    changes: [
      "Neue Vor-Ort-Fotos werden in Supabase Storage gespeichert und im App-State nur noch als URL referenziert",
      "Neue Berichtsanhaenge werden ausgelagert und beim Mailversand bei Bedarf geladen",
      "Neue Objekt- und Ressourcenbilder sowie Dokumente werden nicht mehr als grosse Base64-Daten im Snapshot abgelegt",
      "PDF-Berichte koennen Bilder aus Storage-URLs und alten Data-URLs darstellen",
    ],
  },
  {
    version: "1.224.0",
    date: "2026-08-29",
    changes: [
      "Berichte mit gleichem Auftrag und Datum werden client- und serverseitig zusammengefuehrt",
      "Vorhandene Bemerkungen werden nicht mehr durch leere oder kuerzere Rueckschreibungen verdraengt",
      "Wochenberichte uebernehmen fehlende Tagesnotizen auch aus dem mobilen Zwischenspeicher",
      "PDF-Bildgalerien reservieren genug Platz innerhalb der Checklisten-Karte",
    ],
  },
  {
    version: "1.223.0",
    date: "2026-08-29",
    changes: [
      "Mobil vor Ort oeffnet Auftraege und Berichte als Popup",
      "Beim Schliessen eines mobilen Einsatzes wird der Status In Arbeit oder Geplant abgefragt",
    ],
  },
  {
    version: "1.222.0",
    date: "2026-08-29",
    changes: [
      "PDF-Berichte orientieren sich optisch staerker an der Berichtsvorschau mit Kopf-, Objekt-, Info- und Checklisten-Karten",
      "PDF-Checklistenbilder werden als kompakte Galerie im Vorschau-Stil gesetzt",
      "Bericht- und Wochenbericht-Versanddialoge koennen zusaetzliche Dateianhaenge mit Bueroklammer-Icon speichern und mitsenden",
      "Mobil vor Ort kann Material, beschriftete Einsatznotizen und Berichtsanhaenge erfassen",
      "Berichte oeffnen aus der Berichtsuebersicht als Popup statt unterhalb der Liste",
      "Objektuebersichten sortieren inaktive Objekte nach unten",
      "Leistungs- und Materialpreise zeigen klar inkl. oder zzgl. Moms an",
      "Buchhaltungsrelevante Faktura-PDFs werden immer schwedisch erstellt",
    ],
  },
  {
    version: "1.220.0",
    date: "2026-08-28",
    changes: [
      "PDF-Berichtskopf ist niedriger und in zwei geordneten Zeilen gesetzt",
      "Wochenberichte zeigen nur noch manuell erfasste Kundenkommentare",
      "Wochenbericht-Checkpunkte werden mit echtem Datum statt laufender Nummer dargestellt",
      "Objektbilder und Berichtsfotos werden proportional ohne Verzerrung dargestellt",
      "PDF-Fotos werden platzsparender nebeneinander angeordnet",
    ],
  },
  {
    version: "1.219.0",
    date: "2026-08-28",
    changes: [
      "Berichtsaenderungen erhalten Zeitstempel und werden beim Verlassen des Feldes sofort online gespeichert",
      "Berichtszusammenfuehrung bevorzugt neuere Texte und erhaelt Checkpunkte aus parallelen Berichtsversionen",
      "Berichtsuebersicht und Objektverlauf zeigen zusammengefuehrte Berichte statt roher Doppelversionen",
    ],
  },
  {
    version: "1.218.0",
    date: "2026-08-28",
    changes: [
      "Der Mailtext im Bericht-Senden-Dialog ist jetzt vor dem Versand bearbeitbar",
      "Geaenderter Bericht-Mailtext wird beim Senden direkt verwendet",
    ],
  },
  {
    version: "1.217.0",
    date: "2026-08-28",
    changes: [
      "Kundenberichte blenden Minuten-Badges aus, wenn keine Arbeitszeit an Kunden gezeigt werden soll",
      "Berichtstext und Kundenkommentar koennen vor dem Senden direkt in Berichtsuebersicht und Objektverlauf bearbeitet werden",
      "Manuell angepasste Berichtszusammenfassungen bleiben beim mobilen Nachbearbeiten erhalten",
      "PDF-Berichte stellen Hochkantfotos proportional dar und kuerzen lange Berichtskopfzeilen sauber ein",
      "Berichte koennen vor dem Versand zusaetzliche Dateien wie PDF, Video oder Bilder als Mailanhaenge speichern",
      "Mobil vor Ort kann am Mac mehrere Fotos in einem Schritt an eine Checklistenposition haengen",
      "Fahrtenbuch und Quick-Fahrt unterstuetzen Zwischenziele mit optionaler Notiz",
      "Wochenberichte melden fehlende Objektdaten klar und oeffnen die Versandvorschau nach dem Erzeugen robuster",
    ],
  },
  {
    version: "1.216.0",
    date: "2026-08-28",
    changes: [
      "Checklistenpunkte einer Leistung koennen im Leistungskatalog jetzt bearbeitet und wieder uebernommen werden",
    ],
  },
  {
    version: "1.215.0",
    date: "2026-08-28",
    changes: [
      "Quick-Fahrt kann Start- und Endfoto vom Tacho speichern und Adressen aus Fotodaten oder Geraeteposition uebernehmen",
      "Name / besucht bei kann in der Quick-Fahrt per Sprache oder Tastatur erfasst werden",
      "Dienstfahrten verlangen jetzt einen Namen zusaetzlich zu Zweck, Strecke und Kilometerstaenden",
      "Arbeitszeiten koennen pro Leistung, Kunde und mobiler Checklistenposition fuer den Kundenbericht ein- oder ausgeblendet werden",
    ],
  },
  {
    version: "1.214.0",
    date: "2026-08-28",
    changes: [
      "Mehrere Fotos an derselben mobilen Checklistenposition bleiben beim asynchronen Speichern erhalten",
      "Vor-Ort-Fotos bekommen eindeutige IDs und werden beim Geraeteabgleich nicht mehr versehentlich zusammengelegt",
      "Zu jedem Vor-Ort-Foto kann direkt nach der Aufnahme oder spaeter eine kurze Info gespeichert werden",
    ],
  },
  {
    version: "1.213.0",
    date: "2026-08-27",
    changes: [
      "Geloeschte Fahrten im Fahrtenbuch werden beim Sync zwischen Geraeten nicht mehr wiederhergestellt",
      "Der Ressourcen-Abgleich merkt geloeschte Fahrten und filtert sie auch serverseitig aus",
    ],
  },
  {
    version: "1.212.0",
    date: "2026-08-26",
    changes: [
      "Kontenplan fuer Spiris / Visma in den Stammdaten hinterlegt",
      "Leistungen und Material koennen feste Erloeskonten aus dem Kontenplan verwenden",
      "Rechnungspositionen uebernehmen Kontierung, Waehrung, Moms und Kundennummern fuer die Spiris-Uebergabe",
      "Spiris-Uebergaben werden gegen doppelte Uebergabe geschuetzt und koennen zurueckgesetzt werden",
      "Die Kopfleiste zeigt neben Aktualisieren nur noch den letzten Datenabgleich an",
    ],
  },
  {
    version: "1.211.0",
    date: "2026-08-26",
    changes: [
      "Abrechnung zum Rechnungsprozess mit Rechnungs-PDF, Ausgangsbuch, Zahlungsstatus und Storno erweitert",
      "Visma wird als Buchhaltungsprogramm fuer die vollstaendige Datenuebergabe gefuehrt",
      "Kontierungsvorschau fuer Arbeit, Material, Rabatte, Waehrung, Moms und Kundennummern ergaenzt",
      "Globale Aktualisierungshinweise erscheinen kompakt in der Kopfleiste statt in der Kundenuebersicht",
    ],
  },
  {
    version: "1.210.0",
    date: "2026-08-25",
    changes: [
      "Die einklappbaren Bericht-Zeilen in Mobil vor Ort haben denselben seitlichen Textabstand wie Auftragszeilen",
    ],
  },
  {
    version: "1.209.0",
    date: "2026-08-25",
    changes: [
      "Ältere Gerätestände ohne Status-Zeitstempel können neuere Statuswechsel nicht mehr überschreiben",
      "Der Rückwechsel von in Arbeit auf geplant bleibt dadurch auch nach Aktualisieren auf beiden Geräten erhalten",
    ],
  },
  {
    version: "1.208.0",
    date: "2026-08-25",
    changes: [
      "In Mobil vor Ort steht die Anzahl direkt hinter Abgeschlossene Berichte und Gesendete Berichte",
    ],
  },
  {
    version: "1.207.0",
    date: "2026-08-25",
    changes: [
      "Der Rückweg von in Arbeit auf geplant wird jetzt immer am sichtbaren Auftrag ausgeführt und sofort online gespeichert",
      "Auftrag speichern, verschieben, Personal ändern und Ressourcen ändern werden direkt synchronisiert",
      "Manuelle Statusänderungen im Auftragsdialog bekommen einen Status-Zeitstempel für den Geräteabgleich",
    ],
  },
  {
    version: "1.206.0",
    date: "2026-08-25",
    changes: [
      "Die Berichtsübersicht hat wieder Suche, Statusfilter und Sortierung",
      "Ein geöffneter Bericht kann direkt wieder geschlossen werden",
    ],
  },
  {
    version: "1.205.0",
    date: "2026-08-25",
    changes: [
      "Statuswechsel beim Anwählen eines Auftrags werden sofort online gespeichert",
      "Beim Abgleich gewinnt für Auftragstatus jetzt der neueste Status-Zeitstempel statt pauschal der höhere Status",
      "Geplant, in Arbeit und erledigt bleiben dadurch zwischen iPhone und Mac synchron",
      "In Mobil vor Ort sind abgeschlossene Berichte standardmäßig eingeklappt",
      "Gesendete Berichte stehen in Mobil vor Ort in einer eigenen eingeklappten Gruppe",
    ],
  },
  {
    version: "1.204.0",
    date: "2026-08-25",
    changes: [
      "Zurückgesetzte Aufträge bleiben zentral geplant, auch wenn ein altes Gerät noch einen erledigten Stand ohne Bericht sendet",
      "Erst ein neu geladener und bewusst erneut abgeschlossener Einsatz kann den Auftrag wieder erledigen",
    ],
  },
  {
    version: "1.203.0",
    date: "2026-08-25",
    changes: [
      "Ein einzelner erledigter Auftrag kann bei Bedarf gezielt zentral zurückgesetzt werden, ohne den gesamten Datenbestand zu überschreiben",
      "Der normale Sync-Schutz gegen ältere Gerätestände bleibt dabei aktiv",
    ],
  },
  {
    version: "1.202.0",
    date: "2026-08-25",
    changes: [
      "Vor-Ort-Fotos werden pro Checklistenpunkt mit Zeitstempel gespeichert und beim Sync zusammengeführt",
      "Ältere Gerätedaten können neue Einsatzfotos nicht mehr aus dem Tagesbericht überschreiben",
      "Der automatische Online-Speicherweg nutzt ebenfalls Merge-Patches statt kompletter Datenersetzung",
    ],
  },
  {
    version: "1.201.0",
    date: "2026-08-25",
    changes: [
      "Homecare stellt fehlende Berichte aus gespeicherten Vor-Ort-Daten wieder her, wenn Checklisten, Zeiten oder Fotos noch vorhanden sind",
      "Wiederhergestellte Tagesberichte werden beim Geräteabgleich in die normale Berichtsliste übernommen",
      "Die Reparatur legt keine Duplikate an, wenn bereits ein Bericht für Auftrag und Datum existiert",
    ],
  },
  {
    version: "1.200.0",
    date: "2026-08-25",
    changes: [
      "Der Startabgleich nach einem App-Neuladen speichert zusammengeführte lokale Daten jetzt ebenfalls per kompaktem Online-Patch",
      "Homecare erkennt lokale Berichte, die online fehlen, und meldet beim Aktualisieren deren Upload",
      "Der Abgleich vermeidet dadurch Vollsnapshot-Uploads, die bei lokalen iPhone-Berichten mit Fotos scheitern können",
    ],
  },
  {
    version: "1.199.0",
    date: "2026-08-25",
    changes: [
      "Manuelles Aktualisieren lädt lokale iPhone-Änderungen jetzt per kompaktem Online-Patch hoch",
      "Lokale Berichte und Statusänderungen mit Fotos müssen dadurch nicht mehr als großer Vollsnapshot gespeichert werden",
      "Nach erfolgreichem Zusammenführen zeigt Homecare eine klare Online-Rückmeldung",
    ],
  },
  {
    version: "1.198.0",
    date: "2026-08-25",
    changes: [
      "Auftrag abwählen/schließen in Mobil vor Ort wird jetzt sofort online synchronisiert",
      "Online-Patches schützen erledigte Aufträge vor älteren geplanten oder in-Arbeit-Ständen",
      "Vor-Ort-Notizen und Vor-Ort-Zwischenstände werden beim Online-Patch pro Schlüssel zusammengeführt",
      "Mac und iPhone prüfen in Arbeitsansichten häufiger auf neue Online-Änderungen",
      "Fahrtenbuch übernimmt bei neuen Fahrten den letzten End-Km als Start-Km",
      "Fahrtenbucheinträge werden beim Geräteabgleich pro Eintrag zusammengeführt und sofort online gespeichert",
    ],
  },
  {
    version: "1.197.0",
    date: "2026-08-25",
    changes: [
      "Mobil vor Ort speichert Einsatzfotos robuster und mit kleinerer Bildvorschau",
      "Vor-Ort-Zwischenstände und abgeschlossene Einsätze werden sofort online synchronisiert",
      "Mehrtägige Einzelaufträge speichern Tagesberichte getrennt pro Arbeitstag",
      "Homecare korrigiert Serien-Teilaufträge mit vorhandenem Bericht beim Laden auf erledigt",
    ],
  },
  {
    version: "1.196.0",
    date: "2026-08-25",
    changes: [
      "Die Felder im pauschalen Rabattblock sind gleich hoch",
      "Rabattart, Wert, Grund und Löschen sind sauber in einer Zeile verteilt",
      "Das Grund-Feld nutzt jetzt den verfügbaren Platz bis zum rechten Löschicon",
    ],
  },
  {
    version: "1.195.0",
    date: "2026-08-25",
    changes: [
      "Der pauschale Rabatt ist kompakter angeordnet",
      "Rabattart, Wert und Grund sind schmaler dargestellt",
      "Das Löschen-Icon für den pauschalen Rabatt steht jetzt ganz rechts in derselben Zeile",
    ],
  },
  {
    version: "1.194.0",
    date: "2026-08-25",
    changes: [
      "Der Kopf im Auftragsdialog ist jetzt fest vom scrollenden Inhalt getrennt",
      "Beim Scrollen können keine Formularfelder mehr oberhalb der Überschrift sichtbar werden",
      "Nur der Formularinhalt unterhalb von Auftrag bearbeiten scrollt",
    ],
  },
  {
    version: "1.193.0",
    date: "2026-08-25",
    changes: [
      "Mengenfelder in Leistungs- und Materialpositionen sind schmaler und sauber untereinander ausgerichtet",
      "Der Kopf des Auftragsdialogs bleibt beim Scrollen sichtbar",
      "Der Dialogkopf hat jetzt einen deckenden Hintergrund, damit Inhalte sauber darunter verschwinden",
    ],
  },
  {
    version: "1.192.0",
    date: "2026-08-25",
    changes: [
      "Der Auftragsdialog ist jetzt als Workflow aufgebaut: Kopfdaten, Leistungen, Material, Zeitplanung, Abschluss",
      "Leistungen und Material werden nur noch per Hinzufügen-Button ausgewählt oder manuell angelegt",
      "Paket- und Stammdatenleistungen erscheinen nicht mehr als große Anhakliste im ersten Formularblock",
      "Löschen von Positionen und Rabatten nutzt einheitliche Papierkorb-Icons",
    ],
  },
  {
    version: "1.191.0",
    date: "2026-08-25",
    changes: [
      "Das Popup Auftrag bearbeiten nutzt jetzt deutlich mehr Bildschirmbreite",
      "Auf großen Bildschirmen wird der Auftragsdialog dreispaltig angeordnet",
      "Der Dialog hat mehr nutzbare Höhe und bleibt dadurch übersichtlicher",
    ],
  },
  {
    version: "1.190.0",
    date: "2026-08-25",
    changes: [
      "Das Mengenfeld bei Materialpositionen ist deutlich schmaler",
      "Materialpositionen sind mit Menge, Summe und Löschen sauberer in einer Flucht ausgerichtet",
      "Lange Materialdetails werden kompakt gekürzt statt die Zeile auseinanderzuziehen",
    ],
  },
  {
    version: "1.189.0",
    date: "2026-08-25",
    changes: [
      "Trennlinien im Offerten-PDF stehen jetzt erst nach Position plus zugehörigem Rabatt",
      "Positionsgruppen sind dadurch ruhiger und klarer lesbar",
      "Der Abstand zwischen Rabatt und nächster Position wurde reduziert",
    ],
  },
  {
    version: "1.188.0",
    date: "2026-08-25",
    changes: [
      "Materialpositionen nutzen jetzt feste Spalten für Text, Menge, Summe und Löschen",
      "Die Löschicons bleiben rechts sauber untereinander ausgerichtet",
      "Rabattfelder sind breiter und geordneter angeordnet",
    ],
  },
  {
    version: "1.187.0",
    date: "2026-08-25",
    changes: [
      "Rabatte im Offerten-PDF werden jetzt dezenter als Unterzeile dargestellt",
      "Negative Rabattbeträge nutzen ein sauberes Minuszeichen",
      "Rabattzeilen zeigen nur noch den relevanten Abzug statt unnötiger Tabellenwerte",
    ],
  },
  {
    version: "1.186.0",
    date: "2026-08-25",
    changes: [
      "Materialpositionen im Auftragsdialog sind optisch aufgeräumter und kompakter",
      "Der Papierkorb bleibt jetzt ein kleines Icon in der Positionszeile",
      "Rabattaktionen bei Materialpositionen sind schmaler und ziehen die Karte nicht mehr auseinander",
    ],
  },
  {
    version: "1.185.0",
    date: "2026-08-25",
    changes: [
      "Rabatte werden in Offerte und Auftragsbestätigung als kompakte Unterzeilen dargestellt",
      "Prozent-Rabatte zeigen den Prozentsatz direkt in der Rabattzeile",
      "Geldbeträge mit Cent/Öre werden im PDF sauber formatiert",
    ],
  },
  {
    version: "1.184.0",
    date: "2026-08-25",
    changes: [
      "Materialpositionen im Auftragsdialog sind jetzt kompakter angeordnet",
      "Rabatte bei Materialpositionen stehen dichter bei Menge und Summe",
      "Das Entfernen von Materialpositionen nutzt jetzt nur noch ein kleines Icon",
    ],
  },
  {
    version: "1.183.0",
    date: "2026-08-25",
    changes: [
      "Rabatte können jetzt einzeln an Leistungen und Materialpositionen gepflegt werden",
      "Zusätzlich bleibt ein pauschaler Auftragsrabatt möglich",
      "Positionsrabatte erscheinen in Offerte, Auftragsbestätigung und Abrechnung direkt bei der jeweiligen Position",
    ],
  },
  {
    version: "1.182.0",
    date: "2026-08-25",
    changes: [
      "Der Rabattbereich im Auftrag wird nur angezeigt, wenn ein Rabatt angelegt wurde",
      "Ohne Rabatt erscheint nur ein kompakter Button Rabatt hinzufügen",
      "Rabatte mit Wert 0 werden beim Speichern nicht als Rabattposition übernommen",
    ],
  },
  {
    version: "1.181.0",
    date: "2026-08-25",
    changes: [
      "Leistungen im Auftrag haben jetzt eine eigene Menge / Anzahl",
      "Rabatte können als Betrag oder Prozentwert im Auftrag erfasst werden",
      "Offerte, Auftragsbestätigung und Abrechnung berücksichtigen Leistungsmenge und Rabatt in den Summen",
    ],
  },
  {
    version: "1.180.0",
    date: "2026-08-25",
    changes: [
      "Beim Bestätigen einer Offerte öffnet sich jetzt zuerst der Auftragsdialog mit Status geplant",
      "Aufträge können nun als Auftragsbestätigung per PDF heruntergeladen und an Kunden gesendet werden",
      "Auftragsbestätigungen nutzen dieselbe Versandvorschau mit bearbeitbarem Mailtext wie Offerten",
    ],
  },
  {
    version: "1.179.0",
    date: "2026-08-25",
    changes: [
      "Die Offerten-PDF-Fusszeile ist optisch sauberer mit kleinen Blocküberschriften und Trennlinien aufgebaut",
      "Org.-Nr., Momsreg.nr/VAT und F-Skatt stehen im Steuerblock jetzt untereinander statt in einer langen Zeile",
    ],
  },
  {
    version: "1.178.0",
    date: "2026-08-25",
    changes: [
      "Die Offerten-PDF-Fusszeile verzichtet jetzt auf die Adresse, weil sie bereits im Kopf steht",
      "Die Fusszeile ist kompakter in Firma/Kontakt, Bank und Steuerdaten/F-Skatt aufgeteilt",
    ],
  },
  {
    version: "1.177.0",
    date: "2026-08-25",
    changes: [
      "Die Beschreibung in Offerten-PDFs steht jetzt mit Abstand direkt oberhalb der Positionsliste",
      "Die Beschreibung nutzt dieselbe ruhige Schriftgröße wie die Kopfdaten darüber",
    ],
  },
  {
    version: "1.176.0",
    date: "2026-08-25",
    changes: [
      "Offerten-PDFs übersetzen Einheiten bei schwedischen Kunden automatisch ins Schwedische",
      "Die Offerten-Fusszeile ist jetzt in mehrere zweizeilige Blöcke nebeneinander aufgeteilt",
      "Der Offertenstatus wird bei schwedischen Kunden als schwedischer Status ausgegeben",
    ],
  },
  {
    version: "1.175.0",
    date: "2026-08-25",
    changes: [
      "Kundenkommunikation richtet sich jetzt nach der beim Kunden gepflegten Sprache",
      "Schwedische Kunden erhalten Offerten-Mails, Berichts-Mails und Portal-Einladungen automatisch auf Schwedisch",
      "Offerten- und Berichts-PDFs verwenden bei schwedischen Kunden schwedische Überschriften und Hinweise",
    ],
  },
  {
    version: "1.174.0",
    date: "2026-08-25",
    changes: [
      "Die separate Steuernummer wurde aus den Firmenstammdaten entfernt",
      "Offerten-Fusszeilen nutzen nur noch Org.-Nr., Momsreg.nr / VAT, F-Skatt-Hinweis und Bankdaten",
    ],
  },
  {
    version: "1.173.0",
    date: "2026-08-25",
    changes: [
      "Firmenstammdaten enthalten jetzt Momsreg.nr / VAT und den F-Skatt-Status",
      "Offerten-PDFs zeigen Momsreg.nr / VAT und Godkänd för F-skatt automatisch in der Fusszeile",
      "Der F-Skatt-Hinweis wird nur ausgegeben, wenn er in den Firmenstammdaten aktiviert ist",
    ],
  },
  {
    version: "1.172.0",
    date: "2026-08-25",
    changes: [
      "Der Mailtext beim Offertenversand ist in der Versandvorschau bearbeitbar",
      "Offerten-PDFs haben eine Fusszeile mit Firmenname, Adresse, E-Mail, Org.-Nummer und Bankverbindung",
      "Firmenstammdaten koennen jetzt im Stammdatenbereich unter Firma gepflegt werden",
      "Die Offerten-Fusszeile verwendet automatisch die gepflegten Firmenstammdaten",
    ],
  },
  {
    version: "1.171.0",
    date: "2026-08-25",
    changes: [
      "Offerten koennen jetzt als ordentliches PDF mit Kolaretorp-Logo erstellt werden",
      "Offerten haben eine Versandvorschau mit freundlichem Du-Mailtext und PDF-Anhang",
      "Offerten-PDFs enthalten Leistungen, Material, Mengen, Netto, Moms und Gesamtbetrag",
      "Der Versand der Offerte wird am Auftrag mit Angebotsnummer und Sendezeit dokumentiert",
    ],
  },
  {
    version: "1.170.0",
    date: "2026-08-24",
    changes: [
      "Auftraege haben jetzt den Workflow-Status Offerte als Vorstufe zum geplanten Auftrag",
      "Erledigte Auftraege koennen automatisch in die Abrechnung uebernommen und als abgerechnet markiert werden",
      "Abrechnungspositionen speichern Rechnungsnummer, Rechnungsdatum, Leistungsdatum, Rechnungszeilen, Moms-Satz und Exportstatus fuer Spiris / Visma",
      "Material kann in den Stammdaten gepflegt und direkt in Offerten/Auftraegen frei oder aus dem Katalog erfasst werden",
    ],
  },
  {
    version: "1.169.0",
    date: "2026-08-24",
    changes: [
      "Nachrichten im Kundenportal oeffnen beim Anklicken jetzt ebenfalls ein Detail-Popup",
      "Das Popup zeigt Objekt, Status, Zeitstempel, Nachricht und Antwortenverlauf uebersichtlich an",
      "Der Nachrichtenverlauf im Portal bleibt dadurch kompakt und besser lesbar",
    ],
  },
  {
    version: "1.168.0",
    date: "2026-08-24",
    changes: [
      "Nachrichten im Kommunikationsreiter oeffnen beim Anklicken jetzt ein Detail-Popup",
      "Das Popup zeigt Nachricht, Kunde, Objekt, Status, Verlauf und Antwortfeld uebersichtlich an",
      "Die Kommunikationsliste bleibt dadurch kompakt und ohne ausgeklappte Detailflaechen",
    ],
  },
  {
    version: "1.167.0",
    date: "2026-08-24",
    changes: [
      "Der Dialog Nachricht an Kunde nutzt jetzt eine groessere, sauber strukturierte Versandmaske",
      "Empfaenger, Antwortadresse und Blindkopie werden als Info-Karten wie beim Berichtversand angezeigt",
      "Betreff und Nachricht sind als gut lesbare Eingabefelder mit grossem Textbereich angeordnet",
    ],
  },
  {
    version: "1.166.0",
    date: "2026-08-24",
    changes: [
      "Die Kommunikationsseite hat jetzt ein Such- und Filterfeld",
      "Kundenportal-Nachrichten koennen nach Datum, Kunde, Objekt oder Status sortiert werden",
      "Direkte Kundennachrichten aus der Kundenuebersicht bleiben mit dokumentiert",
    ],
  },
  {
    version: "1.165.0",
    date: "2026-08-24",
    changes: [
      "Aktive Kunden haben in der Kundenuebersicht jetzt einen direkten Nachricht-Button",
      "Im geoeffneten Kundenstamm gibt es oben einen Button Nachricht an Kunde",
      "Direkte Kundennachrichten werden per Mail mit Blindkopie an info@kolaretorp.se gesendet und im Kundenportal dokumentiert",
    ],
  },
  {
    version: "1.164.0",
    date: "2026-08-24",
    changes: [
      "Der Arbeitsbereich richtet Topbar, Kennzahlen und Inhalt wieder sauber oben aus",
      "Kundenportal-Anfragen werden als kompakte Listenzeilen statt grosser Karten dargestellt",
      "Nachricht, Zeitstempel, Status und Antwortaktion sind platzsparend in einer Zeile angeordnet",
    ],
  },
  {
    version: "1.163.0",
    date: "2026-08-24",
    changes: [
      "Kunden sehen Antworten auf Portal-Anfragen jetzt auch im Kundenportal",
      "Portal-Antworten werden unter der urspruenglichen Nachricht mit Zeitstempel angezeigt",
    ],
  },
  {
    version: "1.162.0",
    date: "2026-08-24",
    changes: [
      "Die oberen Kennzahlen-Kacheln sind deutlich kompakter dargestellt",
      "Der Arbeitsbereich nutzt geringere Abstaende, damit mehr Inhalt auf den Bildschirm passt",
    ],
  },
  {
    version: "1.161.0",
    date: "2026-08-24",
    changes: [
      "Die Kommunikationsliste ist kompakter dargestellt",
      "Status und Antworten-Button stehen jetzt direkt in der Kopfzeile der Anfrage",
      "Zeitstempel und Nachrichtentext brauchen deutlich weniger vertikalen Platz",
    ],
  },
  {
    version: "1.160.0",
    date: "2026-08-24",
    changes: [
      "Antworten auf Kundenportal-Anfragen werden jetzt direkt aus der App gesendet und dokumentiert",
      "App-Antworten werden mit Zeitstempel und Versandstatus an der urspruenglichen Anfrage gespeichert",
      "Antwortmails gehen als Blindkopie an info@kolaretorp.se",
    ],
  },
  {
    version: "1.159.0",
    date: "2026-08-24",
    changes: [
      "Antwortmails aus der Kommunikation kodieren Leerzeichen jetzt kompatibel fuer Apple Mail",
      "Betreff und Originalnachricht erscheinen dadurch ohne Pluszeichen",
    ],
  },
  {
    version: "1.158.0",
    date: "2026-08-24",
    changes: [
      "Kundenportal-Anfragen haben in der Kommunikation jetzt einen Antworten-Button",
      "Der Antworten-Button oeffnet eine Mail an den Kunden mit Betreff und Originalanfrage im Mailtext",
    ],
  },
  {
    version: "1.157.0",
    date: "2026-08-24",
    changes: [
      "Kundenportal-Anfragen speichern jetzt Mailstatus, Versandzeit und eventuelle Versandfehler",
      "Der Bereich Kommunikation zeigt alle Kundenportal-Nachrichten inklusive Nachrichtentext und Zeitstempel",
      "Kunden sehen ihre gesendeten Nachrichten im Portal mit Status und Sendezeit im Nachrichtenverlauf",
    ],
  },
  {
    version: "1.156.0",
    date: "2026-08-24",
    changes: [
      "Die Begruessung im Kundenportal lautet jetzt Vaelkommen im Kundenportal mit Ausrufezeichen hinter dem Vornamen",
    ],
  },
  {
    version: "1.155.0",
    date: "2026-08-24",
    changes: [
      "Die Kopfbox im Kundenportal begruesst Kunden jetzt mit Willkommen im Kundenportal und dem Vornamen",
    ],
  },
  {
    version: "1.154.0",
    date: "2026-08-24",
    changes: [
      "Doppelt zusammengesetzte Adressen wie Strasse und komplette Adresse werden in der Anzeige bereinigt",
      "Kundenportal, Objektlisten und Berichte zeigen dadurch Gunnabo 126 nur noch einmal mit PLZ und Ort",
      "Adressfelder normalisieren bereits vorhandene doppelte Adresswerte beim Oeffnen",
    ],
  },
  {
    version: "1.153.0",
    date: "2026-08-24",
    changes: [
      "Kunden und Objekte werden in der Uebersicht jetzt durch Klick auf die Zeile geoeffnet",
      "Archivieren, Wiederherstellen und endgueltiges Loeschen sind bei Kunden und Objekten nur noch im geoeffneten Datensatz moeglich",
      "Die Kundenuebersicht hat jetzt Suche und Sortierung nach Name, Anlagezeit oder Objekt",
    ],
  },
  {
    version: "1.152.0",
    date: "2026-08-24",
    changes: [
      "Erzwungenes Online-Speichern sendet jetzt nur noch kleine Daten-Patches statt den kompletten App-State",
      "Kundenspeichern laeuft dadurch nicht mehr in den 413-Fehler durch grosse Fotos oder Berichte",
      "Serverseitig werden Patch-Daten in den bestehenden App-State eingemischt",
    ],
  },
  {
    version: "1.151.0",
    date: "2026-08-24",
    changes: [
      "Online-Speichern versucht jetzt mehrere Speicherwege nacheinander",
      "Die App nutzt relative und absolute API-Adresse sowie fetch und XMLHttpRequest als Fallback",
      "Nach erfolgreichem Online-Speichern verschwindet eine alte Fehlermeldung automatisch",
    ],
  },
  {
    version: "1.150.0",
    date: "2026-08-24",
    changes: [
      "Online-Speichern hat jetzt einen XMLHttpRequest-Fallback fuer Safari- und PWA-Fetch-Fehler",
      "Bei The string did not match the expected pattern versucht die App automatisch den zweiten Speicherweg",
      "Die Speicheradresse wird jetzt aus window.location.origin gebildet",
    ],
  },
  {
    version: "1.149.0",
    date: "2026-08-24",
    changes: [
      "Online-Speichern nutzt jetzt eine absolute API-Adresse und POST statt PUT",
      "Safari- und PWA-Probleme mit dem Speichern von Kundendaten werden dadurch umgangen",
      "Die App-State-API akzeptiert weiterhin PUT und zusaetzlich POST fuer Speicherungen",
    ],
  },
  {
    version: "1.148.0",
    date: "2026-08-24",
    changes: [
      "Online-Speichern verwendet beim PUT keine Safari-kritische Cache-Option mehr",
      "Der Fehler The string did not match the expected pattern beim Speichern wird dadurch vermieden",
    ],
  },
  {
    version: "1.147.0",
    date: "2026-08-24",
    changes: [
      "Kunde speichern schreibt Kundendaten jetzt erzwungen direkt in die Online-Datenbank",
      "Auch Stammdaten-Speichern im Kundenportal nutzt jetzt den erzwungenen Online-Speicherweg",
      "Damit werden Telefonnummern wie bei Korn nicht mehr nur lokal sichtbar gespeichert",
    ],
  },
  {
    version: "1.146.0",
    date: "2026-08-24",
    changes: [
      "Explizites Speichern von Stammdaten startet den Online-Speicherlauf jetzt sofort",
      "Kundentelefonnummern sollen dadurch ohne spuerbare Wartezeit in Supabase landen",
    ],
  },
  {
    version: "1.145.0",
    date: "2026-08-24",
    changes: [
      "Der Aktualisieren-Button prueft jetzt zuerst, ob eine neue App-Version online ist",
      "Bei neuer Version wird die WebApp automatisch neu geladen, damit der aktuelle Synchronisationscode laeuft",
      "Das verhindert, dass alte Safari- oder PWA-Caches lokale Telefonnummern nicht in die Datenbank schreiben",
    ],
  },
  {
    version: "1.144.0",
    date: "2026-08-24",
    changes: [
      "Geoeffnete Berichte im Kundenportal koennen jetzt wieder geschlossen werden",
    ],
  },
  {
    version: "1.143.0",
    date: "2026-08-24",
    changes: [
      "Manuelles Aktualisieren fuehrt lokale und Online-Kundendaten jetzt auch bei reinen Feldabweichungen zusammen",
      "Lokale Telefonnummern koennen dadurch leere Online-Werte wieder reparieren",
      "Der Objektbereich im Kundenportal nutzt jetzt denselben Ueberschriftenstil wie die anderen Portalbereiche",
    ],
  },
  {
    version: "1.142.0",
    date: "2026-08-24",
    changes: [
      "Bei Kunden heisst die laufende Nummer jetzt Kundennummer statt Personalnummer",
      "Personalnummer bleibt ausschliesslich in der Personalverwaltung sichtbar",
    ],
  },
  {
    version: "1.141.0",
    date: "2026-08-24",
    changes: [
      "Telefonfelder im Kundenportal ziehen nachgeladenen Online-Stand sicher nach",
      "Platzhalter-Striche werden im Kundenportal nicht mehr als Telefonnummer angezeigt",
      "Im Kundenportal wird im Dunkelmodus automatisch das helle Logo angezeigt",
    ],
  },
  {
    version: "1.140.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal wird im Dunkelmodus automatisch das helle Logo angezeigt",
    ],
  },
  {
    version: "1.139.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal zeigt der Objektbereich nur noch die Ueberschrift Objekte ohne zusaetzliche Kundenportal-Vorzeile",
    ],
  },
  {
    version: "1.138.0",
    date: "2026-08-24",
    changes: [
      "Das Kundenportal nutzt jetzt die volle Bildschirmbreite",
      "Portalboxen und Abstaende sind kompakter dargestellt",
      "Telefonnummern von Kunden bleiben beim Versionswechsel und Geraeteabgleich erhalten",
    ],
  },
  {
    version: "1.137.0",
    date: "2026-08-24",
    changes: [
      "Telefonnummern von Kunden werden beim Versionswechsel und Geraeteabgleich vor leeren lokalen Werten geschuetzt",
      "Beim Speichern eines bestehenden Kunden ueberschreibt ein leeres Telefonfeld keine vorhandene Nummer mehr",
      "Telefon 2 wird ebenfalls beim Zusammenfuehren von Online- und lokalen Daten erhalten",
    ],
  },
  {
    version: "1.136.0",
    date: "2026-08-24",
    changes: [
      "Das Logo im Kundenportal ist oben groesser dargestellt",
      "Der Portal-Kopf zeigt neben dem Logo keinen zusaetzlichen Kundenportal-Text mehr",
      "Die erste Portalbox zeigt nur noch Kundenportal ohne Kundenname und E-Mail",
    ],
  },
  {
    version: "1.135.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal zeigt Zugang jetzt den gepflegten Zugangsweg ohne feste Schlüsselsafe-Beschriftung",
      "Zugangsarten wie Schlüssel, Chip oder Code werden dadurch neutral angezeigt",
    ],
  },
  {
    version: "1.134.0",
    date: "2026-08-24",
    changes: [
      "Kunden haben jetzt ein zweites optionales Telefonnummernfeld",
      "Telefon 2 wird im Kundenformular, in der Kundenübersicht und im Kundenportal gepflegt",
      "Leere zweite Telefonnummern bleiben leer und werden nicht als Platzhalter angezeigt",
    ],
  },
  {
    version: "1.133.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal ist die Überschrift Objekte wieder sichtbar",
      "Nächster Besuch im Objekt nutzt jetzt den nächsten offenen Auftrag für dieses Objekt",
      "Wenn kein offener Auftrag geplant ist, zeigt das Portal noch nichts geplant",
    ],
  },
  {
    version: "1.132.0",
    date: "2026-08-24",
    changes: [
      "Neu angelegte Betreuungspakete stehen jetzt im Objektformular zur Auswahl",
      "Das Betreuungspaket im Objekt ist nicht mehr auf Basis, Plus, Komfort und Premium begrenzt",
      "Bestehende Paketwerte bleiben in der Auswahl sichtbar, auch wenn ein Paket später archiviert wird",
    ],
  },
  {
    version: "1.131.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal öffnet ein Klick auf ein Objekt jetzt die Objektstammdaten",
      "Die Objektstammdaten zeigen Adresse, Status, Paket, Eckdaten, Zugang, Technik und Ausstattung",
      "Die Objektstammdaten lassen sich im Portal wieder schließen",
    ],
  },
  {
    version: "1.130.0",
    date: "2026-08-24",
    changes: [
      "Im Kundenportal wurde die Überschrift Deine Ferienhäuser im Objektbereich entfernt",
      "Die Objektliste im Portal bleibt direkt sichtbar ohne zusätzlichen Panel-Kopf",
    ],
  },
  {
    version: "1.129.0",
    date: "2026-08-24",
    changes: [
      "Personalnummern werden jetzt als kurze laufende Nummern wie 001, 002 und 003 erzeugt",
      "Lange alte Nummern werden in der Oberfläche nicht mehr angezeigt und beim Speichern durch die nächste dreistellige Nummer ersetzt",
      "Die technische eindeutige ID bleibt im Hintergrund erhalten, damit Archivieren und Löschen stabil bleiben",
    ],
  },
  {
    version: "1.128.0",
    date: "2026-08-24",
    changes: [
      "Neue Kunden und neues Personal erhalten echte eindeutige IDs statt wiederverwendbarer laufender Nummern",
      "Kunden und Personal zeigen Personalnummer und angelegt am in Übersicht und Bearbeitung",
      "Archivieren, Wiederherstellen und endgültiges Löschen von Kunden speichern sofort online",
      "Endgültiges Löschen entfernt nur noch den angeklickten Kundendatensatz, auch falls alte doppelte IDs vorhanden sind",
    ],
  },
  {
    version: "1.127.0",
    date: "2026-08-21",
    changes: [
      "Supabase-Disk-IO wird reduziert: automatische Online-Prüfung läuft deutlich seltener",
      "Die App speichert identische Snapshots nicht erneut in Supabase",
      "Die App-State-API hält gelesene Daten bis zu 30 Sekunden im Server-Zwischenspeicher",
      "Manuelles Aktualisieren bleibt jederzeit über den Aktualisieren-Button möglich",
    ],
  },
  {
    version: "1.126.0",
    date: "2026-08-21",
    changes: [
      "Die WebApp hat jetzt einen Aktualisieren-Button in der Kopfzeile",
      "Der Button lädt Online-Änderungen sofort neu, ohne die Safari-WebApp schließen zu müssen",
      "Während der Aktualisierung zeigt der Button einen laufenden Status und danach eine kurze Rückmeldung",
    ],
  },
  {
    version: "1.125.0",
    date: "2026-08-21",
    changes: [
      "KW-Zusammenfassungen von Serienaufträgen können jetzt als versendbarer Wochenbericht erzeugt werden",
      "Wochenberichte öffnen direkt die Versandvorschau und nutzen denselben PDF- und Mailweg wie Tagesberichte",
      "Wochenberichte behalten vorhandene Kundenkommentare und Versandstatus beim erneuten Aktualisieren",
      "PDF, Vorschau und Mailbetreff unterscheiden jetzt Einsatzberichte und Wochenberichte",
    ],
  },
  {
    version: "1.124.0",
    date: "2026-08-21",
    changes: [
      "Kunden- und Objektfelder werden beim Verlassen des Feldes automatisch gespeichert",
      "Mobil vor Ort können Zeiten jetzt getrennt in Stunden und Minuten eingegeben werden",
      "Aufgeklappte Serienaufträge zeigen einen Wochenbericht pro Kalenderwoche",
      "Planung, Dashboard und Aufträge holen Online-Änderungen anderer Geräte schneller und auch nach Fokuswechsel erneut ab",
      "Klick auf einen Auftrag in der Einsatzplanung öffnet jetzt den Auftrag statt ihn als in Arbeit zu starten",
      "Personal und Ressourcen öffnen standardmäßig in der Listenansicht und nutzen Symbolbuttons für Liste und Kacheln",
      "App-Überschrift und Browser-Titel verwenden jetzt Homecare statt Ferienhausverwaltung",
      "Tagesmail kann jetzt direkt in den Stammdaten bei den Tagesmail-Einstellungen gestartet werden",
      "Dunkelmodus ist als kompakter Symbolbutton dargestellt",
      "Navigation, Kopfbereich, Quickbar und Stammdaten nutzen gepflegte schwedische UI-Übersetzungen",
      "Online-Speicherung wird gebündelt, damit Feldwechsel und Planung weniger Komplett-Synchronisationen auslösen",
      "Automatische Aktualisierung anderer Geräte läuft seltener im Hintergrund und weiterhin sofort bei Fokuswechsel",
      "App-State-API puffert kurze Lesezugriffe und behandelt Supabase-Überlastung ohne Vercel-500er-Burst",
      "Supabase-Schreibfehler werden kurz wiederholt und clientseitig als retryfähig behandelt",
    ],
  },
  {
    version: "1.123.0",
    date: "2026-08-20",
    changes: [
      "Startet am und Endet am stehen im Auftragsformular jetzt in einer gemeinsamen Zeile",
      "Auf kleinen Bildschirmen bricht die Datumszeile weiterhin sauber untereinander um",
    ],
  },
  {
    version: "1.122.0",
    date: "2026-08-20",
    changes: [
      "Tagesmail wird zusätzlich als Kopie an Nicole.Klos@icloud.com gesendet",
      "Nicole wird nicht doppelt eingetragen, falls sie Hauptempfängerin der Tagesmail ist",
    ],
  },
  {
    version: "1.121.0",
    date: "2026-08-20",
    changes: [
      "Einmalige Aufträge können jetzt über mehrere Tage laufen",
      "Auftragsformular hat Startet am und Endet am statt nur einem Fälligkeitsdatum",
      "Mehrtagesaufträge werden in Planung, Dashboard, Mobilansicht und Objektverlauf als Zeitraum angezeigt",
      "Drag & Drop verschiebt bei Mehrtagesaufträgen den Ausführungsstart, die Dauer bleibt erhalten",
    ],
  },
  {
    version: "1.120.0",
    date: "2026-08-20",
    changes: [
      "Personal-Stammdaten haben jetzt Kachel- und Listenansicht",
      "Ressourcen-Stammdaten haben jetzt Kachel- und Listenansicht",
      "Klick auf Personal- oder Ressourcenlisten öffnet direkt die Bearbeitung",
    ],
  },
  {
    version: "1.119.0",
    date: "2026-08-20",
    changes: [
      "Nächster offener Teilauftrag berücksichtigt jetzt das verschobene Einsatzdatum",
      "Dashboard und Serienköpfe sortieren offene Teilaufträge nach Einsatzdatum",
      "Mobil vor Ort zeigt bei verschobenen Aufträgen Einsatzdatum und Originaldatum",
      "Vor-Ort-Berichte werden beim Abschließen mit dem Einsatzdatum gespeichert",
    ],
  },
  {
    version: "1.118.0",
    date: "2026-08-20",
    changes: [
      "Verschobene Teilaufträge zeigen in der Serienliste jetzt das neue Einsatzdatum",
      "Bei verschobenen Teilaufträgen bleiben Originaldatum und Verschiebeanzahl sichtbar",
      "Aktionen für Teilaufträge verwenden das aktuelle Einsatzdatum in der Beschriftung",
    ],
  },
  {
    version: "1.117.0",
    date: "2026-08-20",
    changes: [
      "Dashboard markiert zusammengehörige Aufträge mit derselben Gruppenfarbe",
      "Auftragsübersicht markiert Serien-Master und Teilaufträge mit derselben Farbe",
      "Gruppenfarben bleiben stabil, auch nach Synchronisierung oder Neuladen",
    ],
  },
  {
    version: "1.116.0",
    date: "2026-08-20",
    changes: [
      "Aufträge können im Dispokalender per Drag & Drop auf andere Tage oder Personalzeilen verschoben werden",
      "Beim Verschieben bleibt das Originaldatum erhalten und nur das Ausführdatum ändert sich",
      "Verschiebungen werden am Auftrag mit Originaldatum, Ausführdatum, Personal und Zeitstempel protokolliert",
    ],
  },
  {
    version: "1.115.0",
    date: "2026-08-20",
    changes: [
      "Personal- und Ressourcen-Stammdaten starten jetzt mit einer Listenansicht",
      "Neues Personal und neue Ressourcen werden über eigene Neuanlage-Buttons geöffnet",
      "Ressourcen-Karten zeigen oben rechts ein kleines Vorschaubild oder einen Platzhalter",
    ],
  },
  {
    version: "1.114.0",
    date: "2026-08-20",
    changes: [
      "Einsatzplanung zeigt nur noch eine offene Zeile Nicht zugewiesen statt doppelter Platzhalter",
      "Personal kann direkt auf der Dispo-Karte einem Einsatz zugewiesen werden",
      "Personal- und Ressourcenzuweisungen werden sofort online gespeichert",
    ],
  },
  {
    version: "1.113.0",
    date: "2026-08-20",
    changes: [
      "In der Einsatzplanung können Ressourcen direkt einem Einsatz zugeordnet werden",
      "Zugeordnete Ressourcen werden auf der Dispo-Karte angezeigt und können entfernt werden",
      "Der Auswahlkalender öffnet nicht mehr am rechten Bildschirmrand außerhalb der Ansicht",
    ],
  },
  {
    version: "1.112.0",
    date: "2026-08-20",
    changes: [
      "Dispokalender ersetzt den Jahres-Button durch einen Kalender-Button zur Datumsauswahl",
      "Ausgewähltes Datum springt automatisch zur passenden Montag-bis-Sonntag-Woche",
      "Dispokalender ist kompakter, damit eine komplette Woche besser auf den Mac-Bildschirm passt",
    ],
  },
  {
    version: "1.111.0",
    date: "2026-08-20",
    changes: [
      "Dispokalender zeigt immer exakt eine Woche von Montag bis Sonntag",
      "Dispokalender blendet die Kalenderwoche ein",
      "Wochen-Navigation springt immer montags zur vorherigen oder nächsten Woche",
    ],
  },
  {
    version: "1.110.0",
    date: "2026-08-20",
    changes: [
      "Tagesmail akzeptiert jetzt Apple webcal:// Kalenderquellen",
      "Ein versehentlicher Punkt am Ende einer Kalenderquelle wird beim Abruf ignoriert",
    ],
  },
  {
    version: "1.109.0",
    date: "2026-08-20",
    changes: [
      "Dispokalender kann wochenweise vor- und zurückgeklickt werden",
      "Dispokalender hat eine Jahresansicht für Serien bis zum letzten aktiven Termin",
      "Einsatzplanung nutzt jetzt alle aktiven Teilaufträge statt nur den nächsten Serien-Termin",
    ],
  },
  {
    version: "1.108.0",
    date: "2026-08-20",
    changes: [
      "Dispo-Matrix erweitert den sichtbaren Zeitraum automatisch bis zum spätesten aktiven Auftrag",
      "Serienaufträge wie Umbau Gunnabo bleiben in der Einsatzplanung bis zum Serien-Enddatum sichtbar",
    ],
  },
  {
    version: "1.107.0",
    date: "2026-08-20",
    changes: [
      "Tagesmail-Kalenderquellen können jetzt in den Stammdaten konfiguriert werden",
      "Kalender- und Geburtstagsquellen werden online synchronisiert und von der Tagesmail verwendet",
    ],
  },
  {
    version: "1.106.0",
    date: "2026-08-20",
    changes: [
      "Einsatzplanung zeigt jetzt eine Dispo-Matrix mit Personalzeilen und Tages-Spalten",
      "Einsätze werden in der Planung nach Mitarbeiter und Datum einsortiert",
      "Überfällige Einsätze bleiben als eigener Block oberhalb des Dispo-Boards sichtbar",
    ],
  },
  {
    version: "1.105.0",
    date: "2026-08-20",
    changes: [
      "Tagesmail kann jetzt über einen Button direkt aus dem Programm manuell gestartet werden",
      "Manueller Tagesmailversand zeigt eine Rückmeldung mit Anzahl aktiver Aufträge",
    ],
  },
  {
    version: "1.104.0",
    date: "2026-08-20",
    changes: [
      "Button für Ressourcenbilder heißt jetzt Bild hinzufügen",
    ],
  },
  {
    version: "1.103.0",
    date: "2026-08-20",
    changes: [
      "Zweck / Ärende im Fahrtenbuch ist jetzt ein lernendes Auswahlfeld",
      "Quickfahrt nutzt dieselben gelernten Zweck-Vorschläge wie das Ressourcen-Fahrtenbuch",
    ],
  },
  {
    version: "1.102.0",
    date: "2026-08-20",
    changes: [
      "Fahrten können jetzt über einen globalen Quickbutton aus jeder Ansicht erfasst werden",
      "Quickfahrt speichert direkt ins Fahrtenbuch des gewählten Fahrzeugs",
      "Quickfahrt übernimmt nach dem Speichern Zieladresse und End-Km als Vorschlag für die nächste Fahrt",
    ],
  },
  {
    version: "1.101.0",
    date: "2026-08-20",
    changes: [
      "Ressourcen können jetzt Bilder direkt per Upload oder Mobilfoto speichern",
      "Ressourcenbilder können beschrieben, als Hauptbild markiert und entfernt werden",
      "Einsatzplanung ist jetzt als Dispo-Kalender mit Tages-Spalten und überfälligen Einsätzen aufgebaut",
    ],
  },
  {
    version: "1.100.0",
    date: "2026-08-20",
    changes: [
      "Tagesmail nutzt jetzt dieselbe aktive Auftragsliste wie die Auftragsübersicht",
      "Tagesmail kann Kalendertermine für heute und die nächsten drei Tage aus Kalender-ICS-Quellen aufführen",
      "Tagesmail kann Geburtstage aus einer verbundenen Geburtstags-ICS-Quelle aufführen",
      "Start- und Zieladressen im Fahrtenbuch werden gespeichert und als lernende Vorschläge angeboten",
    ],
  },
  {
    version: "1.99.0",
    date: "2026-08-20",
    changes: [
      "Stammdaten enthalten jetzt Personalverwaltung",
      "Stammdaten enthalten jetzt Ressourcen für Fahrzeuge, Maschinen und Geräte",
      "Fahrzeuge haben ein Fahrtenbuch mit Skatteverket-relevanten Feldern für Kilometerstände, Fahrtzweck, Strecke und Dienst-/Privatfahrten",
    ],
  },
  {
    version: "1.98.0",
    date: "2026-08-20",
    changes: [
      "Portal-Einladung verwendet den Kundenvornamen statt Ansprechpartner-Platzhalter",
      "Kundenname wird im Kundenformular in Vorname und Nachname getrennt gepflegt",
    ],
  },
  {
    version: "1.97.0",
    date: "2026-08-20",
    changes: [
      "PLZ-Eingaben bleiben beim Tippen im PLZ-Feld und springen nicht mehr in das Feld Ort",
    ],
  },
  {
    version: "1.96.0",
    date: "2026-08-20",
    changes: [
      "Portal-Einladungstext verwendet jetzt durchgehend Du-Form",
      "Portal-Einladung spricht Kunden immer mit dem Vornamen an",
    ],
  },
  {
    version: "1.95.0",
    date: "2026-08-20",
    changes: [
      "Adressfelder zeigen innerhalb jedes Adressblocks nur noch Straße, PLZ und Ort",
      "Kunden können eine abweichende Rechnungsadresse erfassen",
      "Objekt- und Rechnungsadressen nutzen dieselbe getrennte Eingabe nach Straße, PLZ und Ort",
    ],
  },
  {
    version: "1.94.0",
    date: "2026-08-20",
    changes: [
      "Portal-Einladung erzeugt jetzt eine bearbeitbare E-Mail-Vorschau",
      "Einladungsvorschau zeigt Empfänger, Betreff und Zugangsdaten im Mailtext",
      "Portal-Einladung kann direkt aus der Vorschau gesendet werden",
      "Beim Senden der Portal-Einladung werden die Kundendaten gespeichert",
    ],
  },
  {
    version: "1.93.0",
    date: "2026-08-20",
    changes: [
      "Kundenadressen werden jetzt getrennt nach Straße, PLZ und Ort gepflegt",
      "Objektadressen, Eigentümeradressen und Rechnungsadressen werden getrennt nach Straße, PLZ und Ort gepflegt",
      "Portal-Passwort aus PLZ und Hausnummer nutzt jetzt die getrennt gepflegte Adresse",
      "E-Mail-Adresse in Objektstammdaten kann jetzt ebenfalls leer gespeichert werden",
    ],
  },
  {
    version: "1.92.0",
    date: "2026-08-20",
    changes: [
      "Kunden-E-Mail-Adressen können jetzt vollständig geleert werden",
      "Sprache im Kundenstamm ist jetzt eine lernende Vorschlagsliste",
      "Kunden können im Kundenstamm für das Portal vorbereitet werden",
      "Portal-Passwort wird beim Einladen aus PLZ und Hausnummer gebildet",
      "Objektstatus ist jetzt eine lernende Vorschlagsliste",
    ],
  },
  {
    version: "1.91.0",
    date: "2026-08-20",
    changes: [
      "Statusgruppen im Objektverlauf sind jetzt standardmäßig geschlossen",
      "Einträge im Objektverlauf werden erst angezeigt, wenn die jeweilige Statusgruppe per Pfeil geöffnet wird",
    ],
  },
  {
    version: "1.90.0",
    date: "2026-08-20",
    changes: [
      "Objektverlauf gruppiert Einsätze jetzt nach Status",
      "Einträge im Objektverlauf werden innerhalb jeder Statusgruppe nach Datum aufsteigend angezeigt",
      "Statusgruppen im Objektverlauf sind per Pfeil auf- und zuklappbar",
      "Online-Synchronisierung übernimmt lokale Offline-Änderungen beim nächsten Netz wieder in Supabase",
      "Abgeschlossene Aufträge werden beim Zusammenführen nicht mehr durch ältere geplante Stände überschrieben",
    ],
  },
  {
    version: "1.89.0",
    date: "2026-08-17",
    changes: [
      "Aktive Kunden, aktive Objekte und aktive Aufträge sind jetzt ebenfalls per Pfeil einklappbar",
      "Aktive Listen bleiben standardmäßig geöffnet und zeigen die Anzahl im Klappkopf",
    ],
  },
  {
    version: "1.88.0",
    date: "2026-08-17",
    changes: [
      "Archivierte Kunden werden jetzt wie archivierte Objekte als einklappbarer Block mit Pfeil angezeigt",
    ],
  },
  {
    version: "1.87.0",
    date: "2026-08-17",
    changes: [
      "Login-Verlauf im Kundenstamm ist jetzt als einklappbarer Block mit Pfeil dargestellt",
      "Portal-Login-Protokoll zeigt im geschlossenen Zustand nur noch Titel und Anzahl",
    ],
  },
  {
    version: "1.86.0",
    date: "2026-08-17",
    changes: [
      "Mobil vor Ort nutzt dieselbe nach Datum sortierte Arbeitslistenlogik wie das Dashboard",
      "Bei Serienaufträgen werden Mobil vor Ort die nächsten fünf offenen Teiltermine angezeigt",
      "Serientermine sind auch mobil mit Hauptauftrag und Rhythmus gekennzeichnet",
    ],
  },
  {
    version: "1.85.0",
    date: "2026-08-17",
    changes: [
      "Dashboard-Arbeitsliste wird nach Fälligkeitsdatum sortiert",
      "Bei Serienaufträgen zeigt das Dashboard jetzt die nächsten fünf offenen Teiltermine",
      "Serientermine in der Arbeitsliste zeigen den zugehörigen Hauptauftrag und Rhythmus",
    ],
  },
  {
    version: "1.84.0",
    date: "2026-08-17",
    changes: [
      "Erledigte und stornierte Aufträge werden unten in einklappbaren Gruppen angezeigt",
      "Aktive Aufträge bleiben in der Auftragsübersicht direkt sichtbar",
      "Gruppen für erledigte und stornierte Aufträge zeigen Anzahl und Pfeil zum Öffnen",
      "Archivierte Objekte werden ebenfalls als einklappbarer Block mit Pfeil angezeigt",
    ],
  },
  {
    version: "1.83.0",
    date: "2026-08-17",
    changes: [
      "Aktionsbuttons in Auftrags- und Archivlisten werden nicht mehr durch Tabellenstyles vergrößert",
      "Buttonblöcke in der Auftragsübersicht sind jetzt sauberer und gleichmäßiger ausgerichtet",
    ],
  },
  {
    version: "1.82.0",
    date: "2026-08-17",
    changes: [
      "Stornierte Aufträge werden in der Auftragsübersicht unten separat gruppiert",
      "Auftragszeilen und Teilauftragszeilen wurden kompakter gestaltet",
      "Aktionsbuttons in der Auftragsübersicht sind kleiner und dichter ausgerichtet",
    ],
  },
  {
    version: "1.81.0",
    date: "2026-08-17",
    changes: [
      "Archivierte Kunden, Objekte, Leistungen und Pakete werden kompakter dargestellt",
      "Archiv-Aktionsbuttons stehen jetzt kleiner und einzeilig in einer gemeinsamen Buttonzeile",
      "Löschen, Bearbeiten und Reaktivieren nutzen in Archivlisten dieselbe kompakte Icon-Darstellung",
    ],
  },
  {
    version: "1.80.0",
    date: "2026-08-17",
    changes: [
      "Überschrift der Leistungsanfrage im Kundenportal lautet jetzt Nachricht an Kolaretorp Service AB",
    ],
  },
  {
    version: "1.79.0",
    date: "2026-08-17",
    changes: [
      "Kundenportal-Texte wurden auf Du-Form umgestellt",
      "Leistungsanfrage im Portal spricht Kunden jetzt direkt und persönlicher an",
      "Leere Zustände und Bestätigungsmeldungen im Portal sind kundenfreundlicher formuliert",
      "Einsatzberichte können jetzt direkt als PDF heruntergeladen werden",
    ],
  },
  {
    version: "1.78.0",
    date: "2026-08-17",
    changes: [
      "Auftragsanlage im Kundenportal wurde entfernt",
      "Kunden fragen Leistungen jetzt über den Nachrichtenbereich an",
      "Portal-Anfragen erhalten automatisch einen passenden Betreff, wenn keiner eingegeben wurde",
      "Portal-Willkommen zeigt nur noch Välkommen im Kundenportal, da das Logo die Firma bereits sichtbar macht",
    ],
  },
  {
    version: "1.77.0",
    date: "2026-08-17",
    changes: [
      "Kundenportal-Login wurde gestalterisch neu aufgebaut",
      "Vor dem Login erscheint keine doppelte Portal-Headline mehr",
      "Logo und Willkommenszeile stehen jetzt fokussiert in der Login-Karte",
      "Login-Formular und Einloggen-Button sind kompakter und sauber ausgerichtet",
    ],
  },
  {
    version: "1.76.0",
    date: "2026-08-17",
    changes: [
      "Erfolgreiche Kundenportal-Logins werden mit Zeitstempel, Login-E-Mail und Gerätehinweis protokolliert",
      "Der Login-Verlauf ist nur intern in den Kundenstammdaten sichtbar",
      "Beim Speichern von Kundenstammdaten bleibt der Login-Verlauf erhalten",
    ],
  },
  {
    version: "1.75.0",
    date: "2026-08-17",
    changes: [
      "Kundenportal zeigt Serienaufträge kompakt als Hauptauftrag mit ausklappbaren Teilaufträgen",
      "Kunden können freigegebene Berichte öffnen und über die PDF-/Druckausgabe herunterladen",
      "Auftragsanlage im Kundenportal nutzt jetzt die vollständige Admin-Logik mit Leistungen, eigener Leistung, Checkliste und Serienauftrag",
      "Kunden können im Portal ihre E-Mail-Adresse und Telefonnummer selbst aktualisieren",
      "Portal-Kopf zeigt das Kolaretorp-Logo mit Willkommenszeile",
      "Anmeldemaske im Kundenportal zeigt jetzt das Logo korrekt, ohne doppelte Willkommenszeile und ohne Demo-Zugänge",
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
