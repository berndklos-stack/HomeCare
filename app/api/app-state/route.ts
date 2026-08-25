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

function mergeJobStatus(existing: JsonObject, patch: JsonObject) {
  const existingStatus = existing.status;
  const patchStatus = patch.status;
  const existingStatusTime = Date.parse(String(existing.statusUpdatedAt ?? ""));
  const patchStatusTime = Date.parse(String(patch.statusUpdatedAt ?? ""));

  if (
    Number.isFinite(existingStatusTime)
    && (
      !Number.isFinite(patchStatusTime)
      || patchStatusTime < existingStatusTime
    )
    && patchStatus !== existingStatus
  ) {
    return existingStatus;
  }

  if (
    existingStatus === "geplant"
    && typeof existing.resetAt === "string"
    && patch.resetAt !== existing.resetAt
    && ["erledigt", "abgerechnet"].includes(String(patchStatus))
  ) {
    return existingStatus;
  }

  if (
    ["erledigt", "abgerechnet"].includes(String(existingStatus)) &&
    !["erledigt", "abgerechnet"].includes(String(patchStatus))
  ) {
    return existingStatus;
  }

  return patchStatus;
}

function statusOverrideRequested(record: JsonObject) {
  return record.__forceStatus === true;
}

function mergeRecordsById(existingRecords: unknown, patchRecords: unknown, key?: string) {
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
      const existing = recordsById.get(id) ?? {};
      const patch = record as JsonObject;
      const { __forceStatus: _forceStatus, ...cleanPatch } = patch;
      const merged = { ...existing, ...cleanPatch };
      if (key === "jobs" && !statusOverrideRequested(patch) && "status" in existing && "status" in patch) {
        const mergedStatus = mergeJobStatus(existing, patch);
        merged.status = mergedStatus;
        if (mergedStatus === existing.status) {
          merged.statusUpdatedAt = existing.statusUpdatedAt;
        }
      }
      if (key === "resources" && (Array.isArray(existing.logbook) || Array.isArray(patch.logbook))) {
        merged.logbook = mergeRecordsById(existing.logbook, patch.logbook);
      }
      recordsById.set(id, merged);
    }
  });

  return Array.from(recordsById.values());
}

function mergeObjectsByKey(existingValue: unknown, patchValue: unknown) {
  const existing = existingValue && typeof existingValue === "object" && !Array.isArray(existingValue) ? existingValue as JsonObject : {};
  const patch = patchValue && typeof patchValue === "object" && !Array.isArray(patchValue) ? patchValue as JsonObject : {};
  return { ...existing, ...patch };
}

function mergeFieldPhotos(existingPhotos: unknown, patchPhotos: unknown) {
  const photoKeys = new Set<string>();
  return [
    ...(Array.isArray(existingPhotos) ? existingPhotos : []),
    ...(Array.isArray(patchPhotos) ? patchPhotos : []),
  ].filter((photo) => {
    if (!photo || typeof photo !== "object") return false;
    const item = photo as JsonObject;
    const key = `${String(item.name ?? "")}|${String(item.previewUrl ?? "")}`;
    if (photoKeys.has(key)) return false;
    photoKeys.add(key);
    return true;
  });
}

function mergeFieldTaskProgress(existingTask: unknown, patchTask: unknown) {
  const existing = existingTask && typeof existingTask === "object" && !Array.isArray(existingTask) ? existingTask as JsonObject : {};
  const patch = patchTask && typeof patchTask === "object" && !Array.isArray(patchTask) ? patchTask as JsonObject : {};
  const existingTime = Date.parse(String(existing.updatedAt ?? ""));
  const patchTime = Date.parse(String(patch.updatedAt ?? ""));
  const patchIsNewer = Number.isFinite(patchTime)
    ? !Number.isFinite(existingTime) || patchTime >= existingTime
    : true;
  const newest = patchIsNewer ? patch : existing;
  const fallback = patchIsNewer ? existing : patch;

  return {
    ...fallback,
    ...newest,
    completed: Boolean(newest.completed) || Boolean(fallback.completed),
    minutes: String(newest.minutes ?? fallback.minutes ?? ""),
    note: String(newest.note ?? fallback.note ?? ""),
    photos: mergeFieldPhotos(existing.photos, patch.photos),
  };
}

function mergeFieldProgress(existingValue: unknown, patchValue: unknown) {
  const existing = existingValue && typeof existingValue === "object" && !Array.isArray(existingValue) ? existingValue as JsonObject : {};
  const patch = patchValue && typeof patchValue === "object" && !Array.isArray(patchValue) ? patchValue as JsonObject : {};
  const merged: JsonObject = { ...existing };

  Object.entries(patch).forEach(([jobId, patchTasks]) => {
    const existingTasks = existing[jobId] && typeof existing[jobId] === "object" && !Array.isArray(existing[jobId])
      ? existing[jobId] as JsonObject
      : {};
    const patchTaskMap = patchTasks && typeof patchTasks === "object" && !Array.isArray(patchTasks)
      ? patchTasks as JsonObject
      : {};
    const taskIds = new Set([...Object.keys(existingTasks), ...Object.keys(patchTaskMap)]);
    merged[jobId] = Object.fromEntries(Array.from(taskIds).map((taskId) => [
      taskId,
      mergeFieldTaskProgress(existingTasks[taskId], patchTaskMap[taskId]),
    ]));
  });

  return merged;
}

function mergeSnapshotPatch(existingSnapshot: unknown, patch: unknown) {
  const existing = existingSnapshot && typeof existingSnapshot === "object" ? existingSnapshot as JsonObject : {};
  const patchObject = patch && typeof patch === "object" ? patch as JsonObject : {};
  const merged: JsonObject = { ...existing };

  Object.entries(patchObject).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      merged[key] = mergeRecordsById(existing[key], value, key);
      return;
    }
    if (key === "fieldProgress") {
      merged[key] = mergeFieldProgress(existing[key], value);
      return;
    }
    if (key === "fieldNotes") {
      merged[key] = mergeObjectsByKey(existing[key], value);
      return;
    }
    merged[key] = value;
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
