import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { hasReadablePrivateMediaReference } from "@/lib/server/privateMediaAccess";

export const runtime = "nodejs";

const mediaBucket = "homecare-private-media";

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
    public: false,
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
  const auth = await requireApiAuth(request, "media.manage");
  if (isAuthError(auth)) return auth;
  const supabase = auth.serviceClient;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Ungültige Upload-Anfrage." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei empfangen." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei ist größer als 25 MB." }, { status: 413 });
  }
  const requestedId = String(formData.get("mediaId") || "");
  if (requestedId && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/.test(requestedId)) {
    return NextResponse.json({ error: "Ungültige Medien-ID." }, { status: 400 });
  }
  const scope = safePathPart(String(formData.get("scope") || "uploads"));
  const name = safePathPart(file.name);
  if (requestedId && !(process.env.NEXT_PUBLIC_DISABLE_SUPABASE_SYNC === "1" && request.headers.get("x-workcore-e2e-bypass") === "1")) {
    const { data: existing, error: lookupError } = await supabase.from("homecare_media")
      .select("id,name,storage_path,metadata,deleted_at").eq("tenant_id", auth.tenantId).eq("id", requestedId).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Medienreferenz konnte nicht geprüft werden." }, { status: 500 });
    if (existing) {
      if (existing.deleted_at || !existing.storage_path?.startsWith(`${auth.tenantId}/${scope}/`)) {
        return NextResponse.json({ error: "Medienreferenz ist gelöscht oder gehört zu einem anderen Upload." }, { status: 409 });
      }
      return NextResponse.json({ id: existing.id, name: existing.name, path: existing.storage_path,
        contentType: existing.metadata?.contentType, size: existing.metadata?.size,
        url: `/api/private-media?path=${encodeURIComponent(existing.storage_path)}` });
    }
  }

  if (process.env.NEXT_PUBLIC_DISABLE_SUPABASE_SYNC === "1" && request.headers.get("x-workcore-e2e-bypass") === "1") {
    const id = requestedId || `MEDIA-${crypto.randomUUID()}`;
    return NextResponse.json({
      contentType: file.type || "application/octet-stream",
      name: file.name,
      path: `e2e/${id}-${name}`,
      size: file.size,
      url: "",
      id,
    });
  }

  try {
    await ensureMediaBucket(supabase);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storage-Bucket fehlt." }, { status: 500 });
  }

  const randomPart = crypto.randomUUID();
  const mediaId = requestedId || `MEDIA-${randomPart}`;
  const path = requestedId
    ? `${auth.tenantId}/${scope}/by-id/${requestedId}-${name}`
    : `${auth.tenantId}/${scope}/${new Date().toISOString().slice(0, 10)}/${randomPart}-${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(mediaBucket)
    .upload(path, buffer, {
      cacheControl: "0",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: metadataError } = await supabase.from("homecare_media").insert({
    id: mediaId,
    tenant_id: auth.tenantId,
    owner_type: "pending",
    owner_id: mediaId,
    kind: file.type.startsWith("image/") ? "image" : "attachment",
    name: file.name,
    storage_path: path,
    metadata: { contentType: file.type || "application/octet-stream", size: file.size },
    revision: 0,
  });
  if (metadataError) {
    await supabase.storage.from(mediaBucket).remove([path]);
    return NextResponse.json({ error: "Medienreferenz konnte nicht sicher gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({
    contentType: file.type || "application/octet-stream",
    name: file.name,
    path,
    size: file.size,
    url: `/api/private-media?path=${encodeURIComponent(path)}`,
    id: mediaId,
  });
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  const supabase = auth.serviceClient;

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Mediendatei fehlt oder ist ungültig." }, { status: 400 });
  }
  const { data: mediaRecords, error: referenceError } = await supabase
    .from("homecare_media")
    .select("id,owner_type,deleted_at")
    .eq("tenant_id", auth.tenantId)
    .eq("storage_path", path);
  if (referenceError || !hasReadablePrivateMediaReference(mediaRecords)) {
    return NextResponse.json({ error: "Mediendatei wurde gelöscht." }, { status: 404 });
  }
  if (!path.startsWith(`${auth.tenantId}/`)) {
    return NextResponse.json({ error: "Zugriff auf Mediendatei verweigert." }, { status: 403 });
  }

  const separator = path.lastIndexOf("/");
  const folder = separator >= 0 ? path.slice(0, separator) : "";
  const fileName = separator >= 0 ? path.slice(separator + 1) : path;
  const { data: objects, error: listError } = await supabase.storage
    .from(mediaBucket)
    .list(folder, { limit: 10, search: fileName });
  if (listError || !objects?.some((item) => item.name === fileName)) {
    return NextResponse.json({ error: "Mediendatei wurde nicht gefunden." }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from(mediaBucket).download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Mediendatei wurde nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
