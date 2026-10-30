import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextResponse } from "next/server";
import { normalizeReportTimestampPayload, retryLegacyReportTimestampFailures } from "../lib/reportTimestamp";
import { createSyncMutation } from "../lib/syncQueue";

test("Wartende Berichtsuebertragungen mit deutschem Versanddatum werden verlustfrei normalisiert", () => {
  for (const [sentAt, expected] of [
    ["29.10.2026, 22:40", "2026-10-29T21:40:00.000Z"],
    ["16.08.2026, 21:45", "2026-08-16T19:45:00.000Z"],
    ["16.08.2026 21:45:12", "2026-08-16T19:45:12.000Z"],
    ["25.10.2026, 02:30", "2026-10-25T01:30:00.000Z"],
  ]) {
    const original = { sentAt, title: "Umbau", summary: "Lokal", checklistResults: [{ id: "task" }] };
    const snapshot = structuredClone(original);
    expect(normalizeReportTimestampPayload(original)).toEqual({ ...original, sentAt: expected });
    expect(original).toEqual(snapshot);
  }
});

test("ISO-Zeitpunkte und explizites Entsperren bleiben unveraendert", () => {
  for (const sentAt of ["2026-10-29T21:40:12.123Z", "2026-10-29T22:40:00+01:00", "", null, undefined]) {
    const payload = { sentAt, summary: "Nicht verlieren" };
    expect(normalizeReportTimestampPayload(payload)).toBe(payload);
  }
});

test("Nur erkennbare alte Datumsfehler werden einmal automatisch mit unveraenderter Anfrage wiederholt", () => {
  const mutation = { ...createSyncMutation({ entityType: "report", entityId: "REP-test", resourceId: "REP-test", operation: "update", expectedRevision: 1, payload: { sentAt: "29.10.2026, 22:40", summary: "Lokal" } }), status: "failed" as const, attempts: 3, error: "Die Änderung konnte nicht synchronisiert werden." };
  const attempted = new Set<string>();
  const retried = retryLegacyReportTimestampFailures([mutation], attempted)[0];
  expect(retried).toMatchObject({ id: mutation.id, payload: mutation.payload, expectedRevision: 1, attempts: 3, status: "pending" });
  expect(retryLegacyReportTimestampFailures([mutation], attempted)[0]).toBe(mutation);
  for (const other of [{ ...mutation, status: "conflict" as const }, { ...mutation, error: "PERMISSION_DENIED" }, { ...mutation, entityType: "portal_message" as const }, { ...mutation, payload: { sentAt: "2026-10-29T21:40:00Z" } }, { ...mutation, payload: { sentAt: "31.02.2026, 22:40" } }]) {
    expect(retryLegacyReportTimestampFailures([other], new Set())[0]).toBe(other);
  }
});

test("Ungueltige Kalendertage und die nicht existierende Fruehlingsstunde werden nicht geraten", () => {
  for (const sentAt of ["31.02.2026, 22:40", "29.10.2026, 25:40", "29.03.2026, 02:30"]) {
    expect(() => normalizeReportTimestampPayload({ sentAt })).toThrow("INVALID_REPORT_SENT_AT");
  }
});

test("Berichtsversand speichert ISO; Kompatibilitaet greift serverseitig vor dem RPC", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const send = source.slice(source.indexOf("async function confirmSendReportToCustomer"), source.indexOf("const sendPreviewReport ="));
  expect(send).toContain("const timestamp = new Date().toISOString()");
  expect(send).not.toContain("toLocaleString");
  const route = readFileSync("app/api/sync-mutations/route.ts", "utf8");
  expect(route.indexOf("payload = normalizeReportTimestampPayload(payload)")).toBeLessThan(route.indexOf("await supabase.rpc"));
  expect(route).toContain("p_mutation_id: mutation.id");
  expect(route).toContain("p_expected_revision: mutation.expectedRevision ?? null");
});

test("Echter Sync-Handler repariert wartende Berichte ohne neue Identitaet oder Revisionsumgehung", async () => {
  const calls: Record<string, unknown>[] = [];
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const source = ts.transpileModule(readFileSync("app/api/sync-mutations/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", source)((name: string) => {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/reportTimestamp") return { normalizeReportTimestampPayload };
    if (name === "@/lib/authModel") return { membershipAllows: () => true };
    if (name === "@/lib/server/apiAuth") return {
      isAuthError: () => false,
      requireApiAuth: async () => ({ tenantId: "tenant", user: { id: "actor" }, membership: {}, serviceClient: {
        rpc: async (rpc: string, args: Record<string, unknown>) => {
          expect(rpc).toBe("homecare_apply_report_communication_mutation"); calls.push(args);
          return { data: { status: "synced", mutationId: args.p_mutation_id, record: { revision: 2 } }, error: null };
        },
      } }),
    };
    return {};
  }, exports);
  const mutation = { ...createSyncMutation({ entityType: "report", entityId: "REP-test", resourceId: "REP-test", operation: "update", expectedRevision: 1, payload: { sentAt: "29.10.2026, 22:40", summary: "Lokal", title: "Bericht" } }), status: "failed" };
  const before = structuredClone(mutation);
  const send = (value: unknown) => exports.POST!(new Request("http://localhost/api/sync-mutations", { method: "POST", body: JSON.stringify(value) }));
  for (let i = 0; i < 2; i++) {
    const response = await send(mutation);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "synced", mutationId: mutation.id });
  }
  expect(calls).toHaveLength(2);
  for (const args of calls) expect(args).toMatchObject({ p_mutation_id: mutation.id, p_expected_revision: 1, p_tenant_id: "tenant", p_payload: { ...mutation.payload, sentAt: "2026-10-29T21:40:00.000Z" } });
  expect(mutation).toEqual(before);
  const invalid = await send({ ...mutation, payload: { ...mutation.payload, sentAt: "31.02.2026, 22:40" } });
  expect(invalid.status).toBe(422); expect(calls).toHaveLength(2);
});

for (const success of [true, false]) test(`Alte Berichtsfehler nach Wiederverbindung genau einmal wiederholen: Erfolg=${success}`, async ({ page, context }) => {
  const mutation = { ...createSyncMutation({ entityType: "report", entityId: "REP-test", resourceId: "REP-test", operation: "update", expectedRevision: 1, payload: { sentAt: "29.10.2026, 22:40", summary: "Lokal", title: "Bericht", date: "2026-10-29", jobId: "JOB-test", objectId: "OBJ-1001" } }), status: "failed", attempts: 1, error: "Die Änderung konnte nicht synchronisiert werden." };
  await page.addInitScript(value => {
    if (localStorage.getItem("report-retry-fixture")) return;
    localStorage.setItem("report-retry-fixture", "1");
    localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify([value]));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{ id: value.entityId, ...value.payload, revision: 2, checklistResults: [], media: [], visibleToCustomer: true }]));
  }, mutation);
  const received: typeof mutation[] = [];
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "Supabase aktuell überlastet (isolierter Test)" } }));
  await page.route("**/api/sync-mutations", route => {
    const value = route.request().postDataJSON(); received.push(value);
    return success ? route.fulfill({ json: { status: "synced", mutationId: value.id, record: { id: value.entityId, revision: 2, sent_at: "2026-10-29T21:40:00.000Z", record_data: { ...value.payload, sentAt: "2026-10-29T21:40:00.000Z" } } } })
      : route.fulfill({ status: 500, json: { error: "Die Änderung konnte nicht synchronisiert werden." } });
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await context.setOffline(false);
  await expect.poll(() => received.length, { timeout: 15000 }).toBe(1);
  expect(received[0]).toMatchObject({ id: mutation.id, expectedRevision: 1, payload: mutation.payload });
  const stored = () => page.evaluate(id => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").find((value: { id: string }) => value.id === id), mutation.id);
  await expect.poll(async () => (await stored()).status).toBe(success ? "synced" : "failed");
  if (!success) {
    await page.waitForTimeout(1700);
    expect(received).toHaveLength(1);
    expect((await stored()).payload).toEqual(mutation.payload);
  }
});
