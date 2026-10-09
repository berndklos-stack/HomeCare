"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { validateOperationsMutation } from "@/lib/operationsCommands";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

type Ref = { id: string; name: string; minStock?: string };
export function OperationsStock({ language, materials, locations, jobs, projects, queue, enqueue }: {
  language: "de" | "sv" | "en"; materials: Ref[]; locations: Ref[]; jobs: Ref[]; projects: Ref[]; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [balances, setBalances] = useState<{ location_id: string; quantity: number }[]>([]);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(0), [count, setCount] = useState(0), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(""), [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
  const settled = queue.filter((m) => m.entityType === "operations" && m.status === "synced").map((m) => m.id).join(":");
  const total = balances.reduce((sum, row) => sum + Number(row.quantity), 0);
  const selected = materials.find((m) => m.id === materialId);
  useEffect(() => {
    if (!materialId) return;
    const controller = new AbortController();
    setError(""); setBalances([]); setHistory([]);
    async function load() {
      const balanceResponse = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(materialId)}`, { signal: controller.signal });
      if (!balanceResponse.ok) throw new Error("unavailable");
      const balance = await balanceResponse.json();
      const historyResponse = await apiFetch(`/api/operations?entity=stock_movements&parent=${encodeURIComponent(materialId)}&page=${page}`, { signal: controller.signal });
      if (!historyResponse.ok) throw new Error("unavailable");
      const history = await historyResponse.json();
      if (!controller.signal.aborted) { setBalances(balance.rows); setHistory(history.rows); setCount(history.count); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("unavailable"); });
    return () => controller.abort();
  }, [materialId, page, settled, refresh]);
  return <section>
    <div className={styles.toolbar}><label>{t("material_id")} <select aria-label={t("material_id")} value={materialId} onChange={(e) => { setMaterialId(e.target.value); setPage(0); setBalances([]); setHistory([]); setCount(0); setError(""); }}><option value="">—</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button disabled={!materialId} title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
      <button disabled={!materialId} onClick={() => { setError(""); setOpen(true); }}><Plus size={18} />{t("stock")}</button></div>
    {error && <p role="alert">{t(error)}</p>}
    {materialId && <strong>{t("quantity")}: {total}</strong>}{selected?.minStock && total < Number(selected.minStock) && <p role="status">{language === "de" ? "Mindestbestand unterschritten" : language === "sv" ? "Under minimilager" : "Below minimum stock"}</p>}
    {balances.map((r) => <p key={r.location_id}>{locations.find((l) => l.id === r.location_id)?.name ?? r.location_id}: {String(r.quantity)}</p>)}
    <div className={styles.list}>{history.map((r) => <article className={styles.row} key={String(r.id)}><div><strong>{String(r.quantity)}</strong><p>{r.source_id ? locations.find((l) => l.id === r.source_id)?.name ?? String(r.source_id) : "—"} → {r.destination_id ? locations.find((l) => l.id === r.destination_id)?.name ?? String(r.destination_id) : "—"}</p><p>{String(r.note)}</p><small>{new Date(String(r.occurred_at)).toLocaleString(language)} · {String(r.actor_user_id ?? (language === "de" ? "Altbestand: Benutzer nicht dokumentiert" : language === "sv" ? "Historik: användare saknas" : "Legacy: actor not recorded"))}</small></div></article>)}</div>
    {count > 50 && <div className={styles.toolbar}><button disabled={!page} aria-label={t("previous")} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button disabled={(page + 1) * 50 >= count} aria-label={t("next")} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
    {open && <TripDialog labelledBy="stock-title" onClose={() => setOpen(false)} className={styles.dialog}><form onSubmit={(e) => {
      e.preventDefault();
      try {
        const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: materialId,
          payload: { kind: "stock", material_id: materialId, source_id: draft.source_id || null, destination_id: draft.destination_id || null,
            quantity: Number(draft.quantity), note: draft.note, job_id: draft.job_id || null, project_id: draft.project_id || null } };
        validateOperationsMutation({ ...input, id: createStableId() }); enqueue(input); setOpen(false);
        setDraft({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
      } catch { setError("INVALID_OPERATIONS_COMMAND"); }
    }}><div className={styles.toolbar}><h2 id="stock-title">{t("stock")}</h2><button type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button></div><div className={styles.fields}>
      {(["source_id", "destination_id", "job_id", "project_id"] as const).map((key) => <label className={styles.field} key={key}><span>{t(key)}</span><select aria-label={t(key)} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}><option value="">—</option>{(key === "job_id" ? jobs : key === "project_id" ? projects : locations).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}
      <label className={styles.field}>{t("quantity")}<input required type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label className={styles.field}>{t("note")}<input required value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
    </div>{error && <p role="alert">{t(error)}</p>}<footer className={styles.actions}><button type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button type="submit">{t("save")}</button></footer></form></TripDialog>}
  </section>;
}
