import { expect, test } from "@playwright/test";
import { createSyncMutation, enqueueSyncMutation, markMutationSyncing, nextPendingMutation, revisionAfterConfirmation, settleSyncMutation, retryNetworkFailures } from "../lib/syncQueue";
import { prepareProgressMutations, hasUnfinishedProgressPhotos } from "../lib/jobOperationsSync";
import { reviewApprovedResolution, reviewConflictSequence, reviewProgressConflict } from "../lib/conflictReview";

const edit = (revision: number, minutes = "90") => createSyncMutation({
  entityType: "field_progress", entityId: "JOB:task", resourceId: "JOB", operation: "update", expectedRevision: revision,
  payload: { taskId: "task", workDate: null, completed: false, minutes, note: "Arbeit", photos: [], showWorkTimeInReport: true },
});
const row = { id: "JOB:task", tenant_id: "T", job_id: "JOB", revision: 4, deleted_at: null,
  task_id: "task", work_date: null, completed: false, minutes: 90, note: "Arbeit", photos: [], show_work_time_in_report: true };

test("Netzwerkfehler werden pro Verbindungsphase nur einmal mit unveraenderter Identitaet wiederholt", () => {
  const network = { ...edit(15), status: "failed" as const, error: "Load failed", attempts: 2 };
  const validation = { ...edit(2), status: "failed" as const, error: "INVALID_PAYLOAD" };
  const conflict = { ...edit(3), status: "conflict" as const, error: "Load failed" };
  const attempted = new Set<string>();
  const retried = retryNetworkFailures([network, validation, conflict], attempted);
  expect(retried[0]).toMatchObject({ id: network.id, payload: network.payload, expectedRevision: 15, attempts: 2, status: "pending" });
  expect(retried[1]).toBe(validation);
  expect(retried[2]).toBe(conflict);
  expect(retryNetworkFailures([network], attempted)[0]).toBe(network);
  attempted.clear();
  expect(retryNetworkFailures([network], attempted)[0].status).toBe("pending");
});

test("Foto-Upload-Zwischenstaende bleiben lokal und ersetzen keine gespeicherte Fotoliste", () => {
  const uploaded = { id: "saved", uploadStatus: "uploaded", storagePath: "tenant/saved.jpg" };
  const current = { JOB: { task: { revision: 33, note: "Arbeit", minutes: "165", photos: [uploaded] } } };
  for (const uploadStatus of ["uploading", "queued", "failed"]) {
    const pending = { id: "new", uploadStatus };
    const next = { JOB: { task: { ...current.JOB.task, photos: [uploaded, pending] } } };
    const prepared = prepareProgressMutations(current, next);
    expect(prepared.mutations).toHaveLength(0);
    expect(prepared.progress.JOB.task.photos).toEqual([uploaded, pending]);
    expect(prepared.progress.JOB.task.revision).toBe(33);
    const text = prepareProgressMutations(current, { JOB: { task: { ...next.JOB.task, note: "Neuer Text" } } });
    expect(text.mutations).toHaveLength(1);
    expect(text.mutations[0].payload).not.toHaveProperty("photos");
    expect(hasUnfinishedProgressPhotos(next.JOB.task)).toBe(true);
    const finished = { JOB: { task: { ...next.JOB.task, photos: [uploaded, { ...pending, uploadStatus: "uploaded", storagePath: "tenant/new.jpg" }] } } };
    expect(prepareProgressMutations(next, finished).mutations[0].payload.photos).toEqual(finished.JOB.task.photos);
  }
  const removed = prepareProgressMutations(current, { JOB: { task: { ...current.JOB.task, photos: [] } } });
  expect(removed.mutations[0].payload.photos).toEqual([]);
});

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

test("Bestaetigte Zusammenfuehrung gilt nur fuer die exakt gesicherte Mutation desselben Mandanten", () => {
  const mutation = { ...edit(2), status: "conflict" as const };
  const resolution = { kind: "user_approved_merge", resourceId: "JOB", backupId: "00000000-0000-0000-0000-000000000002", approvedAt: "2026-10-10T08:00:00Z" };
  const journal = { mutation_id: mutation.id, tenant_id: "T", entity_type: mutation.entityType, entity_id: mutation.entityId,
    operation: mutation.operation, request_payload: mutation.payload, response_payload: { resolution } };
  const reviewed = reviewApprovedResolution(mutation, journal, "T");
  expect(reviewed?.redundant).toBe(true);
  expect(reviewConflictSequence([mutation], [mutation], [reviewed!])[0].redundant).toBe(true);
  const pending = { ...edit(3), id: "new-local-edit", payload: { ...mutation.payload, note: "Neue lokale Eingabe" } };
  expect(reviewConflictSequence([mutation], [mutation, pending], [reviewed!])[0].redundant).toBe(true);
  expect(reviewConflictSequence([mutation], [{ ...mutation, payload: { ...mutation.payload, note: "Geaendert" } }, pending], [reviewed!])[0].redundant).toBe(false);
  for (const changed of [{ ...journal, tenant_id: "OTHER" }, { ...journal, mutation_id: "OTHER" },
    { ...journal, request_payload: { ...mutation.payload, minutes: "120" } },
    { ...journal, response_payload: { resolution: { ...resolution, backupId: "" } } }]) {
    expect(reviewApprovedResolution(mutation, changed, "T")).toBeNull();
  }
});
