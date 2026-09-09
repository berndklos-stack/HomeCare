import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";

export const runtime = "nodejs";

const appStateRowId = "kolaretorp-service-app";
const appBackupPrefix = "app-backup:";

type JsonObject = Record<string, unknown>;

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function photoSource(photo: JsonObject) {
  return String(photo.storagePath || photo.previewUrl || "");
}

function photoHasSource(photo: JsonObject) {
  return Boolean(photoSource(photo));
}

function reportMatches(report: JsonObject, query: string, date: string) {
  const haystack = normalizeText([report.title, report.summary, report.date].join(" "));
  const queryMatches = !query || haystack.includes(normalizeText(query));
  const dateMatches = !date || String(report.date ?? "") === date;
  return queryMatches && dateMatches;
}

function reportPhotos(report: JsonObject) {
  const tasks = Array.isArray(report.checklistResults) ? report.checklistResults : [];
  return tasks.flatMap((task, taskIndex) => {
    const taskRecord = task && typeof task === "object" ? task as JsonObject : {};
    const photos = Array.isArray(taskRecord.photos) ? taskRecord.photos : [];
    return photos.map((photo, photoIndex) => ({
      photo: photo && typeof photo === "object" ? photo as JsonObject : {},
      task: taskRecord,
      taskIndex,
      photoIndex,
    }));
  });
}

async function readBackupSnapshot(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, backup: JsonObject) {
  const paths = Array.isArray(backup.storagePaths)
    ? backup.storagePaths.map(String)
    : [String(backup.storagePath ?? "")].filter(Boolean);
  if (paths.length === 0) return null;

  let base64 = "";
  for (const path of paths) {
    const { data, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("id", path)
      .maybeSingle();
    if (error || !data?.data || typeof data.data !== "object") return null;
    base64 += String((data.data as JsonObject).content ?? "");
  }

  try {
    return JSON.parse(gunzipSync(Buffer.from(base64, "base64")).toString("utf8")) as JsonObject;
  } catch {
    return null;
  }
}

async function recentBackups(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .like("id", `${appBackupPrefix}%`)
    .order("updated_at", { ascending: false })
    .limit(14);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.data && typeof row.data === "object" ? row.data as JsonObject : {})
    .filter((backup) => String(backup.id ?? "").startsWith(appBackupPrefix));
}

function photoMatchKey(report: JsonObject, task: JsonObject, photo: JsonObject) {
  return [
    report.id,
    report.jobId,
    report.date,
    task.id,
    task.title,
    photo.id,
    photo.name,
  ].map((value) => normalizeText(value).trim()).join("|");
}

function loosePhotoKey(report: JsonObject, task: JsonObject, photo: JsonObject) {
  return [
    report.jobId,
    report.date,
    task.title,
    photo.name,
  ].map((value) => normalizeText(value).trim()).join("|");
}

function indexedPhotoKey(report: JsonObject, task: JsonObject, taskIndex: number, photoIndex: number) {
  return [
    report.id,
    report.jobId,
    report.date,
    task.id,
    task.title,
    taskIndex,
    photoIndex,
  ].map((value) => normalizeText(value).trim()).join("|");
}

function reportIdentityKey(report: JsonObject) {
  return [
    report.id,
    report.jobId,
    report.date,
    report.title,
  ].map((value) => normalizeText(value).trim()).join("|");
}

function taskIdentityKey(task: JsonObject, taskIndex: number) {
  return [
    task.id,
    task.title,
    taskIndex,
  ].map((value) => normalizeText(value).trim()).join("|");
}

function samePhoto(left: JsonObject, right: JsonObject) {
  const leftSource = photoSource(left);
  const rightSource = photoSource(right);
  if (leftSource && rightSource && leftSource === rightSource) return true;
  const leftId = String(left.id ?? "");
  const rightId = String(right.id ?? "");
  if (leftId && rightId && leftId === rightId) return true;
  return String(left.name ?? "") === String(right.name ?? "")
    && String(left.createdAt ?? "") === String(right.createdAt ?? "");
}

async function backupPhotoSources(query: string, date: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase-Zugangsdaten fehlen.");

  const backups = await recentBackups(supabase);
  const sources = new Map<string, JsonObject>();
  const looseSources = new Map<string, JsonObject>();
  const indexedSources = new Map<string, JsonObject>();
  const backupReports = new Map<string, JsonObject>();
  const inspected: Array<{ backupId: string; sourcedPhotos: number }> = [];

  for (const backup of backups) {
    const snapshot = await readBackupSnapshot(supabase, backup);
    const reports = Array.isArray(snapshot?.reports) ? snapshot.reports : [];
    let sourcedPhotos = 0;
    reports
      .filter((report) => report && typeof report === "object" && reportMatches(report as JsonObject, query, date))
      .forEach((report) => {
        const reportRecord = report as JsonObject;
        let reportHasSources = false;
        reportPhotos(reportRecord).forEach(({ task, photo, taskIndex, photoIndex }) => {
          if (!photoHasSource(photo)) return;
          sourcedPhotos += 1;
          reportHasSources = true;
          sources.set(photoMatchKey(reportRecord, task, photo), photo);
          looseSources.set(loosePhotoKey(reportRecord, task, photo), photo);
          indexedSources.set(indexedPhotoKey(reportRecord, task, taskIndex, photoIndex), photo);
        });
        if (reportHasSources) backupReports.set(reportIdentityKey(reportRecord), reportRecord);
      });
    inspected.push({ backupId: String(backup.id ?? ""), sourcedPhotos });
    if (sourcedPhotos > 0) break;
  }

  return { backupReports, indexedSources, inspected, looseSources, sources, supabase };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "gunnabo";
    const date = searchParams.get("date") ?? "2026-09-08";
    const { inspected, sources } = await backupPhotoSources(query, date);
    return NextResponse.json({
      inspected,
      sourcedPhotos: sources.size,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Fotos konnten nicht gesucht werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.q ?? "gunnabo");
    const date = String(body?.date ?? "2026-09-08");
    const { backupReports, indexedSources, inspected, looseSources, sources, supabase } = await backupPhotoSources(query, date);
    const { data: currentRow, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("id", appStateRowId)
      .maybeSingle();
    if (error || !currentRow?.data || typeof currentRow.data !== "object") {
      throw new Error(error?.message || "Aktueller App-Stand wurde nicht gefunden.");
    }

    const current = currentRow.data as JsonObject;
    const reports = Array.isArray(current.reports) ? current.reports : [];
    let recovered = 0;
    let inserted = 0;
    const updatedReports = reports.map((report) => {
      if (!report || typeof report !== "object" || !reportMatches(report as JsonObject, query, date)) return report;
      const reportRecord = report as JsonObject;
      const backupReport = backupReports.get(reportIdentityKey(reportRecord));
      const backupTasks = Array.isArray(backupReport?.checklistResults) ? backupReport.checklistResults : [];
      return {
        ...reportRecord,
        checklistResults: (Array.isArray(reportRecord.checklistResults) ? reportRecord.checklistResults : []).map((task, taskIndex) => {
          if (!task || typeof task !== "object") return task;
          const taskRecord = task as JsonObject;
          const backupTask = backupTasks
            .map((candidate, candidateIndex) => ({ candidate: candidate && typeof candidate === "object" ? candidate as JsonObject : {}, candidateIndex }))
            .find(({ candidate, candidateIndex }) => taskIdentityKey(candidate, candidateIndex) === taskIdentityKey(taskRecord, taskIndex))
            ?.candidate;
          const backupTaskPhotos = Array.isArray(backupTask?.photos) ? backupTask.photos : [];
          const currentPhotos = (Array.isArray(taskRecord.photos) ? taskRecord.photos : []).map((photo, photoIndex) => {
            if (!photo || typeof photo !== "object") return photo;
            const photoRecord = photo as JsonObject;
            if (photoHasSource(photoRecord)) return photoRecord;
            const source = sources.get(photoMatchKey(reportRecord, taskRecord, photoRecord))
              ?? looseSources.get(loosePhotoKey(reportRecord, taskRecord, photoRecord))
              ?? indexedSources.get(indexedPhotoKey(reportRecord, taskRecord, taskIndex, photoIndex));
            if (!source) return photoRecord;
            recovered += 1;
            return {
              ...photoRecord,
              previewUrl: source.previewUrl,
              storagePath: source.storagePath,
              uploadError: undefined,
              uploadStatus: source.storagePath ? "uploaded" : source.previewUrl ? "queued" : photoRecord.uploadStatus,
            };
          });
          const sourcedBackupPhotos = backupTaskPhotos
            .map((photo) => photo && typeof photo === "object" ? photo as JsonObject : {})
            .filter(photoHasSource)
            .filter((backupPhoto) => !currentPhotos.some((currentPhoto) => (
              currentPhoto && typeof currentPhoto === "object" && samePhoto(currentPhoto as JsonObject, backupPhoto)
            )))
            .map((backupPhoto) => {
              inserted += 1;
              return {
                ...backupPhoto,
                uploadError: undefined,
                uploadStatus: backupPhoto.storagePath ? "uploaded" : backupPhoto.previewUrl ? "queued" : backupPhoto.uploadStatus,
              };
            });
          return {
            ...taskRecord,
            photos: [...currentPhotos, ...sourcedBackupPhotos],
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });

    const updated = {
      ...current,
      reports: updatedReports,
      updatedAt: new Date().toISOString(),
    };
    const { error: saveError } = await supabase
      .from("app_state")
      .upsert({ data: updated, id: appStateRowId, updated_at: updated.updatedAt }, { onConflict: "id" });
    if (saveError) throw new Error(saveError.message);

    return NextResponse.json({ inspected, recovered, inserted, restored: recovered + inserted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Fotos konnten nicht wiederhergestellt werden." }, { status: 500 });
  }
}
