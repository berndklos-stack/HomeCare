"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useAuthenticatedMedia } from "@/lib/useAuthenticatedMedia";
import { apiFetch } from "@/lib/apiClient";
import { loadCustomerDownloads } from "@/lib/customerFileDownloads";
import { customerArchivePaths, safeArchiveName, uniqueCustomerFiles, type CustomerFile } from "@/lib/customerFiles";

const limit = 100 * 1024 * 1024;

function FileThumbnail({ file }: { file: CustomerFile }) {
  const slot = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(Boolean(entries[0]?.isIntersecting)), { rootMargin: "200px" });
    if (slot.current) observer.observe(slot.current);
    return () => observer.disconnect();
  }, []);
  const media = useAuthenticatedMedia(visible && !file.unavailable ? file.source : "");
  return <span className="customer-file-thumbnail-slot" ref={slot}>{media.url ? <Image unoptimized loading="eager" src={media.url} alt={file.name} width={48} height={48} className="customer-file-thumbnail" /> : <ImageIcon size={20} />}</span>;
}

function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function CustomerFileOverview({ files: inputFiles, name, language = "de" }: { files: CustomerFile[]; name: string; language?: "de" | "en" | "sv" }) {
  const files = useMemo(() => uniqueCustomerFiles(inputFiles), [inputFiles]);
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  const [selected, setSelected] = useState<string[]>([]), [category, setCategory] = useState("all"), [job, setJob] = useState("all");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const visible = files.filter(file => (category === "all" || file.category === category) && (job === "all" || file.jobId === job));
  const available = visible.filter(file => !file.unavailable);
  const groups = useMemo(() => [...new Map(files.map(file => [file.jobId, file.jobTitle])).entries()], [files]);
  async function download(chosen: CustomerFile[], archive: boolean) {
    if (!chosen.length || busy || controller.current) return;
    const active = new AbortController(); controller.current = active; setBusy(true); setNotice("");
    setProgress({ completed: 0, total: chosen.length });
    try {
      if (chosen.length > 500 || chosen.reduce((sum, file) => sum + (file.size || 0), 0) > limit) throw Error("Bitte höchstens 500 Dateien und 100 MB pro Download auswählen.");
      const entries: Record<string, Uint8Array> = Object.create(null), paths = customerArchivePaths(chosen);
      const downloads = await loadCustomerDownloads(chosen, active, (file, signal) => file.source.startsWith("/api/") ? apiFetch(file.source, { signal, cache: "no-store" }) : fetch(file.source, { signal }), completed => setProgress({ completed, total: chosen.length }));
      downloads.forEach((bytes, index) => { entries[paths[index]] = bytes; });
      if (active.signal.aborted) return;
      if (archive) {
        const { zipSync } = await import("fflate");
        // JPEG/PDF/Office files are already compressed; store them without recompression.
        const bytes = zipSync(entries, { level: 0 });
        if (!active.signal.aborted) saveDownload(new Blob([new Uint8Array(bytes)], { type: "application/zip" }), `${safeArchiveName(name)}.zip`);
      } else saveDownload(new Blob([new Uint8Array(Object.values(entries)[0])]), safeArchiveName(chosen[0].name));
      setNotice(copy("Download vorbereitet.", "Nedladdningen är klar.", "Download ready."));
    } catch (error) { setNotice(error instanceof Error && error.name === "AbortError" ? copy("Download abgebrochen.", "Nedladdningen avbröts.", "Download cancelled.") : error instanceof Error ? error.message : copy("Download fehlgeschlagen.", "Nedladdningen misslyckades.", "Download failed.")); }
    finally { setBusy(false); controller.current = null; }
  }
  return <section className="customer-file-overview" aria-label={copy("Bilder und Dokumente", "Bilder och dokument", "Images and documents")}>
    <div className="panel-title"><h3>{copy("Bilder und Dokumente", "Bilder och dokument", "Images and documents")}</h3><div className="row-actions">
      <button type="button" className="ghost-button" disabled={busy || !selected.some(id => files.some(file => file.id === id && !file.unavailable))} onClick={() => void download(files.filter(file => selected.includes(file.id) && !file.unavailable), true)}><Download size={16} />{copy("Auswahl als ZIP", "Valda som ZIP", "Selected as ZIP")} ({selected.filter(id => files.some(file => file.id === id && !file.unavailable)).length})</button>
      <button type="button" className="ghost-button" disabled={busy || !available.length} onClick={() => void download(available, true)}><Download size={16} />{available.length === visible.length ? copy("Alle angezeigten als ZIP", "Alla visade som ZIP", "All shown as ZIP") : copy("Alle verfügbaren als ZIP", "Alla tillgängliga som ZIP", "All available as ZIP")}</button>
      {busy && <button type="button" className="ghost-button icon-button" aria-label={copy("Download abbrechen", "Avbryt nedladdning", "Cancel download")} onClick={() => controller.current?.abort()}><X size={16} /></button>}
    </div></div>
    <div className="customer-file-filters">
      <label><span>{copy("Kategorie", "Kategori", "Category")}</span><select aria-label={copy("Kategorie", "Kategori", "Category")} value={category} disabled={busy} onChange={event => setCategory(event.target.value)}><option value="all">{copy("Alle Dateien", "Alla filer", "All files")}</option><option value="report">{copy("Einsatzberichte", "Arbetsrapporter", "Service reports")}</option><option value="image">{copy("Bilder", "Bilder", "Images")}</option><option value="document">{copy("Dokumente", "Dokument", "Documents")}</option></select></label>
      <label><span>{copy("Auftrag / Objekt", "Uppdrag / objekt", "Job / object")}</span><select aria-label={copy("Auftrag / Objekt", "Uppdrag / objekt", "Job / object")} value={job} disabled={busy} onChange={event => setJob(event.target.value)}><option value="all">{copy("Alle", "Alla", "All")}</option>{groups.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label className="checkbox-line"><input type="checkbox" disabled={busy || !available.length} checked={available.length > 0 && available.every(file => selected.includes(file.id))} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...available.map(file => file.id)])] : current.filter(id => !available.some(file => file.id === id)))} /><span>{copy("Alle angezeigten auswählen", "Välj alla visade", "Select all shown")}</span></label>
    </div>
    {busy && <div className="customer-download-progress" role="status"><span>{copy("Download wird vorbereitet", "Nedladdningen förbereds", "Preparing download")} · {progress.completed} / {progress.total} {copy("Dateien geladen", "filer hämtade", "files loaded")}</span><progress aria-label={copy("Dateien geladen", "Filer hämtade", "Files loaded")} value={progress.completed} max={progress.total} /></div>}
    {!busy && notice && <p role="status">{notice}</p>}
    {!visible.length && <p>{copy("Keine Dateien vorhanden.", "Inga filer finns.", "No files available.")}</p>}
    {visible.some(file => file.unavailable) && <p role="status">{visible.filter(file => file.unavailable).length} {copy("Originaldateien nicht verfügbar; vom Download ausgeschlossen.", "originalfiler saknas; ingår inte i nedladdningen.", "original files unavailable; excluded from download.")}</p>}
    {(["report", "image", "document"] as const).map(type => {
      const groupFiles = visible.filter(file => file.category === type);
      return <section className="customer-file-group" key={type}><h4>{type === "report" ? copy("Einsatzberichte", "Arbetsrapporter", "Service reports") : type === "image" ? copy("Bilder", "Bilder", "Images") : copy("Dokumente", "Dokument", "Documents")} <span>({groupFiles.length})</span></h4>{groupFiles.map(file => <div className="customer-file-row" key={file.id}>
        <label className="customer-file-select"><input type="checkbox" disabled={busy || file.unavailable} checked={!file.unavailable && selected.includes(file.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, file.id])] : current.filter(id => id !== file.id))} />{file.category === "image" ? <FileThumbnail file={file} /> : <FileText size={20} />}<span className="customer-file-name"><span className="customer-file-title">{file.name}</span><small>{file.jobTitle}{file.unavailable ? ` · ${copy("Nicht verfügbar", "Inte tillgänglig", "Unavailable")}` : ""}</small></span></label>
        <time dateTime={file.date || undefined}>{file.date ? new Date(`${file.date.slice(0, 10)}T12:00:00`).toLocaleDateString(language === "de" ? "de-DE" : language === "sv" ? "sv-SE" : "en-GB") : ""}</time><button type="button" className="ghost-button icon-button" disabled={busy || file.unavailable} aria-label={`${copy("Herunterladen", "Ladda ner", "Download")} ${file.name}`} data-tooltip={copy("Herunterladen", "Ladda ner", "Download")} onClick={() => void download([file], false)}><Download size={16} /></button>
      </div>)}</section>;
    })}
  </section>;
}
