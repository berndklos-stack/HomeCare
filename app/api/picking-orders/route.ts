import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const params = new URL(request.url).searchParams, id = params.get("id"), pickup = params.get("pickup"), job = params.get("job"), page = Number(params.get("page") ?? 0);
  if ((id && !uuid.test(id)) || (pickup && !uuid.test(pickup)) || !Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "PICKING_CHANGED" }, { status: 400 });
  let query = auth.client.from("homecare_picking_orders").select("*", { count: "exact" }).eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
  if (id) query = query.eq("id", id);
  if (pickup) query = query.eq("pickup_code", pickup);
  if (params.get("ready") === "1") query = query.in("status", ["completed", "loaded"]);
  if (job) query = query.eq("job_id", job);
  const { data: rows, error, count } = await query;
  if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
  const items: Record<string, unknown>[] = [];
  if ((id || pickup) && rows?.[0]) for (let offset = 0; ; offset += 500) {
    const result = await auth.client.from("homecare_picking_items").select("*,material:homecare_materials(name,sku,unit,record_data)").eq("tenant_id", auth.tenantId).eq("order_id", rows[0].id).order("material_id").range(offset, offset + 499);
    if (result.error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
    items.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) break;
  }
  return NextResponse.json({ rows: rows ?? [], items, count: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input.id !== "string" || !uuid.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 1
    || !["create", "pick", "cancel", "dispatch"].includes(input.action)) return NextResponse.json({ error: "PICKING_CHANGED" }, { status: 400 });
  if (input.action === "create" && (typeof input.job !== "string" || !input.job)) return NextResponse.json({ error: "JOB_NOT_OPEN" }, { status: 400 });
  if (input.action === "pick" && (typeof input.order !== "string" || !uuid.test(input.order) || typeof input.material !== "string" || !input.material || typeof input.source !== "string" || !input.source
    || typeof input.destination !== "string" || !input.destination || typeof input.quantity !== "number" || !Number.isFinite(input.quantity) || input.quantity <= 0 || Math.abs(input.quantity * 1000 - Math.round(input.quantity * 1000)) > 0.000001)) return NextResponse.json({ error: "INVALID_PICKING_QUANTITY" }, { status: 400 });
  if (input.action === "dispatch" && (typeof input.pickup !== "string" || !uuid.test(input.pickup) || typeof input.order !== "string" || !uuid.test(input.order) || input.destination !== null && (typeof input.destination !== "string" || !input.destination))) return NextResponse.json({ error: "PICKING_CHANGED" }, { status: 400 });
  const name = input.action === "create" ? "homecare_create_picking_order" : input.action === "cancel" ? "homecare_cancel_picking_order" : input.action === "dispatch" ? "homecare_dispatch_picking" : "homecare_pick_material";
  const args = input.action === "create" ? { p_job: input.job } : input.action === "pick" ? { p_order: input.order, p_material: input.material, p_source: input.source, p_destination: input.destination, p_quantity: input.quantity } : input.action === "dispatch" ? { p_order: input.order, p_destination: input.destination, p_pickup: input.pickup } : {};
  const { data, error } = await auth.serviceClient.rpc(name, { p_tenant: auth.tenantId, p_id: input.id, p_revision: input.revision, p_actor: auth.user.id, ...args });
  if (error) {
    const known = ["PICKING_INVALID_PLACE", "PICKING_INVALID_VEHICLE", "PICKING_STOCK_RESERVED", "PICKING_HAS_STOCK", "NO_PICKING_REQUIRED", "PICKING_JOB_CHANGED", "PICKING_CHANGED", "JOB_NOT_OPEN", "JOB_NOT_BILLABLE", "INSUFFICIENT_STOCK", "INVALID_PICKING_QUANTITY", "MATERIAL_NOT_ACTIVE", "LOCATION_NOT_ACTIVE"];
    return NextResponse.json({ error: known.find((key) => error.message.includes(key)) ?? "OPERATIONS_UNAVAILABLE" }, { status: 409 });
  }
  return NextResponse.json({ id: input.action === "create" ? data : input.order ?? input.id, revision: input.action === "create" ? 1 : data }, { headers: { "Cache-Control": "no-store" } });
}
