import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "INVALID_INVENTORY" }, { status: 400 }); }
  if (!input || typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) || typeof input.location_id !== "string" || !input.location_id.trim()
    || typeof input.note !== "string" || !input.note.trim() || input.note.length > 9000 || !Array.isArray(input.items) || !input.items.length || input.items.length > 500
    || input.items.some((item: Record<string, unknown>) => !item || typeof item.material_id !== "string" || !item.material_id
      || typeof item.expected !== "number" || !Number.isFinite(item.expected) || typeof item.counted !== "number" || !Number.isFinite(item.counted) || item.counted < 0
      || Math.abs(item.counted * 1000 - Math.round(item.counted * 1000)) > 0.000001)) return NextResponse.json({ error: "INVALID_INVENTORY" }, { status: 400 });
  const items = input.items.map((item: { material_id: string; expected: number; counted: number }) => ({ material_id: item.material_id, expected: item.expected, counted: item.counted }));
  const { error } = await auth.serviceClient.rpc("homecare_post_inventory", { p_tenant: auth.tenantId, p_id: input.id, p_location: input.location_id, p_actor: auth.user.id, p_note: input.note.trim(), p_items: items });
  if (error) return NextResponse.json({ error: error.message.includes("INVENTORY_STOCK_CHANGED") ? "INVENTORY_STOCK_CHANGED" : "INVENTORY_FAILED" }, { status: error.message.includes("INVENTORY_STOCK_CHANGED") ? 409 : 503 });
  return NextResponse.json({ id: input.id }, { headers: { "Cache-Control": "no-store" } });
}
