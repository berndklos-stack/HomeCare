"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CommunicationActions } from "./CommunicationActions";
import { apiFetch } from "@/lib/apiClient";
import { buildStaffReport, staffReportText, type StaffReportLanguage, type StaffReportScope } from "@/lib/staffTimeReports";
import type { StaffTimeData } from "@/lib/staffTime";
import styles from "./StaffTimeWorkspace.module.css";
import { excelReportLogo, reportBrandingSnapshot, reportLogoDataUrl, reportExcelHeading } from "@/lib/reportBranding";

export function StaffTimeReports({ data, month, language }: { data: StaffTimeData; month: string; language: StaffReportLanguage }) {
  const [scope, setScope] = useState<StaffReportScope>("month");
  const [employeeId, setEmployeeId] = useState("");
  const [selectedDay, setSelectedDay] = useState(`${month}-01`);
  const day = selectedDay.startsWith(month) ? selectedDay : `${month}-01`;
  const [company, setCompany] = useState<{ month: string; snapshot: StaffTimeData; data: StaffTimeData } | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const brandingKey = JSON.stringify(reportBrandingSnapshot());
  const [logo, setLogo] = useState<{ key: string; data: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    void reportLogoDataUrl(JSON.parse(brandingKey)).then(data => { if (active) setLogo({ key: brandingKey, data, error: "" }); })
      .catch(cause => { if (active) setLogo({ key: brandingKey, data: "", error: String(cause.message) }); });
    return () => { active = false; };
  }, [brandingKey]);
  const frame = useRef<HTMLIFrameElement>(null);
  const t = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  useEffect(() => {
    if (!data.canManage) return;
    const controller = new AbortController();
    void apiFetch(`/api/staff-time?scope=company&month=${month}`, { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      if (!controller.signal.aborted) { setError(""); setCompany({ month, snapshot: data, data: result }); }
    }).catch(cause => { if (!controller.signal.aborted) setError(String(cause.message)); });
    return () => controller.abort();
  }, [month, data]);
  const source = data.canManage ? company?.month === month && company.snapshot === data ? company.data : null : data;
  const logoReady = logo?.key === brandingKey;
  const report = source && logoReady && !logo.error ? buildStaffReport(source, month, scope, day, language, { ...JSON.parse(brandingKey), logoUrl: logo.data }, data.canManage ? employeeId : data.employeeId) : null;
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
        { sheet: t("Übersicht", "Översikt", "Summary"), data: reportExcelHeading(summaries, JSON.parse(brandingKey), report.title), images: await excelReportLogo(JSON.parse(brandingKey), 5), stickyRowsCount: 4, columns: [28, 24, 24, 24, 28].map(width => ({ width })) },
        { sheet: t("Zeiten", "Tider", "Times"), data: reportExcelHeading(rows, JSON.parse(brandingKey), report.title), images: await excelReportLogo(JSON.parse(brandingKey), 6), stickyRowsCount: 4, columns: [28, 26, 26, 24, 15, 50].map(width => ({ width })) },
        { sheet: staffReportText(language, "leave"), data: reportExcelHeading(leaves, JSON.parse(brandingKey), report.title), images: await excelReportLogo(JSON.parse(brandingKey), 6), stickyRowsCount: 4, columns: [28, 20, 20, 15, 20, 50].map(width => ({ width })) },
      ]).toBlob();
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `staff-report-${scope}-${scope === "day" ? day : month}.xlsx`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(t("Export fehlgeschlagen.", "Export misslyckades.", "Export failed.")); } finally { setExporting(false); }
  }
  return <section className={styles.band} aria-label={t("Berichte", "Rapporter", "Reports")}>
    <div className={styles.filters}><label>{t("Bericht", "Rapport", "Report")}<select aria-label={t("Bericht", "Rapport", "Report")} value={scope} onChange={event => setScope(event.target.value as StaffReportScope)}>{(["day", "month", ...(data.canManage ? ["company"] : [])] as StaffReportScope[]).map(key => <option key={key} value={key}>{staffReportText(language, key)}</option>)}</select><ChevronDown className={styles.selectChevron} size={16}/></label>
      {data.canManage && <label>{staffReportText(language, "employee")}<select aria-label={staffReportText(language, "employee")} value={employeeId} disabled={!source || exporting} onChange={event => setEmployeeId(event.target.value)}><option value="">{staffReportText(language, "allEmployees")}</option>{source?.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><ChevronDown className={styles.selectChevron} size={16}/></label>}
      {scope === "day" && <label>{staffReportText(language, "date")}<input type="date" min={`${month}-01`} max={`${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`} value={day} onChange={event => { if (event.target.value.startsWith(month)) setSelectedDay(event.target.value); }}/></label>}
    </div>
    {error && <p role="alert">{error}</p>}
    {logoReady && logo.error && <p role="alert">{logo.error}</p>}
    {!report && !error && <p role="status">{t("Bericht wird geladen …", "Rapporten laddas …", "Loading report …")}</p>}
    {report && <><div className={styles.header}><h3>{report.title}</h3><CommunicationActions title={report.title} text={report.text} language={language} disabled={exporting} onPrint={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }} downloads={[{ label: "Excel", run: excel }]} /></div><iframe className={styles.reportFrame} ref={frame} title={report.title} srcDoc={report.html} sandbox="allow-same-origin allow-modals"/></>}
  </section>;
}
