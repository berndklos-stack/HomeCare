"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ScanLine, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { validateOperationsMutation } from "@/lib/operationsCommands";
import { operationLabel } from "@/lib/operationsUi";
import { ScanSurface } from "./ScanSurface";
import { CodeCamera } from "./CodeCamera";
import styles from "./OperationsWorkspace.module.css";
import type { PickingItem, PickingOrder } from "@/lib/picking";

type Material = { id: string; name: string; sku?: string; scanCode?: string; unit?: string; archived?: boolean };
type Location = { id: string; name: string; location_code: string; parent_location_id?: string | null; archived?: boolean };
type Balance = { rows: { location_id: string; quantity: number }[] };
type TargetJob = { id: string; name: string; code: string; status: string; billable?: boolean };

export function StockScan({ materials, language, queue, enqueue, onClose, onQueued, picking, issue, inline }: {
  materials: Material[]; language: "de" | "sv" | "en"; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  onClose: () => void; onQueued: () => void;
  issue?: boolean; inline?: boolean;
  picking?: { order: PickingOrder; items: PickingItem[]; onBook: (input: { id: string; material: string; source: string; destination: string; quantity: number }) => Promise<void> };
}) {
  const t = (key: string) => operationLabel(key, language);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobs, setJobs] = useState<TargetJob[]>([]), [objects, setObjects] = useState<{ code: string }[]>([]);
  const [targetJob, setTargetJob] = useState<TargetJob | null>(null);
  const [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(false), [reload, setReload] = useState(0);
  const [material, setMaterial] = useState<Material | null>(null);
  const [source, setSource] = useState<Location | null>(null), [destination, setDestination] = useState<Location | null>(null);
  const [step, setStep] = useState(0), [code, setCode] = useState(""), [camera, setCamera] = useState(false);
  const [quantity, setQuantity] = useState("1"), [note, setNote] = useState("");
  const [available, setAvailable] = useState<number | null>(null), [balanceError, setBalanceError] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const bookingId = useRef(createStableId());
  const locked = useRef(false), input = useRef<HTMLInputElement>(null), alive = useRef(true);
  const pending = !!material && queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && mutation.resourceId === material.id);
  const pickingItem = picking?.items.find((item) => item.material_id === material?.id);
  const maxQuantity = available === null ? undefined : Math.min(available, pickingItem ? Number(pickingItem.quantity) - Number(pickingItem.picked) : Infinity);
  const steps = [t("scanMaterial"), t("scanSource"), t("scanDestination"), t("scanReview")];
  const placeLabel = (place: Location) => `${place.parent_location_id ? `${locations.find((row) => row.id === place.parent_location_id)?.name ?? ""} / ` : ""}${place.name}`;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoaded(false); setLoadError(false);
      const all: Location[] = [];
      const targetResponse = await apiFetch("/api/operations?entity=scan_targets", { signal: controller.signal });
      if (!targetResponse.ok) throw new Error("unavailable");
      const targets = await targetResponse.json() as { jobs?: TargetJob[]; objects?: { code: string }[] };
      for (const storagePlaces of [false, true]) {
        for (let page = 0; ; page++) {
          const response = await apiFetch(`/api/operations?entity=location_details&page=${page}${storagePlaces ? "&storage_places=1" : ""}`, { signal: controller.signal });
          if (!response.ok) throw new Error("unavailable");
          const data = await response.json() as { rows: Location[]; count: number };
          all.push(...data.rows);
          if (all.length > 10000) throw new Error("too_many_locations");
          if ((page + 1) * 50 >= data.count || data.rows.length < 50) break;
        }
      }
      if (!controller.signal.aborted) { setJobs(targets.jobs ?? []); setObjects(targets.objects ?? []); setLocations(all.filter((row) => !row.archived)); setLoaded(true); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => { if (window.matchMedia("(pointer: fine)").matches) input.current?.focus(); }, [step, loaded]);
  useEffect(() => {
    if (!material || !source) return;
    const controller = new AbortController();
    async function load() {
      setAvailable(null); setBalanceError(false);
      const response = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(material!.id)}`, { signal: controller.signal });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json() as Balance;
      const amount = Number(data.rows.find((row) => row.location_id === source!.id)?.quantity ?? 0);
      if (!Number.isFinite(amount)) throw new Error("invalid_balance");
      if (!controller.signal.aborted) setAvailable(amount);
    }
    void load().catch(() => { if (!controller.signal.aborted) setBalanceError(true); });
    return () => controller.abort();
  }, [material, source, reload]);

  function accept(value: string) {
    setCamera(false); setError("");
    const scanned = value.trim();
    if (!scanned || scanned.length > 128) { setError("scanUnknown"); return; }
    if (objects.some((object) => object.code === scanned)) { setError("OBJECT_NOT_BOOKABLE"); return; }
    if (step === 2 && !picking) {
      const jobMatches = jobs.filter((job) => job.code === scanned);
      if (jobMatches.length) {
        if (jobMatches.length !== 1 || locations.some((place) => place.location_code === scanned)) { setError("scanAmbiguous"); return; }
        if (!["geplant", "in Arbeit", "pausiert"].includes(jobMatches[0].status)) { setError("JOB_NOT_OPEN"); return; }
        if (jobMatches[0].billable === false) { setError("JOB_NOT_BILLABLE"); return; }
        setTargetJob(jobMatches[0]); setDestination(null); setCode(""); setStep(3); return;
      }
    }
    const matches = step === 0 ? materials.filter((row) => !row.archived && row.scanCode === scanned) : locations.filter((row) => row.location_code === scanned);
    if (issue && step === 2) { setError("PICKING_WRONG_JOB"); return; }
    if (matches.length !== 1) { setError(matches.length > 1 ? "scanAmbiguous" : "scanUnknown"); return; }
    if (step === 0) { setMaterial(matches[0] as Material); setSource(null); setDestination(null); setTargetJob(null); }
    if (picking && step === 0 && !picking.items.some((item) => item.material_id === matches[0].id && Number(item.picked) < Number(item.quantity))) { setMaterial(null); setError("INVALID_PICKING_QUANTITY"); return; }
    if (step === 1) { setSource(matches[0] as Location); setDestination(null); setTargetJob(null); }
    if (step === 2) {
      if (matches[0].id === source?.id) { setError("scanSameLocation"); return; }
      if (picking?.order.staging_id && matches[0].id !== picking.order.staging_id) { setError("PICKING_INVALID_PLACE"); return; }
      setDestination(matches[0] as Location);
      setTargetJob(null);
    }
    setCode(""); setStep((value) => value + 1);
  }

  async function book() {
    if (locked.current || pending || !material || !source || (!destination && !targetJob)) return;
    setError("");
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.000001) { setError("INVALID_OPERATIONS_COMMAND"); return; }
    if (source.id === destination?.id || !materials.some((row) => row.id === material.id && !row.archived && row.scanCode === material.scanCode)) { setError("scanUnknown"); return; }
    locked.current = true; setBusy(true);
    try {
      if (targetJob) {
        const response = await apiFetch("/api/operations?entity=scan_targets");
        if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
        const data = await response.json() as { jobs: TargetJob[]; objects: { code: string }[] };
        const matches = data.jobs.filter((job) => job.code === targetJob.code);
        if (matches.length !== 1 || matches[0].id !== targetJob.id || !["geplant", "in Arbeit", "pausiert"].includes(matches[0].status)) throw new Error("JOB_NOT_OPEN");
        if (matches[0].billable === false) throw new Error("JOB_NOT_BILLABLE");
        if (data.objects.some((object) => object.code === targetJob.code)) throw new Error("OBJECT_NOT_BOOKABLE");
      }
      const response = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(material.id)}`);
      if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
      const data = await response.json() as Balance;
      const balance = Number(data.rows.find((row) => row.location_id === source.id)?.quantity ?? 0);
      if (!alive.current) return;
      if (!Number.isFinite(balance)) throw new Error("OPERATIONS_UNAVAILABLE");
      setAvailable(balance);
      if (amount > balance) throw new Error("INSUFFICIENT_STOCK");
      if (picking) {
        await picking.onBook({ id: bookingId.current, material: material.id, source: source.id, destination: destination!.id, quantity: amount });
        onQueued(); return;
      }
      const command = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: material.id,
        payload: { kind: "stock", material_id: material.id, source_id: source.id, destination_id: destination?.id ?? null, quantity: amount, note: note.trim() || t(targetJob ? "scanJobBooking" : "scanTransfer"), job_id: targetJob?.id ?? null, project_id: null } };
      validateOperationsMutation({ ...command, id: createStableId() });
      enqueue(command); onQueued();
    } catch (cause) { if (alive.current) setError(cause instanceof Error && ["INSUFFICIENT_STOCK", "INVALID_OPERATIONS_COMMAND", "JOB_NOT_OPEN", "JOB_NOT_BILLABLE", "OBJECT_NOT_BOOKABLE", "PICKING_CHANGED", "PICKING_JOB_CHANGED", "INVALID_PICKING_QUANTITY"].includes(cause.message) ? cause.message : "OPERATIONS_UNAVAILABLE"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  return <ScanSurface inline={inline} labelledBy="stock-scan-title" onClose={() => { if (!busy) onClose(); }} className={styles.dialog}>
    <header className={styles.dialogHeader}><div><p>{t("inventorySection")}</p><h2 id="stock-scan-title">{t(issue ? "goodsIssueDirect" : picking ? "pickingScan" : "scanTransfer")}</h2></div><button type="button" disabled={busy} aria-label={t(inline ? "scanBack" : "close")} title={t(inline ? "scanBack" : "close")} onClick={onClose}>{inline ? <ArrowLeft size={18} /> : <X size={18} />}</button></header>
    <ol className={styles.scanSteps}>{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}</ol>
    {!loaded && <p role={loadError ? "alert" : "status"}>{t(loadError ? "OPERATIONS_UNAVAILABLE" : "loading")}{loadError && <button type="button" onClick={() => setReload((value) => value + 1)}>{t("retry")}</button>}</p>}
    <dl className={styles.itemFacts}>
      {material && <div><dt>{t("designation")}</dt><dd>{material.sku ? `${material.sku} · ` : ""}{material.name}</dd></div>}
      {material?.scanCode && <div><dt>{t("materialScanCode")}</dt><dd>{material.scanCode}</dd></div>}
      {source && <div><dt>{t("source_id")}</dt><dd>{placeLabel(source)}</dd></div>}
      {destination && <div><dt>{t("destination_id")}</dt><dd>{placeLabel(destination)}</dd></div>}
      {targetJob && <div><dt>{t("job_id")}</dt><dd>{targetJob.name} · {targetJob.code}</dd></div>}
      {picking && material && <div><dt>{t("pickingRemaining")}</dt><dd>{Number(picking.items.find((item) => item.material_id === material.id)?.quantity ?? 0) - Number(picking.items.find((item) => item.material_id === material.id)?.picked ?? 0)} {material.unit}</dd></div>}
    </dl>
    {loaded && step < 3 && <form onSubmit={(event) => { event.preventDefault(); accept(code); }}>
      <h3>{steps[step]}</h3>
      {camera ? <><CodeCamera label={t("scanCamera")} onCode={accept} onError={() => { setCamera(false); setError("scanCameraError"); }} /><button type="button" onClick={() => setCamera(false)}>{t("cancel")}</button></> : <button type="button" onClick={() => { setError(""); setCamera(true); }}><Camera size={18} />{t("scanCamera")}</button>}
      <div className={styles.scanInput}><label className={styles.field}><span>{t("scanCode")}</span><input ref={input} aria-label={t("scanCode")} maxLength={128} autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} /></label><button type="submit" disabled={!code.trim()}><ScanLine size={18} />{t("scanAccept")}</button></div>
    </form>}
    {step === 3 && <form onSubmit={(event) => { event.preventDefault(); void book(); }}>
      <p role="status">{t("scanAvailable")}: {available === null ? t(balanceError ? "OPERATIONS_UNAVAILABLE" : "loading") : new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(available)} {material?.unit}</p>
      {balanceError && <button type="button" onClick={() => setReload((value) => value + 1)}>{t("retry")}</button>}
      <div className={styles.fields}><label className={styles.field}><span>{t("quantity")}{material?.unit ? ` (${material.unit})` : ""}</span><input required aria-label={t("quantity")} type="number" min="0.001" step="0.001" max={maxQuantity} value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} /></label><label className={styles.field}><span>{t("note")}</span><input value={note} maxLength={9000} disabled={busy || Boolean(picking)} onChange={(event) => setNote(event.target.value)} /></label></div>
      {pending && <p role="status">{t("waiting")}</p>}
      <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => { setStep(2); setDestination(null); setTargetJob(null); setError(""); }}><ArrowLeft size={18} />{t("scanBack")}</button><button className={styles.primaryAction} type="submit" disabled={busy || pending || !loaded || maxQuantity === undefined || Number(quantity) <= 0 || Number(quantity) > maxQuantity}>{t(targetJob ? "scanJobBooking" : "scanBook")}</button></footer>
    </form>}
    {error && <p role="alert">{t(error)}</p>}
    {step < 3 && <footer className={styles.actions}>{step > 0 && <button type="button" onClick={() => { setCamera(false); setCode(""); setError(""); if (step === 1) { setMaterial(null); setSource(null); setDestination(null); } else { setSource(null); setDestination(null); } setStep(step - 1); }}><ArrowLeft size={18} />{t("scanBack")}</button>}<button type="button" onClick={onClose}>{t("cancel")}</button></footer>}
  </ScanSurface>;
}
