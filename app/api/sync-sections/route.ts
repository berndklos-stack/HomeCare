import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedSyncSections = [
  "activeJobId",
  "fieldNotes",
  "fieldProgress",
  "inventoryLocations",
  "materials",
  "reports",
  "resources",
] as const;

type SyncSectionKey = typeof allowedSyncSections[number];
type JsonObject = Record<string, unknown>;

type ResourceRow = {
  archived: boolean | null;
  build_year: string | null;
  deleted_logbook_entry_ids: unknown;
  identifier: string | null;
  location: string | null;
  logbook_year: string | null;
  maintenance_items: unknown;
  name: string;
  notes: string | null;
  odometer_year_end: number | null;
  odometer_year_start: number | null;
  responsible_person_id: string | null;
  status: string | null;
  tracking: unknown;
  type: string;
  id: string;
  updated_at: string | null;
};

type VehicleTripRow = {
  driver_id: string | null;
  end_address: string | null;
  end_coordinates: unknown;
  end_odometer: number | null;
  ended_at: string | null;
  fuel_or_charge: string | null;
  fuel_receipt_photo: unknown;
  id: string;
  kilometers: number | null;
  notes: string | null;
  odometer_photos: unknown;
  purpose: string | null;
  resource_id: string;
  start_address: string | null;
  start_coordinates: unknown;
  start_odometer: number | null;
  started_at: string | null;
  status: string | null;
  trip_date: string | null;
  trip_type: string | null;
  updated_at: string | null;
  visited: string | null;
  waypoints: unknown;
};

type ReportRow = {
  attachments: unknown;
  checklist_results: unknown;
  customer_comment: string | null;
  id: string;
  internal_notes: string | null;
  job_id: string | null;
  media_ids: unknown;
  object_id: string | null;
  report_date: string | null;
  sent_at: string | null;
  summary: string | null;
  title: string;
  updated_at: string | null;
  visible_to_customer: boolean | null;
};

type FieldProgressRow = {
  completed: boolean | null;
  id: string;
  job_id: string;
  minutes: number | null;
  note: string | null;
  photos: unknown;
  show_work_time_in_report: boolean | null;
  task_id: string;
  updated_at: string | null;
  work_date: string | null;
};

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

function numberOrNull(value: unknown) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrEmpty(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableString(value: unknown) {
  const text = stringOrEmpty(value).trim();
  return text ? text : null;
}

function maxUpdatedAt(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .sort((first, second) => String(second).localeCompare(String(first)))[0];
}

function resourceToRow(resource: JsonObject) {
  return {
    archived: Boolean(resource.archived),
    build_year: resource.buildYear ? String(resource.buildYear) : null,
    deleted_logbook_entry_ids: Array.isArray(resource.deletedLogbookEntryIds) ? resource.deletedLogbookEntryIds : [],
    identifier: stringOrEmpty(resource.identifier),
    location: stringOrEmpty(resource.location),
    logbook_year: stringOrEmpty(resource.logbookYear),
    maintenance_items: Array.isArray(resource.maintenanceItems) ? resource.maintenanceItems : [],
    name: stringOrEmpty(resource.name) || "Ressource",
    notes: stringOrEmpty(resource.notes),
    odometer_year_end: numberOrNull(resource.odometerYearEnd),
    odometer_year_start: numberOrNull(resource.odometerYearStart),
    responsible_person_id: resource.responsiblePersonId ? String(resource.responsiblePersonId) : null,
    status: stringOrEmpty(resource.status),
    tracking: resource.tracking && typeof resource.tracking === "object" ? resource.tracking : {},
    type: stringOrEmpty(resource.type) || "Fahrzeug",
    id: String(resource.id),
  };
}

function tripToRow(resourceId: string, trip: JsonObject) {
  return {
    driver_id: trip.driverId ? String(trip.driverId) : null,
    end_address: stringOrEmpty(trip.endAddress),
    end_coordinates: trip.endCoordinates && typeof trip.endCoordinates === "object" ? trip.endCoordinates : null,
    end_odometer: numberOrNull(trip.endOdometer),
    ended_at: trip.endedAt ? String(trip.endedAt) : null,
    fuel_or_charge: stringOrEmpty(trip.fuelOrCharge),
    fuel_receipt_photo: trip.fuelReceiptPhoto && typeof trip.fuelReceiptPhoto === "object" ? trip.fuelReceiptPhoto : null,
    id: String(trip.id),
    kilometers: numberOrNull(trip.kilometers),
    notes: stringOrEmpty(trip.notes),
    odometer_photos: Array.isArray(trip.odometerPhotos) ? trip.odometerPhotos : [],
    purpose: stringOrEmpty(trip.purpose),
    resource_id: resourceId,
    start_address: stringOrEmpty(trip.startAddress),
    start_coordinates: trip.startCoordinates && typeof trip.startCoordinates === "object" ? trip.startCoordinates : null,
    start_odometer: numberOrNull(trip.startOdometer),
    started_at: trip.startedAt ? String(trip.startedAt) : null,
    status: stringOrEmpty(trip.status) || "abgeschlossen",
    trip_date: stringOrEmpty(trip.date) || new Date().toISOString().slice(0, 10),
    trip_type: stringOrEmpty(trip.tripType) || "Dienstfahrt",
    updated_at: new Date().toISOString(),
    visited: stringOrEmpty(trip.visited),
    waypoints: Array.isArray(trip.waypoints) ? trip.waypoints : [],
  };
}

function rowToTrip(row: VehicleTripRow) {
  return {
    date: row.trip_date ?? "",
    driverId: row.driver_id ?? "",
    endAddress: row.end_address ?? "",
    endCoordinates: row.end_coordinates ?? undefined,
    endOdometer: row.end_odometer === null ? "" : String(row.end_odometer),
    endedAt: row.ended_at ?? undefined,
    fuelOrCharge: row.fuel_or_charge ?? "",
    fuelReceiptPhoto: row.fuel_receipt_photo ?? undefined,
    id: row.id,
    kilometers: row.kilometers === null ? "" : String(row.kilometers),
    notes: row.notes ?? "",
    odometerPhotos: Array.isArray(row.odometer_photos) ? row.odometer_photos : [],
    purpose: row.purpose ?? "",
    startAddress: row.start_address ?? "",
    startCoordinates: row.start_coordinates ?? undefined,
    startOdometer: row.start_odometer === null ? "" : String(row.start_odometer),
    startedAt: row.started_at ?? undefined,
    status: row.status ?? "abgeschlossen",
    tripType: row.trip_type ?? "Dienstfahrt",
    visited: row.visited ?? "",
    waypoints: Array.isArray(row.waypoints) ? row.waypoints : [],
  };
}

function reportToRow(report: JsonObject) {
  return {
    attachments: Array.isArray(report.attachments) ? report.attachments : [],
    checklist_results: Array.isArray(report.checklistResults) ? report.checklistResults : [],
    customer_comment: stringOrEmpty(report.customerComment),
    id: String(report.id),
    internal_notes: stringOrEmpty(report.internalNotes),
    job_id: nullableString(report.jobId),
    media_ids: Array.isArray(report.media) ? report.media : [],
    object_id: nullableString(report.objectId),
    report_date: nullableString(report.date),
    sent_at: nullableString(report.sentAt),
    summary: stringOrEmpty(report.summary),
    title: stringOrEmpty(report.title) || "Bericht",
    updated_at: nullableString(report.updatedAt) ?? new Date().toISOString(),
    visible_to_customer: report.visibleToCustomer !== false,
  };
}

function rowToReport(row: ReportRow) {
  return {
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    checklistResults: Array.isArray(row.checklist_results) ? row.checklist_results : [],
    customerComment: row.customer_comment ?? "",
    date: row.report_date ?? "",
    id: row.id,
    internalNotes: row.internal_notes ?? "",
    jobId: row.job_id ?? "",
    media: Array.isArray(row.media_ids) ? row.media_ids : [],
    objectId: row.object_id ?? "",
    sentAt: row.sent_at ?? undefined,
    summary: row.summary ?? "",
    title: row.title,
    updatedAt: row.updated_at ?? undefined,
    visibleToCustomer: row.visible_to_customer !== false,
  };
}

function progressKeyFromRow(row: FieldProgressRow) {
  return row.work_date ? `${row.job_id}::${row.work_date}` : row.job_id;
}

function progressDateFromKey(key: string) {
  const [, date] = key.split("::", 2);
  return date || null;
}

function progressJobIdFromKey(key: string) {
  return key.split("::", 1)[0] || key;
}

function fieldProgressToRows(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as JsonObject).flatMap(([progressKey, tasks]) => {
    if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) return [];
    const jobId = progressJobIdFromKey(progressKey);
    const workDate = progressDateFromKey(progressKey);
    return Object.entries(tasks as JsonObject)
      .filter(([, task]) => Boolean(task && typeof task === "object" && !Array.isArray(task)))
      .map(([taskId, task]) => {
        const taskRecord = task as JsonObject;
        return {
          completed: Boolean(taskRecord.completed),
          id: `${progressKey}:${taskId}`,
          job_id: jobId,
          minutes: numberOrNull(taskRecord.minutes),
          note: stringOrEmpty(taskRecord.note),
          photos: Array.isArray(taskRecord.photos) ? taskRecord.photos : [],
          show_work_time_in_report: taskRecord.showWorkTimeInReport !== false,
          task_id: taskId,
          updated_at: nullableString(taskRecord.updatedAt) ?? new Date().toISOString(),
          work_date: workDate,
        };
      });
  });
}

function rowToResource(row: ResourceRow, trips: VehicleTripRow[]) {
  return {
    archived: Boolean(row.archived),
    buildYear: row.build_year ?? undefined,
    deletedLogbookEntryIds: Array.isArray(row.deleted_logbook_entry_ids) ? row.deleted_logbook_entry_ids : [],
    identifier: row.identifier ?? "",
    location: row.location ?? "",
    logbook: trips
      .filter((trip) => trip.resource_id === row.id)
      .map(rowToTrip)
      .sort((first, second) => `${first.date}-${first.id}`.localeCompare(`${second.date}-${second.id}`)),
    logbookYear: row.logbook_year ?? "",
    maintenanceItems: Array.isArray(row.maintenance_items) ? row.maintenance_items : [],
    media: [],
    name: row.name,
    notes: row.notes ?? "",
    odometerYearEnd: row.odometer_year_end === null ? "" : String(row.odometer_year_end),
    odometerYearStart: row.odometer_year_start === null ? "" : String(row.odometer_year_start),
    responsiblePersonId: row.responsible_person_id ?? "",
    status: row.status ?? "",
    tracking: row.tracking && typeof row.tracking === "object" ? row.tracking : undefined,
    type: row.type,
    id: row.id,
  };
}

async function loadResourceSectionViaRpc(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase.rpc("homecare_resources_snapshot");
  if (error || !Array.isArray(data)) return null;
  return {
    updatedAt: new Date().toISOString(),
    value: data,
  };
}

async function loadResourceSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: resourceRows, error: resourceError } = await supabase
    .from("homecare_resources")
    .select("id, type, build_year, name, identifier, status, responsible_person_id, location, notes, logbook_year, odometer_year_start, odometer_year_end, tracking, maintenance_items, deleted_logbook_entry_ids, archived, updated_at")
    .order("name", { ascending: true });

  if (resourceError) return loadResourceSectionViaRpc(supabase);
  if (!resourceRows?.length) return null;

  const { data: tripRows, error: tripError } = await supabase
    .from("homecare_vehicle_trips")
    .select("id, resource_id, trip_date, driver_id, status, started_at, ended_at, trip_type, start_address, end_address, start_coordinates, end_coordinates, waypoints, start_odometer, end_odometer, kilometers, purpose, visited, fuel_or_charge, fuel_receipt_photo, odometer_photos, notes, updated_at")
    .order("trip_date", { ascending: true });

  if (tripError) return loadResourceSectionViaRpc(supabase);

  const resources = (resourceRows as ResourceRow[]).map((row) => rowToResource(row, (tripRows ?? []) as VehicleTripRow[]));
  return {
    updatedAt: maxUpdatedAt([
      ...(resourceRows as ResourceRow[]).map((row) => row.updated_at),
      ...((tripRows ?? []) as VehicleTripRow[]).map((row) => row.updated_at),
    ]),
    value: resources,
  };
}

async function saveResourceSectionViaRpc(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  const { error } = await supabase.rpc("homecare_save_resources_snapshot", { payload: value });
  if (error) throw new Error(error.message);
}

async function saveResourceSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const resources = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!resources.length) return;

  const { error: resourceError } = await supabase
    .from("homecare_resources")
    .upsert(resources.map(resourceToRow), { onConflict: "id" });

  if (resourceError) {
    await saveResourceSectionViaRpc(supabase, value);
    return;
  }

  const trips = resources.flatMap((resource) => (
    Array.isArray(resource.logbook)
      ? resource.logbook
          .filter((trip): trip is JsonObject => Boolean(trip && typeof trip === "object" && "id" in trip))
          .map((trip) => tripToRow(String(resource.id), trip))
      : []
  ));

  if (!trips.length) return;
  const { error: tripError } = await supabase
    .from("homecare_vehicle_trips")
    .upsert(trips, { onConflict: "id" });

  if (tripError) await saveResourceSectionViaRpc(supabase, value);
}

async function loadReportsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_reports")
    .select("id, job_id, object_id, title, report_date, visible_to_customer, summary, internal_notes, customer_comment, checklist_results, media_ids, attachments, sent_at, updated_at")
    .order("report_date", { ascending: true });

  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as ReportRow[]).map((row) => row.updated_at)),
    value: (data as ReportRow[]).map(rowToReport),
  };
}

async function saveReportsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const reports = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!reports.length) return;

  const { error } = await supabase
    .from("homecare_reports")
    .upsert(reports.map(reportToRow), { onConflict: "id" });

  if (error) throw new Error(error.message);
}

async function loadFieldProgressSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_field_progress")
    .select("id, job_id, work_date, task_id, completed, minutes, show_work_time_in_report, note, photos, updated_at")
    .order("updated_at", { ascending: true });

  if (error || !data?.length) return null;

  const value = (data as FieldProgressRow[]).reduce<Record<string, Record<string, JsonObject>>>((progress, row) => {
    const progressKey = progressKeyFromRow(row);
    progress[progressKey] = progress[progressKey] ?? {};
    progress[progressKey][row.task_id] = {
      completed: Boolean(row.completed),
      minutes: row.minutes === null ? "" : String(row.minutes),
      note: row.note ?? "",
      photos: Array.isArray(row.photos) ? row.photos : [],
      showWorkTimeInReport: row.show_work_time_in_report !== false,
      updatedAt: row.updated_at ?? undefined,
    };
    return progress;
  }, {});

  return {
    updatedAt: maxUpdatedAt((data as FieldProgressRow[]).map((row) => row.updated_at)),
    value,
  };
}

async function saveFieldProgressSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  const rows = fieldProgressToRows(value);
  if (!rows.length) return;

  const { error } = await supabase
    .from("homecare_field_progress")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

async function loadFallbackSections(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, keys: SyncSectionKey[]) {
  const { data, error } = await supabase
    .from("app_state")
    .select("id, data, updated_at")
    .in("id", keys.map(rowId));

  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((row) => {
    const rowData = row.data && typeof row.data === "object" ? row.data as JsonObject : {};
    const key = String(rowData.key ?? row.id.replace(/^sync-section:/, ""));
    return [key, {
      updatedAt: row.updated_at,
      value: rowData.value,
    }];
  }));
}

async function saveFallbackSections(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, patch: JsonObject) {
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

  if (rows.length === 0) return new Date().toISOString();

  const { error } = await supabase
    .from("app_state")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(error.message);
  return rows[0].updated_at;
}

function requestedSyncKeys(request: Request) {
  const requestedKeys = new URL(request.url).searchParams.get("keys")?.split(",")
    .map((key) => key.trim())
    .filter(isSyncSectionKey);
  return requestedKeys?.length ? requestedKeys : [...allowedSyncSections];
}

function patchFromBody(body: JsonObject) {
  return body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
    ? body.patch as JsonObject
    : {};
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: {}, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const keys = requestedSyncKeys(request);
  try {
    const sections = await loadFallbackSections(supabase, keys);
    if (keys.includes("fieldProgress")) {
      const fieldProgressSection = await loadFieldProgressSection(supabase);
      if (fieldProgressSection) sections.fieldProgress = fieldProgressSection;
    }
    if (keys.includes("reports")) {
      const reportSection = await loadReportsSection(supabase);
      if (reportSection) sections.reports = reportSection;
    }
    if (keys.includes("resources")) {
      const resourceSection = await loadResourceSection(supabase);
      if (resourceSection) sections.resources = resourceSection;
    }

    return NextResponse.json(
      { data: sections },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    return NextResponse.json(
      { data: {}, error: error instanceof Error ? error.message : "Sync-Bereiche konnten nicht geladen werden.", retry: true },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as JsonObject;
  const patch = patchFromBody(body);
  const filteredPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => isSyncSectionKey(key)));
  if (Object.keys(filteredPatch).length === 0) {
    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  }

  try {
    const updatedAt = await saveFallbackSections(supabase, filteredPatch);
    if ("fieldProgress" in filteredPatch) {
      try {
        await saveFieldProgressSection(supabase, filteredPatch.fieldProgress);
      } catch (error) {
        console.warn("Relationaler Feldfortschritt-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("reports" in filteredPatch) {
      try {
        await saveReportsSection(supabase, filteredPatch.reports);
      } catch (error) {
        console.warn("Relationaler Bericht-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("resources" in filteredPatch) {
      try {
        await saveResourceSection(supabase, filteredPatch.resources);
      } catch (error) {
        console.warn("Relationaler Ressourcen-Sync wurde auf Fallback reduziert.", error);
      }
    }

    return NextResponse.json(
      { ok: true, updatedAt },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync-Bereich konnte nicht gespeichert werden.", retry: true },
      { status: 500 },
    );
  }
}
