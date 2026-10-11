import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { membershipAllows } from "@/lib/authModel";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (!membershipAllows(auth.membership, "data.write") || !membershipAllows(auth.membership, "communication.send")) return failure("PERMISSION_DENIED", 403);
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return failure("E2E_MOCK_REQUIRED", 503);
  try {
    const input = await request.json();
    if (!input || !["preview", "send"].includes(input.action) || typeof input.id !== "string" || !uuid.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 1) return failure("INVALID_OPERATIONS_COMMAND", 400);
    const { data: item, error } = await auth.client.from("homecare_supplier_damage_cases").select("*").eq("tenant_id", auth.tenantId).eq("id", input.id).single();
    if (error || !item) return failure("COMPLAINT_CHANGED", 404);
    if (item.complaint_sent_at) return NextResponse.json({ sent: true, to: item.complaint_sent_to }, { headers });
    if (item.revision !== input.revision) return failure("COMPLAINT_CHANGED", 409);
    const supplierResult = await auth.client.from("homecare_suppliers").select("company,email").eq("tenant_id", auth.tenantId).eq("id", item.supplier_id).is("deleted_at", null).single();
    const receiptResult = await auth.client.from("homecare_goods_receipts").select("delivery_number,document_id").eq("tenant_id", auth.tenantId).eq("id", item.receipt_id).single();
    if (supplierResult.error || !supplierResult.data || receiptResult.error || !receiptResult.data) return failure("OPERATIONS_UNAVAILABLE", 503);
    const supplier = supplierResult.data, receipt = receiptResult.data;
    const photoResult = await auth.client.from("homecare_supplier_damage_photos").select("document_id").eq("tenant_id", auth.tenantId).eq("case_id", item.id).order("document_id");
    if (photoResult.error) return failure("COMPLAINT_ATTACHMENTS_FAILED", 503);
    const ids = [...new Set([receipt.document_id, ...(photoResult.data ?? []).map((photo) => photo.document_id)].filter(Boolean))];
    if (!ids.length || ids.length > 21) return failure("COMPLAINT_ATTACHMENTS_FAILED", 400);
    const mediaResult = await auth.client.from("homecare_media").select("id,name,storage_path").eq("tenant_id", auth.tenantId).in("id", ids).is("deleted_at", null).order("id");
    if (mediaResult.error || mediaResult.data?.length !== ids.length) return failure("COMPLAINT_ATTACHMENTS_FAILED", 503);
    const attachments: { filename: string; content: string }[] = [];
    const fingerprints: { id: string; name: string; hash: string }[] = [];
    let size = 0;
    for (const media of mediaResult.data) {
      if (!media.storage_path.startsWith(`${auth.tenantId}/purchase-documents/`) || media.storage_path.includes("..")) return failure("COMPLAINT_ATTACHMENTS_FAILED", 403);
      const result = await auth.serviceClient.storage.from("homecare-private-media").download(media.storage_path);
      if (result.error || !result.data || !/^(application\/pdf|image\/(jpeg|png|webp|gif|heic|heif))$/i.test(result.data.type)) return failure("COMPLAINT_ATTACHMENTS_FAILED", 503);
      size += result.data.size;
      if (size > 20 * 1024 * 1024) return failure("COMPLAINT_ATTACHMENTS_TOO_LARGE", 400);
      const bytes = Buffer.from(await result.data.arrayBuffer());
      attachments.push({ filename: media.name, content: bytes.toString("base64") });
      fingerprints.push({ id: media.id, name: media.name, hash: createHash("sha256").update(bytes).digest("hex") });
    }
    const language = input.language === "sv" ? "sv" : input.language === "en" ? "en" : "de";
    const labels = language === "sv" ? ["Reklamation", "Följesedelnummer", "Skadebeskrivning", "Vi reklamerar den skadade leveransen. Vänligen bekräfta mottagandet och meddela hur skadan ska åtgärdas.", "Dokument och foton bifogas."] : language === "en" ? ["Complaint", "Delivery note number", "Damage description", "We are reporting damage to this delivery. Please confirm receipt and advise how you will resolve this issue.", "Documents and photos are attached."] : ["Reklamation", "Lieferscheinnummer", "Schadensbeschreibung", "Hiermit reklamieren wir die beschädigte Lieferung. Bitte bestätigen Sie den Eingang und teilen Sie uns mit, wie der Schaden reguliert wird.", "Die Belege und Schadensfotos sind beigefügt."];
    const to = String(supplier.email ?? "").trim();
    const subject = `${labels[0]} · ${labels[1]} ${receipt.delivery_number} · ${auth.membership.tenantName}`;
    const body = [supplier.company, "", labels[3], "", `${labels[1]}: ${receipt.delivery_number}`, "", `${labels[2]}:`, item.description, "", labels[4], "", auth.membership.tenantName].join("\n");
    const token = createHash("sha256").update(JSON.stringify({ tenant: auth.tenantId, id: item.id, revision: item.revision, to, subject, body, fingerprints })).digest("hex");
    if (input.action === "preview") return NextResponse.json({ to, subject, body, token, attachments: attachments.map((attachment) => attachment.filename) }, { headers });
    if (input.token !== token) return failure("COMPLAINT_CHANGED", 409);
    if (typeof input.emailSubject !== "string" || !input.emailSubject.trim() || input.emailSubject.length > 200 || /[\r\n]/.test(input.emailSubject) || typeof input.emailBody !== "string" || !input.emailBody.trim() || input.emailBody.length > 12000) return failure("COMPLAINT_TEXT_INVALID", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return failure("SUPPLIER_EMAIL_MISSING", 400);
    if (!process.env.RESEND_API_KEY) return failure("MAIL_UNAVAILABLE", 503);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `complaint-${auth.tenantId}-${item.id}` },
      body: JSON.stringify({ from: process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se", to: [to], subject: input.emailSubject.trim(), text: input.emailBody.trim(), attachments }),
    });
    if (!response.ok) return failure("MAIL_FAILED", 502);
    const delivery = await response.json();
    if (typeof delivery.id !== "string" || !delivery.id) return failure("COMPLAINT_STATUS_PENDING", 503);
    const saved = await auth.serviceClient.rpc("homecare_record_damage_complaint", { p_tenant: auth.tenantId, p_id: item.id, p_to: to, p_message_id: delivery.id, p_subject: input.emailSubject.trim(), p_body: input.emailBody.trim(), p_actor: auth.user.id, p_note: `${labels[0]}: ${to}` });
    if (saved.error) return failure("COMPLAINT_STATUS_PENDING", 503);
    return NextResponse.json({ sent: true, to }, { headers });
  } catch { return failure("MAIL_FAILED", 503); }
}
