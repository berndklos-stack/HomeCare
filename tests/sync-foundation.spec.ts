import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createSyncMutation,
  enqueueSyncMutation,
  failSyncMutation,
  readSyncQueue,
  retrySyncMutation,
  syncQueueStorageKey,
  writeSyncQueue,
  type StorageLike,
} from "../lib/syncQueue";
import {
  applyVehicleMutation,
  latestAuthoritativeOdometer,
  reconcileAuthoritativeMedia,
  reconcileAuthoritativeTrips,
  type VehicleMutationState,
  type VersionedVehicleTrip,
} from "../lib/vehicleSync";

function memoryStorage(): StorageLike & { value: Record<string, string> } {
  const value: Record<string, string> = {};
  return {
    getItem: (key) => value[key] ?? null,
    setItem: (key, item) => { value[key] = item; },
    value,
  };
}

function trip(overrides: Partial<VersionedVehicleTrip> = {}): VersionedVehicleTrip {
  return {
    id: "trip-1",
    resourceId: "vehicle-1",
    revision: 1,
    startOdometer: "100",
    status: "laufend",
    updatedAt: "2026-09-26T08:00:00.000Z",
    ...overrides,
  };
}

function state(trips: VersionedVehicleTrip[] = []): VehicleMutationState {
  return { media: [], mutationResults: {}, trips };
}

test("1. neuer Serverstand ersetzt einen veralteten Cache", () => {
  const server = trip({ revision: 3, status: "abgeschlossen", endOdometer: "140" });
  const cached = trip({ revision: 1, status: "laufend" });
  expect(reconcileAuthoritativeTrips([server], [cached])).toEqual([server]);
});

test("2. Offline-Mutation bleibt nach Neuladen erhalten und kann später angewendet werden", () => {
  const storage = memoryStorage();
  const mutation = createSyncMutation({
    entityId: "trip-offline",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  writeSyncQueue(storage, enqueueSyncMutation([], mutation));
  const restored = readSyncQueue(storage);
  expect(restored).toHaveLength(1);
  expect(applyVehicleMutation(state(), restored[0]).mutationResults[mutation.id].status).toBe("synced");
});

test("3. dieselbe Mutation wird idempotent nur einmal angewendet", () => {
  const mutation = createSyncMutation({
    entityId: "trip-idempotent",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  const applied = applyVehicleMutation(state(), mutation);
  const repeated = applyVehicleMutation(applied, mutation);
  expect(repeated).toBe(applied);
  expect(repeated.trips).toHaveLength(1);
});

test("4. Tombstone vom Server verhindert Wiedererscheinen auf einem zweiten Gerät", () => {
  const deleted = trip({ deletedAt: "2026-09-26T09:00:00.000Z", revision: 2 });
  expect(reconcileAuthoritativeTrips([deleted], [trip()], [])).toEqual([]);
});

test("5. parallele Bearbeitung mit veralteter Revision wird als Konflikt erkannt", () => {
  const serverState = state([trip({ revision: 4 })]);
  const staleUpdate = createSyncMutation({
    entityId: "trip-1",
    entityType: "vehicle_trip",
    expectedRevision: 3,
    operation: "update",
    payload: { endOdometer: "120" },
    resourceId: "vehicle-1",
  });
  const result = applyVehicleMutation(serverState, staleUpdate);
  expect(result.mutationResults[staleUpdate.id].status).toBe("conflict");
  expect(result.trips[0].revision).toBe(4);
});

test("6. zwei gleichzeitige Starts ergeben serverseitig maximal eine aktive Fahrt", () => {
  const first = createSyncMutation({
    entityId: "trip-a",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  const second = createSyncMutation({
    entityId: "trip-b",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  const afterFirst = applyVehicleMutation(state(), first);
  const afterSecond = applyVehicleMutation(afterFirst, second);
  expect(afterSecond.trips.filter((item) => item.status === "laufend" && !item.deletedAt)).toHaveLength(1);
  expect(afterSecond.mutationResults[second.id].status).toBe("conflict");

  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260926120000_sync_foundation_vehicle_trips.sql"), "utf8");
  expect(migration).toContain("homecare_vehicle_trips_one_active_per_resource_idx");
  expect(migration).toContain("where status = 'laufend' and deleted_at is null");
});

test("7. eine auf Gerät A gestartete Fahrt kann Gerät B revisionssicher beenden", () => {
  const start = createSyncMutation({
    entityId: "trip-shared",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  const afterStart = applyVehicleMutation(state(), start);
  const end = createSyncMutation({
    entityId: "trip-shared",
    entityType: "vehicle_trip",
    expectedRevision: 1,
    operation: "update",
    payload: { endedAt: "2026-09-26T10:00:00.000Z", endOdometer: "125", status: "abgeschlossen" },
    resourceId: "vehicle-1",
  });
  const afterEnd = applyVehicleMutation(afterStart, end);
  expect(afterEnd.trips[0]).toMatchObject({ endOdometer: "125", revision: 2, status: "abgeschlossen" });
});

test("8. letzter Kilometerstand stammt aus der neuesten abgeschlossenen Fahrt", () => {
  expect(latestAuthoritativeOdometer([
    trip({ id: "old", status: "abgeschlossen", endOdometer: "120", endedAt: "2026-09-25T10:00:00.000Z" }),
    trip({ id: "active", status: "laufend", startOdometer: "150", updatedAt: "2026-09-26T12:00:00.000Z" }),
    trip({ id: "new", status: "abgeschlossen", endOdometer: "145", endedAt: "2026-09-26T08:00:00.000Z" }),
  ], "90")).toBe("145");
});

test("9. serverseitig gelöschtes Fahrzeugbild wird nicht aus dem Cache restauriert", () => {
  const deleted = { deletedAt: "2026-09-26T09:00:00.000Z", id: "photo-1", revision: 2 };
  const cached = { id: "photo-1", revision: 1 };
  expect(reconcileAuthoritativeMedia([deleted], [cached])).toEqual([]);
});

test("10. fehlgeschlagene Mutation bleibt sichtbar und erneut ausführbar", () => {
  const storage = memoryStorage();
  const mutation = createSyncMutation({
    entityId: "trip-retry",
    entityType: "vehicle_trip",
    operation: "create",
    payload: { startOdometer: "100", status: "laufend" },
    resourceId: "vehicle-1",
  });
  const failed = failSyncMutation([mutation], mutation.id, "Netzwerk nicht erreichbar");
  writeSyncQueue(storage, failed);
  expect(JSON.parse(storage.value[syncQueueStorageKey])[0]).toMatchObject({ error: "Netzwerk nicht erreichbar", status: "failed" });
  expect(retrySyncMutation(readSyncQueue(storage), mutation.id)[0]).toMatchObject({ error: undefined, status: "pending" });
});
