import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  overlayPendingResourceMutations,
  overlayPendingVehiclePositionMutations,
  prepareResourceMutations,
} from "../lib/resourceSync";
import { createSyncMutation, normalizeSyncQueue } from "../lib/syncQueue";

type TestResource = Record<string, unknown> & {
  id: string;
  logbook: unknown[];
  name: string;
  revision?: number;
};

function resource(overrides: Partial<TestResource> = {}): TestResource {
  return { id: "resource-1", logbook: [], name: "Vehicle", revision: 1, ...overrides };
}

test("Ressourcen werden als create/update/delete-Datensatzmutationen geplant", () => {
  const created = prepareResourceMutations<TestResource>([], [resource()], "2026-09-28T10:00:00.000Z");
  expect(created.mutations).toMatchObject([{ entityType: "resource", operation: "create", resourceId: "resource-1" }]);
  expect(created.resources[0].revision).toBe(1);

  const updated = prepareResourceMutations(
    created.resources,
    [{ ...created.resources[0], name: "Vehicle updated" }],
    "2026-09-28T10:01:00.000Z",
  );
  expect(updated.mutations).toMatchObject([{ expectedRevision: 1, operation: "update" }]);
  expect(updated.resources[0].revision).toBe(2);

  const deleted = prepareResourceMutations(updated.resources, [], "2026-09-28T10:02:00.000Z");
  expect(deleted.mutations).toMatchObject([{ expectedRevision: 2, operation: "delete" }]);
});

test("reine Fahrtenänderungen erzeugen keine Ressourcenmutation", () => {
  const current = resource({ logbook: [{ id: "trip-1", status: "laufend" }] });
  const next = resource({ logbook: [{ id: "trip-1", status: "abgeschlossen" }] });
  expect(prepareResourceMutations([current], [next]).mutations).toEqual([]);
});

test("Offline-Ressourcenmutationen überlagern den Serverstand datensatzweise", () => {
  const create = createSyncMutation({
    entityId: "resource-2",
    entityType: "resource",
    operation: "create",
    payload: { name: "Offline vehicle" },
    resourceId: "resource-2",
  }, "2026-09-28T10:00:00.000Z");
  const update = createSyncMutation({
    entityId: "resource-1",
    entityType: "resource",
    expectedRevision: 1,
    operation: "update",
    payload: { name: "Offline update" },
    resourceId: "resource-1",
  }, "2026-09-28T10:01:00.000Z");
  const overlaid = overlayPendingResourceMutations([resource()], [create, update]);
  expect(overlaid).toHaveLength(2);
  expect(overlaid.find((item) => item.id === "resource-1")).toMatchObject({ name: "Offline update", revision: 2 });
  expect(overlaid.find((item) => item.id === "resource-2")).toMatchObject({ name: "Offline vehicle", revision: 1 });
});

test("lokaler Delete-Tombstone verhindert Wiederauferstehung aus einem gelesenen Altstand", () => {
  const deletion = createSyncMutation({
    entityId: "resource-1",
    entityType: "resource",
    expectedRevision: 1,
    operation: "delete",
    resourceId: "resource-1",
  });
  expect(overlayPendingResourceMutations([resource()], [deletion])).toEqual([]);
});

test("Fahrzeugpositionen nutzen dieselbe dauerhafte Queue und Revisionen", () => {
  const mutation = createSyncMutation({
    entityId: "resource-1",
    entityType: "vehicle_position",
    expectedRevision: 4,
    operation: "update",
    payload: { address: "Waypoint", status: "active" },
    resourceId: "resource-1",
  });
  expect(normalizeSyncQueue([mutation])).toHaveLength(1);
  expect(overlayPendingVehiclePositionMutations([
    { address: "Start", resourceId: "resource-1", revision: 4 },
  ], [mutation])).toEqual([
    expect.objectContaining({ address: "Waypoint", resourceId: "resource-1", revision: 5 }),
  ]);
});

test("Legacy-Endpunkte können Ressourcen und Positionen nicht mehr überschreiben", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const positionRoute = readFileSync(path.join(root, "app/api/vehicle-positions/route.ts"), "utf8");
  const appStateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  expect(sectionRoute).toContain('if ("resources" in filteredPatch)');
  expect(sectionRoute).toContain("datensatzweise Sync-Mutation");
  expect(positionRoute).not.toContain('.upsert({');
  expect(positionRoute).toContain("status: 410");
  expect(appStateRoute).toContain("withoutRelationalResourceWrites");
});

test("Migration enthält Revisionen, Tombstones, Tenant-Scope und aktive-Fahrt-Schutz", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928100000_resource_vehicle_position_cutover.sql"),
    "utf8",
  );
  expect(migration).toContain("homecare_apply_resource_mutation");
  expect(migration).toContain("p_expected_revision");
  expect(migration).toContain("homecare_sync_mutations");
  expect(migration).toContain("tenant_id = tenant");
  expect(migration).toContain("homecare_prevent_active_resource_delete");
  expect(migration).toContain("deleted_at = now()");
});
