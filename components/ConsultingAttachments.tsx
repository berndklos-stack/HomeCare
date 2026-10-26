"use client";

import { FileText, Paperclip, Trash2 } from "lucide-react";
import { useAuthenticatedMedia } from "@/lib/useAuthenticatedMedia";
import { consultingAttachmentSource, type ConsultingAttachment } from "@/lib/consultingAttachments";

function Attachment({ file, onRemove, language }: { file: ConsultingAttachment; onRemove?: () => void; language: string }) {
  const media = useAuthenticatedMedia(consultingAttachmentSource(file));
  const copy = (de: string, sv: string, en: string) => language === "sv" ? sv : language === "en" ? en : de;
  return <li>
    {media.url ? <a href={media.url} target="_blank" rel="noreferrer" download={file.name}>
      {/^image\/(jpeg|png|webp)$/.test(file.contentType) ? <img src={media.url} alt={file.name} /> : <FileText size={22} />}
      <span>{file.name}<small>{Math.ceil(file.size / 1024)} KB</small></span>
    </a> : <span><Paperclip size={18} />{file.name}<small role="status">{media.failed ? copy("Datei konnte nicht geladen werden", "Filen kunde inte laddas", "Unable to load file") : copy("Wird geladen …", "Laddar …", "Loading …")}</small></span>}
    {onRemove && <button type="button" className="icon-button" title={copy("Anhang entfernen", "Ta bort bilaga", "Remove attachment")} aria-label={`${copy("Anhang entfernen", "Ta bort bilaga", "Remove attachment")} ${file.name}`} onClick={onRemove}><Trash2 size={18} /></button>}
  </li>;
}

export function ConsultingAttachments({ files, onRemove, language }: { files: ConsultingAttachment[]; onRemove?: (id: string) => void; language: string }) {
  return files.length ? <ul className="consulting-attachments">{files.map(file => <Attachment key={file.id} file={file} language={language} onRemove={onRemove ? () => onRemove(file.id) : undefined} />)}</ul> : null;
}
