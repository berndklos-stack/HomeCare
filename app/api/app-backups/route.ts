import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { gzipSync, gunzipSync } from "node:zlib";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const appBackupPrefix = "app-backup:";
const appBackupChunkPrefix = "app-backup-chunk:";
const appBackupBucket = "homecare-backups";
const backupChunkSizeChars = 384 * 1024;

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

  const snapshot = normalizeSnapshot(current.data);
  const createdAt = new Date().toISOString();
  const backupId = `${appBackupPrefix}${createdAt}`;
  const serialized = JSON.stringify(snapshot);
  const compressed = gzipSync(Buffer.from(serialized));
  const chunks: string[] = [];
  const compressedBase64 = compressed.toString("base64");
  for (let offset = 0; offset < compressedBase64.length; offset += backupChunkSizeChars) {
    const chunkIndex = chunks.length + 1;
    chunks.push(`${appBackupChunkPrefix}${createdAt}:${String(chunkIndex).padStart(3, "0")}`);
  }
  const chunkRows = chunks.map((chunkId, index) => ({
    data: {
      backupId,
      content: compressedBase64.slice(index * backupChunkSizeChars, (index + 1) * backupChunkSizeChars),
      index,
      total: chunks.length,
    },
    id: chunkId,
    updated_at: createdAt,
  }));
  const { error: chunkError } = await supabase
    .from("app_state")
    .upsert(chunkRows, { onConflict: "id" });

  if (chunkError) {
    return { response: NextResponse.json({ error: chunkError.message }, { status: 500 }) };
  }

  const backup = {
    counts: snapshotCounts(snapshot),
    createdAt,
    compressed: true,
    id: backupId,
    reason,
    compressedSizeBytes: compressed.byteLength,
    sizeBytes: Buffer.byteLength(serialized),
    sourceUpdatedAt: current.updated_at,
    storageBucket: "app_state",
    storagePath: chunks[0],
    storagePaths: chunks,
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
  try {
    const body = await request.json().catch(() => ({}));
    const { response } = await createCurrentBackup(String(body?.reason ?? "manual"));
    return response;
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Backup konnte nicht erstellt werden.",
    }, { status: 500 });
  }
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
  const paths = Array.isArray(backup.storagePaths) ? backup.storagePaths.map(String) : [String(backup.storagePath ?? "")].filter(Boolean);
  if (!bucket || paths.length === 0) {
    return NextResponse.json({ error: "Backup-Datei fehlt im Index." }, { status: 400 });
  }

  let buffer: Buffer;
  if (bucket === "app_state") {
    const { data: chunkRows, error: chunkError } = await supabase
      .from("app_state")
      .select("data")
      .in("id", paths);
    if (chunkError || !chunkRows) {
      return NextResponse.json({ error: chunkError?.message || "Backup-Teile konnten nicht geladen werden." }, { status: 500 });
    }
    const base64 = chunkRows
      .map((row) => row.data && typeof row.data === "object" ? row.data as JsonObject : {})
      .sort((first, second) => Number(first.index ?? 0) - Number(second.index ?? 0))
      .map((chunk) => String(chunk.content ?? ""))
      .join("");
    buffer = Buffer.from(base64, "base64");
  } else {
    const buffers: Buffer[] = [];
    for (const path of paths) {
      const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(path);
      if (downloadError || !file) {
        return NextResponse.json({ error: downloadError?.message || "Backup-Datei konnte nicht geladen werden." }, { status: 500 });
      }
      buffers.push(Buffer.from(await file.arrayBuffer()));
    }
    buffer = Buffer.concat(buffers);
  }

  const isGzip = backup.compressed === true || paths[0]?.includes(".json.gz");
  const snapshotText = isGzip ? gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
  const snapshot = JSON.parse(snapshotText);
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
