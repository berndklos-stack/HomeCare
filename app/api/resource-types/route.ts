import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") {
    return NextResponse.json({ error: "RESOURCE_TYPES_E2E_MOCK_REQUIRED" }, { status: 503 });
  }
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await auth.client.from("homecare_resource_types")
      .select("id,name,category,revision,archived,homecare_resource_type_fields(field_key,enabled,required,display_order)")
      .eq("tenant_id", auth.tenantId).order("id").range(offset, offset + 99);
    if (error) return NextResponse.json({ error: "RESOURCE_TYPES_UNAVAILABLE" }, { status: 503 });
    rows.push(...(data ?? []).map((row) => ({ id: row.id, name: row.name, category: row.category, revision: row.revision, archived: row.archived,
      fields: row.homecare_resource_type_fields.map((field: { field_key: string; enabled: boolean; required: boolean; display_order: number }) =>
        ({ key: field.field_key, enabled: field.enabled, required: field.required, order: field.display_order })) })));
    if (!data || data.length < 100) break;
  }
  return NextResponse.json({ types: rows }, { headers: { "Cache-Control": "private, no-store" } });
}
