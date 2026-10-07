import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { NextResponse } from "next/server";
import { reminderTokenHash, reminderTokenMatches, parseReminderSnapshot, remindersForMail } from "../lib/server/appleReminders";
import { buildDailyJobMail } from "../app/api/cron/daily-jobs/route";
import * as reminderHelpers from "../lib/server/appleReminders";

const now = new Date("2026-10-07T03:45:00Z");
const token = "a".repeat(64);
const bridge = {
  tokenHash: reminderTokenHash(token),
  generatedAt: now.toISOString(),
  receivedAt: now.toISOString(),
  reminders: [
    { title: "Privat <test>", list: "Privat", notes: "Notiz & Text", date: "" },
    { title: "Überfällig", list: "Arbeit", notes: "", date: "2026-10-06" },
    { title: "Diese Woche", list: "Andere Liste", notes: "", date: "2026-10-12" },
    { title: "Später", list: "Arbeit", notes: "", date: "2026-10-13" },
  ],
};

test("Zugang wird nur gehasht geprüft; falsche und leere Schlüssel scheitern", () => {
  expect(reminderTokenMatches(token, bridge.tokenHash)).toBe(true);
  expect(reminderTokenMatches("b".repeat(64), bridge.tokenHash)).toBe(false);
  expect(reminderTokenMatches(token, "")).toBe(false);
  expect(reminderTokenMatches("", bridge.tokenHash)).toBe(false);
  expect(bridge.tokenHash).not.toBe(token);
});

test("alle Listen, leere Momentaufnahme und erneutes Senden bleiben unverändert", () => {
  const payload = { generatedAt: now.toISOString(), reminders: bridge.reminders };
  expect(parseReminderSnapshot(payload, now)).toEqual(parseReminderSnapshot(payload, now));
  expect(parseReminderSnapshot(payload, now).reminders).toHaveLength(4);
  expect(parseReminderSnapshot({ generatedAt: now.toISOString(), reminders: [] }, now).reminders).toEqual([]);
  expect(remindersForMail(bridge, "2026-10-12").map((r) => r.title)).toEqual(["Privat <test>", "Überfällig", "Diese Woche"]);
});

test("ungültige, zu große und veraltete Momentaufnahmen werden vollständig abgewiesen", () => {
  expect(() => parseReminderSnapshot({ generatedAt: "2026-10-06T00:00:00Z", reminders: [] }, now)).toThrow();
  expect(() => parseReminderSnapshot({ generatedAt: now.toISOString(), reminders: "[]" }, now)).toThrow();
  expect(() => parseReminderSnapshot({ generatedAt: now.toISOString(), reminders: Array(2001).fill(bridge.reminders[0]) }, now)).toThrow();
  expect(() => parseReminderSnapshot({ generatedAt: now.toISOString(), reminders: [{ title: "X", date: "2026-02-30" }] }, now)).toThrow();
});

test("HTML und Textmail enthalten iPhone-Stand, überfällige und undatierte Einträge", async () => {
  const mail = await buildDailyJobMail({ appleReminders: bridge }, "2026-10-07");
  expect(mail.reminderCount).toBe(3);
  expect(mail.html).toContain("Privat &lt;test&gt;");
  expect(mail.html).toContain("Notiz &amp; Text");
  expect(mail.text).toContain("Letzter iPhone-Abruf:");
  expect(mail.text).toContain("ohne Datum | Privat");
  expect(mail.text).toContain("Überfällig");
  expect(mail.text).not.toContain("Später");
  const empty = await buildDailyJobMail({ appleReminders: { ...bridge, reminders: [] } }, "2026-10-07");
  expect(empty.reminderCount).toBe(0);
  expect(empty.text).toContain("Keine offenen Erinnerungen im Zeitraum.");
  const never = await buildDailyJobMail({ appleReminders: { ...bridge, receivedAt: "", reminders: [] } }, "2026-10-07");
  expect(never.text).toContain("noch keine Erinnerungen empfangen");
});

test("Bridge bleibt tenant-isoliert, revisionsgeschützt und getrennt vom Geschäftssync", () => {
  const source = readFileSync(resolve(__dirname, "../app/api/integrations/apple-reminders/route.ts"), "utf8");
  expect(source.match(/requireApiAuth\(request, "tenant.admin"\)/g)).toHaveLength(3);
  expect(source).toContain('reminderTokenMatches(token, row.value.tokenHash)');
  expect(source).toContain('.eq("tenant_id", tenantId)');
  expect(source).toContain('.eq("revision", row.revision)');
  expect(source).toContain('snapshot.generatedAt <= row.value.generatedAt');
  expect(source).toContain('"Cache-Control": "no-store"');
  expect(source).not.toContain('from("app_state")');
  expect(source).not.toContain('from("homecare_reports")');
});

test("echte API-Handler: Einrichtung, Tenant-Schutz, Wiederholung, leere Liste und Widerruf", async () => {
  const tenant = "00000000-0000-0000-0000-000000000001";
  let row: { value: typeof bridge; revision: number } | null = null;
  let authorized = true;
  const client = { from: (table: string) => {
    expect(table).toBe("homecare_settings");
    const filters: Record<string, unknown> = {};
    let write: { value: typeof bridge; tenant_id?: string } | null = null;
    let insert = false;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      is: () => query,
      maybeSingle: async () => ({ data: filters.tenant_id === tenant ? structuredClone(row) : null, error: null }),
      update: (value: { value: typeof bridge }) => { write = value; return query; },
      insert: (value: { value: typeof bridge; tenant_id: string }) => { write = value; insert = true; return query; },
      then: (done: (value: unknown) => unknown) => {
        const matches = insert ? !row && write?.tenant_id === tenant : row && filters.tenant_id === tenant && filters.revision === row.revision;
        if (matches && write) row = { value: write.value, revision: (row?.revision || 0) + 1 };
        return Promise.resolve(done({ data: matches ? [{ revision: row?.revision }] : [], error: null }));
      },
    };
    return query;
  } };
  const source = readFileSync(resolve(__dirname, "../app/api/integrations/apple-reminders/route.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const load = (name: string) => {
    if (name === "@/lib/server/apiAuth") return {
      serviceClient: () => client,
      isAuthError: (result: unknown) => result instanceof NextResponse,
      requireApiAuth: async () => authorized ? { serviceClient: client, tenantId: tenant } : NextResponse.json({}, { status: 403 }),
    };
    if (name === "@/lib/server/appleReminders") return reminderHelpers;
    if (name === "next/server") return { NextResponse };
    if (name === "node:crypto") return require("node:crypto");
    throw new Error(`Unexpected module: ${name}`);
  };
  new Function("require", "exports", compiled)(load, exports);
  const req = (method: string, access = "", scope = tenant, snapshot: unknown = { generatedAt: new Date().toISOString(), reminders: bridge.reminders }) =>
    new Request("https://workcore.test/api/integrations/apple-reminders", { method,
      headers: { Authorization: `Bearer ${access}`, "X-WorkCore-Tenant": scope },
      ...(method === "PUT" ? { body: JSON.stringify(snapshot) } : {}),
    });
  authorized = false;
  expect((await exports.POST(req("POST"))).status).toBe(403);
  authorized = true;
  const setup = await (await exports.POST(req("POST"))).json();
  expect(setup.token).toHaveLength(64);
  expect(JSON.stringify(row)).not.toContain(setup.token);
  expect((await exports.PUT(req("PUT", setup.token, "00000000-0000-0000-0000-000000000002"))).status).toBe(401);
  expect((await exports.PUT(req("PUT", token))).status).toBe(401);
  expect((await exports.PUT(req("PUT", setup.token, tenant, { generatedAt: new Date().toISOString(), reminders: "x".repeat(1_000_000) }))).status).toBe(413);
  expect((await exports.PUT(req("PUT", setup.token, tenant, { generatedAt: "2020-01-01T00:00:00Z", reminders: [] }))).status).toBe(400);
  const snapshot = { generatedAt: new Date(Date.now() - 1000).toISOString(), reminders: bridge.reminders };
  expect((await (await exports.PUT(req("PUT", setup.token, tenant, snapshot))).json()).count).toBe(4);
  const firstRevision = row!.revision;
  expect((await (await exports.PUT(req("PUT", setup.token, tenant, snapshot))).json()).accepted).toBe(false);
  expect(row!.revision).toBe(firstRevision);
  expect((await (await exports.PUT(req("PUT", setup.token, tenant, { generatedAt: new Date().toISOString(), reminders: [] }))).json()).count).toBe(0);
  const status = await (await exports.GET(req("GET"))).json();
  expect(status.count).toBe(0);
  expect(status.receivedAt).toBeTruthy();
  expect(status.tokenHash).toBeUndefined();
  expect((await exports.DELETE(req("DELETE"))).status).toBe(200);
  expect((await exports.PUT(req("PUT", setup.token))).status).toBe(401);
});
