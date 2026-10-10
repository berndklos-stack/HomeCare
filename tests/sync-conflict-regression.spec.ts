import { expect, test } from "@playwright/test";
import { createSyncMutation, enqueueSyncMutation, markMutationSyncing, nextPendingMutation, revisionAfterConfirmation, settleSyncMutation } from "../lib/syncQueue";
import { prepareProgressMutations } from "../lib/jobOperationsSync";
import { reviewConflictSequence, reviewProgressConflict } from "../lib/conflictReview";

const edit = (revision: number, minutes = "90") => createSyncMutation({
  entityType: "field_progress", entityId: "JOB:task", resourceId: "JOB", operation: "update", expectedRevision: revision,
  payload: { taskId: "task", workDate: null, completed: false, minutes, note: "Arbeit", photos: [], showWorkTimeInReport: true },
});
const row = { id: "JOB:task", tenant_id: "T", job_id: "JOB", revision: 4, deleted_at: null,
  task_id: "task", work_date: null, completed: false, minutes: 90, note: "Arbeit", photos: [], show_work_time_in_report: true };

test("Verspaetete Bestaetigung setzt die Revision einer weiteren lokalen Eingabe nicht zurueck", () => {
  const first = edit(1, "30");
  let queue = markMutationSyncing([first], first.id);
  const second = edit(2, "60");
  queue = enqueueSyncMutation(queue, second);
  queue = settleSyncMutation(queue, first.id, { mutationId: first.id, status: "synced", record: { revision: 2 } });
  const revision = revisionAfterConfirmation(first, 2, queue);
  expect(revision).toBe(3);
  const current = { JOB: { task: { revision, minutes: "60" } } };
  const next = prepareProgressMutations(current, { JOB: { task: { ...current.JOB.task, minutes: "90" } } });
  expect(next.mutations[0].expectedRevision).toBe(3);
  expect(revisionAfterConfirmation(first, 2, [])).toBe(2);
});

test("Konflikte und Fehler blockieren nur Folgeaenderungen desselben Datensatzes", () => {
  const first = edit(1);
  const second = edit(2);
  const unrelated = { ...edit(1), entityId: "OTHER:task", resourceId: "OTHER" };
  for (const status of ["conflict", "failed", "syncing"] as const) {
    expect(nextPendingMutation([{ ...first, status }, second, unrelated])).toEqual(unrelated);
    expect(nextPendingMutation([{ ...first, status }, second])).toBeUndefined();
  }
  expect(nextPendingMutation([{ ...first, status: "synced" }, second])).toEqual(second);
});

test("Fortschrittsvergleich prueft Zeiten, Texte, Fotos und Mandant vollstaendig", () => {
  const mutation = { ...edit(2), status: "conflict" as const };
  expect(reviewProgressConflict(mutation, row, "T").redundant).toBe(true);
  for (const changed of [{ ...row, minutes: 60 }, { ...row, note: "Andere Arbeit" }, { ...row, photos: [{ id: "photo" }] },
    { ...row, tenant_id: "OTHER" }, { ...row, job_id: "OTHER" }, { ...row, deleted_at: "2026-10-10" }]) {
    expect(reviewProgressConflict(mutation, changed, "T").redundant).toBe(false);
  }
  expect(reviewProgressConflict({ ...mutation, payload: { ...mutation.payload, unknown: true } }, row, "T").redundant).toBe(false);
});

test("Alte Konfliktfolgen sind nur erledigt, wenn der letzte vollstaendige lokale Stand serverbestaetigt ist", () => {
  const first = { ...edit(2, "60"), status: "conflict" as const };
  const latest = { ...edit(3), status: "conflict" as const };
  const snapshot = [first, latest];
  const reviews = snapshot.map((mutation) => reviewProgressConflict(mutation, row, "T"));
  expect(reviewConflictSequence(snapshot, snapshot, reviews).every((r) => r.redundant)).toBe(true);
  expect(reviewConflictSequence(snapshot, [...snapshot, edit(4)], reviews).some((r) => r.redundant)).toBe(false);
  expect(reviewConflictSequence(snapshot, [first, { ...latest, payload: { ...latest.payload, note: "Neue Eingabe" } }], reviews).some((r) => r.redundant)).toBe(false);
  expect(reviewConflictSequence(snapshot, snapshot, snapshot.map((m) => reviewProgressConflict(m, { ...row, minutes: 120 }, "T"))).some((r) => r.redundant)).toBe(false);
  const partial = { ...latest, payload: { taskId: "task", note: "Arbeit" } };
  const partialSnapshot = [first, partial];
  expect(reviewConflictSequence(partialSnapshot, partialSnapshot, partialSnapshot.map((m) => reviewProgressConflict(m, row, "T"))).some((r) => r.redundant)).toBe(false);
});
