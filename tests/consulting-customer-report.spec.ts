import { expect, test } from "@playwright/test";

for (const { width, hideTime } of [{ width: 390, hideTime: false }, { width: 1440, hideTime: false }, { width: 390, hideTime: true }]) test(`Leistung als Kundenbericht vorbereiten und senden ${width}px ${hideTime ? "ohne Zeitangaben" : "mit Zeitangaben"}`, async ({ page }, info) => {
  await page.route("**/api/vehicle-positions**", route => route.fulfill({ json: { data: [] } }));
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(({ hideTime }) => {
    if (localStorage.getItem("consulting-report-fixture")) return;
    localStorage.setItem("consulting-report-fixture", "1");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "CUS-R", name: "Kunde Bericht", contact: "Kunde", email: "customer@example.invalid", phone: "", address: "Nybro", language: "Deutsch", objects: ["OBJ-R"], portalLoginHistory: [], portalStatus: "aktiv", notes: "", workTimeVisibility: hideTime ? "hide" : "show" }]));
    localStorage.setItem("kolaretorp-objects", JSON.stringify([{ id: "OBJ-R", name: "Bolet Test", owner: "Kunde Bericht", ownerCustomerId: "CUS-R", ownerEmail: "customer@example.invalid", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, status: "aktiv", type: "Objekt", access: {}, equipment: [], utilities: {}, risks: [], media: { images: 0, documents: 0, floorPlans: 0, items: [] }, nextVisit: "", lastVisit: "" }]));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{ id: "JOB-R", objectId: "OBJ-R", customerId: "CUS-R", title: "Hauskontrolle", status: "in Arbeit", priority: "normal", dueDate: "2026-11-15", assignedTo: "Demo", description: "", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [], consulting: { enabled: true, openEnded: true, hourlyRate: "450", currency: "SEK", entries: [{ id: "CT-OLD", date: "2026-11-15", startTime: "08:00", endTime: "09:00", minutes: 60, description: "Bereits abgerechnet", billingStatus: "abgerechnet", attachments: [{ id: "IMG-OLD", name: "Foto.png", contentType: "image/png", storagePath: "test/Foto.png", size: 68 }] }] } }]));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{ id: "DAY-R", jobId: "JOB-R", objectId: "OBJ-R", title: "Bestehender Tagesbericht", date: "2026-11-15", visibleToCustomer: true, summary: "Unveraendert", internalNotes: "", media: [], checklistResults: [], customerComment: "" }]));
  }, { hideTime });
  let sends = 0;
  let failSend = true;
  await page.route("**/api/media", route => route.fulfill({ json: { id: "MEDIA-DOC", name: "Plan.pdf", contentType: "application/pdf", size: 20, path: "test/Plan.pdf" } }));
  await page.route(/\/api\/(?:private-media|media)\?/, route => route.request().url().includes("Foto.png")
    ? route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64") })
    : route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 plan" }));
  await page.route("**/api/reports/send", async route => {
    sends++;
    const body = route.request().postDataJSON();
    expect(body.to).toBe("customer@example.invalid");
    expect(body.attachmentBase64.length).toBeGreaterThan(100);
    expect(body.attachments).toHaveLength(0);
    await route.fulfill({ status: failSend ? 500 : 200, json: failSend ? { error: "Testversandfehler" } : { sent: true } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistung erfassen", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Leistung erfassen", exact: true });
  await editor.getByLabel("Datum", { exact: true }).fill("2026-11-15");
  await editor.getByLabel("Startzeit", { exact: true }).fill("12:00");
  await editor.getByLabel("Endzeit", { exact: true }).fill("13:15");
  await editor.getByLabel("Tätigkeit", { exact: true }).fill("Hauskontrolle erledigt");
  await editor.locator('input[type="file"]').setInputFiles({ name: "Plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 plan") });
  await expect(editor.getByRole("link", { name: /Plan.pdf/ })).toBeVisible();
  await editor.getByRole("button", { name: "Speichern und Bericht vorbereiten", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Bericht senden", exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".customer-report-card")).toContainText("Hauskontrolle erledigt");
  if (hideTime) {
    await expect(preview.locator(".customer-report-card")).not.toContainText("75 min.");
    await expect(preview.locator(".customer-report-card")).not.toContainText("12:00");
  } else await expect(preview.locator(".customer-report-card")).toContainText("75 min.");
  await expect(preview.locator(".customer-report-card")).not.toContainText("450");
  expect(sends).toBe(0);
  await preview.getByRole("button", { name: "Anhang entfernen: Plan.pdf", exact: true }).click();
  await expect(preview.locator(".report-attachment-editor")).not.toContainText("Plan.pdf");
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]"));
  expect(records).toHaveLength(2);
  expect(records.find((report: { id: string }) => report.id === "DAY-R").summary).toBe("Unveraendert");
  expect(records.find((report: { id: string }) => report.id.startsWith("CONSULTING-REPORT-")).visibleToCustomer).toBe(false);
  await preview.screenshot({ path: info.outputPath("report-preview.png") });
  await preview.getByRole("button", { name: "Jetzt senden", exact: true }).click();
  await expect(preview).toContainText("Testversandfehler");
  expect(sends).toBe(1);
  failSend = false;
  await preview.getByRole("button", { name: "Jetzt senden", exact: true }).click();
  await expect(preview).toHaveCount(0);
  expect(sends).toBe(2);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-jobs").click();
  await page.getByRole("button", { name: "Leistungsnachweise (2)", exact: true }).click();
  await page.getByRole("button", { name: "Bericht vorbereiten 2026-11-15", exact: true }).first().click();
  await expect(preview.getByRole("button", { name: "Bereits gesendet", exact: true })).toBeDisabled();
  await preview.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("button", { name: "Bericht vorbereiten 2026-11-15", exact: true }).last().click();
  await expect(preview).toContainText("Bereits abgerechnet");
  await expect.poll(() => preview.getByRole("img", { name: "Berichtsfoto Foto.png", exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]"));
  expect(after).toHaveLength(3);
  expect(after.filter((report: { sentAt?: string }) => report.sentAt)).toHaveLength(1);
  expect(sends).toBe(2);
});
