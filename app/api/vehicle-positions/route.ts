import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const vehiclePositionsRowId = "vehicle-positions";

type JsonObject = Record<string, unknown>;

type VehiclePositionsState = {
  positions?: JsonObject[];
};

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
    .eq("id", vehiclePositionsRowId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ data: [], error: error.message, retry: true });
  }

  const state = data?.data && typeof data.data === "object" ? data.data as VehiclePositionsState : {};
  const positions = Array.isArray(state.positions) ? state.positions : [];

  return NextResponse.json(
    {
      data: positions.map((position) => ({
        ...position,
        syncedAt: data?.updated_at,
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

  const { data: existingRow, error: readError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", vehiclePositionsRowId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message, retry: true }, { status: 500 });
  }

  const existingState = existingRow?.data && typeof existingRow.data === "object" ? existingRow.data as VehiclePositionsState : {};
  const existingPositions = Array.isArray(existingState.positions) ? existingState.positions : [];
  const positions = [
    payload,
    ...existingPositions.filter((position) => String(position.resourceId ?? "") !== resourceId),
  ];

  const { error } = await supabase
    .from("app_state")
    .upsert({ data: { positions }, id: vehiclePositionsRowId, updated_at: updatedAt }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message, retry: true }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, data: payload, updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
