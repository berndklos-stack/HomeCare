"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, Coffee, Download, LockKeyhole, Pencil, Play, Plus, RefreshCw, Square, Trash2, TriangleAlert, UnlockKeyhole, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { formatStaffMinutes, staffLeaveSummary, staffMinutesInMonth, suggestedLeaveDays, validateStaffCommand, type StaffCommand, type StaffLeave, type StaffTimeData, type StaffTimeEntry, type StaffTimeKind } from "@/lib/staffTime";
import styles from "./StaffTimeWorkspace.module.css";
import { StaffTimeReports } from "./StaffTimeReports";
import { excelReportLogo, reportBrandingSnapshot, reportExcelHeading } from "@/lib/reportBranding";

type Language = "de" | "sv" | "en";
const words = {
  title: ["Zeiterfassung", "Tidrapportering", "Time tracking"], clock: ["Stempeln", "Stämpla", "Clock"], times: ["Zeiten", "Tider", "Times"], leave: ["Urlaub", "Semester", "Leave"], reports: ["Berichte", "Rapporter", "Reports"],
  employee: ["Mitarbeiter", "Medarbetare", "Employee"], month: ["Monat", "Månad", "Month"], workingTime: ["Arbeitszeit", "Arbetstid", "Working time"], work: ["Arbeit", "Arbete", "Work"], pause: ["Pause", "Rast", "Break"], interruption: ["Unterbrechung", "Avbrott", "Interruption"],
  start: ["Arbeit beginnen", "Börja arbeta", "Start work"], resume: ["Arbeit fortsetzen", "Fortsätt arbeta", "Resume work"], stop: ["Beenden", "Avsluta", "Stop"], running: ["Läuft seit", "Pågår sedan", "Running since"], ready: ["Keine Zeit läuft", "Ingen tid pågår", "No timer running"],
  reason: ["Grund", "Orsak", "Reason"], note: ["Notiz", "Anteckning", "Note"], newTime: ["Zeit nachtragen", "Registrera tid", "Add time"], type: ["Art", "Typ", "Type"], from: ["Beginn", "Början", "Start"], to: ["Ende", "Slut", "End"], save: ["Speichern", "Spara", "Save"], cancel: ["Abbrechen", "Avbryt", "Cancel"], edit: ["Bearbeiten", "Redigera", "Edit"], remove: ["Löschen", "Ta bort", "Delete"],
  lock: ["Freigeben und sperren", "Godkänn och lås", "Approve and lock"], unlock: ["Entsperren", "Lås upp", "Unlock"], locked: ["Freigegeben", "Godkänd", "Approved"], noEntries: ["Keine Zeiteinträge in diesem Monat.", "Inga tidposter denna månad.", "No entries this month."],
  newLeave: ["Urlaub beantragen", "Ansök om semester", "Request leave"], leaveFrom: ["Von", "Från", "From"], leaveTo: ["Bis", "Till", "To"], days: ["Urlaubstage", "Semesterdagar", "Leave days"], requested: ["Beantragt", "Ansökt", "Requested"], approved: ["Genehmigt", "Godkänd", "Approved"], rejected: ["Abgelehnt", "Avslagen", "Rejected"], cancelled: ["Storniert", "Makulerad", "Cancelled"],
  approve: ["Genehmigen", "Godkänn", "Approve"], reject: ["Ablehnen", "Avslå", "Reject"], withdraw: ["Stornieren", "Makulera", "Cancel request"], decision: ["Entscheidungsgrund", "Beslutsmotivering", "Decision reason"], history: ["Verlauf", "Historik", "History"],
  account: ["Urlaubskonto", "Semesterkonto", "Leave allowance"], entitlement: ["Jahresanspruch", "Årsrätt", "Annual allowance"], carryover: ["Übertrag", "Sparade dagar", "Carryover"], used: ["Bereits außerhalb erfasst", "Redan registrerat utanför appen", "Already recorded elsewhere"], remaining: ["Verfügbar", "Tillgängligt", "Available"],
  noBalance: ["Urlaubskonto nicht eingerichtet.", "Semesterkontot är inte inställt.", "Leave allowance not configured."], noLeave: ["Keine Urlaubsanträge in diesem Jahr.", "Inga semesteransökningar detta år.", "No leave requests this year."],
  reload: ["Aktualisieren", "Uppdatera", "Refresh"], loading: ["Wird geladen …", "Laddar …", "Loading …"], saved: ["Gespeichert.", "Sparat.", "Saved."], missing: ["Bitte unter Administration → Benutzer einen Mitarbeiter zuordnen.", "Koppla en medarbetare under Administration → Användare.", "Link an employee under Administration → Users."],
  deleteConfirm: ["Diesen Zeiteintrag löschen?", "Ta bort denna tidpost?", "Delete this time entry?"], export: ["Zeiten als Excel", "Tider som Excel", "Times as Excel"], duration: ["Minuten", "Minuter", "Minutes"], error: ["Vorgang fehlgeschlagen. Eingaben bleiben erhalten.", "Åtgärden misslyckades. Dina uppgifter finns kvar.", "Action failed. Your inputs are retained."],
} as const;
function localDateTime(value = new Date()) { return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function localMonth(value: string) { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
type TimeDraft = { id?: string; revision?: number; kind: StaffTimeKind; reason: string; note: string; from: string; to: string };

export function StaffTimeWorkspace({ language, dirtyChanged, busyChanged }: { language: Language; dirtyChanged: (dirty: boolean) => void; busyChanged: (busy: boolean) => void }) {
  const index = language === "sv" ? 1 : language === "en" ? 2 : 0;
  const t = (key: keyof typeof words) => words[key][index];
  const [tab, setTab] = useState<"clock" | "times" | "leave" | "reports">("clock");
  const [month, setMonth] = useState(() => localMonth(new Date().toISOString()));
  const [employeeId, setEmployeeId] = useState("");
  const [data, setData] = useState<StaffTimeData | null>(null);
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [timeDraft, setTimeDraft] = useState<TimeDraft | null>(null);
  const [leaveDraft, setLeaveDraft] = useState<{ from: string; to: string; days: string; note: string } | null>(null);
  const [balanceDraft, setBalanceDraft] = useState<{ entitlementDays: string; carryoverDays: string; usedDays: string } | null>(null);
  const [decision, setDecision] = useState<{ entry: StaffLeave; action: "leave_approve" | "leave_reject" | "leave_cancel"; reason: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<{ id: string; fingerprint: string } | null>(null);
  const key = `${employeeId}:${month}:${reload}`;
  const loading = key !== loadedKey;
  const busy = loading || saving;
  const dirty = Boolean(timeDraft || leaveDraft || balanceDraft || decision || reason || note);
  useEffect(() => { dirtyChanged(dirty); }, [dirty, dirtyChanged]);
  useEffect(() => { busyChanged(saving); }, [saving, busyChanged]);
  useEffect(() => () => { dirtyChanged(false); busyChanged(false); }, [dirtyChanged, busyChanged]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ month, ...(employeeId ? { employeeId } : {}) });
    void apiFetch(`/api/staff-time?${query}`, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || words.error[index]);
      if (controller.signal.aborted) return;
      setData(result); setLoadedKey(key); setError("");
      if (!employeeId && result.employeeId) setEmployeeId(result.employeeId);
    }).catch(cause => { if (!controller.signal.aborted) { setError((cause as Error).message); setLoadedKey(key); } });
    return () => controller.abort();
  }, [employeeId, month, key, index]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", listener); return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  const current = data?.employeeId === employeeId ? data : null;
  const active = current?.entries.find(row => !row.ended_at);
  const entries = (current?.entries ?? []).filter(row => row.ended_at ? staffMinutesInMonth(row, month) > 0 : localMonth(row.started_at) === month);
  const year = Number(month.slice(0, 4));
  const balance = current?.balances.find(row => row.year === year);
  const leaveSummary = staffLeaveSummary(balance, current?.leaves ?? [], year);
  const locale = language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE";
  function date(value: string) { return new Date(value).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }); }
  function resetDrafts() { setTimeDraft(null); setLeaveDraft(null); setBalanceDraft(null); setDecision(null); setReason(""); setNote(""); }
  function changeContext(change: () => void) {
    if (dirty && !window.confirm(language === "sv" ? "Kasta osparade ändringar?" : language === "en" ? "Discard unsaved changes?" : "Ungespeicherte Eingaben verwerfen?")) return;
    resetDrafts(); setNotice(""); change();
  }
  async function send(command: StaffCommand, done: () => void = () => {}) {
    if (busy || !employeeId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const validated = validateStaffCommand({ ...command, employeeId });
      const fingerprint = JSON.stringify(validated);
      if (pending.current?.fingerprint !== fingerprint) pending.current = { id: crypto.randomUUID(), fingerprint };
      const response = await apiFetch("/api/staff-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutationId: pending.current!.id, command: validated }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("error"));
      pending.current = null; done(); setNotice(t("saved")); setReload(value => value + 1);
    } catch (cause) { setError((cause as Error).message); } finally { setSaving(false); }
  }
  function clock(kind: StaffTimeKind | null) { void send({ action: "clock", kind, activeId: active?.id ?? null, ...(active ? { revision: active.revision } : {}), reason, note }, () => { setReason(""); setNote(""); }); }
  function newTime(entry?: StaffTimeEntry) {
    setTimeDraft(entry ? { id: entry.id, revision: entry.revision, kind: entry.kind, reason: entry.reason, note: entry.note, from: localDateTime(new Date(entry.started_at)), to: localDateTime(new Date(entry.ended_at!)) }
      : { kind: "work", reason: "", note: "", from: localDateTime(new Date(Date.now() - 3600000)), to: localDateTime() });
  }
  async function exportTimes() {
    if (busy) return;
    const branding = reportBrandingSnapshot();
    setSaving(true); setError("");
    try {
    const cells = [[t("employee"), t("type"), t("from"), t("to"), t("duration"), t("reason"), t("note"), t("locked")], ...entries.map(row => [current?.employees.find(row => row.id === employeeId)?.name ?? "", t(row.kind), date(row.started_at), row.ended_at ? date(row.ended_at) : "", row.minutes == null ? "" : String(row.minutes), row.reason, row.note, row.locked_at ? t("locked") : ""])];
    const { default: writeExcelFile } = await import("write-excel-file/universal");
    const rows: import("write-excel-file/universal").SheetData = cells.map((row, index) => row.map((value, column) => index > 0 && column === 4 && value !== ""
      ? { value: Number(value), type: Number, format: "0.00" }
      : { value, type: String, wrap: true, ...(index === 0 ? { fontWeight: "bold" as const } : {}) }));
    const blob = await writeExcelFile(reportExcelHeading(rows, branding, `${t("times")} ${month}`), { images: await excelReportLogo(branding, 7), columns: [28, 18, 24, 24, 14, 35, 55, 18].map(width => ({ width })), stickyRowsCount: 4 }).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `times-${month}.xlsx`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(t("error")); } finally { setSaving(false); }
  }
  return <section className={styles.workspace} aria-label={t("title")}>
    <header className={styles.header}><h2>{t("title")}</h2><button className="ghost-button icon-button" type="button" disabled={busy} title={t("reload")} aria-label={t("reload")} onClick={() => setReload(value => value + 1)}><RefreshCw size={18}/></button></header>
    <div className={styles.filters}>
      <label>{t("employee")}<select aria-label={t("employee")} value={employeeId} disabled={busy || !data?.canManage} onChange={event => changeContext(() => setEmployeeId(event.target.value))}><option value="">—</option>{data?.employees.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><ChevronDown className={styles.selectChevron} size={16}/></label>
      <label>{t("month")}<input type="month" value={month} disabled={busy} onChange={event => { if (event.target.value) changeContext(() => setMonth(event.target.value)); }}/></label>
    </div>
    <nav className="master-data-tabs" aria-label={t("title")}>{(["clock", "times", "leave", "reports"] as const).map(key => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => changeContext(() => setTab(key))}>{t(key)}</button>)}</nav>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loading && <p role="status">{t("loading")}</p>}
    {data && !employeeId && !loading && <p>{data.canManage ? t("employee") : t("missing")}</p>}
    {current && employeeId && <>
      {tab === "reports" && <StaffTimeReports data={current} month={month} language={language}/>}
      {tab !== "clock" && tab !== "reports" && <dl className={styles.totals}>{(["work", "pause", "interruption"] as const).map(kind => <div key={kind}><dt>{t(kind === "work" ? "workingTime" : kind)}</dt><dd>{formatStaffMinutes(entries.filter(row => row.kind === kind || (kind === "work" && row.kind === "interruption")).reduce((sum, row) => sum + staffMinutesInMonth(row, month), 0))} h</dd></div>)}</dl>}
      {tab === "clock" && <section className={styles.band} aria-label={t("clock")}>
        <div className={styles.clock}><Clock3 size={24}/><div><h3>{active ? t(active.kind) : t("ready")}</h3>{active && <p>{t("running")} {date(active.started_at)} · <strong>{formatStaffMinutes(Math.max(0, now - Date.parse(active.started_at)) / 60000)} h</strong></p>}</div></div>
        <div className={styles.actions}>
          {active?.kind !== "work" && <button className="primary-button" type="button" disabled={busy} onClick={() => clock("work")}><Play size={18}/>{active ? t("resume") : t("start")}</button>}
          {active && <>{active.kind !== "pause" && <button className="ghost-button" type="button" disabled={busy} onClick={() => clock("pause")}><Coffee size={18}/>{t("pause")}</button>}{active.kind !== "interruption" && <button className="ghost-button" type="button" disabled={busy} onClick={() => clock("interruption")}><TriangleAlert size={18}/>{t("interruption")}</button>}<button className="ghost-button" type="button" disabled={busy} onClick={() => clock(null)}><Square size={18}/>{t("stop")}</button></>}
        </div>
        <div className={styles.grid}><label>{t("reason")}<input maxLength={300} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label><label>{t("note")}<input maxLength={4000} value={note} disabled={busy} onChange={event => setNote(event.target.value)}/></label></div>
      </section>}
      {tab === "times" && <section className={styles.band} aria-label={t("times")}>
        <div className={styles.header}><h3>{t("times")}</h3><div className={styles.actions}><button className="ghost-button icon-button" type="button" title={t("export")} aria-label={t("export")} onClick={() => void exportTimes()} disabled={!entries.length || busy}><Download size={18}/></button><button className="ghost-button create-button" type="button" disabled={busy || Boolean(timeDraft)} onClick={() => newTime()}><Plus size={18}/>{t("newTime")}</button></div></div>
        {timeDraft && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void send({ action: "time_save", ...(timeDraft.id ? { id: timeDraft.id, revision: timeDraft.revision } : {}), kind: timeDraft.kind, reason: timeDraft.reason, note: timeDraft.note, startedAt: new Date(timeDraft.from).toISOString(), endedAt: new Date(timeDraft.to).toISOString() }, () => setTimeDraft(null)); }}>
          <div className={styles.grid}><label>{t("type")}<select disabled={busy} value={timeDraft.kind} onChange={event => setTimeDraft({ ...timeDraft, kind: event.target.value as StaffTimeKind })}>{(["work", "pause", "interruption"] as const).map(key => <option key={key} value={key}>{t(key)}</option>)}</select><ChevronDown className={styles.selectChevron} size={16}/></label><span/>
            <label>{t("from")}<input type="datetime-local" required disabled={busy} value={timeDraft.from} onChange={event => setTimeDraft({ ...timeDraft, from: event.target.value })}/></label><label>{t("to")}<input type="datetime-local" required disabled={busy} value={timeDraft.to} onChange={event => setTimeDraft({ ...timeDraft, to: event.target.value })}/></label>
            <label>{t("reason")}<input maxLength={300} disabled={busy} value={timeDraft.reason} onChange={event => setTimeDraft({ ...timeDraft, reason: event.target.value })}/></label><label>{t("note")}<input maxLength={4000} disabled={busy} value={timeDraft.note} onChange={event => setTimeDraft({ ...timeDraft, note: event.target.value })}/></label></div>
          <footer className={styles.actions}><button className="ghost-button" type="button" disabled={saving} onClick={() => setTimeDraft(null)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={busy}><Check size={18}/>{t("save")}</button></footer>
        </form>}
        <div>{entries.map(row => <article className={styles.timeRow} key={row.id}><div><strong>{t(row.kind)}</strong><span>{date(row.started_at)}{row.ended_at ? ` – ${date(row.ended_at)}` : ` · ${t("running")}`}</span>{(row.reason || row.note) && <small>{[row.reason, row.note].filter(Boolean).join(" · ")}</small>}</div><strong>{row.minutes == null ? "—" : `${formatStaffMinutes(Number(row.minutes))} h`}</strong><div className={styles.actions}>
          {row.locked_at && <span className={styles.locked}><LockKeyhole size={16}/>{t("locked")}</span>}
          {row.ended_at && !row.locked_at && <><button className="ghost-button icon-button" type="button" disabled={busy || Boolean(timeDraft)} title={t("edit")} aria-label={`${t("edit")} ${date(row.started_at)}`} onClick={() => newTime(row)}><Pencil size={17}/></button><button className="ghost-button icon-button" type="button" disabled={busy} title={t("remove")} aria-label={`${t("remove")} ${date(row.started_at)}`} onClick={() => { if (window.confirm(t("deleteConfirm"))) void send({ action: "time_delete", id: row.id, revision: row.revision }); }}><Trash2 size={17}/></button></>}
          {current.canManage && row.ended_at && <button className="ghost-button icon-button" type="button" disabled={busy} title={t(row.locked_at ? "unlock" : "lock")} aria-label={`${t(row.locked_at ? "unlock" : "lock")} ${date(row.started_at)}`} onClick={() => void send({ action: row.locked_at ? "time_unlock" : "time_lock", id: row.id, revision: row.revision })}>{row.locked_at ? <UnlockKeyhole size={17}/> : <LockKeyhole size={17}/>}</button>}
        </div></article>)}</div>{!entries.length && <p>{t("noEntries")}</p>}
      </section>}
      {tab === "leave" && <section className={styles.band} aria-label={t("leave")}>
        <div className={styles.header}><h3>{t("account")} {year}</h3>{current.canManage && <button className="ghost-button icon-button" type="button" disabled={busy || Boolean(balanceDraft)} title={t("edit")} aria-label={`${t("account")} ${t("edit")}`} onClick={() => setBalanceDraft({ entitlementDays: balance ? String(balance.entitlement_days) : "", carryoverDays: String(balance?.carryover_days ?? 0), usedDays: String(balance?.used_days ?? 0) })}><Pencil size={18}/></button>}</div>
        {balance ? <dl className={styles.totals}>{[[t("entitlement"), balance.entitlement_days], [t("carryover"), balance.carryover_days], [t("used"), balance.used_days], [t("approved"), leaveSummary.approved], [t("requested"), leaveSummary.requested], [t("remaining"), leaveSummary.remaining]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{Number(value).toLocaleString(locale)}</dd></div>)}</dl> : <p>{t("noBalance")}</p>}
        {balanceDraft && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void send({ action: "balance_save", year, revision: balance?.revision ?? 0, entitlementDays: Number(balanceDraft.entitlementDays), carryoverDays: Number(balanceDraft.carryoverDays), usedDays: Number(balanceDraft.usedDays) }, () => setBalanceDraft(null)); }}><div className={styles.grid}>{(["entitlementDays", "carryoverDays", "usedDays"] as const).map((key, index) => <label key={key}>{t((["entitlement", "carryover", "used"] as const)[index])}<input type="number" required min={0} max={key === "usedDays" ? 732 : 366} step={0.5} disabled={busy} value={balanceDraft[key]} onChange={event => setBalanceDraft({ ...balanceDraft, [key]: event.target.value })}/></label>)}</div><footer className={styles.actions}><button className="ghost-button" type="button" disabled={saving} onClick={() => setBalanceDraft(null)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={busy}><Check size={18}/>{t("save")}</button></footer></form>}
        <div className={styles.header}><h3>{t("leave")}</h3><button className="ghost-button create-button" type="button" disabled={busy || Boolean(leaveDraft)} onClick={() => { const today = new Date().toLocaleDateString("sv-SE"); setLeaveDraft({ from: today, to: today, days: String(suggestedLeaveDays(today, today)), note: "" }); }}><Plus size={18}/>{t("newLeave")}</button></div>
        {leaveDraft && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void send({ action: "leave_request", from: leaveDraft.from, to: leaveDraft.to, days: Number(leaveDraft.days), note: leaveDraft.note }, () => setLeaveDraft(null)); }}><div className={styles.grid}>
          <label>{t("leaveFrom")}<input type="date" required disabled={busy} value={leaveDraft.from} onChange={event => { const from = event.target.value; const to = leaveDraft.to < from ? from : leaveDraft.to; setLeaveDraft({ ...leaveDraft, from, to, days: String(suggestedLeaveDays(from, to)) }); }}/></label><label>{t("leaveTo")}<input type="date" required min={leaveDraft.from} disabled={busy} value={leaveDraft.to} onChange={event => setLeaveDraft({ ...leaveDraft, to: event.target.value, days: String(suggestedLeaveDays(leaveDraft.from, event.target.value)) })}/></label>
          <label>{t("days")}<input type="number" required min={0.5} max={366} step={0.5} disabled={busy} value={leaveDraft.days} onChange={event => setLeaveDraft({ ...leaveDraft, days: event.target.value })}/></label><label>{t("note")}<textarea maxLength={4000} rows={2} disabled={busy} value={leaveDraft.note} onChange={event => setLeaveDraft({ ...leaveDraft, note: event.target.value })}/></label></div><footer className={styles.actions}><button className="ghost-button" type="button" disabled={saving} onClick={() => setLeaveDraft(null)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={busy}><Check size={18}/>{t("newLeave")}</button></footer></form>}
        {current.leaves.map(row => <article className={styles.leaveRow} key={row.id}><div><strong>{new Date(`${row.from_date}T12:00:00`).toLocaleDateString(locale)} – {new Date(`${row.to_date}T12:00:00`).toLocaleDateString(locale)}</strong><p>{Number(row.days).toLocaleString(locale)} · {t("days")} · {t(row.status)}</p>{row.note && <p>{row.note}</p>}{row.decision_reason && <p>{t("decision")}: {row.decision_reason}</p>}</div>
          <div className={styles.actions}>{row.status === "requested" && current.canManage && <><button className="ghost-button" type="button" disabled={busy || Boolean(decision)} onClick={() => setDecision({ entry: row, action: "leave_reject", reason: "" })}><X size={17}/>{t("reject")}</button><button className="ghost-button" type="button" disabled={busy || Boolean(decision)} onClick={() => setDecision({ entry: row, action: "leave_approve", reason: "" })}><Check size={17}/>{t("approve")}</button></>}{(row.status === "requested" || (row.status === "approved" && current.canManage)) && <button className="ghost-button" type="button" disabled={busy || Boolean(decision)} onClick={() => setDecision({ entry: row, action: "leave_cancel", reason: "" })}>{t("withdraw")}</button>}</div>
          {decision?.entry.id === row.id && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void send({ action: decision.action, id: decision.entry.id, revision: decision.entry.revision, reason: decision.reason }, () => setDecision(null)); }}><label>{t("decision")}<textarea rows={2} maxLength={4000} value={decision.reason} disabled={busy} onChange={event => setDecision({ ...decision, reason: event.target.value })}/></label><footer className={styles.actions}><button className="ghost-button" type="button" disabled={saving} onClick={() => setDecision(null)}>{t("cancel")}</button><button className="primary-button" type="submit" disabled={busy}><Check size={18}/>{t(decision.action === "leave_approve" ? "approve" : decision.action === "leave_reject" ? "reject" : "withdraw")}</button></footer></form>}
          <details><summary>{t("history")}</summary>{current.events.filter(event => event.request_id === row.id).map(event => <p key={event.id}>{date(event.created_at)} · {t(event.action as StaffLeave["status"])}{event.reason ? ` · ${event.reason}` : ""}</p>)}</details>
        </article>)}{!current.leaves.length && <p>{t("noLeave")}</p>}
      </section>}
    </>}
  </section>;
}
