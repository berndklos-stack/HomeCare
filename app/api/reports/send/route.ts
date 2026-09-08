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
  idempotencyKey?: string;
  subject?: string;
  to?: string;
};

type SendResult = {
  delivery?: unknown;
  sent: boolean;
};

const sentMailCache = new Map<string, { createdAt: number; result?: SendResult; status: "done" | "sending" }>();
const sentMailCacheTtlMs = 10 * 60 * 1000;

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
  let idempotencyKey = "";
  try {
    const payload = await request.json() as SendReportPayload;
    const requiredFields: Array<keyof SendReportPayload> = ["attachmentBase64", "body", "filename", "subject", "to"];
    const missing = requiredFields.filter((field) => !payload[field]);

    if (missing.length > 0) {
      return NextResponse.json({ error: `Pflichtfelder fehlen: ${missing.join(", ")}` }, { status: 400 });
    }

    const now = Date.now();
    for (const [key, entry] of sentMailCache.entries()) {
      if (now - entry.createdAt > sentMailCacheTtlMs) sentMailCache.delete(key);
    }

    idempotencyKey = payload.idempotencyKey?.trim() || "";
    if (idempotencyKey) {
      const cached = sentMailCache.get(idempotencyKey);
      if (cached?.status === "done" && cached.result) {
        return NextResponse.json({ ...cached.result, duplicate: true });
      }
      if (cached?.status === "sending") {
        return NextResponse.json({ duplicate: true, sent: false, status: "sending" }, { status: 409 });
      }
      sentMailCache.set(idempotencyKey, { createdAt: now, status: "sending" });
    }

    const delivery = await sendResendReportMail(payload as Required<Pick<SendReportPayload, "attachmentBase64" | "body" | "filename" | "subject" | "to">> & { attachments?: SendReportPayload["attachments"]; cc?: string });
    const result = { delivery, sent: true };
    if (idempotencyKey) sentMailCache.set(idempotencyKey, { createdAt: now, result, status: "done" });
    return NextResponse.json(result);
  } catch (error) {
    if (idempotencyKey) sentMailCache.delete(idempotencyKey);
    const message = error instanceof Error ? error.message : "Bericht konnte nicht gesendet werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
