import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const mediaBucket = "homecare-media";

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
    .slice(0, 90) || "datei";
}

async function ensureMediaBucket(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(mediaBucket);
  if (bucket) return;
  const { error: createError } = await supabase.storage.createBucket(mediaBucket, {
    fileSizeLimit: 25 * 1024 * 1024,
    public: true,
  });
  if (createError) {
    throw new Error(
      `Storage-Bucket "${mediaBucket}" fehlt und konnte nicht automatisch angelegt werden. `
      + `Bitte Bucket in Supabase anlegen oder SUPABASE_SERVICE_ROLE_KEY in Vercel setzen. `
      + `Details: ${createError.message || getError?.message || "unbekannt"}`,
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei empfangen." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei ist größer als 25 MB." }, { status: 413 });
  }

  try {
    await ensureMediaBucket(supabase);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storage-Bucket fehlt." }, { status: 500 });
  }

  const scope = safePathPart(String(formData.get("scope") || "uploads"));
  const name = safePathPart(file.name);
  const randomPart = crypto.randomUUID();
  const path = `${scope}/${new Date().toISOString().slice(0, 10)}/${randomPart}-${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(mediaBucket)
    .upload(path, buffer, {
      cacheControl: "31536000",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(mediaBucket).getPublicUrl(path);
  return NextResponse.json({
    contentType: file.type || "application/octet-stream",
    name: file.name,
    path,
    size: file.size,
    url: data.publicUrl,
  });
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Mediendatei fehlt oder ist ungültig." }, { status: 400 });
  }

  const { data, error } = await supabase.storage.from(mediaBucket).download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Mediendatei wurde nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
