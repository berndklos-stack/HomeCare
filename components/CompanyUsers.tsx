"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Mail, Plus, UserMinus, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { AdministrationData, AdministrationMember } from "@/lib/administration";

const roleNames: Record<string, string> = { owner: "Eigentümer", admin: "Administrator", manager: "Leitung", office: "Büro", field_worker: "Außendienst" };
const statusNames: Record<string, string> = { active: "Aktiv", suspended: "Deaktiviert", revoked: "Zugang entzogen", pending: "Einladung vorbereitet", sent: "Einladung versandt", failed: "Versand fehlgeschlagen", accepted: "Angenommen", legacy: "Altbestand" };

async function administrationRequest(path: string, method: string, body?: unknown) {
  const response = await apiFetch(path, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Vorgang fehlgeschlagen.");
  return result;
}

function InviteDialog({ data, close, saved, tenantId }: { data: AdministrationData; close: () => void; saved: (notice: string) => Promise<void>; tenantId?: string }) {
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
        const result = await administrationRequest("/api/administration", "POST", { email, roleId, employeeId: employeeId || null, ...(tenantId ? { tenantId } : {}) });
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

function activeMember(member: AdministrationMember) {
  return member.status === "active" && !["pending", "sent", "failed"].includes(member.invitation?.delivery_status ?? "");
}

function UserAdministration({ data, refresh, tenantId }: { data: AdministrationData; refresh: (notice?: string) => Promise<void>; tenantId?: string }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [role, setRole] = useState("");
  const [invite, setInvite] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const queryKey = new URLSearchParams({ search, status, role, page: String(page), ...(tenantId ? { tenantId } : {}) }).toString();
  const [directory, setDirectory] = useState({ members: data.members, total: data.memberTotal ?? data.members.length, key: new URLSearchParams({ search: "", status: "", role: "", page: "0", ...(tenantId ? { tenantId } : {}) }).toString() });
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
      const result = await administrationRequest("/api/administration", "PATCH", { memberId: member.id, action, ...values, ...(tenantId ? { tenantId } : {}) });
      await refresh(result.sent === false ? result.error : action === "resetPassword" ? "E-Mail zum Passwort-Reset versandt." : "Änderung gespeichert.");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const members = loading ? [] : directory.members;
  const atLimit = data.userLimit != null && (data.userCount ?? 0) >= data.userLimit;
  return <section aria-label="Benutzerverwaltung">
    <header className="administration-section-header"><h2>Benutzer</h2><button className="ghost-button" type="button" disabled={busy || atLimit} onClick={() => setInvite(true)}><Plus size={18} />Benutzer einladen</button></header>
    <p>{data.userCount ?? data.memberTotal ?? data.members.length} / {data.userLimit ?? "unbegrenzt"} Firmenzugänge</p>
    {atLimit && <p role="status">Benutzerlimit erreicht. Bitte die zentrale Administration kontaktieren.</p>}
    <div className="administration-filters"><label>Suche<input type="search" maxLength={120} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label><label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Alle</option>{["active", "suspended", "revoked"].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select></label><label>Rolle<select value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="">Alle</option>{data.roles.map(r => <option key={r.id} value={r.id}>{roleNames[r.key] ?? r.name}</option>)}</select></label></div>
    {error && <p role="alert">{error}</p>}
    <div className="administration-users">
      {!loading && members.length > 0 && [true, false].map(active => <section className="administration-user-group" aria-label={active ? "Aktive Benutzer" : "Inaktive Benutzer"} key={String(active)}><h3>{active ? "Aktive Benutzer" : "Inaktive Benutzer"}</h3>
      {members.filter(member => activeMember(member) === active).map(member => {
        const pending = member.invitation && ["pending", "sent", "failed"].includes(member.invitation.delivery_status);
        const isOwner = data.roles.find(r => r.id === member.role_id)?.key === "owner";
        const disabled = busy || (isOwner && !data.owner);
        return <article className="administration-user" key={member.id}>
          <div><h3>{member.name || member.email}</h3>{member.name && <p>{member.email}</p>}<p>{data.company.name} · {pending ? statusNames[member.invitation!.delivery_status] : statusNames[member.status]}</p><small>Letzte Anmeldung: {member.lastLogin ? new Date(member.lastLogin).toLocaleString("de-DE") : "Noch keine"}</small></div>
          <label>Rolle<select aria-label={`Rolle für ${member.email}`} value={member.role_id} disabled={disabled || member.status === "revoked"} onChange={e => void change(member, "role", { roleId: e.target.value })}>{data.roles.filter(r => data.owner || r.key !== "owner" || r.id === member.role_id).map(r => <option key={r.id} value={r.id}>{roleNames[r.key] ?? r.name}</option>)}</select></label>
          <label>Mitarbeiter<select aria-label={`Mitarbeiter für ${member.email}`} disabled={disabled || member.status === "revoked"} value={member.employee_id ?? ""} onChange={e => void change(member, "employee", { employeeId: e.target.value || null })}><option value="">Nicht verknüpft</option>{member.employee_id && !data.employees.some(e => e.id === member.employee_id) && <option value={member.employee_id}>Archivierte Zuordnung</option>}{data.employees.filter(e => e.id === member.employee_id || (!e.assignedUserId && !data.members.some(m => m.employee_id === e.id))).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></label>
          <div className="administration-user-actions">
            {!pending && member.status !== "revoked" && <button type="button" className="ghost-button icon-button" title="Passwort zurücksetzen" aria-label={`Passwort zurücksetzen: ${member.email}`} disabled={disabled} onClick={() => { if (window.confirm(`Einen sicheren Passwort-Reset-Link an ${member.email} senden?`)) void change(member, "resetPassword"); }}><KeyRound size={18}/></button>}
            {pending && <button type="button" className="ghost-button icon-button" title="Einladung erneut senden" aria-label={`Einladung erneut senden an ${member.email}`} disabled={disabled} onClick={() => void change(member, "resend")}><Mail size={18} /></button>}
            {!pending && member.status === "suspended" && <button type="button" className="ghost-button icon-button" title="Reaktivieren" aria-label={`Reaktivieren: ${member.email}`} disabled={disabled} onClick={() => void change(member, "reactivate")}><UserRoundCheck size={18} /></button>}
            {member.status === "active" && <button type="button" className="ghost-button icon-button" title="Deaktivieren" aria-label={`Deaktivieren: ${member.email}`} disabled={disabled} onClick={() => void change(member, "suspend")}><UserRoundX size={18} /></button>}
            {member.status !== "revoked" && <button type="button" className="ghost-button icon-button" title="Firmenzugang entziehen" aria-label={`Firmenzugang entziehen: ${member.email}`} disabled={disabled} onClick={() => void change(member, "remove")}><UserMinus size={18} /></button>}
          </div>
        </article>;
      })}
      {!members.some(member => activeMember(member) === active) && <p>Keine {active ? "aktiven" : "inaktiven"} Benutzer auf dieser Seite.</p>}
      </section>)}
      {loading ? <p role="status">Benutzer werden geladen …</p> : !members.length && <p>Keine Benutzer gefunden.</p>}
    </div>
    {!loading && directory.total > 50 && <div className="administration-pagination"><button type="button" className="ghost-button icon-button" aria-label="Vorherige Seite" title="Vorherige Seite" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}><ArrowLeft size={18} /></button><span>{page + 1} / {Math.ceil(directory.total / 50)}</span><button type="button" className="ghost-button icon-button" aria-label="Nächste Seite" title="Nächste Seite" disabled={(page + 1) * 50 >= directory.total || busy} onClick={() => setPage(page + 1)}><ArrowRight size={18} /></button></div>}
    {invite && <InviteDialog data={data} tenantId={tenantId} close={() => setInvite(false)} saved={refresh} />}
  </section>;
}

export function CompanyUsers({ tenantId }: { tenantId?: string }) {
  const [data, setData] = useState<AdministrationData | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const path = tenantId ? `/api/administration?tenantId=${encodeURIComponent(tenantId)}` : "/api/administration";
  const refresh = useCallback(async (message?: string) => {
    const result = await administrationRequest(path, "GET"); setData(result); setError(""); if (message) setNotice(message);
  }, [path]);
  useEffect(() => { const controller = new AbortController(); void apiFetch(path, { signal: controller.signal }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (!controller.signal.aborted) setData(result); }).catch(cause => { if (!controller.signal.aborted) setError(String(cause.message)); }); return () => controller.abort(); }, [path]);
  return <section className="administration-shell company-users-workspace">{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{data ? data.canManageMembers ? <UserAdministration data={data} tenantId={tenantId} refresh={refresh}/> : <p>Keine Berechtigung zur Benutzerverwaltung.</p> : !error && <p role="status">Benutzer werden geladen …</p>}</section>;
}
