import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationError, administrationResponse, deliverInvitation, invitationIdentity, isPlatformAdmin, preventAdministrationTestWrites } from "@/lib/server/administration";
import { validateCompany, validateCompanyUpdate, validUuid } from "@/lib/administration";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  if (!isPlatformAdmin(auth.user.id)) return administrationResponse({ error: "Plattformberechtigung erforderlich." }, 403);
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const params = new URL(request.url).searchParams;
  const tenantId = params.get("tenantId");
  if (tenantId) {
    if (!validUuid(tenantId)) return administrationResponse({ error: "Ungültige Firma." }, 400);
    const detail = await auth.serviceClient.rpc("homecare_platform_company_detail", { p_actor: auth.user.id, p_home: auth.tenantId, p_tenant: tenantId });
    if (detail.error) return administrationError(detail.error);
    return detail.data ? administrationResponse(detail.data) : administrationResponse({ error: "Firma nicht gefunden." }, 404);
  }
  const page = Number(params.get("page") ?? "0");
  const search = (params.get("search") ?? "").trim();
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000 || search.length > 120) return administrationResponse({ error: "Suche oder Seite prüfen." }, 400);
  let query = auth.serviceClient.from("homecare_tenants").select("id,name,account_type,archived,country_code,email,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const result = await query.range(page * 50, page * 50 + 49);
  if (result.error) return administrationError(result.error);
  return administrationResponse({ companies: result.data, total: result.count ?? 0, page });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  if (!isPlatformAdmin(auth.user.id)) return administrationResponse({ error: "Plattformberechtigung erforderlich." }, 403);
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !validUuid(body.requestId)) return administrationResponse({ error: "Vorgangskennung fehlt." }, 400);
  let company;
  try { company = validateCompany(body.company); } catch (error) { return administrationResponse({ error: (error as Error).message }, 400); }
  try {
    const existing = await auth.serviceClient.from("homecare_tenants").select("id,onboarded_by,email,name,country_code,locale,timezone,organization_number,vat_number,account_type,pilot_start_date,pilot_end_date,contact_person,internal_label,administration_notes").eq("id", body.requestId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && (existing.data.onboarded_by !== auth.user.id || existing.data.email !== company.ownerEmail)) return administrationResponse({ error: "Vorgangskennung bereits verwendet." }, 409);
    if (existing.data) {
      const expected = { name: company.name, country_code: company.country, locale: company.locale, timezone: company.timezone, organization_number: company.organizationNumber, vat_number: company.vatNumber, account_type: company.accountType, pilot_start_date: company.pilotStartDate, pilot_end_date: company.pilotEndDate, contact_person: company.contactPerson, internal_label: company.internalLabel, administration_notes: company.notes };
      const stored = existing.data as Record<string, unknown>;
      const modules = await auth.serviceClient.from("homecare_tenant_modules").select("module").eq("tenant_id", body.requestId).eq("enabled", true);
      if (modules.error) throw modules.error;
      if (Object.entries(expected).some(([key, value]) => (stored[key] ?? "") !== value) || JSON.stringify(modules.data.map(m => m.module).sort()) !== JSON.stringify([...company.modules].sort())) return administrationResponse({ error: "Diese Anlage wurde bereits mit anderen Angaben gespeichert. Bitte die angelegte Firma prüfen." }, 409);
    }
    if (!existing.data) {
      const owner = await invitationIdentity(auth.serviceClient, company.ownerEmail);
      const result = await auth.serviceClient.rpc("homecare_onboard_company", { p_id: body.requestId, p_actor: auth.user.id, p_owner: owner, p_email: company.ownerEmail, p_company: company, p_modules: company.modules });
      if (result.error) throw result.error;
    }
    const invitation = await auth.serviceClient.from("homecare_user_invitations").select("id,delivery_status").eq("tenant_id", body.requestId).eq("email", company.ownerEmail).order("created_at", { ascending: false }).limit(1).single();
    if (invitation.error) throw invitation.error;
    const delivery = ["sent", "accepted"].includes(invitation.data.delivery_status) ? { sent: true } : await deliverInvitation(auth, invitation.data.id, body.requestId);
    return administrationResponse({ ok: true, tenantId: body.requestId, ...delivery }, existing.data ? 200 : 201);
  } catch (error) { return administrationError(error); }
}

export async function PATCH(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  if (!isPlatformAdmin(auth.user.id)) return administrationResponse({ error: "Plattformberechtigung erforderlich." }, 403);
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !validUuid(body.tenantId)) return administrationResponse({ error: "Firma fehlt." }, 400);
  if (body.action === "save") {
    if (!Number.isSafeInteger(body.revision) || body.revision < 1 || !Number.isSafeInteger(body.settingsRevision) || body.settingsRevision < 0) return administrationResponse({ error: "Versionsstand fehlt. Bitte Firma neu laden." }, 400);
    let company;
    try { company = validateCompanyUpdate(body.company); } catch (error) { return administrationResponse({ error: (error as Error).message }, 400); }
    const result = await auth.serviceClient.rpc("homecare_platform_company_update", {
      p_actor: auth.user.id, p_home: auth.tenantId, p_tenant: body.tenantId,
      p_revision: body.revision, p_settings_revision: body.settingsRevision, p_company: company, p_modules: company.modules,
    });
    if (result.error?.code === "40001") return administrationResponse({ error: "Die Firma wurde zwischenzeitlich geändert. Bitte neu laden; deine Eingaben bleiben erhalten." }, 409);
    return result.error ? administrationError(result.error) : administrationResponse({ ok: true });
  }
  if (body.action && body.action !== "resend") return administrationResponse({ error: "Unbekannte Aktion." }, 400);
  try {
    const company = await auth.serviceClient.from("homecare_tenants").select("id,email").eq("id", body.tenantId).eq("onboarded_by", auth.user.id).single();
    if (company.error) return administrationResponse({ error: "Firma nicht gefunden." }, 404);
    const invitation = await auth.serviceClient.from("homecare_user_invitations").select("id").eq("tenant_id", body.tenantId).eq("email", company.data.email).eq("role", "owner").in("delivery_status", ["pending", "sent", "failed"]).maybeSingle();
    if (invitation.error) throw invitation.error;
    if (!invitation.data) return administrationResponse({ error: "Keine offene Eigentümereinladung vorhanden." }, 409);
    return administrationResponse(await deliverInvitation(auth, invitation.data.id, body.tenantId));
  } catch (error) { return administrationError(error); }
}
