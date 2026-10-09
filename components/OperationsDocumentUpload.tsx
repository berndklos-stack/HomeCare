"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Upload, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { createStableId } from "@/lib/syncQueue";
import { operationLabel } from "@/lib/operationsUi";
import type { OperationsLanguage } from "@/lib/operations";
import styles from "./OperationsWorkspace.module.css";

export function OperationsDocumentUpload({ language, onUploaded, onPending, scope = "resource-documents", photoPdf = false, disabled = false }: {
  language: OperationsLanguage;
  onUploaded: (document: { id: string; name: string }) => void;
  onPending: (pending: boolean) => void;
  scope?: "resource-documents" | "purchase-documents";
  photoPdf?: boolean;
  disabled?: boolean;
}) {
  const t = (key: string) => operationLabel(key, language);
  const [selection, setSelection] = useState<{ file: File; id: string } | null>(null);
  const [status, setStatus] = useState<"uploading" | "failed" | "saved" | "">("");
  const [savedName, setSavedName] = useState("");
  const request = useRef<AbortController | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function upload(item: { file: File; id: string }) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    onPending(true); setStatus("uploading");
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const file = photoPdf && item.file.type.startsWith("image/") ? await photoToPdf(item.file) : item.file;
      if (request.current !== controller) return;
      if (controller.signal.aborted) throw new Error("UPLOAD_TIMEOUT");
      if (photoPdf && file.type !== "application/pdf") throw new Error("PDF_REQUIRED");
      const data = new FormData();
      data.append("file", file); data.append("mediaId", item.id);
      data.append("scope", scope);
      const response = await apiFetch("/api/media", { method: "POST", body: data, signal: controller.signal });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      const document = await response.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (document.id !== item.id || typeof document.path !== "string") throw new Error("UPLOAD_FAILED");
      onUploaded({ id: item.id, name: file.name });
      setSavedName(file.name);
      onPending(false); setStatus("saved");
    } catch {
      if (request.current === controller) setStatus("failed");
    } finally { window.clearTimeout(timeout); }
  }

  function select(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || disabled) return;
    if (file.size > 25 * 1024 * 1024) { setStatus("failed"); return; }
    const item = { file, id: createStableId("MEDIA") };
    setSelection(item); void upload(item);
  }
  return <section>
    <label className={styles.field}><span><Upload size={16} /> {t(photoPdf ? "deliveryNote" : "uploadDocument")}</span>
      <input type="file" accept={photoPdf ? ".pdf,application/pdf,image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"} disabled={disabled || Boolean(selection)} onChange={select} />
    </label>
    {photoPdf && <><input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={select} />
      <button type="button" disabled={disabled || Boolean(selection)} onClick={() => camera.current?.click()}><Camera size={16} />{t("photographDeliveryNote")}</button></>}
    <div role="status" className={styles.meta}>{status === "saved" ? savedName : selection?.file.name} {status && t(status === "saved" ? "documentSaved" : status === "uploading" ? "documentUploading" : "documentFailed")}</div>
    {selection && status !== "saved" && <div className={styles.actions}>
      {status === "failed" && <button type="button" onClick={() => void upload(selection)}><RefreshCw size={16} />{t("retryUpload")}</button>}
      <button type="button" onClick={() => { request.current?.abort(); request.current = null; setSelection(null); setStatus(""); onPending(false); }}><X size={16} />{t("removeUpload")}</button>
    </div>}
  </section>;
}

async function photoToPdf(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_DECODE_FAILED");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
    const fit = Math.min((width - 20) / canvas.width, (height - 20) / canvas.height);
    const w = canvas.width * fit, h = canvas.height * fit;
    pdf.addImage(canvas.toDataURL("image/jpeg", .9), "JPEG", (width - w) / 2, (height - h) / 2, w, h);
    return new File([pdf.output("blob")], `${file.name.replace(/\.[^.]+$/, "")}.pdf`, { type: "application/pdf" });
  } finally { URL.revokeObjectURL(url); }
}
