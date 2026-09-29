import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { overlayPendingObjectMutations, prepareObjectMutations, type RevisionedObject } from "../lib/objectSync";
import { createSyncMutation } from "../lib/syncQueue";

function object(overrides: Partial<RevisionedObject> = {}): RevisionedObject {
  return {
    address: "Testgatan 1",
    customFields: { projectManager: "Anna" },
    id: "OBJECT-1",
    media: { documents: 0, floorPlans: 0, images: 0, items: [] },
    name: "Testobjekt",
    type: "Projekt",
    ...overrides,
  };
}

test("Objekte und Medien werden unabhängig und revisioniert mutiert", () => {
  const created = prepareObjectMutations([], [object({
    media: {
      documents: 0,
      floorPlans: 0,
      images: 1,
      items: [{ id: "MEDIA-1", name: "bild.jpg", source: "Kamera", type: "Bild" }],
    },
  })], "2026-09-28T19:00:00.000Z");
  expect(created.mutations).toEqual([
    expect.objectContaining({ entityId: "OBJECT-1", entityType: "object", operation: "create" }),
    expect.objectContaining({ entityId: "MEDIA-1", entityType: "object_media", operation: "create", resourceId: "OBJECT-1" }),
  ]);
  expect(created.objects[0]).toMatchObject({ revision: 1, media: { items: [expect.objectContaining({ revision: 1 })] } });

  const updated = prepareObjectMutations(created.objects, [{
    ...created.objects[0],
    name: "Geändertes Objekt",
    media: { documents: 0, floorPlans: 0, images: 0, items: [] },
  }]);
  expect(updated.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "object", expectedRevision: 1, operation: "update" }),
    expect.objectContaining({ entityType: "object_media", expectedRevision: 1, operation: "delete" }),
  ]));
});

test("Offline-Mutationen überlagern relationale Daten ohne Wiederauferstehung", () => {
  const server = object({ revision: 3 });
  const mediaCreate = createSyncMutation({
    entityId: "MEDIA-OFFLINE",
    entityType: "object_media",
    operation: "create",
    payload: { name: "offline.jpg", source: "Kamera", type: "Bild" },
    resourceId: server.id,
  });
  const updated = overlayPendingObjectMutations([server], [mediaCreate]);
  expect(updated[0].media).toMatchObject({ images: 1, items: [expect.objectContaining({ id: "MEDIA-OFFLINE", revision: 1 })] });

  const deletion = createSyncMutation({
    entityId: server.id,
    entityType: "object",
    expectedRevision: 3,
    operation: "delete",
    resourceId: server.id,
  });
  expect(overlayPendingObjectMutations([server], [deletion])).toEqual([]);
});

test("Legacy-Endpunkte können Objekte und Medien nicht mehr überschreiben", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const appStateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const syncRoute = readFileSync(path.join(root, "app/api/sync-mutations/route.ts"), "utf8");
  expect(sectionRoute).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sectionRoute).toContain('if (keys.includes("objects")) sections.objects = await loadObjectsSection');
  expect(sectionRoute).not.toContain("WORKCORE_OBJECT_LEGACY_READ_FALLBACK");
  expect(sectionRoute).not.toContain("LEGACY_OBJECT_READ_FALLBACK");
  expect(sectionRoute).not.toContain("mergeLegacyObjectsWithoutResurrection");
  expect(appStateRoute).toContain("APP_STATE_RETIRED");
  expect(syncRoute).toContain('membershipAllows(auth.membership, "objects.manage")');
  expect(syncRoute).toContain('membershipAllows(auth.membership, "media.manage")');
  expect(syncRoute).toContain('"homecare_apply_object_mutation"');
  expect(syncRoute).toContain('const privateMediaBucket = "homecare-private-media"');
  expect(syncRoute).toContain("remove(storagePaths)");
});

test("Migration schützt Beziehungen, Tombstones und Medienbesitz", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928190000_objects_media_relational_cutover.sql"),
    "utf8",
  );
  expect(migration).toContain("object_type text not null default 'Objekt'");
  expect(migration).toContain("custom_fields jsonb not null default '{}'::jsonb");
  expect(migration).toContain("homecare_apply_object_mutation");
  expect(migration).toContain("homecare_prevent_object_hard_delete");
  expect(migration).toContain("Der Speicherpfad gehört nicht zu diesem Mandanten");
  expect(migration).toContain("Aktive Aufträge oder offene Abrechnungsposten verhindern das Löschen");
  expect(migration).toContain("on conflict (id) do nothing");
});

test("Portal liefert nur aktive, nicht gelöschte Kundenobjekte", () => {
  const route = readFileSync(path.join(process.cwd(), "app/api/portal/context/route.ts"), "utf8");
  expect(route).toContain('.from("homecare_objects")');
  expect(route).toContain('.eq("owner_customer_id", customerId)');
  expect(route).toContain('.eq("archived", false).is("deleted_at", null)');
});
