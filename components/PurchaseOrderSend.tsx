"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { operationLabel } from "@/lib/operationsUi";
import { TripDialog } from "./TripDialog";
import styles from "./OperationsWorkspace.module.css";

export function PurchaseOrderSend({ orderId, revision, disabled, language, onSent }: { orderId: string; revision: number; disabled: boolean; language: "de" | "sv" | "en"; onSent: () => void }) {
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<{ to: string; subject: string; body: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const t = (key: string) => operationLabel(key, language);
  useEffect(() => () => controller.current?.abort(), []);
  async function execute(action: "preview" | "send") {
    if (busy || disabled || sent) return;
    setOpened(true); setBusy(true); setError("");
    controller.current = new AbortController();
    try {
      const response = await apiFetch("/api/purchase-orders/send", { method: "POST", signal: controller.current.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId, revision, language, token: preview?.token }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "MAIL_FAILED");
      if (action === "preview") setPreview(result);
      else { setSent(true); try { onSent(); } catch { setError("mailStatusPending"); } }
    } catch (failure) { if (!controller.current?.signal.aborted) setError(failure instanceof Error ? failure.message : "MAIL_FAILED"); }
    finally { setBusy(false); }
  }
  const close = () => { if (!busy) { setOpened(false); setPreview(null); setError(""); } };
  return <>
    <button disabled={disabled || busy || sent} onClick={() => void execute("preview")}><Send size={18} />{t("order")}</button>
    {opened && <TripDialog labelledBy={`purchase-preview-${orderId}`} onClose={close} className={styles.dialog}>
      <header className={styles.dialogHeader}><h2 id={`purchase-preview-${orderId}`}>{t("orderPreview")}</h2><button disabled={busy} title={t("close")} aria-label={t("close")} onClick={close}><X size={18} /></button></header>
      {preview && <><p><strong>{t("recipient")}:</strong> {preview.to || t("SUPPLIER_EMAIL_MISSING")}</p><h3>{preview.subject}</h3><pre className={styles.mailPreview}>{preview.body}</pre></>}
      {busy && <p role="status">{t("mailLoading")}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {sent && <p role="status">{t("mailSent")}</p>}
      <footer className={styles.actions}><button disabled={busy} onClick={close}>{t("close")}</button>
        {!sent && <button className={styles.selected} disabled={busy || disabled || !preview?.to || !preview} onClick={() => void execute("send")}><Send size={18} />{t("sendOrderEmail")}</button>}
      </footer>
    </TripDialog>}
  </>;
}
