export type PickingItem = { material_id: string; quantity: number; picked: number; material: { name: string; sku?: string; scan_code?: string | null; unit?: string; record_data?: { scanCode?: string } } };
export type PickingOrder = { id: string; picking_code?: string; job_id: string; title: string; revision: number; status: "open" | "completed" | "loaded" | "dispatched" | "cancelled"; created_at: string; staging_id?: string | null; destination_id?: string | null; dispatched_at?: string | null; pickup_code?: string | null };

export function pickupLabel(order: PickingOrder) {
  return order.picking_code ? `AB-${order.picking_code}` : `PICKUP:${order.pickup_code ?? ""}`;
}

export function normalizePickupScan(value: string) {
  return value.trim().replace(/^\][A-Za-z][0-9]/, "").trim().replace(/^PICKUP:/i, "").toUpperCase();
}

export function normalizeTargetScan(value: string) {
  return value.trim().replace(/^\][A-Za-z][0-9]/, "").trim().normalize("NFC").toUpperCase();
}

export function matchesPickupScan(value: string, order: PickingOrder) {
  const code = normalizePickupScan(value);
  return Boolean(order.pickup_code) && (code === order.pickup_code!.toUpperCase() || code === normalizePickupScan(pickupLabel(order)));
}

export async function pickingPdf(order: PickingOrder, items: PickingItem[], language: "de" | "sv" | "en") {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([import("jspdf"), import("qrcode")]);
  const pdf = new jsPDF();
  const response = await fetch("/kolaretorp-logo.png");
  if (!response.ok) throw new Error("LOGO_UNAVAILABLE");
  const logo = new Uint8Array(await response.arrayBuffer()), size = pdf.getImageProperties(logo);
  const qr = await QRCode.toDataURL(`PICK:${order.picking_code ?? order.id}`, { width: 500, margin: 4 });
  const labels = language === "de" ? ["Kommissionierliste", "Auftrag", "Bezeichnung", "Benötigt", "Entnommen", "Datum / Unterschrift"] : language === "sv" ? ["Plocklista", "Uppdrag", "Benämning", "Behov", "Plockat", "Datum / Signatur"] : ["Picking list", "Job", "Designation", "Required", "Picked", "Date / Signature"];
  let y = 0;
  function header() {
    pdf.addImage(logo, "PNG", 150, 12, 45, 45 * size.height / size.width);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(labels[0], 15, 22);
    const codeLabel = language === "de" ? "Kommissioniercode" : language === "sv" ? "Plockkod" : "Picking code";
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.text(`${codeLabel}: ${order.picking_code ?? "-"}`, 15, 34);
    const title = pdf.splitTextToSize(`${labels[1]}: ${order.title}`, 135) as string[];
    pdf.text(title, 15, 43); y = Math.max(75, 45 + title.length * 4);
    pdf.addImage(qr, "PNG", 163, 36, 30, 30);
    pdf.setFillColor(242, 243, 246); pdf.rect(15, y, 180, 10, "F");
    pdf.setFont("helvetica", "bold"); pdf.text(labels[2], 18, y + 6); pdf.text(labels[3], 138, y + 6); pdf.text(labels[4], 165, y + 6); y += 17;
  }
  header();
  for (const item of [...items].sort((a, b) => a.material.name.localeCompare(b.material.name, language))) {
    const name = pdf.splitTextToSize([item.material.sku, item.material.name].filter(Boolean).join(" · "), 112) as string[];
    if (item.material.scan_code) name.push(...pdf.splitTextToSize(`EAN / Scan: ${item.material.scan_code}`, 112) as string[]);
    const height = Math.max(16, name.length * 4 + 7);
    if (y + height > 268) { pdf.addPage(); header(); }
    pdf.setFont("helvetica", "normal"); pdf.text(name, 18, y);
    pdf.text(`${Number(item.quantity).toLocaleString(language)} ${item.material.unit ?? ""}`, 138, y);
    pdf.text(String(Number(item.picked).toLocaleString(language)), 171, y);
    pdf.line(167, y + 5, 192, y + 5); y += height; pdf.setDrawColor(220); pdf.line(15, y - 5, 195, y - 5);
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.text(labels[5], 15, 285); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 195, 285, { align: "right" });
  }
  return new Blob([new Uint8Array(pdf.output("arraybuffer"))], { type: "application/pdf" });
}
