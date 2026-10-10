export type StockMaterial = { id: string; name: string; sku?: string; unit?: string; archived?: boolean };
export type StockBalance = { material_id: string; location_id: string; quantity: number };
export type StockOverviewRow = { id: string; material_id: string; location_id: string; sku: string; designation: string; location: string; unit: string; quantity: number; archived: boolean };

export function stockOverviewRows(materials: StockMaterial[], locations: { id: string; name: string }[], balances: StockBalance[], language: string): StockOverviewRow[] {
  const rows = materials.flatMap((material) => {
    const entries = balances.filter((balance) => balance.material_id === material.id);
    return (entries.length ? entries : [{ material_id: material.id, location_id: "", quantity: 0 }]).map((entry) => ({
      id: JSON.stringify([material.id, entry.location_id]), material_id: material.id, location_id: entry.location_id,
      sku: material.sku ?? "", designation: material.name, location: locations.find((location) => location.id === entry.location_id)?.name ?? "-",
      unit: material.unit ?? "", quantity: Number(entry.quantity), archived: Boolean(material.archived),
    }));
  });
  const collator = new Intl.Collator(language, { numeric: true, sensitivity: "base" });
  return rows.sort((a, b) => collator.compare(a.designation, b.designation) || collator.compare(a.location, b.location));
}

export async function exportStockOverview(rows: StockOverviewRow[], headers: string[], title: string, capturedAt: string, format: "xlsx" | "pdf", statusLabels: [string, string]) {
  const values = rows.map((row) => [row.sku, row.designation, row.location, row.quantity, row.unit, statusLabels[row.archived ? 1 : 0]]);
  if (format === "xlsx") {
    const { default: writeExcelFile } = await import("write-excel-file/universal");
    const data: import("write-excel-file/universal").SheetData = [
      [{ value: title, fontWeight: "bold" }], [capturedAt],
      headers.map((value) => ({ value, fontWeight: "bold" })),
      ...values.map((row) => row.map((value) => typeof value === "number" ? { value, type: Number, format: "#,##0.000" } : { value, type: String, wrap: true })),
    ];
    return writeExcelFile(data, { columns: [20, 45, 30, 18, 15, 18].map((width) => ({ width })), stickyRowsCount: 3 }).toBlob();
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape" });
  const logoResponse = await fetch("/kolaretorp-logo.png");
  if (!logoResponse.ok) throw new Error("LOGO_UNAVAILABLE");
  const logo = new Uint8Array(await logoResponse.arrayBuffer());
  const logoSize = pdf.getImageProperties(logo);
  const logoWidth = 65;
  const logoHeight = logoWidth * logoSize.height / logoSize.width;
  const widths = [32, 82, 57, 35, 30, 36];
  let y = 0;
  const header = () => {
    pdf.addImage(logo, "PNG", 284 - logoWidth, 13, logoWidth, logoHeight, "company-logo");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(title, 12, 18);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(capturedAt, 12, 26);
    pdf.setFillColor(240, 242, 245); pdf.rect(12, 32, 272, 10, "F");
    let x = 14; headers.forEach((label, index) => { pdf.text(label, x, 39); x += widths[index]; }); y = 49;
  };
  header();
  for (const row of values) {
    const cells = row.map((value, index) => pdf.splitTextToSize(String(value), widths[index] - 5) as string[]);
    let offset = 0;
    const lineCount = Math.max(...cells.map((cell) => cell.length));
    do {
      if (y > 181) { pdf.addPage(); header(); }
      const length = Math.min(lineCount - offset, Math.max(1, Math.floor((186 - y) / 4.5)));
      let x = 14;
      cells.forEach((cell, index) => { const chunk = cell.slice(offset, offset + length); if (chunk.length) pdf.text(chunk, x, y); x += widths[index]; });
      y += length * 4.5 + 5; offset += length;
    } while (offset < lineCount);
    pdf.setDrawColor(220); pdf.line(12, y - 2, 284, y - 2);
    y += 3;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.text(`${page} / ${pages}`, 284, 201, { align: "right" }); }
  return new Blob([new Uint8Array(pdf.output("arraybuffer"))], { type: "application/pdf" });
}
