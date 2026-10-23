import { apiFetch, getActiveTenantId } from "./apiClient";
import { excelReportLogo, reportBrandingSnapshot, stampReportLogo } from "./reportBranding";
import type { OperationsRow } from "./operationsCommands";

export async function loadOperationsReportRows(entity: "stock_movements" | "stock_inventories", parent: string, signal: AbortSignal) {
  const tenant = getActiveTenantId();
  const rows: OperationsRow[] = [];
  let count = Infinity;
  for (let page = 0; rows.length < count; page++) {
    const params = new URLSearchParams({ entity, page: String(page), ...(parent ? { parent } : {}) });
    const response = await apiFetch(`/api/operations?${params}`, { signal, cache: "no-store" });
    if (!response.ok || getActiveTenantId() !== tenant) throw new Error("REPORT_UNAVAILABLE");
    const result = await response.json();
    if (!Array.isArray(result.rows) || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("INVALID_REPORT_DATA");
    if (page && result.count !== count) throw new Error("REPORT_CHANGED");
    count = result.count;
    if (!result.rows.length && rows.length < count) throw new Error("INCOMPLETE_REPORT");
    rows.push(...result.rows);
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.length !== count) throw new Error("INCOMPLETE_REPORT");
  return rows;
}

export async function exportOperationsReport(title: string, subtitle: string, headers: string[], rows: (string | number)[][], format: "pdf" | "xlsx") {
  const branding = reportBrandingSnapshot();
  if (format === "xlsx") {
    const { default: writeExcelFile } = await import("write-excel-file/universal");
    const data: import("write-excel-file/universal").SheetData = [
      [{ value: title, type: String, fontWeight: "bold" }], [{ value: subtitle, type: String }],
      headers.map(value => ({ value, type: String, fontWeight: "bold" })),
      ...rows.map(row => row.map(value => typeof value === "number" ? { value, type: Number, format: "#,##0.###" } : { value, type: String, wrap: true })),
    ];
    return writeExcelFile(data, { images: await excelReportLogo(branding, headers.length - 1), columns: headers.map(() => ({ width: 28 })), stickyRowsCount: 3 }).toBlob();
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape" });
  const width = 272 / headers.length;
  let y = 28;
  const pageHeading = () => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text(title, 12, 18);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    y = 28;
  };
  pageHeading();
  for (const line of pdf.splitTextToSize(subtitle, 270) as string[]) {
    if (y > 181) { pdf.addPage(); pageHeading(); }
    pdf.text(line, 12, y); y += 4;
  }
  y += 6;
  const header = () => {
    const labels = headers.map(label => pdf.splitTextToSize(label, width - 4) as string[]);
    const height = Math.max(...labels.map(label => label.length)) * 4 + 5;
    if (y + height + 10 > 186) { pdf.addPage(); pageHeading(); }
    pdf.setFillColor(240, 242, 245); pdf.rect(12, y, 272, height, "F");
    labels.forEach((label, index) => pdf.text(label, 14 + index * width, y + 4));
    y += height + 6;
  };
  header();
  for (const row of rows) {
    const cells = row.map(value => pdf.splitTextToSize(String(value), width - 4) as string[]);
    const length = Math.max(1, ...cells.map(cell => cell.length));
    let offset = 0;
    while (offset < length) {
      if (y > 181) { pdf.addPage(); pageHeading(); header(); }
      const size = Math.min(length - offset, Math.max(1, Math.floor((186 - y) / 4)));
      cells.forEach((cell, index) => { const chunk = cell.slice(offset, offset + size); if (chunk.length) pdf.text(chunk, 14 + index * width, y); });
      offset += size; y += size * 4 + 4;
    }
    pdf.setDrawColor(220); pdf.line(12, y - 1, 284, y - 1); y += 3;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.text(`${page} / ${pages}`, 284, 201, { align: "right" }); }
  await stampReportLogo(pdf, branding);
  return new Blob([new Uint8Array(pdf.output("arraybuffer"))], { type: "application/pdf" });
}
