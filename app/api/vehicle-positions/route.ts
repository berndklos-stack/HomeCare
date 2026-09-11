import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const vehiclePositionPrefix = "vehicle-position:";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function rowId(resourceId: string) {
  return `${vehiclePositionPrefix}${resourceId}`;
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: [], error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .like("id", `${vehiclePositionPrefix}%`);

  if (error) {
    return NextResponse.json({ data: [], error: error.message, retry: true });
  }

  return NextResponse.json(
    {
      data: (data ?? []).map((row) => ({
        ...(row.data && typeof row.data === "object" ? row.data as JsonObject : {}),
        syncedAt: row.updated_at,
      })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as JsonObject;
  const resourceId = String(body.resourceId ?? "").trim();
  if (!resourceId) {
    return NextResponse.json({ error: "Fahrzeug fehlt." }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const payload = {
    ...body,
    resourceId,
    updatedAt,
  };
  const { error } = await supabase
    .from("app_state")
    .upsert({ data: payload, id: rowId(resourceId), updated_at: updatedAt }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message, retry: true }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, data: payload, updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
