import type { SupabaseClient } from "@supabase/supabase-js";

export async function deliverMemberPasswordReset(admin: SupabaseClient, identity: { userId: string; email: string }) {
  try {
    const origin = process.env.WORKCORE_APP_URL;
    if (!origin || new URL(origin).protocol !== "https:" || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw new Error("MAIL_NOT_CONFIGURED");
    const link = await admin.auth.admin.generateLink({ type: "recovery", email: identity.email, options: { redirectTo: new URL("/auth/accept", origin).toString() } });
    if (link.error || link.data.user.id !== identity.userId || !link.data.properties.action_link) throw new Error("AUTH_LINK_FAILED");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `password-reset-${crypto.randomUUID()}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [identity.email], subject: "WorkCore: Passwort zurücksetzen", text: `Für deinen WorkCore-Zugang wurde ein Passwort-Reset angefordert. Lege über diesen sicheren Link selbst ein neues Passwort fest:\n\n${link.data.properties.action_link}\n\nWenn du keinen Passwortwechsel erwartest, ignoriere diese Nachricht. Dein bisheriges Passwort bleibt dann unverändert.` }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("MAIL_DELIVERY_FAILED");
    return { sent: true };
  } catch { return { sent: false, error: "Die E-Mail zum Passwort-Reset konnte nicht versandt werden. Bitte Konfiguration prüfen und später erneut versuchen." }; }
}
