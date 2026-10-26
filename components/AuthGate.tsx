"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { Building2, LogIn, LogOut, Mail } from "lucide-react";
import type { AuthContextPayload } from "@/lib/authModel";
import { activateTenant, activeTenantStorageKey, pendingTenantStorageKey, getActiveTenantId, apiFetch } from "@/lib/apiClient";
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

type EmployeeAuthClient = Pick<SupabaseClient, "auth">;

function employeeAuthBypassEnabled() {
  return process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1"
    && (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("workcore-auth-test"));
}

export async function subscribeAfterInitialSession(
  client: EmployeeAuthClient,
  onInitialSession: (session: Session | null) => Promise<void>,
  onAuthChange: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  const subscription = client.auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION") onAuthChange(event, session);
  }).data.subscription;

  await onInitialSession(data.session);
  return subscription;
}

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
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [contextKey, setContextKey] = useState("");
  const currentIdentity = useRef("");

  async function establishContext(providedSession?: Session | null) {
    if (employeeAuthBypassEnabled()) {
      activateTenant("00000000-0000-0000-0000-000000000001");
      setReady(true);
      setCheckingSession(false);
      setBusy(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    const session = providedSession === undefined
      ? client ? (await client.auth.getSession()).data.session : null
      : providedSession;
    if (!session) {
      setReady(false);
      setCheckingSession(false);
      setBusy(false);
      return;
    }
    const response = await apiFetch("/api/auth/context");
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Mandantenzugriff konnte nicht geladen werden.");
    const context = await response.json() as AuthContextPayload;
    if (context.memberships.length === 0) throw new Error("Für dieses Konto ist keine aktive Firma zugeordnet.");
    const lastTenantKey = `workcore-last-tenant:${context.user.id}`;
    const currentTabBelongsToUser = window.sessionStorage.getItem("workcore-active-user-id") === context.user.id;
    const preferred = window.sessionStorage.getItem(pendingTenantStorageKey)
      ?? (currentTabBelongsToUser ? getActiveTenantId() : window.localStorage.getItem(lastTenantKey) ?? getActiveTenantId());
    const tenantId = resolveEmployeeTenantId(context.memberships, preferred);
    activateTenant(tenantId);
    window.sessionStorage.setItem("workcore-active-user-id", context.user.id);
    window.localStorage.setItem(lastTenantKey, tenantId);
    window.sessionStorage.removeItem(pendingTenantStorageKey);
    currentIdentity.current = context.user.id;
    setContextKey(`${context.user.id}:${tenantId}`);
    setError("");
    setReady(true);
    setCheckingSession(false);
    setBusy(false);
  }

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    let cancelled = false;
    let authChangeId: number | undefined;
    let subscription: { unsubscribe: () => void } | undefined;

    function handleAuthChange(_event: AuthChangeEvent, session: Session | null) {
      if (cancelled) return;
      if (!session || session.user.id !== currentIdentity.current) setReady(false);
      if (!session || session.user.id !== currentIdentity.current) setCheckingSession(Boolean(session));
      if (authChangeId) window.clearTimeout(authChangeId);
      authChangeId = window.setTimeout(() => {
        if (cancelled) return;
        setBusy(true);
        void establishContext(session).catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Anmeldung konnte nicht geprüft werden.");
          setReady(false);
          setCheckingSession(false);
          setBusy(false);
        });
      }, 0);
    }

    if (employeeAuthBypassEnabled() || !client) {
      void Promise.resolve().then(() => establishContext()).catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Anmeldung konnte nicht geprüft werden.");
        setCheckingSession(false);
        setBusy(false);
      });
    } else {
      void subscribeAfterInitialSession(client, establishContext, handleAuthChange)
        .then((nextSubscription) => {
          if (cancelled) nextSubscription.unsubscribe();
          else subscription = nextSubscription;
        })
        .catch((cause) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "Anmeldung konnte nicht geprüft werden.");
          setCheckingSession(false);
          setBusy(false);
        });
    }

    return () => {
      cancelled = true;
      if (authChangeId) window.clearTimeout(authChangeId);
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
    const { data, error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError("E-Mail oder Passwort ist nicht korrekt.");
      setBusy(false);
      return;
    }
    await establishContext(data.session).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Firmenzugriff konnte nicht geladen werden.");
      setReady(false);
      setCheckingSession(false);
      setBusy(false);
    });
  }

  async function sendLoginLink() {
    setBusy(true); setError(""); setNotice("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Auth unavailable");
      const result = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: new URL("/auth/accept", window.location.origin).toString() } });
      if (result.error) throw result.error;
      setNotice("Wenn für diese E-Mail ein Zugang besteht, erhältst du einen Anmeldelink.");
    } catch { setNotice("Wenn für diese E-Mail ein Zugang besteht, erhältst du einen Anmeldelink. Bitte gegebenenfalls später erneut versuchen."); }
    finally { setBusy(false); }
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
    clearEmployeeSessionContext(window.sessionStorage);
    window.sessionStorage.removeItem(pendingTenantStorageKey);
    window.sessionStorage.removeItem("workcore-active-user-id");
    currentIdentity.current = "";
    setReady(false);
    setCheckingSession(false);
    setBusy(false);
  }

  if (ready) return <AuthActionsContext.Provider key={contextKey} value={{ busy, signOut }}>{children}</AuthActionsContext.Provider>;
  if (checkingSession) return <main className="app auth-app" data-ready="false" aria-busy="true">
    <section className="auth-shell">
      <div className="auth-brand"><Building2 size={28} /><strong>WorkCore</strong></div>
      <p role="status">Sitzung wird geprüft …</p>
    </section>
  </main>;
  return (
    <main className="app auth-app" data-ready="false">
      <section className="auth-shell">
        <div className="auth-brand"><Building2 size={28} /><strong>WorkCore</strong></div>
        <section className="panel auth-panel">
          <div><p>Anmeldung</p><h1>Willkommen zurück</h1><span>Melde dich mit deinem persönlichen Firmenkonto an.</span></div>
          <label><span>E-Mail</span><input autoComplete="email" disabled={busy} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label>
          <label><span>Passwort</span><input autoComplete="current-password" disabled={busy} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void signIn()} type="password" value={password} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          <button className="primary-button" disabled={busy || !email.trim() || !password} onClick={() => void signIn()} type="button"><LogIn size={16} />{busy ? "Wird geprüft ..." : "Anmelden"}</button>
          <button className="ghost-button" disabled={busy || !email.trim()} onClick={() => void sendLoginLink()} type="button"><Mail size={16} />Anmeldelink senden</button>
        </section>
      </section>
    </main>
  );
}
