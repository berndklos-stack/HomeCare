"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Plus, RefreshCw, Save } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { companyModules, type CompanyAdministrationDetail, type CompanyDirectoryEntry, type CompanyInput } from "@/lib/administration";

const moduleNames: Record<string, string> = { jobs: "Aufträge", reports: "Berichte", time_tracking: "Zeiterfassung", billing: "Abrechnung", inventory: "Lager & Material", logbook: "Fahrtenbuch", customer_portal: "Kundenportal", dispatch: "Einsatzplanung", documents: "Dokumente", ai: "KI", integrations: "Integrationen" };
const accountNames: Record<string, string> = { production: "Produktion", pilot: "Testkonto", demo: "Demo" };

async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Firmendaten konnten nicht geladen werden.");
  return data;
}

function CompanyEditor({ id, close, renderUsers, initialUsers = false, initialNotice = "" }: { id: string; close: () => void; renderUsers: (id: string) => ReactNode; initialUsers?: boolean; initialNotice?: string }) {
  const [tab, setTab] = useState(initialUsers ? "users" : "settings");
  const [detail, setDetail] = useState<CompanyAdministrationDetail | null>(null);
  const [form, setForm] = useState<CompanyInput | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedVersion, setLoadedVersion] = useState(-1);
  const loading = loadedVersion !== reload;
  const dirty = Boolean(form && detail && JSON.stringify(form) !== JSON.stringify(detail.company));
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`/api/administration/companies?tenantId=${encodeURIComponent(id)}`, { signal: controller.signal }).then(readResponse).then((data: CompanyAdministrationDetail) => {
      if (!controller.signal.aborted) { setDetail(data); setForm(data.company); setError(""); setLoadedVersion(reload); }
    }).catch(cause => { if (!controller.signal.aborted) { setError((cause as Error).message); setLoadedVersion(reload); } });
    return () => controller.abort();
  }, [id, reload]);
  function leave() { if (!busy && (!dirty || window.confirm("Nicht gespeicherte Änderungen verwerfen?"))) close(); }
  function field(key: Exclude<keyof CompanyInput, "modules">, label: string, type = "text", required = false) {
    return <label>{label}<input type={type} required={required} maxLength={key === "name" ? 200 : 254} disabled={busy} value={String(form![key])} onChange={e => { setForm({ ...form!, [key]: e.target.value }); setNotice(""); }} /></label>;
  }
  return <section aria-label="Firmeneinstellungen">
    <header className="administration-section-header"><button className="ghost-button" type="button" disabled={busy} onClick={leave}><ArrowLeft size={18} />Firmenübersicht</button><h2>{detail?.company.name || "Firmeneinstellungen"}</h2><button className="ghost-button icon-button" type="button" title="Firmendaten neu laden" aria-label="Firmendaten neu laden" disabled={busy || loading} onClick={() => { if (!dirty || window.confirm("Änderungen verwerfen und aktuellen Stand laden?")) setReload(value => value + 1); }}><RefreshCw size={18} /></button></header>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <nav className="administration-tabs" aria-label="Firma verwalten">{[["settings", "Einstellungen"], ["users", "Benutzer"]].map(([key, title]) => <button type="button" key={key} className={tab === key ? "active" : ""} disabled={busy} onClick={() => {
      if (key === tab) return;
      if (dirty && !window.confirm("Ungespeicherte Firmeneinstellungen verwerfen?")) return;
      if (dirty && detail) setForm(detail.company);
      setTab(key);
    }}>{title}</button>)}</nav>
    {tab === "users" && detail && renderUsers(id)}
    {tab === "settings" && (!form || !detail ? !error && <p role="status">Firma wird geladen …</p> : <form onSubmit={async event => {
      event.preventDefault(); if (busy || loading || !dirty) return;
      setBusy(true); setError(""); setNotice("");
      try {
        await readResponse(await apiFetch("/api/administration/companies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", tenantId: id, revision: detail.revision, settingsRevision: detail.settingsRevision, company: form }) }));
        setNotice("Firmeneinstellungen gespeichert."); setReload(value => value + 1);
      } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy || loading} className="administration-company-fields"><legend>Firmenstammdaten</legend><div className="administration-grid">
        {field("name", "Firmenname", "text", true)}<label>Eigentümer-E-Mail<input readOnly value={form.ownerEmail} /></label>
        <label>Land<select disabled={busy} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>{[["SE", "Schweden"], ["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"], ["GB", "Großbritannien"], ["US", "USA"]].map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label>Sprache<select disabled={busy} value={form.locale} onChange={e => setForm({ ...form, locale: e.target.value as CompanyInput["locale"] })}><option value="de">Deutsch</option><option value="sv">Svenska</option><option value="en">English</option></select></label>
        {field("timezone", "Zeitzone", "text", true)}{field("organizationNumber", "Organisationsnummer")}{field("vatNumber", "USt-ID")}{field("contactPerson", "Ansprechpartner")}
      </div></fieldset>
      <fieldset disabled={busy || loading} className="administration-company-fields"><legend>Kontoeinstellungen</legend><div className="administration-grid">
        <label>Kontotyp<select aria-label="Kontotyp" disabled={busy} value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value as CompanyInput["accountType"] })}>{Object.entries(accountNames).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        {field("internalLabel", "Interne Bezeichnung")}{field("pilotStartDate", "Testbeginn", "date", form.accountType === "pilot")}{field("pilotEndDate", "Testende", "date")}
      </div><label>Interne Notizen<textarea rows={3} maxLength={4000} disabled={busy} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label></fieldset>
      <fieldset disabled={busy || loading} className="administration-modules"><legend>Module</legend>{companyModules.map(module => <label key={module}><input type="checkbox" disabled={busy} checked={form.modules.includes(module)} onChange={e => setForm({ ...form, modules: e.target.checked ? [...form.modules, module] : form.modules.filter(value => value !== module) })} />{moduleNames[module]}</label>)}</fieldset>
      <footer className="administration-company-footer"><button className="ghost-button" type="button" disabled={busy} onClick={leave}>Zurück</button><button className="primary-button" type="submit" disabled={busy || loading || !dirty}><Save size={18} />{busy ? "Wird gespeichert …" : "Einstellungen speichern"}</button></footer>
    </form>)}
  </section>;
}

export function CompanyDirectory({ renderUsers, renderCreate }: { renderUsers: (id: string) => ReactNode; renderCreate: (created: (id: string, notice: string) => void, close: () => void) => ReactNode }) {
  const [selection, setSelection] = useState("");
  const [creating, setCreating] = useState(false);
  const [openUsers, setOpenUsers] = useState(false);
  const [createdNotice, setCreatedNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ companies: CompanyDirectoryEntry[]; total: number; key: string }>({ companies: [], total: 0, key: "" });
  const [error, setError] = useState("");
  const query = new URLSearchParams({ search, page: String(page) }).toString();
  const key = `${query}:${reload}`;
  useEffect(() => {
    if (selection || creating) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void apiFetch(`/api/administration/companies?${query}`, { signal: controller.signal }).then(readResponse).then(data => {
      if (!controller.signal.aborted) { setResult({ companies: data.companies, total: data.total ?? data.companies.length, key }); setError(""); }
    }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); }); }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, key, selection, creating]);
  if (selection) return <CompanyEditor key={selection} id={selection} initialUsers={openUsers} initialNotice={createdNotice} renderUsers={renderUsers} close={() => { setSelection(""); setCreatedNotice(""); setReload(value => value + 1); }} />;
  if (creating) return renderCreate((id, notice) => { setCreatedNotice(notice); setCreating(false); setOpenUsers(true); setSelection(id); }, () => setCreating(false));
  const loading = result.key !== key;
  return <section aria-label="Firmenübersicht">
    <header className="administration-section-header"><h2>Alle Firmen</h2><div className="row-actions"><button className="ghost-button create-button" type="button" onClick={() => setCreating(true)}><Plus size={18}/>Neue Firma anlegen</button><button className="ghost-button icon-button" title="Firmen aktualisieren" aria-label="Firmen aktualisieren" type="button" onClick={() => setReload(value => value + 1)}><RefreshCw size={18} /></button></div></header>
    <label className="administration-company-search">Firma suchen<input type="search" value={search} maxLength={120} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
    {error && <p role="alert">{error}</p>}
    {loading ? !error && <p role="status">Firmen werden geladen …</p> : <>
      <p>{result.total} {result.total === 1 ? "Firma" : "Firmen"}</p>
      <div className="administration-company-directory">{result.companies.map(company => <button className="administration-company-open" key={company.id} type="button" aria-label={`Firma ${company.name} bearbeiten`} onClick={() => { setOpenUsers(false); setSelection(company.id); }}><span><strong>{company.name}</strong><small>{accountNames[company.account_type] || company.account_type} · {company.country_code || "—"} · {company.email || "—"}</small></span><span>{company.archived ? "Gesperrt / archiviert" : "Aktiv"}</span><ChevronRight size={18} /></button>)}</div>
      {!result.companies.length && <p>Keine Firmen gefunden.</p>}
      {result.total > 50 && <div className="administration-pagination"><button type="button" className="ghost-button icon-button" title="Vorherige Seite" aria-label="Vorherige Seite" disabled={!page} onClick={() => setPage(page - 1)}><ArrowLeft size={18} /></button><span>{page + 1} / {Math.ceil(result.total / 50)}</span><button type="button" className="ghost-button icon-button" title="Nächste Seite" aria-label="Nächste Seite" disabled={(page + 1) * 50 >= result.total} onClick={() => setPage(page + 1)}><ArrowRight size={18} /></button></div>}
    </>}
  </section>;
}
