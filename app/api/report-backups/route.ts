import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const reportBackupPrefix = "report-backup:";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function backupId(reportId: string) {
  return `${reportBackupPrefix}${reportId}`;
}

function smallReportBackup(report: JsonObject) {
  const checklistResults = Array.isArray(report.checklistResults)
    ? report.checklistResults.map((item) => {
        const task = item && typeof item === "object" ? item as JsonObject : {};
        return {
          completed: task.completed,
          description: task.description,
          id: task.id,
          meta: task.meta,
          minutes: task.minutes,
          note: task.note,
          showWorkTimeInReport: task.showWorkTimeInReport,
          title: task.title,
          updatedAt: task.updatedAt,
        };
      })
    : [];

  return {
    checklistResults,
    customerComment: report.customerComment ?? "",
    date: report.date,
    id: report.id,
    jobId: report.jobId,
    objectId: report.objectId,
    summary: report.summary ?? "",
    title: report.title,
    updatedAt: report.updatedAt ?? new Date().toISOString(),
    visibleToCustomer: report.visibleToCustomer ?? true,
  };
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const supabase = auth.client;

  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .like("id", `${reportBackupPrefix}%`);

  if (error) {
    return NextResponse.json({ data: [], error: error.message, retry: true });
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      ...(row.data && typeof row.data === "object" ? row.data as JsonObject : {}),
      backupUpdatedAt: row.updated_at,
    })),
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const supabase = auth.client;

  const body = await request.json();
  const report = body && typeof body === "object" ? body as JsonObject : {};
  const reportId = String(report.id ?? "");
  if (!reportId) {
    return NextResponse.json({ error: "Berichts-ID fehlt." }, { status: 400 });
  }

  const backup = smallReportBackup(report);
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("app_state")
    .upsert({
      data: backup,
      id: backupId(reportId),
      tenant_id: auth.tenantId,
      updated_at: updatedAt,
    }, { onConflict: "tenant_id,id" });

  if (error) {
    return NextResponse.json({ error: error.message, retry: true }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt });
}
