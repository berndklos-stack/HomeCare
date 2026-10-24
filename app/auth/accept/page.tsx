"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { apiFetch, activateTenant } from "@/lib/apiClient";
import type { AuthContextPayload } from "@/lib/authModel";
import { clearInvitationLinkError, invitationLinkError } from "@/lib/invitationLink";

export default function AcceptInvitationPage() {
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const initialLink = useRef<{ error: string | null; recovery: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    initialLink.current ??= {
      error: invitationLinkError(window.location.href),
      recovery: new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery",
    };
    const linkError = initialLink.current.error;
    if (linkError) {
      clearInvitationLinkError();
      setError(linkError);
      setChecking(false);
      return;
    }
    const isRecovery = initialLink.current.recovery;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("Anmeldung ist momentan nicht verfügbar. Bitte versuche es später erneut."); setChecking(false); return; }
    const subscription = client.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setReady(Boolean(session));
      setSignedInEmail(session?.user.email ?? "");
    }).data.subscription;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (isRecovery) setRecovery(true);
      if (sessionError) setError("Der Anmeldelink konnte nicht bestätigt werden. Bitte fordere einen neuen Link an.");
      setReady(Boolean(data.session));
      setSignedInEmail(data.session?.user.email ?? "");
      setChecking(false);
    }).catch(() => {
      if (!cancelled) { setError("Die Anmeldung konnte nicht geladen werden. Bitte versuche es erneut."); setChecking(false); }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);
  async function requestLink() {
    setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Anmeldung nicht verfügbar.");
      const response = await client.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: {
        shouldCreateUser: false, emailRedirectTo: new URL("/auth/accept", window.location.origin).toString(),
      } });
      if (response.error) throw new Error("Der Anmeldelink konnte nicht angefordert werden. Bitte prüfe die Adresse und versuche es in einer Minute erneut.");
      setLinkSent(true);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function accept() {
    setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Anmeldung nicht verfügbar.");
      if ((recovery || password) && (password.length < 12 || password !== confirmation)) throw new Error("Bitte ein Passwort mit mindestens 12 Zeichen zweimal identisch eingeben.");
      if (password) {
        const updated = await client.auth.updateUser({ password });
        if (updated.error) throw new Error("Passwort konnte nicht gesetzt werden. Bitte die Passwortvorgaben prüfen.");
      }
      if (recovery) { setDone(true); setBusy(false); return; }
      const response = await apiFetch("/api/auth/context");
      if (!response.ok) throw new Error("Einladung konnte nicht aktiviert werden. Bitte erneut versuchen.");
      const context = await response.json() as AuthContextPayload;
      if (!context.memberships.length) throw new Error("Keine gültige Einladung vorhanden. Bitte eine neue Einladung anfordern.");
      activateTenant(context.activeTenantId ?? context.memberships[0].tenantId);
      window.location.replace("/");
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }
  return <main className="administration-shell auth-invitation-page"><h1>{recovery ? "Passwort zurücksetzen" : "Einladung zu WorkCore"}</h1>
    {done ? <><p role="status">Dein Passwort wurde geändert.</p><Link className="ghost-button" href="/">WorkCore öffnen</Link></> : <>
    {checking ? <p role="status">Anmeldung wird geprüft …</p> : !ready ? <>
      {error && <p role="alert">{error}</p>}
      {linkSent ? <p role="status">Wenn für diese Adresse ein Zugang besteht, erhältst du eine E-Mail mit einem neuen Anmeldelink. Bitte öffne nur die neueste E-Mail.</p> : <form onSubmit={event => { event.preventDefault(); void requestLink(); }}>
        <label>E-Mail-Adresse<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="primary-button" disabled={busy} type="submit"><Mail size={18} aria-hidden="true" />Neuen Anmeldelink anfordern</button>
      </form>}
      <Link className="ghost-button" href="/">Zur Anmeldung</Link>
    </> : <form onSubmit={event => { event.preventDefault(); void accept(); }}>
      <p>Angemeldet als {signedInEmail}</p>
      <label>{recovery ? "Neues Passwort" : "Passwort festlegen (optional)"}<input required={recovery} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Passwort bestätigen<input required={recovery || Boolean(password)} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={busy} type="submit">{recovery ? "Passwort speichern" : "Firmenzugang aktivieren"}</button>
    </form>}</>}</main>;
}
