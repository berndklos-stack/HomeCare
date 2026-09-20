import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "public/regulations";
mkdirSync(outDir, { recursive: true });

function escapePdf(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrap(text, width = 92) {
  const words = String(text).split(/\s+/).flatMap((word) => {
    if (word.length <= width) return [word];
    const parts = [];
    for (let index = 0; index < word.length; index += width) parts.push(word.slice(index, index + width));
    return parts;
  });
  const lines = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createPdf(fileName, title, metaRows, bullets, note) {
  const rows = [
    ["title", title],
    ["small", "HomeCare Dokumentation zum Fahrtenbuch-Regelwerk. Diese Zusammenfassung ersetzt nicht die offiziellen steuerlichen Vorgaben."],
    ["space", ""],
    ...metaRows.map(([key, value]) => ["body", `${key}: ${value}`]),
    ["space", ""],
    ["head", "Wichtigste Punkte"],
    ...bullets.flatMap((bullet) => wrap(bullet, 86).map((line) => ["body", `- ${line}`])),
    ["space", ""],
    ["head", "Technischer Hinweis"],
    ...wrap(note, 92).map((line) => ["body", line]),
  ];

  const streamLines = ["BT", "/F1 10 Tf", "50 792 Td"];
  let first = true;
  for (const [kind, text] of rows) {
    if (!first) streamLines.push("0 -16 Td");
    first = false;
    if (kind === "space") {
      streamLines.push("0 -8 Td");
      continue;
    }
    if (kind === "title") streamLines.push("/F2 18 Tf");
    else if (kind === "head") streamLines.push("/F2 12 Tf");
    else if (kind === "small") streamLines.push("/F1 8 Tf");
    else streamLines.push("/F1 10 Tf");
    const lineWidth = kind === "title" ? 60 : 96;
    wrap(text, lineWidth).forEach((line, index) => {
      if (index > 0) streamLines.push("0 -13 Td");
      streamLines.push(`(${escapePdf(line)}) Tj`);
    });
  }
  streamLines.push("ET");

  const stream = Buffer.from(streamLines.join("\n"), "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream.toString("latin1")}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "latin1"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xref = Buffer.byteLength(chunks.join(""), "latin1");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  writeFileSync(join(outDir, fileName), chunks.join(""), "latin1");
}

createPdf(
  "DE-Fahrtenbuch-2026.pdf",
  "Vorgaben Fahrtenbuch - Deutschland",
  [
    ["Steuerland", "Deutschland"],
    ["Regelwerk", "DE-Fahrtenbuch-2026"],
    ["Gueltig ab", "01.01.2026"],
    ["Gueltig bis", "-"],
    ["Quelle / Behoerde", "Bundesministerium der Finanzen / Finanzverwaltung"],
    ["Quellen-URL", "https://amtliche-handbuecher.bundesfinanzministerium.de/lsth/2025/A-Einkommensteuergesetz/II-Einkommen-2-24b/4-Ueberschuss-d-Einnahmen-ueber-die-Werbungsk-8-9a/Paragraf-8/h-8-1-9-10.html"],
    ["Letzte Pruefung", "20.09.2026"],
  ],
  [
    "Fahrtenbuch zeitnah und nachvollziehbar fuehren.",
    "Datum, Start- und Endkilometerstand, Start- und Zieladresse dokumentieren.",
    "Betriebliche Fahrten mit Zweck, Kunde oder Geschaeftspartner und Ansprechpartner erfassen.",
    "Private Fahrten und Fahrten zwischen Wohnung und Arbeitsstaette getrennt kennzeichnen.",
    "Nachtraegliche Aenderungen muessen nachvollziehbar protokolliert werden.",
  ],
  "Die App speichert das bei Erstellung gueltige Regelwerk an jeder Fahrt. Spaetere Regelwerksaenderungen sollen alte Fahrten nicht rueckwirkend veraendern.",
);

createPdf(
  "SE-Korjournal-2026.pdf",
  "Vorgaben Koerjournal - Schweden",
  [
    ["Steuerland", "Schweden"],
    ["Regelwerk", "SE-Korjournal-2026"],
    ["Gueltig ab", "01.01.2026"],
    ["Gueltig bis", "-"],
    ["Quelle / Behoerde", "Skatteverket"],
    ["Quellen-URL", "https://www.skatteverket.se/privat/skatter/arbeteochinkomst/formaner/bilforman/korjournal.4.18e1b10334ebe8bc8000695.html"],
    ["Letzte Pruefung", "20.09.2026"],
  ],
  [
    "Koerjournal sollte alle privaten Fahrten und Dienstfahrten nachvollziehbar trennen.",
    "Maetarstaellning zu Jahresbeginn und Jahresende sowie pro Fahrt Start und Ende erfassen.",
    "Registrierungsnummer, Datum, Kilometer, Start- und Zieladresse dokumentieren.",
    "Bei Dienstreisen Zweck, besuchte Firmen, Orte oder Kontaktpersonen erfassen.",
    "Arbeitsfahrten zwischen Wohnung und Arbeitsplatz gelten grundsaetzlich als private Fahrten.",
  ],
  "Die App speichert das bei Erstellung gueltige Regelwerk an jeder Fahrt. Spaetere Regelwerksaenderungen sollen alte Fahrten nicht rueckwirkend veraendern.",
);
