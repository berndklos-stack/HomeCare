import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const privateMediaBucket = "homecare-private-media";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
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
  const { data: mediaRecord } = await supabase
    .from("homecare_media")
    .select("id,deleted_at")
    .eq("tenant_id", auth.tenantId)
    .eq("storage_path", path)
    .maybeSingle();
  if (mediaRecord?.deleted_at) {
    return NextResponse.json({ error: "Mediendatei wurde gelöscht." }, { status: 404 });
  }
  if (!path.startsWith(`${auth.tenantId}/`) && !mediaRecord) {
    return NextResponse.json({ error: "Zugriff auf Mediendatei verweigert." }, { status: 403 });
  }

  const separator = path.lastIndexOf("/");
  const folder = separator >= 0 ? path.slice(0, separator) : "";
  const fileName = separator >= 0 ? path.slice(separator + 1) : path;
  const { data: objects, error: listError } = await supabase.storage
    .from(privateMediaBucket)
    .list(folder, { limit: 10, search: fileName });
  if (listError || !objects?.some((item) => item.name === fileName)) {
    return NextResponse.json({ error: "Mediendatei wurde nicht gefunden." }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from(privateMediaBucket).download(path);
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
