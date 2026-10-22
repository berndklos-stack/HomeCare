"use client";

import { useRef, useState } from "react";
import { Download, Mail, MessageSquare, Printer, Share2 } from "lucide-react";
import styles from "./CommunicationActions.module.css";

export type CommunicationDocument = { blob: Blob; name: string };
type DownloadOption = { label: string; run: () => void | Promise<void> };
type Props = {
  title: string;
  text: string;
  language?: "de" | "sv" | "en";
  email?: string;
  phone?: string;
  disabled?: boolean;
  document?: () => Promise<CommunicationDocument>;
  onPrint?: () => void | Promise<void>;
  onEmail?: () => void;
  downloads?: DownloadOption[];
};

const labels = {
  de: { actions: "Dokumentaktionen", print: "Drucken / PDF", download: "Herunterladen", share: "Teilen", copied: "Inhalt zum Teilen kopiert.", error: "Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.", unsupported: "Teilen ist in diesem Browser nicht verfügbar." },
  sv: { actions: "Dokumentåtgärder", print: "Skriv ut / PDF", download: "Ladda ner", share: "Dela", copied: "Innehållet har kopierats.", error: "Åtgärden kunde inte utföras. Försök igen.", unsupported: "Delning stöds inte i den här webbläsaren." },
  en: { actions: "Document actions", print: "Print / PDF", download: "Download", share: "Share", copied: "Content copied for sharing.", error: "The action failed. Please try again.", unsupported: "Sharing is unavailable in this browser." },
};

export function CommunicationActions({ title, text, language = "de", email = "", phone = "", disabled = false, document: getDocument, onPrint, onEmail, downloads }: Props) {
  const t = labels[language];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const lock = useRef(false);
  const blocked = disabled || busy;
  async function run(action: () => void | Promise<void>) {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); setMessage(""); setFailed(false);
    if (menu.current) menu.current.open = false;
    try { await action(); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) { setFailed(true); setMessage(t.error); }
    } finally { lock.current = false; setBusy(false); }
  }
  async function download() {
    if (!getDocument) return;
    const file = await getDocument();
    const url = URL.createObjectURL(file.blob), link = window.document.createElement("a");
    link.href = url; link.download = file.name;
    window.document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function print() {
    if (onPrint) return onPrint();
    if (!getDocument) return;
    // Open during the tap so Safari does not block the asynchronously generated PDF.
    const preview = window.open("", "_blank");
    if (!preview) throw new Error("PRINT_WINDOW_BLOCKED");
    preview.opener = null;
    try {
      const file = await getDocument();
      const url = URL.createObjectURL(file.blob);
      if (preview.closed) { URL.revokeObjectURL(url); return; }
      preview.document.title = title;
      preview.document.body.style.margin = "0";
      const frame = preview.document.createElement("iframe");
      frame.title = title;
      frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0";
      frame.addEventListener("load", () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* The native PDF viewer retains its print control. */ } }, { once: true });
      frame.src = url;
      preview.document.body.append(frame);
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } catch (error) { preview.close(); throw error; }
  }
  async function share() {
    if (typeof navigator.share === "function") return navigator.share({ title, text });
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${title}\n\n${text}`); setMessage(t.copied); }
    else { setFailed(true); setMessage(t.unsupported); }
  }
  const items = downloads ?? (getDocument ? [{ label: "PDF", run: download }] : []);
  return <div className={styles.container}>
    <div className={styles.actions} role="group" aria-label={t.actions} aria-busy={busy}>
      <button type="button" disabled={blocked || (!getDocument && !onPrint)} aria-label={t.print} title={t.print} onClick={() => void run(print)}><Printer size={22}/></button>
      {items.length > 1 ? <details ref={menu} className={styles.downloads} onKeyDown={event => { if (event.key === "Escape" && menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
        <summary aria-label={t.download} title={t.download} aria-disabled={blocked} onClick={event => { if (blocked) event.preventDefault(); }}><Download size={22}/></summary>
        <div className={styles.options}>{items.map(item => <button type="button" key={item.label} disabled={blocked} onClick={() => void run(item.run)}>{item.label}</button>)}</div>
      </details> : <button type="button" disabled={blocked || !items.length} title={`${t.download}${items[0] ? ` (${items[0].label})` : ""}`} aria-label={items[0]?.label === "Excel" ? "Excel" : t.download} onClick={() => void run(items[0].run)}><Download size={22}/></button>}
      {onEmail ? <button type="button" disabled={blocked} title="E-Mail" aria-label="E-Mail" onClick={onEmail}><Mail size={22}/></button> : <a title="E-Mail" aria-label="E-Mail" aria-disabled={blocked} tabIndex={blocked ? -1 : undefined} href={blocked ? undefined : `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`}><Mail size={22}/></a>}
      <a title="SMS" aria-label="SMS" aria-disabled={blocked} tabIndex={blocked ? -1 : undefined} href={blocked ? undefined : `sms:${encodeURIComponent(phone)}?&body=${encodeURIComponent(`${title}\n\n${text}`)}`}><MessageSquare size={22}/></a>
      <button type="button" disabled={blocked} title={t.share} aria-label={t.share} onClick={() => void run(share)}><Share2 size={22}/></button>
    </div>
    {message && <p role={failed ? "alert" : "status"} className={styles.message}>{message}</p>}
  </div>;
}
