"use client";

import { useState } from "react";
import { FileDown, Sheet, X } from "lucide-react";
import { TripDialog } from "./TripDialog";
import { exportServiceListExcel, exportServiceListPdf, filterServiceList, serviceListLabels, serviceListTotals, type ServiceListEntry, type ServiceListExport } from "@/lib/consultingServiceList";

export function ConsultingServiceList({ entries, title, company, currency, rate, language, onClose }: ServiceListExport & { onClose: () => void }) {
  const labels = serviceListLabels[language];
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [descending, setDescending] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const visible = filterServiceList(entries, { from, through, search, status, descending });
  const selected = visible.filter((entry) => !excluded.includes(entry.id));
  const totals = serviceListTotals(selected, rate);
  const locale = language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE";
  const number = (value: number) => value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function download(format: "pdf" | "xlsx") {
    if (!selected.length || exporting) return;
    setExporting(true); setError("");
    try {
      const input = { entries: selected, title, company, currency, rate, language };
      const bytes = format === "pdf" ? await exportServiceListPdf(input) : await exportServiceListExcel(input);
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${labels.title}-${title.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 90)}.${format}`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch { setError(labels.error); }
    finally { setExporting(false); }
  }

  const toggle = (entry: ServiceListEntry) => setExcluded((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id]);
  return <TripDialog className="service-list-dialog" labelledBy="service-list-title" onClose={onClose}>
    <header className="service-list-heading">
      <div><h2 id="service-list-title">{labels.title}</h2><p>{title}</p></div>
      <button className="icon-button" aria-label={labels.close} onClick={onClose} type="button"><X size={20} /></button>
    </header>
    <div className="service-list-filters">
      <label>{labels.from}<input aria-label={labels.from} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>{labels.through}<input aria-label={labels.through} type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
      <label>{labels.search}<input aria-label={labels.search} type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>{labels.status}<select aria-label={labels.status} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{labels.all}</option><option value="offen">{labels.open}</option><option value="abgerechnet">{labels.billed}</option></select></label>
      <label>{labels.sort}<select aria-label={labels.sort} value={String(descending)} onChange={(event) => setDescending(event.target.value === "true")}><option value="false">{labels.oldest}</option><option value="true">{labels.newest}</option></select></label>
    </div>
    <div className="service-list-selection">
      <label><input type="checkbox" checked={visible.length > 0 && selected.length === visible.length} disabled={!visible.length} onChange={(event) => setExcluded((current) => event.target.checked ? current.filter((id) => !visible.some((entry) => entry.id === id)) : [...new Set([...current, ...visible.map((entry) => entry.id)])])} />{labels.selectAll}</label>
      <span>{selected.length}/{visible.length} {labels.selected}</span>
    </div>
    <div className="service-list-table-wrap">
      <table className="service-list-table"><thead><tr><th></th><th>{labels.date}</th><th>{labels.time}</th><th>{labels.description}</th><th>{labels.hours}</th><th>{labels.amount} ({currency})</th><th>{labels.status}</th></tr></thead>
        <tbody>{visible.map((entry) => <tr key={entry.id} data-testid="service-list-row"><td><input type="checkbox" aria-label={`${entry.date} ${entry.startTime} ${entry.description}`} checked={!excluded.includes(entry.id)} onChange={() => toggle(entry)} /></td><td>{entry.date}</td><td>{entry.startTime}–{entry.endTime}</td><td>{entry.description}</td><td>{number(entry.minutes / 60)}</td><td>{number(Math.round(entry.minutes / 60 * rate * 100) / 100)}</td><td>{entry.billingStatus === "offen" ? labels.open : labels.billed}</td></tr>)}</tbody>
      </table>
      {!visible.length && <p>{labels.empty}</p>}
    </div>
    <footer className="service-list-footer">
      <strong>{labels.total}: {number(totals.minutes / 60)} h · {number(totals.cents / 100)} {currency}</strong>
      <div className="row-actions"><button className="ghost-button" type="button" disabled={!selected.length || exporting} onClick={() => void download("xlsx")}><Sheet size={17} />Excel</button><button className="primary-button" type="button" disabled={!selected.length || exporting} onClick={() => void download("pdf")}><FileDown size={17} />PDF</button></div>
    </footer>
    {error && <p role="alert">{error}</p>}
  </TripDialog>;
}
