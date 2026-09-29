import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const supabase = auth.serviceClient;

  const { data, error } = await supabase
    .from("homecare_reports")
    .select("id,job_id,object_id,title,report_date,visible_to_customer,summary,customer_comment,checklist_results,updated_at")
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ data: [], error: error.message, retry: true });
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => ({ id: row.id, jobId: row.job_id, objectId: row.object_id, title: row.title,
      date: row.report_date, visibleToCustomer: row.visible_to_customer, summary: row.summary, customerComment: row.customer_comment,
      checklistResults: row.checklist_results, updatedAt: row.updated_at, backupUpdatedAt: row.updated_at })),
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ error: "Berichts-Backups werden nicht mehr in app_state geschrieben; der relationale Bericht ist maßgeblich." }, { status: 409 });
}
