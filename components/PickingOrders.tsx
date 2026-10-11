"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Plus, Printer, RefreshCw, ScanLine, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { pickingPdf, type PickingItem, type PickingOrder } from "@/lib/picking";
import { OperationsDataTable } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import { StockScan } from "./StockScan";
import { CodeCamera } from "./CodeCamera";
import { PickingDispatch } from "./PickingDispatch";
import { codeLabelPdf } from "@/lib/locationLabel";
import styles from "./OperationsWorkspace.module.css";

export function PickingOrders({ job, language, queue = [], onBooked, pickupOnly }: {
  job?: { id: string; revision?: number; status: string; materialItems?: unknown[] }; language: "de" | "sv" | "en";
  queue?: SyncMutation[]; onBooked?: () => void; pickupOnly?: boolean;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [open, setOpen] = useState(!job), [rows, setRows] = useState<PickingOrder[]>([]), [page, setPage] = useState(0), [count, setCount] = useState(0);
  const [choices, setChoices] = useState<PickingOrder[]>([]);
  const [order, setOrder] = useState<PickingOrder | null>(null), [items, setItems] = useState<PickingItem[]>([]);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [scan, setScan] = useState(false), [code, setCode] = useState(""), [camera, setCamera] = useState(false);
  const lock = useRef(false), createId = useRef(createStableId());
  const [dispatch, setDispatch] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false), [cancelReason, setCancelReason] = useState("");
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const orderId = order?.id, jobId = job?.id;
  const pending = queue.some((mutation) => mutation.status !== "synced" && (mutation.entityType === "job" && mutation.entityId === job?.id || mutation.entityType === "operations" && mutation.payload.kind === "stock"));
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      const response = await apiFetch(`/api/picking-orders?${!job ? "active=1&" : ""}${orderId ? `id=${orderId}` : `page=${page}${jobId ? `&job=${encodeURIComponent(jobId)}` : ""}${pickupOnly ? "&ready=1" : ""}`}`, { signal: controller.signal });
      if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
      const data = await response.json() as { rows: PickingOrder[]; items: PickingItem[]; count: number; events?: Record<string, unknown>[] };
      if (controller.signal.aborted) return;
      if (orderId) { if (!data.rows[0] || !job && data.rows[0].status === "cancelled") { setOrder(null); setItems([]); throw new Error("scanUnknown"); } setOrder(data.rows[0]); setItems(data.items); setEvents(data.events ?? []); }
      else {
        setRows(job ? data.rows : data.rows.filter((row) => row.status !== "cancelled")); setCount(data.count);
        const all: PickingOrder[] = [];
        for (let choicePage = 0; ; choicePage++) {
          const choiceResponse = choicePage === page ? null : await apiFetch(`/api/picking-orders?${!job ? "active=1&" : ""}page=${choicePage}${jobId ? `&job=${encodeURIComponent(jobId)}` : ""}${pickupOnly ? "&ready=1" : ""}`, { signal: controller.signal });
          if (choiceResponse && !choiceResponse.ok) throw new Error("OPERATIONS_UNAVAILABLE");
          const choiceData = choiceResponse ? await choiceResponse.json() as { rows: PickingOrder[]; count: number } : data;
          all.push(...(job ? choiceData.rows : choiceData.rows.filter((row) => row.status !== "cancelled")));
          if (choiceData.rows.length < 50 || (choicePage + 1) * 50 >= choiceData.count) break;
        }
        if (!controller.signal.aborted) setChoices(all);
      }
    }
    void load().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error && cause.message === "scanUnknown" ? "scanUnknown" : "OPERATIONS_UNAVAILABLE"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, orderId, page, refresh, jobId, pickupOnly]);

  async function command(input: Record<string, unknown>) {
    const response = await apiFetch("/api/picking-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "OPERATIONS_UNAVAILABLE");
    return data;
  }
  async function create() {
    if (!job || lock.current || pending) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await command({ action: "create", id: createId.current, job: job.id, revision: job.revision ?? 1 });
      createId.current = createStableId(); setOrder({ id: result.id } as PickingOrder); setItems([]); setRefresh((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "OPERATIONS_UNAVAILABLE"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function print() {
    if (!order || busy) return;
    setBusy(true); setError("");
    try {
      const blob = await pickingPdf(order, items, language), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `Kommissionierung-${order.picking_code ?? "Liste"}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError("OPERATIONS_UNAVAILABLE"); } finally { setBusy(false); }
  }
  function accept(value: string) {
    if (lock.current) return;
    setCamera(false); setError("");
    if (value.trim().startsWith("PICKUP:")) {
      const pickup = value.trim().slice(7);
      if (!/^[0-9a-f-]{36}$/i.test(pickup)) { setError("scanUnknown"); return; }
      void apiFetch(`/api/picking-orders?${!job ? "active=1&" : ""}pickup=${encodeURIComponent(pickup)}`).then(async (response) => {
        if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
        const data = await response.json(); const ready = data.rows?.[0] as PickingOrder | undefined;
        if (!ready || !["completed", "loaded"].includes(ready.status)) throw new Error("PICKING_INVALID_PICKUP");
        setOrder(ready); setItems(data.items ?? []); setDispatch(true); setCode("");
      }).catch((cause) => setError(cause instanceof Error ? cause.message : "OPERATIONS_UNAVAILABLE"));
      return;
    }
    const id = value.trim().replace(/^PICK:/, "");
    if (/^\d{4}-\d{2}-\d{2}-\d{5}$/.test(id)) {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      void apiFetch(`/api/picking-orders?${!job ? "active=1&" : ""}code=${encodeURIComponent(id)}`).then(async (response) => {
        if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
        const data = await response.json();
        if (data.rows?.length !== 1 || !job && data.rows[0].status === "cancelled") throw new Error("scanUnknown");
        setOrder(data.rows[0]); setItems(data.items ?? []); setCode("");
      }).catch((cause) => setError(cause instanceof Error && cause.message === "scanUnknown" ? "scanUnknown" : "OPERATIONS_UNAVAILABLE"))
        .finally(() => { lock.current = false; setBusy(false); });
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { setError("scanUnknown"); return; }
    setOrder({ id } as PickingOrder); setItems([]); setCode("");
  }
  const contents = <>
    <header className={styles.dialogHeader}><div><p>{t("inventorySection")}</p><h2 id="picking-title">{t("pickingOrders")}</h2>{order?.title && <p>{order.title}</p>}</div>
      <div className={styles.actions}>{job && !order && <button type="button" className={styles.primaryAction} disabled={busy || pending || !["geplant", "in Arbeit", "pausiert"].includes(job.status)} onClick={() => void create()}><Plus size={18} />{t("createPicking")}</button>}
      <button type="button" aria-label={t("refresh")} disabled={busy} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} /></button>
      {job && <button type="button" disabled={busy} aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button>}</div></header>
    {loading && <p role="status">{t("loading")}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {pending && <p role="status">{t("waiting")}</p>}
    {!order && <>
      <label className={styles.field}><span>{t("selectPicking")}</span><select aria-label={t("selectPicking")} value="" disabled={loading || busy || Boolean(error) || !choices.length} onChange={(event) => { const selected = choices.find((row) => row.id === event.target.value); if (selected) { setCamera(false); setCode(""); setError(""); setOrder(selected); setItems([]); } }}>
        <option value="">{t("selectPicking")}</option>
        {(pickupOnly ? choices.filter((row) => ["completed", "loaded"].includes(row.status)) : choices).map((row) => <option key={row.id} value={row.id}>{row.picking_code ? `${row.picking_code} · ` : ""}{row.title} · {t(`picking_${row.status}`)}</option>)}
      </select></label>
      <form className={styles.scanInput} onSubmit={(event) => { event.preventDefault(); accept(code); }}><label className={styles.field}><span>{t("pickingCode")}</span><input disabled={busy} aria-label={t("pickingCode")} value={code} onChange={(event) => setCode(event.target.value)} /></label><button type="submit" disabled={busy || !code.trim()}><ScanLine size={18} />{t("open")}</button><button disabled={busy} type="button" onClick={() => setCamera(true)}><Camera size={18} />{t("scanCamera")}</button></form>
      {camera && <CodeCamera label={t("scanCamera")} onCode={accept} onError={() => { setCamera(false); setError("scanCameraError"); }} />}
      <OperationsDataTable rows={pickupOnly ? rows.filter((row) => row.status === "completed" || row.status === "loaded") : rows} columns={[
        { key: "picking_code", label: t("pickingCode"), value: (row) => String(row.picking_code ?? "—") }, { key: "title", label: t("job_id"), value: (row) => String(row.title) },
        { key: "created_at", label: t("bookedAt"), value: (row) => new Date(String(row.created_at)).toLocaleString(language, { timeZone: "Europe/Stockholm" }) },
        { key: "status", label: t("status"), value: (row) => t(`picking_${row.status}`) },
      ]} label={t("pickingOrders")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} onRowActivate={(row) => { if (busy) return; setOrder(row as PickingOrder); setItems([]); }} />
      {count > 50 && <div className={styles.actions}><button type="button" aria-label={t("previous")} disabled={!page} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span>{page + 1}</span><button type="button" aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div>}
    </>}
    {order && !loading && order.title && <>
      <p>{t("pickingCode")}: {order.picking_code ?? "—"} · {t(`picking_${order.status}`)}</p>
      {order.pickup_code && <div className={styles.actions}><span>{t("pickingPickupCode")}: PICKUP:{order.pickup_code}</span><button type="button" disabled={busy} onClick={async () => {
        setBusy(true); try { const blob = await codeLabelPdf({ heading: t("pickingPickupCode"), name: order.title, code: `PICKUP:${order.pickup_code}` }); const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `Abholung-${order.id}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch { setError("OPERATIONS_UNAVAILABLE"); } finally { setBusy(false); }
      }}><Printer size={18} />{t("pickingPickupPrint")}</button></div>}
      <OperationsDataTable rows={items.map((item) => ({ ...item, id: item.material_id }))} columns={[
        { key: "name", label: t("designation"), value: (row) => (row.material as PickingItem["material"]).name },
        { key: "sku", label: t("materialSkuColumn"), value: (row) => (row.material as PickingItem["material"]).sku ?? "" },
        { key: "scan_code", label: t("materialScanCode"), value: (row) => (row.material as PickingItem["material"]).scan_code ?? "" },
        { key: "quantity", label: t("pickingRequired"), value: (row) => `${row.quantity} ${(row.material as PickingItem["material"]).unit ?? ""}` },
        { key: "picked", label: t("pickingPicked"), value: (row) => String(row.picked) },
        { key: "remaining", label: t("pickingRemaining"), value: (row) => String(Number(row.quantity) - Number(row.picked)) },
      ]} label={t("pickingOrders")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} />
      <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => { setOrder(null); setItems([]); setError(""); }}><ChevronLeft size={18} />{t("scanBack")}</button><button type="button" disabled={busy || !items.length} onClick={() => void print()}><Printer size={18} />{t("pickingPdf")}</button>
        {(order.status === "completed" || order.status === "loaded") && <button className={styles.primaryAction} disabled={busy || pending} onClick={() => setDispatch(true)}><ScanLine size={18} />{t("pickingDispatch")}</button>}
        {order.status === "open" && <><button type="button" disabled={busy || pending || items.some((item) => Number(item.picked) > 0)} onClick={() => { setCancelReason(""); setError(""); setCancelDialog(true); }}>{t("pickingCancel")}</button>
        <button type="button" className={styles.primaryAction} disabled={busy || pending || !items.length} onClick={() => setScan(true)}><ScanLine size={18} />{t("pickingScan")}</button></>}
      </footer>
      <h3>{t("pickingHistory")}</h3>
      {!events.length && <p>{t("pickingHistoryUnavailable")}</p>}
      {events.map((event) => <div key={String(event.id)}><p><strong>{t(`pickingEvent_${event.action}`)}</strong> · {new Date(String(event.occurred_at)).toLocaleString(language, { timeZone: "Europe/Stockholm" })} · {String(event.actor_name ?? t("pickingActorUnknown"))} · {t(`picking_${event.status}`)}</p>{event.note ? <p>{String(event.note)}</p> : null}</div>)}
    </>}
  </>;
  return <>
    {cancelDialog && order && <TripDialog labelledBy="picking-cancel-title" className={styles.itemDialog} onClose={() => { if (!busy) setCancelDialog(false); }}>
      <header className={styles.dialogHeader}><h2 id="picking-cancel-title">{t("pickingCancelConfirm")}</h2><button type="button" disabled={busy} aria-label={t("close")} onClick={() => setCancelDialog(false)}><X size={18} /></button></header>
      <p>{order.title}{order.picking_code ? ` · ${order.picking_code}` : ""}</p>
      <p>{t("pickingCancelWarning")}</p>
      <form onSubmit={async (event) => { event.preventDefault(); if (lock.current || !cancelReason.trim() || pending) return; lock.current = true; setBusy(true); setError("");
        try { await command({ action: "cancel", id: order.id, revision: order.revision, reason: cancelReason.trim() }); setCancelDialog(false); if (!job) { setOrder(null); setItems([]); } setRefresh((value) => value + 1); }
        catch (cause) { setError(cause instanceof Error && t(cause.message) !== cause.message ? cause.message : "OPERATIONS_UNAVAILABLE"); }
        finally { lock.current = false; setBusy(false); }
      }}><label className={styles.field}><span>{t("pickingCancelReason")}</span><textarea required maxLength={2000} disabled={busy} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
        {error && <p role="alert">{t(error)}</p>}
        <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => setCancelDialog(false)}>{t("cancel")}</button><button type="submit" disabled={busy || pending || !cancelReason.trim()}>{t("pickingCancelConfirm")}</button></footer>
      </form>
    </TripDialog>}
    {dispatch && order && <PickingDispatch order={order} items={items} language={language} onClose={() => setDispatch(false)} onBook={async (input) => { await command({ action: "dispatch", order: order.id, revision: order.revision, ...input }); setDispatch(false); setRefresh((value) => value + 1); onBooked?.(); }} />}
    {job && <button className="ghost-button" type="button" onClick={() => setOpen(true)}><ScanLine size={16} />{t("pickingOrders")}</button>}
    {open && (job ? <TripDialog labelledBy="picking-title" onClose={() => { if (!busy) setOpen(false); }} className={styles.dialog}>{contents}</TripDialog> : <section className="panel">{contents}</section>)}
    {open && scan && order && <StockScan language={language} queue={queue} enqueue={() => {}} materials={items.filter((item) => Number(item.picked) < Number(item.quantity)).map((item) => ({ id: item.material_id, name: item.material.name, unit: item.material.unit, sku: item.material.sku, scanCode: item.material.scan_code ?? undefined }))}
      picking={{ order, items, onBook: async (input) => { await command({ action: "pick", order: order.id, revision: order.revision, ...input }); } }}
      onClose={() => setScan(false)} onQueued={() => { setScan(false); setRefresh((value) => value + 1); onBooked?.(); }} />}
  </>;
}
