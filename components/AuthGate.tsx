"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Building2, LogIn, LogOut } from "lucide-react";
import type { AuthContextPayload } from "@/lib/authModel";
import { activeTenantStorageKey, apiFetch } from "@/lib/apiClient";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuthActions = {
  busy: boolean;
  signOut: () => Promise<void>;
};

type SessionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const AuthActionsContext = createContext<AuthActions | null>(null);

export function clearEmployeeSessionContext(storage: SessionStorage) {
  storage.removeItem(activeTenantStorageKey);
}

export function resolveEmployeeTenantId(memberships: TenantMembershipLike[], currentTenantId: string | null) {
  if (currentTenantId && memberships.some((membership) => membership.tenantId === currentTenantId)) return currentTenantId;
  return memberships[0]?.tenantId ?? "";
}

type TenantMembershipLike = Pick<AuthContextPayload["memberships"][number], "tenantId">;

export function EmployeeLogoutButton() {
  const auth = useContext(AuthActionsContext);
  if (!auth) return null;
  return (
    <button
      aria-label="Abmelden"
      className="ghost-button app-toolbar-logout"
      disabled={auth.busy}
      onClick={() => void auth.signOut()}
      type="button"
    >
      <LogOut size={16} />
      Abmelden
    </button>
  );
}

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
    const tenantId = resolveEmployeeTenantId(context.memberships, window.localStorage.getItem(activeTenantStorageKey));
    window.localStorage.setItem(activeTenantStorageKey, tenantId);
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

  async function signOut() {
    setBusy(true);
    setError("");
    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase Auth ist nicht konfiguriert.");
      setBusy(false);
      return;
    }
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setError("Abmeldung ist fehlgeschlagen. Bitte erneut versuchen.");
      setBusy(false);
      return;
    }
    clearEmployeeSessionContext(window.localStorage);
    setReady(false);
    setBusy(false);
  }

  if (ready) return <AuthActionsContext.Provider value={{ busy, signOut }}>{children}</AuthActionsContext.Provider>;
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
