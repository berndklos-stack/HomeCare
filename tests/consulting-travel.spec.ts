import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { consultingTravelAmount, consultingTravelTotal, consultingTravelValid } from "../lib/consultingTravel";
import { serviceListTotals, exportServiceListPdf } from "../lib/consultingServiceList";
import { prepareJobMutations, overlayPendingJobOperations } from "../lib/jobOperationsSync";
import { createSyncMutation } from "../lib/syncQueue";
import ts from "typescript";
import { NextResponse } from "next/server";

test("Kilometerkosten validieren beide Felder und werden je Position centgenau gerechnet", async () => {
  expect(consultingTravelValid({})).toBe(true);
  expect(consultingTravelAmount({ travelKilometers: "25,5", travelRate: "3,75" })).toBe(95.63);
  for (const value of [{ travelKilometers: "1", travelRate: "" }, { travelKilometers: "-1", travelRate: "2" }, { travelKilometers: "1", travelRate: "-2" }, { travelKilometers: "NaN", travelRate: "2" }, { travelKilometers: "1.2345", travelRate: "2" }, { travelKilometers: "1", travelRate: "2.12345" }]) expect(consultingTravelValid(value)).toBe(false);
  const entry = { id: "E", date: "2026-10-30", startTime: "10:00", endTime: "11:00", minutes: 60, description: "Montage", billingStatus: "offen" as const, travelKilometers: "25,5", travelRate: "3,75" };
  expect(consultingTravelTotal([entry, entry])).toBe(191.26);
  expect(serviceListTotals([entry], 800)).toEqual({ minutes: 60, cents: 89563 });
  const pdf = Buffer.from(await exportServiceListPdf({ entries: [entry], title: "Test", company: "Testfirma", currency: "SEK", rate: 800, language: "de" })).toString("latin1");
  expect(pdf).toContain("Fahrtkosten:"); expect(pdf).toContain("25,5 km");
});

test("Kilometer und Preis folgen derselben Buchungsmutation und bleiben im Offline-Replay erhalten", () => {
  const job = { id: "J", consulting: { entries: [{ id: "E", minutes: 60, revision: 4 }] } };
  const next = { ...job, consulting: { entries: [{ ...job.consulting.entries[0], travelKilometers: "30", travelRate: "4" }] } };
  const plan = prepareJobMutations([job], [next]);
  expect(plan.mutations).toHaveLength(1);
  expect(plan.mutations[0]).toMatchObject({ entityType: "job_time_entry", expectedRevision: 4, payload: { travelKilometers: "30", travelRate: "4" } });
  const replay = overlayPendingJobOperations([job], {}, {}, {}, plan.mutations.map(create => createSyncMutation(create)));
  expect(replay.jobs[0].consulting.entries[0]).toMatchObject({ travelKilometers: "30", travelRate: "4", revision: 5 });
  const reader = readFileSync("app/api/sync-sections/route.ts", "utf8");
  expect(reader).toContain("travel_kilometers,travel_rate"); expect(reader).toContain("travelRate: entry.travel_rate");
});

test("Sync-API validiert Fahrtkosten und behaelt die bestehende Berechtigungspruefung", async () => {
  const calls: Record<string, unknown>[] = []; let permitted = true;
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const code = ts.transpileModule(readFileSync("app/api/sync-mutations/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", code)((name: string) => {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/consultingTravel") return { consultingTravelValid };
    if (name === "@/lib/authModel") return { membershipAllows: () => permitted };
    if (name === "@/lib/server/apiAuth") return { isAuthError: () => false, requireApiAuth: async () => ({ tenantId: "tenant", membership: {}, user: { id: "actor" }, serviceClient: { rpc: async (_: string, args: Record<string, unknown>) => { calls.push(args); return { data: { status: "synced" }, error: null }; } } }) };
    return {};
  }, exports);
  const mutation = createSyncMutation({ entityType: "job_time_entry", entityId: "E", resourceId: "J", operation: "update", expectedRevision: 4, payload: { travelKilometers: "25,5", travelRate: "3,75" } });
  const send = (payload: Record<string, unknown>) => exports.POST!(new Request("http://localhost/api/sync-mutations", { method: "POST", body: JSON.stringify({ ...mutation, payload }) }));
  expect((await send(mutation.payload)).status).toBe(200);
  expect(calls[0]).toMatchObject({ p_tenant_id: "tenant", p_actor_id: "actor", p_expected_revision: 4, p_payload: mutation.payload });
  for (const payload of [{ travelKilometers: "25", travelRate: "-1" }, { travelKilometers: "25" }, { travelKilometers: 25, travelRate: 3 }]) expect((await send(payload)).status).toBe(400);
  expect(calls).toHaveLength(1);
  permitted = false; expect((await send(mutation.payload)).status).toBe(403); expect(calls).toHaveLength(1);
});

for (const width of [320, 820, 1440]) test(`Fahrtkosten erfassen bearbeiten abrechnen und nur als laufend markieren bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => {
    if (localStorage.getItem("travel-fixture")) return;
    localStorage.setItem("travel-fixture", "1");
    localStorage.setItem("kolaretorp-billing", "[]");
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "TRAVEL-C", name: "Testkunde", language: "Deutsch", contacts: [], objects: [] }]));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{ id: "TRAVEL-J", customerId: "TRAVEL-C", objectId: "OBJ-1001", billable: true, title: "Laufende Montage", status: "in Arbeit", priority: "normal", dueDate: "2026-10-30", description: "", assignedTo: "Demo", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [], consulting: { enabled: true, openEnded: true, hourlyRate: "800", currency: "SEK", entries: [] } }]));
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistung erfassen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Leistung erfassen", exact: true });
  await dialog.getByLabel("Startzeit", { exact: true }).fill("10:00"); await dialog.getByLabel("Endzeit", { exact: true }).fill("11:00"); await dialog.getByLabel("Tätigkeit", { exact: true }).fill("Montage mit Anfahrt");
  await expect(dialog.getByLabel("Gefahrene Kilometer", { exact: true })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: "Fahrtkosten", exact: true }).check();
  await expect(dialog.getByRole("button", { name: "Leistung speichern", exact: true })).toBeDisabled();
  await dialog.getByLabel("Gefahrene Kilometer", { exact: true }).fill("25,5"); await dialog.getByLabel("Preis pro km (SEK)", { exact: true }).fill("3,75");
  await expect(dialog).toContainText("95,63 SEK");
  await dialog.screenshot({ path: info.outputPath(`travel-entry-${width}.png`) });
  await dialog.getByRole("button", { name: "Leistung speichern", exact: true }).click();
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistungsnachweise (1)", exact: true }).click();
  await expect(page.locator(".consulting-entry-history")).toContainText("25,5 km");
  await page.getByRole("button", { name: /^Leistung bearbeiten / }).click();
  const edit = page.getByRole("dialog", { name: "Leistung bearbeiten", exact: true });
  await expect(edit.getByLabel("Gefahrene Kilometer", { exact: true })).toHaveValue("25,5");
  await edit.getByLabel("Gefahrene Kilometer", { exact: true }).fill("30"); await edit.getByLabel("Preis pro km (SEK)", { exact: true }).fill("4");
  await edit.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await page.getByRole("button", { name: "Offene Leistungen abrechnen", exact: true }).click();
  const bill = page.getByRole("dialog", { name: "Offene Leistungen abrechnen", exact: true });
  await expect(bill).toContainText("920,00 SEK");
  await bill.getByRole("button", { name: "Ausgewählte Positionen abrechnen", exact: true }).click();
  const invoices = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]"));
  expect(invoices).toHaveLength(1);
  expect(invoices[0].lines).toHaveLength(2);
  expect(invoices[0].lines[1]).toMatchObject({ quantity: "30", unitPrice: "4", unit: "km", comment: "Montage mit Anfahrt" });
  expect(invoices[0].lines[1].name).toContain("Fahrtkosten");
  await page.getByRole("button", { name: "Neuer Auftrag", exact: true }).click();
  const section = page.locator(".job-consulting-compact");
  await expect(section.getByRole("checkbox", { name: "als laufenden Auftrag führen", exact: true })).toBeVisible();
  await expect(section).not.toContainText("Consulting");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
