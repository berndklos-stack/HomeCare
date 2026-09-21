import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.REPAIR_API_BASE_URL || "http://127.0.0.1:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase-Konfiguration fehlt.");
}
const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;
const oldSharedId = "OBJ-1007";
const cdkObjectId = "OBJ-4c9a9f51-849f-4d2d-87b6-3d9cc8fb2f75";
const boerjesObjectId = "OBJ-6a4d236a-600c-46d3-8093-aa1886312276";
const cdkCustomerId = "CUS-cb04e4e7-5075-454a-a910-44039a3845ff";
const boerjesCustomerId = "CUS-6ef72fb1-a2b7-456b-a8cc-1559c058420a";
const etzelCustomerId = "CUS-7";
const cdkJobIds = ["JOB-2523", "JOB-2524"];

function assertSingle(items, label) {
  if (items.length !== 1) throw new Error(`${label}: erwartet 1 Datensatz, gefunden ${items.length}.`);
  return items[0];
}

function attachObject(customers, customerId, objectId, removedIds) {
  return customers.map((customer) => {
    const objectIds = Array.isArray(customer.objects) ? customer.objects : [];
    const cleaned = objectIds.filter((id) => !removedIds.has(String(id)));
    return customer.id === customerId ? { ...customer, objects: [...cleaned, objectId] } : { ...customer, objects: cleaned };
  });
}

function stringOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableString(value) {
  const text = stringOrEmpty(value).trim();
  return text || null;
}

function numberOrNull(value) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function jobToRow(job, updatedAt) {
  const discount = job.discount && typeof job.discount === "object"
    ? job.discount
    : {
        reason: stringOrEmpty(job.discountReason),
        type: stringOrEmpty(job.discountType),
        value: stringOrEmpty(job.discountValue),
      };
  return {
    assigned_to: stringOrEmpty(job.assignedTo),
    billable: job.billable !== false,
    checklist: Array.isArray(job.checklist) ? job.checklist : [],
    custom_service: job.customService && typeof job.customService === "object" ? job.customService : null,
    customer_id: nullableString(job.customerId),
    description: stringOrEmpty(job.description),
    discount,
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
    updated_at: updatedAt,
    work_minutes: numberOrNull(job.workMinutes) ?? 0,
  };
}

async function checked(query, label) {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const [syncResponse, stateResponse] = await Promise.all([
  fetch(`${baseUrl}/api/sync-sections?keys=objects,jobs,customers`, { cache: "no-store" }),
  fetch(`${baseUrl}/api/app-state`, { cache: "no-store" }),
]);
if (!syncResponse.ok || !stateResponse.ok) throw new Error("Aktueller App-Stand konnte nicht gelesen werden.");

const syncPayload = await syncResponse.json();
const statePayload = await stateResponse.json();
const syncObjects = syncPayload.data?.objects?.value ?? [];
const syncJobs = syncPayload.data?.jobs?.value ?? [];
const syncCustomers = syncPayload.data?.customers?.value ?? [];
const currentState = statePayload.data;
if (!currentState || !Array.isArray(currentState.objects)) throw new Error("Vollständiger App-Stand fehlt.");

const etzelObject = assertSingle(syncObjects.filter((object) => object.name === "Etzel Uvasjön"), "Etzel");
const cdkObject = assertSingle(syncObjects.filter((object) => object.name === "CDK Family Office Gbr"), "CDK");
const boerjesObject = assertSingle(syncObjects.filter((object) => object.name === "Kährs"), "Kährs/Börjes");
assertSingle(syncCustomers.filter((customer) => customer.id === cdkCustomerId), "CDK-Kunde");
assertSingle(syncCustomers.filter((customer) => customer.id === boerjesCustomerId), "Börjes-Kunde");

const repairedEtzel = { ...etzelObject, id: oldSharedId, ownerCustomerId: etzelCustomerId, type: "Objekt" };
const repairedCdk = { ...cdkObject, id: cdkObjectId, owner: "CDK Vermietung", ownerCustomerId: cdkCustomerId, type: "Projekt" };
const repairedBoerjes = { ...boerjesObject, id: boerjesObjectId, ownerCustomerId: boerjesCustomerId, type: "Projekt" };
const repairedObjects = [
  ...currentState.objects.filter((object) => !["Etzel Uvasjön", "CDK Family Office Gbr", "Kährs"].includes(object.name)),
  repairedEtzel,
  repairedCdk,
  repairedBoerjes,
];
const repairedJobs = syncJobs.map((job) => cdkJobIds.includes(job.id)
  ? { ...job, customerId: cdkCustomerId, objectId: cdkObjectId }
  : job);
const removedIds = new Set([oldSharedId, cdkObjectId, boerjesObjectId]);
let repairedCustomers = attachObject(syncCustomers, etzelCustomerId, oldSharedId, removedIds);
repairedCustomers = attachObject(repairedCustomers, cdkCustomerId, cdkObjectId, removedIds);
repairedCustomers = attachObject(repairedCustomers, boerjesCustomerId, boerjesObjectId, removedIds);

const updatedAt = new Date().toISOString();

const nextState = {
  ...currentState,
  customers: repairedCustomers,
  jobs: repairedJobs,
  objects: repairedObjects,
  updatedAt,
};

if (supabase) {
  const relationalObjects = await checked(
    supabase
      .from("homecare_objects")
      .select("id, name, owner_customer_id")
      .in("id", [oldSharedId, cdkObjectId, boerjesObjectId]),
    "Reparierte Projekte lesen",
  );
  assertSingle(relationalObjects.filter((row) => row.id === oldSharedId && row.name === "Etzel Uvasjön"), "Relationales Etzel-Objekt");
  assertSingle(relationalObjects.filter((row) => row.id === cdkObjectId && row.name === "CDK Family Office Gbr"), "Relationales CDK-Projekt");
  assertSingle(relationalObjects.filter((row) => row.id === boerjesObjectId && row.name === "Kährs"), "Relationales Börjes-Projekt");

  const targetJobIds = new Set([...cdkJobIds, "JOB-2519", "JOB-2521", "JOB-2522"]);
  const targetJobs = repairedJobs.filter((job) => targetJobIds.has(job.id));
  if (targetJobs.length !== targetJobIds.size) {
    throw new Error(`Zielaufträge: erwartet ${targetJobIds.size} Datensätze, gefunden ${targetJobs.length}.`);
  }
  await checked(
    supabase.from("homecare_jobs").upsert(targetJobs.map((job) => jobToRow(job, updatedAt)), { onConflict: "id" }),
    "CDK-/Börjes-Aufträge relational speichern",
  );
}

const sectionSaveResponse = await fetch(`${baseUrl}/api/sync-sections`, {
  body: JSON.stringify({ patch: { customers: repairedCustomers, jobs: repairedJobs, objects: repairedObjects } }),
  headers: { "Content-Type": "application/json" },
  method: "POST",
});
const sectionSavePayload = await sectionSaveResponse.json();
if (!sectionSaveResponse.ok) throw new Error(sectionSavePayload.error || "Abschnittsstand konnte nicht gespeichert werden.");

const stateSaveResponse = await fetch(`${baseUrl}/api/app-state`, {
  body: JSON.stringify(nextState),
  headers: { "Content-Type": "application/json" },
  method: "PUT",
});
const stateSavePayload = await stateSaveResponse.json();
if (!stateSaveResponse.ok) throw new Error(stateSavePayload.error || "App-Stand konnte nicht gespeichert werden.");

console.log(JSON.stringify({
  customers: repairedCustomers.length,
  jobs: repairedJobs.length,
  objects: repairedObjects.map((object) => ({ id: object.id, name: object.name, ownerCustomerId: object.ownerCustomerId, type: object.type })),
  repairedAssignments: repairedJobs.filter((job) => cdkJobIds.includes(job.id) || job.objectId === boerjesObjectId)
    .map((job) => ({ customerId: job.customerId, id: job.id, objectId: job.objectId, title: job.title })),
  updatedAt,
  relationalRepair: Boolean(supabase),
}, null, 2));
