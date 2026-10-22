# Einheitliche Dokumentaktionen

`components/CommunicationActions.tsx` stellt Drucken, Download, E-Mail, SMS und
Teilen mit einheitlichen, beschrifteten Lucide-Symbolen und 44-Pixel-Tippzielen
bereit. Mehrere Downloadformate stehen unter dem Downloadsymbol zur Auswahl.

Die Leiste ist in Personal-/Zeitberichten, Einsatzberichten inklusive
Kundenportal und Objekthistorie, Auswertungsberichten, Angeboten,
Auftragsbestaetigungen, Rechnungsvorschauen, Fahrtenbuch, Lagerbestand,
Inventurplanung, Kommissionierlisten, Materialbewegungen, Einkaufslisten,
Leistungslisten und den Dokumentvorschauen fuer Lieferbelege und Schadensakten
eingebunden.

- Drucken verwendet die bestehende Berichtsvorschau oder das erzeugte Dokument,
  nicht die gesamte App. PDF-Vorschauen werden waehrend der Benutzeraktion
  geoeffnet, damit Safari sie nicht als asynchrones Popup blockiert.
- Downloads behalten bestehende PDF-/Excel-Generatoren und Filter bei.
- Bestehende Versandvorschauen werden ueber `onEmail` weiterverwendet.
  Andernfalls oeffnet E-Mail einen lokalen Entwurf mit dem Berichtstext.
- SMS und natives Teilen verwenden den ausgewaehlten Inhalt, keine privaten
  Speicherpfade oder Blob-URLs. Ein Mailentwurf behauptet keinen Dateianhang.
- Ohne natives Teilen kann der Berichtstext in die Zwischenablage kopiert
  werden. Fehler werden angezeigt; ein bewusst abgebrochener Teilen-Dialog
  wird nicht als Fehler behandelt.
- Gesperrte Aktionen bleiben waehrend einer Ausgabe deaktiviert. Blob-URLs
  werden nach Nutzung zeitversetzt freigegeben.

Ressourcenbilder verwenden denselben authentifizierten Medienabruf wie
Projektbilder. Das gilt fuer Galerie, Kachel und Liste, auch bei abgelaufener
Vorschau-URL oder ausschliesslich vorhandenem Speicherpfad.

Die Projekt-/Objektuebersicht gruppiert innerhalb jedes Statusbereichs nach
Typ. Projekte stehen vor Objekten; weitere konfigurierte Typen bleiben als
eigene Gruppen erhalten. Namen werden sprachabhaengig und numerisch sortiert.
Die gespeicherten Datensaetze werden durch die Sortierung nicht veraendert.
