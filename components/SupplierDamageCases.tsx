"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Eye, RefreshCw, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import { OperationsDataTable } from "./OperationsDataTable";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

type DamageCase = { id: string; description: string; revision: number; status: string; created_at: string; supplier?: { company: string }; receipt?: { delivery_number: string } };
type Document = { id: string; name: string; storage_path: string };
type Event = { id: string; status: string; note: string; actor_name?: string; created_at: string };
export function SupplierDamageCases({ supplier, caseId, language, inline = false, returnToSupplier = false, onClose }: { supplier?: { id: string; name: string }; caseId?: string; language: "de" | "sv" | "en"; inline?: boolean; returnToSupplier?: boolean; onClose: () => void }) {
  const t = (key: string) => operationLabel(key, language);
  const [rows, setRows] = useState<DamageCase[]>([]), [current, setCurrent] = useState<DamageCase | null>(caseId ? { id: caseId, description: "", revision: 0, status: "", created_at: "" } : null);
  const [preview, setPreview] = useState<{ url: string; name: string; image: boolean } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const [photos, setPhotos] = useState<Document[]>([]), [document, setDocument] = useState<Document | null>(null), [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState(""), [note, setNote] = useState(""), [filter, setFilter] = useState(""), [page, setPage] = useState(0), [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [refresh, setRefresh] = useState(0);
  const lock = useRef(false), id = current?.id, supplierId = supplier?.id;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void apiFetch(`/api/supplier-damage-cases?${id ? `id=${encodeURIComponent(id)}` : `page=${page}&status=${filter}`}${supplierId ? `&supplier=${encodeURIComponent(supplierId)}` : ""}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (controller.signal.aborted) return; if (id) { if (!data.rows[0]) throw new Error(); setCurrent(data.rows[0]); setStatus(data.rows[0].status); setPhotos(data.photos ?? []); setDocument(data.document ?? null); setEvents(data.events ?? []); } else { setRows(data.rows); setCount(data.count); } })
      .catch(() => { if (!controller.signal.aborted) setError("OPERATIONS_UNAVAILABLE"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, supplierId, page, filter, refresh]);
  async function save() {
    if (!current || lock.current || loading) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/supplier-damage-cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id, revision: current.revision, status, note }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "OPERATIONS_UNAVAILABLE");
      setNote(""); setRefresh((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error && cause.message === "REVISION_CONFLICT" ? "REVISION_CONFLICT" : "OPERATIONS_UNAVAILABLE"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function download(file: Document, showPreview = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const response = await apiFetch(`/api/private-media?path=${encodeURIComponent(file.storage_path)}`); if (!response.ok) throw new Error();
      const blob = await response.blob(), url = URL.createObjectURL(blob);
      if (showPreview) {
        const image = /^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(blob.type);
        if (!image && blob.type !== "application/pdf") { URL.revokeObjectURL(url); throw new Error(); }
        setPreview({ url, name: file.name, image }); return;
      }
      const link = window.document.createElement("a");
      link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError("historyFailed"); } finally { lock.current = false; setBusy(false); }
  }
  const contents = <>
    {preview ? <>
      <header className={inline ? "panel-title" : styles.dialogHeader}><h2 id="damage-preview-title">{preview.name}</h2><button aria-label={t("close")} onClick={() => setPreview(null)}><X size={18} /></button></header>
      <section className={styles.pdfPreview}>{preview.image ? <img src={preview.url} alt={preview.name} style={{ display: "block", width: "100%", maxHeight: "65vh", objectFit: "contain" }} /> : <iframe title={`${t("pdfPreview")}: ${preview.name}`} src={preview.url} />}</section>
      <footer className={styles.actions}><button onClick={() => setPreview(null)}><ChevronLeft size={18} />{t("scanBack")}</button><a href={preview.url} download={preview.name}><Download size={18} />{t("download")}</a></footer>
    </> : <>
    <header className={inline ? "panel-title" : styles.dialogHeader}><div>{inline && <p>{t("purchasingSection")}</p>}<h2 id="damage-title">{t("damageCases")}</h2>{supplier && <p>{supplier.name}</p>}</div><div className={styles.actions}>
      <button type="button" disabled={busy} aria-label={t("refresh")} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={18} /></button>
      {!inline && <button type="button" disabled={busy} aria-label={t("close")} onClick={onClose}><X size={18} /></button>}</div></header>
    {loading && <p role="status">{t("loading")}</p>}{error && <p role="alert">{t(error)}</p>}
    {!current ? <>
      <label className={styles.field}><span>{t("status")}</span><select aria-label={t("status")} value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}><option value="">{t("allDamageCases")}</option>{["open", "in_progress", "completed"].map((value) => <option key={value} value={value}>{t(`damage_${value}`)}</option>)}</select></label>
      <OperationsDataTable rows={rows} columns={[
        { key: "supplier", label: t("supplier_id"), value: (row) => (row as DamageCase).supplier?.company ?? "" },
        { key: "delivery_number", label: t("deliveryNumber"), value: (row) => (row as DamageCase).receipt?.delivery_number ?? "" },
        { key: "description", label: t("damageDescription"), value: (row) => String(row.description) },
        { key: "created_at", label: t("bookedAt"), value: (row) => new Date(String(row.created_at)).toLocaleString(language, { timeZone: "Europe/Stockholm" }) },
        { key: "status", label: t("status"), value: (row) => t(`damage_${row.status}`) },
      ]} label={t("damageCases")} filterLabel={t("filter")} emptyLabel={t("empty")} actionsLabel={t("actions")} onRowActivate={(row) => { setCurrent(row as DamageCase); setStatus(String(row.status)); setNote(""); }} />
      {(returnToSupplier || count > 50) && <footer className={styles.actions}>{returnToSupplier && <button disabled={busy} onClick={onClose}><ChevronLeft size={18} />{t("backToSupplier")}</button>}{count > 50 && <><button aria-label={t("previous")} disabled={!page} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span>{page + 1}</span><button aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></>}</footer>}
    </> : <>
      <p><strong>{current.supplier?.company}</strong> · {t("deliveryNumber")}: {current.receipt?.delivery_number}</p><p>{current.description}</p>
      <div className={styles.actions}>{[...(document ? [{ file: document, label: t("deliveryNote") }] : []), ...photos.map((file, index) => ({ file, label: `${t("damagePhoto")} ${index + 1}` }))].map(({ file, label }) => <div key={file.id} className={styles.actions}><button disabled={busy || loading} onClick={() => void download(file, true)}><Eye size={18} />{label}</button><button title={`${t("download")}: ${label}`} aria-label={`${t("download")}: ${label}`} disabled={busy || loading} onClick={() => void download(file)}><Download size={18} /></button></div>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}><div className={styles.fields}>
        <label className={styles.field}><span>{t("status")}</span><select aria-label={t("status")} disabled={busy || loading} value={status} onChange={(event) => setStatus(event.target.value)}>{["open", "in_progress", "completed"].map((value) => <option key={value} value={value}>{t(`damage_${value}`)}</option>)}</select></label>
        <label className={styles.field}><span>{t("damageNote")}</span><textarea maxLength={4000} disabled={busy || loading} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>
        <footer className={styles.actions}><button type="button" disabled={busy} onClick={() => { setCurrent(null); setNote(""); setPhotos([]); setDocument(null); }}><ChevronLeft size={18} />{t("scanBack")}</button><button className={styles.primaryAction} disabled={busy || loading || Boolean(error) || status === current.status && !note.trim()}><Check size={18} />{t("save")}</button></footer>
      </form>
      <h3>{t("damageHistory")}</h3>{events.map((event) => <div key={event.id}><p><strong>{t(`damage_${event.status}`)}</strong> · {new Date(event.created_at).toLocaleString(language, { timeZone: "Europe/Stockholm" })} · {event.actor_name || t("pickingActorUnknown")}</p>{event.note && <p>{event.note}</p>}</div>)}
    </>}
    </>}
  </>;
  return inline ? <section className="panel" aria-labelledby={preview ? "damage-preview-title" : "damage-title"}>{contents}</section> : <TripDialog labelledBy={preview ? "damage-preview-title" : "damage-title"} className={`${styles.dialog} ${styles.wideDialog}`} onClose={() => { if (preview) setPreview(null); else if (!busy) onClose(); }}>{contents}</TripDialog>;
}
