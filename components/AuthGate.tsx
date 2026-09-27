"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Building2, LogIn } from "lucide-react";
import type { AuthContextPayload } from "@/lib/authModel";
import { activeTenantStorageKey, apiFetch } from "@/lib/apiClient";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export function AuthGate({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  async function establishContext() {
    if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") {
      window.localStorage.setItem(activeTenantStorageKey, "00000000-0000-0000-0000-000000000001");
      setReady(true);
      setBusy(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    if (!session) {
      setReady(false);
      setBusy(false);
      return;
    }
    const response = await apiFetch("/api/auth/context");
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Mandantenzugriff konnte nicht geladen werden.");
    const context = await response.json() as AuthContextPayload;
    if (context.memberships.length === 0) throw new Error("Für dieses Konto ist keine aktive Firma zugeordnet.");
    const current = window.localStorage.getItem(activeTenantStorageKey);
    if (!current || !context.memberships.some((item) => item.tenantId === current)) {
      window.localStorage.setItem(activeTenantStorageKey, context.memberships[0].tenantId);
    }
    setReady(true);
    setBusy(false);
  }

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void establishContext().catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Anmeldung konnte nicht geprüft werden.");
        setBusy(false);
      });
    }, 0);
    const client = getSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange(() => {
      setBusy(true);
      void establishContext().catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Anmeldung konnte nicht geprüft werden.");
        setReady(false);
        setBusy(false);
      });
    }).data.subscription;
    return () => {
      window.clearTimeout(initialCheck);
      subscription?.unsubscribe();
    };
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
    await establishContext().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Firmenzugriff konnte nicht geladen werden.");
      setReady(false);
      setBusy(false);
    });
  }

  if (ready) return children;
  return (
    <main className="app auth-app" data-ready="false">
      <section className="auth-shell">
        <div className="auth-brand"><Building2 size={28} /><strong>WorkCore</strong></div>
        <section className="panel auth-panel">
          <div><p>Anmeldung</p><h1>Willkommen zurück</h1><span>Melde dich mit deinem persönlichen Firmenkonto an.</span></div>
          <label><span>E-Mail</span><input autoComplete="email" disabled={busy} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
          <label><span>Passwort</span><input autoComplete="current-password" disabled={busy} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void signIn()} type="password" value={password} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy || !email.trim() || !password} onClick={() => void signIn()} type="button"><LogIn size={16} />{busy ? "Wird geprüft ..." : "Anmelden"}</button>
        </section>
      </section>
    </main>
  );
}
