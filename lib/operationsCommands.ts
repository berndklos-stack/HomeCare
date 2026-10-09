import type { SyncMutation } from "./syncQueue";

export const operationsFields = {
  suppliers: ["supplier_number", "company", "email", "phone", "address", "vat_number", "payment_terms", "notes", "archived"],
  supplier_contacts: ["supplier_id", "name", "email", "phone", "role"],
  purchase_orders: ["order_number", "supplier_id", "order_date", "expected_delivery", "location_id", "job_id", "project_id", "resource_id", "currency", "notes"],
  purchase_order_items: ["order_id", "material_id", "quantity", "unit_price"],
  resource_assignments: ["resource_id", "employee_id", "job_id", "project_id", "location_id", "starts_at", "ends_at", "notes"],
  maintenance_plans: ["resource_id", "name", "maintenance_type", "due_date", "due_mileage", "due_hours", "interval_days", "interval_mileage", "interval_hours", "responsible_person_id", "supplier_id", "notes"],
  resource_details: ["equipment_kind", "availability", "purchase_date", "purchase_price", "warranty_until", "warranty_notes", "operating_hours"],
  material_details: ["preferred_supplier_id", "reorder_quantity", "notes"],
  location_details: ["location_kind", "resource_id", "project_id"],
} as const;
export type OperationsEntity = keyof typeof operationsFields;
export type OperationsRow = { id: string; revision?: number; deleted_at?: string | null; [key: string]: unknown };
export type OperationsCommand =
  | { kind: "save"; entity: OperationsEntity; values: Record<string, unknown> }
  | { kind: "archive"; entity: OperationsEntity }
  | { kind: "order" | "cancel" }
  | { kind: "start"; resource_revision: number }
  | { kind: "stock"; material_id: string; source_id: string | null; destination_id: string | null; quantity: number; note: string; job_id?: string | null; project_id?: string | null }
  | { kind: "receive"; item_id: string; quantity: number; note: string }
  | { kind: "receive_batch"; location_id: string; note: string; document_id: string | null; items: { item_id: string; quantity: number }[] }
  | { kind: "complete"; completed_date: string; mileage: number | null; operating_hours: number | null; cost: number; currency: string; supplier_id: string | null; document_id: string | null; notes: string; materials: { material_id: string; location_id: string; quantity: number }[] };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 10000;
const nullableText = (v: unknown) => v == null || text(v);
const number = (v: unknown, positive = false) => typeof v === "number" && Number.isFinite(v) && (positive ? v > 0 : v >= 0);
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const numericFields = new Set(["quantity", "unit_price", "due_mileage", "due_hours", "interval_days", "interval_mileage", "interval_hours", "purchase_price", "operating_hours", "reorder_quantity"]);

export function requiredOperationsPermission(command: OperationsCommand, hasDataWrite: boolean): "jobs.manage" | "resources.manage" | "data.write" {
  if (command.kind === "stock" && !hasDataWrite) return "jobs.manage";
  if (command.kind === "complete" || command.kind === "start" || ((command.kind === "save" || command.kind === "archive")
    && ["resource_details", "resource_assignments", "maintenance_plans"].includes(command.entity))) return "resources.manage";
  return "data.write";
}

// One allowlist is shared by forms and API validation. Identity and tenant fields
// never come from editable row data; the API supplies the authenticated actor.
export function validateOperationsMutation(mutation: Pick<SyncMutation, "id" | "entityId" | "operation" | "payload" | "expectedRevision">): OperationsCommand {
  const p = mutation.payload;
  const fail = () => { throw new Error("INVALID_OPERATIONS_COMMAND"); };
  if (!uuid.test(mutation.id) || !text(mutation.entityId) || !p || typeof p !== "object") fail();
  let keys: string[] = [];
  switch (p.kind) {
    case "save": {
      keys = ["kind", "entity", "values"];
      if (!(String(p.entity) in operationsFields) || !p.values || typeof p.values !== "object" || Array.isArray(p.values)) fail();
      const allowed = operationsFields[p.entity as OperationsEntity] as readonly string[];
      for (const [key, value] of Object.entries(p.values as Record<string, unknown>)) {
        if (!allowed.includes(key)) fail();
        if (value === null) continue;
        if (numericFields.has(key)) {
          if (!number(value, key === "quantity" || key.startsWith("interval_"))) fail();
          if (key === "interval_days" && !Number.isInteger(value)) fail();
        } else if (key === "archived") { if (typeof value !== "boolean") fail(); }
        else if (!text(value)) fail();
        if (key.endsWith("_date") || ["due_date", "expected_delivery", "warranty_until"].includes(key)) { if (!date(value)) fail(); }
      }
      if (!Object.keys(p.values as object).length) fail();
      if (!["create", "update"].includes(mutation.operation)) fail();
      if (String(p.entity).endsWith("_details") && mutation.operation !== "update") fail();
      break;
    }
    case "archive":
      keys = ["kind", "entity"];
      if (!["suppliers", "supplier_contacts", "maintenance_plans", "purchase_order_items"].includes(String(p.entity)) || mutation.operation !== "delete") fail();
      break;
    case "order": case "cancel": keys = ["kind"]; if (mutation.operation !== "update") fail(); break;
    case "start":
      keys = ["kind", "resource_revision"];
      if (mutation.operation !== "update" || !Number.isSafeInteger(p.resource_revision) || Number(p.resource_revision) < 1) fail();
      break;
    case "stock":
      keys = ["kind", "material_id", "source_id", "destination_id", "quantity", "note", "job_id", "project_id"];
      if (mutation.operation !== "create" || !text(p.material_id) || !nullableText(p.source_id) || !nullableText(p.destination_id)
        || (!p.source_id && !p.destination_id) || p.source_id === p.destination_id || !number(p.quantity, true) || !text(p.note)
        || !nullableText(p.job_id) || !nullableText(p.project_id)) fail();
      break;
    case "receive":
      keys = ["kind", "item_id", "quantity", "note"];
      if (mutation.operation !== "update" || !uuid.test(String(p.item_id)) || !number(p.quantity, true) || !text(p.note)) fail();
      break;
    case "receive_batch": {
      keys = ["kind", "location_id", "note", "document_id", "items"];
      if (mutation.operation !== "update" || !uuid.test(mutation.entityId) || !text(p.location_id) || !text(p.note)
        || !nullableText(p.document_id) || !Array.isArray(p.items) || !p.items.length || p.items.length > 50) fail();
      const ids = new Set<string>();
      for (const item of p.items as Record<string, unknown>[]) {
        if (!item || Object.keys(item).some((key) => !["item_id", "quantity"].includes(key))
          || !uuid.test(String(item.item_id)) || !number(item.quantity, true)
          || Math.abs(Number(item.quantity) * 1000 - Math.round(Number(item.quantity) * 1000)) > 0.000001
          || ids.has(String(item.item_id))) fail();
        ids.add(String(item.item_id));
      }
      break;
    }
    case "complete":
      keys = ["kind", "completed_date", "mileage", "operating_hours", "cost", "currency", "supplier_id", "document_id", "notes", "materials"];
      if (mutation.operation !== "update" || !date(p.completed_date) || !number(p.cost) || !text(p.currency)
        || (p.mileage != null && !number(p.mileage)) || (p.operating_hours != null && !number(p.operating_hours))
        || !nullableText(p.supplier_id) || !nullableText(p.document_id) || typeof p.notes !== "string"
        || !Array.isArray(p.materials) || p.materials.length > 50) fail();
      for (const row of p.materials as Record<string, unknown>[]) {
        if (!row || Object.keys(row).some((k) => !["material_id", "location_id", "quantity"].includes(k))
          || !text(row.material_id) || !text(row.location_id) || !number(row.quantity, true)) fail();
      }
      break;
    default: fail();
  }
  if (Object.keys(p).some((k) => !keys.includes(k))) fail();
  if (mutation.operation !== "create" && (!Number.isSafeInteger(mutation.expectedRevision) || Number(mutation.expectedRevision) < 1)) fail();
  if (p.kind === "save" && mutation.operation === "create" && !uuid.test(mutation.entityId)) fail();
  return p as OperationsCommand;
}
