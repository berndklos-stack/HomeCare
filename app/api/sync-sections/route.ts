import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedSyncSections = [
  "accountingAccounts",
  "activeJobId",
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
  kilometers: number | null;
  notes: string | null;
  odometer_photos: unknown;
  purpose: string | null;
  resource_id: string;
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

type CustomerRow = {
  address: string | null;
  archived: boolean | null;
  balance: number | null;
  billable: boolean | null;
  billing_address: string | null;
  billing_address_mode: string | null;
  company_name: string | null;
  contact: string | null;
  created_at: string | null;
  email: string | null;
  id: string;
  language: string | null;
  name: string;
  notes: string | null;
  offer_mail_body: string | null;
  order_confirmation_mail_body: string | null;
  personal_number: string | null;
  phone: string | null;
  phone2: string | null;
  portal_login_email: string | null;
  portal_login_history: unknown;
  portal_password: string | null;
  portal_status: string | null;
  report_mail_body: string | null;
  updated_at: string | null;
  weekly_report_mail_body: string | null;
  work_time_visibility: string | null;
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
  updated_at: string | null;
  water: string | null;
};

type MediaRow = {
  description: string | null;
  id: string;
  is_primary: boolean | null;
  kind: string;
  name: string;
  owner_id: string;
  preview_url: string | null;
  source: string | null;
  storage_path: string | null;
};

type PersonnelRow = {
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
  role: string | null;
  status: string | null;
  updated_at: string | null;
};

type JobRow = {
  assigned_to: string | null;
  billable: boolean | null;
  checklist: unknown;
  custom_service: unknown;
  customer_id: string | null;
  description: string | null;
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

type AccountingAccountRow = {
  account: string;
  archived: boolean | null;
  category: string;
  label: string;
  updated_at: string | null;
};

type InventoryLocationRow = {
  archived: boolean | null;
  id: string;
  name: string;
  note: string | null;
  site: string | null;
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
  updated_at: string | null;
};

type ServicePackageRow = {
  archived: boolean | null;
  description: string | null;
  id: string;
  name: string;
  price: number | null;
  service_ids: unknown;
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
  job_id: string | null;
  label: string;
  lines: unknown;
  notes: string | null;
  object_id: string | null;
  paid_at: string | null;
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
};

type TranslationRow = {
  de: string;
  en: string;
  key: string;
  sv: string;
  updated_at: string | null;
};

type SettingRow = {
  key: string;
  updated_at: string | null;
  value: unknown;
};

type TenantRow = {
  id: string;
  name: string;
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

const defaultTenantId = "00000000-0000-0000-0000-000000000001";

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

function resourceToRow(resource: JsonObject) {
  const tracking = resource.tracking && typeof resource.tracking === "object" && !Array.isArray(resource.tracking)
    ? resource.tracking as JsonObject
    : {};
  return {
    archived: Boolean(resource.archived),
    brand: stringOrEmpty(resource.brand),
    build_year: resource.buildYear ? String(resource.buildYear) : null,
    current_odometer: numberOrNull(resource.currentOdometer),
    current_odometer_date: stringOrEmpty(resource.currentOdometerDate) || null,
    default_driver_id: resource.defaultDriverId ? String(resource.defaultDriverId) : null,
    deleted_logbook_entry_ids: Array.isArray(resource.deletedLogbookEntryIds) ? resource.deletedLogbookEntryIds : [],
    identifier: stringOrEmpty(resource.identifier),
    license_plate: stringOrEmpty(resource.licensePlate),
    location: stringOrEmpty(resource.location),
    logbook_active: resource.logbookActive !== false,
    logbook_year: stringOrEmpty(resource.logbookYear),
    maintenance_items: Array.isArray(resource.maintenanceItems) ? resource.maintenanceItems : [],
    model: stringOrEmpty(resource.model),
    name: stringOrEmpty(resource.name) || "Ressource",
    notes: stringOrEmpty(resource.notes),
    odometer_history: Array.isArray(resource.odometerHistory) ? resource.odometerHistory : [],
    odometer_last_confirmed: numberOrNull(resource.odometerLastConfirmed),
    odometer_last_confirmed_at: stringOrEmpty(resource.odometerLastConfirmedAt) || null,
    odometer_last_confirmed_by: resource.odometerLastConfirmedBy ? String(resource.odometerLastConfirmedBy) : null,
    odometer_last_confirmed_photo: resource.odometerLastConfirmedPhoto && typeof resource.odometerLastConfirmedPhoto === "object" ? resource.odometerLastConfirmedPhoto : null,
    odometer_year_end: numberOrNull(resource.odometerYearEnd),
    odometer_year_start: numberOrNull(resource.odometerYearStart),
    owner_company: stringOrEmpty(resource.ownerCompany),
    private_use_allowed: resource.privateUseAllowed !== false,
    registration_country: stringOrEmpty(resource.registrationCountry),
    responsible_person_id: resource.responsiblePersonId ? String(resource.responsiblePersonId) : null,
    status: stringOrEmpty(resource.status),
    standard_trips: Array.isArray(resource.standardTrips) ? resource.standardTrips : [],
    tax_country: stringOrEmpty(resource.taxCountry),
    tracking: {
      ...tracking,
      logbookLanguage: stringOrEmpty(resource.logbookLanguage),
    },
    type: stringOrEmpty(resource.type) || "Fahrzeug",
    id: String(resource.id),
  };
}

function tripToRow(resourceId: string, trip: JsonObject) {
  return {
    audit_log: Array.isArray(trip.auditLog) ? trip.auditLog : [],
    driver_id: trip.driverId ? String(trip.driverId) : null,
    end_address: stringOrEmpty(trip.endAddress),
    end_address_resolved: stringOrEmpty(trip.endAddressResolved),
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
    rule_country: stringOrEmpty(trip.ruleCountry),
    rule_title: stringOrEmpty(trip.ruleTitle),
    rule_version: stringOrEmpty(trip.ruleVersion),
    start_address: stringOrEmpty(trip.startAddress),
    start_address_resolved: stringOrEmpty(trip.startAddressResolved),
    start_coordinates: trip.startCoordinates && typeof trip.startCoordinates === "object" ? trip.startCoordinates : null,
    start_odometer: numberOrNull(trip.startOdometer),
    started_at: trip.startedAt ? String(trip.startedAt) : null,
    status: stringOrEmpty(trip.status) || "abgeschlossen",
    trip_category: stringOrEmpty(trip.tripCategory),
    trip_date: stringOrEmpty(trip.date) || new Date().toISOString().slice(0, 10),
    trip_type: stringOrEmpty(trip.tripType) || "Dienstfahrt",
    updated_at: new Date().toISOString(),
    validation_warnings: Array.isArray(trip.validationWarnings) ? trip.validationWarnings : [],
    visited: stringOrEmpty(trip.visited),
    waypoints: Array.isArray(trip.waypoints) ? trip.waypoints : [],
  };
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
    kilometers: row.kilometers === null ? "" : String(row.kilometers),
    notes: row.notes ?? "",
    odometerPhotos: Array.isArray(row.odometer_photos) ? row.odometer_photos : [],
    purpose: row.purpose ?? "",
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

function customerToRow(customer: JsonObject) {
  return {
    address: stringOrEmpty(customer.address),
    archived: Boolean(customer.archived),
    balance: numberOrNull(customer.balance) ?? 0,
    billable: customer.billable !== false,
    billing_address: stringOrEmpty(customer.billingAddress),
    billing_address_mode: stringOrEmpty(customer.billingAddressMode) || "Kundenadresse",
    company_name: stringOrEmpty(customer.company),
    contact: stringOrEmpty(customer.contact),
    created_at: nullableString(customer.createdAt),
    email: stringOrEmpty(customer.email),
    id: String(customer.id),
    language: stringOrEmpty(customer.language) || "Deutsch",
    name: stringOrEmpty(customer.name) || "Unbenannter Kunde",
    notes: stringOrEmpty(customer.notes),
    offer_mail_body: stringOrEmpty(customer.offerMailBody),
    order_confirmation_mail_body: stringOrEmpty(customer.orderConfirmationMailBody),
    personal_number: stringOrEmpty(customer.personalNumber),
    phone: stringOrEmpty(customer.phone),
    phone2: stringOrEmpty(customer.phone2),
    portal_login_email: stringOrEmpty(customer.portalLoginEmail),
    portal_login_history: Array.isArray(customer.portalLoginHistory) ? customer.portalLoginHistory : [],
    portal_password: stringOrEmpty(customer.portalPassword),
    portal_status: stringOrEmpty(customer.portalStatus) || "einladen",
    report_mail_body: stringOrEmpty(customer.reportMailBody),
    weekly_report_mail_body: stringOrEmpty(customer.weeklyReportMailBody),
    work_time_visibility: stringOrEmpty(customer.workTimeVisibility) || "service",
  };
}

function rowToCustomer(row: CustomerRow, objectRows: ObjectRow[]) {
  return {
    address: row.address ?? "",
    archived: Boolean(row.archived),
    balance: row.balance === null ? "0" : String(row.balance),
    billable: row.billable !== false,
    billingAddress: row.billing_address ?? "",
    billingAddressMode: row.billing_address_mode ?? "Kundenadresse",
    company: row.company_name ?? "",
    contact: row.contact ?? "",
    createdAt: row.created_at ?? undefined,
    email: row.email ?? "",
    id: row.id,
    language: row.language ?? "Deutsch",
    name: row.name,
    notes: row.notes ?? "",
    objects: objectRows.filter((object) => object.owner_customer_id === row.id).map((object) => object.id),
    offerMailBody: row.offer_mail_body ?? "",
    orderConfirmationMailBody: row.order_confirmation_mail_body ?? "",
    personalNumber: row.personal_number ?? "",
    phone: row.phone ?? "",
    phone2: row.phone2 ?? "",
    portalLoginEmail: row.portal_login_email ?? "",
    portalLoginHistory: Array.isArray(row.portal_login_history) ? row.portal_login_history : [],
    portalPassword: row.portal_password ?? "",
    portalStatus: row.portal_status ?? "einladen",
    reportMailBody: row.report_mail_body ?? "",
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
    isPrimary: Boolean(row.is_primary),
    name: row.name,
    previewUrl: row.preview_url ?? undefined,
    source: row.source ?? "Upload",
    storagePath: row.storage_path ?? undefined,
    type: row.kind,
  };
}

function objectToRow(object: JsonObject) {
  const access = object.access && typeof object.access === "object" && !Array.isArray(object.access) ? object.access as JsonObject : {};
  const utilities = object.utilities && typeof object.utilities === "object" && !Array.isArray(object.utilities) ? object.utilities as JsonObject : {};
  return {
    access_notes: stringOrEmpty(access.notes),
    address: stringOrEmpty(object.address),
    alarm: stringOrEmpty(access.alarm),
    archived: Boolean(object.archived),
    bathrooms: numberOrNull(object.bathrooms),
    beds: numberOrNull(object.beds),
    billing_address: stringOrEmpty(object.billingAddress),
    billing_address_mode: stringOrEmpty(object.billingAddressMode) || "Objektadresse",
    build_year: numberOrNull(object.buildYear),
    care_package: stringOrEmpty(object.carePackage),
    equipment: Array.isArray(object.equipment) ? object.equipment : [],
    heating: stringOrEmpty(utilities.heating),
    id: String(object.id),
    internet: stringOrEmpty(utilities.internet),
    key_safe: stringOrEmpty(access.keySafe),
    last_visit: dateOrNull(object.lastVisit),
    name: stringOrEmpty(object.name) || "Unbenanntes Objekt",
    next_visit: dateOrNull(object.nextVisit),
    owner_address: stringOrEmpty(object.ownerAddress),
    owner_customer_id: nullableString(object.ownerCustomerId),
    owner_email: stringOrEmpty(object.ownerEmail),
    owner_name: stringOrEmpty(object.owner),
    owner_phone: stringOrEmpty(object.ownerPhone),
    parking: stringOrEmpty(access.parking),
    plot_sqm: numberOrNull(object.plotSqm),
    region: stringOrEmpty(object.region),
    risks: Array.isArray(object.risks) ? object.risks : [],
    rooms: numberOrNull(object.rooms),
    septic: stringOrEmpty(utilities.septic),
    size_sqm: numberOrNull(object.sizeSqm),
    status: stringOrEmpty(object.status),
    water: stringOrEmpty(utilities.water),
  };
}

function rowToObject(row: ObjectRow, mediaRows: MediaRow[]) {
  const items = mediaRows.filter((item) => item.owner_id === row.id).map(rowToMedia);
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
  };
}

function jobDiscount(job: JsonObject) {
  return job.discount && typeof job.discount === "object" && !Array.isArray(job.discount)
    ? job.discount
    : {
        reason: stringOrEmpty(job.discountReason),
        type: stringOrEmpty(job.discountType),
        value: stringOrEmpty(job.discountValue),
      };
}

function jobToRow(job: JsonObject) {
  return {
    assigned_to: stringOrEmpty(job.assignedTo),
    billable: job.billable !== false,
    checklist: Array.isArray(job.checklist) ? job.checklist : [],
    custom_service: job.customService && typeof job.customService === "object" ? job.customService : null,
    customer_id: nullableString(job.customerId),
    description: stringOrEmpty(job.description),
    discount: jobDiscount(job),
    due_date: nullableString(job.dueDate),
    end_date: nullableString(job.endDate),
    execution_date: nullableString(job.executionDate),
    execution_log: Array.isArray(job.executionLog) ? job.executionLog : [],
    id: String(job.id),
    internal_notes: stringOrEmpty(job.internalNotes),
    material: stringOrEmpty(job.material),
    material_items: Array.isArray(job.materialItems) ? job.materialItems : [],
    object_id: nullableString(job.objectId),
    offer_number: stringOrEmpty(job.offerNumber),
    offer_sent_at: nullableString(job.offerSentAt),
    order_confirmation_number: stringOrEmpty(job.orderConfirmationNumber),
    order_confirmation_sent_at: nullableString(job.orderConfirmationSentAt),
    priority: stringOrEmpty(job.priority) || "normal",
    resource_ids: Array.isArray(job.resourceIds) ? job.resourceIds : [],
    schedule: job.schedule && typeof job.schedule === "object" ? job.schedule : {},
    series_excluded_dates: Array.isArray(job.seriesExcludedDates) ? job.seriesExcludedDates : [],
    series_master_id: nullableString(job.seriesMasterId),
    series_occurrence_date: nullableString(job.seriesOccurrenceDate),
    service_discounts: job.serviceDiscounts && typeof job.serviceDiscounts === "object" ? job.serviceDiscounts : {},
    service_ids: Array.isArray(job.serviceIds) ? job.serviceIds : [],
    service_quantities: job.serviceQuantities && typeof job.serviceQuantities === "object" ? job.serviceQuantities : {},
    start_date: nullableString(job.startDate),
    status: stringOrEmpty(job.status) || "geplant",
    status_updated_at: nullableString(job.statusUpdatedAt),
    title: stringOrEmpty(job.title) || "Auftrag",
    type: stringOrEmpty(job.type),
    work_minutes: numberOrNull(job.workMinutes) ?? 0,
  };
}

function rowToJob(row: JobRow) {
  const discount = row.discount && typeof row.discount === "object" && !Array.isArray(row.discount) ? row.discount as JsonObject : {};
  return {
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
  };
}

function billingToRow(item: JsonObject) {
  return {
    amount: numberOrNull(item.amount),
    cancelled_at: nullableString(item.cancelledAt),
    created_at: nullableString(item.createdAt) ?? new Date().toISOString(),
    customer_id: nullableString(item.customerId),
    due_date: nullableString(item.dueDate),
    external_export_status: stringOrEmpty(item.externalExportStatus),
    external_export_system: stringOrEmpty(item.externalExportSystem),
    external_exported_at: nullableString(item.externalExportedAt),
    id: String(item.id),
    invoice_date: nullableString(item.invoiceDate),
    invoice_number: stringOrEmpty(item.invoiceNumber),
    invoice_status: stringOrEmpty(item.invoiceStatus),
    job_id: nullableString(item.jobId),
    label: stringOrEmpty(item.label) || "Abrechnung",
    lines: Array.isArray(item.lines) ? item.lines : [],
    notes: stringOrEmpty(item.notes),
    object_id: nullableString(item.objectId),
    paid_at: nullableString(item.paidAt),
    report_id: nullableString(item.reportId),
    sent_at: nullableString(item.sentAt ?? item.invoicedAt),
    service_date: nullableString(item.serviceDate),
    source: stringOrEmpty(item.source),
    status: stringOrEmpty(item.status) || "abrechenbar",
  };
}

function rowToBilling(row: BillingRow) {
  return {
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
    jobId: row.job_id ?? undefined,
    label: row.label,
    lines: Array.isArray(row.lines) ? row.lines : [],
    notes: row.notes ?? "",
    objectId: row.object_id ?? "",
    paidAt: row.paid_at ?? undefined,
    reportId: row.report_id ?? undefined,
    sentAt: row.sent_at ?? undefined,
    serviceDate: row.service_date ?? undefined,
    source: row.source ?? "",
    status: row.status ?? "abrechenbar",
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
  };
}

function translationToRow(row: JsonObject) {
  return {
    de: stringOrEmpty(row.de) || stringOrEmpty(row.key),
    en: stringOrEmpty(row.en) || stringOrEmpty(row.de) || stringOrEmpty(row.key),
    key: stringOrEmpty(row.key),
    sv: stringOrEmpty(row.sv) || stringOrEmpty(row.de) || stringOrEmpty(row.key),
  };
}

function rowToTranslation(row: TranslationRow) {
  return {
    de: row.de,
    en: row.en,
    key: row.key,
    sv: row.sv,
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
    responsiblePersonId: row.responsible_person_id ?? "",
    status: row.status ?? "",
    standardTrips: Array.isArray(row.standard_trips) ? row.standard_trips : [],
    taxCountry: row.tax_country ?? "",
    tracking: Object.keys(tracking).length > 0 ? tracking : undefined,
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
    .select("id, type, brand, build_year, current_odometer, current_odometer_date, default_driver_id, name, identifier, license_plate, status, responsible_person_id, location, logbook_active, notes, logbook_year, model, odometer_year_start, odometer_year_end, odometer_history, odometer_last_confirmed, odometer_last_confirmed_at, odometer_last_confirmed_by, odometer_last_confirmed_photo, owner_company, private_use_allowed, registration_country, tax_country, tracking, maintenance_items, standard_trips, deleted_logbook_entry_ids, archived, updated_at")
    .order("name", { ascending: true });

  if (resourceError) return loadResourceSectionViaRpc(supabase);
  if (!resourceRows?.length) return null;

  const { data: tripRows, error: tripError } = await supabase
    .from("homecare_vehicle_trips")
    .select("id, resource_id, trip_date, driver_id, status, started_at, ended_at, trip_type, trip_category, rule_country, rule_version, rule_title, start_address, start_address_resolved, end_address, end_address_resolved, start_coordinates, end_coordinates, waypoints, start_odometer, end_odometer, kilometers, purpose, visited, fuel_or_charge, fuel_receipt_photo, odometer_photos, validation_warnings, audit_log, notes, updated_at")
    .order("trip_date", { ascending: true });

  if (tripError) return loadResourceSectionViaRpc(supabase);

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

  const { error: tripError } = trips.length
    ? await supabase
        .from("homecare_vehicle_trips")
        .upsert(trips, { onConflict: "id" })
    : { error: null };

  if (tripError) await saveResourceSectionViaRpc(supabase, value);

  const mediaRows = resources.flatMap((resource) => (
    Array.isArray(resource.media)
      ? resource.media
          .filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item))
          .map((item) => mediaToRow("resource", String(resource.id), item))
      : []
  ));
  if (!mediaRows.length) return;

  const { error: mediaError } = await supabase
    .from("homecare_media")
    .upsert(mediaRows, { onConflict: "id" });

  if (mediaError) await saveResourceSectionViaRpc(supabase, value);
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

  const { data: existingData, error: existingError } = await supabase
    .from("homecare_reports")
    .select("id, job_id, object_id, title, report_date, visible_to_customer, summary, internal_notes, customer_comment, checklist_results, media_ids, attachments, sent_at, updated_at");

  if (existingError) throw new Error(existingError.message);

  const mergedReports = mergeReports(
    (existingData as ReportRow[] | null | undefined)?.map(rowToReport) ?? [],
    reports,
  );

  const { error } = await supabase
    .from("homecare_reports")
    .upsert(mergedReports.map(reportToRow), { onConflict: "id" });

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
  const rowIds = rows.map((row) => row.id);
  const { data: existingData, error: existingError } = await supabase
    .from("homecare_field_progress")
    .select("id, job_id, work_date, task_id, completed, minutes, show_work_time_in_report, note, photos, updated_at")
    .in("id", rowIds);

  if (existingError) throw new Error(existingError.message);

  const existingById = new Map(((existingData as FieldProgressRow[] | null | undefined) ?? []).map((row) => [row.id, row]));
  const mergedRows = rows.map((row) => {
    const existing = existingById.get(row.id);
    if (!existing) return row;
    const existingTime = Date.parse(existing.updated_at ?? "");
    const rowTime = Date.parse(row.updated_at ?? "");
    const rowIsNewer = Number.isFinite(rowTime)
      ? !Number.isFinite(existingTime) || rowTime >= existingTime
      : true;

    return {
      ...existing,
      ...row,
      completed: Boolean(existing.completed) || Boolean(row.completed),
      minutes: rowIsNewer ? row.minutes : existing.minutes,
      note: rowIsNewer ? row.note : existing.note,
      photos: mergeFieldPhotos(existing.photos, row.photos),
      show_work_time_in_report: row.show_work_time_in_report !== false && existing.show_work_time_in_report !== false,
      updated_at: rowIsNewer ? row.updated_at : existing.updated_at,
    };
  });

  const { error } = await supabase
    .from("homecare_field_progress")
    .upsert(mergedRows, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

async function loadObjectsRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_objects")
    .select("id, owner_customer_id, name, owner_name, owner_email, owner_phone, owner_address, address, billing_address_mode, billing_address, region, size_sqm, plot_sqm, rooms, beds, bathrooms, build_year, care_package, status, key_safe, alarm, parking, access_notes, heating, water, septic, internet, equipment, risks, next_visit, last_visit, archived, updated_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ObjectRow[];
}

async function loadObjectMediaRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_media")
    .select("id, owner_id, kind, name, description, source, storage_path, preview_url, is_primary")
    .eq("owner_type", "object")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

async function loadResourceMediaRows(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_media")
    .select("id, owner_id, kind, name, description, source, storage_path, preview_url, is_primary")
    .eq("owner_type", "resource")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

async function loadCustomersSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_customers")
    .select("id, personal_number, company_name, name, contact, email, phone, phone2, address, billing_address, billing_address_mode, language, portal_login_email, portal_password, portal_status, balance, notes, report_mail_body, weekly_report_mail_body, offer_mail_body, order_confirmation_mail_body, work_time_visibility, billable, archived, portal_login_history, created_at, updated_at")
    .order("name", { ascending: true });
  if (error || !data?.length) return null;

  const objectRows = await loadObjectsRows(supabase).catch(() => []);
  return {
    updatedAt: maxUpdatedAt((data as CustomerRow[]).map((row) => row.updated_at)),
    value: (data as CustomerRow[]).map((row) => rowToCustomer(row, objectRows)),
  };
}

async function saveCustomersSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const customers = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!customers.length) return;

  const { error } = await supabase
    .from("homecare_customers")
    .upsert(customers.map(customerToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadObjectsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const objectRows = await loadObjectsRows(supabase).catch(() => null);
  if (!objectRows?.length) return null;
  const mediaRows = await loadObjectMediaRows(supabase).catch(() => []);
  return {
    updatedAt: maxUpdatedAt(objectRows.map((row) => row.updated_at)),
    value: objectRows.map((row) => rowToObject(row, mediaRows)),
  };
}

async function saveObjectsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const objects = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!objects.length) return;

  const { error } = await supabase
    .from("homecare_objects")
    .upsert(objects.map(objectToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);

  const mediaRows = objects.flatMap((object) => {
    const media = object.media && typeof object.media === "object" && !Array.isArray(object.media) ? object.media as JsonObject : {};
    return Array.isArray(media.items)
      ? media.items
          .filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item))
          .map((item) => mediaToRow("object", String(object.id), item))
      : [];
  });
  if (!mediaRows.length) return;

  const { error: mediaError } = await supabase
    .from("homecare_media")
    .upsert(mediaRows, { onConflict: "id" });
  if (mediaError) throw new Error(mediaError.message);
}

async function loadPersonnelSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_personnel")
    .select("id, personnel_number, first_name, last_name, role, email, phone, language, status, notes, archived, created_at, updated_at")
    .order("last_name", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as PersonnelRow[]).map((row) => row.updated_at)),
    value: (data as PersonnelRow[]).map(rowToPersonnel),
  };
}

async function savePersonnelSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const personnel = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!personnel.length) return;

  const { error } = await supabase
    .from("homecare_personnel")
    .upsert(personnel.map(personnelToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadJobsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_jobs")
    .select("id, series_master_id, series_occurrence_date, title, object_id, customer_id, type, status, status_updated_at, priority, due_date, start_date, end_date, execution_date, assigned_to, description, internal_notes, billable, material, work_minutes, resource_ids, material_items, checklist, service_ids, service_quantities, service_discounts, custom_service, discount, schedule, execution_log, offer_number, offer_sent_at, order_confirmation_number, order_confirmation_sent_at, series_excluded_dates, updated_at")
    .order("due_date", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as JobRow[]).map((row) => row.updated_at)),
    value: (data as JobRow[]).map(rowToJob),
  };
}

async function saveJobsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const jobs = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!jobs.length) return;

  const { error } = await supabase
    .from("homecare_jobs")
    .upsert(jobs.map(jobToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadAccountingAccountsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_accounting_accounts")
    .select("account, category, label, archived, updated_at")
    .order("account", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as AccountingAccountRow[]).map((row) => row.updated_at)),
    value: (data as AccountingAccountRow[]).map(rowToAccountingAccount),
  };
}

async function saveAccountingAccountsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const accounts = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "account" in item));
  if (!accounts.length) return;
  const { error } = await supabase
    .from("homecare_accounting_accounts")
    .upsert(accounts.map(accountingAccountToRow), { onConflict: "account" });
  if (error) throw new Error(error.message);
}

async function loadInventoryLocationsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_inventory_locations")
    .select("id, name, site, note, archived, updated_at")
    .order("name", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as InventoryLocationRow[]).map((row) => row.updated_at)),
    value: (data as InventoryLocationRow[]).map(rowToInventoryLocation),
  };
}

async function saveInventoryLocationsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const locations = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!locations.length) return;
  const { error } = await supabase
    .from("homecare_inventory_locations")
    .upsert(locations.map(inventoryLocationToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadMaterialsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: materialRows, error } = await supabase
    .from("homecare_materials")
    .select("id, accounting_account, sku, name, category, unit, sales_price, purchase_price, currency, tax_rate, supplier, primary_location_id, min_stock, max_stock, description, archived, updated_at")
    .order("name", { ascending: true });
  if (error || !materialRows?.length) return null;

  const { data: movementRows, error: movementError } = await supabase
    .from("homecare_inventory_movements")
    .select("id, material_id, location_id, movement_type, quantity, counted_quantity, note, supplier, purchase_gross, purchase_net, purchase_tax_rate, purchase_tax_amount, customer_id, service_id, billable_as_service, receipt, changes, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (movementError) throw new Error(movementError.message);

  return {
    updatedAt: maxUpdatedAt([
      ...(materialRows as MaterialRow[]).map((row) => row.updated_at),
      ...((movementRows ?? []) as InventoryMovementRow[]).map((row) => row.updated_at),
    ]),
    value: (materialRows as MaterialRow[]).map((row) => rowToMaterial(row, (movementRows ?? []) as InventoryMovementRow[])),
  };
}

async function saveMaterialsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const materials = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!materials.length) return;

  const { error } = await supabase
    .from("homecare_materials")
    .upsert(materials.map(materialToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);

  const movements = materials.flatMap((material) => (
    Array.isArray(material.inventoryEntries)
      ? material.inventoryEntries
          .filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object" && "id" in entry))
          .map((entry) => movementToRow(String(material.id), entry))
      : []
  ));
  if (!movements.length) return;

  const { error: movementError } = await supabase
    .from("homecare_inventory_movements")
    .upsert(movements, { onConflict: "id" });
  if (movementError) throw new Error(movementError.message);
}

async function loadServicesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_services")
    .select("id, accounting_account, name, category, unit, price, currency, tax_rate, show_work_time_in_reports, description, checklist, archived, updated_at")
    .order("name", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as ServiceRow[]).map((row) => row.updated_at)),
    value: (data as ServiceRow[]).map(rowToService),
  };
}

async function saveServicesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const services = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!services.length) return;
  const { error } = await supabase
    .from("homecare_services")
    .upsert(services.map(serviceToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadPackagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_service_packages")
    .select("id, name, price, description, service_ids, archived, updated_at")
    .order("name", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as ServicePackageRow[]).map((row) => row.updated_at)),
    value: (data as ServicePackageRow[]).map(rowToPackage),
  };
}

async function savePackagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const packages = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!packages.length) return;
  const { error } = await supabase
    .from("homecare_service_packages")
    .upsert(packages.map(packageToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadBillingSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_billing_items")
    .select("id, object_id, customer_id, job_id, report_id, source, label, amount, status, invoice_status, invoice_number, invoice_date, due_date, service_date, lines, notes, external_export_status, external_export_system, external_exported_at, sent_at, paid_at, cancelled_at, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as BillingRow[]).map((row) => row.updated_at)),
    value: (data as BillingRow[]).map(rowToBilling),
  };
}

async function saveBillingSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const items = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!items.length) return;
  const { error } = await supabase
    .from("homecare_billing_items")
    .upsert(items.map(billingToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadPortalMessagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_portal_messages")
    .select("id, customer_id, object_id, subject, message, status, delivery_status, delivery_error, origin, replies, sent_at, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as PortalMessageRow[]).map((row) => row.updated_at)),
    value: (data as PortalMessageRow[]).map(rowToPortalMessage),
  };
}

async function savePortalMessagesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const messages = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "id" in item));
  if (!messages.length) return;
  const { error } = await supabase
    .from("homecare_portal_messages")
    .upsert(messages.map(portalMessageToRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function loadTranslationOverridesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_translations")
    .select("key, de, sv, en, updated_at")
    .order("key", { ascending: true });
  if (error || !data?.length) return null;
  return {
    updatedAt: maxUpdatedAt((data as TranslationRow[]).map((row) => row.updated_at)),
    value: (data as TranslationRow[]).map(rowToTranslation),
  };
}

async function saveTranslationOverridesSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!Array.isArray(value)) return;
  const rows = value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && "key" in item && stringOrEmpty((item as JsonObject).key)));
  if (!rows.length) return;
  const { error } = await supabase
    .from("homecare_translations")
    .upsert(rows.map(translationToRow), { onConflict: "key" });
  if (error) throw new Error(error.message);
}

async function loadSettingsSections(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, keys: SyncSectionKey[]) {
  const settingKeys = keys.filter((key) => [
    "activeJobId",
    "companySettings",
    "dailyMailSettings",
    "deletedEntityIds",
    "deletedReportIds",
    "fieldNotes",
  ].includes(key));
  if (!settingKeys.length) return {};

  const { data, error } = await supabase
    .from("homecare_settings")
    .select("key, value, updated_at")
    .in("key", settingKeys);
  if (error) return {};

  return Object.fromEntries(((data ?? []) as SettingRow[])
    .filter((row) => isSyncSectionKey(row.key))
    .map((row) => [row.key, { updatedAt: row.updated_at, value: row.value }]));
}

async function saveSettingsSections(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, patch: JsonObject) {
  const settingKeys = [
    "activeJobId",
    "companySettings",
    "dailyMailSettings",
    "deletedEntityIds",
    "deletedReportIds",
    "fieldNotes",
  ];
  const rows = Object.entries(patch)
    .filter(([key]) => settingKeys.includes(key))
    .map(([key, value]) => ({ key, value: value === undefined ? null : value }));
  if (!rows.length) return;

  const { error } = await supabase
    .from("homecare_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

function planFromPlanId(planId: string | null | undefined) {
  if (String(planId ?? "").startsWith("start_")) return "start";
  if (String(planId ?? "").startsWith("pro_")) return "pro";
  if (String(planId ?? "").startsWith("business_")) return "business";
  return "business";
}

async function loadTenantSettingsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: tenantRows, error: tenantError } = await supabase
    .from("homecare_tenants")
    .select("id, name, subscription_status, subscription_interval, updated_at")
    .eq("id", defaultTenantId)
    .limit(1);
  if (tenantError || !tenantRows?.length) return null;

  const { data: subscriptionRows } = await supabase
    .from("homecare_subscriptions")
    .select("plan_id, status, interval, current_period_end, updated_at")
    .eq("tenant_id", defaultTenantId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: moduleRows } = await supabase
    .from("homecare_tenant_modules")
    .select("module, enabled, updated_at")
    .eq("tenant_id", defaultTenantId)
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
      subscriptionInterval: subscription?.interval ?? tenant.subscription_interval ?? "monthly",
      subscriptionStatus: subscription?.status ?? tenant.subscription_status ?? "active",
    },
  };
}

async function saveTenantSettingsSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const settings = value as JsonObject;
  const tenantId = typeof settings.id === "string" && settings.id ? settings.id : defaultTenantId;
  const modules = settings.modules && typeof settings.modules === "object" && !Array.isArray(settings.modules)
    ? settings.modules as JsonObject
    : {};
  const plan = ["start", "pro", "business"].includes(String(settings.plan)) ? String(settings.plan) : "business";
  const interval = ["monthly", "quarterly", "yearly"].includes(String(settings.subscriptionInterval)) ? String(settings.subscriptionInterval) : "monthly";
  const subscriptionStatus = ["trialing", "active", "past_due", "paused", "cancelled"].includes(String(settings.subscriptionStatus))
    ? String(settings.subscriptionStatus)
    : "active";
  const planId = `${plan}_${interval === "yearly" ? "yearly" : interval === "quarterly" ? "quarterly" : "monthly"}`;

  const { error: tenantError } = await supabase
    .from("homecare_tenants")
    .upsert({
      id: tenantId,
      name: stringOrEmpty(settings.name) || "Kolaretorp Service AB",
      slug: tenantId === defaultTenantId ? "kolaretorp" : `tenant-${tenantId}`,
      subscription_interval: interval,
      subscription_status: subscriptionStatus,
    }, { onConflict: "id" });
  if (tenantError) throw new Error(tenantError.message);

  await supabase
    .from("homecare_subscriptions")
    .upsert({
      tenant_id: tenantId,
      plan_id: planId,
      status: subscriptionStatus,
      interval,
    }, { onConflict: "tenant_id" });

  const moduleRows = Object.entries(modules)
    .filter(([module]) => stringOrEmpty(module))
    .map(([module, enabled]) => ({
      enabled: enabled !== false,
      module,
      source: "manual",
      tenant_id: tenantId,
    }));
  if (!moduleRows.length) return;

  const { error: moduleError } = await supabase
    .from("homecare_tenant_modules")
    .upsert(moduleRows, { onConflict: "tenant_id,module" });
  if (moduleError) throw new Error(moduleError.message);
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

function sectionUpdatedAt(section: unknown) {
  if (!section || typeof section !== "object" || !("updatedAt" in section)) return 0;
  const timestamp = Date.parse(String((section as { updatedAt?: unknown }).updatedAt ?? ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relationalSectionIsNewer(fallbackSection: unknown, relationalSection: unknown) {
  if (!fallbackSection) return true;
  return sectionUpdatedAt(relationalSection) > sectionUpdatedAt(fallbackSection);
}

function sectionValueArray(section: unknown) {
  if (!section || typeof section !== "object" || !("value" in section)) return [] as JsonObject[];
  const value = (section as { value?: unknown }).value;
  if (!Array.isArray(value)) return [] as JsonObject[];
  return value.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item)));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

type SyncSectionEnvelope = { updatedAt: unknown; value: unknown };

function mergeResourceSectionValues(
  fallbackSection: SyncSectionEnvelope | undefined,
  relationalSection: SyncSectionEnvelope | undefined,
): SyncSectionEnvelope {
  if (!fallbackSection && !relationalSection) {
    return { updatedAt: new Date().toISOString(), value: [] };
  }
  if (!fallbackSection) return relationalSection as SyncSectionEnvelope;
  if (!relationalSection) return fallbackSection;

  const fallbackResources = sectionValueArray(fallbackSection);
  const relationalResources = sectionValueArray(relationalSection);
  if (!fallbackResources.length) return relationalSection;
  if (!relationalResources.length) return fallbackSection;

  const relationalNewer = relationalSectionIsNewer(fallbackSection, relationalSection);
  const primaryResources = relationalNewer ? relationalResources : fallbackResources;
  const secondaryResources = relationalNewer ? fallbackResources : relationalResources;
  const secondaryById = new Map(secondaryResources.map((resource) => [String(resource.id ?? ""), resource]));
  const primaryIds = new Set(primaryResources.map((resource) => String(resource.id ?? "")));

  const mergeLogbook = (primaryLogbook: unknown, secondaryLogbook: unknown, deletedIds: Set<string>) => {
    const primaryEntries = Array.isArray(primaryLogbook)
      ? primaryLogbook.filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
      : [];
    const secondaryEntries = Array.isArray(secondaryLogbook)
      ? secondaryLogbook.filter((entry): entry is JsonObject => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
      : [];
    const secondaryEntriesById = new Map(secondaryEntries.map((entry) => [String(entry.id ?? ""), entry]));
    const mergedEntries = primaryEntries.map((entry) => ({
      ...(secondaryEntriesById.get(String(entry.id ?? "")) ?? {}),
      ...entry,
    }));
    const mergedEntryIds = new Set(mergedEntries.map((entry) => String(entry.id ?? "")));
    secondaryEntries.forEach((entry) => {
      const id = String(entry.id ?? "");
      if (!mergedEntryIds.has(id)) mergedEntries.push(entry);
    });
    return mergedEntries.filter((entry) => !deletedIds.has(String(entry.id ?? "")));
  };

  const mergedResources = primaryResources.map((primaryResource) => {
    const secondaryResource = secondaryById.get(String(primaryResource.id ?? ""));
    if (!secondaryResource) return primaryResource;
    const deletedLogbookEntryIds = Array.from(new Set([
      ...stringArray(secondaryResource.deletedLogbookEntryIds),
      ...stringArray(primaryResource.deletedLogbookEntryIds),
    ]));
    const deletedIds = new Set(deletedLogbookEntryIds);
    return {
      ...secondaryResource,
      ...primaryResource,
      deletedLogbookEntryIds,
      logbook: mergeLogbook(primaryResource.logbook, secondaryResource.logbook, deletedIds),
    };
  });

  secondaryResources.forEach((resource) => {
    const id = String(resource.id ?? "");
    if (!primaryIds.has(id)) mergedResources.push(resource);
  });

  const fallbackTime = sectionUpdatedAt(fallbackSection);
  const relationalTime = sectionUpdatedAt(relationalSection);
  const newestSection = relationalTime > fallbackTime ? relationalSection : fallbackSection;
  const updatedAt = newestSection && typeof newestSection === "object" && "updatedAt" in newestSection
    ? String((newestSection as { updatedAt?: unknown }).updatedAt ?? new Date().toISOString())
    : new Date().toISOString();

  return { updatedAt, value: mergedResources };
}

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ data: {}, error: "Supabase-Zugangsdaten fehlen." }, { status: 500 });
  }

  const keys = requestedSyncKeys(request);
  try {
    const sections = await loadFallbackSections(supabase, keys);
    Object.assign(sections, await loadSettingsSections(supabase, keys));
    if (keys.includes("accountingAccounts")) {
      const accountingSection = await loadAccountingAccountsSection(supabase);
      if (accountingSection) sections.accountingAccounts = accountingSection;
    }
    if (keys.includes("billing")) {
      const billingSection = await loadBillingSection(supabase);
      if (billingSection) sections.billing = billingSection;
    }
    if (keys.includes("customers")) {
      const customerSection = await loadCustomersSection(supabase);
      if (customerSection && relationalSectionIsNewer(sections.customers, customerSection)) sections.customers = customerSection;
    }
    if (keys.includes("inventoryLocations")) {
      const inventoryLocationSection = await loadInventoryLocationsSection(supabase);
      if (inventoryLocationSection) sections.inventoryLocations = inventoryLocationSection;
    }
    if (keys.includes("materials")) {
      const materialSection = await loadMaterialsSection(supabase);
      if (materialSection) sections.materials = materialSection;
    }
    if (keys.includes("objects")) {
      const objectSection = await loadObjectsSection(supabase);
      if (objectSection && relationalSectionIsNewer(sections.objects, objectSection)) {
        const fallbackObjectRows = sections.objects && typeof sections.objects === "object" && "value" in sections.objects
          && Array.isArray((sections.objects as { value?: unknown }).value)
          ? (sections.objects as { value: JsonObject[] }).value
          : [];
        const fallbackObjectExtensions = new Map(fallbackObjectRows.map((object) => [String(object.id), {
          customFields: object.customFields && typeof object.customFields === "object" && !Array.isArray(object.customFields)
            ? object.customFields
            : {},
          type: stringOrEmpty(object.type) || "Objekt",
        }]));
        sections.objects = {
          ...objectSection,
          value: objectSection.value.map((object) => {
            const extension = fallbackObjectExtensions.get(String(object.id));
            return {
              ...object,
              customFields: extension?.customFields ?? {},
              type: extension?.type ?? "Objekt",
            };
          }),
        };
      }
    }
    if (keys.includes("packages")) {
      const packageSection = await loadPackagesSection(supabase);
      if (packageSection) sections.packages = packageSection;
    }
    if (keys.includes("personnel")) {
      const personnelSection = await loadPersonnelSection(supabase);
      if (personnelSection) sections.personnel = personnelSection;
    }
    if (keys.includes("portalMessages")) {
      const portalMessageSection = await loadPortalMessagesSection(supabase);
      if (portalMessageSection) sections.portalMessages = portalMessageSection;
    }
    if (keys.includes("services")) {
      const serviceSection = await loadServicesSection(supabase);
      if (serviceSection) sections.services = serviceSection;
    }
    if (keys.includes("translationOverrides")) {
      const translationSection = await loadTranslationOverridesSection(supabase);
      if (translationSection) sections.translationOverrides = translationSection;
    }
    if (keys.includes("tenantSettings")) {
      const tenantSection = await loadTenantSettingsSection(supabase);
      if (tenantSection) sections.tenantSettings = tenantSection;
    }
    if (keys.includes("jobs")) {
      const jobSection = await loadJobsSection(supabase);
      if (jobSection && relationalSectionIsNewer(sections.jobs, jobSection)) sections.jobs = jobSection;
    }
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
      if (resourceSection) {
        // Ressourcen/Fahrtenbuch existieren parallel im app_state-Fallback und in
        // homecare_resources/homecare_vehicle_trips. Nie einen kompletten Stand blind
        // durch die relationale Kopie ersetzen: der neuere Abschnitt ist führend,
        // fehlende Fahrten werden per ID aus dem anderen Stand ergänzt.
        sections.resources = mergeResourceSectionValues(sections.resources, resourceSection);
      }
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
    try {
      await saveSettingsSections(supabase, filteredPatch);
    } catch (error) {
      console.warn("Relationaler Einstellungen-Sync wurde auf Fallback reduziert.", error);
    }
    if ("accountingAccounts" in filteredPatch) {
      try {
        await saveAccountingAccountsSection(supabase, filteredPatch.accountingAccounts);
      } catch (error) {
        console.warn("Relationaler Kontenplan-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("billing" in filteredPatch) {
      try {
        await saveBillingSection(supabase, filteredPatch.billing);
      } catch (error) {
        console.warn("Relationaler Abrechnungs-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("customers" in filteredPatch) {
      try {
        await saveCustomersSection(supabase, filteredPatch.customers);
      } catch (error) {
        console.warn("Relationaler Kunden-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("inventoryLocations" in filteredPatch) {
      try {
        await saveInventoryLocationsSection(supabase, filteredPatch.inventoryLocations);
      } catch (error) {
        console.warn("Relationaler Lagerort-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("materials" in filteredPatch) {
      try {
        await saveMaterialsSection(supabase, filteredPatch.materials);
      } catch (error) {
        console.warn("Relationaler Material-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("objects" in filteredPatch) {
      try {
        await saveObjectsSection(supabase, filteredPatch.objects);
      } catch (error) {
        console.warn("Relationaler Objekt-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("packages" in filteredPatch) {
      try {
        await savePackagesSection(supabase, filteredPatch.packages);
      } catch (error) {
        console.warn("Relationaler Paket-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("personnel" in filteredPatch) {
      try {
        await savePersonnelSection(supabase, filteredPatch.personnel);
      } catch (error) {
        console.warn("Relationaler Personal-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("portalMessages" in filteredPatch) {
      try {
        await savePortalMessagesSection(supabase, filteredPatch.portalMessages);
      } catch (error) {
        console.warn("Relationaler Kommunikations-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("services" in filteredPatch) {
      try {
        await saveServicesSection(supabase, filteredPatch.services);
      } catch (error) {
        console.warn("Relationaler Leistungs-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("translationOverrides" in filteredPatch) {
      try {
        await saveTranslationOverridesSection(supabase, filteredPatch.translationOverrides);
      } catch (error) {
        console.warn("Relationaler Sprach-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("tenantSettings" in filteredPatch) {
      try {
        await saveTenantSettingsSection(supabase, filteredPatch.tenantSettings);
      } catch (error) {
        console.warn("Relationaler Mandanten-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("jobs" in filteredPatch) {
      try {
        await saveJobsSection(supabase, filteredPatch.jobs);
      } catch (error) {
        console.warn("Relationaler Auftrags-Sync wurde auf Fallback reduziert.", error);
      }
    }
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
