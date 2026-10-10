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

export function formatSyncDataTime(value: string | undefined, language: Language) {
  if (!value) return "";
  const date = new Date(value);
  const locale = language === "sv" ? "sv-SE" : language === "en" ? "en-GB" : "de-DE";
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale, {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
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
  const [confirmation, setConfirmation] = useState<{ ids: string[]; review: boolean } | null>(null);
  const entries = [...conflicts, ...failures];
  const lastPage = Math.max(0, Math.ceil(entries.length / 25) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = entries.slice(currentPage * 25, (currentPage + 1) * 25);
  const selectedIds = entries.filter((mutation) => selected.includes(mutation.id)).map((mutation) => mutation.id);
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const redundantIds = reviews.filter((r) => r.redundant && conflicts.some((m) => m.id === r.id)).map((r) => r.id);
  async function review(resolve = false, ids = redundantIds) {
    if (!onReviewConflicts) return;
    setResolving(true);
    setResolutionError("");
    try { setReviews(await onReviewConflicts(resolve ? ids : conflicts.map((m) => m.id), resolve)); }
    catch { setResolutionError("Serververgleich fehlgeschlagen. Lokale Änderungen bleiben erhalten."); }
    finally { setResolving(false); if (resolve) setConfirmation(null); }
  }
  function accept(ids: string[]) {
    if (ids.length) setConfirmation({ ids, review: false });
  }
  async function confirmAccept(ids: string[]) {
    setResolving(true);
    setResolutionError("");
    try {
      await onDiscardConflicts(ids);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
    } catch {
      setResolutionError("Serverstand konnte nicht geladen werden. Bitte aktualisieren.");
    } finally { setResolving(false); setConfirmation(null); }
  }
  const hasConflict = summary.conflict > 0;
  const hasFailed = summary.failed > 0;
  const isSyncing = summary.syncing > 0;
  const isPending = summary.pending > 0;
  const time = formatSyncDataTime(lastSyncedAt, language);

  let tone = "synced";
  let label = time
    ? copy(language, `Datenstand ${time}`, `Datastatus ${time}`, `Data as of ${time}`)
    : copy(language, "Keine offenen Änderungen", "Inga väntande ändringar", "No pending changes");
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
            {redundantIds.length > 0 && <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => setConfirmation({ ids: redundantIds, review: true })}>Erledigte: Serverstand übernehmen</button>}
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
              {mutation.status === "conflict" && onReviewConflicts
                ? <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => void review(true, conflicts.filter((item) => item.entityType === mutation.entityType && item.entityId === mutation.entityId).map((item) => item.id))}>Mit Server vergleichen</button>
                : <button type="button" className="ghost-button compact" disabled={resolving || !online} onClick={() => onRetry(mutation.id)}>Erneut versuchen</button>}
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
      {confirmation && <TripDialog className="sync-confirm-dialog" labelledBy="sync-confirm-title" onClose={() => { if (!resolving) setConfirmation(null); }}>
        <header>
          <h2 id="sync-confirm-title">{copy(language, "Serverstand übernehmen?", "Använd serverversionen?", "Accept server version?")}</h2>
        </header>
        <p>{confirmation.review
          ? copy(language, `${confirmation.ids.length} nachweislich erledigte Konflikte werden erneut mit dem Server verglichen. Abweichende lokale Änderungen bleiben erhalten.`, `${confirmation.ids.length} redan lösta konflikter jämförs med servern igen. Avvikande lokala ändringar behålls.`, `${confirmation.ids.length} verified resolved conflicts will be checked against the server again. Different local changes are retained.`)
          : copy(language, `${confirmation.ids.length} nicht synchronisierte lokale Änderung(en) werden verworfen und durch den Serverstand ersetzt. Diese Änderungen werden nicht gespeichert. Andere Änderungen bleiben erhalten.`, `${confirmation.ids.length} osynkroniserade lokala ändringar tas bort och ersätts med serverversionen. Dessa ändringar sparas inte. Övriga ändringar behålls.`, `${confirmation.ids.length} unsynced local change(s) will be discarded in favor of the server version. These changes will not be saved. Other changes are retained.`)}</p>
        <div className="modal-actions">
          <button autoFocus className="ghost-button" disabled={resolving} type="button" onClick={() => setConfirmation(null)}>{copy(language, "Abbrechen", "Avbryt", "Cancel")}</button>
          <button className="primary-button" disabled={resolving || (confirmation.review && !online)} type="button"
            onClick={() => void (confirmation.review ? review(true, confirmation.ids) : confirmAccept(confirmation.ids))}>
            {resolving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
            {copy(language, "Serverstand übernehmen", "Använd serverversionen", "Accept server version")}
          </button>
        </div>
      </TripDialog>}
    </div>
  );
}
