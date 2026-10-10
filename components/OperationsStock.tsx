"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { validateOperationsMutation, type OperationsRow } from "@/lib/operationsCommands";
import { OperationsDataTable, type DataColumn } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

type Ref = { id: string; name: string; sku?: string; unit?: string; minStock?: string };
export function OperationsStock({ language, materials, locations, jobs, projects, queue, enqueue, onMaterialSelected }: {
  language: "de" | "sv" | "en"; materials: Ref[]; locations: Ref[]; jobs: Ref[]; projects: Ref[]; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  onMaterialSelected?: (id: string) => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [balances, setBalances] = useState<{ location_id: string; quantity: number }[]>([]);
  const [history, setHistory] = useState<OperationsRow[]>([]);
  const [page, setPage] = useState(0), [count, setCount] = useState(0), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(""), [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingMaterialId, setBookingMaterialId] = useState("");
  const [globalBooking, setGlobalBooking] = useState(false);
  const [draft, setDraft] = useState({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
  const settled = queue.filter((m) => m.entityType === "operations" && m.status === "synced").map((m) => m.id).join(":");
  const total = balances.reduce((sum, row) => sum + Number(row.quantity), 0);
  const selected = materials.find((m) => m.id === materialId);
  const bookingMaterial = materials.find((m) => m.id === bookingMaterialId);
  const materialLabel = (material: Ref) => `${material.sku ? `${material.sku} · ` : ""}${material.name}`;
  const openBooking = (global: boolean) => {
    setBookingMaterialId(global ? "" : materialId);
    setGlobalBooking(global); setError(""); setOpen(true);
  };
  const quantity = (value: unknown) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(Number(value));
  const location = (id: unknown) => locations.find((row) => row.id === id)?.name ?? (id ? t("unknownLocation") : "—");
  const columns: DataColumn[] = [
    { key: "material_id", label: t("material_id"), value: () => selected ? materialLabel(selected) : "" },
    { key: "occurred_at", label: t("bookingDate"), value: (row) => new Date(String(row.occurred_at)).toLocaleString(language, { dateStyle: "short", timeStyle: "short" }) },
    { key: "quantity", label: t("quantity"), value: (row) => quantity(row.quantity) },
    { key: "source_id", label: t("source_id"), value: (row) => location(row.source_id) },
    { key: "destination_id", label: t("destination_id"), value: (row) => location(row.destination_id) },
    { key: "note", label: t("note"), value: (row) => String(row.note ?? "") },
    { key: "job_id", label: t("job_id"), value: (row) => jobs.find((job) => job.id === row.job_id)?.name ?? "" },
  ];
  useEffect(() => {
    if (!materialId) return;
    const controller = new AbortController();
    async function load() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setError(""); setLoading(true); setBalances([]); setHistory([]); setCount(0);
      const balanceResponse = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(materialId)}`, { signal: controller.signal });
      if (!balanceResponse.ok) throw new Error("unavailable");
      const balance = await balanceResponse.json();
      const historyResponse = await apiFetch(`/api/operations?entity=stock_movements&parent=${encodeURIComponent(materialId)}&page=${page}`, { signal: controller.signal });
      if (!historyResponse.ok) throw new Error("unavailable");
      const history = await historyResponse.json();
      if (!controller.signal.aborted) { setBalances(balance.rows); setHistory(history.rows); setCount(history.count); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [materialId, page, settled, refresh]);
  return <section className={styles.stockOverview}>
    <header className={styles.stockHeading}><div><h2>{t("stockOverview")}</h2><span>{selected ? materialLabel(selected) : "—"}</span></div><button disabled={!materials.length} aria-label={t("globalStockBooking")} onClick={() => openBooking(true)}><Plus size={18} />{t("stock")}</button></header>
    <div className={styles.toolbar}><label>{t("material_id")} <select aria-label={t("material_id")} value={materialId} onChange={(e) => { setMaterialId(e.target.value); onMaterialSelected?.(e.target.value); setPage(0); setBalances([]); setHistory([]); setCount(0); setLoading(false); setError(""); }}><option value="">—</option>{materials.map((m) => <option key={m.id} value={m.id}>{materialLabel(m)}</option>)}</select></label>
      <button disabled={!materialId} title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
      <button disabled={!materialId} onClick={() => openBooking(false)}><Plus size={18} />{t("stock")}</button></div>
    {error && <p role="alert">{t(error)}</p>}
    {materialId && <>
      <dl className={styles.stockSummary}>
        <div><dt>{t("stockTotal")}{selected?.unit ? ` (${selected.unit})` : ""}</dt><dd>{loading || error ? "—" : quantity(total)}</dd></div>
        <div><dt>{t("locations")}</dt><dd>{loading || error ? "—" : balances.filter((row) => Number(row.quantity) !== 0).length}</dd></div>
        <div><dt>{t("bookings")}</dt><dd>{loading || error ? "—" : quantity(count)}</dd></div>
      </dl>
      {selected?.minStock && !loading && !error && total < Number(selected.minStock) && <p role="status">{language === "de" ? "Mindestbestand unterschritten" : language === "sv" ? "Under minimilager" : "Below minimum stock"}</p>}
      <h3>{t("stockByLocation")}</h3>
      <table className={styles.balanceTable} aria-label={t("stockByLocation")}><thead><tr><th scope="col">{t("location")}</th><th scope="col">{t("quantity")}{selected?.unit ? ` (${selected.unit})` : ""}</th></tr></thead><tbody>
        {balances.map((row) => <tr key={row.location_id}><td>{location(row.location_id)}</td><td>{quantity(row.quantity)}</td></tr>)}
        {!balances.length && <tr><td colSpan={2}>{t(loading ? "loading" : error ? "unavailable" : "empty")}</td></tr>}
      </tbody></table>
      <h3>{t("bookings")}</h3>
      <OperationsDataTable key={`${materialId}:${page}`} rows={history} columns={columns} label={t("bookings")} filterLabel={t("filter")} emptyLabel={t(loading ? "loading" : error ? "unavailable" : "empty")} actionsLabel={t("actions")} />
    </>}
    {count > 50 && <div className={styles.toolbar}><button disabled={!page} aria-label={t("previous")} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button disabled={(page + 1) * 50 >= count} aria-label={t("next")} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
    {open && <TripDialog labelledBy="stock-title" onClose={() => setOpen(false)} className={styles.dialog}><form onSubmit={(e) => {
      e.preventDefault();
      try {
        if (!bookingMaterial) throw new Error("INVALID_MATERIAL");
        const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: bookingMaterialId,
          payload: { kind: "stock", material_id: bookingMaterialId, source_id: draft.source_id || null, destination_id: draft.destination_id || null,
            quantity: Number(draft.quantity), note: draft.note, job_id: draft.job_id || null, project_id: draft.project_id || null } };
        validateOperationsMutation({ ...input, id: createStableId() }); enqueue(input); setOpen(false);
        setDraft({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
      } catch { setError("INVALID_OPERATIONS_COMMAND"); }
    }}><header className={styles.dialogHeader}><div><h2 id="stock-title">{t("stock")}</h2>{bookingMaterial && <p>{materialLabel(bookingMaterial)}{bookingMaterial.unit ? ` (${bookingMaterial.unit})` : ""}</p>}</div><button type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button></header><div className={styles.fields}>
      {globalBooking && <label className={styles.field}><span>{t("materialNumber")}</span><select required aria-label={t("materialNumber")} value={bookingMaterialId} onChange={(event) => setBookingMaterialId(event.target.value)}><option value="">—</option>{materials.map((material) => <option key={material.id} value={material.id}>{materialLabel(material)}</option>)}</select></label>}
      {(["source_id", "destination_id", "job_id", "project_id"] as const).map((key) => <label className={styles.field} key={key}><span>{t(key)}</span><select aria-label={t(key)} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}><option value="">—</option>{(key === "job_id" ? jobs : key === "project_id" ? projects : locations).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}
      <label className={styles.field}>{t("quantity")}<input required type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label className={styles.field}>{t("note")}<input required value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
    </div>{error && <p role="alert">{t(error)}</p>}<footer className={styles.actions}><button type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button disabled={!bookingMaterial} type="submit">{t("save")}</button></footer></form></TripDialog>}
  </section>;
}
