import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Mediendatei fehlt oder ist ungültig." }, { status: 400 });
  }

  const { data, error } = await supabase.storage.from(privateMediaBucket).download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Mediendatei wurde nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": data.type || "application/octet-stream",
    },
  });
}
