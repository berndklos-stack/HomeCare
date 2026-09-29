import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  overlayPendingSetting,
  overlayPendingTranslations,
  prepareSettingMutation,
  prepareTranslationMutations,
} from "../lib/settingsSync";
import { createSyncMutation } from "../lib/syncQueue";

test("Einstellungen werden als revisionsfähige Datensatzmutationen geplant", () => {
  const created = prepareSettingMutation("setting", "companySettings", undefined, { name: "Company" });
  expect(created.mutation).toMatchObject({ entityType: "setting", entityId: "companySettings", operation: "create" });
  expect(created.value.revision).toBe(1);

  const updated = prepareSettingMutation("setting", "companySettings", created.value, { ...created.value, name: "Company updated" });
  expect(updated.mutation).toMatchObject({ expectedRevision: 1, operation: "update" });
  expect(updated.value.revision).toBe(2);
  expect(updated.mutation.payload).toEqual({ value: { name: "Company updated" } });
});

test("Offline-Einstellungen überlagern den Serverstand ohne ganzen Abschnitt zu ersetzen", () => {
  const mutation = createSyncMutation({
    entityId: "dailyMailSettings",
    entityType: "setting",
    expectedRevision: 3,
    operation: "update",
    payload: { value: { enabled: false, sendTime: "08:00" } },
    resourceId: "dailyMailSettings",
  }, "2026-09-28T12:00:00.000Z");
  expect(overlayPendingSetting(
    { enabled: true, revision: 3, sendTime: "06:00" },
    "setting",
    "dailyMailSettings",
    [mutation],
  )).toMatchObject({ enabled: false, revision: 4, sendTime: "08:00" });
});

test("Übersetzungen werden pro Schlüssel erstellt, geändert und gelöscht", () => {
  const current = [{ de: "Alt", en: "Old", key: "Label", revision: 2, sv: "Gammal" }];
  const next = [
    { ...current[0], en: "New" },
    { de: "Neu", en: "New item", key: "NewLabel", sv: "Ny" },
  ];
  const prepared = prepareTranslationMutations(current, next);
  expect(prepared.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityId: "Label", expectedRevision: 2, operation: "update" }),
    expect.objectContaining({ entityId: "NewLabel", operation: "create" }),
  ]));

  const deleted = prepareTranslationMutations(prepared.rows, [prepared.rows[1]]);
  expect(deleted.mutations).toContainEqual(expect.objectContaining({ entityId: "Label", operation: "delete" }));
});

test("lokale Übersetzungs-Tombstones verhindern Wiederauferstehung", () => {
  const deletion = createSyncMutation({
    entityId: "Label",
    entityType: "translation",
    expectedRevision: 2,
    operation: "delete",
    resourceId: "Label",
  });
  expect(overlayPendingTranslations([
    { de: "Alt", en: "Old", key: "Label", revision: 2, sv: "Gammal" },
  ], [deletion])).toEqual([]);
});

test("Legacy-Endpunkte können Phase-3B-Domänen nicht mehr überschreiben", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const appStateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const cronRoute = readFileSync(path.join(root, "app/api/cron/daily-jobs/route.ts"), "utf8");
  expect(sectionRoute).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sectionRoute).toContain("loadAuthoritativeSettingsSections");
  expect(sectionRoute).not.toContain("LEGACY_SETTINGS_READ_FALLBACK");
  expect(appStateRoute).toContain("APP_STATE_RETIRED");
  expect(cronRoute).toContain('.from("homecare_daily_mail_state")');
  expect(cronRoute).not.toContain('SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
  expect(cronRoute).not.toContain('kolaretorp-daily-job-mail');
});

test("Migration trennt Konfiguration, Übersetzungen und operative Tagesmail-Daten", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928130000_settings_relational_cutover.sql"),
    "utf8",
  );
  expect(migration).toContain("homecare_apply_settings_mutation");
  expect(migration).toContain("homecare_daily_mail_state");
  expect(migration).toContain("homecare_claim_daily_mail_send");
  expect(migration).toContain("deleted_at timestamptz");
  expect(migration).toContain("settings_revision");
  expect(migration).toContain("on conflict (tenant_id, key) do nothing");
});
