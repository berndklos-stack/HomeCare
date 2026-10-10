import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const { data, error } = await auth.client.from("homecare_relational_backups")
    .select("id,format_version,reason,manifest,checksum,created_at,restored_at,restore_tenant_id")
    .eq("format_version", 1)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function PUT(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  const { data: backup, error } = await auth.client.rpc("homecare_create_relational_backup", {
    p_reason: String(body?.reason ?? "manual"),
    p_tenant_id: auth.tenantId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ backup, ok: true });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "backups.manage");
  if (isAuthError(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  const backupId = String(body?.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(backupId)) return NextResponse.json({ error: "Backup-ID fehlt oder ist ungültig." }, { status: 400 });
  const { data: backup, error: lookupError } = await auth.client.from("homecare_relational_backups")
    .select("format_version").eq("tenant_id", auth.tenantId).eq("id", backupId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Backup konnte nicht geprüft werden." }, { status: 503 });
  if (!backup || backup.format_version !== 1) return NextResponse.json({ error: "Keine vollständige App-Sicherung. Gezielte Konfliktsicherungen werden separat wiederhergestellt." }, { status: 409 });
  const { data, error } = await auth.client.rpc("homecare_restore_relational_backup", { p_backup_id: backupId, p_target_tenant_id: auth.tenantId });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(data);
}
