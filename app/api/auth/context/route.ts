import { NextResponse } from "next/server";
import { loadMemberships, loadPortalAccess, serviceClient } from "@/lib/server/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { isPlatformAdmin } from "@/lib/server/administration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return NextResponse.json({ error: "Authentifizierung erforderlich." }, { status: 401 });
  const authClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sitzung ist ungültig oder abgelaufen." }, { status: 401 });
  try {
    const acceptance = await authClient.rpc("homecare_accept_invitations");
    if (acceptance.error) throw acceptance.error;
    const admin = serviceClient();
    const [memberships, portalAccess] = await Promise.all([
      loadMemberships(admin, data.user.id),
      loadPortalAccess(admin, data.user.id),
    ]);
    const requested = request.headers.get("x-workcore-tenant");
    const activeTenantId = memberships.some((item) => item.tenantId === requested)
      ? requested
      : memberships[0]?.tenantId ?? portalAccess[0]?.tenantId ?? null;
    return NextResponse.json({
      activeTenantId,
      platformAdmin: Boolean(activeTenantId && isPlatformAdmin(data.user.id, activeTenantId) && memberships.find(m => m.tenantId === activeTenantId)?.permissions.includes("tenant.admin")),
      memberships,
      portalAccess,
      user: { email: data.user.email ?? "", id: data.user.id },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Autorisierung konnte nicht geladen werden." }, { status: 500 });
  }
}
