import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { ApiAuthContext } from "@/lib/server/apiAuth";
import { platformTenantId } from "@/lib/administration";

export function isPlatformAdmin(userId: string, tenantId?: string) {
  return tenantId === platformTenantId && (process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean).includes(userId);
}
export function administrationResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function administrationError(error: unknown) {
  const code = typeof error === "object" && error ? String((error as { code?: string }).code ?? "") : "";
  const message = error instanceof Error ? error.message : typeof error === "object" && error ? String((error as { message?: string }).message ?? "") : "";
  const known: Record<string, string> = {
    LAST_OWNER_PROTECTED: "Der letzte aktive Eigentümer kann nicht entfernt oder deaktiviert werden.",
    MEMBER_ALREADY_EXISTS: "Dieser Benutzer hat bereits einen Firmenzugang.",
    INVITATION_ALREADY_EXISTS: "Eine Einladung ist bereits vorhanden. Bitte erneut senden.",
    INVITATION_ACCEPTANCE_REQUIRED: "Die Einladung muss zuerst angenommen werden.",
    ROLE_FORBIDDEN: "Diese Rolle darfst du nicht vergeben.", OWNER_CHANGE_FORBIDDEN: "Nur Eigentümer dürfen Eigentümerzugänge ändern.",
    MEMBER_NOT_FOUND: "Benutzer wurde in dieser Firma nicht gefunden.", EMPLOYEE_NOT_FOUND: "Mitarbeiter wurde in dieser Firma nicht gefunden.",
    USER_LIMIT_REACHED: "Das Benutzerlimit dieser Firma ist erreicht. Bitte die zentrale Administration kontaktieren.",
    USER_LIMIT_BELOW_USAGE: "Das Limit liegt unter der Zahl vorhandener Firmenzugänge. Bitte zuerst Zugänge entziehen.",
    PASSWORD_RESET_COOLDOWN: "Ein Passwort-Reset wurde bereits angefordert. Bitte eine Minute warten.",
    PASSWORD_RESET_NOT_ALLOWED: "Für diesen Zugang ist kein Passwort-Reset möglich. Bitte gegebenenfalls die Einladung erneut senden.",
  };
  const key = Object.keys(known).find(item => message.includes(item));
  return administrationResponse({ error: key ? known[key] : code === "23505" ? "Die Zuordnung besteht bereits." : "Änderung nicht gespeichert. Bitte Angaben und Berechtigung prüfen." }, code === "42501" ? 403 : code === "P0002" ? 404 : 400);
}
export function preventAdministrationTestWrites(request: Request) {
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1" && request.headers.get("x-workcore-e2e-bypass") === "1") {
    return administrationResponse({ error: "Administrationsänderungen sind mit dem UI-Testzugang gesperrt." }, 503);
  }
  return null;
}
export async function invitationIdentity(admin: SupabaseClient, email: string) {
  const found = await admin.rpc("homecare_find_auth_user", { p_email: email });
  if (found.error) throw found.error;
  if (found.data) return found.data as string;
  // Auth owns identity creation. Never create a local password or a duplicate user.
  const created = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: invitationRedirect() } });
  if (created.error || !created.data.user) {
    const retry = await admin.rpc("homecare_find_auth_user", { p_email: email });
    if (retry.error || !retry.data) throw created.error ?? new Error("INVITATION_IDENTITY_FAILED");
    return retry.data as string;
  }
  return created.data.user.id;
}
function invitationRedirect() {
  const origin = process.env.WORKCORE_APP_URL;
  if (!origin || new URL(origin).protocol !== "https:") throw new Error("WORKCORE_APP_URL_REQUIRED");
  return new URL("/auth/accept", origin).toString();
}
export async function deliverInvitation(auth: Pick<ApiAuthContext, "serviceClient">, invitationId: string, tenantId: string) {
  const admin = auth.serviceClient;
  const invitation = await admin.from("homecare_user_invitations").select("id,email,auth_user_id,delivery_status,last_sent_at")
    .eq("tenant_id", tenantId).eq("id", invitationId).in("delivery_status", ["pending", "sent", "failed"]).single();
  if (invitation.error || !invitation.data) throw new Error("INVITATION_NOT_FOUND");
  const row = invitation.data;
  // CAS lease prevents parallel sends and gives delivery retries a one-minute cooldown.
  const now = new Date().toISOString();
  const claim = admin.from("homecare_user_invitations").update({ last_sent_at: now, delivery_status: "pending", expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .eq("tenant_id", tenantId).eq("id", invitationId).in("delivery_status", ["pending", "sent", "failed"]);
  const leased = await (row.last_sent_at ? claim.eq("last_sent_at", row.last_sent_at).lt("last_sent_at", new Date(Date.now() - 60000).toISOString()) : claim.is("last_sent_at", null)).select("id");
  if (leased.error || !leased.data?.length) return { sent: false, error: "Einladung wird bereits versandt. Bitte eine Minute warten." };
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw new Error("MAIL_NOT_CONFIGURED");
    const user = await admin.auth.admin.getUserById(row.auth_user_id);
    if (user.error || user.data.user.email?.toLowerCase() !== row.email.toLowerCase()) throw new Error("IDENTITY_MISMATCH");
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email, options: { redirectTo: invitationRedirect() } });
    if (link.error || link.data.user.id !== row.auth_user_id || !link.data.properties.action_link) throw new Error("AUTH_LINK_FAILED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `invitation-${invitationId}-${now}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [row.email], subject: "WorkCore: Einladung zur Firma", text: `Du wurdest zu WorkCore eingeladen. Melde dich an, um den Firmenzugang zu aktivieren:\n\n${link.data.properties.action_link}\n\nWenn du diese Einladung nicht erwartest, ignoriere diese E-Mail.` }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("MAIL_DELIVERY_FAILED");
    const saved = await admin.from("homecare_user_invitations").update({ delivery_status: "sent", delivery_error: null }).eq("tenant_id", tenantId).eq("id", invitationId).eq("last_sent_at", now).eq("delivery_status", "pending");
    if (saved.error) throw saved.error;
    return { sent: true };
  } catch {
    await admin.from("homecare_user_invitations").update({ delivery_status: "failed", delivery_error: "Versand fehlgeschlagen; erneutes Senden erforderlich." })
      .eq("tenant_id", tenantId).eq("id", invitationId).eq("last_sent_at", now).eq("delivery_status", "pending");
    return { sent: false, error: "Zugang vorbereitet, E-Mail nicht versandt. Bitte Konfiguration prüfen und Einladung erneut senden." };
  }
}
