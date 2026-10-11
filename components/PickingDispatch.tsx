"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ScanLine, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import { matchesPickupScan, normalizeTargetScan, type PickingItem, type PickingOrder } from "@/lib/picking";
import { ScanSurface } from "./ScanSurface";
import { CodeCamera } from "./CodeCamera";
import styles from "./OperationsWorkspace.module.css";

type Place = { id: string; name: string; location_code: string; location_kind: string; archived?: boolean };
type Job = { id: string; name: string; code: string; status: string; billable?: boolean };
export function PickingDispatch({ order, items, language, pickupConfirmed = false, onClose, onBook, inline }: {
  order: PickingOrder; items: PickingItem[]; language: "de" | "sv" | "en";
  pickupConfirmed?: boolean; inline?: boolean;
  onClose: () => void; onBook: (input: { id: string; destination: string | null; pickup: string }) => Promise<void>;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [places, setPlaces] = useState<Place[]>([]);
  const [code, setCode] = useState(""), [camera, setCamera] = useState(false), [pickup, setPickup] = useState(pickupConfirmed), [target, setTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const id = useRef(createStableId()), lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const response = await apiFetch("/api/operations?entity=scan_targets", { signal: controller.signal });
      if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
      await response.json();
      const all: Place[] = [];
      for (const storagePlaces of [false, true]) {
      for (let page = 0; ; page++) {
        const result = await apiFetch(`/api/operations?entity=location_details&page=${page}${storagePlaces ? "&storage_places=1" : ""}`, { signal: controller.signal });
        if (!result.ok) throw new Error("OPERATIONS_UNAVAILABLE");
        const data = await result.json(); all.push(...data.rows);
        if ((page + 1) * 50 >= data.count || data.rows.length < 50) break;
      }
      }
      if (!controller.signal.aborted) { setPlaces([...new Map(all.filter((place) => !place.archived).map((place) => [place.id, place])).values()]); setLoaded(true); }
    })().catch(() => { if (!controller.signal.aborted) setError("OPERATIONS_UNAVAILABLE"); });
    return () => controller.abort();
  }, []);
  async function accept(value: string) {
    if (lock.current) return;
    setCamera(false); setError("");
    const scan = normalizeTargetScan(value); setLastScan(value.trim());
    if (!pickup) {
      if (!matchesPickupScan(scan, order)) { setError("PICKING_INVALID_PICKUP"); return; }
      setPickup(true); setCode(""); return;
    }
    if (matchesPickupScan(scan, order)) { setCode(""); return; }
    lock.current = true; setBusy(true);
    try {
    const response = await apiFetch("/api/operations?entity=scan_targets", { cache: "no-store" });
    if (!response.ok) throw new Error("OPERATIONS_UNAVAILABLE");
    const targets = await response.json() as { jobs?: Job[]; objects?: { code: string }[] };
    if ((targets.objects ?? []).some((object) => normalizeTargetScan(object.code) === scan)) { setError("OBJECT_NOT_BOOKABLE"); return; }
    const foundJobs = (targets.jobs ?? []).filter((job) => normalizeTargetScan(job.code) === scan), foundPlaces = places.filter((place) => normalizeTargetScan(place.location_code ?? "") === scan);
    if (foundJobs.length + foundPlaces.length !== 1) { setError(foundJobs.length + foundPlaces.length ? "scanAmbiguous" : "scanUnknown"); return; }
    if (foundJobs.length) {
      const job = foundJobs[0];
      if (job.id !== order.job_id) { setError("PICKING_WRONG_JOB"); return; }
      if (!["geplant", "in Arbeit", "pausiert"].includes(job.status)) { setError("JOB_NOT_OPEN"); return; }
      if (job.billable === false) { setError("JOB_NOT_BILLABLE"); return; }
      setTarget({ id: null, name: job.name });
    } else {
      if (foundPlaces[0].location_kind !== "vehicle") { setError("scanNotVehicle"); return; }
      if (order.status === "loaded") { setError("PICKING_INVALID_VEHICLE"); return; }
      setTarget({ id: foundPlaces[0].id, name: foundPlaces[0].name });
    }
    } catch { setError("OPERATIONS_UNAVAILABLE"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function book() {
    if (!target || !order.pickup_code || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await onBook({ id: id.current, destination: target.id, pickup: order.pickup_code }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "OPERATIONS_UNAVAILABLE"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ScanSurface inline={inline} labelledBy="picking-dispatch-title" onClose={() => { if (!busy) onClose(); }} className={styles.dialog}>
    <header className={styles.dialogHeader}><div><h2 id="picking-dispatch-title">{t("pickingDispatch")}</h2><p>{order.title}</p></div><button aria-label={t(inline ? "scanBack" : "close")} title={t(inline ? "scanBack" : "close")} disabled={busy} onClick={onClose}>{inline ? <ArrowLeft size={18} /> : <X size={18} />}</button></header>
    {!loaded && !error && <p role="status">{t("loading")}</p>}
    {pickup && <p role="status">{t("pickupRecognized")}</p>}
    {loaded && !target && <form onSubmit={(event) => { event.preventDefault(); void accept(code); }}>
      <label className={styles.field}><span>{t(pickup ? "pickingDispatchCode" : "pickingPickupCode")}</span><input disabled={busy} aria-label={t(pickup ? "pickingDispatchCode" : "pickingPickupCode")} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" /></label>
      <div className={styles.actions}><button type="submit" disabled={busy || !code.trim()}><ScanLine size={18} />{t("scanAccept")}</button><button disabled={busy} type="button" onClick={() => setCamera(true)}><Camera size={18} />{t("scanCamera")}</button></div>
      {camera && <CodeCamera label={t("scanCamera")} onCode={accept} onError={() => { setCamera(false); setError("scanCameraError"); }} />}
    </form>}
    {target && <><h3>{target.name}</h3><dl className={styles.itemFacts}>{items.map((item) => <div key={item.material_id}><dt>{item.material.sku ? `${item.material.sku} · ` : ""}{item.material.name}{item.material.scan_code ? ` · ${item.material.scan_code}` : ""}</dt><dd>{item.picked} {item.material.unit}</dd></div>)}</dl>
      <footer className={styles.actions}><button disabled={busy} onClick={() => { setTarget(null); setCode(""); }}>{t("scanBack")}</button><button className={styles.primaryAction} disabled={busy} onClick={() => void book()}>{t("pickingDispatchAll")}</button></footer></>}
    {error && <p role="alert">{lastScan && <><strong>{lastScan}</strong>: </>}{t(error)}</p>}
  </ScanSurface>;
}
