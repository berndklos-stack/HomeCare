export type ServiceListEntry = {
  id: string; date: string; startTime: string; endTime: string;
  minutes: number; description: string; billingStatus: "offen" | "abgerechnet";
};
export type ServiceListFilter = { from: string; through: string; search: string; status: string; descending: boolean };
export const serviceListLabels = {
  de: { title: "Leistungsliste", attachment: "Rechnungsanlage - Leistungsnachweis", from: "Von", through: "Bis", search: "Leistungen suchen", status: "Status", all: "Alle", open: "offen", billed: "abgerechnet", sort: "Sortierung", oldest: "Datum aufsteigend", newest: "Datum absteigend", selectAll: "Alle auswählen", selected: "ausgewählt", date: "Datum", time: "Uhrzeit", description: "Leistung", hours: "Stunden", rate: "Stundensatz", amount: "Betrag netto", total: "Gesamt", close: "Leistungsliste schließen", empty: "Keine passenden Leistungen.", error: "Export fehlgeschlagen. Bitte erneut versuchen.", page: "Seite" },
  sv: { title: "Arbetslista", attachment: "Fakturabilaga - Arbetsredovisning", from: "Från", through: "Till", search: "Sök arbetsinsatser", status: "Status", all: "Alla", open: "öppen", billed: "fakturerad", sort: "Sortering", oldest: "Datum stigande", newest: "Datum fallande", selectAll: "Välj alla", selected: "valda", date: "Datum", time: "Tid", description: "Arbete", hours: "Timmar", rate: "Timpris", amount: "Belopp exkl. moms", total: "Totalt", close: "Stäng arbetslista", empty: "Inga matchande arbetsinsatser.", error: "Exporten misslyckades. Försök igen.", page: "Sida" },
  en: { title: "Service list", attachment: "Invoice attachment - Work log", from: "From", through: "To", search: "Search services", status: "Status", all: "All", open: "open", billed: "billed", sort: "Sort order", oldest: "Date ascending", newest: "Date descending", selectAll: "Select all", selected: "selected", date: "Date", time: "Time", description: "Service", hours: "Hours", rate: "Hourly rate", amount: "Net amount", total: "Total", close: "Close service list", empty: "No matching services.", error: "Export failed. Please try again.", page: "Page" },
};
export type ServiceListExport = { title: string; company: string; currency: string; rate: number; language: keyof typeof serviceListLabels; entries: ServiceListEntry[] };

export function filterServiceList(entries: ServiceListEntry[], filter: ServiceListFilter) {
  const search = filter.search.trim().toLocaleLowerCase();
  return entries.filter((entry) => (!filter.from || entry.date >= filter.from)
    && (!filter.through || entry.date <= filter.through)
    && (filter.status === "all" || entry.billingStatus === filter.status)
    && (!search || entry.description.toLocaleLowerCase().includes(search)))
    .sort((a, b) => (filter.descending ? -1 : 1) * (`${a.date} ${a.startTime} ${a.id}`.localeCompare(`${b.date} ${b.startTime} ${b.id}`)));
}

export function serviceListTotals(entries: ServiceListEntry[], rate: number) {
  return { minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    cents: entries.reduce((sum, entry) => sum + Math.round(entry.minutes / 60 * rate * 100), 0) };
}

export async function exportServiceListExcel(input: ServiceListExport) {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const labels = serviceListLabels[input.language];
  const rows: import("write-excel-file/universal").SheetData = [
    ...[input.company, labels.attachment, input.title].map((text) => [{ value: text, columnSpan: 7, fontWeight: "bold" as const, height: 24 }, null, null, null, null, null, null]),
    [],
    [labels.date, labels.time, labels.description, labels.hours, labels.rate, `${labels.amount} (${input.currency})`, labels.status].map((value) => ({ value, fontWeight: "bold", textColor: "#ffffff", backgroundColor: "#1668b8", height: 28 })),
    ...input.entries.map((entry) => [entry.date, `${entry.startTime} - ${entry.endTime}`,
      { value: entry.description, type: String, wrap: true, height: Math.max(30, Math.ceil(entry.description.length / 75) * 15) },
      ...[entry.minutes / 60, input.rate, Math.round(entry.minutes / 60 * input.rate * 100) / 100].map((value) => ({ value, type: Number, format: "#,##0.00" })),
      entry.billingStatus === "offen" ? labels.open : labels.billed]),
  ];
  const totals = serviceListTotals(input.entries, input.rate);
  rows.push([{ value: labels.total, fontWeight: "bold" }, null, null, { value: totals.minutes / 60, format: "#,##0.00", fontWeight: "bold" }, null, { value: totals.cents / 100, format: "#,##0.00", fontWeight: "bold" }]);
  const blob = await writeExcelFile(rows, { sheet: labels.title, stickyRowsCount: 5, orientation: "landscape", columns: [14, 19, 80, 14, 16, 21, 17].map((width) => ({ width })) }).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportServiceListPdf(input: ServiceListExport) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape" });
  const labels = serviceListLabels[input.language];
  const locale = input.language === "sv" ? "sv-SE" : input.language === "en" ? "en-GB" : "de-DE";
  const number = (value: number) => value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let y = 0;
  const header = () => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text(input.company, 12, 14);
    pdf.setFontSize(16); pdf.text(labels.attachment, 12, 24);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    const title = pdf.splitTextToSize(input.title, 270);
    pdf.text(title, 12, 33); y = 39 + (title.length - 1) * 5;
    pdf.setFillColor(237, 242, 248); pdf.rect(12, y - 4, 273, 9, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    [[labels.date, 14], [labels.time, 36], [labels.description, 65], [labels.hours, 207], [`${labels.amount} ${input.currency}`, 230], [labels.status, 269]].forEach(([text, x]) => pdf.text(String(text), Number(x), y));
    pdf.setFont("helvetica", "normal"); y += 10;
  };
  header();
  for (const entry of input.entries) {
    const lines = pdf.splitTextToSize(entry.description || "-", 133) as string[];
    let offset = 0;
    do {
      if (y > 177) { pdf.addPage(); header(); }
      const count = Math.max(1, Math.floor((183 - y) / 4.5));
      const chunk = lines.slice(offset, offset + count);
      if (offset === 0) {
        pdf.text(entry.date, 14, y); pdf.text(`${entry.startTime}-${entry.endTime}`, 36, y);
        pdf.text(number(entry.minutes / 60), 221, y, { align: "right" });
        pdf.text(number(Math.round(entry.minutes / 60 * input.rate * 100) / 100), 262, y, { align: "right" });
        pdf.text(entry.billingStatus === "offen" ? labels.open : labels.billed, 269, y);
      }
      pdf.text(chunk, 65, y); y += Math.max(1, chunk.length) * 4.5 + 4;
      offset += chunk.length;
    } while (offset < lines.length);
    pdf.setDrawColor(220); pdf.line(12, y - 2, 285, y - 2); y += 4;
  }
  if (y > 174) { pdf.addPage(); header(); }
  const totals = serviceListTotals(input.entries, input.rate);
  pdf.setFont("helvetica", "bold"); pdf.text(`${labels.total}: ${number(totals.minutes / 60)} h | ${number(totals.cents / 100)} ${input.currency}`, 14, y + 5);
  pdf.setFont("helvetica", "normal"); pdf.text(`${labels.rate}: ${number(input.rate)} ${input.currency}/h`, 14, y + 12);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(9); pdf.text(`${labels.page} ${page}/${pages}`, 285, 201, { align: "right" }); }
  return new Uint8Array(pdf.output("arraybuffer"));
}
