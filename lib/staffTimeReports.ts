import { formatStaffMinutes, staffLeaveSummary, type StaffTimeData } from "./staffTime";
import { companyLogoSource } from "./companyLogo";

export type StaffReportScope = "day" | "month" | "company";
export type StaffReportLanguage = "de" | "sv" | "en";
const labels = {
  day: ["Tagesbericht", "Dagsrapport", "Daily report"], month: ["Monatsbericht", "Månadsrapport", "Monthly report"], company: ["Personalbericht", "Personalrapport", "Personnel report"],
  work: ["Arbeitszeit", "Arbetstid", "Working time"], pause: ["Pause", "Rast", "Break"], interruption: ["Unterbrechung", "Avbrott", "Interruption"],
  date: ["Datum", "Datum", "Date"], from: ["Beginn", "Start", "Start"], to: ["Ende", "Slut", "End"], kind: ["Art", "Typ", "Type"], duration: ["Dauer", "Tid", "Duration"], note: ["Grund / Notiz", "Orsak / anteckning", "Reason / note"],
  leave: ["Urlaub", "Semester", "Leave"], days: ["Tage", "Dagar", "Days"], status: ["Status", "Status", "Status"], remaining: ["Verfügbarer Jahresurlaub", "Tillgänglig årssemester", "Available annual leave"],
  requested: ["Beantragt", "Ansökt", "Requested"], approved: ["Genehmigt", "Godkänd", "Approved"], rejected: ["Abgelehnt", "Avslagen", "Rejected"], cancelled: ["Storniert", "Makulerad", "Cancelled"],
  running: ["Laufend – nicht summiert", "Pågående – ej summerad", "Running – not totalled"], empty: ["Keine Einträge", "Inga poster", "No entries"], employee: ["Mitarbeiter", "Medarbetare", "Employee"],
  locked: ["Freigegeben", "Godkänd", "Approved"], open: ["Nicht freigegeben", "Ej godkänd", "Not approved"], review: ["Geprüft durch", "Kontrollerad av", "Reviewed by"], payroll: ["Lohnbuchhaltung", "Löneadministration", "Payroll"],
  total: ["Gesamt", "Totalt", "Total"], entries: ["Zeiteinträge", "Tidposter", "Time entries"],
} as const;
export function staffReportText(language: StaffReportLanguage, key: keyof typeof labels) { return labels[key][language === "sv" ? 1 : language === "en" ? 2 : 0]; }
export function staffReportPeriod(month: string, day?: string) {
  const [year, number] = month.split("-").map(Number);
  const start = day ? new Date(`${day}T00:00:00`) : new Date(year, number - 1, 1);
  const end = day ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) : new Date(year, number, 1);
  return { start: start.getTime(), end: end.getTime() };
}
export function staffReportRows(data: StaffTimeData, month: string, scope: StaffReportScope, day: string) {
  const period = staffReportPeriod(month, scope === "day" ? day : undefined);
  return data.employees.filter(employee => scope === "company" || employee.id === data.employeeId).map(employee => {
    const entries = data.entries.filter(entry => entry.employee_id === employee.id
      && Date.parse(entry.started_at) < period.end && (!entry.ended_at || Date.parse(entry.ended_at) > period.start))
      .sort((a, b) => a.started_at.localeCompare(b.started_at)).map(entry => {
        const start = Math.max(Date.parse(entry.started_at), period.start);
        const end = entry.ended_at ? Math.min(Date.parse(entry.ended_at), period.end) : null;
        return { ...entry, started_at: new Date(start).toISOString(), ended_at: end === null ? null : new Date(end).toISOString(), minutes: end === null ? null : Math.max(0, end - start) / 60000 };
      });
    const year = Number(month.slice(0, 4));
    const ownLeaves = data.leaves.filter(leave => leave.employee_id === employee.id);
    const leaves = ownLeaves.filter(leave => leave.from_date <= (scope === "day" ? day : `${month}-31`) && leave.to_date >= (scope === "day" ? day : `${month}-01`));
    const summary = staffLeaveSummary(data.balances.find(balance => balance.employee_id === employee.id && balance.year === year), ownLeaves, year);
    const minutes = (kind: "work" | "pause" | "interruption") => entries.filter(entry => entry.kind === kind || (kind === "work" && entry.kind === "interruption")).reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
    return { employee, entries, leaves, summary, work: minutes("work"), pause: minutes("pause"), interruption: minutes("interruption") };
  });
}
export function buildStaffReport(data: StaffTimeData, month: string, scope: StaffReportScope, day: string, language: StaffReportLanguage, branding?: { name: string; logoUrl?: string }) {
  const t = (key: keyof typeof labels) => staffReportText(language, key);
  const locale = language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE";
  const rows = staffReportRows(data, month, scope, day);
  const period = scope === "day" ? day : month;
  const title = `${t(scope)} · ${period}`;
  const logo = companyLogoSource(branding?.logoUrl);
  const totals = { work: rows.reduce((sum, row) => sum + row.work, 0), pause: rows.reduce((sum, row) => sum + row.pause, 0), interruption: rows.reduce((sum, row) => sum + row.interruption, 0) };
  const stamp = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  const text = ["WorkCore", title, `${t("employee")}: ${rows.length} · ${t("entries")}: ${rows.reduce((sum, row) => sum + row.entries.length, 0)}`, `${t("total")}: ${t("work")}: ${formatStaffMinutes(totals.work)} h · ${t("pause")}: ${formatStaffMinutes(totals.pause)} h · ${t("interruption")}: ${formatStaffMinutes(totals.interruption)} h`, ...rows.flatMap(row => ["", row.employee.name, `${t("work")}: ${formatStaffMinutes(row.work)} h · ${t("pause")}: ${formatStaffMinutes(row.pause)} h · ${t("interruption")}: ${formatStaffMinutes(row.interruption)} h`,
    ...row.entries.map(entry => `${t(entry.kind)} · ${stamp(entry.started_at)} – ${entry.ended_at ? stamp(entry.ended_at) : t("running")} · ${entry.minutes === null ? "—" : formatStaffMinutes(entry.minutes) + " h"} · ${[entry.reason, entry.note].filter(Boolean).join(" · ")}`),
    `${t("remaining")}: ${row.summary.remaining ?? "—"}`, ...row.leaves.map(leave => `${t("leave")}: ${leave.from_date} – ${leave.to_date} · ${leave.days} ${t("days")} · ${t(leave.status)} · ${leave.note || leave.decision_reason}`)])].join("\n");
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const tableRow = (values: unknown[]) => `<tr>${values.map(value => `<td>${escape(value)}</td>`).join("")}</tr>`;
  const table = (headers: string[], body: string) => `<table><thead><tr>${headers.map(value => `<th>${escape(value)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">${escape(t("empty"))}</td></tr>`}</tbody></table>`;
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>
    @page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#202124;background:white;margin:20px;font-size:12px}h1{font-size:22px}h2{font-size:17px}h3{font-size:14px}header{border-bottom:3px solid #0073e6;padding-bottom:12px}section{margin-top:22px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11px}th,td{text-align:left;padding:7px 4px;border-bottom:1px solid #d4d4d8;vertical-align:top;overflow-wrap:anywhere}th{background:#f4f4f6}tr{break-inside:avoid}.summary{display:flex;flex-wrap:wrap;gap:16px}.signatures{display:flex;gap:40px;margin-top:45px}.signatures span{flex:1;border-top:1px solid #777;padding-top:8px}@media(max-width:500px){body{margin:10px}table{font-size:10px}th,td{padding:6px 2px}}
    .company-logo{float:right;object-fit:contain;object-position:right top;width:140px;height:40px;margin:0 0 10px 15px}header:after{content:"";display:block;clear:both}@media print{.company-logo{position:fixed;float:none;right:0;top:-9mm;width:44mm;height:7mm;margin:0}}
    </style></head><body><header>${logo ? `<img class="company-logo" alt="${escape(branding?.name || "Firmenlogo")}" src="${escape(logo)}">` : ""}<b>${escape(branding?.name || "WorkCore")}</b><h1>${escape(title)}</h1><p>${escape(t("employee"))}: ${rows.length} · ${escape(t("entries"))}: ${rows.reduce((sum, row) => sum + row.entries.length, 0)}</p><p class="summary">${(["work", "pause", "interruption"] as const).map(kind => `<span>${escape(t(kind))}: <b>${escape(formatStaffMinutes(totals[kind]))} h</b></span>`).join("")}</p></header>${rows.map(row => `<section><h2>${escape(row.employee.name)}</h2><p class="summary">${(["work", "pause", "interruption"] as const).map(kind => `<span>${escape(t(kind))}: <b>${escape(formatStaffMinutes(row[kind]))} h</b></span>`).join("")}</p>
    ${table([t("from"), t("to"), t("kind"), t("duration"), t("note"), t("status")], row.entries.map(entry => tableRow([stamp(entry.started_at), entry.ended_at ? stamp(entry.ended_at) : t("running"), t(entry.kind), entry.minutes === null ? "—" : `${formatStaffMinutes(entry.minutes)} h`, [entry.reason, entry.note].filter(Boolean).join(" · "), entry.locked_at ? t("locked") : t("open")])).join(""))}
    <h3>${escape(t("leave"))}</h3><p>${escape(t("remaining"))}: ${row.summary.remaining ?? "—"}</p>${table([t("from"), t("to"), t("days"), t("status"), t("note")], row.leaves.map(leave => tableRow([leave.from_date, leave.to_date, leave.days, t(leave.status), [leave.note, leave.decision_reason].filter(Boolean).join(" · ")])).join(""))}</section>`).join("")}<footer class="signatures"><span>${escape(t("payroll"))}</span><span>${escape(t("review"))}</span></footer></body></html>`;
  return { title, text, html, rows };
}
