"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import type { OperationsLanguage } from "@/lib/operations";
import styles from "./OperationsWorkspace.module.css";

export function OperationsDocumentUpload({ language, onUploaded, onPending }: {
  language: OperationsLanguage;
  onUploaded: (document: { id: string; name: string }) => void;
  onPending: (pending: boolean) => void;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [selection, setSelection] = useState<{ file: File; id: string } | null>(null);
  const [status, setStatus] = useState<"uploading" | "failed" | "saved" | "">("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function upload(item: { file: File; id: string }) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    onPending(true); setStatus("uploading");
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const data = new FormData();
      data.append("file", item.file); data.append("mediaId", item.id);
      data.append("scope", "resource-documents");
      const response = await apiFetch("/api/media", { method: "POST", body: data, signal: controller.signal });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      const document = await response.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (document.id !== item.id || typeof document.path !== "string") throw new Error("UPLOAD_FAILED");
      onUploaded({ id: item.id, name: item.file.name });
      onPending(false); setStatus("saved");
    } catch {
      if (request.current === controller) setStatus("failed");
    } finally { window.clearTimeout(timeout); }
  }

  return <section>
    <label className={styles.field}><span><Upload size={16} /> {t("uploadDocument")}</span>
      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*" disabled={Boolean(selection)} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) { setStatus("failed"); return; }
        const item = { file, id: createStableId("MEDIA") };
        setSelection(item); void upload(item);
      }} />
    </label>
    <div role="status" className={styles.meta}>{selection?.file.name} {status && t(status === "saved" ? "documentSaved" : status === "uploading" ? "documentUploading" : "documentFailed")}</div>
    {selection && status !== "saved" && <div className={styles.actions}>
      {status === "failed" && <button type="button" onClick={() => void upload(selection)}><RefreshCw size={16} />{t("retryUpload")}</button>}
      <button type="button" onClick={() => { request.current?.abort(); request.current = null; setSelection(null); setStatus(""); onPending(false); }}><X size={16} />{t("removeUpload")}</button>
    </div>}
  </section>;
}
