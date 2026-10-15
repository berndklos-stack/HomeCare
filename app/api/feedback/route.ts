import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationError, administrationResponse, preventAdministrationTestWrites } from "@/lib/server/administration";
import { feedbackPath } from "@/lib/administration";
import { appVersion } from "@/lib/appVersion";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.read"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !["problem", "improvement", "feature"].includes(body.category) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 5000) return administrationResponse({ error: "Kategorie und Nachricht prüfen." }, 400);
  const result = await auth.client.from("homecare_feedback").insert({ tenant_id: auth.tenantId, user_id: auth.user.id, category: body.category, message: body.message.trim(), app_version: appVersion.version,
    page_path: feedbackPath(typeof body.pagePath === "string" ? body.pagePath : "/"), user_agent: (request.headers.get("user-agent") ?? "").slice(0, 512) });
  return result.error ? administrationError(result.error) : administrationResponse({ ok: true }, 201);
}
