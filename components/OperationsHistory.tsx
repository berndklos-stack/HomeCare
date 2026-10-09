"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import type { OperationsLanguage } from "@/lib/operations";
import type { OperationsRow } from "@/lib/operationsCommands";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

export function OperationsHistory({ entity, parent, order = false, title, language, onClose }: {
  entity: "purchase_receipts" | "maintenance_events"; parent: string; title: string;
  language: OperationsLanguage; onClose: () => void; order?: boolean;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [rows, setRows] = useState<OperationsRow[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const downloadRequest = useRef<AbortController | null>(null);
  const downloadUrls = useRef(new Map<string, number>());
  useEffect(() => () => {
    downloadRequest.current?.abort(); downloadRequest.current = null;
    for (const [url, timer] of downloadUrls.current) { window.clearTimeout(timer); URL.revokeObjectURL(url); }
    downloadUrls.current.clear();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    async function load() {
      const all: OperationsRow[] = [];
      let current = order ? 0 : page;
      let count = 0;
      do {
        const response = await apiFetch(`/api/operations?${new URLSearchParams({ entity, [order ? "order" : "parent"]: parent, page: String(current) })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        all.push(...data.rows); count = data.count;
        current++;
        if (!order || !data.rows.length) break;
      } while (all.length < count);
      return { rows: all, count: order ? 0 : count };
    }
    load()
      .then((data) => { if (!controller.signal.aborted) { setRows(data.rows); setCount(data.count); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entity, parent, order, page]);

  const groups = new Map<string, OperationsRow[]>();
  for (const row of rows) {
    const document = row.document as { id?: string; storage_path?: string } | undefined;
    const key = order && document ? String(document.id ?? document.storage_path ?? row.id) : row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const formattedDate = (value: unknown) => {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(language, { dateStyle: "medium", ...(String(value).includes("T") ? { timeStyle: "short" as const } : {}) }).format(date);
  };
  const number = (value: unknown) => new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(Number(value));

  async function download(document: { name: string; storage_path: string }, inline = false) {
    if (downloadRequest.current) return;
    const controller = new AbortController(); downloadRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setDownloading(true);
    setError(false);
    try {
      const response = await apiFetch(`/api/private-media?path=${encodeURIComponent(document.storage_path)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (inline && !(await blob.slice(0, 5).text()).startsWith("%PDF-")) throw new Error("INVALID_PDF");
      if (downloadRequest.current !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(inline ? new Blob([blob], { type: "application/pdf" }) : blob);
      if (inline) { setPreview({ url, name: document.name }); return; }
      const link = window.document.createElement("a");
      link.href = url; link.download = document.name; link.click();
      downloadUrls.current.set(url, window.setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url); }, 1000));
    } catch { if (downloadRequest.current === controller) setError(true); }
    finally {
      window.clearTimeout(timeout);
      if (downloadRequest.current === controller) { downloadRequest.current = null; setDownloading(false); }
    }
  }

  return <TripDialog labelledBy="operations-history-title" onClose={onClose} className={styles.dialog}>
    <header className={styles.dialogHeader}><h2 id="operations-history-title">{t(order ? "deliveryDocuments" : entity)}: {title}</h2><button type="button" title={t("close")} aria-label={t("close")} onClick={onClose}><X size={18} /></button></header>
    {error && <p role="alert">{t("historyFailed")}</p>}
    {preview ? <section className={styles.pdfPreview}>
      <div className={styles.toolbar}><button onClick={() => setPreview(null)}><ChevronLeft size={18} />{t("backToHistory")}</button>
        <a href={preview.url} download={preview.name}><Download size={18} />{preview.name}</a></div>
      <iframe title={`${t("pdfPreview")}: ${preview.name}`} src={preview.url} />
    </section> : <><div className={styles.list} aria-busy={loading}>
      {!loading && !error && !rows.length && <p>{t("empty")}</p>}
      {[...groups.entries()].map(([key, entries]) => {
        const row = entries[0];
        const document = row.document as { name: string; storage_path: string } | undefined;
        return <article className={styles.historyEntry} key={key}>
          <div className={styles.historyHeading}><div><strong>{formattedDate(row.completed_date ?? row.occurred_at)}</strong>
          {document && <p className={styles.documentName}>{document.name}</p>}</div>
          {document && <div className={styles.historyActions}><button aria-label={document.name} title={t("pdfPreview")} disabled={downloading} onClick={() => void download(document, /\.pdf$/i.test(document.name))}><FileText size={18} /></button><button aria-label={`Download: ${document.name}`} title={`Download: ${document.name}`} disabled={downloading} onClick={() => void download(document)}><Download size={18} /></button></div>}</div>
          {entries.map((entry) => {
            const material = entry.material as { name?: string; unit?: string } | null;
            return entry.quantity != null ? <div className={styles.historyPosition} key={entry.id}><span>{material?.name ?? t("position")}</span><span>{t("quantity")}: {number(entry.quantity)}{material?.unit ? ` ${material.unit}` : ""}</span></div> : null;
          })}
          <div className={styles.meta}>
            {row.cost != null && <span>{t("cost")}: {String(row.cost)} {String(row.currency)}</span>}
            {row.mileage != null && <span>{t("mileage")}: {String(row.mileage)}</span>}
            {row.operating_hours != null && <span>{t("operating_hours")}: {String(row.operating_hours)}</span>}
            {typeof row.actor_name === "string" && <span>{t("actor")}: {row.actor_name}</span>}</div>
          {[...new Set(entries.map((entry) => String(entry.note ?? entry.notes ?? "")).filter(Boolean))].map((note) => <p key={note}>{note}</p>)}
        </article>;
      })}
    </div>
    {count > 50 && <div className={styles.toolbar}><button aria-label={t("previous")} disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}</>}
  </TripDialog>;
}
