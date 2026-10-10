import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const page = Number(params.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "INVALID_PAGE" }, { status: 400 });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && !uuid.test(id)) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  let query = auth.client.from("homecare_inventory_plans").select("*", { count: "exact" }).eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
  if (id) query = query.eq("id", id);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "PLAN_UNAVAILABLE" }, { status: 503 });
  const items: Record<string, unknown>[] = [];
  if (id) for (let offset = 0; ; offset += 500) {
    const result = await auth.client.from("homecare_inventory_plan_items").select("*").eq("tenant_id", auth.tenantId).eq("plan_id", id).order("location_id").order("material_id").range(offset, offset + 499);
    if (result.error) return NextResponse.json({ error: "PLAN_UNAVAILABLE" }, { status: 503 });
    items.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) break;
  }
  return NextResponse.json({ rows: data ?? [], items, count: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 }); }
  if (!input || typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0
    || typeof input.note !== "string" || !input.note.trim() || input.note.length > 9000 || typeof input.complete !== "boolean"
    || !Array.isArray(input.items) || !input.items.length || input.items.length > 500
    || input.items.some((item: Record<string, unknown>) => !item || typeof item.material_id !== "string" || !item.material_id || typeof item.location_id !== "string" || !item.location_id
      || typeof item.expected !== "number" || !Number.isFinite(item.expected) || (item.counted !== null && (typeof item.counted !== "number" || !Number.isFinite(item.counted) || item.counted < 0 || Math.abs(item.counted * 1000 - Math.round(item.counted * 1000)) > 0.000001)))) return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  const { data, error } = await auth.serviceClient.rpc("homecare_save_inventory_plan", { p_tenant: auth.tenantId, p_id: input.id, p_actor: auth.user.id, p_note: input.note.trim(), p_revision: input.revision, p_items: input.items, p_complete: input.complete });
  if (error) return NextResponse.json({ error: error.message.includes("INVENTORY_STOCK_CHANGED") ? "INVENTORY_STOCK_CHANGED" : error.message.includes("PLAN_CHANGED") ? "PLAN_CHANGED" : "PLAN_FAILED" }, { status: 409 });
  return NextResponse.json({ id: input.id, revision: data }, { headers: { "Cache-Control": "no-store" } });
}
