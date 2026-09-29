import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  overlayPendingJobOperations,
  prepareJobMutations,
  prepareNoteMutations,
  prepareProgressMutations,
  type RevisionedJob,
} from "../lib/jobOperationsSync";
import { createSyncMutation } from "../lib/syncQueue";

function job(overrides: Partial<RevisionedJob> = {}): RevisionedJob {
  return {
    consulting: {
      currency: "SEK",
      enabled: true,
      entries: [],
      hourlyRate: "750",
    },
    customerId: "CUSTOMER-1",
    id: "JOB-1",
    objectId: "OBJECT-1",
    schedule: { type: "einmalig" },
    status: "geplant",
    title: "Testauftrag",
    ...overrides,
  };
}

test("Auftrag und Zeiteinträge werden als unabhängige revisionierte Mutationen geplant", () => {
  const created = prepareJobMutations([], [job({
    consulting: {
      currency: "SEK",
      enabled: true,
      entries: [{ date: "2026-10-01", description: "Arbeit", id: "TIME-1", minutes: 30 }],
      hourlyRate: "750",
    },
  })], "2026-09-28T22:00:00.000Z");

  expect(created.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityId: "JOB-1", entityType: "job", operation: "create" }),
    expect.objectContaining({ entityId: "TIME-1", entityType: "job_time_entry", operation: "create", resourceId: "JOB-1" }),
  ]));
  expect(created.jobs[0]).toMatchObject({
    revision: 1,
    consulting: { entries: [expect.objectContaining({ id: "TIME-1", revision: 1 })] },
  });

  const updated = prepareJobMutations(created.jobs, [{
    ...created.jobs[0],
    status: "in Arbeit",
    consulting: {
      ...created.jobs[0].consulting!,
      entries: [{ ...created.jobs[0].consulting!.entries![0], minutes: 60 }],
    },
  }]);
  expect(updated.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "job", expectedRevision: 1, operation: "update" }),
    expect.objectContaining({ entityType: "job_time_entry", expectedRevision: 1, operation: "update" }),
  ]));
});

test("Tagesfortschritt und Notizen behalten Datum, Revision und Löschkontext", () => {
  const progressKey = "JOB-1::2026-10-01";
  const created = prepareProgressMutations({}, {
    [progressKey]: {
      "TASK-1": { completed: true, minutes: "45", note: "fertig", photos: [{ id: "PHOTO-1" }] },
    },
  });
  expect(created.mutations[0]).toMatchObject({
    entityId: `${progressKey}:TASK-1`,
    entityType: "field_progress",
    payload: { taskId: "TASK-1", workDate: "2026-10-01" },
  });

  const removed = prepareProgressMutations(created.progress, {});
  expect(removed.mutations[0]).toMatchObject({
    expectedRevision: 1,
    operation: "delete",
    payload: { taskId: "TASK-1", workDate: "2026-10-01" },
  });

  const notes = prepareNoteMutations({}, { [progressKey]: "Material fehlt" }, {});
  expect(notes.mutations[0]).toMatchObject({ entityType: "job_note", operation: "create", resourceId: "JOB-1" });
  const deletedNote = prepareNoteMutations(notes.notes, {}, notes.meta);
  expect(deletedNote.mutations[0]).toMatchObject({ expectedRevision: 1, operation: "delete", payload: { workDate: "2026-10-01" } });
});

test("Offline-Replay überlagert Serverdaten datensatzweise und löscht ohne Wiederauferstehung", () => {
  const serverJob = job({ revision: 4 });
  const update = createSyncMutation({
    entityId: serverJob.id,
    entityType: "job",
    expectedRevision: 4,
    operation: "update",
    payload: { status: "in Arbeit" },
    resourceId: serverJob.id,
  });
  const progress = createSyncMutation({
    entityId: "JOB-1::2026-10-01:TASK-1",
    entityType: "field_progress",
    operation: "create",
    payload: { completed: true, taskId: "TASK-1", workDate: "2026-10-01" },
    resourceId: serverJob.id,
  });
  const overlaid = overlayPendingJobOperations([serverJob], {}, {}, {}, [update, progress]);
  expect(overlaid.jobs[0]).toMatchObject({ revision: 5, status: "in Arbeit" });
  expect(overlaid.progress["JOB-1::2026-10-01"]["TASK-1"]).toMatchObject({ completed: true, revision: 1 });

  const deletion = createSyncMutation({
    entityId: serverJob.id,
    entityType: "job",
    expectedRevision: 4,
    operation: "delete",
    resourceId: serverJob.id,
  });
  expect(overlayPendingJobOperations([serverJob], {}, {}, {}, [deletion]).jobs).toEqual([]);
});

test("Legacy-Schreibwege sind gesperrt und der relationale Fallback bleibt nur lesend", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const appStateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const mutationRoute = readFileSync(path.join(root, "app/api/sync-mutations/route.ts"), "utf8");
  const portalRoute = readFileSync(path.join(root, "app/api/portal/context/route.ts"), "utf8");

  expect(sectionRoute).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sectionRoute).not.toContain("WORKCORE_JOB_OPERATIONS_LEGACY_READ_FALLBACK");
  expect(sectionRoute).not.toContain("LEGACY_JOB_OPERATIONS_READ_FALLBACK");
  expect(sectionRoute).toContain('if (keys.includes("jobs")) sections.jobs = await loadJobsSection');
  expect(sectionRoute).not.toContain("async function saveJobsSection");
  expect(sectionRoute).not.toContain("async function saveFieldProgressSection");
  expect(appStateRoute).toContain("APP_STATE_RETIRED");
  expect(mutationRoute).toContain('membershipAllows(auth.membership, "jobs.manage")');
  expect(mutationRoute).toContain('"homecare_apply_job_operation_mutation"');
  expect(portalRoute).toContain('.from("homecare_jobs")');
  expect(portalRoute).toContain('.not("status", "in", "(offerte,storniert)").is("deleted_at", null)');
});

test("Migration erzwingt Tombstones, Konflikte, Beziehungen und eindeutige Serienvorkommen", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928220000_jobs_operations_relational_cutover.sql"),
    "utf8",
  );
  const page = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");

  expect(migration).toContain("homecare_jobs_series_occurrence_live_uidx");
  expect(migration).toContain("homecare_apply_job_operation_mutation");
  expect(migration).toContain("homecare_prevent_job_operation_hard_delete");
  expect(migration).toContain("Der Auftrag wurde auf einem anderen Gerät geändert");
  expect(migration).toContain("foreign key(tenant_id,job_id)");
  expect(migration).toContain("primary key(tenant_id,id)");
  expect(page).toContain("seriesOccurrenceId(master.id, date)");
  expect(page).toContain("persistJobsRelational(nextJobs)");
});
