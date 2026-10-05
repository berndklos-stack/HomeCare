"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, CloudOff, LoaderCircle, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { TripDialog } from "./TripDialog";
import type { Language } from "@/lib/uiTypes";
import type { SyncMutation, SyncQueueSummary } from "@/lib/syncQueue";
import type { ConflictReview } from "@/lib/conflictReview";

type SyncStatusProps = {
  language: Language;
  conflicts?: SyncMutation[];
  failures?: SyncMutation[];
  issues?: string[];
  lastSyncedAt?: string;
  online: boolean;
  onDiscardConflicts: (mutationId: string | string[]) => Promise<void> | void;
  onRetry: (mutationId?: string) => void;
  onReviewConflicts?: (ids: string[], resolve?: boolean) => Promise<ConflictReview[]>;
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

export function SyncStatus({ conflicts = [], failures = [], issues = [], language, lastSyncedAt, online, onDiscardConflicts, onRetry, onReviewConflicts, summary }: SyncStatusProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [resolutionError, setResolutionError] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ConflictReview[]>([]);
  const entries = [...conflicts, ...failures];
  const lastPage = Math.max(0, Math.ceil(entries.length / 25) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = entries.slice(currentPage * 25, (currentPage + 1) * 25);
  const selectedIds = entries.filter((mutation) => selected.includes(mutation.id)).map((mutation) => mutation.id);
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const redundantIds = reviews.filter((r) => r.redundant && conflicts.some((m) => m.id === r.id)).map((r) => r.id);
  async function review(resolve = false) {
    if (!onReviewConflicts || (resolve && !window.confirm(`${redundantIds.length} nachweislich erledigte Konflikte erneut prüfen und Serverstand übernehmen? Abweichende Änderungen bleiben erhalten.`))) return;
    setResolving(true);
    setResolutionError("");
    try { setReviews(await onReviewConflicts(resolve ? redundantIds : conflicts.map((m) => m.id), resolve)); }
    catch { setResolutionError("Serververgleich fehlgeschlagen. Lokale Änderungen bleiben erhalten."); }
    finally { setResolving(false); }
  }
  async function accept(ids: string[]) {
    if (!ids.length || !window.confirm(`${ids.length} nicht synchronisierte lokale Änderung(en) verwerfen und Serverstand übernehmen? Diese Änderungen werden nicht gespeichert. Andere Änderungen bleiben erhalten.`)) return;
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
        aria-haspopup={hasDetails ? "dialog" : undefined}
        aria-expanded={hasDetails ? detailsOpen : undefined}
        aria-label={label}
        className={`sync-status sync-status-${tone}`}
        disabled={!hasDetails}
        onClick={hasDetails ? (event) => {
          event.currentTarget.focus({ preventScroll: true });
          setDetailsOpen(true);
        } : undefined}
        title={hasDetails ? copy(language, "Details anzeigen", "Visa detaljer", "Show details") : label}
        type="button"
      >
        {icon}
        <span>{label}</span>
        {(hasConflict || hasFailed || isPending) && <strong>{summary.conflict + summary.failed + summary.pending}</strong>}
      </button>
      {detailsOpen && hasDetails && (
        <TripDialog className="sync-conflict-dialog" labelledBy="sync-conflict-title" onClose={() => { if (!resolving) setDetailsOpen(false); }}>
          <header>
            <h2 id="sync-conflict-title">{hasConflict
            ? copy(language, "Änderungskonflikt", "Ändringskonflikt", "Change conflict")
            : copy(language, "Synchronisierungsfehler", "Synkroniseringsfel", "Sync error")}</h2>
            <button className="icon-button" type="button" disabled={resolving}
              aria-label={copy(language, "Konflikte schließen", "Stäng konflikter", "Close conflicts")}
              title={copy(language, "Schließen", "Stäng", "Close")} onClick={() => setDetailsOpen(false)}><X size={20} /></button>
          </header>
          <div className="sync-status-details">
          <span>{issues[0] || (hasConflict
            ? copy(language, "Der Serverstand wurde nicht überschrieben. Bitte Daten aktualisieren und die Änderung prüfen.", "Serverdata skrevs inte över. Uppdatera och kontrollera ändringen.", "The server version was not overwritten. Refresh and review the change.")
            : copy(language, "Die lokale Änderung bleibt erhalten.", "Den lokala ändringen finns kvar.", "The local change is retained."))}</span>
          {entries.length > 0 && <div className="sync-conflict-actions">
            <label><input type="checkbox" disabled={resolving} checked={allSelected}
              onChange={(event) => setSelected(event.target.checked ? entries.map((mutation) => mutation.id) : [])} />
              {copy(language, "Alle auswählen", "Välj alla", "Select all")}</label>
            <span>{copy(language, `${selectedIds.length} von ${entries.length} ausgewählt`, `${selectedIds.length} av ${entries.length} valda`, `${selectedIds.length} of ${entries.length} selected`)}</span>
            <button type="button" className="ghost-button compact" disabled={resolving || !selectedIds.length}
              onClick={() => void accept(selectedIds)}>{copy(language, "Ausgewählte: Serverstand übernehmen", "Valda: använd serverversionen", "Selected: accept server version")}</button>
          </div>}
          {onReviewConflicts && conflicts.length > 0 && <div className="sync-conflict-actions">
            <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => void review()}>{resolving ? "Prüfung läuft" : "Konflikte mit Server vergleichen"}</button>
            {reviews.length > 0 && <span>{redundantIds.length} nachweislich erledigt; übrige Änderungen bleiben geschützt.</span>}
            {redundantIds.length > 0 && <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => void review(true)}>Erledigte: Serverstand übernehmen</button>}
          </div>}
          {entries.length > 25 && <nav className="sync-conflict-actions" aria-label="Konfliktseiten">
            <button className="icon-button" type="button" aria-label="Vorherige Konfliktseite" title="Vorherige Seite" disabled={currentPage === 0 || resolving} onClick={() => { setPage(currentPage - 1); setExpanded(null); }}><ChevronLeft size={18} /></button>
            <span>{currentPage * 25 + 1}–{Math.min((currentPage + 1) * 25, entries.length)} / {entries.length}</span>
            <button className="icon-button" type="button" aria-label="Nächste Konfliktseite" title="Nächste Seite" disabled={currentPage === lastPage || resolving} onClick={() => { setPage(currentPage + 1); setExpanded(null); }}><ChevronRight size={18} /></button>
          </nav>}
          {visible.map((mutation) => <section className="sync-conflict-entry" key={mutation.id} aria-label={`Konflikt ${mutation.entityId}`}>
            <label><input type="checkbox" disabled={resolving} aria-label={`Konflikt ${mutation.entityId} auswählen`} checked={selected.includes(mutation.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, mutation.id] : current.filter((id) => id !== mutation.id))} />{mutation.entityType} · {mutation.entityId}</label>
            <small>{mutation.operation} · lokal Revision {mutation.expectedRevision ?? "neu"} · Server Revision {String(mutation.serverRecord?.revision ?? "unbekannt")}</small>
            {mutation.status === "failed" && <strong>{copy(language, "Synchronisierung fehlgeschlagen", "Synkronisering misslyckades", "Sync failed")}</strong>}
            <span>{mutation.error}</span>
            {reviews.find((r) => r.id === mutation.id)?.reason && <small>{reviews.find((r) => r.id === mutation.id)?.reason}</small>}
            <details open={expanded === mutation.id}><summary onClick={(event) => { event.preventDefault(); setExpanded(expanded === mutation.id ? null : mutation.id); }}>Änderung prüfen</summary>{expanded === mutation.id && <><strong>Lokal</strong><dl>{Object.entries(mutation.payload).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{describeValue(value)}</dd></div>)}</dl>
              <strong>Server</strong><dl>{Object.entries(mutation.serverRecord ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{describeValue(value)}</dd></div>)}</dl>
            </>}
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
        </TripDialog>
      )}
    </div>
  );
}
