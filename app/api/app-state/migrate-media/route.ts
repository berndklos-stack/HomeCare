import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const privateMediaBucket = "homecare-private-media";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
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

function safePathPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "media";
}

function dataUrlInfo(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const body = match[3] || "";
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
  const extension = contentType.includes("jpeg") ? "jpg"
    : contentType.includes("png") ? "png"
      : contentType.includes("webp") ? "webp"
        : contentType.includes("svg") ? "svg"
          : "bin";
  return { buffer, contentType, extension };
}

async function ensurePrivateMediaBucket(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(privateMediaBucket);
  if (bucket) return;
  const { error: createError } = await supabase.storage.createBucket(privateMediaBucket, {
    fileSizeLimit: 25 * 1024 * 1024,
    public: false,
  });
  if (createError) {
    throw new Error(createError.message || getError?.message || "Privater Media-Bucket konnte nicht angelegt werden.");
  }
}

async function migrateValue(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  value: unknown,
  path: string[],
  stats: { migrated: number; skipped: number },
): Promise<unknown> {
  if (typeof value === "string" && value.startsWith("data:")) {
    const info = dataUrlInfo(value);
    if (!info || info.buffer.byteLength === 0) {
      stats.skipped += 1;
      return value;
    }
    const storagePath = `migrated-app-state/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safePathPart(path.join("-"))}.${info.extension}`;
    const { error } = await supabase.storage
      .from(privateMediaBucket)
      .upload(storagePath, info.buffer, {
        cacheControl: "31536000",
        contentType: info.contentType,
        upsert: false,
      });
    if (error) throw new Error(error.message);
    stats.migrated += 1;
    return `/api/private-media?path=${encodeURIComponent(storagePath)}`;
  }

  if (Array.isArray(value)) {
    const migratedItems = [];
    for (let index = 0; index < value.length; index += 1) {
      migratedItems.push(await migrateValue(supabase, value[index], [...path, String(index)], stats));
    }
    return migratedItems;
  }

  if (!value || typeof value !== "object") return value;

  const entries: Array<readonly [string, unknown]> = [];
  for (const [key, item] of Object.entries(value as JsonObject)) {
    entries.push([key, await migrateValue(supabase, item, [...path, key], stats)] as const);
  }
  return Object.fromEntries(entries);
}

export async function POST() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  try {
    await ensurePrivateMediaBucket(supabase);
    const { data: current, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("id", appStateRowId)
      .maybeSingle();
    if (error || !current?.data) {
      return NextResponse.json({ error: error?.message || "Aktueller App-Stand wurde nicht gefunden." }, { status: 404 });
    }

    const stats = { migrated: 0, skipped: 0 };
    const snapshot = normalizeSnapshot(current.data);
    const migrated = await migrateValue(supabase, snapshot, [], stats);
    const updatedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("app_state")
      .upsert({
        data: {
          ...(migrated && typeof migrated === "object" && !Array.isArray(migrated) ? migrated as JsonObject : {}),
          updatedAt,
        },
        id: appStateRowId,
        updated_at: updatedAt,
      }, { onConflict: "id" });

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt, ...stats });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Medienmigration fehlgeschlagen." }, { status: 500 });
  }
}
