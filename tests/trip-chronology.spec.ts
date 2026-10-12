import { test, expect } from "@playwright/test";
import { compareTripChronology, tripNeighbors, tripMileageGaps, tripChronologyWarnings, tripStartAt, localTripTime, type ChronologicalTrip } from "../lib/tripChronology";
import { applyVehicleMutation, type VehicleMutationState, type VersionedVehicleTrip } from "../lib/vehicleSync";
import { createSyncMutation } from "../lib/syncQueue";

const trip = (id: string, date: string, time: string, start: string, end: string, resourceId = "CAR-1"): ChronologicalTrip => ({
  id, date, startedAt: tripStartAt(date, time), startOdometer: start, endOdometer: end, resourceId, status: "abgeschlossen",
});
const previous = trip("A", "2026-10-01", "09:00", "202900", "202947");
const next = trip("B", "2026-10-03", "10:00", "203132", "203200");

test("Aktuelle Fahrt verwendet chronologisch letzte Fahrt statt Erfassungszeit oder Hoechststand", () => {
  const candidate = trip("C", "2026-10-12", "09:00", "", "");
  expect(tripNeighbors([next, previous], candidate).previous).toEqual(next);
  expect(tripNeighbors([next, previous], candidate).next).toBeUndefined();
});
test("Historische Fahrt zwischen Nachbarn bleibt unabhaengig vom neuesten Stand", () => {
  const candidate = trip("C", "2026-10-02", "12:00", "202947", "203132");
  expect(tripNeighbors([next, previous], candidate)).toEqual({ previous, next });
  expect(tripChronologyWarnings([next, previous], candidate)).toEqual([]);
  expect(tripMileageGaps([next, previous, candidate])).toEqual([]);
});
test("185-km-Luecke wird nach Nachtrag kleiner ohne andere Fahrten zu veraendern", () => {
  const originals = JSON.stringify([previous, next]);
  expect(tripMileageGaps([next, previous])).toEqual([{ previous, next, kilometers: 185 }]);
  const partial = trip("C", "2026-10-02", "12:00", "202947", "203000");
  expect(tripMileageGaps([previous, partial, next])[0].kilometers).toBe(132);
  expect(JSON.stringify([previous, next])).toBe(originals);
});
test("Ohne vorherige Fahrt wird kein Startstand erfunden", () => {
  expect(tripNeighbors([previous, next], trip("C", "2026-09-01", "12:00", "", "")).previous).toBeUndefined();
  expect(tripChronologyWarnings([], trip("C", "2026-09-01", "12:00", "", ""))).toEqual([]);
});
test("Gleicher Tag sortiert nach Uhrzeit nicht nach Kilometerzahl", () => {
  const early = trip("Z", "2026-10-01", "08:00", "300", "310");
  const late = trip("A", "2026-10-01", "10:00", "100", "110");
  expect([late, early].sort(compareTripChronology)).toEqual([early, late]);
  expect(localTripTime(early.startedAt)).toBe("08:00");
});
test("Alte historische Eintraege mit spaeter Erfassungszeit bleiben am Fahrtdatum", () => {
  const capturedLater = { ...previous, startedAt: tripStartAt("2026-10-12", "12:00") };
  expect(compareTripChronology(capturedLater, next)).toBeLessThan(0);
});
test("Plausibilitaetswarnungen erkennen wirkliche Nachbarwidersprueche", () => {
  const candidate = trip("C", "2026-10-02", "12:00", "202900", "203150");
  expect(tripChronologyWarnings([previous, next], candidate)).toHaveLength(2);
});

test("Quickfahrt ohne Uhrzeit wird anhand der Kilometer eingeordnet, ohne Startzeit zu erfinden", () => {
  const first = trip("FIRST", "2026-10-12", "12:03", "203126", "203129");
  const second = trip("SECOND", "2026-10-12", "12:04", "203129", "203132");
  const untimed = { id: "UNTIMED", date: "2026-10-12", startOdometer: "203132", endOdometer: "203148", resourceId: "CAR-1" };
  expect(tripChronologyWarnings([first, second], untimed)).toEqual([]);
  expect(tripChronologyWarnings([first, second], { ...untimed, startOdometer: "203130" })).toHaveLength(1);
  const initial: VehicleMutationState = { trips: [first, second].map((item) => ({ ...item, revision: 1, status: "abgeschlossen" })) as VersionedVehicleTrip[], media: [], mutationResults: {} };
  const mutation = createSyncMutation({ entityType: "vehicle_trip", entityId: untimed.id, resourceId: "CAR-1", operation: "create", payload: { ...untimed, status: "abgeschlossen" } });
  const synced = applyVehicleMutation(initial, mutation);
  expect(synced.mutationResults[mutation.id].status).toBe("synced");
  expect(synced.trips.find((item) => item.id === untimed.id)?.startedAt).toBeUndefined();
});
test("Luecken getrennt je Fahrzeug, keine laufenden oder geloeschten Fahrten", () => {
  const other = trip("OTHER", "2026-10-02", "08:00", "10", "20", "CAR-2");
  const deleted = { ...trip("D", "2026-10-02", "12:00", "202947", "203132"), deletedAt: "2026-10-12" };
  expect(tripMileageGaps([previous, other, deleted, next])).toEqual([{ previous, next, kilometers: 185 }]);
});

test("Offline-Nachtrag zwischen neueren Serverfahrten ist idempotent und revisionssicher", () => {
  const initial: VehicleMutationState = { trips: [previous, next].map((item) => ({ ...item, revision: 1, status: "abgeschlossen" })) as VersionedVehicleTrip[], media: [], mutationResults: {} };
  const middle = trip("C", "2026-10-02", "12:00", "202947", "203132");
  const request = createSyncMutation({ entityId: middle.id, entityType: "vehicle_trip", resourceId: "CAR-1", operation: "create", payload: { ...middle } });
  const synced = applyVehicleMutation(initial, request);
  expect(synced.mutationResults[request.id].status).toBe("synced");
  expect(applyVehicleMutation(synced, request)).toBe(synced);
  expect(synced.trips).toHaveLength(3);
  expect(initial.trips).toHaveLength(2);
  const stale = createSyncMutation({ entityId: "C", entityType: "vehicle_trip", resourceId: "CAR-1", expectedRevision: 0, operation: "update", payload: { endOdometer: "203140" } });
  expect(applyVehicleMutation(synced, stale).mutationResults[stale.id].status).toBe("conflict");
});
