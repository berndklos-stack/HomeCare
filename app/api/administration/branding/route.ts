import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationError, administrationResponse, preventAdministrationTestWrites } from "@/lib/server/administration";
import { loadCompanyBranding, readBranding, saveCompanyBranding, validateBranding } from "@/lib/server/companyBranding";

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const result = await loadCompanyBranding(auth.serviceClient, auth.tenantId);
  if (result.error) return administrationError(result.error);
  if (!result.data) return administrationResponse({ error: "Bitte zuerst die Firmenstammdaten speichern." }, 409);
  return administrationResponse({ branding: readBranding(result.data.value ?? {}), revision: result.data.revision });
}

export async function PATCH(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 1) return administrationResponse({ error: "Versionsstand fehlt. Bitte neu laden." }, 400);
  let branding;
  try { branding = validateBranding(body.branding); } catch (cause) { return administrationResponse({ error: (cause as Error).message }, 400); }
  try {
    const result = await saveCompanyBranding(auth.serviceClient, auth.tenantId, body.revision, branding);
    if (result.error) return administrationError(result.error);
    if (result.conflict) return administrationResponse({ error: "Die Firmenstammdaten wurden zwischenzeitlich geändert. Bitte neu laden; deine Eingaben bleiben erhalten." }, 409);
    return administrationResponse({ branding, revision: result.revision });
  } catch { return administrationResponse({ error: "Branding konnte nicht gespeichert werden. Bitte Firmenstammdaten prüfen." }, 400); }
}
