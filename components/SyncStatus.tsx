"use client";

import { AlertCircle, Check, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { Language } from "@/lib/uiTypes";
import type { SyncQueueSummary } from "@/lib/syncQueue";

type SyncStatusProps = {
  language: Language;
  issues?: string[];
  lastSyncedAt?: string;
  online: boolean;
  onRetry: () => void;
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

export function SyncStatus({ issues = [], language, lastSyncedAt, online, onRetry, summary }: SyncStatusProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
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
          {hasFailed && (
            <button className="ghost-button compact" onClick={onRetry} type="button">
              <RefreshCw size={14} />
              {copy(language, "Erneut versuchen", "Försök igen", "Retry")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
