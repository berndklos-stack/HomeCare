import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const appBackupPrefix = "app-backup:";
const appBackupChunkPrefix = "app-backup-chunk:";
const appBackupBucket = "homecare-backups";
const cacheTtlMs = 30000;
const backupIntervalMs = 30 * 60 * 1000;
const backupChunkSizeChars = 384 * 1024;

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

function compactLargeEmbeddedMedia(value: unknown): unknown {
  if (typeof value === "string") {
    return value.startsWith("data:") && value.length > 12000 ? undefined : value;
  }

  if (Array.isArray(value)) {
    return value.map(compactLargeEmbeddedMedia).filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .map(([key, item]) => [key, compactLargeEmbeddedMedia(item)] as const)
      .filter(([, item]) => item !== undefined),
  );
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

function safePathPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "backup";
}

function hasBackupableData(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const data = snapshot as JsonObject;
  return ["customers", "objects", "jobs", "reports"].some((key) => Array.isArray(data[key]) && (data[key] as unknown[]).length > 0);
}

function snapshotCounts(snapshot: unknown) {
  const data = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as JsonObject : {};
  const fieldProgress = data.fieldProgress && typeof data.fieldProgress === "object" && !Array.isArray(data.fieldProgress)
    ? data.fieldProgress as JsonObject
    : {};

  return {
    customers: Array.isArray(data.customers) ? data.customers.length : 0,
    fieldProgress: Object.keys(fieldProgress).length,
    jobs: Array.isArray(data.jobs) ? data.jobs.length : 0,
    objects: Array.isArray(data.objects) ? data.objects.length : 0,
    reports: Array.isArray(data.reports) ? data.reports.length : 0,
  };
}

function snapshotContentHash(serialized: string) {
  return createHash("sha256").update(serialized).digest("hex");
}

async function ensureBackupBucket(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: bucket, error: getError } = await supabase.storage.getBucket(appBackupBucket);
  if (bucket) return;

  const { error: createError } = await supabase.storage.createBucket(appBackupBucket, {
    fileSizeLimit: 60 * 1024 * 1024,
    public: false,
  });
  if (createError) {
    throw new Error(createError.message || getError?.message || "Backup-Bucket konnte nicht angelegt werden.");
  }
}

async function hasRecentBackup(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, contentHash: string) {
  const { data } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .like("id", `${appBackupPrefix}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (!data?.length) return false;
  if (data.some((row) => {
    const backupData = row.data && typeof row.data === "object" ? row.data as JsonObject : {};
    return backupData.contentHash === contentHash;
  })) return true;

  const latest = data[0];
  const latestTime = Date.parse(String(latest.updated_at ?? ""));
  return Number.isFinite(latestTime) && Date.now() - latestTime <= backupIntervalMs;
}

async function createAppStateBackup(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, reason: string) {
  const { data: current, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("id", appStateRowId)
    .maybeSingle();

  if (error || !current?.data) return;

  const snapshot = normalizeSnapshot(current.data);
  if (!hasBackupableData(snapshot)) return;
  const serialized = JSON.stringify(snapshot);
  const contentHash = snapshotContentHash(serialized);
  if (await hasRecentBackup(supabase, contentHash)) return;

  const createdAt = new Date().toISOString();
  const backupId = `${appBackupPrefix}${createdAt}`;
  const compressed = gzipSync(Buffer.from(serialized));
  const chunks: string[] = [];
  const compressedBase64 = compressed.toString("base64");
  for (let offset = 0; offset < compressedBase64.length; offset += backupChunkSizeChars) {
    const chunkIndex = chunks.length + 1;
    const chunkId = `${appBackupChunkPrefix}${createdAt}:${String(chunkIndex).padStart(3, "0")}`;
    chunks.push(chunkId);
  }
  const chunkRows = chunks.map((chunkId, index) => ({
    data: {
      backupId,
      content: compressedBase64.slice(index * backupChunkSizeChars, (index + 1) * backupChunkSizeChars),
      index,
      total: chunks.length,
    },
    id: chunkId,
    updated_at: createdAt,
  }));
  const { error: chunkError } = await supabase
    .from("app_state")
    .upsert(chunkRows, { onConflict: "id" });

  if (chunkError) throw new Error(chunkError.message);

  const { error: indexError } = await supabase
    .from("app_state")
    .upsert({
      data: {
        counts: snapshotCounts(snapshot),
        createdAt,
        compressed: true,
        id: backupId,
        reason,
        contentHash,
        compressedSizeBytes: compressed.byteLength,
        sizeBytes: Buffer.byteLength(serialized),
        sourceUpdatedAt: current.updated_at,
        storageBucket: "app_state",
        storagePath: chunks[0],
        storagePaths: chunks,
      },
      id: backupId,
      updated_at: createdAt,
    }, { onConflict: "id" });

  if (indexError) throw new Error(indexError.message);
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
    && (
      !Number.isFinite(patchStatusTime)
      || (
        Number.isFinite(existingStatusTime)
        && patchStatusTime <= existingStatusTime
      )
    )
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
        const deletedLogbookEntryIds = Array.from(new Set([
          ...(Array.isArray(existing.deletedLogbookEntryIds) ? existing.deletedLogbookEntryIds.map(String) : []),
          ...(Array.isArray(patch.deletedLogbookEntryIds) ? patch.deletedLogbookEntryIds.map(String) : []),
        ]));
        merged.deletedLogbookEntryIds = deletedLogbookEntryIds;
        const mergedLogbook = mergeVehicleLogbook(existing.logbook, patch.logbook) as JsonObject[];
        merged.logbook = mergedLogbook
          .filter((entry: JsonObject) => entry && typeof entry === "object" && !deletedLogbookEntryIds.includes(String(entry.id)));
      }
      recordsById.set(id, merged);
    }
  });

  return Array.from(recordsById.values());
}

function normalizeReportDate(value: unknown) {
  const text = String(value ?? "").trim();
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoDate) return text;
  const germanDate = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (germanDate) {
    const [, day, month, year] = germanDate;
    return `${year}-${month}-${day}`;
  }
  return text;
}

function reportDedupeKey(record: JsonObject) {
  const id = String(record.id ?? "");
  const reportType = id.startsWith("WEEK-") ? "week" : "day";
  return [reportType, String(record.jobId ?? ""), normalizeReportDate(record.date)].join("|");
}

function reportChangedTime(record: JsonObject) {
  return Date.parse(String(record.updatedAt ?? record.sentAt ?? ""));
}

function chooseReportText(primaryText: unknown, fallbackText: unknown, primaryTime: number, fallbackTime: number) {
  const primary = String(primaryText ?? "");
  const fallback = String(fallbackText ?? "");
  const primaryClean = primary.trim();
  const fallbackClean = fallback.trim();
  if (!primaryClean && fallbackClean) return fallback;
  if (primaryClean && !fallbackClean) return primary;
  if (primaryClean.length < fallbackClean.length && fallbackClean.includes(primaryClean)) return fallback;
  if (fallbackClean.length < primaryClean.length && primaryClean.includes(fallbackClean)) return primary;
  if (Number.isFinite(primaryTime) && Number.isFinite(fallbackTime) && primaryTime !== fallbackTime) {
    return primaryTime > fallbackTime ? primary : fallback;
  }
  return primary.length >= fallback.length ? primary : fallback;
}

function reportCompletenessScore(record: JsonObject) {
  const checklist = Array.isArray(record.checklistResults) ? record.checklistResults as JsonObject[] : [];
  const photoCount = checklist.reduce((sum, item) => sum + (Array.isArray(item.photos) ? item.photos.length : 0), 0);
  const noteCount = checklist.filter((item) => String(item.note ?? "").trim()).length;
  return [
    record.sentAt ? 100 : 0,
    String(record.customerComment ?? "").trim() ? 20 : 0,
    checklist.length * 4,
    photoCount * 3,
    Array.isArray(record.attachments) ? record.attachments.length * 3 : 0,
    noteCount * 2,
    String(record.summary ?? "").trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergeReportChecklist(existingItem: JsonObject | undefined, patchItem: JsonObject) {
  if (!existingItem) return patchItem;
  const existingTime = Date.parse(String(existingItem.updatedAt ?? ""));
  const patchTime = Date.parse(String(patchItem.updatedAt ?? ""));
  const patchIsNewer = Number.isFinite(patchTime)
    ? !Number.isFinite(existingTime) || patchTime >= existingTime
    : true;
  const newest = patchIsNewer ? patchItem : existingItem;
  const fallback = patchIsNewer ? existingItem : patchItem;

  return {
    ...fallback,
    ...newest,
    completed: Boolean(newest.completed) || Boolean(fallback.completed),
    minutes: newest.minutes || fallback.minutes || 0,
    note: chooseReportText(newest.note, fallback.note, Date.parse(String(newest.updatedAt ?? "")), Date.parse(String(fallback.updatedAt ?? ""))),
    photos: mergeFieldPhotos(fallback.photos, newest.photos),
  };
}

function mergeReportPair(first: JsonObject, second: JsonObject) {
  const primary = reportCompletenessScore(second) >= reportCompletenessScore(first) ? second : first;
  const fallback = primary === first ? second : first;
  const primaryTime = reportChangedTime(primary);
  const fallbackTime = reportChangedTime(fallback);
  const checklistById = new Map<string, JsonObject>();

  (Array.isArray(fallback.checklistResults) ? fallback.checklistResults as JsonObject[] : []).forEach((item) => {
    checklistById.set(String(item.id ?? item.title ?? checklistById.size), item);
  });
  (Array.isArray(primary.checklistResults) ? primary.checklistResults as JsonObject[] : []).forEach((item) => {
    const id = String(item.id ?? item.title ?? checklistById.size);
    checklistById.set(id, mergeReportChecklist(checklistById.get(id), item));
  });

  return {
    ...fallback,
    ...primary,
    attachments: mergeRecordsById(fallback.attachments, primary.attachments),
    checklistResults: Array.from(checklistById.values()),
    customerComment: chooseReportText(primary.customerComment, fallback.customerComment, primaryTime, fallbackTime),
    date: normalizeReportDate(primary.date),
    media: Array.from(new Set([
      ...(Array.isArray(fallback.media) ? fallback.media : []),
      ...(Array.isArray(primary.media) ? primary.media : []),
    ])),
    summary: chooseReportText(primary.summary, fallback.summary, primaryTime, fallbackTime),
    sentAt: primary.sentAt ?? fallback.sentAt,
    updatedAt: Number.isFinite(primaryTime) && Number.isFinite(fallbackTime)
      ? (primaryTime >= fallbackTime ? primary.updatedAt ?? primary.sentAt : fallback.updatedAt ?? fallback.sentAt)
      : primary.updatedAt ?? fallback.updatedAt,
  };
}

function mergeReports(existingRecords: unknown, patchRecords: unknown) {
  const reportsByKey = new Map<string, JsonObject>();
  [
    ...(Array.isArray(existingRecords) ? existingRecords : []),
    ...(Array.isArray(patchRecords) ? patchRecords : []),
  ].forEach((record) => {
    if (!record || typeof record !== "object") return;
    const report = record as JsonObject;
    const key = reportDedupeKey(report);
    const existing = reportsByKey.get(key);
    reportsByKey.set(key, existing ? mergeReportPair(existing, report) : { ...report, date: normalizeReportDate(report.date) });
  });

  return Array.from(reportsByKey.values());
}

function mergeOdometerPhotos(existingPhotos: unknown, patchPhotos: unknown) {
  const photosById = new Map<string, JsonObject>();
  [
    ...(Array.isArray(existingPhotos) ? existingPhotos : []),
    ...(Array.isArray(patchPhotos) ? patchPhotos : []),
  ].forEach((photo) => {
    if (!photo || typeof photo !== "object" || !("id" in photo)) return;
    const item = photo as JsonObject;
    const id = String(item.id);
    photosById.set(id, { ...(photosById.get(id) ?? {}), ...item });
  });

  return Array.from(photosById.values()).sort((first, second) => String(first.capturedAt ?? "").localeCompare(String(second.capturedAt ?? "")));
}

function mergeVehicleLogbook(existingLogbook: unknown, patchLogbook: unknown) {
  const existingEntries = Array.isArray(existingLogbook) ? existingLogbook : [];
  const patchEntries = Array.isArray(patchLogbook) ? patchLogbook : [];
  const existingById = new Map(existingEntries
    .filter((entry) => entry && typeof entry === "object" && "id" in entry)
    .map((entry) => [String((entry as JsonObject).id), entry as JsonObject]));

  return (mergeRecordsById(existingEntries, patchEntries) as JsonObject[]).map((entry) => ({
    ...entry,
    odometerPhotos: mergeOdometerPhotos(existingById.get(String(entry.id))?.odometerPhotos, entry.odometerPhotos),
  }));
}

function mergeObjectsByKey(existingValue: unknown, patchValue: unknown) {
  const existing = existingValue && typeof existingValue === "object" && !Array.isArray(existingValue) ? existingValue as JsonObject : {};
  const patch = patchValue && typeof patchValue === "object" && !Array.isArray(patchValue) ? patchValue as JsonObject : {};
  return { ...existing, ...patch };
}

function mergeFieldPhotos(existingPhotos: unknown, patchPhotos: unknown) {
  const photosByKey = new Map<string, JsonObject>();
  const photoScore = (photo: JsonObject) => [
    photo.previewUrl || photo.storagePath ? 20 : 0,
    String(photo.previewUrl ?? "").startsWith("data:") ? 8 : 0,
    photo.storagePath ? 6 : 0,
    String(photo.note ?? "").trim() ? 3 : 0,
    photo.createdAt ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  [
    ...(Array.isArray(existingPhotos) ? existingPhotos : []),
    ...(Array.isArray(patchPhotos) ? patchPhotos : []),
  ].forEach((photo) => {
    if (!photo || typeof photo !== "object") return false;
    const item = photo as JsonObject;
    const key = item.id ? `id:${String(item.id)}` : `${String(item.name ?? "")}|${String(item.previewUrl ?? "")}`;
    const existing = photosByKey.get(key);
    if (!existing) {
      photosByKey.set(key, item);
      return true;
    }
    const betterSource = photoScore(item) > photoScore(existing) ? item : existing;
    const fallback = betterSource === item ? existing : item;
    photosByKey.set(key, {
      ...fallback,
      ...betterSource,
      previewUrl: String(betterSource.previewUrl ?? "") || fallback.previewUrl,
      storagePath: String(betterSource.storagePath ?? "") || fallback.storagePath,
      note: String(betterSource.note ?? "") || fallback.note,
      createdAt: betterSource.createdAt ?? fallback.createdAt,
    });
    return true;
  });

  return Array.from(photosByKey.values()).sort((first, second) => String(first.createdAt ?? "").localeCompare(String(second.createdAt ?? "")));
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
      if (key === "reports") {
        merged[key] = mergeReports(existing[key], value);
        return;
      }
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

  try {
    await createAppStateBackup(supabase, "before-app-state-save");
  } catch (error) {
    console.warn("App-State-Backup konnte nicht erstellt werden.", error);
  }

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

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: null, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }
  const compact = new URL(request.url).searchParams.get("compact") === "1";

  if (cachedAppState && Date.now() - cachedAppState.cachedAt < cacheTtlMs) {
    return NextResponse.json(
      { data: compact ? compactLargeEmbeddedMedia(cachedAppState.data) : cachedAppState.data, cached: true, updatedAt: cachedAppState.updatedAt },
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
    { data: compact ? compactLargeEmbeddedMedia(snapshot) : snapshot, updatedAt: data?.updated_at ?? null },
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
