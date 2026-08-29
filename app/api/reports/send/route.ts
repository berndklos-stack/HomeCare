import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SendReportPayload = {
  attachmentBase64?: string;
  attachments?: Array<{
    content?: string;
    contentType?: string;
    filename?: string;
  }>;
  body?: string;
  cc?: string;
  filename?: string;
  subject?: string;
  to?: string;
};

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function htmlBody(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim() ? `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>` : "<br />")
    .join("");
}

async function sendResendReportMail(payload: Required<Pick<SendReportPayload, "attachmentBase64" | "body" | "filename" | "subject" | "to">> & { attachments?: SendReportPayload["attachments"]; cc?: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se";

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY fehlt.");
  }

  const to = normalizeEmail(payload.to);
  const cc = normalizeEmail(payload.cc || "info@kolaretorp.se");
  if (!to) throw new Error("Empfänger fehlt.");

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      attachments: [
        {
          content: payload.attachmentBase64,
          filename: payload.filename,
        },
        ...(payload.attachments ?? [])
          .filter((attachment) => attachment.content && attachment.filename)
          .map((attachment) => ({
            content: attachment.content,
            content_type: attachment.contentType,
            filename: attachment.filename,
          })),
      ],
      cc: cc && cc !== to ? [cc] : undefined,
      from: `Kolaretorp Service AB <${fromAddress}>`,
      html: htmlBody(payload.body),
      subject: payload.subject,
      text: payload.body,
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const responseText = await response.text();
  if (response.ok) {
    return { from: fromAddress, providerResponse: responseText ? JSON.parse(responseText) : null, to, cc };
  }

  throw new Error(`Resend konnte den Bericht nicht senden: ${response.status} ${responseText}`);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as SendReportPayload;
    const requiredFields: Array<keyof SendReportPayload> = ["attachmentBase64", "body", "filename", "subject", "to"];
    const missing = requiredFields.filter((field) => !payload[field]);

    if (missing.length > 0) {
      return NextResponse.json({ error: `Pflichtfelder fehlen: ${missing.join(", ")}` }, { status: 400 });
    }

    const delivery = await sendResendReportMail(payload as Required<Pick<SendReportPayload, "attachmentBase64" | "body" | "filename" | "subject" | "to">> & { attachments?: SendReportPayload["attachments"]; cc?: string });
    return NextResponse.json({ delivery, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bericht konnte nicht gesendet werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
