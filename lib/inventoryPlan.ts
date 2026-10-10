export type InventoryPlanItem = { material_id: string; location_id: string; expected: number; counted: number | null };
export type InventoryPlan = { id: string; revision: number; note: string; created_at?: string; completed_at?: string | null; items: InventoryPlanItem[] };
export type InventoryLocation = { id: string; name: string; archived?: boolean; location_code?: string; parent_location_id?: string | null };

export function inventoryLocationPath(id: string, locations: InventoryLocation[]): string {
  const seen = new Set<string>(), names: string[] = [];
  let current = locations.find((location) => location.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id); names.unshift([current.location_code, current.name].filter(Boolean).join(" · "));
    current = locations.find((location) => location.id === current?.parent_location_id);
  }
  return names.join(" / ") || id;
}

export function orderInventoryItems(items: InventoryPlanItem[], locations: InventoryLocation[], materials: { id: string; name: string }[], language: string) {
  const collator = new Intl.Collator(language, { numeric: true, sensitivity: "base" });
  return [...items].sort((a, b) => collator.compare(inventoryLocationPath(a.location_id, locations), inventoryLocationPath(b.location_id, locations))
    || collator.compare(materials.find((material) => material.id === a.material_id)?.name ?? a.material_id, materials.find((material) => material.id === b.material_id)?.name ?? b.material_id));
}

export async function inventoryPlanPdf(plan: InventoryPlan, locations: InventoryLocation[], materials: { id: string; name: string; sku?: string; unit?: string }[], language: "de" | "sv" | "en") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const text = language === "de" ? ["Inventur-Zählliste", "Inventur-ID", "Lagerort / Lagerplatz", "Materialnummer / Bezeichnung", "Einheit", "Gezählt", "Datum / Unterschrift"] : language === "sv" ? ["Inventeringslista", "Inventerings-ID", "Lager / Lagerplats", "Materialnummer / Benämning", "Enhet", "Räknat", "Datum / Signatur"] : ["Stocktake count sheet", "Stocktake ID", "Location / Bin", "Material number / Designation", "Unit", "Counted", "Date / Signature"];
  const response = await fetch("/kolaretorp-logo.png");
  if (!response.ok) throw new Error("LOGO_UNAVAILABLE");
  const logo = new Uint8Array(await response.arrayBuffer()), size = pdf.getImageProperties(logo);
  let y = 0;
  function header() {
    pdf.addImage(logo, "PNG", 150, 12, 45, 45 * size.height / size.width);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(text[0], 15, 20);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`${text[1]}: ${plan.id}`, 15, 35);
    const note = pdf.splitTextToSize(plan.note, 180) as string[];
    pdf.text(note, 15, 42); y = 48 + note.length * 4;
    pdf.setFillColor(240, 242, 245); pdf.rect(15, y, 180, 10, "F");
    pdf.text(text[3], 18, y + 6); pdf.text(text[4], 145, y + 6); pdf.text(text[5], 174, y + 6); y += 16;
  }
  header();
  let previousLocation = "";
  for (const item of orderInventoryItems(plan.items, locations, materials, language)) {
    const material = materials.find((entry) => entry.id === item.material_id);
    const lines = pdf.splitTextToSize(`${material?.sku ?? ""} ${material?.name ?? item.material_id}`.trim(), 120) as string[];
    if (y + lines.length * 4.5 + 22 > 266) { pdf.addPage(); header(); previousLocation = ""; }
    if (previousLocation !== item.location_id) {
      const path = pdf.splitTextToSize(inventoryLocationPath(item.location_id, locations), 174) as string[];
      pdf.setFont("helvetica", "bold"); pdf.text(path, 18, y); y += path.length * 4 + 5; pdf.setFont("helvetica", "normal"); previousLocation = item.location_id;
    }
    pdf.text(lines, 18, y); pdf.text(material?.unit ?? "", 145, y);
    if (item.counted !== null) pdf.text(item.counted.toLocaleString(language), 175, y);
    pdf.setDrawColor(170); pdf.line(171, y + 3, 192, y + 3);
    y += Math.max(12, lines.length * 4.5 + 5); pdf.setDrawColor(225); pdf.line(15, y - 3, 195, y - 3);
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.text(text[6], 15, 285); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 195, 285, { align: "right" });
  }
  return new Blob([new Uint8Array(pdf.output("arraybuffer"))], { type: "application/pdf" });
}
