import type { ApiAuthContext } from "./apiAuth";
import { administrationResponse, isPlatformAdmin } from "./administration";
import { validUuid } from "@/lib/administration";

export async function companyAdministrationScope(auth: ApiAuthContext, requested: unknown) {
  if (requested == null || requested === auth.tenantId) return { tenantId: auth.tenantId, homeTenantId: auth.tenantId, platform: false };
  if (!validUuid(requested)) return administrationResponse({ error: "Firma prüfen." }, 400);
  if (!isPlatformAdmin(auth.user.id, auth.tenantId) || !auth.membership.permissions.includes("tenant.admin")) return administrationResponse({ error: "Plattformberechtigung erforderlich." }, 403);
  const company = await auth.serviceClient.rpc("homecare_platform_company_detail", { p_actor: auth.user.id, p_home: auth.tenantId, p_tenant: requested });
  if (company.error || !company.data || company.data.archived) return administrationResponse({ error: "Firma nicht verfügbar oder gesperrt." }, 403);
  return { tenantId: requested, homeTenantId: auth.tenantId, platform: true };
}
