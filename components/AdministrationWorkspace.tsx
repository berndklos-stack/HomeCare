"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, RefreshCw, Shield } from "lucide-react";
import { EmployeeLogoutButton } from "@/components/AuthGate";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { CompanyDirectory } from "@/components/CompanyDirectory";
import { BrandingSettings } from "@/components/BrandingSettings";
import { CompanyUsers } from "@/components/CompanyUsers";
import { apiFetch } from "@/lib/apiClient";
import { companyModules, permissionDomains, type AdministrationData, type CompanyInput } from "@/lib/administration";

const roleNames: Record<string, string> = { owner: "Eigentümer", admin: "Administrator", manager: "Leitung", office: "Büro", field_worker: "Außendienst" };
const moduleNames: Record<string, string> = { jobs: "Aufträge", reports: "Berichte", time_tracking: "Zeiterfassung", billing: "Abrechnung", inventory: "Lager & Material", logbook: "Fahrtenbuch", customer_portal: "Kundenportal", dispatch: "Einsatzplanung", documents: "Dokumente", ai: "KI", integrations: "Integrationen" };
const categoryNames: Record<string, string> = { problem: "Problem", improvement: "Verbesserung", feature: "Funktionswunsch" };
const permissionNames: Record<string, string> = { "data.read": "Daten lesen", "data.write": "Allgemeine Daten bearbeiten", "sync.write": "Synchronisieren", "customers.manage": "Kunden verwalten", "objects.manage": "Objekte verwalten", "jobs.manage": "Aufträge und Berichte bearbeiten", "resources.manage": "Ressourcen verwalten", "invoices.manage": "Abrechnung verwalten", "media.manage": "Medien verwalten", "communication.send": "Nachrichten versenden", "tenant.admin": "Firma verwalten", "backups.manage": "Sicherungen verwalten", "members.manage": "Benutzer verwalten", "roles.manage": "Rollen verwalten" };

async function administrationRequest(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Vorgang fehlgeschlagen.");
  return result;
}


const emptyCompany = (): CompanyInput => ({ name: "", country: "SE", locale: "de", timezone: "Europe/Stockholm", organizationNumber: "", vatNumber: "", ownerEmail: "", accountType: "pilot", pilotStartDate: new Date().toISOString().slice(0, 10), pilotEndDate: "", contactPerson: "", internalLabel: "", notes: "", modules: ["jobs", "reports", "time_tracking", "documents"] });

function CompanyOnboarding({ created, close, busyChanged }: { created: (id: string, notice: string) => void; close: () => void; busyChanged: (busy: boolean) => void }) {
  const [form, setForm] = useState(emptyCompany); const [requestId, setRequestId] = useState(""); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { busyChanged(busy); return () => busyChanged(false); }, [busy, busyChanged]);
  function input(key: keyof CompanyInput, label: string, type = "text", required = false) {
    return <label>{label}<input type={type} required={required} maxLength={254} value={String(form[key])} disabled={busy} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  }
  return <section><button className="ghost-button" type="button" disabled={busy} onClick={() => { if (window.confirm("Firmenanlage abbrechen und Eingaben verwerfen?")) close(); }}><ArrowLeft size={18}/>Firmenübersicht</button><h2>Neue Firma</h2>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(""); setStatus("");
      const id = requestId || crypto.randomUUID(); setRequestId(id);
      try {
        const result = await administrationRequest("/api/administration/companies", "POST", { requestId: id, company: form });
        const message = result.sent ? "Firma angelegt und Eigentümer eingeladen." : `Firma angelegt. ${result.error || "Einladung konnte nicht versandt werden. Bitte erneut senden."}`;
        setRequestId(""); setForm(emptyCompany()); created(result.tenantId, message);
      } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
    }}>
      <div className="administration-grid">
        {input("name", "Firmenname", "text", true)}{input("ownerEmail", "Eigentümer-E-Mail", "email", true)}
        <label>Land<select value={form.country} disabled={busy} onChange={e => setForm({ ...form, country: e.target.value })}>{[["SE", "Schweden"], ["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"], ["GB", "Großbritannien"], ["US", "USA"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Sprache<select value={form.locale} disabled={busy} onChange={e => setForm({ ...form, locale: e.target.value as CompanyInput["locale"] })}><option value="de">Deutsch</option><option value="sv">Svenska</option><option value="en">English</option></select></label>
        {input("timezone", "Zeitzone", "text", true)}{input("organizationNumber", "Organisationsnummer")}{input("vatNumber", "USt-ID")}
        <label>Kontotyp<select aria-label="Kontotyp" value={form.accountType} disabled={busy} onChange={e => setForm({ ...form, accountType: e.target.value as CompanyInput["accountType"] })}><option value="production">Produktion</option><option value="pilot">Testkonto</option><option value="demo">Demo</option></select></label>
        {form.accountType === "pilot" && <>{input("pilotStartDate", "Testbeginn", "date", true)}{input("pilotEndDate", "Testende", "date")}</>}
        {input("contactPerson", "Ansprechpartner")}{input("internalLabel", "Interne Bezeichnung")}
        <label>Maximale Benutzerzahl<input type="number" min={1} max={100000} step={1} placeholder="Unbegrenzt" value={form.userLimit ?? ""} disabled={busy} onChange={event => setForm({ ...form, userLimit: event.target.value === "" ? null : Number(event.target.value) })}/></label>
      </div>
      <fieldset className="administration-modules"><legend>Module</legend>{companyModules.map(module => <label key={module}><input type="checkbox" disabled={busy} checked={form.modules.includes(module)} onChange={e => setForm({ ...form, modules: e.target.checked ? [...form.modules, module] : form.modules.filter(m => m !== module) })} />{moduleNames[module]}</label>)}</fieldset>
      <label>Interne Notizen<textarea maxLength={4000} rows={3} value={form.notes} disabled={busy} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <button className="ghost-button" type="submit" disabled={busy}><Plus size={18} />Firma anlegen</button>
    </form>
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
  </section>;
}


export function AdministrationWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [brandingDirty, setBrandingDirty] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [data, setData] = useState<AdministrationData | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [tab, setTab] = useState("Firmen");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (message?: string) => {
    try { setData(await administrationRequest("/api/administration", "GET")); setError(""); if (message) setNotice(message); } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void administrationRequest("/api/administration", "GET").then(result => { if (!cancelled) setData(result); })
      .catch(cause => { if (!cancelled) setError((cause as Error).message); });
    return () => { cancelled = true; };
  }, []);
  const tabs = data ? [(data.canManageCompany || data.canManageMembers || data.platformAdmin) && "Firmen", data.canManageCompany && "System / Branding", data.canManageRoles && "Rollen", data.canManageCompany && "Module", data.canManageCompany && "Feedback"].filter(Boolean) as string[] : [];
  const selected = tabs.includes(tab) ? tab : tabs[0];
  return <section className={embedded ? "administration-shell administration-embedded panel" : "administration-shell"}>
    {!embedded && <header className="administration-page-header"><Link className="ghost-button" href="/"><ArrowLeft size={18} />WorkCore</Link><TenantSwitcher /><EmployeeLogoutButton /></header>}
    <h1>Administration</h1>
    {error && <div role="alert"><p>{error}</p><button className="ghost-button" type="button" onClick={() => void refresh()}><RefreshCw size={18} />Erneut laden</button></div>}
    {!data && !error && <p role="status">Wird geladen …</p>}
    {notice && <p role="status">{notice}</p>}
    {data && !data.platformAdmin && <section><p role="alert">Die globale Administration ist nur für freigeschaltete Plattformadministratoren bei Kolaretorp Service AB verfügbar.</p><Link href="/?masterData=users" className="ghost-button">Benutzer in den Stammdaten verwalten</Link></section>}
    {data?.platformAdmin && <><nav className="administration-tabs" aria-label="Administration">{tabs.map(t => <button key={t} className={selected === t ? "active" : ""} type="button" disabled={companyBusy || (brandingBusy && selected === "System / Branding" && t !== selected)} onClick={() => {
      if (t === selected) return;
      if (selected === "System / Branding" && brandingDirty && !window.confirm("Ungespeicherte Branding-Änderungen verwerfen?")) return;
      setBrandingDirty(false); setBrandingBusy(false); setTab(t);
    }}>{t}</button>)}</nav>
      {selected === "System / Branding" && data.canManageCompany && <BrandingSettings dirtyChanged={setBrandingDirty} busyChanged={setBrandingBusy}/>}
      {selected === "Firmen" && <CompanyDirectory renderUsers={id => <CompanyUsers key={id} tenantId={id}/>} renderCreate={(created, close) => <CompanyOnboarding created={created} close={close} busyChanged={setCompanyBusy}/>}/>}
      {selected === "Rollen" && <section><h2>Rollen & Berechtigungen</h2><div className="administration-role-grid">{data.roles.map(role => <article key={role.id}><h3><Shield size={18} />{roleNames[role.key] ?? role.name}</h3>{Object.entries(permissionDomains).map(([domain, permissions]) => {
        const effective = permissions.filter(p => role.permissions.includes(p));
        return effective.length ? <div key={domain}><h4>{domain}</h4><ul>{effective.map(p => <li key={p}><Check size={14} />{permissionNames[p] ?? p}</li>)}</ul></div> : null;
      })}</article>)}</div></section>}
      {selected === "Module" && <section><h2>Module</h2><fieldset className="administration-modules"><legend>Aktive Module</legend>{companyModules.map(module => <label key={module}><input type="checkbox" disabled={busy} checked={data.modules.some(m => m.module === module && m.enabled)} onChange={async e => {
        setBusy(true); setNotice(""); try { await administrationRequest("/api/administration/modules", "PATCH", { module, enabled: e.target.checked }); await refresh("Modulauswahl gespeichert."); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
      }} />{moduleNames[module]}</label>)}<label><input type="checkbox" checked disabled/>Administration</label></fieldset></section>}
      {selected === "Feedback" && data.canManageCompany && <section aria-label="Feedback"><header className="administration-section-header"><div><h2>Feedback</h2><p>{data.company.name}</p></div><button type="button" className="ghost-button icon-button" title="Feedback aktualisieren" aria-label="Feedback aktualisieren" onClick={() => void refresh()}><RefreshCw size={18}/></button></header>{data.feedback.map(f => <article className="administration-feedback" key={f.id}><h3>{categoryNames[f.category]} · {new Date(f.created_at).toLocaleDateString("de-DE")}</h3><p>{f.message}</p></article>)}{!data.feedback.length && <p>Noch kein Feedback vorhanden.</p>}</section>}
    </>}
  </section>;
}
