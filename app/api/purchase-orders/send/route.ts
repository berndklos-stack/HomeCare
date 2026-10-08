import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { membershipAllows } from "@/lib/authModel";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.read");
  if (isAuthError(auth)) return auth;
  if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "PURCHASE_MAIL_E2E_MOCK_REQUIRED" }, { status: 503 });
  if (!membershipAllows(auth.membership, "data.write") || !membershipAllows(auth.membership, "communication.send")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  try {
    const input = await request.json();
    if (!["preview", "send"].includes(input.action) || typeof input.orderId !== "string" || !Number.isSafeInteger(input.revision)) return NextResponse.json({ error: "INVALID_ORDER" }, { status: 400 });
    const { data: order, error } = await auth.client.from("homecare_purchase_orders").select("*").eq("tenant_id", auth.tenantId).eq("id", input.orderId).is("deleted_at", null).single();
    if (error || !order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    if (order.status !== "draft" || Number(order.revision) !== input.revision) return NextResponse.json({ error: "ORDER_CHANGED" }, { status: 409 });
    const { data: supplier, error: supplierError } = await auth.client.from("homecare_suppliers").select("company,email,address").eq("tenant_id", auth.tenantId).eq("id", order.supplier_id).is("deleted_at", null).single();
    if (supplierError || !supplier) return NextResponse.json({ error: "SUPPLIER_NOT_FOUND" }, { status: 404 });
    const items: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: itemError } = await auth.client.from("homecare_purchase_order_items").select("id,material_id,quantity,unit_price,revision").eq("tenant_id", auth.tenantId).eq("order_id", order.id).is("deleted_at", null).order("id").range(offset, offset + 499);
      if (itemError) throw itemError;
      items.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    if (!items.length) return NextResponse.json({ error: "ORDER_EMPTY" }, { status: 400 });
    const names = new Map<string, string>();
    for (let offset = 0; offset < items.length; offset += 100) {
      const { data, error: materialError } = await auth.client.from("homecare_materials").select("id,name").eq("tenant_id", auth.tenantId).in("id", items.slice(offset, offset + 100).map((item) => String(item.material_id)));
      if (materialError) throw materialError;
      for (const material of data ?? []) names.set(material.id, material.name);
    }
    const language = ["sv", "en"].includes(input.language) ? input.language : "de";
    const labels = language === "sv" ? ["Beställning", "Beställningsdatum", "Förväntad leverans", "Antal", "Styckpris", "Totalt"] : language === "en" ? ["Purchase order", "Order date", "Expected delivery", "Quantity", "Unit price", "Total"] : ["Bestellung", "Bestelldatum", "Erwartete Lieferung", "Menge", "Einzelpreis", "Gesamt"];
    const number = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
    const subject = `${labels[0]} ${order.order_number} · ${auth.membership.tenantName}`;
    const body = [auth.membership.tenantName, supplier.company, supplier.address || "", `${labels[1]}: ${order.order_date}`, `${labels[2]}: ${order.expected_delivery || "—"}`, "",
      ...items.map((item) => `${names.get(String(item.material_id)) ?? item.material_id}\n${labels[3]}: ${number(Number(item.quantity))} · ${labels[4]}: ${number(Number(item.unit_price))} ${order.currency}`), "",
      `${labels[5]}: ${number(items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0))} ${order.currency}`, order.notes || ""].join("\n");
    const to = String(supplier.email ?? "").trim();
    const token = createHash("sha256").update(JSON.stringify({ tenant: auth.tenantId, order, items, names: [...names].sort(([first], [second]) => first.localeCompare(second)), subject, body, to })).digest("hex");
    if (input.action === "preview") return NextResponse.json({ to, subject, body, token }, { headers: { "Cache-Control": "no-store" } });
    if (input.token !== token) return NextResponse.json({ error: "ORDER_CHANGED" }, { status: 409 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "SUPPLIER_EMAIL_MISSING" }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "MAIL_UNAVAILABLE" }, { status: 503 });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `purchase-${auth.tenantId}-${order.id}-${order.revision}` },
      body: JSON.stringify({ from: process.env.REPORT_SENDER_EMAIL || "info@kolaretorp.se", to: [to], subject, text: body }),
    });
    if (!response.ok) return NextResponse.json({ error: "MAIL_FAILED" }, { status: 502 });
    return NextResponse.json({ sent: true, to }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "MAIL_FAILED" }, { status: 503 }); }
}
