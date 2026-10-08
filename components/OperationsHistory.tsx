"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import type { OperationsLanguage } from "@/lib/operations";
import type { OperationsRow } from "@/lib/operationsCommands";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

export function OperationsHistory({ entity, parent, title, language, onClose }: {
  entity: "purchase_receipts" | "maintenance_events"; parent: string; title: string;
  language: OperationsLanguage; onClose: () => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [rows, setRows] = useState<OperationsRow[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
    apiFetch(`/api/operations?${new URLSearchParams({ entity, parent, page: String(page) })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) { setRows(data.rows); setCount(data.count); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entity, parent, page]);

  async function download(document: { name: string; storage_path: string }) {
    if (downloadRequest.current) return;
    const controller = new AbortController(); downloadRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setDownloading(true);
    try {
      const response = await apiFetch(`/api/private-media?path=${encodeURIComponent(document.storage_path)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (downloadRequest.current !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
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
    <div className={styles.toolbar}><h2 id="operations-history-title">{t(entity)}: {title}</h2><button type="button" aria-label={t("close")} onClick={onClose}><X size={18} /></button></div>
    {error && <p role="alert">{t("historyFailed")}</p>}
    <div className={styles.list} aria-busy={loading}>
      {!loading && !error && !rows.length && <p>{t("empty")}</p>}
      {rows.map((row) => {
        const document = row.document as { name: string; storage_path: string } | undefined;
        return <article className={styles.row} key={row.id}><div>
          <strong>{String(row.completed_date ?? row.occurred_at)}</strong>
          <div className={styles.meta}>{row.quantity != null && <span>{t("quantity")}: {String(row.quantity)}</span>}
            {row.cost != null && <span>{t("cost")}: {String(row.cost)} {String(row.currency)}</span>}
            {row.mileage != null && <span>{t("mileage")}: {String(row.mileage)}</span>}
            {row.operating_hours != null && <span>{t("operating_hours")}: {String(row.operating_hours)}</span>}
            <span>{t("actor")}: {String(row.actor_user_id)}</span></div>
          <p>{String(row.note ?? row.notes ?? "")}</p>
        </div>{document && <button disabled={downloading} onClick={() => void download(document)}><Download size={18} />{document.name}</button>}</article>;
      })}
    </div>
    {count > 50 && <div className={styles.toolbar}><button aria-label={t("previous")} disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={18} /></button><span>{page + 1} / {Math.ceil(count / 50)}</span><button aria-label={t("next")} disabled={(page + 1) * 50 >= count} onClick={() => setPage((p) => p + 1)}><ChevronRight size={18} /></button></div>}
  </TripDialog>;
}
