import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type VehiclePositionRow = {
  address: string | null;
  coordinates: JsonObject | null;
  deleted_at: string | null;
  driver_id: string | null;
  entry_id: string | null;
  purpose: string | null;
  resource_id: string;
  revision: number;
  source: string | null;
  start_odometer: number | null;
  status: string;
  trip_date: string | null;
  trip_type: string | null;
  updated_at: string;
  visited: string | null;
};

function rowToPosition(row: VehiclePositionRow) {
  return {
    address: row.address ?? "",
    coordinates: row.coordinates ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    driverId: row.driver_id ?? undefined,
    entryId: row.entry_id ?? "",
    purpose: row.purpose ?? undefined,
    resourceId: row.resource_id,
    revision: row.revision,
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

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;

  const { data, error } = await auth.client
    .from("homecare_vehicle_positions")
    .select("resource_id, entry_id, status, source, trip_date, driver_id, address, coordinates, purpose, trip_type, visited, start_odometer, revision, deleted_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Fahrzeugpositionen konnten nicht relational geladen werden.", retry: true },
      { status: 503 },
    );
  }

  const positions: JsonObject[] = ((data ?? []) as VehiclePositionRow[]).map(rowToPosition);

  return NextResponse.json(
    { data: positions, legacyFallback: false },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "X-WorkCore-Legacy-Fallback": "none",
      },
    },
  );
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "resources.manage");
  if (isAuthError(auth)) return auth;
  return NextResponse.json(
    { error: "Fahrzeugpositionen werden nur noch als datensatzweise Sync-Mutation gespeichert." },
    { status: 410 },
  );
}
