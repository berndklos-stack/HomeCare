import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fileCategory, uniqueCustomerFiles, type CustomerFile } from "@/lib/customerFiles";
import { legacyObjectMediaReferencePath } from "./legacyObjectMediaPath";
import { platformTenantId } from "@/lib/administration";

export type CustomerMediaRow = { id: string; owner_type: string; owner_id: string; name: string; kind: string; storage_path: string | null; preview_url: string | null; metadata: Record<string, unknown> | null; created_at?: string };
type Owner = { jobId: string; jobTitle: string; date?: string; reportPdfName?: string; reportId?: string };

export function customerMediaTarget(row: CustomerMediaRow, tenant: string, origin = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const path = row.storage_path;
  const safe = (value: string) => {
    try {
      for (let level = 0; level < 3; level++) {
        if (value.split("/").some(part => part === ".." || part === ".") || /[\x00-\x1f\\]/.test(value)) return false;
        const decoded = decodeURIComponent(value);
        if (decoded === value) return true;
        value = decoded;
      }
    } catch { return false; }
    return false;
  };
  if (path?.startsWith(`${tenant}/`) && safe(path)) return { bucket: "homecare-private-media", path };
  const migrated = legacyObjectMediaReferencePath(row, origin);
  if (!path && migrated && safe(migrated) && tenant === platformTenantId) return { bucket: "homecare-private-media", path: migrated };
  if (!path && row.preview_url) {
    try {
      const url = new URL(row.preview_url, origin || "https://workcore.local");
      const api = row.preview_url.startsWith("/api/private-media?") || row.preview_url.startsWith("/api/media?");
      const prefix = ["public", "sign", "authenticated"].map(access => `/storage/v1/object/${access}/homecare-private-media/`).find(value => url.pathname.startsWith(value));
      const candidate = api ? url.searchParams.get("path") : origin && url.origin === new URL(origin).origin && !url.username && !url.password && prefix ? decodeURIComponent(url.pathname.slice(prefix.length)) : null;
      if (candidate?.startsWith(`${tenant}/`) && safe(candidate)) return { bucket: "homecare-private-media", path: candidate };
    } catch { return null; }
  }
  // Global pre-tenant originals belong exclusively to the original migrated tenant.
  if (tenant !== platformTenantId || !path?.startsWith("field-photos/") || !safe(path) || !origin) return null;
  try {
    const url = new URL(row.preview_url || "", origin);
    const prefixes = ["public", "sign", "authenticated"].map(access => `/storage/v1/object/${access}/homecare-media/`);
    const prefix = prefixes.find(value => url.pathname.startsWith(value));
    if (url.origin === new URL(origin).origin && !url.username && !url.password && prefix && decodeURIComponent(url.pathname.slice(prefix.length)) === path) return { bucket: "homecare-media", path };
  } catch { /* Unrecognized legacy references do not authorize a download. */ }
  return null;
}

async function all<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const response = await load(offset, offset + 499);
    if (response.error) throw Error("Dateizuordnung konnte nicht geprueft werden.");
    result.push(...(response.data || []));
    if ((response.data?.length || 0) < 500) return result;
  }
}

export async function loadCustomerMedia(db: SupabaseClient, tenant: string, customer: string, portal: boolean, onlyId?: string) {
  const owner = new Map<string, Owner>();
  const objects = await all((from, to) => {
    let query = db.from("homecare_objects").select("id,name").eq("tenant_id", tenant).eq("owner_customer_id", customer).is("deleted_at", null);
    if (portal) query = query.eq("archived", false);
    return query.order("id").range(from, to);
  });
  if (!portal) for (const object of objects) owner.set(`object:${object.id}`, { jobId: object.id, jobTitle: object.name });
  const jobs = await all((from, to) => db.from("homecare_jobs").select("id,title,customer_id,object_id").eq("tenant_id", tenant).is("deleted_at", null).order("id").range(from, to));
  const ownedObjects = new Set(objects.map(item => item.id));
  const allowedJobs = new Map(jobs.filter(job => job.customer_id ? job.customer_id === customer : ownedObjects.has(job.object_id)).map(job => [job.id, job]));
  const reports = [];
  for (let chunk = 0; chunk < objects.length; chunk += 100) {
    const rows = await all((from, to) => {
      let query = db.from("homecare_reports").select("id,job_id,title,report_date,customer_id,summary,checklist_results").eq("tenant_id", tenant).is("deleted_at", null).in("object_id", objects.slice(chunk, chunk + 100).map(item => item.id));
      if (portal) query = query.eq("visible_to_customer", true);
      return query.order("id").range(from, to);
    });
    for (const report of rows) if ((!report.customer_id || report.customer_id === customer) && (!report.job_id || !jobs.some(job => job.id === report.job_id) || allowedJobs.has(report.job_id))) reports.push(report);
  }
  for (const report of reports) owner.set(`report:${report.id}`, { reportId: report.id, jobId: report.job_id || report.id, jobTitle: allowedJobs.get(report.job_id)?.title || report.title, date: report.report_date || undefined });
  const reportIds = new Set(reports.map(report => report.id));
  const messages = await all((from, to) => db.from("homecare_portal_messages").select("id,report_id,subject").eq("tenant_id", tenant).eq("customer_id", customer).eq("origin", "office").eq("delivery_status", "gesendet").is("deleted_at", null).order("id").range(from, to));
  for (const message of messages) if (reportIds.has(message.report_id)) {
    owner.set(`portal_message:${message.id}`, { ...owner.get(`report:${message.report_id}`)!, reportPdfName: `${String(message.subject || "").replace(/[^\wäöüÄÖÜß-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.pdf` });
  }
  if (!portal) {
    for (let chunk = 0; chunk < allowedJobs.size; chunk += 100) {
      const entries = await all((from, to) => db.from("homecare_job_time_entries").select("id,job_id,entry_date").eq("tenant_id", tenant).is("deleted_at", null).in("job_id", [...allowedJobs.keys()].slice(chunk, chunk + 100)).order("id").range(from, to));
      for (const entry of entries) owner.set(`job_time_entry:${entry.id}`, { jobId: entry.job_id, jobTitle: allowedJobs.get(entry.job_id)!.title, date: entry.entry_date || undefined });
    }
  }
  const records: CustomerMediaRow[] = [];
  for (const type of ["object", "report", "portal_message", "job_time_entry"]) {
    const ids = [...owner.keys()].filter(key => key.startsWith(`${type}:`)).map(key => key.slice(type.length + 1));
    for (let chunk = 0; chunk < ids.length; chunk += 100) records.push(...await all((from, to) => {
      let query = db.from("homecare_media").select("id,owner_type,owner_id,name,kind,storage_path,preview_url,metadata,created_at").eq("tenant_id", tenant).eq("owner_type", type).is("deleted_at", null).in("owner_id", ids.slice(chunk, chunk + 100));
      if (onlyId) query = query.eq("id", onlyId);
      return query.order("id").range(from, to);
    }) as CustomerMediaRow[]);
  }
  return { records, owner, reports };
}

export async function describeCustomerMedia(db: SupabaseClient, tenant: string, rows: Awaited<ReturnType<typeof loadCustomerMedia>>, endpoint: string) {
  const files: CustomerFile[] = [];
  const inspected = new Map<string, Promise<{ hash?: string; size?: number; unavailable: boolean }>>();
  const inspect = async (row: CustomerMediaRow) => {
    const target = customerMediaTarget(row, tenant);
    if (!target) return { unavailable: true };
    const key = `${target.bucket}/${target.path}`;
    if (!inspected.has(key)) inspected.set(key, (async () => {
      const storage = db.storage.from(target.bucket);
      const info = await storage.info(target.path);
      if (!info.error && info.data) {
        const tag = info.data.etag?.replace(/^"|"$/g, "");
        if (tag && /^[a-f0-9]{32}$/i.test(tag)) return { hash: `md5:${tag.toLowerCase()}`, size: info.data.size, unavailable: false };
        if ((info.data.size || 0) > 25 * 1024 * 1024) return { size: info.data.size, unavailable: false };
      }
      const result = await storage.download(target.path);
      if (result.error || !result.data) return { unavailable: true };
      if (result.data.size > 25 * 1024 * 1024) return { size: result.data.size, unavailable: false };
      return { hash: `md5:${createHash("md5").update(Buffer.from(await result.data.arrayBuffer())).digest("hex")}`, size: result.data.size, unavailable: false };
    })());
    return inspected.get(key)!;
  };
  let cursor = 0;
  const storedReports = new Set<string>();
  await Promise.all(Array.from({ length: Math.min(6, rows.records.length) }, async () => {
    while (cursor < rows.records.length) {
      const row = rows.records[cursor++], owner = rows.owner.get(`${row.owner_type}:${row.owner_id}`)!;
      const info = await inspect(row);
      const reportPdf = row.owner_type === "portal_message" && row.name === owner.reportPdfName;
      if (reportPdf && !info.unavailable && owner.reportId) storedReports.add(owner.reportId);
      files.push({ id: row.id, name: row.name, jobId: owner.jobId, jobTitle: owner.jobTitle, date: owner.date || row.created_at?.slice(0, 10),
        category: reportPdf ? "report" : fileCategory(row.name, String(row.metadata?.contentType || row.metadata?.type || (row.kind === "checklist_photo" ? "image/jpeg" : ""))),
        source: `${endpoint}${endpoint.includes("?") ? "&" : "?"}id=${encodeURIComponent(row.id)}`, size: info.size, contentKey: info.hash, unavailable: info.unavailable });
    }
  }));
  for (const report of rows.reports) if (!storedReports.has(report.id)) {
    const owner = rows.owner.get(`report:${report.id}`)!;
    files.push({ id: `REPORT:${report.id}`, name: `${report.report_date || ""}-${report.title || "Einsatzbericht"}.pdf`, category: "report", jobId: owner.jobId, jobTitle: owner.jobTitle, date: owner.date,
      source: `${endpoint}${endpoint.includes("?") ? "&" : "?"}reportId=${encodeURIComponent(report.id)}` });
  }
  return uniqueCustomerFiles(files);
}

export async function customerReportPdf(db: SupabaseClient, tenant: string, report: Awaited<ReturnType<typeof loadCustomerMedia>>["reports"][number]) {
  const company = await db.from("homecare_tenants").select("name").eq("id", tenant).single();
  if (company.error) throw Error("Firmenzuordnung konnte nicht geladen werden.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const text = (value: string, size = 11) => {
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(value, 180) as string[]) {
      if (y > 275) { pdf.addPage(); y = 18; }
      pdf.text(line, 15, y); y += size > 14 ? 9 : 6;
    }
    y += 3;
  };
  text(company.data.name || "WorkCore", 12);
  text("Einsatzbericht", 20);
  text(report.title || "Einsatzbericht", 14);
  text(report.report_date || "");
  if (typeof report.summary === "string") text(report.summary);
  // Only customer-facing report fields are exported; internal notes and rates are never read.
  if (Array.isArray(report.checklist_results)) for (const item of report.checklist_results) {
    if (!item || typeof item !== "object") continue;
    const task = item as Record<string, unknown>;
    if (typeof task.title === "string") text(task.title, 12);
    if (typeof task.description === "string" && task.description) text(task.description);
    if (typeof task.note === "string" && task.note) text(task.note);
  }
  const total = pdf.getNumberOfPages();
  for (let page = 1; page <= total; page++) { pdf.setPage(page); pdf.setFontSize(9); pdf.text(`${page} / ${total}`, 185, 289); }
  return new Uint8Array(pdf.output("arraybuffer"));
}
