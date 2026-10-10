export function storageLocationPath(id: string, locations: readonly { id: string; name: string; parentLocationId?: string }[]): string {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(id);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parentLocationId ? byId.get(current.parentLocationId) : undefined;
  }
  return parts.join(" / ");
}

export async function locationLabelPdf(location: { name: string; code: string; parent?: string; storagePlace?: boolean }, language: "de" | "sv" | "en") {
  if (!location.code.trim() || location.code.length > 128) throw new Error("LOCATION_CODE_REQUIRED");
  return codeLabelPdf({ ...location, heading: location.storagePlace ? language === "de" ? "Lagerplatz" : language === "sv" ? "Lagerplats" : "Storage bin" : language === "de" ? "Lagerort" : language === "sv" ? "Lager" : "Storage location", footer: location.parent });
}

export async function materialLabelPdf(material: { name: string; code: string; sku?: string }, language: "de" | "sv" | "en") {
  if (!material.code.trim() || material.code.length > 128) throw new Error("MATERIAL_CODE_REQUIRED");
  return codeLabelPdf({ ...material, heading: "Material", footer: material.sku ? `${language === "de" ? "Materialnummer" : language === "sv" ? "Artikelnummer" : "Item number"}: ${material.sku}` : undefined });
}

export async function entityCodeLabelPdf(entity: { name: string; code: string; kind: "job" | "object" }, language: "de" | "sv" | "en") {
  if (!entity.code.trim() || entity.code.length > 128) throw new Error("CODE_REQUIRED");
  return codeLabelPdf({ ...entity, heading: entity.kind === "job" ? language === "de" ? "Auftrag" : language === "sv" ? "Uppdrag" : "Job" : language === "de" ? "Objekt" : language === "sv" ? "Objekt" : "Object" });
}

export async function codeLabelPdf(label: { heading: string; name: string; code: string; footer?: string }) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import("jspdf"), import("qrcode")]);
  const pdf = new jsPDF({ orientation: "landscape", format: [100, 60] });
  const response = await fetch("/kolaretorp-logo.png");
  if (!response.ok) throw new Error("LOGO_UNAVAILABLE");
  const logo = new Uint8Array(await response.arrayBuffer()), size = pdf.getImageProperties(logo);
  pdf.addImage(logo, "PNG", 53, 5, 42, 42 * size.height / size.width);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
  pdf.text(label.heading, 5, 10);
  pdf.setDrawColor(210); pdf.line(5, 15, 95, 15);
  const qr = await QRCode.toDataURL(label.code, { errorCorrectionLevel: "M", margin: 4, width: 600 });
  pdf.addImage(qr, "PNG", 4, 19, 35, 35);
  pdf.setFontSize(13);
  const lines = pdf.splitTextToSize(label.name, 53) as string[];
  if (lines.length > 4) throw new Error("LOCATION_LABEL_NAME_TOO_LONG");
  pdf.text(lines, 42, 25);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  const codeLines = pdf.splitTextToSize(label.code, 53) as string[];
  if (codeLines.length > 3) throw new Error("LOCATION_LABEL_CODE_TOO_LONG");
  pdf.text(codeLines, 42, 44);
  if (label.footer) {
    const parentLines = pdf.splitTextToSize(label.footer, 90) as string[];
    if (parentLines.length > 1) throw new Error("LOCATION_LABEL_PARENT_TOO_LONG");
    pdf.text(parentLines, 5, 57);
  }
  return new Blob([new Uint8Array(pdf.output("arraybuffer"))], { type: "application/pdf" });
}
