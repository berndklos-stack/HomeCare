import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationError, administrationResponse, isPlatformAdmin, preventAdministrationTestWrites } from "@/lib/server/administration";
import { companyModules } from "@/lib/administration";

export async function PATCH(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  if (!isPlatformAdmin(auth.user.id, auth.tenantId)) return administrationResponse({ error: "Plattformberechtigung erforderlich." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || !companyModules.includes(body.module) || typeof body.enabled !== "boolean") return administrationResponse({ error: "Modulauswahl prüfen." }, 400);
  const result = await auth.serviceClient.rpc("homecare_admin_module", { p_tenant: auth.tenantId, p_actor: auth.user.id, p_module: body.module, p_enabled: body.enabled });
  return result.error ? administrationError(result.error) : administrationResponse({ ok: true });
}
