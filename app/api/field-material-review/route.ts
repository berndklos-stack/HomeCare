import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { stockMaterialLines } from "@/lib/jobStock";
import { reviewedStockMaterials, type ReviewedMaterial } from "@/lib/fieldMaterialReview";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const materialColumns = "name,sku,unit,category,sales_price,currency,tax_rate,accounting_account";
export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const params = new URL(request.url).searchParams, job = params.get("job"), date = params.get("date");
  if (!job || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "INVALID_MATERIAL_REVIEW" }, { status: 400 });
  try {
    const review = await auth.client.from("homecare_field_material_reviews").select("id").eq("tenant_id", auth.tenantId).eq("job_id", job).eq("execution_date", date).maybeSingle();
    if (review.error) throw review.error;
    if (review.data) return materialResult(auth, job);
    const orders: { id: string; destination_id: string }[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await auth.client.from("homecare_picking_orders").select("id,destination_id").eq("tenant_id", auth.tenantId).eq("job_id", job).eq("status", "loaded").order("id").range(offset, offset + 499);
      if (result.error) throw result.error;
      orders.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) break;
    }
    const lines = new Map<string, { material_id: string; source_id: string; allocated_quantity: number; material: unknown }>();
    for (const order of orders) for (let offset = 0; ; offset += 500) {
      const result = await auth.client.from("homecare_picking_items").select(`material_id,picked,material:homecare_materials(${materialColumns})`).eq("tenant_id", auth.tenantId).eq("order_id", order.id).order("material_id").range(offset, offset + 499);
      if (result.error) throw result.error;
      for (const item of result.data ?? []) {
        const key = `${item.material_id}:${order.destination_id}`, previous = lines.get(key);
        lines.set(key, { material_id: item.material_id, source_id: order.destination_id, allocated_quantity: Number(item.picked) + (previous?.allocated_quantity ?? 0), material: item.material });
      }
      if (!result.data || result.data.length < 500) break;
    }
    return NextResponse.json({ lines: [...lines.values()], reviewed: Boolean(review.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.write");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "E2E_MOCK_REQUIRED" }, { status: 503 });
  const input = await request.json().catch(() => null);
  const validQuantity = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
  if (!input || !uuid.test(input.id) || typeof input.job !== "string" || !input.job || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
    || !Number.isSafeInteger(input.revision) || input.revision < 1 || typeof input.allConsumed !== "boolean" || typeof input.additionalUsed !== "boolean"
    || !Array.isArray(input.lines) || input.lines.length > 100 || input.lines.some((line: Record<string, unknown>) => !line || typeof line.material_id !== "string" || !line.material_id || typeof line.source_id !== "string" || !line.source_id || !validQuantity(line.allocated_quantity) || !validQuantity(line.consumed_quantity) || typeof line.additional !== "boolean")) {
    return NextResponse.json({ error: "INVALID_MATERIAL_REVIEW" }, { status: 400 });
  }
  const result = await auth.serviceClient.rpc("homecare_review_field_material", { p_tenant: auth.tenantId, p_id: input.id, p_job: input.job, p_date: input.date, p_revision: input.revision, p_all: input.allConsumed, p_additional: input.additionalUsed, p_lines: input.lines, p_actor: auth.user.id });
  if (result.error) return NextResponse.json({ error: ["MATERIAL_REVIEW_CHANGED", "INSUFFICIENT_STOCK", "JOB_NOT_OPEN", "JOB_NOT_BILLABLE", "PICKING_INVALID_VEHICLE", "MATERIAL_NOT_ACTIVE", "LOCATION_NOT_ACTIVE", "INVALID_MATERIAL_REVIEW"].find((key) => result.error.message.includes(key)) ?? "OPERATIONS_UNAVAILABLE" }, { status: 409 });
  return materialResult(auth, input.job);
}

async function materialResult(auth: Exclude<Awaited<ReturnType<typeof requireApiAuth>>, NextResponse>, job: string) {
  try {
    const movements: Parameters<typeof stockMaterialLines>[0] = [];
    const reviews: ReviewedMaterial[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await auth.client.from("homecare_stock_movements").select("id,quantity,source_id,billing_data,billing_source_id").eq("tenant_id", auth.tenantId).eq("job_id", job).not("billing_data", "is", null).order("id").range(offset, offset + 499);
      if (result.error) throw result.error;
      movements.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const result = await auth.client.from("homecare_field_material_review_items").select(`material_id,review:homecare_field_material_reviews!inner(job_id),material:homecare_materials(${materialColumns})`).eq("tenant_id", auth.tenantId).eq("review.job_id", job).order("review_id").order("material_id").order("source_id").order("additional").range(offset, offset + 499);
      if (result.error) throw result.error;
      reviews.push(...(result.data ?? []) as unknown as ReviewedMaterial[]);
      if (!result.data || result.data.length < 500) break;
    }
    return NextResponse.json({ stockMaterialItems: reviewedStockMaterials(stockMaterialLines(movements), reviews) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "OPERATIONS_UNAVAILABLE" }, { status: 503 }); }
}
