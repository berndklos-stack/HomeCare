import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { NextResponse } from "next/server";

const id = "55555555-5555-4555-8555-555555555555";
function harness() {
  const tenant = "tenant-test";
  const tables: Record<string, Record<string, unknown>[]> = {
    homecare_supplier_damage_cases: [{ id, tenant_id: tenant, supplier_id: "supplier", receipt_id: "receipt", description: "3 Latten gebrochen", revision: 1 }],
    homecare_suppliers: [{ id: "supplier", tenant_id: tenant, company: "Supplier", email: "supplier@example.se" }],
    homecare_goods_receipts: [{ id: "receipt", tenant_id: tenant, delivery_number: "4321", document_id: "document" }],
    homecare_supplier_damage_photos: [{ tenant_id: tenant, case_id: id, document_id: "photo" }],
    homecare_media: [{ id: "document", tenant_id: tenant, name: "Lieferschein.pdf", storage_path: `${tenant}/purchase-documents/note.pdf` }, { id: "photo", tenant_id: tenant, name: "Schaden.jpg", storage_path: `${tenant}/purchase-documents/photo.jpg` }],
  };
  const calls: RequestInit[] = [], records: Record<string, unknown>[] = [];
  let allowed = true, mailOk = true, mediaOk = true, saveOk = true;
  const client = { from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const rows = () => (tables[table] ?? []).filter((row) => Object.entries(filters).every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : value === null ? row[key] == null : row[key] === value));
    const query = {
      select: () => query, order: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      is: (key: string, value: unknown) => { filters[key] = value; return query; },
      in: (key: string, value: unknown[]) => { filters[key] = value; return query; },
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (done: (value: unknown) => unknown) => Promise.resolve(done({ data: rows().map((row) => ({ ...row })), error: null })),
    }; return query;
  } };
  const serviceClient = {
    storage: { from: () => ({ download: async (path: string) => ({ data: mediaOk ? new Blob(["test"], { type: path.endsWith("pdf") ? "application/pdf" : "image/jpeg" }) : null, error: mediaOk ? null : new Error("missing") }) }) },
    rpc: async (_name: string, input: Record<string, unknown>) => { if (saveOk) { records.push(input); tables.homecare_supplier_damage_cases[0].complaint_sent_at = "2026-10-11T14:00:00Z"; tables.homecare_supplier_damage_cases[0].complaint_sent_to = input.p_to; } return { error: saveOk ? null : new Error("unavailable") }; },
  };
  const compiled = ts.transpileModule(readFileSync(resolve(__dirname, "../app/api/supplier-damage-cases/send/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const load = (name: string) => {
    if (name === "next/server") return { NextResponse };
    if (name === "node:crypto") return require("node:crypto");
    if (name === "@/lib/authModel") return { membershipAllows: () => allowed };
    if (name === "@/lib/server/apiAuth") return { isAuthError: () => false, requireApiAuth: async () => ({ client, serviceClient, tenantId: tenant, user: { id: "actor" }, membership: { tenantName: "WorkCore company" } }) };
    throw new Error(name);
  };
  new Function("require", "exports", "process", "fetch", compiled)(load, exports, { env: { NODE_ENV: "production", RESEND_API_KEY: "test-key" } }, async (_url: string, init: RequestInit) => { calls.push(init); return Response.json({ id: "mail-id" }, { status: mailOk ? 200 : 502 }); });
  const request = (action: string, token?: string, emailSubject = "Meine Reklamation", emailBody = "Bitte um Ersatz für 3 Latten.") => exports.POST!(new Request("https://test/api/supplier-damage-cases/send", { method: "POST", body: JSON.stringify({ action, id, revision: 1, token, emailSubject, emailBody, to: "attacker@example.se" }) }));
  return { tables, calls, records, request, deny: () => { allowed = false; }, failMedia: () => { mediaOk = false; }, failMail: () => { mailOk = false; }, failSave: () => { saveOk = false; } };
}

test("Reklamation verwendet Lieferantenadresse, Beschreibung und private Belege erst nach Bestätigung", async () => {
  const h = harness(), preview = await (await h.request("preview")).json();
  expect(preview.to).toBe("supplier@example.se"); expect(preview.body).toContain("3 Latten gebrochen"); expect(preview.subject).toContain("4321");
  expect(preview.attachments).toEqual(["Lieferschein.pdf", "Schaden.jpg"]); expect(h.calls).toHaveLength(0);
  expect((await h.request("send", "wrong")).status).toBe(409);
  expect((await h.request("send", preview.token)).status).toBe(200);
  const mail = JSON.parse(String(h.calls[0].body)); expect(mail.to).toEqual(["supplier@example.se"]); expect(mail.attachments).toHaveLength(2); expect(mail.subject).toBe("Meine Reklamation"); expect(mail.text).toBe("Bitte um Ersatz für 3 Latten.");
  expect(h.records[0]).toMatchObject({ p_id: id, p_to: "supplier@example.se", p_message_id: "mail-id", p_actor: "actor" });
  expect((await h.request("send", preview.token)).status).toBe(200); expect(h.calls).toHaveLength(1);
});

test("Reklamation validiert die bearbeitbare Vorschau vor dem Versand", async () => {
  const h = harness(), preview = await (await h.request("preview")).json();
  expect((await h.request("send", preview.token, "", "Text")).status).toBe(400);
  expect((await h.request("send", preview.token, "Betreff\nBcc: other@example.se", "Text")).status).toBe(400);
  expect((await h.request("send", preview.token, "Betreff", " ")).status).toBe(400);
  expect(h.calls).toHaveLength(0);
});

test("Reklamation verhindert Versand bei geänderten Daten, fehlenden Belegen und Rechten", async () => {
  const h = harness(), preview = await (await h.request("preview")).json();
  h.tables.homecare_supplier_damage_cases[0].description = "Anderer Schaden";
  expect((await h.request("send", preview.token)).status).toBe(409); expect(h.calls).toHaveLength(0);
  h.failMedia(); expect((await h.request("preview")).status).toBe(503); expect(h.calls).toHaveLength(0);
  h.deny(); expect((await h.request("preview")).status).toBe(403);
  const foreign = harness(); foreign.tables.homecare_media[0].tenant_id = "other";
  expect((await foreign.request("preview")).status).toBe(503); expect(foreign.calls).toHaveLength(0);
});

test("Reklamation meldet Mail- und Protokollfehler ohne einen falschen Versandvermerk", async () => {
  const h = harness(), preview = await (await h.request("preview")).json(); h.failMail();
  expect((await h.request("send", preview.token)).status).toBe(502); expect(h.records).toHaveLength(0);
  const pending = harness(), second = await (await pending.request("preview")).json(); pending.failSave();
  expect(await (await pending.request("send", second.token)).json()).toMatchObject({ error: "COMPLAINT_STATUS_PENDING" });
  await pending.request("send", second.token);
  expect(pending.calls.map((call) => (call.headers as Record<string, string>)["Idempotency-Key"])).toEqual([`complaint-tenant-test-${id}`, `complaint-tenant-test-${id}`]);
});
