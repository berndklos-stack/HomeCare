import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { overlayPendingMasterData, prepareMasterDataMutations } from "../lib/masterDataSync";

test("restliche Stammdaten werden datensatzweise mit Revisionen geplant", () => {
  const before = [{ archived: false, id: "SVC-1", name: "Alt", revision: 3 }];
  const after = [{ archived: false, id: "SVC-1", name: "Neu", revision: 3 }, { id: "SVC-2", name: "Neu 2" }];
  const result = prepareMasterDataMutations("service", before, after, "2026-09-29T12:00:00.000Z");
  expect(result.mutations).toHaveLength(2);
  expect(result.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityId: "SVC-1", expectedRevision: 3, operation: "update" }),
    expect.objectContaining({ entityId: "SVC-2", operation: "create" }),
  ]));
});

test("Offline-Stammdaten überlagern relationale Daten und Tombstones verhindern Wiederauferstehung", () => {
  const server = [{ archived: false, id: "MAT-1", name: "Server", revision: 2 }];
  const update = prepareMasterDataMutations("material", server, [{ ...server[0], name: "Offline" }]).mutations[0];
  expect(overlayPendingMasterData(server, "material", [update])).toEqual([
    expect.objectContaining({ id: "MAT-1", name: "Offline", revision: 3 }),
  ]);
  const deletion = { ...update, operation: "delete" as const, payload: {} };
  expect(overlayPendingMasterData(server, "material", [deletion])).toEqual([]);
});

test("app_state und Bereichsschreiben sind beendet, Backups sind relational", () => {
  const root = process.cwd();
  const page = readFileSync(path.join(root, "app/page.tsx"), "utf8");
  const stateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const backupRoute = readFileSync(path.join(root, "app/api/app-backups/route.ts"), "utf8");
  const migration = readFileSync(path.join(root, "supabase/migrations/20260929130000_final_app_state_retirement.sql"), "utf8");
  const pgcryptoHotfix = readFileSync(path.join(root, "supabase/migrations/20260929133000_qualify_pgcrypto_digest.sql"), "utf8");

  expect(page).not.toContain('apiFetch("/api/app-state');
  expect(page).not.toContain('apiFetch("/api/sync-sections", {');
  expect(stateRoute).toContain("APP_STATE_RETIRED");
  expect(sectionRoute).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sectionRoute).toContain("legacyFallback: false");
  expect(sectionRoute).not.toContain("LEGACY_READ_FALLBACK");
  expect(backupRoute).toContain('from("homecare_relational_backups")');
  expect(backupRoute).toContain("homecare_restore_relational_backup");
  expect(migration).toContain("revoke all on table public.app_state from public,anon,authenticated,service_role");
  expect(pgcryptoHotfix).toContain("extensions.digest(payload::text,'sha256')");
  expect(pgcryptoHotfix).not.toMatch(/(?<!extensions\.)digest\s*\(/);
});
