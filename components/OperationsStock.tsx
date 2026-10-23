"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, ChevronsUpDown, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { stockMovementNote } from "@/lib/stockMovementNote";
import { loadOperationsReportRows } from "@/lib/operationsReport";
import { validateOperationsMutation, type OperationsRow } from "@/lib/operationsCommands";
import { OperationsDataTable, type DataColumn } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import { StockOverview } from "./StockOverview";
import { OperationsReportActions } from "./OperationsReportActions";
import { SupplierDamageCases } from "./SupplierDamageCases";
import { PersonalBlocks, PersonalBlock } from "./PersonalBlocks";
import styles from "./OperationsWorkspace.module.css";

type Ref = { id: string; name: string; status?: string; billable?: boolean; sku?: string; scanCode?: string; unit?: string; minStock?: string; archived?: boolean };
export function OperationsStock({ language, materials, locations, jobs, queue, enqueue, onMaterialSelected, onShowBookings, view = "overview" }: {
  language: "de" | "sv" | "en"; materials: Ref[]; locations: Ref[]; jobs: Ref[]; projects: Ref[]; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  onMaterialSelected?: (id: string) => void;
  onShowBookings?: () => void;
  view?: "overview" | "bookings" | "inventory";
}) {
  const t = (key: string) => operationLabel(key, language);
  const [materialId, setMaterialId] = useState("");
  const [details, setDetails] = useState<{ kind: "balance" | "movement"; row: OperationsRow } | null>(null);
  const [damageCaseId, setDamageCaseId] = useState<string | null>(null);
  const damageCase = (row: OperationsRow) => row.damage_case as { id: string; description: string; status: string } | null | undefined;
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
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [bookingMaterialId, setBookingMaterialId] = useState("");
  const [draft, setDraft] = useState({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
  const settled = queue.filter((m) => m.entityType === "operations" && m.status === "synced").map((m) => m.id).join(":");
  const total = balances.reduce((sum, row) => sum + Number(row.quantity), 0);
  const selected = materials.find((m) => m.id === materialId);
  const rowMaterial = (row: OperationsRow) => materials.find((material) => material.id === row.material_id) ?? selected;
  const correctionMaterial = correction ? rowMaterial(correction) : undefined;
  const bookingMaterial = materials.find((m) => m.id === bookingMaterialId);
  const materialLabel = (material: Ref) => `${material.sku ? `${material.sku} · ` : ""}${material.name}`;
  const openBooking = () => {
    setBookingMaterialId(selected?.archived ? "" : materialId);
    setError(""); setOpen(true);
  };
  const quantity = (value: unknown) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(Number(value));
  const location = (id: unknown) => locations.find((row) => row.id === id)?.name ?? (id ? t("unknownLocation") : "—");
  const columns: DataColumn[] = [
    { key: "material_id", label: t("material_id"), value: (row) => { const material = rowMaterial(row); return material ? materialLabel(material) : t("unknownMaterial"); }, render: (row) => {
      const material = rowMaterial(row);
      const direction = row.source_id && row.destination_id ? "stockTransfer" : row.destination_id ? "stockIn" : row.source_id ? "stockOut" : "bookings";
      const Icon = direction === "stockIn" ? ArrowDownLeft : direction === "stockOut" ? ArrowUpRight : ArrowLeftRight;
      return <div className={styles.movementDesignation}>
        <span className={`${styles.movementIndicator} ${direction === "stockIn" ? styles.movementIn : direction === "stockOut" ? styles.movementOut : direction === "stockTransfer" ? styles.movementTransfer : ""}`} title={t(direction)}><Icon size={18} aria-hidden="true" /></span>
        <div><strong title={material?.name}>{material?.name ?? t("unknownMaterial")}</strong><small title={`${material?.sku ? `${material.sku} · ` : ""}${t(direction)}`}>{material?.sku ? `${material.sku} · ` : ""}{t(direction)}</small></div>
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
    { key: "note", label: t("note"), value: (row) => String(row.display_note ?? stockMovementNote(row.note)) },
    { key: "job_id", label: t("job_id"), value: (row) => jobs.find((job) => job.id === row.job_id)?.name ?? "" },
    { key: "damage_case", label: t("damageCases"), value: (row) => { const damage = damageCase(row); return damage ? `${t(`damage_${damage.status}`)} · ${damage.description}` : ""; } },
  ];
  const movementColumns = columns.filter((column) => column.key !== "damage_case").map((column) => column.key === "material_id" ? column : {
    ...column,
    render: (row: OperationsRow) => <span className={styles.movementText} title={column.value(row)}>{column.render ? column.render(row) : column.value(row) || "—"}</span>,
  });
  useEffect(() => {
    if (view === "inventory" || (!materialId && view !== "bookings")) return;
    const controller = new AbortController();
    async function load() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setError(""); setLoading(true); setBalances([]); setHistory([]); setCount(0);
      let balance = { rows: [] };
      if (materialId) {
        const balanceResponse = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(materialId)}`, { signal: controller.signal });
        if (!balanceResponse.ok) throw new Error("unavailable");
        balance = await balanceResponse.json();
      }
      const historyResponse = await apiFetch(`/api/operations?entity=stock_movements${materialId ? `&parent=${encodeURIComponent(materialId)}` : ""}&page=${page}`, { signal: controller.signal });
      if (!historyResponse.ok) throw new Error("unavailable");
      const history = await historyResponse.json();
      if (!controller.signal.aborted) { setBalances(balance.rows); setHistory(history.rows); setCount(history.count); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [materialId, page, settled, refresh, view]);
  const selectionSummary = <section className="panel">
    <header className={`panel-title ${styles.stockHeading}`}><div><p>{t("inventorySection")}</p><h2>{view === "bookings" ? t("bookings") : t("stockOverview")}</h2></div><div className={styles.actions}>
      {view === "bookings" && <OperationsReportActions title={t("bookings")} subtitle={selected ? materialLabel(selected) : t("allMaterials")} language={language} scope={`bookings:${materialId}:${page}:${refresh}:${settled}`} disabled={loading || Boolean(error) || !history.length} filters={filters}
        columns={movementColumns.map(column => column.key === "quantity" ? { ...column, exportValue: (row: OperationsRow) => Number(row.quantity) } : column)} loadRows={signal => loadOperationsReportRows("stock_movements", materialId, signal)} />}
      <button className={styles.primaryAction + " create-button"} disabled={!materials.length} aria-label={t("globalStockBooking")} onClick={openBooking}><Plus size={18} />{t("stock")}</button></div></header>
    <div className={styles.toolbar}><label>{t("material_id")} <span className={styles.stockFilter}><select aria-label={t("material_id")} value={materialId} onChange={(e) => { setMaterialId(e.target.value); onMaterialSelected?.(e.target.value); setPage(0); setBalances([]); setHistory([]); setCount(0); setLoading(false); setError(""); }}><option value="">{t("allMaterials")}</option>{materials.map((m) => <option key={m.id} value={m.id}>{materialLabel(m)}</option>)}</select><ChevronsUpDown size={18} aria-hidden="true" /></span></label>
      <button title={t("refresh")} aria-label={t("refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={18} /></button>
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {materialId && view === "overview" && <>
      <div className={`analytics-summary-grid ${styles.stockSummary}`}>
        <div><span>{t("stockTotal")}{selected?.unit ? ` (${selected.unit})` : ""}</span><strong>{loading || error ? "—" : quantity(total)}</strong></div>
        <div><span>{t("locations")}</span><strong>{loading || error ? "—" : balances.filter((row) => Number(row.quantity) !== 0).length}</strong></div>
        <button type="button" className={styles.summaryAction} aria-label={t("bookings")} onClick={onShowBookings}><span>{t("bookings")}</span><strong>{loading || error ? "—" : quantity(count)}</strong></button>
      </div>
      {selected?.minStock && !loading && !error && total < Number(selected.minStock) && <p role="status">{language === "de" ? "Mindestbestand unterschritten" : language === "sv" ? "Under minimilager" : "Below minimum stock"}</p>}
    </>}
    </section>;
  return <div className={`stack ${styles.stockOverview}`}>
    {view === "inventory" && <StockOverview mode="inventory" language={language} materials={materials} locations={locations} settled={`${settled}:${refresh}`}
      pending={queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && ["stock", "receive", "receive_batch", "complete"].includes(String(mutation.payload.kind)))}
      onBooked={() => setRefresh((value) => value + 1)} onSelect={() => {}} />}
    {view === "overview" && <PersonalBlocks scope="inventory.stock.overview" language={language} className="stack">
    <PersonalBlock id="selectionSummary" title={t("stockOverview")}>{selectionSummary}</PersonalBlock>
    <PersonalBlock id="balances" title={t(materialId ? "stockByLocation" : "stockOverview")}>
    {!materialId && view === "overview" && <StockOverview language={language} materials={materials} locations={locations} settled={`${settled}:${refresh}`}
      pending={queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && ["stock", "receive", "receive_batch", "complete"].includes(String(mutation.payload.kind)))}
      onBooked={() => setRefresh((value) => value + 1)} onSelect={(id) => { setMaterialId(id); onMaterialSelected?.(id); setPage(0); }} />}
    {materialId && view === "overview" && <>
      <section className="panel">
      <div className="panel-title"><div><p>{t("inventorySection")}</p><h2>{t("stockByLocation")}</h2></div></div>
      <div className="analytics-table">
      <table className={styles.balanceTable} aria-label={t("stockByLocation")}><thead><tr><th scope="col">{t("location")}</th><th scope="col">{t("quantity")}{selected?.unit ? ` (${selected.unit})` : ""}</th></tr></thead><tbody>
        {balances.map((row) => <tr key={row.location_id} className={styles.clickableRow} tabIndex={0} onClick={() => setDetails({ kind: "balance", row: { ...row, id: row.location_id } })}
          onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setDetails({ kind: "balance", row: { ...row, id: row.location_id } }); } }}><td>{location(row.location_id)}</td><td>{quantity(row.quantity)}</td></tr>)}
        {!balances.length && <tr><td colSpan={2}>{t(loading ? "loading" : error ? "unavailable" : "empty")}</td></tr>}
      </tbody></table>
      </div></section>
    </>}
    </PersonalBlock>
    </PersonalBlocks>}
    {view === "bookings" && <>
    {selectionSummary}
    <section className="panel">
      <OperationsDataTable className={styles.movementTable} rows={history} columns={movementColumns} label={t("bookings")} filterLabel={t("filter")} emptyLabel={t(loading ? "loading" : error ? "unavailable" : "empty")} actionsLabel={t("actions")} onRowActivate={(row) => setDetails({ kind: "movement", row })} onFiltersChange={setFilters} />
    {count > 50 && <div className={styles.toolbar}><button disabled={!page} aria-label={t("previous")} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button disabled={(page + 1) * 50 >= count} aria-label={t("next")} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
      </section>
    </>}
    {open && <TripDialog labelledBy="stock-title" onClose={() => setOpen(false)} className={styles.dialog}><form onSubmit={(e) => {
      e.preventDefault();
      try {
        if (!bookingMaterial || bookingMaterial.archived) throw new Error("INVALID_MATERIAL");
        if (draft.job_id && (!draft.source_id || draft.destination_id || !jobs.some((job) => job.id === draft.job_id && ["geplant", "in Arbeit", "pausiert"].includes(job.status ?? "") && job.billable !== false))) throw new Error("JOB_NOT_OPEN");
        const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: bookingMaterialId,
          payload: { kind: "stock", material_id: bookingMaterialId, source_id: draft.source_id || null, destination_id: draft.destination_id || null,
            quantity: Number(draft.quantity), note: draft.note, job_id: draft.job_id || null, project_id: null } };
        validateOperationsMutation({ ...input, id: createStableId() }); enqueue(input); setOpen(false);
        setDraft({ source_id: "", destination_id: "", quantity: "1", note: "", job_id: "", project_id: "" });
      } catch { setError("INVALID_OPERATIONS_COMMAND"); }
    }}><header className={styles.dialogHeader}><div><h2 id="stock-title">{t("stock")}</h2>{bookingMaterial && <p>{materialLabel(bookingMaterial)}{bookingMaterial.unit ? ` (${bookingMaterial.unit})` : ""}</p>}</div><button type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button></header><div className={styles.fields}>
      <label className={styles.field}><span>{t("designation")}</span><select required aria-label={t("designation")} value={bookingMaterialId} onChange={(event) => setBookingMaterialId(event.target.value)}><option value="">—</option>{materials.filter((material) => !material.archived).map((material) => <option key={material.id} value={material.id}>{materialLabel(material)}</option>)}</select></label>
      {(["source_id", "destination_id", "job_id"] as const).map((key) => <label className={styles.field} key={key}><span>{t(key)}</span><select aria-label={t(key)} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value, ...(key === "job_id" && e.target.value ? { destination_id: "" } : key === "destination_id" && e.target.value ? { job_id: "" } : {}) })}><option value="">—</option>{(key === "job_id" ? jobs.filter((job) => ["geplant", "in Arbeit", "pausiert"].includes(job.status ?? "") && job.billable !== false) : locations.filter((location) => !location.archived)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}
      <label className={styles.field}>{t("quantity")}<input required type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></label><label className={styles.field}>{t("note")}<input required value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
    </div>{error && <p role="alert">{t(error)}</p>}<footer className={styles.actions}><button type="button" onClick={() => setOpen(false)}>{t("cancel")}</button><button disabled={!bookingMaterial} type="submit">{t("save")}</button></footer></form></TripDialog>}
    {details && <TripDialog labelledBy="stock-details-title" onClose={() => setDetails(null)} className={`${styles.dialog} ${styles.itemDialog}`}>
      <header className={styles.dialogHeader}><div><p>{t(details.kind === "balance" ? "stockByLocation" : "bookingDetails")}</p><h2 id="stock-details-title">{rowMaterial(details.row) ? materialLabel(rowMaterial(details.row)!) : ""}</h2></div><button type="button" aria-label={t("close")} onClick={() => setDetails(null)}><X size={18} /></button></header>
      <dl className={styles.itemFacts}>{(details.kind === "balance" ? [
        { label: t("location"), value: location(details.row.location_id) },
        { label: t("quantity"), value: `${quantity(details.row.quantity)}${selected?.unit ? ` ${selected.unit}` : ""}` },
      ] : columns.map((column) => ({ label: column.label, value: column.value(details.row) || "—" }))).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <footer className={styles.actions}><button type="button" onClick={() => setDetails(null)}>{t("close")}</button>{details.kind === "movement" && damageCase(details.row) && <button type="button" onClick={() => { setDamageCaseId(damageCase(details.row)!.id); setDetails(null); }}>{t("damageCases")}</button>}{details.kind === "movement" && Boolean(details.row.source_id || details.row.destination_id) && <button className={styles.primaryAction} disabled={correctionPending(details.row)} onClick={() => {
        setCorrection(details.row); setCorrectionQuantity(String(details.row.quantity)); setCorrectionReason(""); setCorrectionError(false); correctionLock.current = false; setDetails(null);
      }}><ArrowLeftRight size={18} />{t("correction")}</button>}</footer>
    </TripDialog>}
    {correction && <TripDialog labelledBy="stock-correction-title" onClose={() => setCorrection(null)} className={`${styles.dialog} ${styles.itemDialog}`}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (correctionLock.current || correctionPending(correction)) return;
        try {
          const amount = Number(correctionQuantity);
          if (!correctionMaterial || !Number.isFinite(amount) || amount <= 0 || amount > Number(correction.quantity) || !correctionReason.trim()) throw new Error("INVALID_CORRECTION");
          const input = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: correctionMaterial.id,
            payload: { kind: "stock", material_id: correctionMaterial.id, source_id: correction.destination_id || null, destination_id: correction.source_id || null,
              quantity: amount, note: `${t("correction")} [${correction.id}]: ${correctionReason.trim()}`, job_id: correction.job_id || null, project_id: correction.project_id || null } };
          validateOperationsMutation({ ...input, id: createStableId() });
          correctionLock.current = true;
          enqueue(input); setCorrection(null);
        } catch { correctionLock.current = false; setCorrectionError(true); }
      }}>
        <header className={styles.dialogHeader}><div><p>{correctionMaterial ? materialLabel(correctionMaterial) : ""}</p><h2 id="stock-correction-title">{t("correction")}</h2></div><button type="button" aria-label={t("close")} onClick={() => setCorrection(null)}><X size={18} /></button></header>
        <dl className={styles.itemFacts}><div><dt>{t("source_id")}</dt><dd>{location(correction.destination_id)}</dd></div><div><dt>{t("destination_id")}</dt><dd>{location(correction.source_id)}</dd></div></dl>
        <div className={styles.fields}><label className={styles.field}>{t("quantity")}<input required aria-label={t("quantity")} type="number" min="0.001" step="0.001" max={Number(correction.quantity)} value={correctionQuantity} onChange={(event) => setCorrectionQuantity(event.target.value)} /></label>
          <label className={styles.field}>{t("correctionReason")}<input required aria-label={t("correctionReason")} maxLength={9000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label></div>
        {correctionError && <p role="alert">{t("INVALID_OPERATIONS_COMMAND")}</p>}
        <footer className={styles.actions}><button type="button" onClick={() => setCorrection(null)}>{t("cancel")}</button><button type="submit" className={styles.primaryAction} disabled={!correctionReason.trim() || correctionPending(correction)}>{t("bookCorrection")}</button></footer>
      </form>
    </TripDialog>}
    {damageCaseId && <SupplierDamageCases caseId={damageCaseId} language={language} onClose={() => { setDamageCaseId(null); setRefresh((value) => value + 1); }} />}
  </div>;
}
