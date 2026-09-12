import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const vehiclePositionsRowId = "vehicle-positions";

type JsonObject = Record<string, unknown>;

type VehiclePositionsState = {
  positions?: JsonObject[];
};

type VehiclePositionRow = {
  address: string | null;
  coordinates: JsonObject | null;
  driver_id: string | null;
  entry_id: string | null;
  purpose: string | null;
  resource_id: string;
  source: string | null;
  start_odometer: number | null;
  status: string;
  trip_date: string | null;
  trip_type: string | null;
  updated_at: string;
  visited: string | null;
};

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

async function loadFallbackPositions(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>): Promise<JsonObject[]> {
  const { data } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("id", vehiclePositionsRowId)
    .maybeSingle();

  const state = data?.data && typeof data.data === "object" ? data.data as VehiclePositionsState : {};
  const positions = Array.isArray(state.positions) ? state.positions : [];
  return positions.map((position) => ({
    ...position,
    syncedAt: data?.updated_at,
  }));
}

function rowToPosition(row: VehiclePositionRow) {
  return {
    address: row.address ?? "",
    coordinates: row.coordinates ?? undefined,
    driverId: row.driver_id ?? undefined,
    entryId: row.entry_id ?? "",
    purpose: row.purpose ?? undefined,
    resourceId: row.resource_id,
    source: row.source ?? "Start",
    startOdometer: row.start_odometer === null ? undefined : String(row.start_odometer),
    status: row.status,
    syncedAt: row.updated_at,
    tripDate: row.trip_date ?? "",
    tripType: row.trip_type ?? undefined,
    updatedAt: row.updated_at,
    visited: row.visited ?? undefined,
  };
}

function positionPayload(body: JsonObject, resourceId: string, updatedAt: string) {
  return {
    ...body,
    resourceId,
    updatedAt,
  };
}

async function saveFallbackPosition(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, payload: JsonObject, resourceId: string, updatedAt: string) {
  const { data: existingRow, error: readError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", vehiclePositionsRowId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const existingState = existingRow?.data && typeof existingRow.data === "object" ? existingRow.data as VehiclePositionsState : {};
  const existingPositions = Array.isArray(existingState.positions) ? existingState.positions : [];
  const positions = [
    payload,
    ...existingPositions.filter((position) => String(position.resourceId ?? "") !== resourceId),
  ];

  const { error } = await supabase
    .from("app_state")
    .upsert({ data: { positions }, id: vehiclePositionsRowId, updated_at: updatedAt }, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: [], error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const fallbackPositions = await loadFallbackPositions(supabase);
  const { data, error } = await supabase
    .from("homecare_vehicle_positions")
    .select("resource_id, entry_id, status, source, trip_date, driver_id, address, coordinates, purpose, trip_type, visited, start_odometer, updated_at");

  const relationalPositions = error ? [] : ((data ?? []) as VehiclePositionRow[]).map(rowToPosition);
  const relationalResourceIds = new Set(relationalPositions.map((position) => String(position.resourceId)));
  const positions = [
    ...relationalPositions,
    ...fallbackPositions.filter((position) => !relationalResourceIds.has(String(position.resourceId ?? ""))),
  ];

  return NextResponse.json(
    { data: positions },
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
  const payload = positionPayload(body, resourceId, updatedAt);
  const { error } = await supabase
    .from("homecare_vehicle_positions")
    .upsert({
      address: String(body.address ?? ""),
      coordinates: body.coordinates && typeof body.coordinates === "object" ? body.coordinates : null,
      driver_id: body.driverId ? String(body.driverId) : null,
      entry_id: body.entryId ? String(body.entryId) : null,
      purpose: body.purpose ? String(body.purpose) : null,
      resource_id: resourceId,
      source: body.source ? String(body.source) : null,
      start_odometer: Number.isFinite(Number(body.startOdometer)) ? Number(body.startOdometer) : null,
      status: body.status ? String(body.status) : "active",
      trip_date: body.tripDate ? String(body.tripDate) : null,
      trip_type: body.tripType ? String(body.tripType) : null,
      updated_at: updatedAt,
      visited: body.visited ? String(body.visited) : null,
    }, { onConflict: "resource_id" });

  if (error) {
    try {
      await saveFallbackPosition(supabase, payload, resourceId, updatedAt);
    } catch (fallbackError) {
      return NextResponse.json(
        { error: fallbackError instanceof Error ? fallbackError.message : error.message, retry: true },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { ok: true, data: payload, updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
