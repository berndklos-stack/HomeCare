"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { apiFetch, activateTenant } from "@/lib/apiClient";
import type { AuthContextPayload } from "@/lib/authModel";

export default function AcceptInvitationPage() {
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const isRecovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const update = () => { if (!cancelled) setReady(true); };
    const subscription = client.auth.onAuthStateChange((event, session) => { if (event === "PASSWORD_RECOVERY" && !cancelled) setRecovery(true); if (session) update(); }).data.subscription;
    void client.auth.getSession().then(({ data }) => { if (!cancelled) { if (isRecovery) setRecovery(true); if (data.session) update(); } });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);
  async function accept() {
    setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Anmeldung nicht verfügbar.");
      if (recovery && (password.length < 12 || password !== confirmation)) throw new Error("Bitte ein Passwort mit mindestens 12 Zeichen zweimal identisch eingeben.");
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
  return <main className="administration-shell"><h1>{recovery ? "Passwort zurücksetzen" : "Einladung zu WorkCore"}</h1>
    {done ? <><p role="status">Dein Passwort wurde geändert.</p><Link className="ghost-button" href="/">WorkCore öffnen</Link></> : <>
    {!ready ? <p role="status">Bitte öffne den aktuellen Einladungslink aus deiner E-Mail.</p> : <form onSubmit={event => { event.preventDefault(); void accept(); }}>
      <label>{recovery ? "Neues Passwort" : "Passwort festlegen (optional)"}<input required={recovery} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {recovery && <label>Neues Passwort bestätigen<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>}
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={busy} type="submit">{recovery ? "Passwort speichern" : "Firmenzugang aktivieren"}</button>
    </form>}</>}</main>;
}
