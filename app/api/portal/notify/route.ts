import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PortalNotifyPayload = {
  body?: string;
  replyTo?: string;
  subject?: string;
};

async function sendPortalNotification(payload: Required<Pick<PortalNotifyPayload, "body" | "subject">> & { replyTo?: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY fehlt.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: "Kolaretorp Service AB <info@kolaretorp.se>",
      reply_to: payload.replyTo || undefined,
      subject: payload.subject,
      text: payload.body,
      to: ["info@kolaretorp.se"],
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const result = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) {
    throw new Error(result.message || "Portal-Benachrichtigung konnte nicht versendet werden.");
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as PortalNotifyPayload;
    const subject = payload.subject?.trim();
    const body = payload.body?.trim();

    if (!subject || !body) {
      return NextResponse.json({ error: "Betreff und Nachricht sind erforderlich." }, { status: 400 });
    }

    await sendPortalNotification({ body, replyTo: payload.replyTo?.trim(), subject });
    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal-Benachrichtigung konnte nicht versendet werden.";
    return NextResponse.json({ error: message, sent: false }, { status: 500 });
  }
}
