"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ScanLine, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId, type SyncMutation } from "@/lib/syncQueue";
import { validateOperationsMutation } from "@/lib/operationsCommands";
import { operationLabel } from "@/lib/operationsUi";
import { TripDialog } from "./TripDialog";
import { CodeCamera } from "./CodeCamera";
import styles from "./OperationsWorkspace.module.css";

type Material = { id: string; name: string; sku?: string; scanCode?: string; unit?: string; archived?: boolean };
type Location = { id: string; name: string; location_code: string; parent_location_id?: string | null; archived?: boolean };
type Balance = { rows: { location_id: string; quantity: number }[] };

export function StockScan({ materials, language, queue, enqueue, onClose, onQueued }: {
  materials: Material[]; language: "de" | "sv" | "en"; queue: SyncMutation[];
  enqueue: (input: Parameters<typeof import("@/lib/syncQueue").createSyncMutation>[0]) => unknown;
  onClose: () => void; onQueued: () => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState(false), [reload, setReload] = useState(0);
  const [material, setMaterial] = useState<Material | null>(null);
  const [source, setSource] = useState<Location | null>(null), [destination, setDestination] = useState<Location | null>(null);
  const [step, setStep] = useState(0), [code, setCode] = useState(""), [camera, setCamera] = useState(false);
  const [quantity, setQuantity] = useState("1"), [note, setNote] = useState("");
  const [available, setAvailable] = useState<number | null>(null), [balanceError, setBalanceError] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const locked = useRef(false), input = useRef<HTMLInputElement>(null), alive = useRef(true);
  const pending = !!material && queue.some((mutation) => mutation.entityType === "operations" && mutation.status !== "synced" && mutation.resourceId === material.id);
  const steps = [t("scanMaterial"), t("scanSource"), t("scanDestination"), t("scanReview")];
  const placeLabel = (place: Location) => `${place.parent_location_id ? `${locations.find((row) => row.id === place.parent_location_id)?.name ?? ""} / ` : ""}${place.name}`;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoaded(false); setLoadError(false);
      const all: Location[] = [];
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
      if (!controller.signal.aborted) { setLocations(all.filter((row) => !row.archived)); setLoaded(true); }
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
    const matches = step === 0 ? materials.filter((row) => !row.archived && row.scanCode === scanned) : locations.filter((row) => row.location_code === scanned);
    if (matches.length !== 1) { setError(matches.length > 1 ? "scanAmbiguous" : "scanUnknown"); return; }
    if (step === 0) { setMaterial(matches[0] as Material); setSource(null); setDestination(null); }
    if (step === 1) { setSource(matches[0] as Location); setDestination(null); }
    if (step === 2) {
      if (matches[0].id === source?.id) { setError("scanSameLocation"); return; }
      setDestination(matches[0] as Location);
    }
    setCode(""); setStep((value) => value + 1);
  }

  async function book() {
    if (locked.current || pending || !material || !source || !destination) return;
    setError("");
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.000001) { setError("INVALID_OPERATIONS_COMMAND"); return; }
    if (source.id === destination.id || !materials.some((row) => row.id === material.id && !row.archived && row.scanCode === material.scanCode)) { setError("scanUnknown"); return; }
    locked.current = true; setBusy(true);
    try {
      const response = await apiFetch(`/api/operations?entity=stock_balances&parent=${encodeURIComponent(material.id)}`);
      if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
      const data = await response.json() as Balance;
      const balance = Number(data.rows.find((row) => row.location_id === source.id)?.quantity ?? 0);
      if (!alive.current) return;
      if (!Number.isFinite(balance)) throw new Error("OPERATIONS_UNAVAILABLE");
      setAvailable(balance);
      if (amount > balance) throw new Error("INSUFFICIENT_STOCK");
      const command = { entityId: createStableId(), entityType: "operations" as const, operation: "create" as const, resourceId: material.id,
        payload: { kind: "stock", material_id: material.id, source_id: source.id, destination_id: destination.id, quantity: amount, note: note.trim() || t("scanTransfer"), job_id: null, project_id: null } };
      validateOperationsMutation({ ...command, id: createStableId() });
      enqueue(command); onQueued();
    } catch (cause) { if (alive.current) setError(cause instanceof Error && ["INSUFFICIENT_STOCK", "INVALID_OPERATIONS_COMMAND"].includes(cause.message) ? cause.message : "OPERATIONS_UNAVAILABLE"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  return <TripDialog labelledBy="stock-scan-title" onClose={() => { if (!busy) onClose(); }} className={styles.dialog}>
    <header className={styles.dialogHeader}><div><p>{t("inventorySection")}</p><h2 id="stock-scan-title">{t("scanTransfer")}</h2></div><button type="button" disabled={busy} aria-label={t("close")} onClick={onClose}><X size={18} /></button></header>
    <ol className={styles.scanSteps}>{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}</ol>
    {!loaded && <p role={loadError ? "alert" : "status"}>{t(loadError ? "OPERATIONS_UNAVAILABLE" : "loading")}{loadError && <button type="button" onClick={() => setReload((value) => value + 1)}>{t("retry")}</button>}</p>}
    <dl className={styles.itemFacts}>
      {material && <div><dt>{t("designation")}</dt><dd>{material.sku ? `${material.sku} · ` : ""}{material.name}</dd></div>}
      {source && <div><dt>{t("source_id")}</dt><dd>{placeLabel(source)}</dd></div>}
      {destination && <div><dt>{t("destination_id")}</dt><dd>{placeLabel(destination)}</dd></div>}
    </dl>
    {loaded && step < 3 && <form onSubmit={(event) => { event.preventDefault(); accept(code); }}>
      <h3>{steps[step]}</h3>
      {camera ? <><CodeCamera label={t("scanCamera")} onCode={accept} onError={() => { setCamera(false); setError("scanCameraError"); }} /><button type="button" onClick={() => setCamera(false)}>{t("cancel")}</button></> : <button type="button" onClick={() => { setError(""); setCamera(true); }}><Camera size={18} />{t("scanCamera")}</button>}
      <div className={styles.scanInput}><label className={styles.field}><span>{t("scanCode")}</span><input ref={input} aria-label={t("scanCode")} maxLength={128} autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} /></label><button type="submit" disabled={!code.trim()}><ScanLine size={18} />{t("scanAccept")}</button></div>
    </form>}
    {step === 3 && <form onSubmit={(event) => { event.preventDefault(); void book(); }}>
      <p role="status">{t("scanAvailable")}: {available === null ? t(balanceError ? "OPERATIONS_UNAVAILABLE" : "loading") : new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(available)} {material?.unit}</p>
      {balanceError && <button type="button" onClick={() => setReload((value) => value + 1)}>{t("retry")}</button>}
      <div className={styles.fields}><label className={styles.field}><span>{t("quantity")}{material?.unit ? ` (${material.unit})` : ""}</span><input required aria-label={t("quantity")} type="number" min="0.001" step="0.001" max={available ?? undefined} value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} /></label><label className={styles.field}><span>{t("note")}</span><input value={note} maxLength={9000} disabled={busy} onChange={(event) => setNote(event.target.value)} /></label></div>
      {pending && <p role="status">{t("waiting")}</p>}
      <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => { setStep(2); setDestination(null); setError(""); }}><ArrowLeft size={18} />{t("scanBack")}</button><button className={styles.primaryAction} type="submit" disabled={busy || pending || !loaded || available === null || Number(quantity) <= 0 || Number(quantity) > available}>{t("scanBook")}</button></footer>
    </form>}
    {error && <p role="alert">{t(error)}</p>}
    {step < 3 && <footer className={styles.actions}>{step > 0 && <button type="button" onClick={() => { setCamera(false); setCode(""); setError(""); if (step === 1) { setMaterial(null); setSource(null); setDestination(null); } else { setSource(null); setDestination(null); } setStep(step - 1); }}><ArrowLeft size={18} />{t("scanBack")}</button>}<button type="button" onClick={onClose}>{t("cancel")}</button></footer>}
  </TripDialog>;
}
