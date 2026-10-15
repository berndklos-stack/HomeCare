import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationError, administrationResponse, isPlatformAdmin, preventAdministrationTestWrites, invitationIdentity, deliverInvitation } from "@/lib/server/administration";
import { validEmail, validUuid } from "@/lib/administration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (!auth.membership.permissions.some(p => ["tenant.admin", "members.manage", "roles.manage"].includes(p))) return administrationResponse({ error: "Keine Administrationsberechtigung." }, 403);
  const blocked = preventAdministrationTestWrites(request);
  if (blocked) return blocked; // UI tests provide fixtures; never read production with bypass credentials.
  const query = new URL(request.url).searchParams;
  const search = query.get("search") ?? "", status = query.get("status") ?? "", role = query.get("role") || null, page = Number(query.get("page") ?? "0");
  if (search.length > 120 || !["", "active", "suspended", "revoked"].includes(status) || (role && !validUuid(role)) || !Number.isSafeInteger(page) || page < 0 || page > 100000) return administrationResponse({ error: "Filter prüfen." }, 400);
  try {
    const canManageMembers = auth.membership.permissions.includes("members.manage");
    const canManageCompany = auth.membership.permissions.includes("tenant.admin");
    const client = auth.serviceClient;
    const companyFields = canManageCompany ? "id,name,country_code,locale,timezone,organization_number,vat_number,account_type,pilot_start_date,pilot_end_date,contact_person,internal_label,administration_notes" : "id,name";
    const company = await client.from("homecare_tenants").select(companyFields).eq("id", auth.tenantId).single();
    const roles = await auth.client.from("homecare_roles").select("id,key,name,permissions,system_role").eq("tenant_id", auth.tenantId).order("created_at");
    const directory = canManageMembers ? await client.rpc("homecare_admin_directory", { p_tenant: auth.tenantId, p_actor: auth.user.id, p_search: search, p_status: status, p_role: role, p_page: page }) : { data: { members: [], total: 0 }, error: null };
    const employees = canManageMembers ? await client.from("homecare_personnel").select("id,first_name,last_name,links:homecare_tenant_memberships!membership_employee_tenant_fk(user_id)").eq("tenant_id", auth.tenantId).is("deleted_at", null).eq("archived", false).order("last_name").limit(1000) : { data: [], error: null };
    const modules = canManageCompany ? await client.from("homecare_tenant_modules").select("module,enabled").eq("tenant_id", auth.tenantId) : { data: [], error: null };
    const feedback = canManageCompany ? await client.from("homecare_feedback").select("id,category,message,created_at,app_version,page_path,user_agent").eq("tenant_id", auth.tenantId).order("created_at", { ascending: false }).limit(100) : { data: [], error: null };
    for (const result of [company, roles, directory, employees, modules, feedback]) if (result.error) throw result.error;
    return administrationResponse({ company: company.data, roles: roles.data, members: directory.data.members, memberTotal: directory.data.total, employees: (employees.data ?? []).map(e => ({ id: e.id, first_name: e.first_name, last_name: e.last_name, assignedUserId: e.links[0]?.user_id ?? null })), modules: modules.data, feedback: feedback.data,
      canManageMembers, canManageCompany, canManageRoles: auth.membership.permissions.includes("roles.manage"), platformAdmin: isPlatformAdmin(auth.user.id), owner: auth.membership.roleKey === "owner" });
  } catch (error) { return administrationError(error); }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "members.manage");
  if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !validEmail(body.email) || !validUuid(body.roleId) || (body.employeeId != null && (typeof body.employeeId !== "string" || body.employeeId.length > 200))) return administrationResponse({ error: "E-Mail, Rolle und Mitarbeiter prüfen." }, 400);
  const email = body.email.trim().toLowerCase();
  try {
    // Check role and duplicates before creating any Auth identity.
    const role = await auth.serviceClient.from("homecare_roles").select("key").eq("tenant_id", auth.tenantId).eq("id", body.roleId).single();
    if (role.error || (role.data.key === "owner" && auth.membership.roleKey !== "owner")) return administrationResponse({ error: "Diese Rolle darfst du nicht vergeben." }, 403);
    const pending = await auth.serviceClient.from("homecare_user_invitations").select("id").eq("tenant_id", auth.tenantId).eq("email", email).in("delivery_status", ["pending", "sent", "failed"]);
    if (pending.error) throw pending.error;
    if (pending.data.length) return administrationResponse({ error: "Einladung bereits vorhanden. Bitte erneut senden." }, 409);
    const userId = await invitationIdentity(auth.serviceClient, email);
    const result = await auth.serviceClient.rpc("homecare_admin_member", { p_tenant: auth.tenantId, p_actor: auth.user.id, p_action: "invite", p_email: email, p_role: body.roleId, p_employee: body.employeeId || null, p_user: userId });
    if (result.error) throw result.error;
    const delivery = await deliverInvitation(auth, result.data.invitationId, auth.tenantId);
    return administrationResponse({ ok: true, ...delivery }, 201);
  } catch (error) { return administrationError(error); }
}

export async function PATCH(request: Request) {
  const auth = await requireApiAuth(request, "members.manage");
  if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !["resend", "role", "employee", "suspend", "reactivate", "remove"].includes(body.action) || !validUuid(body.memberId)) return administrationResponse({ error: "Ungültige Benutzeraktion." }, 400);
  if (body.action === "role" && !validUuid(body.roleId)) return administrationResponse({ error: "Rolle fehlt." }, 400);
  if (body.action === "employee" && body.employeeId != null && (typeof body.employeeId !== "string" || body.employeeId.length > 200)) return administrationResponse({ error: "Mitarbeiter prüfen." }, 400);
  try {
    if (body.action === "resend") {
      const member = await auth.serviceClient.from("homecare_tenant_memberships").select("user_id,role:homecare_roles!homecare_tenant_memberships_role_id_fkey(key)").eq("tenant_id", auth.tenantId).eq("id", body.memberId).single();
      if (member.error) throw member.error;
      const role = member.data.role as unknown as { key: string };
      if (role.key === "owner" && auth.membership.roleKey !== "owner") return administrationResponse({ error: "Nur Eigentümer dürfen diese Einladung erneut senden." }, 403);
      const invitation = await auth.serviceClient.from("homecare_user_invitations").select("id").eq("tenant_id", auth.tenantId).eq("auth_user_id", member.data.user_id).in("delivery_status", ["pending", "sent", "failed"]).single();
      if (invitation.error) throw invitation.error;
      return administrationResponse(await deliverInvitation(auth, invitation.data.id, auth.tenantId));
    }
    const result = await auth.serviceClient.rpc("homecare_admin_member", { p_tenant: auth.tenantId, p_actor: auth.user.id, p_action: body.action, p_target: body.memberId, p_role: body.action === "role" ? body.roleId : null, p_employee: body.employeeId || null });
    if (result.error) throw result.error;
    return administrationResponse({ ok: true });
  } catch (error) { return administrationError(error); }
}
