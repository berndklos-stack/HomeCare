import { test, expect } from "@playwright/test";
import { isLegacyTripValidationConflict, overlappingLegacyTripConflict } from "../lib/legacyTripConflict";
import { createSyncMutation, retrySyncMutation, nextPendingMutation } from "../lib/syncQueue";
import { tripOdometerAfterAcknowledgement } from "../lib/tripChronology";

test("Historische Bestaetigungen setzen den aktuellen Fahrzeugstand nicht zurueck", () => {
  const current = { currentOdometer: "203132", currentOdometerDate: "2026-10-12" };
  expect(tripOdometerAfterAcknowledgement(current, { status: "abgeschlossen", end_odometer: 202949, trip_date: "2026-10-05" })).toEqual(current);
  expect(tripOdometerAfterAcknowledgement(current, { status: "abgeschlossen", end_odometer: 203140, trip_date: "2026-10-13" })).toEqual({ currentOdometer: "203140", currentOdometerDate: "2026-10-13" });
  expect(tripOdometerAfterAcknowledgement(current, { status: "abgeschlossen", end_odometer: 203140, trip_date: "2026-10-13", deleted_at: "2026-10-14" })).toEqual(current);
});

test("Nur die alte Kilometerregel wird ohne Payload- oder Identitaetswechsel erneut versucht", () => {
  const mutation = { ...createSyncMutation({ entityType: "vehicle_trip", entityId: "TRIP-1", resourceId: "CAR-1", operation: "create", payload: { date: "2026-10-05", startOdometer: "202947", endOdometer: "202949" } }), status: "conflict" as const, error: "Start-Kilometerstand 202947 liegt unter dem Serverstand 203132.0." };
  expect(isLegacyTripValidationConflict(mutation)).toBe(true);
  const overlapping = { ...mutation, id: "other", entityId: "TRIP-OTHER", payload: { ...mutation.payload, endOdometer: "202950" } };
  expect(overlappingLegacyTripConflict(mutation, [mutation, overlapping])).toBe(true);
  expect(overlappingLegacyTripConflict(mutation, [mutation])).toBe(false);
  expect(overlappingLegacyTripConflict(mutation, [mutation, { ...overlapping, payload: { ...overlapping.payload, startOdometer: "202949" } }])).toBe(false);
  const retry = retrySyncMutation([mutation], mutation.id)[0];
  expect(retry.id).toBe(mutation.id);
  expect(retry.payload).toBe(mutation.payload);
  expect(retry.resourceId).toBe(mutation.resourceId);
  for (const change of [{ operation: "update" as const }, { error: "Die Fahrt wurde auf einem anderen Gerät geändert." }, { error: "Start-Kilometerstand liegt unter dem Endstand der vorherigen Fahrt (202949 km)." }, { entityType: "object" as const }]) {
    expect(isLegacyTripValidationConflict({ ...mutation, ...change })).toBe(false);
  }
  const other = createSyncMutation({ entityType: "vehicle_trip", entityId: "TRIP-2", resourceId: "CAR-1", operation: "create" });
  expect(nextPendingMutation([mutation, other])).toBe(other);
});

test("Fehlende Startzeit erlaubt nur die gezielte erneute Kilometerpruefung", () => {
  const mutation = { ...createSyncMutation({ entityType: "vehicle_trip", entityId: "TRIP-NO-TIME", resourceId: "CAR-1", operation: "create", payload: { date: "2026-10-12", startOdometer: "203132", endOdometer: "203148" } }), status: "conflict" as const, error: "Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (203126.0 km)." };
  expect(isLegacyTripValidationConflict(mutation)).toBe(true);
  expect(isLegacyTripValidationConflict({ ...mutation, payload: { ...mutation.payload, startedAt: "2026-10-12T10:00:00Z" } })).toBe(false);
  expect(isLegacyTripValidationConflict({ ...mutation, error: "Die Kilometerstaende dieser Fahrt ueberschneiden sich mit einer anderen Fahrt am selben Tag." })).toBe(false);
  expect(retrySyncMutation([mutation], mutation.id)[0].payload).toEqual(mutation.payload);
});

test("Ueberschneidende Eingaben bleiben erhalten und werden verstaendlich angezeigt", async ({ page }) => {
  const first = { ...createSyncMutation({ entityType: "vehicle_trip", entityId: "TRIP-FIRST", resourceId: "RES-1", operation: "create", payload: { date: "2026-10-05", startOdometer: "202947", endOdometer: "202949" } }), status: "conflict" as const, error: "Start-Kilometerstand 202947 liegt unter dem Serverstand 203132.0." };
  const second = { ...first, id: "00000000-0000-4000-8000-000000000002", entityId: "TRIP-SECOND", payload: { ...first.payload, endOdometer: "202950" } };
  await page.addInitScript((queue) => localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify(queue)), [first, second]);
  const requests: unknown[] = [];
  await page.route("**/api/sync-mutations", (route) => { requests.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { error: "TEST_MUTATION_MUST_NOT_RUN" } }); });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true }).click();
  const dialog = page.locator(".sync-conflict-dialog");
  await expect(dialog).toContainText("Fahrt · Servicebil Kolaretorp · 2026-10-05");
  await expect(dialog).toContainText("202947 → 202949 km");
  await expect(dialog).toContainText("202947 → 202950 km");
  await expect(dialog).toContainText("Zwei lokale Fahrteingaben überschneiden sich");
  await expect(dialog).not.toContainText("Server Revision unbekannt");
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").filter((item: { status: string }) => item.status === "conflict").length)).toBe(2);
});
