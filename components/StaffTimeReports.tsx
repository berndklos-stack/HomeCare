"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Mail, MessageSquare, Printer, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { buildStaffReport, staffReportText, type StaffReportLanguage, type StaffReportScope } from "@/lib/staffTimeReports";
import type { StaffTimeData } from "@/lib/staffTime";
import styles from "./StaffTimeWorkspace.module.css";

export function StaffTimeReports({ data, month, language }: { data: StaffTimeData; month: string; language: StaffReportLanguage }) {
  const [scope, setScope] = useState<StaffReportScope>("month");
  const [selectedDay, setSelectedDay] = useState(`${month}-01`);
  const day = selectedDay.startsWith(month) ? selectedDay : `${month}-01`;
  const [company, setCompany] = useState<{ month: string; snapshot: StaffTimeData; data: StaffTimeData } | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const t = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  useEffect(() => {
    if (scope !== "company" || !data.canManage) return;
    const controller = new AbortController();
    void apiFetch(`/api/staff-time?scope=company&month=${month}`, { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) { setError(""); setCompany({ month, snapshot: data, data: result }); }
    }).catch(cause => { if (!controller.signal.aborted) setError(String(cause.message)); });
    return () => controller.abort();
  }, [scope, month, data]);
  const source = scope === "company" ? company?.month === month && company.snapshot === data ? company.data : null : data;
  const report = source ? buildStaffReport(source, month, scope, day, language) : null;
  async function excel() {
    if (!report || exporting) return;
    setExporting(true); setError("");
    try {
      const { default: writeExcelFile } = await import("write-excel-file/universal");
      const rows: import("write-excel-file/universal").SheetData = [
        [staffReportText(language, "employee"), staffReportText(language, "from"), staffReportText(language, "to"), staffReportText(language, "kind"), staffReportText(language, "duration"), staffReportText(language, "note")].map(value => ({ value, type: String, fontWeight: "bold" })),
        ...report.rows.flatMap(row => row.entries.map(entry => [
          { value: row.employee.name, type: String }, { value: entry.started_at, type: String }, { value: entry.ended_at ?? "", type: String },
          { value: staffReportText(language, entry.kind), type: String }, { value: entry.minutes === null ? "" : entry.minutes / 60, type: entry.minutes === null ? String : Number, format: "0.00" }, { value: [entry.reason, entry.note].filter(Boolean).join(" · "), type: String },
        ])),
      ];
      const headings = (values: string[]) => values.map(value => ({ value, type: String, fontWeight: "bold" as const }));
      const summaries: import("write-excel-file/universal").SheetData = [headings([staffReportText(language, "employee"), staffReportText(language, "work"), staffReportText(language, "pause"), staffReportText(language, "interruption"), staffReportText(language, "remaining")]),
        ...report.rows.map(row => [{ value: row.employee.name, type: String }, ...[row.work / 60, row.pause / 60, row.interruption / 60].map(value => ({ value, type: Number, format: "0.00" })), { value: row.summary.remaining ?? "", type: row.summary.remaining === null ? String : Number }])];
      const leaves: import("write-excel-file/universal").SheetData = [headings([staffReportText(language, "employee"), staffReportText(language, "from"), staffReportText(language, "to"), staffReportText(language, "days"), staffReportText(language, "status"), staffReportText(language, "note")]),
        ...report.rows.flatMap(row => row.leaves.map(leave => [{ value: row.employee.name, type: String }, { value: leave.from_date, type: String }, { value: leave.to_date, type: String }, { value: Number(leave.days), type: Number }, { value: staffReportText(language, leave.status), type: String }, { value: [leave.note, leave.decision_reason].filter(Boolean).join(" · "), type: String }]))];
      const blob = await writeExcelFile([
        { sheet: t("Übersicht", "Översikt", "Summary"), data: summaries, stickyRowsCount: 1, columns: [28, 24, 24, 24, 28].map(width => ({ width })) },
        { sheet: t("Zeiten", "Tider", "Times"), data: rows, stickyRowsCount: 1, columns: [28, 26, 26, 24, 15, 50].map(width => ({ width })) },
        { sheet: staffReportText(language, "leave"), data: leaves, stickyRowsCount: 1, columns: [28, 20, 20, 15, 20, 50].map(width => ({ width })) },
      ]).toBlob();
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `staff-report-${scope}-${scope === "day" ? day : month}.xlsx`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(t("Export fehlgeschlagen.", "Export misslyckades.", "Export failed.")); } finally { setExporting(false); }
  }
  return <section className={styles.band} aria-label={t("Berichte", "Rapporter", "Reports")}>
    <div className={styles.filters}><label>{t("Bericht", "Rapport", "Report")}<select aria-label={t("Bericht", "Rapport", "Report")} value={scope} onChange={event => { setError(""); setCompany(null); setScope(event.target.value as StaffReportScope); }}>{(["day", "month", ...(data.canManage ? ["company"] : [])] as StaffReportScope[]).map(key => <option key={key} value={key}>{staffReportText(language, key)}</option>)}</select><ChevronDown className={styles.selectChevron} size={16}/></label>
      {scope === "day" && <label>{staffReportText(language, "date")}<input type="date" min={`${month}-01`} max={`${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`} value={day} onChange={event => { if (event.target.value.startsWith(month)) setSelectedDay(event.target.value); }}/></label>}
    </div>
    {error && <p role="alert">{error}</p>}
    {!report && !error && <p role="status">{t("Bericht wird geladen …", "Rapporten laddas …", "Loading report …")}</p>}
    {report && <><div className={styles.header}><h3>{report.title}</h3><div className={styles.actions}>
      <button className="ghost-button icon-button" type="button" title={t("Drucken / PDF", "Skriv ut / PDF", "Print / PDF")} aria-label={t("Drucken / PDF", "Skriv ut / PDF", "Print / PDF")} onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}><Printer size={18}/></button>
      <button className="ghost-button icon-button" type="button" disabled={exporting} title="Excel" aria-label="Excel" onClick={() => void excel()}><Download size={18}/></button>
      <a className="ghost-button icon-button" title="E-Mail" aria-label="E-Mail" href={`mailto:?subject=${encodeURIComponent(report.title)}&body=${encodeURIComponent(report.text)}`}><Mail size={18}/></a>
      <a className="ghost-button icon-button" title="SMS" aria-label="SMS" href={`sms:?&body=${encodeURIComponent(report.text)}`}><MessageSquare size={18}/></a>
      {typeof navigator !== "undefined" && typeof navigator.share === "function" && <button className="ghost-button icon-button" type="button" title={t("Teilen", "Dela", "Share")} aria-label={t("Teilen", "Dela", "Share")} onClick={() => void navigator.share({ title: report.title, text: report.text }).catch(() => {})}><Share2 size={18}/></button>}
    </div></div><iframe className={styles.reportFrame} ref={frame} title={report.title} srcDoc={report.html} sandbox="allow-same-origin allow-modals"/></>}
  </section>;
}
