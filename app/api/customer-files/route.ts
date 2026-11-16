import { NextResponse } from "next/server";
import { requireApiAuth, isAuthError } from "@/lib/server/apiAuth";
import { customerMediaTarget, customerReportPdf, describeCustomerMedia, loadCustomerMedia } from "@/lib/server/customerFileMedia";
import { safeArchiveName } from "@/lib/customerFiles";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  const url = new URL(request.url), customer = url.searchParams.get("customerId"), id = url.searchParams.get("id") || undefined;
  if (!customer) return NextResponse.json({ error: "Kundenzuordnung fehlt." }, { status: 400 });
  const existing = await auth.serviceClient.from("homecare_customers").select("id").eq("tenant_id", auth.tenantId).eq("id", customer).is("deleted_at", null).maybeSingle();
  if (existing.error || !existing.data) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  try {
    const preview = url.searchParams.get("view") === "portal";
    const reportId = url.searchParams.get("reportId");
    const rows = await loadCustomerMedia(auth.serviceClient, auth.tenantId, customer, preview, id);
    if (reportId) {
      const report = rows.reports.find(item => item.id === reportId);
      if (!report) return NextResponse.json({ error: "Bericht nicht freigegeben." }, { status: 404 });
      return new NextResponse(await customerReportPdf(auth.serviceClient, auth.tenantId, report), { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeArchiveName(`${report.report_date || ""}-${report.title}.pdf`))}`, "X-Content-Type-Options": "nosniff" } });
    }
    if (!id) return NextResponse.json({ files: await describeCustomerMedia(auth.serviceClient, auth.tenantId, rows, `/api/customer-files?customerId=${encodeURIComponent(customer)}${preview ? "&view=portal" : ""}`) }, { headers: { "Cache-Control": "private, no-store" } });
    const row = rows.records.find(item => item.id === id), target = row && customerMediaTarget(row, auth.tenantId);
    if (!row || !target) return NextResponse.json({ error: "Datei nicht freigegeben." }, { status: 404 });
    const result = await auth.serviceClient.storage.from(target.bucket).download(target.path);
    if (result.error || !result.data) return NextResponse.json({ error: "Originaldatei ist nicht verfuegbar." }, { status: 404 });
    return new NextResponse(result.data, { headers: { "Content-Type": result.data.type || "application/octet-stream", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeArchiveName(row.name))}`, "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Dateiuebersicht konnte nicht geladen werden." }, { status: 503 }); }
}
