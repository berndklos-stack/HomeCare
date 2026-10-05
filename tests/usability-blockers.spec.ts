import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { syncQueueStorageKey } from "../lib/syncQueue";

test("Sync-Rückstände sind begrenzt und Berichtsansicht startet keine Altfoto-Migration", () => {
  const syncHook = readFileSync(path.join(process.cwd(), "lib/useSyncQueue.ts"), "utf8");
  const appPage = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  expect(syncHook).toContain("processed < automaticFlushBatchSize");
  expect(syncHook).toContain("automaticFlushDelayMs");
  expect(appPage).not.toContain("pendingReportPhotoUploadsRef");
  expect(appPage).not.toContain("pendingReportPhotoMigrationTimerRef");
  expect(syncHook).not.toContain("setQueue(workingQueue)");
  expect(appPage).not.toContain("pendingPhotos.slice(0, 4)");
});

test("Konflikt kann zugunsten des Serverstands dauerhaft verworfen werden", async ({ page }) => {
  await page.route("**/api/sync-mutations", async (route) => {
    const mutation = route.request().postDataJSON() as { id?: string } | null;
    await route.fulfill({
      body: JSON.stringify({ mutationId: mutation?.id ?? "", status: "synced" }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.addInitScript(({ storageKey }) => {
    if (window.sessionStorage.getItem("workcore-conflict-seeded") === "1") return;
    window.sessionStorage.setItem("workcore-conflict-seeded", "1");
    window.localStorage.setItem(storageKey, JSON.stringify([{
      attempts: 1,
      createdAt: "2026-09-29T18:00:00.000Z",
      entityId: "FIELD-CONFLICT",
      entityType: "field_progress",
      error: "Der Fortschritt wurde auf einem anderen Gerät geändert.",
      expectedRevision: 1,
      id: "MUTATION-CONFLICT",
      operation: "update",
      payload: { completed: true },
      resourceId: "JOB-CONFLICT",
      serverRecord: { id: "FIELD-CONFLICT", revision: 2 },
      status: "conflict",
      updatedAt: "2026-09-29T18:01:00.000Z",
    }]));
  }, { storageKey: syncQueueStorageKey });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Synchronisierungskonflikt" })).toBeVisible();
  await page.getByRole("button", { name: "Synchronisierungskonflikt" }).click();
  await page.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true }).getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();

  await expect(page.getByRole("button", { name: "Synchronisierungskonflikt" })).toHaveCount(0);
  await expect.poll(() => page.evaluate((storageKey) => {
    const queue = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as Array<{ id?: string }>;
    return queue.some((mutation) => mutation.id === "MUTATION-CONFLICT");
  }, syncQueueStorageKey)).toBe(false);

  await page.reload();
  await expect.poll(() => page.evaluate((storageKey) => {
    const queue = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as Array<{ id?: string }>;
    return queue.some((mutation) => mutation.id === "MUTATION-CONFLICT");
  }, syncQueueStorageKey)).toBe(false);
  const remainingConflict = page.getByRole("button", { name: "Synchronisierungskonflikt" });
  if (await remainingConflict.isVisible()) await remainingConflict.click();
  await expect(page.getByText("Der Fortschritt wurde auf einem anderen Gerät geändert.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
});
