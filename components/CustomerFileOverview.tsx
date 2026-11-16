"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useAuthenticatedMedia } from "@/lib/useAuthenticatedMedia";
import { apiFetch } from "@/lib/apiClient";
import { customerArchivePaths, safeArchiveName, type CustomerFile } from "@/lib/customerFiles";

const limit = 100 * 1024 * 1024;

function FileThumbnail({ file }: { file: CustomerFile }) {
  const slot = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(Boolean(entries[0]?.isIntersecting)), { rootMargin: "200px" });
    if (slot.current) observer.observe(slot.current);
    return () => observer.disconnect();
  }, []);
  const media = useAuthenticatedMedia(visible ? file.source : "");
  return <span className="customer-file-thumbnail-slot" ref={slot}>{media.url ? <Image unoptimized src={media.url} alt={file.name} width={48} height={48} className="customer-file-thumbnail" /> : <ImageIcon size={20} />}</span>;
}

async function readDownload(file: CustomerFile, signal: AbortSignal, remaining: number) {
  const response = file.source.startsWith("/api/") ? await apiFetch(file.source, { signal, cache: "no-store" }) : await fetch(file.source, { signal });
  if (!response.ok) throw Error(`„${file.name}“ konnte nicht geladen werden (${response.status}).`);
  if (Number(response.headers.get("Content-Length")) > remaining) throw Error("Die Auswahl überschreitet 100 MB. Bitte weniger Dateien auswählen.");
  const reader = response.body?.getReader();
  if (!reader) throw Error(`„${file.name}“ konnte nicht gelesen werden.`);
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length;
      if (length > remaining) throw Error("Die Auswahl überschreitet 100 MB. Bitte weniger Dateien auswählen.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function CustomerFileOverview({ files, name, language = "de" }: { files: CustomerFile[]; name: string; language?: "de" | "en" | "sv" }) {
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const [selected, setSelected] = useState<string[]>([]), [category, setCategory] = useState("all"), [job, setJob] = useState("all");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const visible = files.filter(file => (category === "all" || file.category === category) && (job === "all" || file.jobId === job));
  const groups = useMemo(() => [...new Map(files.map(file => [file.jobId, file.jobTitle])).entries()], [files]);
  async function download(chosen: CustomerFile[], archive: boolean) {
    if (!chosen.length || busy || controller.current) return;
    const active = new AbortController(); controller.current = active; setBusy(true); setNotice("");
    try {
      if (chosen.length > 500 || chosen.reduce((sum, file) => sum + (file.size || 0), 0) > limit) throw Error("Bitte höchstens 500 Dateien und 100 MB pro Download auswählen.");
      const entries: Record<string, Uint8Array> = Object.create(null), paths = customerArchivePaths(chosen); let total = 0;
      for (let index = 0; index < chosen.length; index++) {
        setNotice(`${index + 1} / ${chosen.length}`);
        const bytes = await readDownload(chosen[index], active.signal, limit - total); total += bytes.length; entries[paths[index]] = bytes;
      }
      if (active.signal.aborted) return;
      if (archive) {
        const { zipSync } = await import("fflate");
        // JPEG/PDF/Office files are already compressed; store them without recompression.
        const bytes = zipSync(entries, { level: 0 });
        if (!active.signal.aborted) saveDownload(new Blob([new Uint8Array(bytes)], { type: "application/zip" }), `${safeArchiveName(name)}.zip`);
      } else saveDownload(new Blob([new Uint8Array(Object.values(entries)[0])]), safeArchiveName(chosen[0].name));
      setNotice(copy("Download vorbereitet.", "Nedladdningen är klar.", "Download ready."));
    } catch (error) { setNotice(active.signal.aborted ? copy("Download abgebrochen.", "Nedladdningen avbröts.", "Download cancelled.") : error instanceof Error ? error.message : "Download fehlgeschlagen."); }
    finally { setBusy(false); controller.current = null; }
  }
  return <section className="customer-file-overview" aria-label={copy("Bilder und Dokumente", "Bilder och dokument", "Images and documents")}>
    <div className="panel-title"><h3>{copy("Bilder und Dokumente", "Bilder och dokument", "Images and documents")}</h3><div className="row-actions">
      <button type="button" className="ghost-button" disabled={busy || !selected.some(id => files.some(file => file.id === id))} onClick={() => void download(files.filter(file => selected.includes(file.id)), true)}><Download size={16} />{copy("Auswahl als ZIP", "Valda som ZIP", "Selected as ZIP")} ({selected.filter(id => files.some(file => file.id === id)).length})</button>
      <button type="button" className="ghost-button" disabled={busy || !visible.length} onClick={() => void download(visible, true)}><Download size={16} />{copy("Alle angezeigten als ZIP", "Alla visade som ZIP", "All shown as ZIP")}</button>
      {busy && <button type="button" className="ghost-button icon-button" aria-label={copy("Download abbrechen", "Avbryt nedladdning", "Cancel download")} onClick={() => controller.current?.abort()}><X size={16} /></button>}
    </div></div>
    <div className="customer-file-filters">
      <label><span>{copy("Kategorie", "Kategori", "Category")}</span><select aria-label={copy("Kategorie", "Kategori", "Category")} value={category} disabled={busy} onChange={event => setCategory(event.target.value)}><option value="all">{copy("Alle Dateien", "Alla filer", "All files")}</option><option value="image">{copy("Bilder", "Bilder", "Images")}</option><option value="document">{copy("Dokumente", "Dokument", "Documents")}</option></select></label>
      <label><span>{copy("Auftrag / Objekt", "Uppdrag / objekt", "Job / object")}</span><select aria-label={copy("Auftrag / Objekt", "Uppdrag / objekt", "Job / object")} value={job} disabled={busy} onChange={event => setJob(event.target.value)}><option value="all">{copy("Alle", "Alla", "All")}</option>{groups.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label className="checkbox-line"><input type="checkbox" disabled={busy || !visible.length} checked={visible.length > 0 && visible.every(file => selected.includes(file.id))} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...visible.map(file => file.id)])] : current.filter(id => !visible.some(file => file.id === id)))} /><span>{copy("Alle angezeigten auswählen", "Välj alla visade", "Select all shown")}</span></label>
    </div>
    {notice && <p role="status">{notice}</p>}
    {!visible.length && <p>{copy("Keine Dateien vorhanden.", "Inga filer finns.", "No files available.")}</p>}
    {groups.filter(([id]) => visible.some(file => file.jobId === id)).map(([id, title]) => <section className="customer-file-group" key={id}><h4>{title}</h4>{(["image", "document"] as const).map(type => {
      const groupFiles = visible.filter(file => file.jobId === id && file.category === type);
      return groupFiles.length > 0 && <div className="customer-file-category" key={type}><strong>{type === "image" ? copy("Bilder", "Bilder", "Images") : copy("Dokumente", "Dokument", "Documents")}</strong>{groupFiles.map(file => <div className="customer-file-row" key={file.id}>
        <label className="checkbox-line"><input type="checkbox" disabled={busy} checked={selected.includes(file.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, file.id])] : current.filter(id => id !== file.id))} />{file.category === "image" ? <FileThumbnail file={file} /> : <FileText size={16} />}<span>{file.name}</span></label>
        <span>{file.date || ""}</span><button type="button" className="ghost-button icon-button" disabled={busy} aria-label={`${copy("Herunterladen", "Ladda ner", "Download")} ${file.name}`} data-tooltip={copy("Herunterladen", "Ladda ner", "Download")} onClick={() => void download([file], false)}><Download size={16} /></button>
      </div>)}</div>;
    })}</section>)}
  </section>;
}
