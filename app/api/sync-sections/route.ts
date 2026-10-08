import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import {
  applyObjectMediaSignedUrls,
  objectMediaPathsToSign,
  objectMediaSignedUrlTtlSeconds,
} from "@/lib/server/objectMediaProjection";

export const runtime = "nodejs";

const allowedSyncSections = [
  "accountingAccounts",
  "billing",
  "companySettings",
  "customers",
  "dailyMailSettings",
  "deletedEntityIds",
  "deletedReportIds",
  "fieldNotes",
  "fieldProgress",
  "inventoryLocations",
  "jobs",
  "jobNoteMeta",
  "materials",
  "objects",
  "packages",
  "personnel",
  "portalMessages",
  "reports",
  "resources",
  "services",
  "tenantSettings",
  "translationOverrides",
] as const;

type SyncSectionKey = typeof allowedSyncSections[number];
type JsonObject = Record<string, unknown>;

type ResourceRow = {
  archived: boolean | null;
  brand: string | null;
  build_year: string | null;
  current_odometer: number | null;
  current_odometer_date: string | null;
  default_driver_id: string | null;
  deleted_at: string | null;
  deleted_logbook_entry_ids: unknown;
  identifier: string | null;
  license_plate: string | null;
  location: string | null;
  logbook_active: boolean | null;
  logbook_year: string | null;
  maintenance_items: unknown;
  model: string | null;
  name: string;
  notes: string | null;
  odometer_year_end: number | null;
  odometer_year_start: number | null;
  odometer_history: unknown;
  odometer_last_confirmed: number | null;
  odometer_last_confirmed_at: string | null;
  odometer_last_confirmed_by: string | null;
  odometer_last_confirmed_photo: unknown;
  owner_company: string | null;
  private_use_allowed: boolean | null;
  registration_country: string | null;
  revision: number;
  responsible_person_id: string | null;
  status: string | null;
  standard_trips: unknown;
  tax_country: string | null;
  tracking: unknown;
  type: string;
  id: string;
  updated_at: string | null;
};

type VehicleTripRow = {
  audit_log: unknown;
  driver_id: string | null;
  end_address: string | null;
  end_address_resolved: string | null;
  end_coordinates: unknown;
  end_odometer: number | null;
  ended_at: string | null;
  fuel_or_charge: string | null;
  fuel_receipt_photo: unknown;
  id: string;
  deleted_at: string | null;
  kilometers: number | null;
  notes: string | null;
  odometer_photos: unknown;
  purpose: string | null;
  resource_id: string;
  revision: number;
  rule_country: string | null;
  rule_title: string | null;
  rule_version: string | null;
  start_address: string | null;
  start_address_resolved: string | null;
  start_coordinates: unknown;
  start_odometer: number | null;
  started_at: string | null;
  status: string | null;
  trip_category: string | null;
  trip_date: string | null;
  trip_type: string | null;
  updated_at: string | null;
  validation_warnings: unknown;
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
  revision: number;
  deleted_at: string | null;
  record_data: unknown;
  customer_id: string | null;
};

type FieldProgressRow = {
  completed: boolean | null;
  deleted_at: string | null;
  id: string;
  job_id: string;
  minutes: number | null;
  note: string | null;
  photos: unknown;
  revision: number;
  show_work_time_in_report: boolean | null;
  task_id: string;
  updated_at: string | null;
  work_date: string | null;
};

type CustomerRow = {
  address: string | null;
  archived: boolean | null;
  balance: number | null;
  billable: boolean | null;
  billing_address: string | null;
  billing_address_mode: string | null;
  company_name: string | null;
  created_at: string | null;
  deleted_at: string | null;
  id: string;
  language: string | null;
  name: string;
  notes: string | null;
  offer_mail_body: string | null;
  order_confirmation_mail_body: string | null;
  personal_number: string | null;
  portal_login_email: string | null;
  portal_login_history: unknown;
  portal_status: string | null;
  report_mail_body: string | null;
  revision: number;
  updated_at: string | null;
  weekly_report_mail_body: string | null;
  work_time_visibility: string | null;
};

type CustomerContactRow = {
  created_at: string | null;
  customer_id: string;
  deleted_at: string | null;
  email: string | null;
  id: string;
  is_primary: boolean;
  name: string;
  notes: string | null;
  phone: string | null;
  phone2: string | null;
  revision: number;
  role: string | null;
  updated_at: string | null;
};

type ObjectRow = {
  access_notes: string | null;
  address: string | null;
  alarm: string | null;
  archived: boolean | null;
  bathrooms: number | null;
  beds: number | null;
  billing_address: string | null;
  billing_address_mode: string | null;
  build_year: number | null;
  care_package: string | null;
  custom_fields: unknown;
  deleted_at: string | null;
  equipment: unknown;
  heating: string | null;
  id: string;
  internet: string | null;
  key_safe: string | null;
  last_visit: string | null;
  name: string;
  next_visit: string | null;
  owner_address: string | null;
  owner_customer_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  parking: string | null;
  plot_sqm: number | null;
  region: string | null;
  risks: unknown;
  rooms: number | null;
  septic: string | null;
  size_sqm: number | null;
  status: string | null;
  object_type: string;
  revision: number;
  updated_at: string | null;
  water: string | null;
};

type MediaRow = {
  deleted_at: string | null;
  description: string | null;
  id: string;
  is_primary: boolean | null;
  kind: string;
  name: string;
  owner_id: string;
  preview_url: string | null;
  revision: number;
  source: string | null;
  storage_path: string | null;
  updated_at: string | null;
};

type PersonnelRow = {
  deleted_at: string | null;
  archived: boolean | null;
  created_at: string | null;
  email: string | null;
  first_name: string;
  id: string;
  language: string | null;
  last_name: string;
  notes: string | null;
  personnel_number: string | null;
  phone: string | null;
  record_data: unknown;
  revision: number;
  role: string | null;
  status: string | null;
  updated_at: string | null;
};

type JobRow = {
  assigned_to: string | null;
  billable: boolean | null;
  checklist: unknown;
  consulting: unknown;
  custom_service: unknown;
  customer_id: string | null;
  description: string | null;
  deleted_at: string | null;
  discount: unknown;
  due_date: string | null;
  end_date: string | null;
  execution_date: string | null;
  execution_log: unknown;
  id: string;
  internal_notes: string | null;
  material: string | null;
  material_items: unknown;
  object_id: string | null;
  offer_number: string | null;
  offer_sent_at: string | null;
  order_confirmation_number: string | null;
  order_confirmation_sent_at: string | null;
  priority: string | null;
  record_data: unknown;
  revision: number;
  resource_ids: unknown;
  schedule: unknown;
  series_excluded_dates: unknown;
  series_master_id: string | null;
  series_occurrence_date: string | null;
  service_discounts: unknown;
  service_ids: unknown;
  service_quantities: unknown;
  start_date: string | null;
  status: string | null;
  status_updated_at: string | null;
  title: string;
  type: string | null;
  updated_at: string | null;
  work_minutes: number | null;
};

type JobTimeEntryRow = {
  billed_at: string | null;
  billing_record_id: string | null;
  billing_status: string;
  deleted_at: string | null;
  description: string | null;
  end_time: string | null;
  entry_date: string;
  id: string;
  job_id: string;
  minutes: number;
  revision: number;
  start_time: string | null;
  updated_at: string | null;
};

type JobNoteRow = {
  deleted_at: string | null;
  id: string;
  job_id: string;
  note: string;
  revision: number;
  updated_at: string | null;
  work_date: string | null;
};

type AccountingAccountRow = {
  account: string;
  archived: boolean | null;
  category: string;
  label: string;
  deleted_at: string | null;
  record_data: unknown;
  revision: number;
  updated_at: string | null;
};

type InventoryLocationRow = {
  archived: boolean | null;
  id: string;
  name: string;
  note: string | null;
  site: string | null;
  deleted_at: string | null;
  record_data: unknown;
  revision: number;
  updated_at: string | null;
};

type MaterialRow = {
  accounting_account: string | null;
  archived: boolean | null;
  category: string | null;
  currency: string | null;
  description: string | null;
  id: string;
  max_stock: number | null;
  min_stock: number | null;
  name: string;
  primary_location_id: string | null;
  purchase_price: number | null;
  sales_price: number | null;
  sku: string | null;
  supplier: string | null;
  tax_rate: number | null;
  unit: string | null;
  deleted_at: string | null;
  record_data: unknown;
  revision: number;
  updated_at: string | null;
};

type InventoryMovementRow = {
  billable_as_service: boolean | null;
  changes: unknown;
  counted_quantity: number | null;
  created_at: string | null;
  customer_id: string | null;
  id: string;
  location_id: string | null;
  material_id: string;
  movement_type: string;
  note: string | null;
  purchase_gross: number | null;
  purchase_net: number | null;
  purchase_tax_amount: number | null;
  purchase_tax_rate: number | null;
  quantity: number;
  receipt: unknown;
  service_id: string | null;
  supplier: string | null;
  updated_at: string | null;
};

type ServiceRow = {
  accounting_account: string | null;
  archived: boolean | null;
  category: string | null;
  checklist: unknown;
  currency: string | null;
  description: string | null;
  id: string;
  name: string;
  price: number | null;
  show_work_time_in_reports: boolean | null;
  tax_rate: number | null;
  unit: string | null;
  deleted_at: string | null;
  record_data: unknown;
  revision: number;
  updated_at: string | null;
};

type ServicePackageRow = {
  archived: boolean | null;
  description: string | null;
  id: string;
  name: string;
  price: number | null;
  service_ids: unknown;
  deleted_at: string | null;
  record_data: unknown;
  revision: number;
  updated_at: string | null;
};

type BillingRow = {
  amount: number | null;
  cancelled_at: string | null;
  created_at: string | null;
  customer_id: string | null;
  due_date: string | null;
  external_export_status: string | null;
  external_export_system: string | null;
  external_exported_at: string | null;
  id: string;
  invoice_date: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoiced_at: string | null;
  job_id: string | null;
  label: string;
  lines: unknown;
  notes: string | null;
  object_id: string | null;
  paid_at: string | null;
  outgoing_book_number: string | null;
  record_data: unknown;
  revision: number | null;
  deleted_at: string | null;
  report_id: string | null;
  sent_at: string | null;
  service_date: string | null;
  source: string | null;
  status: string | null;
  updated_at: string | null;
};

type PortalMessageRow = {
  created_at: string | null;
  customer_id: string | null;
  delivery_error: string | null;
  delivery_status: string | null;
  id: string;
  message: string;
  object_id: string | null;
  origin: string | null;
  replies: unknown;
  sent_at: string | null;
  status: string | null;
  subject: string;
  updated_at: string | null;
  report_id: string | null;
  revision: number;
  deleted_at: string | null;
  record_data: unknown;
};

type TranslationRow = {
  de: string;
  deleted_at: string | null;
  en: string;
  key: string;
  revision: number;
  sv: string;
  updated_at: string | null;
};

type SettingRow = {
  deleted_at: string | null;
  key: string;
  revision: number;
  updated_at: string | null;
  value: unknown;
};

type TenantRow = {
  id: string;
  name: string;
  settings_revision: number;
  subscription_interval: string | null;
  subscription_status: string | null;
  updated_at: string | null;
};

type TenantSubscriptionRow = {
  current_period_end: string | null;
  interval: string | null;
  plan_id: string | null;
  status: string | null;
  updated_at: string | null;
};

type TenantModuleRow = {
  enabled: boolean | null;
  module: string;
  updated_at: string | null;
};

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
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

function dateOrNull(value: unknown) {
  const text = stringOrEmpty(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const germanMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const normalized = isoMatch
    ? text
    : germanMatch
      ? `${germanMatch[3]}-${germanMatch[2]}-${germanMatch[1]}`
      : null;
  if (!normalized) return null;

  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function maxUpdatedAt(values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .sort((first, second) => String(second).localeCompare(String(first)))[0];
}

function normalizeReportDate(value: unknown) {
  const text = stringOrEmpty(value).trim();
  const parsed = text ? new Date(`${text}T12:00:00`) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : text;
}

function reportDedupeKey(report: JsonObject) {
  const reportType = String(report.id ?? "").startsWith("WEEK-") ? "week" : "day";
  return [reportType, stringOrEmpty(report.jobId), normalizeReportDate(report.date)].join("|");
}

function reportChangedTime(report: JsonObject) {
  return Date.parse(stringOrEmpty(report.updatedAt) || stringOrEmpty(report.sentAt));
}

function photoHasSource(photo: unknown) {
  if (!photo || typeof photo !== "object") return false;
  const item = photo as JsonObject;
  return Boolean(item.previewUrl || item.storagePath);
}

function chooseReportText(primaryText: unknown, fallbackText: unknown, primaryTime: number, fallbackTime: number) {
  const primary = stringOrEmpty(primaryText);
  const fallback = stringOrEmpty(fallbackText);
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

function mergeFieldPhotos(existingPhotos: unknown, patchPhotos: unknown) {
  const photosByKey = new Map<string, JsonObject>();
  const photoScore = (photo: JsonObject) => [
    photoHasSource(photo) ? 20 : 0,
    photo.storagePath ? 14 : 0,
    stringOrEmpty(photo.previewUrl).startsWith("data:") ? -6 : 0,
    photo.uploadStatus === "uploaded" ? 4 : 0,
    photo.uploadStatus === "uploading" ? -4 : 0,
    stringOrEmpty(photo.note).trim() ? 3 : 0,
    photo.createdAt ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  [
    ...(Array.isArray(existingPhotos) ? existingPhotos : []),
    ...(Array.isArray(patchPhotos) ? patchPhotos : []),
  ].forEach((photo) => {
    if (!photo || typeof photo !== "object") return;
    const item = photo as JsonObject;
    const key = item.id ? `id:${String(item.id)}` : `${stringOrEmpty(item.name)}|${stringOrEmpty(item.createdAt)}|${stringOrEmpty(item.previewUrl)}`;
    const existing = photosByKey.get(key);
    if (!existing) {
      photosByKey.set(key, item);
      return;
    }
    const betterSource = photoScore(item) > photoScore(existing) ? item : existing;
    const fallback = betterSource === item ? existing : item;
    photosByKey.set(key, {
      ...fallback,
      ...betterSource,
      createdAt: betterSource.createdAt ?? fallback.createdAt,
      note: stringOrEmpty(betterSource.note).trim() ? betterSource.note : fallback.note,
      previewUrl: stringOrEmpty(betterSource.previewUrl) || fallback.previewUrl,
      storagePath: stringOrEmpty(betterSource.storagePath) || fallback.storagePath,
    });
  });

  const mergedPhotos = Array.from(photosByKey.values());
  return mergedPhotos
    .filter((photo) => {
      const isLegacyEmbeddedPhoto = !photo.id
        && !photo.storagePath
        && stringOrEmpty(photo.previewUrl).startsWith("data:image/");
      if (!isLegacyEmbeddedPhoto) return true;
      return !mergedPhotos.some((candidate) => (
        candidate !== photo
        && stringOrEmpty(candidate.name) === stringOrEmpty(photo.name)
        && Boolean(candidate.storagePath)
      ));
    })
    .sort((first, second) => stringOrEmpty(first.createdAt).localeCompare(stringOrEmpty(second.createdAt)));
}

function mergeRecordsById(existingRecords: unknown, patchRecords: unknown) {
  const recordsById = new Map<string, JsonObject>();
  [
    ...(Array.isArray(existingRecords) ? existingRecords : []),
    ...(Array.isArray(patchRecords) ? patchRecords : []),
  ].forEach((record) => {
    if (!record || typeof record !== "object") return;
    const item = record as JsonObject;
    const id = stringOrEmpty(item.id) || `${stringOrEmpty(item.name)}|${stringOrEmpty(item.createdAt)}`;
    if (!id.trim()) return;
    recordsById.set(id, { ...(recordsById.get(id) ?? {}), ...item });
  });

  return Array.from(recordsById.values());
}

function reportPhotoSourceCount(report: JsonObject) {
  const checklist = Array.isArray(report.checklistResults) ? report.checklistResults as JsonObject[] : [];
  return checklist.reduce((sum, item) => (
    sum + (Array.isArray(item.photos) ? item.photos.filter(photoHasSource).length : 0)
  ), 0);
}

function reportCompletenessScore(report: JsonObject) {
  const checklist = Array.isArray(report.checklistResults) ? report.checklistResults as JsonObject[] : [];
  const noteCount = checklist.filter((item) => stringOrEmpty(item.note).trim()).length;
  return [
    report.sentAt ? 100 : 0,
    stringOrEmpty(report.customerComment).trim() ? 20 : 0,
    checklist.length * 4,
    reportPhotoSourceCount(report) * 4,
    (Array.isArray(report.attachments) ? report.attachments.length : 0) * 3,
    noteCount * 2,
    stringOrEmpty(report.summary).trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function mergeReportChecklistItem(existingItem: JsonObject | undefined, patchItem: JsonObject) {
  if (!existingItem) return patchItem;
  const existingTime = Date.parse(stringOrEmpty(existingItem.updatedAt));
  const patchTime = Date.parse(stringOrEmpty(patchItem.updatedAt));
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
    note: chooseReportText(newest.note, fallback.note, Date.parse(stringOrEmpty(newest.updatedAt)), Date.parse(stringOrEmpty(fallback.updatedAt))),
    photos: mergeFieldPhotos(existingItem.photos, patchItem.photos),
  };
}

function mergeReportPair(first: JsonObject, second: JsonObject) {
  const primary = reportCompletenessScore(second) >= reportCompletenessScore(first) ? second : first;
  const fallback = primary === first ? second : first;
  const primaryTime = reportChangedTime(primary);
  const fallbackTime = reportChangedTime(fallback);
  const checklistById = new Map<string, JsonObject>();

  (Array.isArray(fallback.checklistResults) ? fallback.checklistResults as JsonObject[] : []).forEach((item) => {
    checklistById.set(stringOrEmpty(item.id) || stringOrEmpty(item.title) || String(checklistById.size), item);
  });
  (Array.isArray(primary.checklistResults) ? primary.checklistResults as JsonObject[] : []).forEach((item) => {
    const id = stringOrEmpty(item.id) || stringOrEmpty(item.title) || String(checklistById.size);
    checklistById.set(id, mergeReportChecklistItem(checklistById.get(id), item));
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

function mergeReports(existingReports: unknown, patchReports: unknown) {
  const reportsByKey = new Map<string, JsonObject>();
  [
    ...(Array.isArray(existingReports) ? existingReports : []),
    ...(Array.isArray(patchReports) ? patchReports : []),
  ].forEach((report) => {
    if (!report || typeof report !== "object") return;
    const item = report as JsonObject;
    const key = reportDedupeKey(item);
    const existing = reportsByKey.get(key);
    reportsByKey.set(key, existing ? mergeReportPair(existing, item) : { ...item, date: normalizeReportDate(item.date) });
  });

  return Array.from(reportsByKey.values());
}

function rowToTrip(row: VehicleTripRow) {
  return {
    auditLog: Array.isArray(row.audit_log) ? row.audit_log : [],
    date: row.trip_date ?? "",
    driverId: row.driver_id ?? "",
    endAddress: row.end_address ?? "",
    endAddressResolved: row.end_address_resolved ?? undefined,
    endCoordinates: row.end_coordinates ?? undefined,
    endOdometer: row.end_odometer === null ? "" : String(row.end_odometer),
    endedAt: row.ended_at ?? undefined,
    fuelOrCharge: row.fuel_or_charge ?? "",
    fuelReceiptPhoto: row.fuel_receipt_photo ?? undefined,
    id: row.id,
    deletedAt: row.deleted_at ?? undefined,
    kilometers: row.kilometers === null ? "" : String(row.kilometers),
    notes: row.notes ?? "",
    odometerPhotos: Array.isArray(row.odometer_photos) ? row.odometer_photos : [],
    purpose: row.purpose ?? "",
    revision: row.revision,
    ruleCountry: row.rule_country ?? "",
    ruleTitle: row.rule_title ?? "",
    ruleVersion: row.rule_version ?? "",
    startAddress: row.start_address ?? "",
    startAddressResolved: row.start_address_resolved ?? undefined,
    startCoordinates: row.start_coordinates ?? undefined,
    startOdometer: row.start_odometer === null ? "" : String(row.start_odometer),
    startedAt: row.started_at ?? undefined,
    status: row.status ?? "abgeschlossen",
    tripCategory: row.trip_category ?? undefined,
    tripType: row.trip_type ?? "Dienstfahrt",
    updatedAt: row.updated_at ?? undefined,
    validationWarnings: Array.isArray(row.validation_warnings) ? row.validation_warnings : [],
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
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
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
    revision: row.revision,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function progressKeyFromRow(row: FieldProgressRow) {
  return row.work_date ? `${row.job_id}::${row.work_date}` : row.job_id;
}

function rowToCustomer(row: CustomerRow, objectRows: ObjectRow[], contactRows: CustomerContactRow[]) {
  const contacts = contactRows
    .filter((contact) => contact.customer_id === row.id && !contact.deleted_at)
    .map((contact) => ({
      createdAt: contact.created_at ?? undefined,
      customerId: row.id,
      email: contact.email ?? "",
      id: contact.id,
      isPrimary: contact.is_primary,
      name: contact.name,
      notes: contact.notes ?? "",
      phone: contact.phone ?? "",
      phone2: contact.phone2 ?? "",
      revision: contact.revision,
      role: contact.role ?? "",
      updatedAt: contact.updated_at ?? undefined,
    }));
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  return {
    address: row.address ?? "",
    archived: Boolean(row.archived),
    balance: row.balance === null ? "0" : String(row.balance),
    billable: row.billable !== false,
    billingAddress: row.billing_address ?? "",
    billingAddressMode: row.billing_address_mode ?? "Kundenadresse",
    company: row.company_name ?? "",
    contact: primaryContact?.name ?? "",
    contacts,
    createdAt: row.created_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    email: primaryContact?.email ?? "",
    id: row.id,
    language: row.language ?? "Deutsch",
    name: row.name,
    notes: row.notes ?? "",
    objects: objectRows.filter((object) => object.owner_customer_id === row.id && !object.deleted_at).map((object) => object.id),
    offerMailBody: row.offer_mail_body ?? "",
    orderConfirmationMailBody: row.order_confirmation_mail_body ?? "",
    personalNumber: row.personal_number ?? "",
    phone: primaryContact?.phone ?? "",
    phone2: primaryContact?.phone2 ?? "",
    portalLoginEmail: row.portal_login_email ?? "",
    portalLoginHistory: Array.isArray(row.portal_login_history) ? row.portal_login_history : [],
    portalPassword: "",
    portalStatus: row.portal_status ?? "einladen",
    reportMailBody: row.report_mail_body ?? "",
    revision: row.revision,
    weeklyReportMailBody: row.weekly_report_mail_body ?? "",
    workTimeVisibility: row.work_time_visibility ?? "service",
  };
}

function mediaToRow(ownerType: "object" | "resource", ownerId: string, item: JsonObject) {
  return {
    description: stringOrEmpty(item.description),
    id: String(item.id),
    is_primary: Boolean(item.isPrimary),
    kind: stringOrEmpty(item.type) || "Bild",
    name: stringOrEmpty(item.name) || "Datei",
    owner_id: ownerId,
    owner_type: ownerType,
    preview_url: stringOrEmpty(item.previewUrl),
    source: stringOrEmpty(item.source),
    storage_path: stringOrEmpty(item.storagePath),
  };
}

function rowToMedia(row: MediaRow) {
  return {
    description: row.description ?? "",
    id: row.id,
    revision: row.revision,
    isPrimary: Boolean(row.is_primary),
    name: row.name,
    previewUrl: row.preview_url ?? undefined,
    source: row.source ?? "Upload",
    storagePath: row.storage_path ?? undefined,
    type: row.kind,
  };
}

function rowToObject(row: ObjectRow, mediaRows: MediaRow[]) {
  const items = mediaRows.filter((item) => item.owner_id === row.id && !item.deleted_at).map(rowToMedia);
  return {
    access: {
      alarm: row.alarm ?? "",
      keySafe: row.key_safe ?? "",
      notes: row.access_notes ?? "",
      parking: row.parking ?? "",
    },
    address: row.address ?? "",
    archived: Boolean(row.archived),
    bathrooms: row.bathrooms ?? 0,
    beds: row.beds ?? 0,
    billingAddress: row.billing_address ?? "",
    billingAddressMode: row.billing_address_mode ?? "Objektadresse",
    buildYear: row.build_year ?? 0,
    carePackage: row.care_package ?? "",
    customFields: row.custom_fields && typeof row.custom_fields === "object" && !Array.isArray(row.custom_fields) ? row.custom_fields : {},
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    id: row.id,
    lastVisit: row.last_visit ?? "",
    media: {
      documents: items.filter((item) => item.type === "Dokument").length,
      floorPlans: items.filter((item) => item.type === "Grundriss").length,
      images: items.filter((item) => item.type === "Bild").length,
      items,
    },
    name: row.name,
    nextVisit: row.next_visit ?? "",
    owner: row.owner_name ?? "",
    ownerAddress: row.owner_address ?? "",
    ownerCustomerId: row.owner_customer_id ?? "",
    ownerEmail: row.owner_email ?? "",
    ownerPhone: row.owner_phone ?? "",
    plotSqm: row.plot_sqm ?? 0,
    region: row.region ?? "",
    risks: Array.isArray(row.risks) ? row.risks : [],
    rooms: row.rooms ?? 0,
    sizeSqm: row.size_sqm ?? 0,
    status: row.status ?? "",
    type: row.object_type || "Objekt",
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
    utilities: {
      heating: row.heating ?? "",
      internet: row.internet ?? "",
      septic: row.septic ?? "",
      water: row.water ?? "",
    },
  };
}

function personnelToRow(person: JsonObject) {
  return {
    archived: Boolean(person.archived),
    created_at: nullableString(person.createdAt),
    email: stringOrEmpty(person.email),
    first_name: stringOrEmpty(person.firstName) || "Unbenannt",
    id: String(person.id),
    language: stringOrEmpty(person.language) || "Deutsch",
    last_name: stringOrEmpty(person.lastName),
    notes: stringOrEmpty(person.notes),
    personnel_number: stringOrEmpty(person.personnelNumber),
    phone: stringOrEmpty(person.phone),
    role: stringOrEmpty(person.role),
    status: stringOrEmpty(person.status) || "aktiv",
  };
}

function rowToPersonnel(row: PersonnelRow) {
  return {
    archived: Boolean(row.archived),
    createdAt: row.created_at ?? undefined,
    email: row.email ?? "",
    firstName: row.first_name,
    id: row.id,
    language: row.language ?? "Deutsch",
    lastName: row.last_name,
    notes: row.notes ?? "",
    personnelNumber: row.personnel_number ?? "",
    phone: row.phone ?? "",
    role: row.role ?? "",
    status: row.status ?? "aktiv",
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToJob(row: JobRow, timeRows: JobTimeEntryRow[] = []) {
  const discount = row.discount && typeof row.discount === "object" && !Array.isArray(row.discount) ? row.discount as JsonObject : {};
  const recordData = row.record_data && typeof row.record_data === "object" && !Array.isArray(row.record_data) ? row.record_data as JsonObject : {};
  const consulting = row.consulting && typeof row.consulting === "object" && !Array.isArray(row.consulting) ? row.consulting as JsonObject : {};
  return {
    ...recordData,
    assignedTo: row.assigned_to ?? "",
    billable: row.billable !== false,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    customService: row.custom_service && typeof row.custom_service === "object" ? row.custom_service : null,
    customerId: row.customer_id ?? "",
    description: row.description ?? "",
    discountReason: stringOrEmpty(discount.reason),
    discountType: stringOrEmpty(discount.type),
    discountValue: stringOrEmpty(discount.value),
    dueDate: row.due_date ?? "",
    endDate: row.end_date ?? undefined,
    executionDate: row.execution_date ?? undefined,
    executionLog: Array.isArray(row.execution_log) ? row.execution_log : [],
    id: row.id,
    internalNotes: row.internal_notes ?? "",
    material: row.material ?? "",
    materialItems: Array.isArray(row.material_items) ? row.material_items : [],
    objectId: row.object_id ?? "",
    offerNumber: row.offer_number ?? undefined,
    offerSentAt: row.offer_sent_at ?? undefined,
    orderConfirmationNumber: row.order_confirmation_number ?? undefined,
    orderConfirmationSentAt: row.order_confirmation_sent_at ?? undefined,
    priority: row.priority ?? "normal",
    consulting: Object.keys(consulting).length > 0 ? {
      ...consulting,
      entries: timeRows.filter((entry) => entry.job_id === row.id && !entry.deleted_at).map((entry) => ({
        billedAt: entry.billed_at ?? undefined,
        billingRecordId: entry.billing_record_id ?? undefined,
        billingStatus: entry.billing_status,
        date: entry.entry_date,
        description: entry.description ?? "",
        endTime: entry.end_time ?? "",
        id: entry.id,
        minutes: entry.minutes,
        revision: entry.revision,
        startTime: entry.start_time ?? "",
        updatedAt: entry.updated_at ?? undefined,
      })),
    } : undefined,
    resourceIds: Array.isArray(row.resource_ids) ? row.resource_ids : [],
    schedule: row.schedule && typeof row.schedule === "object" ? row.schedule : {},
    seriesExcludedDates: Array.isArray(row.series_excluded_dates) ? row.series_excluded_dates : [],
    seriesMasterId: row.series_master_id ?? undefined,
    seriesOccurrenceDate: row.series_occurrence_date ?? undefined,
    serviceDiscounts: row.service_discounts && typeof row.service_discounts === "object" ? row.service_discounts : {},
    serviceIds: Array.isArray(row.service_ids) ? row.service_ids : [],
    serviceQuantities: row.service_quantities && typeof row.service_quantities === "object" ? row.service_quantities : {},
    startDate: row.start_date ?? undefined,
    status: row.status ?? "geplant",
    statusUpdatedAt: row.status_updated_at ?? undefined,
    title: row.title,
    type: row.type ?? "",
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
    workMinutes: row.work_minutes ?? 0,
  };
}

function accountingAccountToRow(account: JsonObject) {
  return {
    account: stringOrEmpty(account.account),
    archived: Boolean(account.archived),
    category: stringOrEmpty(account.category) || "Sonstiges",
    label: stringOrEmpty(account.label) || stringOrEmpty(account.account),
  };
}

function rowToAccountingAccount(row: AccountingAccountRow) {
  return {
    account: row.account,
    archived: Boolean(row.archived),
    category: row.category,
    label: row.label,
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function inventoryLocationToRow(location: JsonObject) {
  return {
    archived: Boolean(location.archived),
    id: String(location.id),
    name: stringOrEmpty(location.name) || "Lagerort",
    note: stringOrEmpty(location.note),
    site: stringOrEmpty(location.site),
  };
}

function rowToInventoryLocation(row: InventoryLocationRow) {
  return {
    archived: Boolean(row.archived),
    id: row.id,
    name: row.name,
    note: row.note ?? "",
    site: row.site ?? "",
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function materialToRow(material: JsonObject) {
  return {
    accounting_account: stringOrEmpty(material.accountingAccount),
    archived: Boolean(material.archived),
    category: stringOrEmpty(material.category),
    currency: stringOrEmpty(material.currency) || "SEK",
    description: stringOrEmpty(material.description),
    id: String(material.id),
    max_stock: numberOrNull(material.maxStock),
    min_stock: numberOrNull(material.minStock),
    name: stringOrEmpty(material.name) || "Material",
    primary_location_id: nullableString(material.primaryLocation),
    purchase_price: numberOrNull(material.purchasePrice),
    sales_price: numberOrNull(material.price),
    sku: stringOrEmpty(material.sku),
    supplier: stringOrEmpty(material.supplier),
    tax_rate: numberOrNull(material.taxRate),
    unit: stringOrEmpty(material.unit),
  };
}

function movementToRow(materialId: string, movement: JsonObject) {
  return {
    billable_as_service: Boolean(movement.billableAsService),
    changes: Array.isArray(movement.changes) ? movement.changes : [],
    counted_quantity: numberOrNull(movement.countedQuantity),
    created_at: nullableString(movement.createdAt) ?? new Date().toISOString(),
    customer_id: nullableString(movement.customerId),
    id: String(movement.id),
    location_id: nullableString(movement.location),
    material_id: materialId,
    movement_type: stringOrEmpty(movement.type) || "Eingang",
    note: stringOrEmpty(movement.note),
    purchase_gross: numberOrNull(movement.purchaseGross),
    purchase_net: numberOrNull(movement.purchaseNet),
    purchase_tax_amount: numberOrNull(movement.purchaseTaxAmount),
    purchase_tax_rate: numberOrNull(movement.purchaseTaxRate),
    quantity: numberOrNull(movement.quantity) ?? 0,
    receipt: movement.receipt && typeof movement.receipt === "object" ? movement.receipt : null,
    service_id: nullableString(movement.serviceId),
    supplier: stringOrEmpty(movement.supplier),
    updated_at: nullableString(movement.updatedAt) ?? new Date().toISOString(),
  };
}

function rowToMaterial(row: MaterialRow, movements: InventoryMovementRow[]) {
  return {
    accountingAccount: row.accounting_account ?? "",
    archived: Boolean(row.archived),
    category: row.category ?? "",
    currency: row.currency ?? "SEK",
    description: row.description ?? "",
    id: row.id,
    inventoryEntries: movements
      .filter((movement) => movement.material_id === row.id)
      .map((movement) => ({
        billableAsService: Boolean(movement.billable_as_service),
        changes: Array.isArray(movement.changes) ? movement.changes : [],
        countedQuantity: movement.counted_quantity ?? undefined,
        createdAt: movement.created_at ?? "",
        customerId: movement.customer_id ?? undefined,
        id: movement.id,
        location: movement.location_id ?? "",
        note: movement.note ?? "",
        purchaseGross: movement.purchase_gross === null ? undefined : String(movement.purchase_gross),
        purchaseNet: movement.purchase_net === null ? undefined : String(movement.purchase_net),
        purchasePrice: movement.purchase_net === null ? undefined : String(movement.purchase_net),
        purchaseTaxAmount: movement.purchase_tax_amount === null ? undefined : String(movement.purchase_tax_amount),
        purchaseTaxRate: movement.purchase_tax_rate === null ? undefined : String(movement.purchase_tax_rate),
        quantity: movement.quantity,
        receipt: movement.receipt && typeof movement.receipt === "object" ? movement.receipt : undefined,
        serviceId: movement.service_id ?? undefined,
        supplier: movement.supplier ?? "",
        type: movement.movement_type,
        updatedAt: movement.updated_at ?? undefined,
      }))
      .sort((first, second) => String(first.createdAt).localeCompare(String(second.createdAt))),
    maxStock: row.max_stock === null ? "" : String(row.max_stock),
    minStock: row.min_stock === null ? "" : String(row.min_stock),
    name: row.name,
    price: row.sales_price === null ? "" : String(row.sales_price),
    primaryLocation: row.primary_location_id ?? "",
    purchasePrice: row.purchase_price === null ? "" : String(row.purchase_price),
    sku: row.sku ?? "",
    supplier: row.supplier ?? "",
    taxRate: row.tax_rate === null ? "" : String(row.tax_rate),
    unit: row.unit ?? "",
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function serviceToRow(service: JsonObject) {
  return {
    accounting_account: stringOrEmpty(service.accountingAccount),
    archived: Boolean(service.archived),
    category: stringOrEmpty(service.category),
    checklist: Array.isArray(service.checklist) ? service.checklist : [],
    currency: stringOrEmpty(service.currency) || "SEK",
    description: stringOrEmpty(service.description),
    id: String(service.id),
    name: stringOrEmpty(service.name) || "Leistung",
    price: numberOrNull(service.price),
    show_work_time_in_reports: Boolean(service.showWorkTimeInReports),
    tax_rate: numberOrNull(service.taxRate),
    unit: stringOrEmpty(service.unit),
  };
}

function rowToService(row: ServiceRow) {
  return {
    accountingAccount: row.accounting_account ?? "",
    archived: Boolean(row.archived),
    category: row.category ?? "",
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    currency: row.currency ?? "SEK",
    description: row.description ?? "",
    id: row.id,
    name: row.name,
    price: row.price === null ? "" : String(row.price),
    showWorkTimeInReports: Boolean(row.show_work_time_in_reports),
    taxRate: row.tax_rate === null ? "" : String(row.tax_rate),
    unit: row.unit ?? "",
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function packageToRow(servicePackage: JsonObject) {
  return {
    archived: Boolean(servicePackage.archived),
    description: stringOrEmpty(servicePackage.description),
    id: String(servicePackage.id),
    name: stringOrEmpty(servicePackage.name) || "Paket",
    price: numberOrNull(servicePackage.price),
    service_ids: Array.isArray(servicePackage.serviceIds) ? servicePackage.serviceIds : [],
  };
}

function rowToPackage(row: ServicePackageRow) {
  return {
    archived: Boolean(row.archived),
    description: row.description ?? "",
    id: row.id,
    name: row.name,
    price: row.price === null ? "" : String(row.price),
    serviceIds: Array.isArray(row.service_ids) ? row.service_ids : [],
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    revision: row.revision,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToBilling(row: BillingRow) {
  return {
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    amount: row.amount === null ? "" : String(row.amount),
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    customerId: row.customer_id ?? "",
    dueDate: row.due_date ?? undefined,
    externalExportStatus: row.external_export_status ?? undefined,
    externalExportSystem: row.external_export_system ?? undefined,
    externalExportedAt: row.external_exported_at ?? undefined,
    id: row.id,
    invoiceDate: row.invoice_date ?? undefined,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceStatus: row.invoice_status ?? undefined,
    invoicedAt: row.invoiced_at ?? undefined,
    jobId: row.job_id ?? undefined,
    label: row.label,
    lines: Array.isArray(row.lines) ? row.lines : [],
    notes: row.notes ?? "",
    objectId: row.object_id ?? "",
    outgoingBookNumber: row.outgoing_book_number ?? undefined,
    paidAt: row.paid_at ?? undefined,
    reportId: row.report_id ?? undefined,
    sentAt: row.sent_at ?? undefined,
    serviceDate: row.service_date ?? undefined,
    source: row.source ?? "",
    status: row.status ?? "abrechenbar",
    revision: row.revision ?? 1,
    updatedAt: row.updated_at ?? undefined,
  };
}

function portalMessageToRow(message: JsonObject) {
  return {
    created_at: nullableString(message.createdAt) ?? new Date().toISOString(),
    customer_id: nullableString(message.customerId),
    delivery_error: stringOrEmpty(message.deliveryError),
    delivery_status: stringOrEmpty(message.deliveryStatus),
    id: String(message.id),
    message: stringOrEmpty(message.message),
    object_id: nullableString(message.objectId),
    origin: stringOrEmpty(message.origin),
    replies: Array.isArray(message.replies) ? message.replies : [],
    sent_at: nullableString(message.sentAt),
    status: stringOrEmpty(message.status) || "neu",
    subject: stringOrEmpty(message.subject) || "Nachricht",
  };
}

function rowToPortalMessage(row: PortalMessageRow) {
  return {
    ...(row.record_data && typeof row.record_data === "object" ? row.record_data as JsonObject : {}),
    createdAt: row.created_at ?? "",
    customerId: row.customer_id ?? "",
    deliveryError: row.delivery_error ?? undefined,
    deliveryStatus: row.delivery_status ?? undefined,
    id: row.id,
    message: row.message,
    objectId: row.object_id ?? "",
    origin: row.origin ?? undefined,
    replies: Array.isArray(row.replies) ? row.replies : [],
    sentAt: row.sent_at ?? undefined,
    status: row.status ?? "neu",
    subject: row.subject,
    reportId: row.report_id ?? undefined,
    revision: row.revision,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function rowToTranslation(row: TranslationRow) {
  return {
    de: row.de,
    deletedAt: row.deleted_at ?? undefined,
    en: row.en,
    key: row.key,
    revision: row.revision,
    sv: row.sv,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToResource(row: ResourceRow, trips: VehicleTripRow[], mediaRows: MediaRow[] = []) {
  const media = mediaRows.filter((item) => item.owner_id === row.id).map(rowToMedia);
  const tracking = row.tracking && typeof row.tracking === "object" && !Array.isArray(row.tracking) ? row.tracking as JsonObject : {};
  return {
    archived: Boolean(row.archived),
    brand: row.brand ?? "",
    buildYear: row.build_year ?? undefined,
    currentOdometer: row.current_odometer === null ? "" : String(row.current_odometer),
    currentOdometerDate: row.current_odometer_date ?? "",
    defaultDriverId: row.default_driver_id ?? "",
    deletedAt: row.deleted_at ?? undefined,
    deletedLogbookEntryIds: Array.isArray(row.deleted_logbook_entry_ids) ? row.deleted_logbook_entry_ids : [],
    identifier: row.identifier ?? "",
    licensePlate: row.license_plate ?? "",
    location: row.location ?? "",
    logbookActive: row.logbook_active !== false,
    logbookLanguage: ["de", "sv", "en"].includes(stringOrEmpty(tracking.logbookLanguage)) ? stringOrEmpty(tracking.logbookLanguage) : undefined,
    logbook: trips
      .filter((trip) => trip.resource_id === row.id)
      .map(rowToTrip)
      .sort((first, second) => `${first.date}-${first.id}`.localeCompare(`${second.date}-${second.id}`)),
    logbookYear: row.logbook_year ?? "",
    maintenanceItems: Array.isArray(row.maintenance_items) ? row.maintenance_items : [],
    media,
    model: row.model ?? "",
    name: row.name,
    notes: row.notes ?? "",
    odometerYearEnd: row.odometer_year_end === null ? "" : String(row.odometer_year_end),
    odometerYearStart: row.odometer_year_start === null ? "" : String(row.odometer_year_start),
    odometerHistory: Array.isArray(row.odometer_history) ? row.odometer_history : [],
    odometerLastConfirmed: row.odometer_last_confirmed === null ? "" : String(row.odometer_last_confirmed),
    odometerLastConfirmedAt: row.odometer_last_confirmed_at ?? undefined,
    odometerLastConfirmedBy: row.odometer_last_confirmed_by ?? undefined,
    odometerLastConfirmedPhoto: row.odometer_last_confirmed_photo && typeof row.odometer_last_confirmed_photo === "object" ? row.odometer_last_confirmed_photo : undefined,
    ownerCompany: row.owner_company ?? "",
    privateUseAllowed: row.private_use_allowed !== false,
    registrationCountry: row.registration_country ?? "",
    revision: row.revision,
    responsiblePersonId: row.responsible_person_id ?? "",
    status: row.status ?? "",
    standardTrips: Array.isArray(row.standard_trips) ? row.standard_trips : [],
    taxCountry: row.tax_country ?? "",
    tracking: Object.keys(tracking).length > 0 ? tracking : undefined,
    type: row.type,
    id: row.id,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function loadResourceSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: resourceRows, error: resourceError } = await supabase
    .from("homecare_resources")
    .select("id, type, brand, build_year, current_odometer, current_odometer_date, default_driver_id, name, identifier, license_plate, status, responsible_person_id, location, logbook_active, notes, logbook_year, model, odometer_year_start, odometer_year_end, odometer_history, odometer_last_confirmed, odometer_last_confirmed_at, odometer_last_confirmed_by, odometer_last_confirmed_photo, owner_company, private_use_allowed, registration_country, tax_country, tracking, maintenance_items, standard_trips, deleted_logbook_entry_ids, archived, revision, deleted_at, updated_at")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (resourceError) throw new Error(resourceError.message);

  const { data: tripRows, error: tripError } = await supabase
    .from("homecare_vehicle_trips")
    .select("id, resource_id, trip_date, driver_id, status, started_at, ended_at, trip_type, trip_category, rule_country, rule_version, rule_title, start_address, start_address_resolved, end_address, end_address_resolved, start_coordinates, end_coordinates, waypoints, start_odometer, end_odometer, kilometers, purpose, visited, fuel_or_charge, fuel_receipt_photo, odometer_photos, validation_warnings, audit_log, notes, revision, deleted_at, updated_at")
    .is("deleted_at", null)
    .order("trip_date", { ascending: true });

  if (tripError) throw new Error(tripError.message);

  const mediaRows = await loadResourceMediaRows(supabase).catch(() => []);
  const resources = (resourceRows as ResourceRow[]).map((row) => rowToResource(row, (tripRows ?? []) as VehicleTripRow[], mediaRows));
  return {
    updatedAt: maxUpdatedAt([
      ...(resourceRows as ResourceRow[]).map((row) => row.updated_at),
      ...((tripRows ?? []) as VehicleTripRow[]).map((row) => row.updated_at),
    ]),
    value: resources,
  };
}

async function loadReportsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const [{ data, error }, { data: mediaData, error: mediaError }] = await Promise.all([
    supabase
    .from("homecare_reports")
    .select("id, job_id, object_id, customer_id, title, report_date, visible_to_customer, summary, internal_notes, customer_comment, checklist_results, media_ids, attachments, sent_at, record_data, revision, deleted_at, updated_at")
    .order("report_date", { ascending: true }),
    supabase.from("homecare_media").select("id, owner_id, kind, name, storage_path, preview_url, metadata, revision, deleted_at, created_at").eq("owner_type", "report"),
  ]);

  if (error) throw new Error(error.message);
  if (mediaError) throw new Error(mediaError.message);
  const media = (mediaData ?? []) as Array<{ id: string; owner_id: string; kind: string; name: string; storage_path: string | null; preview_url: string | null; metadata: unknown; revision: number; deleted_at: string | null; created_at: string }>;
  const value = ((data ?? []) as ReportRow[]).filter((row) => !row.deleted_at).map((row) => {
    const report = rowToReport(row) as JsonObject;
    const reportMedia = media.filter((item) => item.owner_id === row.id && !item.deleted_at);
    const attachments = reportMedia.filter((item) => item.kind === "attachment").map((item) => ({
      ...(item.metadata && typeof item.metadata === "object" ? item.metadata as JsonObject : {}), id: item.id, name: item.name,
      storagePath: item.storage_path ?? undefined, storageUrl: item.preview_url ?? undefined, createdAt: item.created_at, revision: item.revision,
    }));
    const checklistResults = (Array.isArray(report.checklistResults) ? report.checklistResults : []).map((task) => {
      if (!task || typeof task !== "object") return task;
      const taskId = String((task as JsonObject).id ?? "");
      const photos = reportMedia.filter((item) => item.kind === "checklist_photo" && (item.metadata as JsonObject | null)?.taskId === taskId).map((item) => ({
        ...(item.metadata && typeof item.metadata === "object" ? item.metadata as JsonObject : {}), id: item.id, name: item.name,
        storagePath: item.storage_path ?? undefined, previewUrl: item.preview_url ?? undefined, revision: item.revision,
      }));
      return { ...(task as JsonObject), photos };
    });
    return { ...report, attachments, checklistResults };
  });
  return {
    deletedReportIds: ((data ?? []) as ReportRow[]).filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt([...(data as ReportRow[]).map((row) => row.updated_at), ...media.map((row) => row.created_at)]),
    value,
  };
}

async function loadFieldProgressSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_field_progress")
    .select("id, job_id, work_date, task_id, completed, minutes, show_work_time_in_report, note, photos, revision, deleted_at, updated_at")
    .order("updated_at", { ascending: true });

  if (error) throw new Error(error.message);

  const value = (data as FieldProgressRow[]).filter((row) => !row.deleted_at).reduce<Record<string, Record<string, JsonObject>>>((progress, row) => {
    const progressKey = progressKeyFromRow(row);
    progress[progressKey] = progress[progressKey] ?? {};
    progress[progressKey][row.task_id] = {
      completed: Boolean(row.completed),
      minutes: row.minutes === null ? "" : String(row.minutes),
      note: row.note ?? "",
      photos: Array.isArray(row.photos) ? row.photos : [],
      showWorkTimeInReport: row.show_work_time_in_report !== false,
      revision: row.revision,
      updatedAt: row.updated_at ?? undefined,
    };
    return progress;
  }, {});

  return {
    deletedProgressIds: (data as FieldProgressRow[]).filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt((data as FieldProgressRow[]).map((row) => row.updated_at)),
    value,
  };
}

async function loadJobNotesSections(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_job_notes")
    .select("id,job_id,work_date,note,revision,deleted_at,updated_at")
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as JobNoteRow[];
  const liveRows = rows.filter((row) => !row.deleted_at);
  const key = (row: JobNoteRow) => row.work_date ? `${row.job_id}::${row.work_date}` : row.job_id;
  return {
    deletedNoteKeys: rows.filter((row) => row.deleted_at).map(key),
    fieldNotes: { updatedAt: maxUpdatedAt(rows.map((row) => row.updated_at)), value: Object.fromEntries(liveRows.map((row) => [key(row), row.note])) },
    jobNoteMeta: { updatedAt: maxUpdatedAt(rows.map((row) => row.updated_at)), value: Object.fromEntries(liveRows.map((row) => [key(row), { revision: row.revision, updatedAt: row.updated_at ?? undefined }])) },
  };
}

async function loadObjectsRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_objects")
    .select("id, owner_customer_id, name, owner_name, owner_email, owner_phone, owner_address, address, billing_address_mode, billing_address, region, size_sqm, plot_sqm, rooms, beds, bathrooms, build_year, care_package, status, key_safe, alarm, parking, access_notes, heating, water, septic, internet, equipment, risks, next_visit, last_visit, archived, object_type, custom_fields, revision, deleted_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ObjectRow[];
}

async function loadObjectMediaRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_media")
    .select("id, owner_id, kind, name, description, source, storage_path, preview_url, is_primary, revision, deleted_at, updated_at")
    .eq("owner_type", "object")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

async function loadResourceMediaRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_media")
    .select("id, owner_id, kind, name, description, source, storage_path, preview_url, is_primary, revision, deleted_at, updated_at")
    .eq("owner_type", "resource")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

async function loadCustomersSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const [{ data, error }, { data: contactData, error: contactError }, objectRows] = await Promise.all([
    supabase
      .from("homecare_customers")
      .select("id, personal_number, company_name, name, address, billing_address, billing_address_mode, language, portal_login_email, portal_status, balance, notes, report_mail_body, weekly_report_mail_body, offer_mail_body, order_confirmation_mail_body, work_time_visibility, billable, archived, portal_login_history, revision, deleted_at, created_at, updated_at")
      .order("name", { ascending: true }),
    supabase
      .from("homecare_customer_contacts")
      .select("id, customer_id, name, role, email, phone, phone2, notes, is_primary, revision, deleted_at, created_at, updated_at")
      .order("created_at", { ascending: true }),
    loadObjectsRows(supabase).catch(() => []),
  ]);
  if (error) throw new Error(error.message);
  if (contactError) throw new Error(contactError.message);
  const customerRows = (data ?? []) as CustomerRow[];
  const contactRows = (contactData ?? []) as CustomerContactRow[];
  return {
    deletedCustomerIds: customerRows.filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt([
      ...customerRows.map((row) => row.updated_at),
      ...contactRows.map((row) => row.updated_at),
    ]),
    value: customerRows.filter((row) => !row.deleted_at).map((row) => rowToCustomer(row, objectRows, contactRows)),
  };
}

async function loadObjectsSection(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  storageClient: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const objectRows = await loadObjectsRows(supabase);
  const mediaRows = await loadObjectMediaRows(supabase).catch(() => []);
  const liveObjectIds = new Set(objectRows.filter((row) => !row.deleted_at).map((row) => row.id));
  const ownedMediaRows = mediaRows.filter((row) => liveObjectIds.has(row.owner_id));
  const storagePaths = objectMediaPathsToSign(ownedMediaRows, tenantId);
  let signedUrls = new Map<string, string>();
  if (storagePaths.length > 0) {
    const { data } = await storageClient.storage
      .from("homecare-private-media")
      .createSignedUrls(storagePaths, objectMediaSignedUrlTtlSeconds);
    signedUrls = new Map((data ?? []).flatMap((item) => (
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []
    )));
  }
  const projectedMediaRows = applyObjectMediaSignedUrls(ownedMediaRows, tenantId, signedUrls);
  return {
    deletedObjectIds: objectRows.filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt([...objectRows.map((row) => row.updated_at), ...mediaRows.map((row) => row.updated_at)]),
    value: objectRows.filter((row) => !row.deleted_at).map((row) => rowToObject(row, projectedMediaRows)),
  };
}

async function loadPersonnelSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_personnel")
    .select("id, personnel_number, first_name, last_name, role, email, phone, language, status, notes, archived, record_data, revision, deleted_at, created_at, updated_at")
    .order("last_name", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    updatedAt: maxUpdatedAt((data as PersonnelRow[]).map((row) => row.updated_at)),
    value: ((data ?? []) as PersonnelRow[]).filter((row) => !row.deleted_at).map(rowToPersonnel),
  };
}

async function loadJobsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const [{ data, error }, { data: timeData, error: timeError }] = await Promise.all([
    supabase.from("homecare_jobs")
      .select("id, series_master_id, series_occurrence_date, title, object_id, customer_id, type, status, status_updated_at, priority, due_date, start_date, end_date, execution_date, assigned_to, description, internal_notes, billable, material, work_minutes, resource_ids, material_items, checklist, service_ids, service_quantities, service_discounts, custom_service, discount, schedule, execution_log, offer_number, offer_sent_at, order_confirmation_number, order_confirmation_sent_at, series_excluded_dates, record_data, consulting, revision, deleted_at, updated_at")
      .order("due_date", { ascending: true }),
    supabase.from("homecare_job_time_entries")
      .select("id,job_id,entry_date,start_time,end_time,minutes,description,billing_status,billed_at,billing_record_id,revision,deleted_at,updated_at")
      .order("entry_date", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (timeError) throw new Error(timeError.message);
  const rows = (data ?? []) as JobRow[];
  const timeRows = (timeData ?? []) as JobTimeEntryRow[];
  return {
    deletedJobIds: rows.filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt([...rows.map((row) => row.updated_at), ...timeRows.map((row) => row.updated_at)]),
    value: rows.filter((row) => !row.deleted_at).map((row) => rowToJob(row, timeRows)),
  };
}

async function loadAccountingAccountsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_accounting_accounts")
    .select("account, category, label, archived, record_data, revision, deleted_at, updated_at")
    .order("account", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    updatedAt: maxUpdatedAt((data as AccountingAccountRow[]).map((row) => row.updated_at)),
    value: ((data ?? []) as AccountingAccountRow[]).filter((row) => !row.deleted_at).map(rowToAccountingAccount),
  };
}

async function loadInventoryLocationsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_inventory_locations")
    .select("id, name, site, note, archived, record_data, revision, deleted_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    updatedAt: maxUpdatedAt((data as InventoryLocationRow[]).map((row) => row.updated_at)),
    value: ((data ?? []) as InventoryLocationRow[]).filter((row) => !row.deleted_at).map(rowToInventoryLocation),
  };
}

async function loadMaterialsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: materialRows, error } = await supabase
    .from("homecare_materials")
    .select("id, accounting_account, sku, name, category, unit, sales_price, purchase_price, currency, tax_rate, supplier, primary_location_id, min_stock, max_stock, description, archived, record_data, revision, deleted_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: movementRows, error: movementError } = await supabase
    .from("homecare_inventory_movements")
    .select("id, material_id, location_id, movement_type, quantity, counted_quantity, note, supplier, purchase_gross, purchase_net, purchase_tax_rate, purchase_tax_amount, customer_id, service_id, billable_as_service, receipt, changes, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (movementError) throw new Error(movementError.message);

  const { data: cutovers, error: cutoverError } = await supabase.from("homecare_stock_cutovers").select("tenant_id");
  if (cutoverError && !["42P01", "PGRST205"].includes(cutoverError.code)) throw new Error(cutoverError.message);
  const stock = new Map<string, { total: number; locations: Record<string, number> }>();
  if (cutovers?.length) {
    // Use the authenticated client's RLS, and page aggregated location balances.
    const { data: locationRows, error: locationError } = await supabase.from("homecare_inventory_locations").select("id,name");
    if (locationError) throw new Error(locationError.message);
    const names = new Map((locationRows ?? []).map((r) => [r.id, r.name]));
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.rpc("homecare_stock_summary").range(offset, offset + 499);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const current = stock.get(row.material_id) ?? { total: 0, locations: Object.create(null) as Record<string, number> };
        const quantity = Number(row.quantity);
        current.total += quantity;
        const location = names.get(row.location_id) ?? row.location_id;
        current.locations[location] = (Object.hasOwn(current.locations, location) ? current.locations[location] : 0) + quantity;
        stock.set(row.material_id, current);
      }
      if (!data || data.length < 500) break;
    }
  }

  return {
    updatedAt: maxUpdatedAt([
      ...(materialRows as MaterialRow[]).map((row) => row.updated_at),
      ...((movementRows ?? []) as InventoryMovementRow[]).map((row) => row.updated_at),
    ]),
    value: ((materialRows ?? []) as MaterialRow[]).filter((row) => !row.deleted_at).map((row) => ({
      ...rowToMaterial(row, (movementRows ?? []) as InventoryMovementRow[]),
      ...(cutovers?.length ? { stockTotal: stock.get(row.id)?.total ?? 0, stockByLocation: stock.get(row.id)?.locations ?? {} } : {}),
    })),
  };
}

async function loadServicesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_services")
    .select("id, accounting_account, name, category, unit, price, currency, tax_rate, show_work_time_in_reports, description, checklist, archived, record_data, revision, deleted_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    updatedAt: maxUpdatedAt((data as ServiceRow[]).map((row) => row.updated_at)),
    value: ((data ?? []) as ServiceRow[]).filter((row) => !row.deleted_at).map(rowToService),
  };
}

async function loadPackagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_service_packages")
    .select("id, name, price, description, service_ids, archived, record_data, revision, deleted_at, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    updatedAt: maxUpdatedAt((data as ServicePackageRow[]).map((row) => row.updated_at)),
    value: ((data ?? []) as ServicePackageRow[]).filter((row) => !row.deleted_at).map(rowToPackage),
  };
}

async function loadBillingSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const [{ data, error }, { data: lineData, error: lineError }, { data: paymentData, error: paymentError }, { data: exportData, error: exportError }] = await Promise.all([
    supabase.from("homecare_billing_items").select("id, object_id, customer_id, job_id, report_id, source, label, amount, status, invoice_status, invoice_number, invoice_date, due_date, service_date, lines, notes, external_export_status, external_export_system, external_exported_at, sent_at, paid_at, cancelled_at, outgoing_book_number, invoiced_at, record_data, revision, deleted_at, created_at, updated_at").order("created_at", { ascending: true }),
    supabase.from("homecare_invoice_lines").select("id,invoice_id,accounting_account,kind,name,quantity,unit,unit_price,currency,tax_rate,discount_type,discount_value,position,record_data,revision,deleted_at,updated_at").order("position", { ascending: true }),
    supabase.from("homecare_payments").select("id,invoice_id,amount,currency,paid_at,revision,deleted_at,updated_at").order("paid_at", { ascending: false }),
    supabase.from("homecare_accounting_exports").select("id,invoice_id,system,status,exported_at,revision,deleted_at,updated_at").order("exported_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  if (lineError) throw new Error(lineError.message);
  if (paymentError) throw new Error(paymentError.message);
  if (exportError) throw new Error(exportError.message);
  const lines = (lineData ?? []) as Array<Record<string, unknown>>;
  const payments = (paymentData ?? []) as Array<Record<string, unknown>>;
  const exports = (exportData ?? []) as Array<Record<string, unknown>>;
  const value = ((data ?? []) as BillingRow[]).filter((row) => !row.deleted_at).map((row) => {
    const payment = payments.find((item) => item.invoice_id === row.id && !item.deleted_at);
    const accountingExport = exports.find((item) => item.invoice_id === row.id && !item.deleted_at);
    return {
      ...rowToBilling(row),
      lines: lines.filter((item) => item.invoice_id === row.id && !item.deleted_at).map((item) => ({
        ...(item.record_data && typeof item.record_data === "object" ? item.record_data as JsonObject : {}),
        id: item.id, accountingAccount: item.accounting_account, kind: item.kind, name: item.name,
        quantity: String(item.quantity ?? ""), unit: item.unit, unitPrice: String(item.unit_price ?? ""), currency: item.currency,
        taxRate: String(item.tax_rate ?? ""), discountType: item.discount_type, discountValue: String(item.discount_value ?? ""),
        revision: item.revision, updatedAt: item.updated_at,
      })),
      paidAt: payment?.paid_at ?? row.paid_at ?? undefined,
      paymentRevision: payment?.revision,
      externalExportStatus: accountingExport?.status ?? row.external_export_status ?? undefined,
      externalExportSystem: accountingExport?.system ?? row.external_export_system ?? undefined,
      externalExportedAt: accountingExport?.exported_at ?? row.external_exported_at ?? undefined,
      exportRevision: accountingExport?.revision,
    };
  });
  return {
    updatedAt: maxUpdatedAt([...(data ?? []).map((row) => row.updated_at), ...lines.map((row) => row.updated_at as string | null), ...payments.map((row) => row.updated_at as string | null), ...exports.map((row) => row.updated_at as string | null)]),
    value,
  };
}

async function loadPortalMessagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const [{ data, error }, { data: replyData, error: replyError }, { data: mediaData, error: mediaError }] = await Promise.all([
    supabase
    .from("homecare_portal_messages")
    .select("id, customer_id, object_id, report_id, subject, message, status, delivery_status, delivery_error, origin, replies, sent_at, record_data, revision, deleted_at, created_at, updated_at")
    .order("created_at", { ascending: true }),
    supabase.from("homecare_portal_message_replies").select("id,message_id,body,subject,recipient,delivery_status,delivery_error,sent_at,record_data,revision,deleted_at,updated_at").order("sent_at", { ascending: false }),
    supabase.from("homecare_media").select("id,owner_id,kind,name,storage_path,preview_url,metadata,revision,deleted_at,created_at").eq("owner_type", "portal_message"),
  ]);
  if (error) throw new Error(error.message);
  if (replyError) throw new Error(replyError.message);
  if (mediaError) throw new Error(mediaError.message);
  const replies = (replyData ?? []) as Array<Record<string, unknown>>;
  const media = (mediaData ?? []) as Array<Record<string, unknown>>;
  const value = ((data ?? []) as PortalMessageRow[]).filter((row) => !row.deleted_at).map((row) => ({
    ...rowToPortalMessage(row),
    attachments: media.filter((item) => item.owner_id === row.id && !item.deleted_at).map((item) => ({
      ...(item.metadata && typeof item.metadata === "object" ? item.metadata as JsonObject : {}), id: item.id, name: item.name,
      storagePath: item.storage_path ?? undefined, storageUrl: item.preview_url ?? undefined, createdAt: item.created_at, revision: item.revision,
    })),
    replies: replies.filter((item) => item.message_id === row.id && !item.deleted_at).map((item) => ({
      ...(item.record_data && typeof item.record_data === "object" ? item.record_data as JsonObject : {}), id: item.id, body: item.body,
      subject: item.subject, to: item.recipient, deliveryStatus: item.delivery_status, deliveryError: item.delivery_error,
      sentAt: item.sent_at, revision: item.revision,
    })),
  }));
  return {
    deletedMessageIds: ((data ?? []) as PortalMessageRow[]).filter((row) => row.deleted_at).map((row) => row.id),
    updatedAt: maxUpdatedAt([...(data as PortalMessageRow[]).map((row) => row.updated_at), ...replies.map((row) => row.updated_at as string | null)]),
    value,
  };
}

async function loadTranslationOverridesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_translations")
    .select("key, de, sv, en, revision, deleted_at, updated_at")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TranslationRow[];
  return {
    hasRecords: rows.length > 0,
    updatedAt: maxUpdatedAt(rows.map((row) => row.updated_at)),
    value: rows.filter((row) => !row.deleted_at).map(rowToTranslation),
  };
}

async function loadAuthoritativeSettingsSections(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  keys: SyncSectionKey[],
) {
  const settingKeys = keys.filter((key) => key === "companySettings" || key === "dailyMailSettings");
  if (!settingKeys.length) return {};
  const { data, error } = await supabase
    .from("homecare_settings")
    .select("key, value, revision, deleted_at, updated_at")
    .in("key", settingKeys);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as SettingRow[]).map((row) => [row.key, {
    hasRecord: true,
    updatedAt: row.updated_at,
    value: row.deleted_at
      ? null
      : { ...(row.value && typeof row.value === "object" && !Array.isArray(row.value) ? row.value as JsonObject : {}), revision: row.revision, updatedAt: row.updated_at },
  }]));
}

function planFromPlanId(planId: string | null | undefined) {
  if (String(planId ?? "").startsWith("start_")) return "start";
  if (String(planId ?? "").startsWith("pro_")) return "pro";
  if (String(planId ?? "").startsWith("business_")) return "business";
  return "business";
}

async function loadTenantSettingsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, tenantId: string) {
  const { data: tenantRows, error: tenantError } = await supabase
    .from("homecare_tenants")
    .select("id, name, subscription_status, subscription_interval, settings_revision, updated_at")
    .eq("id", tenantId)
    .limit(1);
  if (tenantError || !tenantRows?.length) return null;

  const { data: subscriptionRows } = await supabase
    .from("homecare_subscriptions")
    .select("plan_id, status, interval, current_period_end, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: moduleRows } = await supabase
    .from("homecare_tenant_modules")
    .select("module, enabled, updated_at")
    .eq("tenant_id", tenantId)
    .order("module", { ascending: true });

  const tenant = (tenantRows as TenantRow[])[0];
  const subscription = ((subscriptionRows ?? []) as TenantSubscriptionRow[])[0];
  const modules = Object.fromEntries(((moduleRows ?? []) as TenantModuleRow[]).map((row) => [row.module, row.enabled !== false]));

  return {
    updatedAt: maxUpdatedAt([
      tenant.updated_at,
      subscription?.updated_at,
      ...((moduleRows ?? []) as TenantModuleRow[]).map((row) => row.updated_at),
    ]),
    value: {
      id: tenant.id,
      modules,
      name: tenant.name,
      plan: planFromPlanId(subscription?.plan_id),
      revision: tenant.settings_revision,
      subscriptionInterval: subscription?.interval ?? tenant.subscription_interval ?? "monthly",
      subscriptionStatus: subscription?.status ?? tenant.subscription_status ?? "active",
      updatedAt: tenant.updated_at,
    },
  };
}

function requestedSyncKeys(request: Request) {
  const requestedKeys = new URL(request.url).searchParams.get("keys")?.split(",")
    .map((key) => key.trim())
    .filter(isSyncSectionKey);
  return requestedKeys?.length ? requestedKeys : [...allowedSyncSections];
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  const supabase = auth.client;
  const keys = requestedSyncKeys(request);
  const sections: Record<string, unknown> = {};

  try {
    const authoritativeSettings = await loadAuthoritativeSettingsSections(supabase, keys);
    for (const key of ["companySettings", "dailyMailSettings"] as const) {
      if (!keys.includes(key)) continue;
      const relational = authoritativeSettings[key];
      sections[key] = relational
        ? { updatedAt: relational.updatedAt, value: relational.value }
        : { updatedAt: null, value: null };
    }

    if (keys.includes("accountingAccounts")) sections.accountingAccounts = await loadAccountingAccountsSection(supabase);
    if (keys.includes("billing")) sections.billing = await loadBillingSection(supabase);
    if (keys.includes("customers")) sections.customers = await loadCustomersSection(supabase);
    if (keys.includes("inventoryLocations")) sections.inventoryLocations = await loadInventoryLocationsSection(supabase);
    if (keys.includes("materials")) sections.materials = await loadMaterialsSection(supabase);
    if (keys.includes("objects")) sections.objects = await loadObjectsSection(supabase, auth.serviceClient, auth.tenantId);
    if (keys.includes("packages")) sections.packages = await loadPackagesSection(supabase);
    if (keys.includes("personnel")) sections.personnel = await loadPersonnelSection(supabase);
    if (keys.includes("portalMessages")) sections.portalMessages = await loadPortalMessagesSection(supabase);
    if (keys.includes("services")) sections.services = await loadServicesSection(supabase);
    if (keys.includes("translationOverrides")) {
      const translationSection = await loadTranslationOverridesSection(supabase);
      sections.translationOverrides = { updatedAt: translationSection.updatedAt, value: translationSection.value };
    }
    if (keys.includes("tenantSettings")) {
      sections.tenantSettings = await loadTenantSettingsSection(supabase, auth.tenantId)
        ?? { updatedAt: null, value: null };
    }
    if (keys.includes("jobs")) sections.jobs = await loadJobsSection(supabase);
    if (keys.includes("fieldProgress")) sections.fieldProgress = await loadFieldProgressSection(supabase);
    if (keys.includes("fieldNotes") || keys.includes("jobNoteMeta")) {
      const notes = await loadJobNotesSections(supabase);
      if (keys.includes("fieldNotes")) sections.fieldNotes = notes.fieldNotes;
      if (keys.includes("jobNoteMeta")) sections.jobNoteMeta = notes.jobNoteMeta;
    }
    if (keys.includes("reports")) sections.reports = await loadReportsSection(supabase);
    if (keys.includes("resources")) sections.resources = await loadResourceSection(supabase);

    return NextResponse.json(
      { data: sections, legacyFallback: false },
      { headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "X-WorkCore-Legacy-Fallback": "none",
      } },
    );
  } catch (error) {
    return NextResponse.json(
      { data: {}, error: error instanceof Error ? error.message : "Sync-Bereiche konnten nicht geladen werden.", retry: true },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ error: "SYNC_SECTION_WRITES_RETIRED" }, { status: 410 });
}
