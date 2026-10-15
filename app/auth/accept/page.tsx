"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { apiFetch, activateTenant } from "@/lib/apiClient";
import type { AuthContextPayload } from "@/lib/authModel";

export default function AcceptInvitationPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const update = () => { if (!cancelled) setReady(true); };
    const subscription = client.auth.onAuthStateChange((_event, session) => { if (session) update(); }).data.subscription;
    void client.auth.getSession().then(({ data }) => { if (data.session) update(); });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);
  async function accept() {
    setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Anmeldung nicht verfügbar.");
      if (password) {
        const updated = await client.auth.updateUser({ password });
        if (updated.error) throw new Error("Passwort konnte nicht gesetzt werden. Bitte die Passwortvorgaben prüfen.");
      }
      const response = await apiFetch("/api/auth/context");
      if (!response.ok) throw new Error("Einladung konnte nicht aktiviert werden. Bitte erneut versuchen.");
      const context = await response.json() as AuthContextPayload;
      if (!context.memberships.length) throw new Error("Keine gültige Einladung vorhanden. Bitte eine neue Einladung anfordern.");
      activateTenant(context.activeTenantId ?? context.memberships[0].tenantId);
      window.location.replace("/");
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }
  return <main className="administration-shell"><h1>Einladung zu WorkCore</h1>
    {!ready ? <p role="status">Bitte öffne den aktuellen Einladungslink aus deiner E-Mail.</p> : <form onSubmit={event => { event.preventDefault(); void accept(); }}>
      <label>Passwort festlegen (optional)<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={busy} type="submit">Firmenzugang aktivieren</button>
    </form>}</main>;
}
