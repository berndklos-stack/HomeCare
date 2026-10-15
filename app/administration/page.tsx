"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Mail, Plus, RefreshCw, Shield, UserMinus, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { AuthGate, EmployeeLogoutButton } from "@/components/AuthGate";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { apiFetch } from "@/lib/apiClient";
import { companyModules, permissionDomains, type AdministrationData, type AdministrationMember, type CompanyInput } from "@/lib/administration";

const roleNames: Record<string, string> = { owner: "Eigentümer", admin: "Administrator", manager: "Leitung", office: "Büro", field_worker: "Außendienst" };
const statusNames: Record<string, string> = { active: "Aktiv", suspended: "Deaktiviert", revoked: "Zugang entzogen", pending: "Einladung vorbereitet", sent: "Einladung versandt", failed: "Versand fehlgeschlagen", accepted: "Angenommen", legacy: "Altbestand" };
const moduleNames: Record<string, string> = { jobs: "Aufträge", reports: "Berichte", time_tracking: "Zeiterfassung", billing: "Abrechnung", inventory: "Lager & Material", logbook: "Fahrtenbuch", customer_portal: "Kundenportal", dispatch: "Einsatzplanung", documents: "Dokumente", ai: "KI", integrations: "Integrationen" };
const categoryNames: Record<string, string> = { problem: "Problem", improvement: "Verbesserung", feature: "Funktionswunsch" };
const permissionNames: Record<string, string> = { "data.read": "Daten lesen", "data.write": "Allgemeine Daten bearbeiten", "sync.write": "Synchronisieren", "customers.manage": "Kunden verwalten", "objects.manage": "Objekte verwalten", "jobs.manage": "Aufträge und Berichte bearbeiten", "resources.manage": "Ressourcen verwalten", "invoices.manage": "Abrechnung verwalten", "media.manage": "Medien verwalten", "communication.send": "Nachrichten versenden", "tenant.admin": "Firma verwalten", "backups.manage": "Sicherungen verwalten", "members.manage": "Benutzer verwalten", "roles.manage": "Rollen verwalten" };

async function administrationRequest(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Vorgang fehlgeschlagen.");
  return result;
}

function InviteDialog({ data, close, saved }: { data: AdministrationData; close: () => void; saved: (notice: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(data.roles.find(r => r.key === "field_worker")?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="administration-invite" onCancel={event => { event.preventDefault(); if (!busy) close(); }} aria-labelledby="invite-heading">
    <header><h2 id="invite-heading">Benutzer einladen</h2><button type="button" className="ghost-button icon-button" aria-label="Schließen" disabled={busy} onClick={close}><X size={18} /></button></header>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const result = await administrationRequest("/api/administration", "POST", { email, roleId, employeeId: employeeId || null });
        await saved(result.sent ? "Einladung versandt." : result.error); close();
      } catch (cause) { setError((cause as Error).message); setBusy(false); }
    }}>
      <label>E-Mail<input autoFocus required type="email" maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></label>
      <label>Rolle<select value={roleId} disabled={busy} onChange={e => setRoleId(e.target.value)}>{data.roles.filter(r => data.owner || r.key !== "owner").map(r => <option key={r.id} value={r.id}>{roleNames[r.key] ?? r.name}</option>)}</select></label>
      <label>Mitarbeiter (optional)<select value={employeeId} disabled={busy} onChange={e => setEmployeeId(e.target.value)}><option value="">Nicht verknüpft</option>{data.employees.filter(e => !e.assignedUserId && !data.members.some(m => m.employee_id === e.id)).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      <footer><button className="ghost-button" type="button" disabled={busy} onClick={close}>Abbrechen</button><button className="primary-button" type="submit" disabled={busy || !roleId}><Mail size={16} />Einladen</button></footer>
    </form>
  </dialog>;
}

function UserAdministration({ data, refresh }: { data: AdministrationData; refresh: (notice?: string) => Promise<void> }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [role, setRole] = useState("");
  const [invite, setInvite] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const queryKey = new URLSearchParams({ search, status, role, page: String(page) }).toString();
  const [directory, setDirectory] = useState({ members: data.members, total: data.memberTotal ?? data.members.length, key: new URLSearchParams({ search: "", status: "", role: "", page: "0" }).toString() });
  const loading = directory.key !== queryKey;
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void apiFetch(`/api/administration?${queryKey}`, { signal: controller.signal }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Benutzer konnten nicht geladen werden.");
        if (!controller.signal.aborted) setDirectory({ members: result.members, total: result.memberTotal ?? result.members.length, key: queryKey });
      }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [queryKey, data]);
  async function change(member: AdministrationMember, action: string, values = {}) {
    if ((action === "remove" || action === "suspend") && !window.confirm(action === "remove" ? `Firmenzugang von ${member.email} entziehen?` : `Firmenzugang von ${member.email} deaktivieren?`)) return;
    setBusy(true); setError("");
    try {
      const result = await administrationRequest("/api/administration", "PATCH", { memberId: member.id, action, ...values });
      await refresh(result.sent === false ? result.error : "Änderung gespeichert.");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const members = loading ? [] : directory.members;
  return <section aria-label="Benutzerverwaltung">
    <header className="administration-section-header"><h2>Benutzer</h2><button className="ghost-button" type="button" onClick={() => setInvite(true)}><Plus size={18} />Benutzer einladen</button></header>
    <div className="administration-filters"><label>Suche<input type="search" maxLength={120} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Alle</option>{["active", "suspended", "revoked"].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></label><label>Rolle<select value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="">Alle</option>{data.roles.map(r => <option key={r.id} value={r.id}>{roleNames[r.key] ?? r.name}</option>)}</select></label></div>
    {error && <p role="alert">{error}</p>}
    <div className="administration-users">
      {members.map(member => {
        const pending = member.invitation && ["pending", "sent", "failed"].includes(member.invitation.delivery_status);
        const isOwner = data.roles.find(r => r.id === member.role_id)?.key === "owner";
        const disabled = busy || (isOwner && !data.owner);
        return <article className="administration-user" key={member.id}>
          <div><h3>{member.name || member.email}</h3>{member.name && <p>{member.email}</p>}<p>{data.company.name} · {pending ? statusNames[member.invitation!.delivery_status] : statusNames[member.status]}</p><small>Letzte Anmeldung: {member.lastLogin ? new Date(member.lastLogin).toLocaleString("de-DE") : "Noch keine"}</small></div>
          <label>Rolle<select aria-label={`Rolle für ${member.email}`} value={member.role_id} disabled={disabled || member.status === "revoked"} onChange={e => void change(member, "role", { roleId: e.target.value })}>{data.roles.filter(r => data.owner || r.key !== "owner" || r.id === member.role_id).map(r => <option key={r.id} value={r.id}>{roleNames[r.key] ?? r.name}</option>)}</select></label>
          <label>Mitarbeiter<select aria-label={`Mitarbeiter für ${member.email}`} disabled={disabled || member.status === "revoked"} value={member.employee_id ?? ""} onChange={e => void change(member, "employee", { employeeId: e.target.value || null })}><option value="">Nicht verknüpft</option>{member.employee_id && !data.employees.some(e => e.id === member.employee_id) && <option value={member.employee_id}>Archivierte Zuordnung</option>}{data.employees.filter(e => e.id === member.employee_id || (!e.assignedUserId && !data.members.some(m => m.employee_id === e.id))).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></label>
          <div className="administration-user-actions">
            {pending && <button type="button" className="ghost-button icon-button" title="Einladung erneut senden" aria-label={`Einladung erneut senden an ${member.email}`} disabled={disabled} onClick={() => void change(member, "resend")}><Mail size={18} /></button>}
            {!pending && member.status === "suspended" && <button type="button" className="ghost-button icon-button" title="Reaktivieren" aria-label={`Reaktivieren: ${member.email}`} disabled={disabled} onClick={() => void change(member, "reactivate")}><UserRoundCheck size={18} /></button>}
            {member.status === "active" && <button type="button" className="ghost-button icon-button" title="Deaktivieren" aria-label={`Deaktivieren: ${member.email}`} disabled={disabled} onClick={() => void change(member, "suspend")}><UserRoundX size={18} /></button>}
            {member.status !== "revoked" && <button type="button" className="ghost-button icon-button" title="Firmenzugang entziehen" aria-label={`Firmenzugang entziehen: ${member.email}`} disabled={disabled} onClick={() => void change(member, "remove")}><UserMinus size={18} /></button>}
          </div>
        </article>;
      })}
      {loading ? <p role="status">Benutzer werden geladen …</p> : !members.length && <p>Keine Benutzer gefunden.</p>}
    </div>
    {!loading && directory.total > 50 && <div className="administration-pagination"><button type="button" className="ghost-button icon-button" aria-label="Vorherige Seite" title="Vorherige Seite" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}><ArrowLeft size={18} /></button><span>{page + 1} / {Math.ceil(directory.total / 50)}</span><button type="button" className="ghost-button icon-button" aria-label="Nächste Seite" title="Nächste Seite" disabled={(page + 1) * 50 >= directory.total || busy} onClick={() => setPage(page + 1)}><ArrowRight size={18} /></button></div>}
    {invite && <InviteDialog data={data} close={() => setInvite(false)} saved={refresh} />}
  </section>;
}

const emptyCompany = (): CompanyInput => ({ name: "", country: "SE", locale: "de", timezone: "Europe/Stockholm", organizationNumber: "", vatNumber: "", ownerEmail: "", accountType: "pilot", pilotStartDate: new Date().toISOString().slice(0, 10), pilotEndDate: "", contactPerson: "", internalLabel: "", notes: "", modules: ["jobs", "reports", "time_tracking", "documents"] });

function CompanyOnboarding() {
  const [form, setForm] = useState(emptyCompany); const [requestId, setRequestId] = useState(""); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string; account_type: string; email: string }[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setCompanies((await administrationRequest("/api/administration/companies", "GET")).companies); } catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function input(key: keyof CompanyInput, label: string, type = "text", required = false) {
    return <label>{label}<input type={type} required={required} maxLength={254} value={String(form[key])} disabled={busy} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  }
  return <section><h2>Pilot/Test</h2>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(""); setStatus("");
      const id = requestId || crypto.randomUUID(); setRequestId(id);
      try {
        const result = await administrationRequest("/api/administration/companies", "POST", { requestId: id, company: form });
        setStatus(result.sent ? "Firma angelegt und Eigentümer eingeladen." : result.error);
        setRequestId(""); setForm(emptyCompany()); await load();
      } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
    }}>
      <div className="administration-grid">
        {input("name", "Firmenname", "text", true)}{input("ownerEmail", "Eigentümer-E-Mail", "email", true)}
        <label>Land<select value={form.country} disabled={busy} onChange={e => setForm({ ...form, country: e.target.value })}>{[["SE", "Schweden"], ["DE", "Deutschland"], ["AT", "Österreich"], ["CH", "Schweiz"], ["GB", "Großbritannien"], ["US", "USA"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label>Sprache<select value={form.locale} disabled={busy} onChange={e => setForm({ ...form, locale: e.target.value as CompanyInput["locale"] })}><option value="de">Deutsch</option><option value="sv">Svenska</option><option value="en">English</option></select></label>
        {input("timezone", "Zeitzone", "text", true)}{input("organizationNumber", "Organisationsnummer")}{input("vatNumber", "USt-ID")}
        <label>Kontotyp<select value={form.accountType} disabled={busy} onChange={e => setForm({ ...form, accountType: e.target.value as CompanyInput["accountType"] })}><option value="production">Produktion</option><option value="pilot">Pilot</option><option value="demo">Demo</option></select></label>
        {form.accountType === "pilot" && <>{input("pilotStartDate", "Pilotbeginn", "date", true)}{input("pilotEndDate", "Pilotende", "date")}</>}
        {input("contactPerson", "Ansprechpartner")}{input("internalLabel", "Interne Bezeichnung")}
      </div>
      <fieldset className="administration-modules"><legend>Module</legend>{companyModules.map(module => <label key={module}><input type="checkbox" disabled={busy} checked={form.modules.includes(module)} onChange={e => setForm({ ...form, modules: e.target.checked ? [...form.modules, module] : form.modules.filter(m => m !== module) })} />{moduleNames[module]}</label>)}</fieldset>
      <label>Interne Notizen<textarea maxLength={4000} rows={3} value={form.notes} disabled={busy} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <button className="ghost-button" type="submit" disabled={busy}><Plus size={18} />Firma anlegen</button>
    </form>
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    <h3>Angelegte Firmen</h3>{companies.map(company => <div className="administration-company-row" key={company.id}><div><strong>{company.name}</strong><p>{company.account_type} · {company.email}</p></div><button type="button" className="ghost-button icon-button" title="Eigentümereinladung erneut senden" aria-label={`Einladung erneut senden: ${company.name}`} disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const result = await administrationRequest("/api/administration/companies", "PATCH", { tenantId: company.id }); setStatus(result.sent ? "Einladung erneut versandt." : result.error); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}><Mail size={18} /></button></div>)}
  </section>;
}

function AdministrationWorkspace() {
  const [data, setData] = useState<AdministrationData | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [tab, setTab] = useState("Firma");
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
  const tabs = data ? [data.canManageCompany && "Firma", data.canManageMembers && "Benutzer", data.canManageRoles && "Rollen", data.canManageCompany && "Module", (data.canManageCompany || data.platformAdmin) && "Pilot/Test"].filter(Boolean) as string[] : [];
  const selected = tabs.includes(tab) ? tab : tabs[0];
  return <main className="administration-shell">
    <header className="administration-page-header"><Link className="ghost-button" href="/"><ArrowLeft size={18} />WorkCore</Link><TenantSwitcher /><EmployeeLogoutButton /></header>
    <h1>Administration</h1>
    {error && <div role="alert"><p>{error}</p><button className="ghost-button" type="button" onClick={() => void refresh()}><RefreshCw size={18} />Erneut laden</button></div>}
    {!data && !error && <p role="status">Wird geladen …</p>}
    {notice && <p role="status">{notice}</p>}
    {data && <><nav className="administration-tabs" aria-label="Administration">{tabs.map(t => <button key={t} className={selected === t ? "active" : ""} type="button" onClick={() => setTab(t)}>{t}</button>)}</nav>
      {selected === "Firma" && <section><h2>{data.company.name}</h2><dl className="administration-grid">{[["Land", "country_code"], ["Sprache", "locale"], ["Zeitzone", "timezone"], ["Organisationsnummer", "organization_number"], ["USt-ID", "vat_number"], ["Kontotyp", "account_type"]].map(([title, key]) => <div key={key}><dt>{title}</dt><dd>{data.company[key] || "—"}</dd></div>)}</dl></section>}
      {selected === "Benutzer" && <UserAdministration data={data} refresh={refresh} />}
      {selected === "Rollen" && <section><h2>Rollen & Berechtigungen</h2><div className="administration-role-grid">{data.roles.map(role => <article key={role.id}><h3><Shield size={18} />{roleNames[role.key] ?? role.name}</h3>{Object.entries(permissionDomains).map(([domain, permissions]) => {
        const effective = permissions.filter(p => role.permissions.includes(p));
        return effective.length ? <div key={domain}><h4>{domain}</h4><ul>{effective.map(p => <li key={p}><Check size={14} />{permissionNames[p] ?? p}</li>)}</ul></div> : null;
      })}</article>)}</div></section>}
      {selected === "Module" && <section><h2>Module</h2><fieldset className="administration-modules"><legend>Aktive Module</legend>{companyModules.map(module => <label key={module}><input type="checkbox" disabled={busy} checked={data.modules.some(m => m.module === module && m.enabled)} onChange={async e => {
        setBusy(true); setNotice(""); try { await administrationRequest("/api/administration/modules", "PATCH", { module, enabled: e.target.checked }); await refresh("Modulauswahl gespeichert."); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
      }} />{moduleNames[module]}</label>)}</fieldset></section>}
      {selected === "Pilot/Test" && <>{data.canManageCompany && <dl className="administration-grid">{[["Kontotyp", "account_type"], ["Pilotbeginn", "pilot_start_date"], ["Pilotende", "pilot_end_date"], ["Ansprechpartner", "contact_person"], ["Interne Bezeichnung", "internal_label"], ["Interne Notizen", "administration_notes"]].map(([title, key]) => <div key={key}><dt>{title}</dt><dd>{data.company[key] || "—"}</dd></div>)}</dl>}{data.platformAdmin && <CompanyOnboarding />}{data.canManageCompany && <section><h2>Feedback</h2>{data.feedback.map(f => <article className="administration-feedback" key={f.id}><h3>{categoryNames[f.category]} · {new Date(f.created_at).toLocaleDateString("de-DE")}</h3><p>{f.message}</p><details><summary>Technischer Kontext</summary><p>Version {f.app_version} · {f.page_path}</p><p>{f.user_agent}</p></details></article>)}{!data.feedback.length && <p>Noch kein Feedback vorhanden.</p>}</section>}</>}
    </>}
  </main>;
}
export default function AdministrationPage() { return <AuthGate><AdministrationWorkspace /></AuthGate>; }
