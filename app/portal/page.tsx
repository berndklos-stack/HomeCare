"use client";

import { useEffect, useState } from "react";
import { Building2, FileText, LogIn, LogOut, MessageSquare } from "lucide-react";
import { activeTenantStorageKey, apiFetch } from "@/lib/apiClient";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type PortalData = {
  billing: Array<{ due_date?: string; invoice_number?: string; invoice_status?: string; label: string }>;
  customer: { email?: string; id: string; name: string };
  jobs: Array<{ due_date?: string; id: string; status: string; title: string }>;
  messages: Array<{ created_at?: string; id: string; message: string; subject: string }>;
  objects: Array<{ address?: string; id: string; name: string }>;
  reports: Array<{ id: string; report_date?: string; summary?: string; title: string }>;
  tenant: { id: string; name: string };
};

export default function PortalPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function loadPortal() {
    const client = getSupabaseBrowserClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) {
      setData(null);
      setBusy(false);
      return;
    }
    const contextResponse = await apiFetch("/api/auth/context");
    if (!contextResponse.ok) throw new Error("Portalzugang konnte nicht geprüft werden.");
    const context = await contextResponse.json() as { portalAccess?: Array<{ tenantId: string }> };
    const tenantId = context.portalAccess?.[0]?.tenantId;
    if (!tenantId) throw new Error("Für dieses Konto ist kein Kundenportal freigeschaltet.");
    window.localStorage.setItem(activeTenantStorageKey, tenantId);
    const response = await apiFetch("/api/portal/context");
    const payload = await response.json().catch(() => ({})) as PortalData & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Portaldaten konnten nicht geladen werden.");
    setData(payload);
    setBusy(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPortal().catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Portalzugang konnte nicht geladen werden.");
        setBusy(false);
      });
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase Auth ist nicht konfiguriert.");
      setBusy(false);
      return;
    }
    const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError("E-Mail oder Passwort ist nicht korrekt.");
      setBusy(false);
      return;
    }
    await loadPortal().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Portalzugang konnte nicht geladen werden.");
      setBusy(false);
    });
  }

  async function signOut() {
    await getSupabaseBrowserClient()?.auth.signOut();
    window.localStorage.removeItem(activeTenantStorageKey);
    setData(null);
  }

  if (!data) {
    return <main className="app auth-app" data-ready={!busy}>
      <section className="auth-shell">
        <div className="auth-brand"><Building2 size={28} /><strong>WorkCore Portal</strong></div>
        <section className="panel auth-panel">
          <div><p>Kundenportal</p><h1>Sicher anmelden</h1><span>Der Zugriff gilt nur für die ausdrücklich zugeordneten Kundendaten.</span></div>
          <label><span>E-Mail</span><input autoComplete="email" disabled={busy} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
          <label><span>Passwort</span><input autoComplete="current-password" disabled={busy} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void signIn()} type="password" value={password} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy || !email.trim() || !password} onClick={() => void signIn()} type="button"><LogIn size={16} />{busy ? "Wird geprüft ..." : "Anmelden"}</button>
        </section>
      </section>
    </main>;
  }

  return <main className="app portal-app" data-ready="true">
    <section className="workspace portal-workspace">
      <header className="topbar portal-topbar"><div><p>Kundenportal</p><h1>{data.tenant.name}</h1><span>{data.customer.name}</span></div><button className="ghost-button" onClick={() => void signOut()} type="button"><LogOut size={16} />Abmelden</button></header>
      <section className="layout full"><div className="main-panel portal-grid">
        <section className="panel"><div className="panel-title"><div><p>Objekte</p><h2>Deine Standorte</h2></div></div><div className="table-list">{data.objects.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.address || "Keine Adresse"}</span></div></article>)}</div></section>
        <section className="panel"><div className="panel-title"><div><p>Aufträge</p><h2>Aktueller Stand</h2></div></div><div className="table-list">{data.jobs.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.status} · {item.due_date || "ohne Termin"}</span></div></article>)}</div></section>
        <section className="panel"><div className="panel-title"><div><p>Dokumentation</p><h2>Freigegebene Berichte</h2></div></div><div className="table-list">{data.reports.map((item) => <article key={item.id}><FileText size={17} /><div><strong>{item.title}</strong><span>{item.report_date || ""}</span><small>{item.summary || ""}</small></div></article>)}</div></section>
        <section className="panel"><div className="panel-title"><div><p>Kommunikation</p><h2>Nachrichten</h2></div></div><div className="table-list">{data.messages.map((item) => <article key={item.id}><MessageSquare size={17} /><div><strong>{item.subject}</strong><span>{item.created_at || ""}</span><small>{item.message}</small></div></article>)}</div></section>
      </div></section>
    </section>
  </main>;
}
