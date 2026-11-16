import { NextResponse } from "next/server";
import { isAuthError, requirePortalAuth } from "@/lib/server/apiAuth";
import { safeArchiveName } from "@/lib/customerFiles";
import { customerMediaTarget, customerReportPdf, describeCustomerMedia, loadCustomerMedia } from "@/lib/server/customerFileMedia";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requirePortalAuth(request);
  if (isAuthError(auth)) return auth;
  const { tenantId, customerId } = auth.access;
  const url = new URL(request.url), db = auth.serviceClient, id = url.searchParams.get("id") || undefined, reportId = url.searchParams.get("reportId");
  try {
    const customer = await db.from("homecare_customers").select("id").eq("tenant_id", tenantId).eq("id", customerId).eq("archived", false).is("deleted_at", null).maybeSingle();
    if (customer.error || !customer.data) return NextResponse.json({ error: "Kundenzugang ist nicht mehr aktiv." }, { status: 403 });
    const rows = await loadCustomerMedia(db, tenantId, customerId, true, id);
    if (reportId) {
      const report = rows.reports.find(item => item.id === reportId);
      if (!report) return NextResponse.json({ error: "Bericht nicht freigegeben." }, { status: 404 });
      return new NextResponse(await customerReportPdf(db, tenantId, report), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeArchiveName(`${report.report_date || ""}-${report.title}.pdf`))}`, "X-Content-Type-Options": "nosniff" } });
    }
    if (!id) return NextResponse.json({ files: await describeCustomerMedia(db, tenantId, rows, "/api/portal/files") }, { headers: { "Cache-Control": "private, no-store" } });
    const file = rows.records.find(item => item.id === id), target = file && customerMediaTarget(file, tenantId);
    if (!file || !target) return NextResponse.json({ error: "Datei ist nicht freigegeben." }, { status: 404 });
    const download = await db.storage.from(target.bucket).download(target.path);
    if (download.error || !download.data) return NextResponse.json({ error: "Originaldatei ist nicht verfuegbar." }, { status: 404 });
    return new NextResponse(download.data, { headers: {
      "Cache-Control": "private, no-store", "Content-Type": download.data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeArchiveName(file.name))}`, "X-Content-Type-Options": "nosniff",
    } });
  } catch { return NextResponse.json({ error: "Dateifreigaben konnten nicht geprueft werden." }, { status: 503 }); }
}
