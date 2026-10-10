"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, ChevronsUpDown, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { validateOperationsMutation, type OperationsRow } from "@/lib/operationsCommands";
import { OperationsDataTable, type DataColumn } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import { StockOverview } from "./StockOverview";
import styles from "./OperationsWorkspace.module.css";

type Ref = { id: string; name: string; sku?: string; unit?: string; minStock?: string; archived?: boolean };
export function OperationsStock({ language, materials, locations, jobs, projects, queue, enqueue, onMaterialSelected }: {
  language: "de" | "sv" | "en"; materials: Ref[]; locations: Ref[]; jobs: Ref[]; projects: Ref[]; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  onMaterialSelected?: (id: string) => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [materialId, setMaterialId] = useState("");
  const [details, setDetails] = useState<{ kind: "balance" | "movement"; row: OperationsRow } | null>(null);
  const [correction, setCorrection] = useState<OperationsRow | null>(null);
  const [correctionQuantity, setCorrectionQuantity] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState(false);
  const correctionLock = useRef(false);
  const correctionPending = (row: OperationsRow) => queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && mutation.payload.kind === "stock" && String(mutation.payload.note ?? "").includes(`[${row.id}]`));
  const [balances, setBalances] = useState<{ location_id: string; quantity: number }[]>([]);
  const [history, setHistory] = useState<OperationsRow[]>([]);
  const [page, setPage] = useState(0), [count, setCount] = useState(0), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(""), [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookingMaterialId, setBookingMaterialId] = useState("");
  const [draft, setDraft] = useState({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
  const settled = queue.filter((m) => m.entityType === "operations" && m.status === "synced").map((m) => m.id).join(":");
  const total = balances.reduce((sum, row) => sum + Number(row.quantity), 0);
  const selected = materials.find((m) => m.id === materialId);
  const bookingMaterial = materials.find((m) => m.id === bookingMaterialId);
  const materialLabel = (material: Ref) => `${material.sku ? `${material.sku} · ` : ""}${material.name}`;
  const openBooking = () => {
    setBookingMaterialId(selected?.archived ? "" : materialId);
    setError(""); setOpen(true);
  };
  const quantity = (value: unknown) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(Number(value));
  const location = (id: unknown) => locations.find((row) => row.id === id)?.name ?? (id ? t("unknownLocation") : "—");
  const columns: DataColumn[] = [
    { key: "material_id", label: t("material_id"), value: () => selected ? materialLabel(selected) : "", render: (row) => {
      const direction = row.source_id && row.destination_id ? "stockTransfer" : row.destination_id ? "stockIn" : row.source_id ? "stockOut" : "bookings";
      const Icon = direction === "stockIn" ? ArrowDownLeft : direction === "stockOut" ? ArrowUpRight : ArrowLeftRight;
      return <div className={styles.movementDesignation}>
        <span className={`${styles.movementIndicator} ${direction === "stockIn" ? styles.movementIn : direction === "stockOut" ? styles.movementOut : direction === "stockTransfer" ? styles.movementTransfer : ""}`} title={t(direction)}><Icon size={18} aria-hidden="true" /></span>
        <div>{selected ? materialLabel(selected) : ""}<small>{t(direction)}</small></div>
      </div>;
    } },
    { key: "occurred_at", label: t("bookedAt"), value: (row) => {
      const date = new Date(String(row.occurred_at));
      return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(language, { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Stockholm" });
    } },
    { key: "actor_name", label: t("bookedBy"), value: (row) => typeof row.actor_name === "string" && row.actor_name.trim() ? row.actor_name : t("unknownActor") },
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
  return <div className={`stack ${styles.stockOverview}`}>
    {!materialId && <StockOverview language={language} materials={materials} locations={locations} settled={settled}
      pending={queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && ["stock", "receive", "receive_batch", "complete"].includes(String(mutation.payload.kind)))}
      onBooked={() => setRefresh((value) => value + 1)} onSelect={(id) => { setMaterialId(id); onMaterialSelected?.(id); setPage(0); }} />}
    <section className="panel">
    <header className={`panel-title ${styles.stockHeading}`}><div><p>{t("inventorySection")}</p><h2>{t("stockOverview")}</h2></div><button className={styles.primaryAction} disabled={!materials.length} aria-label={t("globalStockBooking")} onClick={openBooking}><Plus size={18} />{t("stock")}</button></header>
    <div className={styles.toolbar}><label>{t("material_id")} <span className={styles.stockFilter}><select aria-label={t("material_id")} value={materialId} onChange={(e) => { setMaterialId(e.target.value); onMaterialSelected?.(e.target.value); setPage(0); setBalances([]); setHistory([]); setCount(0); setLoading(false); setError(""); }}><option value="">{t("allMaterials")}</option>{materials.map((m) => <option key={m.id} value={m.id}>{materialLabel(m)}</option>)}</select><ChevronsUpDown size={18} aria-hidden="true" /></span></label>
      <button disabled={!materialId} title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {materialId && <>
      <div className={`analytics-summary-grid ${styles.stockSummary}`}>
        <div><span>{t("stockTotal")}{selected?.unit ? ` (${selected.unit})` : ""}</span><strong>{loading || error ? "—" : quantity(total)}</strong></div>
        <div><span>{t("locations")}</span><strong>{loading || error ? "—" : balances.filter((row) => Number(row.quantity) !== 0).length}</strong></div>
        <div><span>{t("bookings")}</span><strong>{loading || error ? "—" : quantity(count)}</strong></div>
      </div>
      {selected?.minStock && !loading && !error && total < Number(selected.minStock) && <p role="status">{language === "de" ? "Mindestbestand unterschritten" : language === "sv" ? "Under minimilager" : "Below minimum stock"}</p>}
    </>}
    </section>
    {materialId && <>
      <section className="panel">
      <div className="panel-title"><div><p>{t("inventorySection")}</p><h2>{t("stockByLocation")}</h2></div></div>
      <div className="analytics-table">
      <table className={styles.balanceTable} aria-label={t("stockByLocation")}><thead><tr><th scope="col">{t("location")}</th><th scope="col">{t("quantity")}{selected?.unit ? ` (${selected.unit})` : ""}</th></tr></thead><tbody>
        {balances.map((row) => <tr key={row.location_id} className={styles.clickableRow} tabIndex={0} onClick={() => setDetails({ kind: "balance", row: { ...row, id: row.location_id } })}
          onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setDetails({ kind: "balance", row: { ...row, id: row.location_id } }); } }}><td>{location(row.location_id)}</td><td>{quantity(row.quantity)}</td></tr>)}
        {!balances.length && <tr><td colSpan={2}>{t(loading ? "loading" : error ? "unavailable" : "empty")}</td></tr>}
      </tbody></table>
      </div></section>
      <section className="panel">
      <div className="panel-title"><div><p>{t("inventorySection")}</p><h2>{t("bookings")}</h2></div></div>
      <OperationsDataTable key={`${materialId}:${page}`} rows={history} columns={columns} label={t("bookings")} filterLabel={t("filter")} emptyLabel={t(loading ? "loading" : error ? "unavailable" : "empty")} actionsLabel={t("actions")} onRowActivate={(row) => setDetails({ kind: "movement", row })} />
    {count > 50 && <div className={styles.toolbar}><button disabled={!page} aria-label={t("previous")} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button disabled={(page + 1) * 50 >= count} aria-label={t("next")} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
      </section>
    </>}
    {open && <TripDialog labelledBy="stock-title" onClose={() => setOpen(false)} className={styles.dialog}><form onSubmit={(e) => {
      e.preventDefault();
      try {
        if (!bookingMaterial || bookingMaterial.archived) throw new Error("INVALID_MATERIAL");
        const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: bookingMaterialId,
          payload: { kind: "stock", material_id: bookingMaterialId, source_id: draft.source_id || null, destination_id: draft.destination_id || null,
            quantity: Number(draft.quantity), note: draft.note, job_id: draft.job_id || null, project_id: draft.project_id || null } };
        validateOperationsMutation({ ...input, id: createStableId() }); enqueue(input); setOpen(false);
        setDraft({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
      } catch { setError("INVALID_OPERATIONS_COMMAND"); }
    }}><header className={styles.dialogHeader}><div><h2 id="stock-title">{t("stock")}</h2>{bookingMaterial && <p>{materialLabel(bookingMaterial)}{bookingMaterial.unit ? ` (${bookingMaterial.unit})` : ""}</p>}</div><button type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button></header><div className={styles.fields}>
      <label className={styles.field}><span>{t("designation")}</span><select required aria-label={t("designation")} value={bookingMaterialId} onChange={(event) => setBookingMaterialId(event.target.value)}><option value="">—</option>{materials.filter((material) => !material.archived).map((material) => <option key={material.id} value={material.id}>{materialLabel(material)}</option>)}</select></label>
      {(["source_id", "destination_id", "job_id", "project_id"] as const).map((key) => <label className={styles.field} key={key}><span>{t(key)}</span><select aria-label={t(key)} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}><option value="">—</option>{(key === "job_id" ? jobs : key === "project_id" ? projects : locations).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}
      <label className={styles.field}>{t("quantity")}<input required type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label className={styles.field}>{t("note")}<input required value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
    </div>{error && <p role="alert">{t(error)}</p>}<footer className={styles.actions}><button type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button disabled={!bookingMaterial} type="submit">{t("save")}</button></footer></form></TripDialog>}
    {details && <TripDialog labelledBy="stock-details-title" onClose={() => setDetails(null)} className={`${styles.dialog} ${styles.itemDialog}`}>
      <header className={styles.dialogHeader}><div><p>{t(details.kind === "balance" ? "stockByLocation" : "bookingDetails")}</p><h2 id="stock-details-title">{selected ? materialLabel(selected) : ""}</h2></div><button type="button" aria-label={t("close")} onClick={() => setDetails(null)}><X size={18} /></button></header>
      <dl className={styles.itemFacts}>{(details.kind === "balance" ? [
        { label: t("location"), value: location(details.row.location_id) },
        { label: t("quantity"), value: `${quantity(details.row.quantity)}${selected?.unit ? ` ${selected.unit}` : ""}` },
      ] : columns.map((column) => ({ label: column.label, value: column.value(details.row) || "—" }))).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <footer className={styles.actions}><button type="button" onClick={() => setDetails(null)}>{t("close")}</button>{details.kind === "movement" && Boolean(details.row.source_id || details.row.destination_id) && <button className={styles.primaryAction} disabled={correctionPending(details.row)} onClick={() => {
        setCorrection(details.row); setCorrectionQuantity(String(details.row.quantity)); setCorrectionReason(""); setCorrectionError(false); correctionLock.current = false; setDetails(null);
      }}><ArrowLeftRight size={18} />{t("correction")}</button>}</footer>
    </TripDialog>}
    {correction && <TripDialog labelledBy="stock-correction-title" onClose={() => setCorrection(null)} className={`${styles.dialog} ${styles.itemDialog}`}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (correctionLock.current || correctionPending(correction)) return;
        try {
          const amount = Number(correctionQuantity);
          if (!selected || !Number.isFinite(amount) || amount <= 0 || amount > Number(correction.quantity) || !correctionReason.trim()) throw new Error("INVALID_CORRECTION");
          const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: selected.id,
            payload: { kind: "stock", material_id: selected.id, source_id: correction.destination_id || null, destination_id: correction.source_id || null,
              quantity: amount, note: `${t("correction")} [${correction.id}]: ${correctionReason.trim()}`, job_id: correction.job_id || null, project_id: correction.project_id || null } };
          validateOperationsMutation({ ...input, id: createStableId() });
          correctionLock.current = true;
          enqueue(input); setCorrection(null);
        } catch { correctionLock.current = false; setCorrectionError(true); }
      }}>
        <header className={styles.dialogHeader}><div><p>{selected ? materialLabel(selected) : ""}</p><h2 id="stock-correction-title">{t("correction")}</h2></div><button type="button" aria-label={t("close")} onClick={() => setCorrection(null)}><X size={18} /></button></header>
        <dl className={styles.itemFacts}><div><dt>{t("source_id")}</dt><dd>{location(correction.destination_id)}</dd></div><div><dt>{t("destination_id")}</dt><dd>{location(correction.source_id)}</dd></div></dl>
        <div className={styles.fields}><label className={styles.field}>{t("quantity")}<input required aria-label={t("quantity")} type="number" min="0.001" step="0.001" max={Number(correction.quantity)} value={correctionQuantity} onChange={(event) => setCorrectionQuantity(event.target.value)} /></label>
          <label className={styles.field}>{t("correctionReason")}<input required aria-label={t("correctionReason")} maxLength={9000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label></div>
        {correctionError && <p role="alert">{t("INVALID_OPERATIONS_COMMAND")}</p>}
        <footer className={styles.actions}><button type="button" onClick={() => setCorrection(null)}>{t("cancel")}</button><button type="submit" className={styles.primaryAction} disabled={!correctionReason.trim() || correctionPending(correction)}>{t("bookCorrection")}</button></footer>
      </form>
    </TripDialog>}
  </div>;
}
