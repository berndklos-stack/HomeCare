import { expect, test } from "@playwright/test";
import { applyObjectMediaSignedUrls } from "../lib/server/objectMediaProjection";
import { legacyObjectMediaOwners } from "../lib/server/privateMediaAccess";

const path = "migrated-app-state/2026-08-30/existing-project-photo.jpg";
const reference = { owner_type: "object", owner_id: "OBJECT-1", deleted_at: null, storage_path: "", preview_url: `/api/private-media?path=${encodeURIComponent(path)}` };

test("Alte Bildreferenz liefert dauerhaften Pfad fuer den authentifizierten Fallback", () => {
  const projected = applyObjectMediaSignedUrls([reference], "tenant-1", new Map([[path, "https://storage.local/signed-photo"]]));
  expect(projected[0]).toMatchObject({ storage_path: path, preview_url: "https://storage.local/signed-photo" });
  expect(reference.storage_path).toBe("");
  expect(applyObjectMediaSignedUrls([reference], "tenant-1", new Map())[0].storage_path).toBe(path);
});

test("Legacy-Datei benoetigt exakte aktive Objektzuordnung statt bloss bekannten Pfad", () => {
  expect(legacyObjectMediaOwners([reference], path)).toEqual(["OBJECT-1"]);
  expect(legacyObjectMediaOwners([reference], `${path}-other`)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...reference, deleted_at: "2026-10-12" }], path)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...reference, owner_type: "pending" }], path)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...reference, storage_path: "tenant-2/other.jpg" }], path)).toEqual([]);
  expect(legacyObjectMediaOwners([reference], "migrated-app-state/../other.jpg")).toEqual([]);
  expect(legacyObjectMediaOwners([reference], "tenant-2/other.jpg")).toEqual([]);
});
