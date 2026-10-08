import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { maintenanceStatus } from "@/lib/operations";

const tables = {
  suppliers: "homecare_suppliers", supplier_contacts: "homecare_supplier_contacts",
  purchase_orders: "homecare_purchase_orders", purchase_order_items: "homecare_purchase_order_items",
  purchase_receipts: "homecare_purchase_receipts", resource_assignments: "homecare_resource_assignments",
  maintenance_plans: "homecare_maintenance_plans", maintenance_events: "homecare_maintenance_events",
  stock_movements: "homecare_stock_movements", resource_details: "homecare_resources",
  material_details: "homecare_materials", location_details: "homecare_inventory_locations",
} as const;
const immutable = new Set(["purchase_receipts", "maintenance_events", "stock_movements"]);
const projections: Record<string, string> = {
  resource_details: "id,revision,equipment_kind,availability,purchase_date,purchase_price,warranty_until,warranty_notes,operating_hours",
  material_details: "id,revision,preferred_supplier_id,reorder_quantity,notes",
  location_details: "id,revision,location_kind,resource_id,project_id",
};

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  const client = auth.client;
  const tenantId = auth.tenantId;
  // The local E2E environment may have production credentials in .env.local.
  // Tests must mock this route rather than using that service-role bypass.
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") {
    return NextResponse.json({ error: "OPERATIONS_E2E_MOCK_REQUIRED" }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const entity = params.get("entity") ?? "suppliers";
  if (entity === "overview") {
    const today = params.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(today))) return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
    async function all(table: string, columns: string) {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from(table).select(columns).eq("tenant_id", tenantId).is("deleted_at", null).order("id").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data ?? []) as unknown as Record<string, unknown>[]);
        if (!data || data.length < 500) return rows;
      }
    }
    try {
      const plans = await all("homecare_maintenance_plans", "id,resource_id,due_date,due_mileage,due_hours,completed");
      const resources = await all("homecare_resources", "id,availability,operating_hours,current_odometer,archived");
      const resourcesById = new Map(resources.map((r) => [r.id, r]));
      let overdue = 0, upcoming = 0;
      for (const plan of plans) {
        const resource = resourcesById.get(plan.resource_id);
        const status = maintenanceStatus({ dueDate: plan.due_date as string | null, dueMileage: plan.due_mileage == null ? null : Number(plan.due_mileage), dueHours: plan.due_hours == null ? null : Number(plan.due_hours) },
          { date: today, mileage: resource?.current_odometer == null ? undefined : Number(resource.current_odometer), hours: resource?.operating_hours == null ? undefined : Number(resource.operating_hours) }, Boolean(plan.completed));
        if (status === "overdue") overdue++; if (status === "due_soon") upcoming++;
      }
      const { data: cutover, error: cutoverError } = await auth.client.from("homecare_stock_cutovers").select("tenant_id").eq("tenant_id", auth.tenantId).maybeSingle();
      if (cutoverError) throw cutoverError;
      let lowStock = 0;
      if (cutover) {
        const materials = await all("homecare_materials", "id,min_stock,record_data,archived");
        const quantities = new Map<string, number>();
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await auth.client.rpc("homecare_stock_summary").range(offset, offset + 499);
          if (error) throw error;
          for (const row of data ?? []) quantities.set(row.material_id, (quantities.get(row.material_id) ?? 0) + Number(row.quantity));
          if (!data || data.length < 500) break;
        }
        lowStock = materials.filter((m) => !m.archived && (quantities.get(String(m.id)) ?? 0) < Number(String((m.record_data as Record<string, unknown> | null)?.minStock ?? m.min_stock ?? 0).replace(",", "."))).length;
      }
      return NextResponse.json({ lowStock, overdue, upcoming, unavailable: resources.filter((r) => !r.archived && ["maintenance", "repair", "unavailable"].includes(String(r.availability))).length }, { headers: { "Cache-Control": "no-store" } });
    } catch { return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }); }
  }
  if (entity === "stock_status") {
    const { data, error } = await auth.client.from("homecare_stock_cutovers").select("completed_at").eq("tenant_id", auth.tenantId).maybeSingle();
    if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
    return NextResponse.json({ active: Boolean(data) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (entity === "stock_balances") {
    const material = params.get("parent");
    if (!material) return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
    const { data, error } = await auth.client.rpc("homecare_stock_balances", { p_tenant: auth.tenantId, p_material: material });
    if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
    return NextResponse.json({ rows: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!Object.hasOwn(tables, entity)) return NextResponse.json({ error: "INVALID_ENTITY" }, { status: 400 });
  const page = Number(params.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "INVALID_PAGE" }, { status: 400 });
  let query = auth.client.from(tables[entity as keyof typeof tables]).select(projections[entity] ?? "*", { count: "exact" })
    .eq("tenant_id", auth.tenantId);
  if (immutable.has(entity)) query = query.order(entity === "maintenance_events" ? "created_at" : "occurred_at", { ascending: false });
  query = query.order("id").range(page * 50, page * 50 + 49);
  if (!immutable.has(entity)) query = query.is("deleted_at", null);
  const search = params.get("search")?.trim();
  if (search) {
    if (search.length > 100) return NextResponse.json({ error: "INVALID_SEARCH" }, { status: 400 });
    const column = entity === "suppliers" ? "company" : entity === "purchase_orders" ? "order_number"
      : ["supplier_contacts", "maintenance_plans", "resource_details", "material_details", "location_details"].includes(entity) ? "name" : null;
    if (column) query = query.ilike(column, `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  }
  const parent = params.get("parent");
  const id = params.get("id");
  if (id) query = query.eq("id", id);
  if (parent) {
    const column = entity === "purchase_order_items" ? "order_id" : entity === "purchase_receipts" ? "item_id"
      : entity === "maintenance_events" ? "plan_id" : entity === "resource_assignments" ? "resource_id"
      : entity === "stock_movements" ? "material_id" : entity === "supplier_contacts" ? "supplier_id" : null;
    if (!column) return NextResponse.json({ error: "INVALID_PARENT" }, { status: 400 });
    query = query.eq(column, parent);
  }
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
  if (entity === "maintenance_events" && data?.length) {
    const rows = data as unknown as Record<string, unknown>[];
    const ids = [...new Set(rows.map((row) => row.document_id).filter((id): id is string => typeof id === "string"))];
    if (ids.length) {
      const { data: documents, error: documentError } = await client.from("homecare_media")
        .select("id,name,storage_path").eq("tenant_id", tenantId).is("deleted_at", null).in("id", ids);
      if (documentError) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
      const byId = new Map((documents ?? []).map((document) => [document.id, document]));
      for (const row of rows) row.document = byId.get(row.document_id as string) ?? null;
    }
  }
  return NextResponse.json({ rows: data ?? [], count: count ?? 0, page }, { headers: { "Cache-Control": "no-store" } });
}
