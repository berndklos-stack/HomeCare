"use client";

import { useEffect, useState } from "react";
import { Copy, Download, RefreshCw, Unplug } from "lucide-react";
import { apiFetch, getActiveTenantId } from "@/lib/apiClient";

export function AppleRemindersBridge() {
  const tenantId = getActiveTenantId();
  const [status, setStatus] = useState<{ connected: boolean; receivedAt: string; count: number } | null>(null);
  const [setup, setSetup] = useState<{ token: string; tenantId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = "/api/integrations/apple-reminders";
  useEffect(() => {
    const controller = new AbortController();
    setSetup(null);
    setStatus(null);
    setNotice("");
    void apiFetch(endpoint, { signal: controller.signal }).then(async (res) => {
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok) setStatus(data);
      else setNotice(data.error || "Abrufstatus konnte nicht geladen werden.");
    }).catch(() => {
      if (!controller.signal.aborted) setNotice("Abrufstatus konnte nicht geladen werden.");
    });
    return () => controller.abort();
  }, [tenantId]);

  async function act(method: "GET" | "POST" | "DELETE") {
    setBusy(true);
    setNotice("");
    try {
      const res = await apiFetch(endpoint, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anbindung fehlgeschlagen.");
      if (method === "POST") {
        setSetup(data);
        setStatus({ connected: true, receivedAt: "", count: 0 });
      } else if (method === "DELETE") {
        setSetup(null);
        setStatus({ connected: false, receivedAt: "", count: 0 });
      } else setStatus(data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Anbindung fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  return <div className="wide mail-settings-help">
    <strong>Apple Erinnerungen über iPhone-Kurzbefehl</strong>
    <p>Alle Listen, nur offene Erinnerungen. Auch private Inhalte werden für die Empfänger der Tagesmail sichtbar. In Apple wird nichts verändert.</p>
    <p role="status">{status?.receivedAt
      ? `Letzter Abruf: ${new Date(status.receivedAt).toLocaleString()} · ${status.count} offene Erinnerungen`
      : status?.connected ? "Eingerichtet; noch kein Abruf empfangen." : "Noch nicht verbunden."}</p>
    <div className="button-row">
      <a className="ghost-button" href="/shortcuts/workcore-erinnerungen.shortcut" download><Download size={16} style={{ flexShrink: 0 }} />Kurzbefehl herunterladen</a>
      {!status?.connected && <button type="button" className="ghost-button" disabled={busy || status === null} onClick={() => void act("POST")}>iPhone verbinden</button>}
      <button type="button" className="icon-button" title="Abrufstatus aktualisieren" aria-label="Abrufstatus aktualisieren" disabled={busy} onClick={() => void act("GET")}><RefreshCw size={16} /></button>
      {status?.connected && <button type="button" className="ghost-button" disabled={busy} onClick={() => void act("DELETE")}><Unplug size={16} />Anbindung widerrufen</button>}
    </div>
    {setup && <>
      <label>Übertragungs-URL<input readOnly value={`${window.location.origin}${endpoint}`} /></label>
      <label>X-WorkCore-Tenant<input readOnly value={setup.tenantId} /></label>
      <label>Authorization (nur jetzt sichtbar)<input readOnly type="password" value={`Bearer ${setup.token}`} /></label>
      <button type="button" className="ghost-button" onClick={() => void navigator.clipboard.writeText(`Bearer ${setup.token}`).then(() => setNotice("Zugang kopiert.")).catch(() => setNotice("Kopieren nicht möglich."))}><Copy size={16} />Zugang kopieren</button>
      <p>Der Zugang erlaubt nur das Senden von Erinnerungen. Nicht weitergeben. Nach dem Schließen ist er nicht erneut abrufbar; bei Verlust Anbindung widerrufen und neu verbinden.</p>
    </>}
    {notice && <p role="status">{notice}</p>}
    <details>
      <summary>Kurzbefehl auf dem iPhone einrichten</summary>
      <ol>
        <li>„iPhone verbinden“ wählen und den Zugang kopieren. Falls ein früherer Zugang verloren ist, die Anbindung widerrufen und neu verbinden.</li>
        <li>„Kurzbefehl herunterladen“ auf dem iPhone wählen, die Datei in Kurzbefehle öffnen und hinzufügen. Beim Import Authorization inklusive „Bearer“ und X-WorkCore-Tenant aus WorkCore eintragen. Falls iOS keine Einrichtungsfragen zeigt, die ersten beiden Textaktionen ausfüllen.</li>
        <li>Die Vorlage liest alle Listen und nur offene Erinnerungen. Die Download-Datei enthält noch keinen persönlichen Zugang. Den eingerichteten Kurzbefehl nicht teilen.</li>
        <li>Manuell ausführen, Apple-Freigaben erlauben und hier den Abrufstatus aktualisieren.</li>
        <li>Persönliche Automation täglich um 05:45 für diesen Kurzbefehl einrichten, sofort ausführen. Bei Tagesmail um 06:00 bleibt Zeitreserve.</li>
      </ol>
      <p>iPhone muss eingeschaltet und online sein. Ausführung bei gesperrtem Bildschirm testen; iOS kann Freigaben verlangen. Nicht als geteilten Kurzbefehl veröffentlichen: Er enthält deinen Zugang.</p>
    </details>
  </div>;
}
