"use client";

import { Download, Share2, X } from "lucide-react";
import { useState } from "react";

export type DevicePhotoPolicy = "never" | "ask" | "always";

export function DevicePhotoSave({ files, policy, onDismiss }: {
  files: File[];
  policy: DevicePhotoPolicy;
  onDismiss: () => void;
}) {
  const [notice, setNotice] = useState("");
  if (policy === "never" || files.length === 0) return null;

  async function share(file: File) {
    setNotice("");
    try {
      if (!navigator.canShare?.({ files: [file] })) {
        setNotice("Dateifreigabe ist nicht verfügbar. Bitte Download verwenden.");
        return;
      }
      await navigator.share({ files: [file] });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setNotice("Speichern nicht möglich. Bitte Download verwenden.");
    }
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setNotice("Download gestartet. Den Speicherort bestimmt dein Browser.");
  }

  return <section className="device-photo-save" aria-label="Aufnahmen auf dem Gerät speichern">
    <strong>{policy === "ask" ? "Aufnahmen auch auf dem Gerät speichern?" : "Aufnahmen zum Speichern bereit"}</strong>
    <p>Safari und andere Browser benötigen einen ausdrücklichen Speicherschritt. Im Teilen-Menü kann „Bild sichern“ verfügbar sein; Downloads landen gegebenenfalls in Dateien statt Fotos.</p>
    {files.map((file, index) => <div className="device-photo-save-row" key={`${file.name}-${index}`}>
      <span>{file.name}</span>
      <button type="button" className="icon-button" aria-label={`${file.name} teilen oder sichern`} title="Teilen / Bild sichern" onClick={() => void share(file)}><Share2 size={18} /></button>
      <button type="button" className="icon-button" aria-label={`${file.name} herunterladen`} title="Download" onClick={() => download(file)}><Download size={18} /></button>
    </div>)}
    {notice && <p role="status">{notice}</p>}
    <button type="button" className="ghost-button" onClick={onDismiss}><X size={16} />{policy === "ask" ? "Überspringen" : "Schließen"}</button>
  </section>;
}
