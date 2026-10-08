import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { NextResponse } from "next/server";

function harness(file: string) {
  const tenant = "tenant-test";
  const tables: Record<string, Record<string, unknown>[]> = {
    homecare_purchase_orders: [{ id: "order-1", tenant_id: tenant, supplier_id: "supplier-1", order_number: "PO-1", status: "draft", revision: 4, order_date: "2026-10-08", currency: "SEK" }],
    homecare_suppliers: [{ id: "supplier-1", tenant_id: tenant, company: "Supplier", email: "supplier@example.se", address: "Street 1" }],
    homecare_purchase_order_items: [{ id: "item-1", tenant_id: tenant, order_id: "order-1", material_id: "material-1", quantity: 600, unit_price: 2, revision: 1 }],
    homecare_materials: [{ id: "material-1", tenant_id: tenant, name: "Test material" }],
    homecare_purchase_receipts: Array.from({ length: 501 }, (_, index) => ({ id: String(index).padStart(4, "0"), tenant_id: tenant, item_id: "item-1", quantity: 1 })),
  };
  const calls: { url: string; init: RequestInit }[] = [];
  let allowed = true, mailOk = true;
  const client = { from: (table: string) => {
    const filters: Record<string, unknown> = {};
    let start = 0, end = Infinity;
    const rows = () => (tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : value === null ? row[key] == null : row[key] === value)).slice(start, end + 1);
    const query = {
      select: () => query, order: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      is: (key: string, value: unknown) => { filters[key] = value; return query; },
      in: (key: string, value: unknown[]) => { filters[key] = value; return query; },
      range: (first: number, last: number) => { start = first; end = last; return query; },
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (done: (value: unknown) => unknown) => Promise.resolve(done({ data: rows().map((row) => ({ ...row })), error: null, count: rows().length })),
    };
    return query;
  } };
  const source = readFileSync(resolve(__dirname, "../app/api/", file, "route.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const load = (name: string) => {
    if (name === "next/server") return { NextResponse };
    if (name === "node:crypto") return require("node:crypto");
    if (name === "@/lib/authModel") return { membershipAllows: () => allowed };
    if (name === "@/lib/operations") return { maintenanceStatus: () => "ok" };
    if (name === "@/lib/server/apiAuth") return { isAuthError: (value: unknown) => value instanceof NextResponse, requireApiAuth: async () => allowed ? { client, tenantId: tenant, membership: { tenantName: "Test company" } } : NextResponse.json({}, { status: 403 }) };
    throw new Error(name);
  };
  new Function("require", "exports", "process", "fetch", compiled)(load, exports, { env: { NODE_ENV: "production", RESEND_API_KEY: "test-key", REPORT_SENDER_EMAIL: "sender@example.se" } }, async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}", { status: mailOk ? 200 : 502 }); });
  return { exports, tables, calls, deny: () => { allowed = false; }, failMail: () => { mailOk = false; } };
}

test("Bestellmengen berücksichtigen alle Teillieferungen und isolieren Mandanten", async () => {
  const h = harness("operations");
  h.tables.homecare_purchase_receipts.push({ id: "other", tenant_id: "other-tenant", item_id: "item-1", quantity: 99 });
  const items = await (await h.exports.GET(new Request("https://test/api/operations?entity=purchase_order_items&parent=order-1"))).json();
  expect(items.rows[0].received_quantity).toBe(501);
  const orders = await (await h.exports.GET(new Request("https://test/api/operations?entity=purchase_orders"))).json();
  expect(orders.rows[0]).toMatchObject({ item_count: 1, open_item_count: 1 });
  h.tables.homecare_purchase_order_items[0].quantity = 501;
  expect((await (await h.exports.GET(new Request("https://test/api/operations?entity=purchase_orders"))).json()).rows[0].open_item_count).toBe(0);
});

test("Bestellmail verwendet gespeicherte Adresse, bestätigt Vorschau und schützt Wiederholungen", async () => {
  const h = harness("purchase-orders/send");
  const request = (action: string, token?: string) => new Request("https://test/api/purchase-orders/send", { method: "POST", body: JSON.stringify({ action, orderId: "order-1", revision: 4, token, to: "attacker@example.se" }) });
  const preview = await (await h.exports.POST(request("preview"))).json();
  expect(preview.to).toBe("supplier@example.se");
  expect(preview.body).toContain("Test material");
  expect(h.calls).toHaveLength(0);
  expect((await h.exports.POST(request("send", "wrong"))).status).toBe(409);
  expect((await h.exports.POST(request("send", preview.token))).status).toBe(200);
  expect(JSON.parse(String(h.calls[0].init.body)).to).toEqual(["supplier@example.se"]);
  expect((h.calls[0].init.headers as Record<string, string>)["Idempotency-Key"]).toBe("purchase-tenant-test-order-1-4");
  h.failMail();
  expect((await h.exports.POST(request("send", preview.token))).status).toBe(502);
  h.tables.homecare_suppliers[0].email = "";
  const missing = await (await h.exports.POST(request("preview"))).json();
  expect((await h.exports.POST(request("send", missing.token))).status).toBe(400);
  h.deny();
  expect((await h.exports.POST(request("preview"))).status).toBe(403);
});
