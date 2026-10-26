import { expect, test } from "@playwright/test";
import { consultingAttachmentAllowed } from "../lib/consultingAttachments";
import { prepareJobMutations, overlayPendingJobOperations } from "../lib/jobOperationsSync";
import { createSyncMutation } from "../lib/syncQueue";

test("Anhangvalidierung sperrt aktive Inhalte und grosse Dokumente", () => {
  expect(consultingAttachmentAllowed({ name: "plan.pdf", type: "application/pdf", size: 100 })).toBe(true);
  for (const file of [{ name: "plan.svg", type: "image/svg+xml", size: 100 }, { name: "plan.pdf", type: "text/html", size: 100 }, { name: "plan.pdf", type: "application/pdf", size: 5 * 1024 * 1024 }]) expect(consultingAttachmentAllowed(file)).toBe(false);
});

test("Anhaenge folgen der Buchungsmutation und bleiben im Offline-Replay erhalten", () => {
  const job = { id: "J", consulting: { entries: [{ id: "E", attachments: [] }] } };
  const next = { ...job, consulting: { entries: [{ id: "E", attachments: [{ id: "MEDIA-1", name: "Plan.pdf" }] }] } };
  const plan = prepareJobMutations([job], [next]);
  expect(plan.mutations).toHaveLength(1);
  expect(plan.mutations[0]).toMatchObject({ entityType: "job_time_entry", entityId: "E", payload: { attachments: [{ id: "MEDIA-1" }] } });
  const replay = overlayPendingJobOperations([job], {}, {}, {}, plan.mutations.map(item => createSyncMutation(item)));
  expect(replay.jobs[0].consulting?.entries[0].attachments).toEqual(next.consulting.entries[0].attachments);
});

for (const width of [390, 820, 1440]) test(`Bilder und Dokumente zur Leistungsbuchung hinzufuegen, oeffnen und entfernen bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => {
    if (localStorage.getItem("consulting-attachments-fixture")) return;
    localStorage.setItem("consulting-attachments-fixture", "1");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{ id: "ATT-J", title: "Dauerauftrag Test", status: "in Arbeit", priority: "normal", dueDate: "2026-10-26", description: "", assignedTo: "Demo", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [], consulting: { enabled: true, openEnded: true, hourlyRate: "800", currency: "SEK", entries: [] } }]));
  });
  let failUpload = false;
  await page.route("**/api/media", async route => {
    if (failUpload) return route.fulfill({ status: 500, json: { error: "Test Uploadfehler" } });
    const image = route.request().postDataBuffer()?.includes(Buffer.from("Foto.jpg"));
    return route.fulfill({ json: { id: image ? "MEDIA-IMAGE" : "MEDIA-DOC", name: image ? "Foto.jpg" : "Plan.pdf", contentType: image ? "image/png" : "application/pdf", size: 100, path: image ? "test/Foto.png" : "test/Plan.pdf" } });
  });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
  await page.route("**/api/private-media?**", route => route.request().url().includes("Foto.png") ? route.fulfill({ contentType: "image/png", body: png }) : route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 test" }));
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistung erfassen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Leistung erfassen", exact: true });
  await dialog.getByLabel("Startzeit", { exact: true }).fill("10:00"); await dialog.getByLabel("Endzeit", { exact: true }).fill("11:00"); await dialog.getByLabel("Tätigkeit", { exact: true }).fill("Wartung mit Dokumenten");
  const upload = dialog.locator('input[type="file"]');
  await upload.setInputFiles({ name: "Plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 plan") });
  await expect(dialog.getByRole("link", { name: /Plan.pdf/ })).toBeVisible();
  await upload.setInputFiles({ name: "Foto.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByRole("img", { name: "Foto.jpg", exact: true })).toBeVisible();
  await expect.poll(() => dialog.getByRole("img", { name: "Foto.jpg", exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(dialog.getByRole("button", { name: "Leistung speichern", exact: true })).toBeEnabled();
  failUpload = true;
  await upload.setInputFiles({ name: "Fehler.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fail") });
  await expect(dialog.getByRole("alert")).toContainText("konnte nicht hochgeladen");
  await expect(dialog.getByRole("link", { name: /Plan.pdf/ })).toBeVisible();
  await dialog.screenshot({ path: info.outputPath(`attachments-${width}.png`) });
  await dialog.getByRole("button", { name: "Leistung speichern", exact: true }).click();
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistungsnachweise (1)", exact: true }).click();
  const link = page.locator(".consulting-entry-history").getByRole("link", { name: /Plan.pdf/ });
  await expect(link).toHaveAttribute("href", /^blob:/);
  await expect(link).toHaveAttribute("download", "Plan.pdf");
  await expect(page.locator(".consulting-entry-history").getByRole("img", { name: "Foto.jpg", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Leistung bearbeiten/ }).click();
  await page.getByRole("button", { name: "Anhang entfernen Plan.pdf", exact: true }).click();
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await expect(link).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
