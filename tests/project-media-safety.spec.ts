import { expect, test } from "@playwright/test";
import { applyObjectMediaSignedUrls, objectMediaPathsToSign, objectMediaReadColumns } from "../lib/server/objectMediaProjection";
import { readFileSync } from "node:fs";
import { legacyObjectMediaOwners } from "../lib/server/privateMediaAccess";
import { legacyObjectMediaPath } from "../lib/server/legacyObjectMediaPath";

const path = "migrated-app-state/2026-08-30/existing-project-photo.jpg";
const reference = { owner_type: "object", owner_id: "OBJECT-1", deleted_at: null, storage_path: "", preview_url: `/api/private-media?path=${encodeURIComponent(path)}` };

test("Objekt-Ladeabfrage erhaelt die Altzuordnung bis zur Signierung", () => {
  const origin = "https://our-project.supabase.co";
  const databaseRow = { ...reference, metadata: { previewUrl: reference.preview_url }, preview_url: `${origin}/storage/v1/object/sign/homecare-private-media/${path}?token=expired` };
  const selected = Object.fromEntries(objectMediaReadColumns.split(",").map((column) => column.trim()).map((column) => [column, databaseRow[column as keyof typeof databaseRow] ?? null]));
  expect(selected.metadata).toEqual(databaseRow.metadata);
  const rows = [selected as typeof databaseRow];
  const paths = objectMediaPathsToSign(rows, "tenant-1", origin);
  expect(paths).toEqual([path]);
  expect(applyObjectMediaSignedUrls(rows, "tenant-1", new Map([[path, "https://storage.local/fresh"]]), origin)[0].preview_url).toBe("https://storage.local/fresh");
  const route = readFileSync("app/api/sync-sections/route.ts", "utf8");
  const loader = route.slice(route.indexOf("async function loadObjectMediaRows"), route.indexOf("async function loadResourceMediaRows"));
  expect(loader).toContain(".select(objectMediaReadColumns)");
});

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

test("Bolet-4-Muster: abgelaufener eigener Storage-Link wird frisch signiert, ohne Referenz umzuschreiben", () => {
  const origin = "https://our-project.supabase.co";
  const expired = { ...reference, preview_url: `${origin}/storage/v1/object/sign/homecare-private-media/${path}?token=expired`, metadata: { previewUrl: reference.preview_url } };
  const original = { ...expired };
  expect(objectMediaPathsToSign([expired], "tenant-1", origin)).toEqual([path]);
  const projected = applyObjectMediaSignedUrls([expired], "tenant-1", new Map([[path, "https://storage.local/fresh"]]), origin);
  expect(projected[0]).toMatchObject({ storage_path: path, preview_url: "https://storage.local/fresh" });
  expect(expired).toEqual(original);
  expect(legacyObjectMediaOwners([expired], path, origin)).toEqual([reference.owner_id]);
  expect(legacyObjectMediaOwners([expired], `${path}-other`, origin)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...expired, deleted_at: "2026-10-12" }], path, origin)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...expired, metadata: null }], path, origin)).toEqual([]);
  expect(legacyObjectMediaOwners([{ ...expired, metadata: { previewUrl: `/api/private-media?path=${encodeURIComponent(`${path}-other`)}` } }], path, origin)).toEqual([]);
  expect(objectMediaPathsToSign([{ ...expired, metadata: null }], "tenant-1", origin)).toEqual([]);
});

test("Signierte Altpfade nur aus dem eigenen privaten Bucket, nie aus fremden URLs", () => {
  const origin = "https://our-project.supabase.co";
  const url = `${origin}/storage/v1/object/sign/homecare-private-media/${path}?token=expired`;
  expect(legacyObjectMediaPath(url, origin)).toBe(path);
  expect(legacyObjectMediaPath(url)).toBeNull();
  for (const invalid of [
    url.replace("our-project", "other-project"),
    url.replace("our-project.supabase.co", "our-project.supabase.co.attacker.invalid"),
    url.replace("homecare-private-media", "public-media"),
    url.replace("/object/sign/", "/object/public/"),
    url.replace("https://", "http://"),
    url.replace("existing-project-photo.jpg", "%2e%2e%2fother.jpg"),
  ]) {
    expect(legacyObjectMediaPath(invalid, origin)).toBeNull();
    expect(legacyObjectMediaOwners([{ ...reference, preview_url: invalid }], path, origin)).toEqual([]);
  }
});
