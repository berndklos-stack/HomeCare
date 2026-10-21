"use client";

import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { defaultAppBranding } from "@/lib/branding";
import type { CompanyBranding } from "@/lib/server/companyBranding";

const fields = [
  ["brandNameSweden", "Markenname Schweden"], ["claimSweden", "Claim Schweden"],
  ["brandNameInternational", "Internationaler Markenname"], ["claimGerman", "Deutscher Claim"],
  ["claimEnglish", "Englischer Claim"],
] as const;

export function BrandingSettings({ dirtyChanged, busyChanged }: { dirtyChanged: (dirty: boolean) => void; busyChanged: (busy: boolean) => void }) {
  const [form, setForm] = useState<CompanyBranding | null>(null);
  const [saved, setSaved] = useState<CompanyBranding | null>(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(-1);
  const busy = saving || loaded !== reload;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  useEffect(() => { dirtyChanged(dirty); }, [dirty, dirtyChanged]);
  useEffect(() => { busyChanged(saving); }, [saving, busyChanged]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/administration/branding", { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Branding konnte nicht geladen werden.");
      if (!controller.signal.aborted) { setForm(result.branding); setSaved(result.branding); setRevision(result.revision); setLoaded(reload); }
    }).catch(cause => { if (!controller.signal.aborted) { setError((cause as Error).message); setLoaded(reload); } });
    return () => controller.abort();
  }, [reload]);
  return <section aria-labelledby="branding-heading">
    <header className="administration-section-header"><h2 id="branding-heading">System / Branding</h2>
      <button type="button" className="ghost-button icon-button" title="Neu laden" aria-label="Branding neu laden" disabled={busy} onClick={() => {
        if (!dirty || window.confirm("Ungespeicherte Branding-Änderungen verwerfen?")) { setError(""); setNotice(""); setReload(value => value + 1); }
      }}><RefreshCw size={18}/></button>
    </header>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {busy && !form && <p role="status">Branding wird geladen …</p>}
    {form && <form onSubmit={async event => {
      event.preventDefault(); if (busy || !dirty) return; setSaving(true); setError(""); setNotice("");
      try {
        const response = await apiFetch("/api/administration/branding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branding: form, revision }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Branding konnte nicht gespeichert werden.");
        setForm(result.branding); setSaved(result.branding); setRevision(result.revision); setNotice("Branding gespeichert.");
      } catch (cause) { setError((cause as Error).message); } finally { setSaving(false); }
    }}>
      <div className="administration-grid">{fields.map(([key, label]) => <label key={key}>{label}<input maxLength={300} disabled={busy} placeholder={defaultAppBranding[key]} value={form[key]} onChange={event => { setForm({ ...form, [key]: event.target.value }); setNotice(""); }}/></label>)}</div>
      <footer className="administration-company-footer"><span/><button type="submit" className="primary-button" disabled={busy || !dirty}><Check size={18}/>Branding speichern</button></footer>
    </form>}
  </section>;
}
