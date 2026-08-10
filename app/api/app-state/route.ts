import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: null, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("id", appStateRowId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { data: data?.data ?? null, updatedAt: data?.updated_at ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

export async function PUT(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const snapshot = await request.json();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("app_state")
    .upsert({
      data: snapshot,
      id: appStateRowId,
      updated_at: updatedAt,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
