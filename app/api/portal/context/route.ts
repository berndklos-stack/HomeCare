import { NextResponse } from "next/server";
import { isAuthError, requirePortalAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePortalAuth(request);
  if (isAuthError(auth)) return auth;
  const { customerId, tenantId, tenantName } = auth.access;
  const db = auth.serviceClient;
  const [customer, primaryContact, objects, jobs, billing, messages] = await Promise.all([
    db.from("homecare_customers").select("id,name").eq("tenant_id", tenantId).eq("id", customerId).is("deleted_at", null).maybeSingle(),
    db.from("homecare_customer_contacts").select("email").eq("tenant_id", tenantId).eq("customer_id", customerId).eq("is_primary", true).is("deleted_at", null).maybeSingle(),
    db.from("homecare_objects").select("id,name,address").eq("tenant_id", tenantId).eq("owner_customer_id", customerId).eq("archived", false).is("deleted_at", null),
    db.from("homecare_jobs").select("id,title,status,due_date,object_id").eq("tenant_id", tenantId).eq("customer_id", customerId).not("status", "in", "(offerte,storniert)").is("deleted_at", null),
    db.from("homecare_billing_items").select("id,label,invoice_number,invoice_status,due_date").eq("tenant_id", tenantId).eq("customer_id", customerId).is("deleted_at", null),
    db.from("homecare_portal_messages").select("id,subject,message,created_at,status").eq("tenant_id", tenantId).eq("customer_id", customerId).is("deleted_at", null),
  ]);
  if (customer.error || !customer.data) return NextResponse.json({ error: "Kundenzuordnung wurde nicht gefunden." }, { status: 403 });
  const objectIds = (objects.data ?? []).map((item) => item.id);
  const reports = objectIds.length
    ? await db.from("homecare_reports").select("id,title,report_date,summary,object_id").eq("tenant_id", tenantId).eq("visible_to_customer", true).is("deleted_at", null).in("object_id", objectIds)
    : { data: [], error: null };
  if (customer.error || !customer.data) {
    return NextResponse.json({ error: "Kundenzugang ist nicht mehr aktiv." }, { status: 404 });
  }
  const error = primaryContact.error || objects.error || jobs.error || billing.error || messages.error || reports.error;
  if (error) return NextResponse.json({ error: "Portaldaten konnten nicht sicher geladen werden." }, { status: 500 });
  return NextResponse.json({
    billing: billing.data ?? [], customer: { ...customer.data, email: primaryContact.data?.email ?? "" }, jobs: jobs.data ?? [], messages: messages.data ?? [],
    objects: objects.data ?? [], reports: reports.data ?? [], tenant: { id: tenantId, name: tenantName },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
