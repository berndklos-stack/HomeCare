import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedSyncSections = [
  "activeJobId",
  "customers",
  "fieldNotes",
  "fieldProgress",
  "inventoryLocations",
  "jobs",
  "materials",
  "objects",
  "personnel",
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

type CustomerRow = {
  address: string | null;
  archived: boolean | null;
  balance: number | null;
  billable: boolean | null;
  billing_address: string | null;
  billing_address_mode: string | null;
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

function customerToRow(customer: JsonObject) {
  return {
    address: stringOrEmpty(customer.address),
    archived: Boolean(customer.archived),
    balance: numberOrNull(customer.balance) ?? 0,
    billable: customer.billable !== false,
    billing_address: stringOrEmpty(customer.billingAddress),
    billing_address_mode: stringOrEmpty(customer.billingAddressMode) || "Kundenadresse",
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

function mediaToRow(ownerId: string, item: JsonObject) {
  return {
    description: stringOrEmpty(item.description),
    id: String(item.id),
    is_primary: Boolean(item.isPrimary),
    kind: stringOrEmpty(item.type) || "Bild",
    name: stringOrEmpty(item.name) || "Datei",
    owner_id: ownerId,
    owner_type: "object",
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
    last_visit: nullableString(object.lastVisit),
    name: stringOrEmpty(object.name) || "Unbenanntes Objekt",
    next_visit: nullableString(object.nextVisit),
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

async function loadCustomersSection(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("homecare_customers")
    .select("id, personal_number, name, contact, email, phone, phone2, address, billing_address, billing_address_mode, language, portal_login_email, portal_password, portal_status, balance, notes, report_mail_body, weekly_report_mail_body, offer_mail_body, order_confirmation_mail_body, work_time_visibility, billable, archived, portal_login_history, created_at, updated_at")
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
          .map((item) => mediaToRow(String(object.id), item))
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
    if (keys.includes("customers")) {
      const customerSection = await loadCustomersSection(supabase);
      if (customerSection) sections.customers = customerSection;
    }
    if (keys.includes("objects")) {
      const objectSection = await loadObjectsSection(supabase);
      if (objectSection) sections.objects = objectSection;
    }
    if (keys.includes("personnel")) {
      const personnelSection = await loadPersonnelSection(supabase);
      if (personnelSection) sections.personnel = personnelSection;
    }
    if (keys.includes("jobs")) {
      const jobSection = await loadJobsSection(supabase);
      if (jobSection) sections.jobs = jobSection;
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
    if ("customers" in filteredPatch) {
      try {
        await saveCustomersSection(supabase, filteredPatch.customers);
      } catch (error) {
        console.warn("Relationaler Kunden-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("objects" in filteredPatch) {
      try {
        await saveObjectsSection(supabase, filteredPatch.objects);
      } catch (error) {
        console.warn("Relationaler Objekt-Sync wurde auf Fallback reduziert.", error);
      }
    }
    if ("personnel" in filteredPatch) {
      try {
        await savePersonnelSection(supabase, filteredPatch.personnel);
      } catch (error) {
        console.warn("Relationaler Personal-Sync wurde auf Fallback reduziert.", error);
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
