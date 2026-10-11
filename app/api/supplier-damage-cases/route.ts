import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { attachOperationsActors } from "@/lib/server/operationsActors";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ["open", "in_progress", "completed"];
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id"), supplier = params.get("supplier"), status = params.get("status"), page = Number(params.get("page") ?? 0);
  if (id && !uuid.test(id) || supplier && !uuid.test(supplier) || status && !statuses.includes(status) || !Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "INVALID_OPERATIONS_COMMAND" }, { status: 400 });
  if (params.get("summary") === "1") {
    const { count, error } = await auth.client.from("homecare_supplier_damage_cases").select("id", { count: "exact", head: true }).eq("tenant_id", auth.tenantId).in("status", ["open", "in_progress"]);
    return error ? NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }) : NextResponse.json({ count: count ?? 0 }, { headers });
  }
  let query = auth.client.from("homecare_supplier_damage_cases").select("*,supplier:homecare_suppliers(company),receipt:homecare_goods_receipts(delivery_number,document_id)", { count: "exact" }).eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
  if (id) query = query.eq("id", id);
  if (supplier) query = query.eq("supplier_id", supplier);
  if (status) query = query.eq("status", status);
  const { data: rows, error, count } = await query;
  if (error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
  const events: Record<string, unknown>[] = [], photos: Record<string, unknown>[] = [];
  let document: Record<string, unknown> | null = null;
  if (id && rows?.[0]) {
    const result = await auth.client.from("homecare_supplier_damage_photos").select("document:homecare_media(id,name,storage_path)").eq("tenant_id", auth.tenantId).eq("case_id", id);
    if (result.error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
    for (const photo of result.data ?? []) photos.push(photo.document as unknown as Record<string, unknown>);
    const documentId = rows[0].receipt?.document_id;
    if (documentId) {
      const media = await auth.client.from("homecare_media").select("id,name,storage_path").eq("tenant_id", auth.tenantId).eq("id", documentId).is("deleted_at", null).maybeSingle();
      if (media.error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
      document = media.data;
    }
    for (let offset = 0; ; offset += 500) {
      const history = await auth.client.from("homecare_supplier_damage_events").select("*").eq("tenant_id", auth.tenantId).eq("case_id", id).order("created_at").order("id").range(offset, offset + 499);
      if (history.error) return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 });
      events.push(...(history.data ?? []));
      if (!history.data || history.data.length < 500) break;
    }
    try { await attachOperationsActors(auth.serviceClient, auth.tenantId, events); }
    catch { return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }); }
  }
  return NextResponse.json({ rows: rows ?? [], count: count ?? 0, photos, document, events }, { headers });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input.id !== "string" || !uuid.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 1 || !statuses.includes(input.status) || typeof input.note !== "string" || input.note.length > 4000) return NextResponse.json({ error: "INVALID_OPERATIONS_COMMAND" }, { status: 400 });
  const { data, error } = await auth.serviceClient.rpc("homecare_update_damage_case", { p_tenant: auth.tenantId, p_id: input.id, p_revision: input.revision, p_status: input.status, p_note: input.note, p_actor: auth.user.id });
  if (error) return NextResponse.json({ error: error.message.includes("REVISION_CONFLICT") ? "REVISION_CONFLICT" : "OPERATIONS_UNAVAILABLE" }, { status: 409 });
  return NextResponse.json({ revision: data }, { headers });
}
