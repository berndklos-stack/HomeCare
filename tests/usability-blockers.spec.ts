import { expect, test } from "@playwright/test";
import { syncQueueStorageKey } from "../lib/syncQueue";

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
  await page.getByRole("button", { name: "Serverstand übernehmen" }).click();

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
