import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { overlayPendingReportCommunication, preparePortalMessageMutations, prepareReportMutations } from "../lib/reportCommunicationSync";
import { createSyncMutation } from "../lib/syncQueue";

test("Berichte und ihre Medien werden als getrennte revisionierte Mutationen geplant", () => {
  const created = prepareReportMutations([], [{
    attachments: [{ id: "MEDIA-A", name: "bericht.pdf", storagePath: "tenant/reports/a.pdf" }],
    checklistResults: [{ id: "TASK-1", photos: [{ id: "MEDIA-P", name: "foto.jpg", storagePath: "tenant/photos/p.jpg" }] }],
    date: "2026-09-28", id: "REPORT-1", jobId: "JOB-1", objectId: "OBJECT-1", title: "Bericht",
  }]);
  expect(created.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "report", entityId: "REPORT-1", operation: "create" }),
    expect.objectContaining({ entityType: "report_media", entityId: "MEDIA-A", resourceId: "REPORT-1" }),
    expect.objectContaining({ entityType: "report_media", entityId: "MEDIA-P", payload: expect.objectContaining({ taskId: "TASK-1" }) }),
  ]));
  const reportPayload = created.mutations.find((item) => item.entityType === "report")?.payload;
  expect(reportPayload?.attachments).toBeUndefined();
  expect((reportPayload?.checklistResults as Array<{ photos: unknown[] }>)[0].photos).toEqual([]);
  expect(overlayPendingReportCommunication(created.reports, [], created.mutations).reports[0].checklistResults?.[0].photos)
    .toEqual([expect.objectContaining({ id: "MEDIA-P", storagePath: "tenant/photos/p.jpg" })]);

  const removed = prepareReportMutations(created.reports, []);
  expect(removed.mutations).toContainEqual(expect.objectContaining({ entityType: "report", operation: "delete", expectedRevision: 1 }));
});

test("Portalnachrichten, Antworten und Anhänge sind unabhängige Datensätze", () => {
  const created = preparePortalMessageMutations([], [{
    attachments: [{ id: "MEDIA-M", name: "antwort.pdf", storagePath: "tenant/messages/m.pdf" }],
    customerId: "CUSTOMER-1", id: "MESSAGE-1", message: "Hallo", objectId: "OBJECT-1",
    replies: [{ body: "Antwort", deliveryStatus: "gesendet", id: "REPLY-1", sentAt: "2026-09-28T20:00:00Z" }],
    status: "neu", subject: "Frage",
  }]);
  expect(created.mutations).toEqual(expect.arrayContaining([
    expect.objectContaining({ entityType: "portal_message", entityId: "MESSAGE-1" }),
    expect.objectContaining({ entityType: "portal_message_reply", entityId: "REPLY-1", resourceId: "MESSAGE-1" }),
    expect.objectContaining({ entityType: "communication_media", entityId: "MEDIA-M", resourceId: "MESSAGE-1" }),
  ]));
});

test("Offline-Überlagerung verhindert Wiederauferstehung und erhält lokale Änderungen", () => {
  const report = { id: "REPORT-1", revision: 3, title: "Server" };
  const update = createSyncMutation({ entityId: report.id, entityType: "report", expectedRevision: 3, operation: "update", payload: { title: "Mobil" }, resourceId: report.id });
  expect(overlayPendingReportCommunication([report], [], [update]).reports[0]).toMatchObject({ title: "Mobil", revision: 4 });
  const deletion = createSyncMutation({ entityId: report.id, entityType: "report", expectedRevision: 3, operation: "delete", resourceId: report.id });
  expect(overlayPendingReportCommunication([report], [], [deletion]).reports).toEqual([]);
});

test("Medien-Replay erhält Serverfotos, bleibt idempotent und respektiert gelöschte Berichte", () => {
  const report = { id: "REPORT-1", revision: 3, checklistResults: [{ id: "TASK-1", photos: [{ id: "SERVER", name: "server.jpg" }] }] };
  const update = createSyncMutation({ entityId: report.id, entityType: "report", expectedRevision: 3, operation: "update", payload: { checklistResults: [{ id: "TASK-1", photos: [] }] }, resourceId: report.id });
  const media = createSyncMutation({ entityId: "LOCAL", entityType: "report_media", operation: "create", payload: { ownerId: report.id, mediaRole: "checklist_photo", taskId: "TASK-1", name: "local.jpg" }, resourceId: report.id });
  const first = overlayPendingReportCommunication([report], [], [update, media]).reports;
  expect(first[0].checklistResults[0].photos.map((photo) => photo.id)).toEqual(["SERVER", "LOCAL"]);
  expect(overlayPendingReportCommunication(first, [], [update, media]).reports).toEqual(first);
  const removeMedia = createSyncMutation({ entityId: "LOCAL", entityType: "report_media", operation: "delete", resourceId: report.id });
  expect(overlayPendingReportCommunication(first, [], [removeMedia]).reports[0].checklistResults[0].photos.map((photo) => photo.id)).toEqual(["SERVER"]);
  const removeReport = createSyncMutation({ entityId: report.id, entityType: "report", operation: "delete", resourceId: report.id });
  expect(overlayPendingReportCommunication([report], [], [media, removeReport]).reports).toEqual([]);
  expect(overlayPendingReportCommunication([{ ...report, deletedAt: "2026-10-05" }], [], [media]).reports[0].checklistResults[0].photos).toEqual(report.checklistResults[0].photos);
});

test("Legacy-Schreibwege und unregistrierte private Medien sind gesperrt", () => {
  const root = process.cwd();
  const sectionRoute = readFileSync(path.join(root, "app/api/sync-sections/route.ts"), "utf8");
  const stateRoute = readFileSync(path.join(root, "app/api/app-state/route.ts"), "utf8");
  const mediaRoute = readFileSync(path.join(root, "app/api/private-media/route.ts"), "utf8");
  const backupRoute = readFileSync(path.join(root, "app/api/report-backups/route.ts"), "utf8");
  const photoRecoveryRoute = readFileSync(path.join(root, "app/api/app-backups/report-photos/route.ts"), "utf8");
  const mediaMigrationRoute = readFileSync(path.join(root, "app/api/app-state/migrate-media/route.ts"), "utf8");
  const appBackupRoute = readFileSync(path.join(root, "app/api/app-backups/route.ts"), "utf8");
  expect(sectionRoute).toContain("SYNC_SECTION_WRITES_RETIRED");
  expect(sectionRoute).toContain('if (keys.includes("reports")) sections.reports = await loadReportsSection');
  expect(sectionRoute).not.toContain("async function saveReportsSection");
  expect(sectionRoute).not.toContain("async function savePortalMessagesSection");
  expect(stateRoute).toContain("APP_STATE_RETIRED");
  expect(mediaRoute).toContain("if (!mediaRecord || mediaRecord.deleted_at)");
  expect(backupRoute).not.toContain('.from("app_state")');
  expect(photoRecoveryRoute).not.toContain(".upsert(");
  expect(photoRecoveryRoute).not.toContain('.from("homecare_reports")');
  expect(mediaMigrationRoute).toContain("LEGACY_MEDIA_MIGRATION_RETIRED");
  expect(appBackupRoute).toContain("homecare_create_relational_backup");
});

test("Migration erzwingt private Medien, Tombstones, Beziehungen und Konflikte", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260928233000_reports_media_communication_relational_cutover.sql"), "utf8");
  expect(migration).toContain("update storage.buckets set public=false");
  expect(migration).toContain("homecare_apply_report_communication_mutation");
  expect(migration).toContain("homecare_prevent_report_communication_hard_delete");
  expect(migration).toContain("homecare_portal_message_replies");
  expect(migration).toContain("Bericht hat aktive Abhängigkeiten");
  expect(migration).toContain("owner_type='pending'");
});
