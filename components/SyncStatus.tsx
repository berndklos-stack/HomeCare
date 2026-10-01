"use client";

import { AlertCircle, Check, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { Language } from "@/lib/uiTypes";
import type { SyncMutation, SyncQueueSummary } from "@/lib/syncQueue";

type SyncStatusProps = {
  language: Language;
  conflicts?: SyncMutation[];
  issues?: string[];
  lastSyncedAt?: string;
  online: boolean;
  onDiscardConflicts: (mutationId: string | string[]) => Promise<void> | void;
  onRetry: (mutationId?: string) => void;
  summary: SyncQueueSummary;
};

function copy(language: Language, de: string, sv: string, en: string) {
  return language === "sv" ? sv : language === "en" ? en : de;
}

function syncedTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function describeValue(value: unknown, depth = 0): string {
  if (typeof value === "string") return value.startsWith("data:") ? "Eingebettete Datei" : value.slice(0, 300);
  if (!value || typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `${value.length} Einträge`;
  if (depth > 1) return Object.keys(value).slice(0, 8).join(", ");
  return Object.entries(value).slice(0, 12).map(([key, item]) => `${key}: ${describeValue(item, depth + 1)}`).join("; ");
}

export function SyncStatus({ conflicts = [], issues = [], language, lastSyncedAt, online, onDiscardConflicts, onRetry, summary }: SyncStatusProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [resolutionError, setResolutionError] = useState("");
  async function accept(ids: string[]) {
    if (!ids.length || !window.confirm(`${ids.length} lokale Konfliktänderung(en) verwerfen und Serverstand übernehmen? Andere Änderungen bleiben erhalten.`)) return;
    setResolving(true);
    setResolutionError("");
    try {
      await onDiscardConflicts(ids);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
    } catch {
      setResolutionError("Serverstand konnte nicht geladen werden. Bitte aktualisieren.");
    } finally { setResolving(false); }
  }
  const hasConflict = summary.conflict > 0;
  const hasFailed = summary.failed > 0;
  const isSyncing = summary.syncing > 0;
  const isPending = summary.pending > 0;
  const time = syncedTime(lastSyncedAt);

  let tone = "synced";
  let label = time
    ? copy(language, `Synchronisiert ${time}`, `Synkroniserad ${time}`, `Synced ${time}`)
    : copy(language, "Synchronisiert", "Synkroniserad", "Synced");
  let icon = <Check aria-hidden="true" size={14} />;

  if (!online) {
    tone = "offline";
    label = isPending
      ? copy(language, "Lokal gespeichert · offline", "Sparat lokalt · offline", "Saved locally · offline")
      : copy(language, "Offline", "Offline", "Offline");
    icon = <CloudOff aria-hidden="true" size={14} />;
  } else if (hasConflict) {
    tone = "conflict";
    label = copy(language, "Synchronisierungskonflikt", "Synkroniseringskonflikt", "Sync conflict");
    icon = <TriangleAlert aria-hidden="true" size={14} />;
  } else if (hasFailed) {
    tone = "error";
    label = copy(language, "Synchronisierung fehlgeschlagen", "Synkronisering misslyckades", "Sync failed");
    icon = <AlertCircle aria-hidden="true" size={14} />;
  } else if (isSyncing) {
    tone = "syncing";
    label = copy(language, "Wird synchronisiert", "Synkroniserar", "Syncing");
    icon = <LoaderCircle aria-hidden="true" className="spin" size={14} />;
  } else if (isPending) {
    tone = "pending";
    label = copy(language, "Lokal gespeichert · wartet", "Sparat lokalt · väntar", "Saved locally · pending");
    icon = <RefreshCw aria-hidden="true" size={14} />;
  }

  const hasDetails = hasConflict || hasFailed;
  return (
    <div className="sync-status-wrap">
      <button
        aria-expanded={hasDetails ? detailsOpen : undefined}
        aria-label={label}
        className={`sync-status sync-status-${tone}`}
        disabled={!hasDetails}
        onClick={hasDetails ? () => setDetailsOpen((open) => !open) : undefined}
        title={hasDetails ? copy(language, "Details anzeigen", "Visa detaljer", "Show details") : label}
        type="button"
      >
        {icon}
        <span>{label}</span>
        {(hasConflict || hasFailed || isPending) && <strong>{summary.conflict + summary.failed + summary.pending}</strong>}
      </button>
      {detailsOpen && hasDetails && (
        <div className="sync-status-details" role="status">
          <strong>{hasConflict
            ? copy(language, "Änderungskonflikt", "Ändringskonflikt", "Change conflict")
            : copy(language, "Synchronisierungsfehler", "Synkroniseringsfel", "Sync error")}</strong>
          <span>{issues[0] || (hasConflict
            ? copy(language, "Der Serverstand wurde nicht überschrieben. Bitte Daten aktualisieren und die Änderung prüfen.", "Serverdata skrevs inte över. Uppdatera och kontrollera ändringen.", "The server version was not overwritten. Refresh and review the change.")
            : copy(language, "Die lokale Änderung bleibt erhalten.", "Den lokala ändringen finns kvar.", "The local change is retained."))}</span>
          {conflicts.length > 1 && <button type="button" className="ghost-button compact" disabled={resolving || !selected.some((id) => conflicts.some((item) => item.id === id))}
            onClick={() => void accept(selected.filter((id) => conflicts.some((item) => item.id === id)))}>Ausgewählte: Serverstand übernehmen</button>}
          {conflicts.map((mutation) => <section className="sync-conflict-entry" key={mutation.id} aria-label={`Konflikt ${mutation.entityId}`}>
            <label><input type="checkbox" aria-label={`Konflikt ${mutation.entityId} auswählen`} checked={selected.includes(mutation.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, mutation.id] : current.filter((id) => id !== mutation.id))} />{mutation.entityType} · {mutation.entityId}</label>
            <small>{mutation.operation} · lokal Revision {mutation.expectedRevision ?? "neu"} · Server Revision {String(mutation.serverRecord?.revision ?? "unbekannt")}</small>
            <span>{mutation.error}</span>
            <details><summary>Änderung prüfen</summary><strong>Lokal</strong><dl>{Object.entries(mutation.payload).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{describeValue(value)}</dd></div>)}</dl>
              <strong>Server</strong><dl>{Object.entries(mutation.serverRecord ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{describeValue(value)}</dd></div>)}</dl>
            </details>
            <div className="sync-conflict-actions">
              <button type="button" className="ghost-button compact" disabled={resolving} onClick={() => void accept([mutation.id])}>Serverstand übernehmen</button>
              <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => onRetry(mutation.id)}>Erneut versuchen</button>
            </div>
          </section>)}
          {resolutionError && <p role="alert">{resolutionError}</p>}
          {hasFailed && (
            <button className="ghost-button compact" onClick={() => onRetry()} type="button">
              <RefreshCw size={14} />
              {copy(language, "Erneut versuchen", "Försök igen", "Retry")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
