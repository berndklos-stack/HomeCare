import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedSyncSections = [
  "activeJobId",
  "fieldNotes",
  "fieldProgress",
  "inventoryLocations",
  "materials",
  "resources",
] as const;

type SyncSectionKey = typeof allowedSyncSections[number];
type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function rowId(key: SyncSectionKey) {
  return `sync-section:${key}`;
}

function isSyncSectionKey(value: string): value is SyncSectionKey {
  return (allowedSyncSections as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: {}, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const requestedKeys = new URL(request.url).searchParams.get("keys")?.split(",")
    .map((key) => key.trim())
    .filter(isSyncSectionKey);
  const keys = requestedKeys?.length ? requestedKeys : [...allowedSyncSections];

  const { data, error } = await supabase
    .from("app_state")
    .select("id, data, updated_at")
    .in("id", keys.map(rowId));

  if (error) {
    return NextResponse.json({ data: {}, error: error.message, retry: true });
  }

  const sections = Object.fromEntries((data ?? []).map((row) => {
    const rowData = row.data && typeof row.data === "object" ? row.data as JsonObject : {};
    const key = String(rowData.key ?? row.id.replace(/^sync-section:/, ""));
    return [key, {
      updatedAt: row.updated_at,
      value: rowData.value,
    }];
  }));

  return NextResponse.json(
    { data: sections },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as JsonObject;
  const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
    ? body.patch as JsonObject
    : {};
  const rows = Object.entries(patch)
    .filter(([key]) => isSyncSectionKey(key))
    .map(([key, value]) => {
      const updatedAt = new Date().toISOString();
      return {
        data: { key, updatedAt, value },
        id: rowId(key as SyncSectionKey),
        updated_at: updatedAt,
      };
    });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  }

  const { error } = await supabase
    .from("app_state")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message, retry: true }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, updatedAt: rows[0].updated_at },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
