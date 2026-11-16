import { NextResponse } from "next/server";
import { isAuthError, requirePortalAuth } from "@/lib/server/apiAuth";
import { fileCategory, safeArchiveName } from "@/lib/customerFiles";
import { readablePortalFile } from "@/lib/portalFiles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePortalAuth(request);
  if (isAuthError(auth)) return auth;
  const { tenantId, customerId } = auth.access;
  const db = auth.serviceClient;
  const objectIds: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const objects = await db.from("homecare_objects").select("id").eq("tenant_id", tenantId).eq("owner_customer_id", customerId).eq("archived", false).is("deleted_at", null).order("id").range(offset, offset + 499);
    if (objects.error) return NextResponse.json({ error: "Dateifreigaben konnten nicht geprüft werden." }, { status: 503 });
    objectIds.push(...(objects.data ?? []).map(item => String(item.id)));
    if ((objects.data?.length ?? 0) < 500) break;
  }
  const allowedReports: Array<{ id: string; job_id: string | null; title: string; report_date: string | null; customer_id: string | null }> = [];
  for (let chunk = 0; chunk < objectIds.length; chunk += 100) for (let offset = 0; ; offset += 500) {
    const reports = await db.from("homecare_reports").select("id,job_id,title,report_date,customer_id")
      .eq("tenant_id", tenantId).eq("visible_to_customer", true).is("deleted_at", null).in("object_id", objectIds.slice(chunk, chunk + 100)).order("id").range(offset, offset + 499);
    if (reports.error) return NextResponse.json({ error: "Dateifreigaben konnten nicht geprüft werden." }, { status: 503 });
    allowedReports.push(...(reports.data ?? []).filter(item => !item.customer_id || item.customer_id === customerId));
    if ((reports.data?.length ?? 0) < 500) break;
  }
  const reportById = new Map(allowedReports.map(item => [item.id, item]));
  const jobTitles = new Map<string, string>();
  const jobIds = [...new Set(allowedReports.flatMap(item => item.job_id ? [item.job_id] : []))];
  for (let offset = 0; offset < jobIds.length; offset += 100) {
    const jobs = await db.from("homecare_jobs").select("id,title,customer_id").eq("tenant_id", tenantId).is("deleted_at", null).in("id", jobIds.slice(offset, offset + 100));
    if (jobs.error) return NextResponse.json({ error: "Auftragszuordnung konnte nicht geprüft werden." }, { status: 503 });
    for (const job of jobs.data ?? []) if (!job.customer_id || job.customer_id === customerId) jobTitles.set(job.id, job.title);
  }
  const reportByOwnerId = new Map(reportById);
  const messageIds: string[] = [];
  const approvedIds = [...reportById.keys()];
  for (let chunk = 0; chunk < approvedIds.length; chunk += 100) for (let offset = 0; ; offset += 500) {
    const messages = await db.from("homecare_portal_messages").select("id,report_id").eq("tenant_id", tenantId).eq("customer_id", customerId)
      .eq("origin", "office").eq("delivery_status", "gesendet").is("deleted_at", null).in("report_id", approvedIds.slice(chunk, chunk + 100)).order("id").range(offset, offset + 499);
    if (messages.error) return NextResponse.json({ error: "Dateifreigaben konnten nicht geprüft werden." }, { status: 503 });
    for (const message of messages.data ?? []) {
      const report = reportById.get(message.report_id);
      if (report) { messageIds.push(message.id); reportByOwnerId.set(message.id, report); }
    }
    if ((messages.data?.length ?? 0) < 500) break;
  }
  const id = new URL(request.url).searchParams.get("id");
  const records: Array<{ id: string; owner_id: string; name: string; kind: string; storage_path: string | null; metadata: unknown }> = [];
  for (const [ownerType, reportIds] of [["report", approvedIds], ["portal_message", messageIds]] as const) {
    // Bound each query and page media, so a large history is not silently truncated.
    for (let offset = 0; offset < reportIds.length; offset += 100) {
      for (let page = 0; ; page += 500) {
        let query = db.from("homecare_media").select("id,owner_id,name,kind,storage_path,metadata").eq("tenant_id", tenantId)
          .eq("owner_type", ownerType).is("deleted_at", null).in("owner_id", reportIds.slice(offset, offset + 100)).order("id").range(page, page + 499);
        if (id) query = query.eq("id", id);
        const result = await query;
        if (result.error) return NextResponse.json({ error: "Dateien konnten nicht geladen werden." }, { status: 503 });
        records.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 500) break;
      }
    }
  }
  const ownerIds = new Set(reportByOwnerId.keys());
  const readable = records.filter(item => readablePortalFile(item, ownerIds, tenantId));
  if (id) {
    const file = readable.find(item => item.id === id);
    if (!file) return NextResponse.json({ error: "Datei ist nicht freigegeben." }, { status: 404 });
    const download = await db.storage.from("homecare-private-media").download(file.storage_path!);
    if (download.error || !download.data) return NextResponse.json({ error: "Datei konnte nicht geladen werden." }, { status: 404 });
    return new NextResponse(download.data, { headers: {
      "Cache-Control": "private, no-store", "Content-Type": download.data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeArchiveName(file.name))}`,
      "X-Content-Type-Options": "nosniff",
    } });
  }
  const seenPaths = new Set<string>();
  const listed = readable.filter(item => {
    const report = reportByOwnerId.get(item.owner_id)!;
    const key = `${report.job_id || report.id}|${item.storage_path}`;
    if (seenPaths.has(key)) return false;
    seenPaths.add(key); return true;
  });
  return NextResponse.json({ files: listed.map(item => {
    const report = reportByOwnerId.get(item.owner_id)!;
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : {};
    return { id: item.id, name: item.name, category: fileCategory(item.name, item.kind === "checklist_photo" ? "image/jpeg" : String(metadata.type || "")),
      jobId: report.job_id || report.id, jobTitle: jobTitles.get(report.job_id || "") || report.title, date: report.report_date,
      source: `/api/portal/files?id=${encodeURIComponent(item.id)}`, size: typeof metadata.size === "number" ? metadata.size : undefined };
  }) }, { headers: { "Cache-Control": "private, no-store" } });
}
