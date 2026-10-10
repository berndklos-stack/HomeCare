import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
