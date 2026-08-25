import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const cacheTtlMs = 30000;

type JsonObject = Record<string, unknown>;
type CachedAppState = {
  data: unknown;
  updatedAt: string | null;
  cachedAt: number;
};

let cachedAppState: CachedAppState | null = null;

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

function normalizeSnapshot(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Object.keys(payload as JsonObject).length === 1
  ) {
    return (payload as { data: unknown }).data;
  }

  return payload;
}

function retryableSupabaseResponse(error: { message: string }) {
  return NextResponse.json(
    { data: cachedAppState?.data ?? null, error: `Supabase aktuell überlastet: ${error.message}`, retry: true, stale: Boolean(cachedAppState), updatedAt: cachedAppState?.updatedAt ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeRecordsById(existingRecords: unknown, patchRecords: unknown) {
  if (!Array.isArray(existingRecords) || !Array.isArray(patchRecords)) return patchRecords;
  const recordsById = new Map<string, JsonObject>();

  existingRecords.forEach((record) => {
    if (record && typeof record === "object" && "id" in record) {
      recordsById.set(String((record as JsonObject).id), record as JsonObject);
    }
  });
  patchRecords.forEach((record) => {
    if (record && typeof record === "object" && "id" in record) {
      const id = String((record as JsonObject).id);
      recordsById.set(id, { ...(recordsById.get(id) ?? {}), ...(record as JsonObject) });
    }
  });

  return Array.from(recordsById.values());
}

function mergeSnapshotPatch(existingSnapshot: unknown, patch: unknown) {
  const existing = existingSnapshot && typeof existingSnapshot === "object" ? existingSnapshot as JsonObject : {};
  const patchObject = patch && typeof patch === "object" ? patch as JsonObject : {};
  const merged: JsonObject = { ...existing };

  Object.entries(patchObject).forEach(([key, value]) => {
    merged[key] = Array.isArray(value) ? mergeRecordsById(existing[key], value) : value;
  });

  return merged;
}

async function saveSnapshotToSupabase(snapshot: unknown) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const updatedAt = new Date().toISOString();
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from("app_state")
      .upsert({
        data: snapshot,
        id: appStateRowId,
        updated_at: updatedAt,
      }, { onConflict: "id" });

    if (!error) {
      cachedAppState = {
        cachedAt: Date.now(),
        data: snapshot,
        updatedAt,
      };

      return NextResponse.json(
        { ok: true, updatedAt },
        { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
      );
    }

    lastError = error;
    await wait(250 * (attempt + 1));
  }

  return NextResponse.json(
    { error: `Supabase aktuell überlastet: ${lastError?.message ?? "Speichern später erneut versuchen."}`, retry: true },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: null, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  if (cachedAppState && Date.now() - cachedAppState.cachedAt < cacheTtlMs) {
    return NextResponse.json(
      { data: cachedAppState.data, cached: true, updatedAt: cachedAppState.updatedAt },
      { headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=20" } },
    );
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("id", appStateRowId)
    .maybeSingle();

  if (error) {
    return retryableSupabaseResponse(error);
  }

  const snapshot = data?.data ? normalizeSnapshot(data.data) : null;
  cachedAppState = {
    cachedAt: Date.now(),
    data: snapshot,
    updatedAt: data?.updated_at ?? null,
  };

  return NextResponse.json(
    { data: snapshot, updatedAt: data?.updated_at ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

async function saveAppState(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const body = await request.json();
  if (body && typeof body === "object" && "__patch" in body) {
    const { data, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("id", appStateRowId)
      .maybeSingle();

    if (error) {
      return retryableSupabaseResponse(error);
    }

    return saveSnapshotToSupabase(mergeSnapshotPatch(normalizeSnapshot(data?.data ?? null), (body as { patch?: unknown }).patch));
  }

  return saveSnapshotToSupabase(normalizeSnapshot(body));
}

export async function PUT(request: Request) {
  return saveAppState(request);
}

export async function POST(request: Request) {
  return saveAppState(request);
}
