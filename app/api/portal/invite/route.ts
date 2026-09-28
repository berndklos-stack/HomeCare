import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

type InvitePayload = {
  customerId?: string;
  email?: string;
};

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "customers.manage");
  if (isAuthError(auth)) return auth;

  const body = await request.json().catch(() => ({})) as InvitePayload;
  const customerId = body.customerId?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!customerId || !email) {
    return NextResponse.json({ error: "Kunde und E-Mail sind erforderlich." }, { status: 400 });
  }

  const { data: customer, error: customerError } = await auth.serviceClient
    .from("homecare_customers")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (customerError || !customer) {
    return NextResponse.json({ error: "Kunde wurde in dieser Firma nicht gefunden." }, { status: 404 });
  }

  let { data: linkedUserId, error: linkError } = await auth.serviceClient.rpc("homecare_grant_portal_access", {
    p_customer_id: customerId,
    p_email: email,
    p_tenant_id: auth.tenantId,
  });

  let invited = false;
  if (!linkError && !linkedUserId) {
    const redirectTo = process.env.CUSTOMER_PORTAL_URL || new URL("/portal", request.url).toString();
    const { error: inviteError } = await auth.serviceClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });
    invited = true;
    const linked = await auth.serviceClient.rpc("homecare_grant_portal_access", {
      p_customer_id: customerId,
      p_email: email,
      p_tenant_id: auth.tenantId,
    });
    linkedUserId = linked.data;
    linkError = linked.error;
  }

  if (linkError || !linkedUserId) {
    return NextResponse.json({ error: linkError?.message || "Portalzugang konnte nicht zugeordnet werden." }, { status: 500 });
  }

  return NextResponse.json({ invited, ok: true });
}
