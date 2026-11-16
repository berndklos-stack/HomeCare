export type CustomerFile = {
  id: string;
  name: string;
  category: "image" | "document" | "report";
  jobId: string;
  jobTitle: string;
  source: string;
  size?: number;
  date?: string;
  contentKey?: string;
  unavailable?: boolean;
};

export function fileCategory(name: string, contentType = ""): CustomerFile["category"] {
  return contentType.startsWith("image/") || /\.(?:jpe?g|png|webp|heic|heif|gif)$/i.test(name) ? "image" : "document";
}

export function safeArchiveName(name: string) {
  return name.normalize("NFC").replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, "_").replace(/^\.+|[. ]+$/g, "").slice(0, 150) || "Datei";
}

export function customerArchivePaths(files: CustomerFile[]) {
  const used = new Set<string>();
  return files.map(file => {
    const group = `${file.category === "report" ? "Einsatzberichte" : file.category === "image" ? "Bilder" : "Dokumente"}/${safeArchiveName(file.jobTitle)}-${safeArchiveName(file.jobId)}`;
    const name = safeArchiveName(file.name);
    let path = `${group}/${name}`, count = 1;
    while (used.has(path.toLocaleLowerCase())) { count++; const dot = name.lastIndexOf("."); path = `${group}/${dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`}`; }
    used.add(path.toLocaleLowerCase());
    return path;
  });
}

export function uniqueCustomerFiles(files: CustomerFile[]) {
  const seen = new Set<string>();
  return [...files].sort((a, b) => Number(b.category === "report") - Number(a.category === "report") || (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).filter(file => {
    const key = `${file.jobId}|${file.contentKey || file.source}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

type Attachment = { id: string; name: string; storagePath?: string; dataUrl?: string; storageUrl?: string; previewUrl?: string; type?: string; contentType?: string; size?: number };
type FileJob = { id: string; title: string; objectId?: string; customerId?: string; consulting?: { entries: { id: string; date: string; attachments?: Attachment[] }[] } };
type FileReport = { id: string; jobId: string; objectId: string; date: string; visibleToCustomer?: boolean; deletedAt?: string; attachments?: Attachment[]; checklistResults: { photos: { id?: string; name: string; storagePath?: string; previewUrl?: string }[] }[] };

export function collectCustomerFiles(customerId: string, objects: { id: string; name: string; ownerCustomerId?: string; media?: { items: (Attachment & { type?: string })[] } }[], jobs: FileJob[], reports: FileReport[], portal = false,
  messages: { id: string; customerId: string; reportId?: string; deliveryStatus?: string; origin?: string; attachments?: Attachment[] }[] = []) {
  const owned = new Map(objects.filter(object => object.ownerCustomerId === customerId).map(object => [object.id, object]));
  const files: CustomerFile[] = [];
  const seen = new Set<string>();
  const add = (attachment: Attachment, jobId: string, jobTitle: string, date = "") => {
    const source = attachment.storagePath ? `/api/private-media?path=${encodeURIComponent(attachment.storagePath)}` : attachment.dataUrl || attachment.previewUrl || attachment.storageUrl || "";
    if (!source || (!source.startsWith("/api/") && !source.startsWith("data:") && !source.startsWith("https://"))) return;
    const key = `${jobId}|${attachment.storagePath || source}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push({ id: `${jobId}:${attachment.id}`, name: attachment.name, category: fileCategory(attachment.name, attachment.contentType || attachment.type), jobId, jobTitle, source, size: attachment.size, date });
  };
  for (const report of reports) {
    if (report.deletedAt || !owned.has(report.objectId) || (portal && !report.visibleToCustomer)) continue;
    const job = jobs.find(item => item.id === report.jobId);
    if (job?.customerId && job.customerId !== customerId) continue;
    for (const attachment of report.attachments ?? []) add(attachment, report.jobId, job?.title || report.jobId, report.date);
    for (const task of report.checklistResults) for (const photo of task.photos) add({ ...photo, id: photo.id || photo.name, type: "image/jpeg" }, report.jobId, job?.title || report.jobId, report.date);
  }
  for (const message of messages) {
    if (message.customerId !== customerId || message.deliveryStatus !== "gesendet" || message.origin !== "office") continue;
    const report = reports.find(item => item.id === message.reportId && !item.deletedAt && owned.has(item.objectId) && (!portal || item.visibleToCustomer));
    if (!report) continue;
    const job = jobs.find(item => item.id === report.jobId);
    if (job?.customerId && job.customerId !== customerId) continue;
    for (const attachment of message.attachments ?? []) add(attachment, report.jobId, job?.title || report.jobId, report.date);
  }
  if (!portal) {
    for (const job of jobs) {
      if (job.customerId ? job.customerId !== customerId : !owned.has(job.objectId || "")) continue;
      for (const entry of job.consulting?.entries ?? []) for (const attachment of entry.attachments ?? []) add(attachment, job.id, job.title, entry.date);
    }
    for (const object of owned.values()) for (const item of object.media?.items ?? []) add(item, object.id, object.name);
  }
  return files.sort((a, b) => a.jobTitle.localeCompare(b.jobTitle) || a.name.localeCompare(b.name));
}
