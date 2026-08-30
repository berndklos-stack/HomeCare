import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const appBackupPrefix = "app-backup:";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: [], error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .like("id", `${appBackupPrefix}%`)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((row) => ({
      ...(row.data && typeof row.data === "object" ? row.data as JsonObject : {}),
      backupUpdatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const body = await request.json();
  const backupId = String(body?.id ?? "");
  if (!backupId.startsWith(appBackupPrefix)) {
    return NextResponse.json({ error: "Backup-ID fehlt oder ist ungültig." }, { status: 400 });
  }

  const { data: backupRow, error: backupError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", backupId)
    .maybeSingle();

  if (backupError || !backupRow?.data || typeof backupRow.data !== "object") {
    return NextResponse.json({ error: backupError?.message || "Backup wurde nicht gefunden." }, { status: 404 });
  }

  const backup = backupRow.data as JsonObject;
  const bucket = String(backup.storageBucket ?? "");
  const path = String(backup.storagePath ?? "");
  if (!bucket || !path) {
    return NextResponse.json({ error: "Backup-Datei fehlt im Index." }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(path);
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message || "Backup-Datei konnte nicht geladen werden." }, { status: 500 });
  }

  const snapshot = JSON.parse(await file.text());
  const restoredAt = new Date().toISOString();
  const { error: restoreError } = await supabase
    .from("app_state")
    .upsert({
      data: {
        ...snapshot,
        updatedAt: restoredAt,
      },
      id: appStateRowId,
      updated_at: restoredAt,
    }, { onConflict: "id" });

  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, restoredAt });
}
