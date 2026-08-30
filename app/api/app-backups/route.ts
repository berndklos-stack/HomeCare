import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const appBackupPrefix = "app-backup:";
const appBackupBucket = "homecare-backups";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function safePathPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "backup";
}

function normalizeSnapshot(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Object.keys(payload as JsonObject).length === 1
  ) {
    return (payload as { data: unknown }).data;
  }

  return payload;
}

function snapshotCounts(snapshot: unknown) {
  const data = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as JsonObject : {};
  const fieldProgress = data.fieldProgress && typeof data.fieldProgress === "object" && !Array.isArray(data.fieldProgress)
    ? data.fieldProgress as JsonObject
    : {};

  return {
    customers: Array.isArray(data.customers) ? data.customers.length : 0,
    fieldProgress: Object.keys(fieldProgress).length,
    jobs: Array.isArray(data.jobs) ? data.jobs.length : 0,
    objects: Array.isArray(data.objects) ? data.objects.length : 0,
    reports: Array.isArray(data.reports) ? data.reports.length : 0,
  };
}

async function ensureBackupBucket(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(appBackupBucket);
  if (bucket) return;

  const { error: createError } = await supabase.storage.createBucket(appBackupBucket, {
    fileSizeLimit: 60 * 1024 * 1024,
    public: false,
  });
  if (createError) {
    throw new Error(createError.message || getError?.message || "Backup-Bucket konnte nicht angelegt werden.");
  }
}

async function createCurrentBackup(reason: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { response: NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 }) };
  }

  const { data: current, error: currentError } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("id", appStateRowId)
    .maybeSingle();

  if (currentError || !current?.data) {
    return { response: NextResponse.json({ error: currentError?.message || "Aktueller App-Stand wurde nicht gefunden." }, { status: 404 }) };
  }

  await ensureBackupBucket(supabase);

  const snapshot = normalizeSnapshot(current.data);
  const createdAt = new Date().toISOString();
  const backupId = `${appBackupPrefix}${createdAt}`;
  const storagePath = `app-state/${createdAt.slice(0, 10)}/${safePathPart(createdAt)}.json`;
  const serialized = JSON.stringify(snapshot);
  const { error: uploadError } = await supabase.storage
    .from(appBackupBucket)
    .upload(storagePath, Buffer.from(serialized), {
      cacheControl: "0",
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    return { response: NextResponse.json({ error: uploadError.message }, { status: 500 }) };
  }

  const backup = {
    counts: snapshotCounts(snapshot),
    createdAt,
    id: backupId,
    reason,
    sizeBytes: Buffer.byteLength(serialized),
    sourceUpdatedAt: current.updated_at,
    storageBucket: appBackupBucket,
    storagePath,
  };
  const { error: indexError } = await supabase
    .from("app_state")
    .upsert({
      data: backup,
      id: backupId,
      updated_at: createdAt,
    }, { onConflict: "id" });

  if (indexError) {
    return { response: NextResponse.json({ error: indexError.message }, { status: 500 }) };
  }

  return { response: NextResponse.json({ ok: true, backup }) };
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

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { response } = await createCurrentBackup(String(body?.reason ?? "manual"));
  return response;
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
