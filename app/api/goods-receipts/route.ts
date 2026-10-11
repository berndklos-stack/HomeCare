import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { attachOperationsActors } from "@/lib/server/operationsActors";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
 const auth = await requireApiAuth(request, "data.read");
 if (isAuthError(auth)) return auth;
 if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
 const params = new URL(request.url).searchParams, id = params.get("id"), page = Number(params.get("page") ?? 0);
 if (id && !uuid.test(id) || !Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "INVALID_OPERATIONS_COMMAND" }, { status: 400 });
 let query = auth.client.from("homecare_goods_receipts").select("id,delivery_number,created_at,actor_user_id,location_id,supplier:homecare_suppliers(company),location:homecare_inventory_locations(name)", { count: "exact" }).eq("tenant_id", auth.tenantId).is("order_id", null).order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
 if (id) query = query.eq("id", id);
 const { data: rows, count, error } = await query;
 if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
 let items: unknown[] = [];
 if (id && rows?.length) {
  const result = await auth.client.from("homecare_goods_receipt_items").select("material_id,quantity,material:homecare_materials(name,sku,scan_code,unit)").eq("tenant_id", auth.tenantId).eq("receipt_id", id).order("material_id");
  if (result.error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
  items = result.data ?? [];
 }
 try { await attachOperationsActors(auth.serviceClient, auth.tenantId, rows ?? []); }
 catch { return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }); }
 return NextResponse.json({ rows: rows ?? [], count: count ?? 0, items }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
 const auth = await requireApiAuth(request, "data.write");
 if (isAuthError(auth)) return auth;
 if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
 const input = await request.json().catch(() => null), payload = input?.payload;
 if (!input || typeof input.id !== "string" || !uuid.test(input.id) || !payload || typeof payload.supplier_id !== "string" || !uuid.test(payload.supplier_id)
  || typeof payload.delivery_number !== "string" || !payload.delivery_number.trim() || payload.delivery_number.length > 120
  || typeof payload.location_id !== "string" || !payload.location_id || !Array.isArray(payload.items) || !payload.items.length || payload.items.length > 50
  || payload.order_id !== null && (typeof payload.order_id !== "string" || !uuid.test(payload.order_id) || !Number.isSafeInteger(payload.revision) || payload.revision < 1)
  || payload.items.some((line: { material_id?: unknown; item_id?: unknown; quantity?: unknown }) => typeof line.material_id !== "string" || !line.material_id || typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0 || Math.abs(line.quantity * 1000 - Math.round(line.quantity * 1000)) > 0.000001 || payload.order_id !== null && (typeof line.item_id !== "string" || !uuid.test(line.item_id)))) return NextResponse.json({ error: "INVALID_OPERATIONS_COMMAND" }, { status: 400 });
 if (payload.document_id != null && (typeof payload.document_id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/.test(payload.document_id))) return NextResponse.json({ error: "RECEIPT_DOCUMENT_INVALID" }, { status: 400 });
 if (payload.damage != null && (typeof payload.damage.description !== "string" || !payload.damage.description.trim() || payload.damage.description.length > 4000 || !Array.isArray(payload.damage.photos) || payload.damage.photos.length < 1 || payload.damage.photos.length > 20 || payload.damage.photos.some((id: unknown) => typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/.test(id)))) return NextResponse.json({ error: "DAMAGE_DOCUMENTATION_REQUIRED" }, { status: 400 });
 const { data, error } = await auth.serviceClient.rpc("homecare_scan_goods_receipt", { p_tenant: auth.tenantId, p_id: input.id, p_actor: auth.user.id, p_payload: payload });
 if (error) {
  const known = ["REVISION_CONFLICT", "INSUFFICIENT_STOCK", "STOCK_CUTOVER_REQUIRED", "SUPPLIER_NOT_ACTIVE", "LOCATION_NOT_ACTIVE", "MATERIAL_NOT_ACTIVE", "PURCHASE_NOT_RECEIVABLE", "PURCHASE_ITEM_NOT_FOUND", "INVALID_OPERATIONS_COMMAND", "RECEIPT_ID_REUSED", "DAMAGE_DOCUMENTATION_REQUIRED", "DAMAGE_PHOTO_INVALID", "RECEIPT_DOCUMENT_INVALID", "INVALID_RECEIPT_QUANTITY"];
  const code = error.code === "23505" ? "DELIVERY_ALREADY_RECEIVED" : known.find((key) => error.message.includes(key));
  if (!code) console.error("Goods receipt failed", { code: error.code });
  return NextResponse.json({ error: code ?? (error.code === "PGRST202" ? "RECEIPT_SERVICE_NOT_READY" : "RECEIPT_POST_FAILED") }, { status: code ? 409 : 503 });
 }
 return NextResponse.json({ id: data }, { headers: { "Cache-Control": "no-store" } });
}
