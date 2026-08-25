import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PortalNotifyPayload = {
  bcc?: string;
  body?: string;
  replyTo?: string;
  subject?: string;
  to?: string;
};

async function sendPortalNotification(payload: Required<Pick<PortalNotifyPayload, "body" | "subject">> & { bcc?: string; replyTo?: string; to?: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se";
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY fehlt.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      bcc: payload.bcc ? [payload.bcc] : undefined,
      from: `Kolaretorp Service AB <${fromAddress}>`,
      reply_to: payload.replyTo || undefined,
      subject: payload.subject,
      text: payload.body,
      to: [payload.to || "info@kolaretorp.se"],
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Resend konnte die Portal-Nachricht nicht senden: ${response.status} ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as PortalNotifyPayload;
    const subject = payload.subject?.trim();
    const body = payload.body?.trim();
    const bcc = payload.bcc?.trim();
    const to = payload.to?.trim();

    if (!subject || !body) {
      return NextResponse.json({ error: "Betreff und Nachricht sind erforderlich." }, { status: 400 });
    }

    const providerResponse = await sendPortalNotification({ bcc, body, replyTo: payload.replyTo?.trim(), subject, to });
    return NextResponse.json({ providerResponse, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal-Benachrichtigung konnte nicht versendet werden.";
    return NextResponse.json({ error: message, sent: false }, { status: 500 });
  }
}
