import { expect, test } from "@playwright/test";
import { formatSyncDataTime } from "../components/SyncStatus";
import { createSyncMutation, discardConflictingMutations, retrySyncMutation } from "../lib/syncQueue";
import { prepareSettingMutation } from "../lib/settingsSync";
import { reviewMediaConflict } from "../lib/conflictReview";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

for (const width of [1440, 320]) test(`Dialogkopf-Tooltip bleibt vollständig sichtbar: ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-analytics").click();
  await page.getByRole("button", { name: "Alle Zeiten", exact: true }).click();
  await page.locator(".analytics-view .clickable-report-row").first().click();
  const dialog = page.getByRole("dialog");
  const pdf = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
  for (const state of ["hover", "focus"]) {
    if (state === "hover") await pdf.hover();
    else {
      await page.mouse.move(0, 0);
      await pdf.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(pdf).toBeFocused();
    }
    await expect.poll(() => pdf.evaluate((button) => getComputedStyle(button, "::after").opacity)).toBe("1");
    const bounds = await pdf.evaluate((button) => {
      const group = button.closest(".modal-header-actions")!;
      const modal = button.closest(".modal")!;
      const g = group.getBoundingClientRect();
      const m = modal.getBoundingClientRect();
      const style = getComputedStyle(button, "::after");
      const top = g.top + parseFloat(style.top);
      const right = g.right - parseFloat(style.right);
      return { left: right - parseFloat(style.width), right, top, bottom: top + parseFloat(style.height),
        modalLeft: m.left, modalRight: m.right, modalTop: m.top, modalBottom: m.bottom,
        groupBottom: g.bottom, anchor: getComputedStyle(button).position };
    });
    expect(bounds.anchor).toBe("static");
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.groupBottom);
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.modalLeft);
    expect(bounds.right).toBeLessThanOrEqual(bounds.modalRight);
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.modalTop);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.modalBottom);
  }
  await page.screenshot({ path: `test-results/dialog-tooltip-${width}-${test.info().project.name}.png` });
});

test("Blaue Kennzahlen spiegeln sich weder bei Hover noch bei Tastaturfokus", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const buttons = page.locator(".quickbar button");
  await expect(buttons).toHaveCount(4);
  for (const button of await buttons.all()) {
    for (const state of ["hover", "focus"]) {
      if (state === "hover") await button.hover();
      else {
        await page.mouse.move(0, 0);
        await button.focus();
      }
      const transform = await button.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return { x: matrix.a, y: matrix.d };
      });
      expect(transform).toEqual({ x: 1, y: 1 });
    }
  }
  await page.screenshot({ path: `test-results/quickbar-hover-${test.info().project.name}.png` });
});

test("Auswertung trennt gleiche Kundennamen und zählt laufende Leistungen im gewählten Zeitraum", async ({ page }) => {
  await page.addInitScript(() => {
    const customers = [
      { id: "A-PRIVATE", personalNumber: "001", name: "Christoph Korn", company: "" },
      { id: "A-CDK", personalNumber: "002", name: "Christoph Korn", company: "CDK Family Office GbR" },
      { id: "A-BO", personalNumber: "003", name: "Börjes", company: "Börjes Logistik" },
    ].map((customer) => ({ ...customer, language: "Deutsch", email: "", phone: "", contact: "", address: "", objects: [], contacts: [], portalLoginHistory: [] }));
    localStorage.setItem("kolaretorp-customers", JSON.stringify(customers));
    localStorage.setItem("kolaretorp-objects", JSON.stringify(customers.map((customer) => ({
      id: `OBJ-${customer.id}`, name: customer.company || "Privathaus", owner: customer.name,
      ownerCustomerId: customer.id, archived: false, media: { images: 0, documents: 0, floorPlans: 0, items: [] },
      status: "Saison aktiv", region: "", address: "", equipment: [], risks: [], access: {}, utilities: {},
    }))));
    const time = (id: string, date: string, minutes: number) => ({ id, date, minutes, startTime: "09:00", endTime: "10:00", description: "Erfasste Leistung", billingStatus: "offen" });
    const jobs = [
      { id: "J-PRIVATE", customerId: "A-PRIVATE", title: "Gunnabo", objectId: "OBJ-A-PRIVATE" },
      // The contractual customer takes precedence over the property's owner.
      { id: "J-CDK", customerId: "A-CDK", title: "Laufende Verwaltung", objectId: "OBJ-A-PRIVATE", consulting: { enabled: true, entries: [time("E-CDK", "2026-10-05", 30)] } },
      { id: "J-BO", customerId: "A-BO", title: "Partnersuche", objectId: "OBJ-A-BO", consulting: { enabled: true, entries: [time("E-BO", "2026-10-05", 200), time("E-SEPT", "2026-09-14", 600)] } },
    ].map((job) => ({ ...job, status: "in Arbeit", priority: "normal", assignedTo: "Bernd Klos", dueDate: "2026-10-05", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [] }));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify(jobs));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{
      id: "R-PRIVATE", jobId: "J-PRIVATE", objectId: "OBJ-A-PRIVATE", title: "Privater Bericht", date: "2026-10-05", media: [], summary: "", internalNotes: "", customerComment: "",
      checklistResults: [{ id: "TASK", title: "Arbeit", minutes: 60, note: "", completed: true, photos: [] }],
    }]));
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-analytics").click();
  await page.getByLabel("Monat", { exact: true }).fill("2026-10");
  const rows = page.locator(".analytics-view > section").filter({ has: page.getByRole("heading", { name: "Zeit je Kunde", exact: true }) }).locator("article");
  await expect(rows).toHaveCount(3);
  const privateRow = rows.filter({ hasText: "Kundennummer: 001" });
  await expect(privateRow).toContainText("1 Std.");
  await expect(privateRow).not.toContainText("Laufende Verwaltung");
  const companyRow = rows.filter({ hasText: "Kundennummer: 002" });
  await expect(companyRow).toContainText("CDK Family Office GbR");
  await expect(companyRow).toContainText("0,5 Std.");
  await expect(companyRow).toContainText("Laufender Auftrag: Laufende Verwaltung");
  const borjes = rows.filter({ hasText: "Kundennummer: 003" });
  await expect(borjes).toContainText("3,3 Std.");
  await expect(page.locator(".analytics-summary-grid").getByText("4,8 Std.", { exact: true })).toBeVisible();
  await borjes.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".analytics-report-list article")).toHaveCount(1);
  await expect(dialog).toContainText("Erfasste Leistung");
  await expect(dialog).not.toContainText("Noch keine Zeiten vorhanden.");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Alle Zeiten", exact: true }).click();
  await expect(borjes).toContainText("13,3 Std.");
});

for (const width of [1440, 390]) test(`Stammdaten-Reiter bleiben im Dunkelmodus lesbar: ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Dunkelmodus", exact: true }).click();
  await page.getByTestId("nav-masterData").click();
  const tabs = page.locator(".master-data-tabs");
  await expect(tabs).toBeVisible();
  const colors = await tabs.locator("button:not(.active)").evaluateAll((buttons) => buttons.map((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundColor, color: style.color };
  }));
  expect(colors.length).toBeGreaterThan(0);
  for (const colorset of colors) {
    expect(colorset).toEqual({ background: "rgb(50, 53, 58)", color: "rgb(241, 243, 244)" });
  }
  await tabs.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "Ressourcen", exact: true })).toHaveClass("active");
  await expect(tabs.getByRole("button", { name: "Firma", exact: true })).toHaveCSS("background-color", "rgb(50, 53, 58)");
  await page.screenshot({ path: `test-results/master-tabs-dark-${width}-${test.info().project.name}.png` });
});

test("Datenstand zeigt Datum und Uhrzeit statt vermeintlicher Synchronisierungszeit", () => {
  for (const [language, expected] of [["de", "04.10.2026, 19:28"], ["sv", "2026-10-04 19:28"], ["en", "04/10/2026, 19:28"]] as const) {
    expect(formatSyncDataTime("2026-10-04T19:28:00", language)).toBe(expected);
  }
  expect(formatSyncDataTime("invalid", "de")).toBe("");
  expect(formatSyncDataTime(undefined, "de")).toBe("");
});

for (const width of [1440, 390]) test(`Kopfzeile bleibt bei ${width}px sichtbar`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-jobs").click();
  // Exercise a long workspace independently of the current demo record count.
  await page.locator(".workspace").evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.minHeight = "2000px";
    element.appendChild(spacer);
  });
  await page.locator(".workspace").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await page.locator(".workspace").evaluate((element) => element.scrollTop)).toBeGreaterThan(1000);
  const header = await page.locator(".topbar").boundingBox();
  expect(header!.y).toBeGreaterThanOrEqual(0);
  expect(header!.y + header!.height).toBeLessThan(900);
  for (const name of ["Suchen", "Sprache", "Fahrt", "Aktualisieren", "Abmelden"]) {
    const control = name === "Suchen" ? page.getByRole("textbox", { name, exact: true }) : name === "Sprache" ? page.getByRole("combobox", { name, exact: true }) : page.getByRole("button", { name, exact: true });
    await expect(control).toBeInViewport();
  }
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({ path: `test-results/sticky-${width}-${test.info().project.name}.png` });
});

test("Einzelne und ausgewählte Konflikte bleiben nach Reload aufgelöst", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("ux-conflicts")) return;
    sessionStorage.setItem("ux-conflicts", "1");
    localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify([1, 2, 3, 4].map((n) => ({
      id: `C-${n}`, entityId: `ROW-${n}`, entityType: "report", resourceId: `ROW-${n}`, operation: "update",
      expectedRevision: 1, payload: { summary: `Entwurf ${n}`, date: "2026-10-01", title: `Bericht ${n}`, jobId: "JOB-2407", objectId: "OBJ-1001", checklistResults: [], media: [], customerComment: "", visibleToCustomer: true }, status: "conflict", attempts: 1,
      createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", serverRecord: { revision: 2 }, error: "Revision veraltet",
    }))));
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true }).click();
  const conflictDialog = page.getByRole("dialog", { name: "Änderungskonflikt", exact: true });
  await expect(conflictDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(conflictDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true }).click();
  const entry = page.getByRole("region", { name: "Konflikt ROW-1", exact: true });
  await entry.getByText("Änderung prüfen").click();
  await expect(entry.getByText("Entwurf 1", { exact: true })).toBeVisible();
  await entry.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true }).getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await expect(entry).toHaveCount(0);
  await page.getByRole("region", { name: "Konflikt ROW-4", exact: true }).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByRole("region", { name: "Konflikt ROW-4", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Alle auswählen", exact: true }).check();
  await expect(conflictDialog.getByText("2 von 2 ausgewählt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ausgewählte: Serverstand übernehmen", exact: true }).click();
  await page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true }).getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").find((item: { id: string }) => item.id === "C-4"))).toMatchObject({ status: "pending", expectedRevision: 1, payload: { summary: "Entwurf 4" } });
});

test("Konflikt-Retry verändert weder Nutzdaten noch erwartete Revision", () => {
  const mutation = { ...createSyncMutation({ entityId: "R", entityType: "report", operation: "update", expectedRevision: 2, resourceId: "R", payload: { summary: "lokal" } }), status: "conflict" as const };
  expect(retrySyncMutation([mutation], mutation.id)[0]).toMatchObject({ id: mutation.id, expectedRevision: 2, payload: mutation.payload, status: "pending" });
  expect(discardConflictingMutations([mutation], [])).toEqual([mutation]);
  const failed = { ...mutation, id: "FAILED", status: "failed" as const };
  const pending = { ...mutation, id: "PENDING", status: "pending" as const };
  expect(discardConflictingMutations([failed, pending])).toEqual([failed, pending]);
  expect(discardConflictingMutations([failed, pending], [failed.id, pending.id])).toEqual([pending]);
});

test("Fehlgeschlagene Änderung ist prüfbar und nur nach Bestätigung dauerhaft verwerfbar", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("ux-failure")) return;
    sessionStorage.setItem("ux-failure", "1");
    localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify([{
      id: "FAIL-1", entityId: "FAILED-REPORT", entityType: "report", resourceId: "FAILED-REPORT", operation: "update",
      expectedRevision: 1, payload: { summary: "Nicht gespeicherter Entwurf", date: "2026-10-01", title: "Fehlgeschlagener Bericht", jobId: "JOB-2407", objectId: "OBJ-1001", checklistResults: [], media: [], customerComment: "", visibleToCustomer: true }, status: "failed", attempts: 1,
      createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", error: "Die Änderung konnte nicht synchronisiert werden.",
    }]));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Synchronisierung fehlgeschlagen", exact: true }).click();
  const entry = page.getByRole("region", { name: "Konflikt FAILED-REPORT", exact: true });
  await expect(entry).toBeVisible();
  await expect(page.getByRole("button", { name: "Konflikte mit Server vergleichen" })).toHaveCount(0);
  await entry.getByText("Änderung prüfen").click();
  await expect(entry.getByText("Nicht gespeicherter Entwurf", { exact: true })).toBeVisible();
  await entry.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true });
  await expect(confirmation.getByText(/Diese Änderungen werden nicht gespeichert/)).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Abbrechen", exact: true })).toBeFocused();
  await confirmation.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(entry).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").some((item: { id: string }) => item.id === "FAIL-1"))).toBe(true);
  await entry.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(entry).toBeVisible();
  await entry.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await page.screenshot({ path: `test-results/sync-confirm-${test.info().project.name}.png` });
  await confirmation.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await expect(entry).toHaveCount(0);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: "Synchronisierung fehlgeschlagen", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").some((item: { id: string }) => item.id === "FAIL-1"))).toBe(false);
});

test("Konfliktprüfung verwirft weder unbekannte noch abweichende oder fremde Medien", () => {
  const mutation = { ...createSyncMutation({ entityId: "M", entityType: "report_media", resourceId: "R", operation: "update", expectedRevision: 1, payload: { name: "Bild", storagePath: "T/R/M", details: { a: 1, b: 2 } } }), status: "conflict" as const };
  const row = { id: "M", tenant_id: "T", owner_type: "report", owner_id: "R", revision: 3, deleted_at: null, name: "Bild", storage_path: "T/R/M", metadata: { ...mutation.payload, details: { b: 2, a: 1 } } };
  expect(reviewMediaConflict(mutation, row, "T").redundant).toBe(true);
  for (const changed of [null, { ...row, tenant_id: "OTHER" }, { ...row, owner_id: "OTHER" }, { ...row, name: "Neu" }, { ...row, storage_path: "neu" }, { ...row, metadata: {} }, { ...row, deleted_at: "2026-10-01" }]) {
    expect(reviewMediaConflict(mutation, changed, "T").redundant).toBe(false);
  }
  expect(reviewMediaConflict({ ...mutation, operation: "delete" }, { ...row, deleted_at: "2026-10-01" }, "T").redundant).toBe(true);
  expect(reviewMediaConflict({ ...mutation, operation: "create" }, row, "T").redundant).toBe(false);
  expect(reviewMediaConflict({ ...mutation, entityType: "job" }, row, "T").redundant).toBe(false);
  expect(reviewMediaConflict({ ...mutation, payload: {} }, row, "T").redundant).toBe(false);
});

test("Großer Konfliktbestand bleibt begrenzt und sichere Bereinigung überlebt erneuten App-Start", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (localStorage.getItem("ux-backlog")) return;
    localStorage.setItem("ux-backlog", "1");
    localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify(Array.from({ length: 1112 }, (_, i) => ({
      id: `BACKLOG-${i}`, entityType: "report_media", entityId: `MEDIA-${i}`, resourceId: "R", operation: "update", expectedRevision: 1,
      status: "conflict", attempts: 1, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
      payload: { name: `Foto ${i}`, storagePath: `tenant/R/${i}` },
    }))));
  });
  let calls = 0;
  await context.route("**/api/sync-conflicts/review", async (route) => {
    calls++;
    const batch = route.request().postDataJSON() as { id: string }[];
    expect(batch.length).toBeLessThanOrEqual(25);
    await route.fulfill({ json: { reviews: batch.map((m) => ({ id: m.id, redundant: m.id === "BACKLOG-0", reason: m.id === "BACKLOG-0" ? "Bereits vorhanden" : "Manuell prüfen" })) } });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true }).click();
  const conflictDialog = page.getByRole("dialog", { name: "Änderungskonflikt", exact: true });
  await expect(conflictDialog).toBeVisible();
  const bounds = await conflictDialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.getByRole("checkbox", { name: "Alle auswählen", exact: true }).check();
  await expect(conflictDialog.getByText("1112 von 1112 ausgewählt", { exact: true })).toBeVisible();
  await expect(page.locator(".sync-conflict-entry")).toHaveCount(25);
  await expect(page.locator(".sync-conflict-entry dl")).toHaveCount(0);
  await page.screenshot({ path: `test-results/conflicts-mobile-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Nächste Konfliktseite" }).click();
  await expect(page.getByRole("region", { name: "Konflikt MEDIA-25", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Konflikt MEDIA-25 auswählen", exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "Alle auswählen", exact: true }).uncheck();
  await expect(conflictDialog.getByText("0 von 1112 ausgewählt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Konflikte mit Server vergleichen" }).click();
  await expect(page.getByText(/1 nachweislich erledigt/)).toBeVisible();
  expect(calls).toBe(45);
  await page.getByRole("button", { name: "Erledigte: Serverstand übernehmen" }).click();
  await page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true }).getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").filter((m: { id: string }) => m.id.startsWith("BACKLOG-")).length)).toBe(1111);
  expect(calls).toBe(46);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]") as { id: string; status: string }[]);
  expect(persisted.some((m) => m.id === "BACKLOG-0")).toBe(false);
  expect(persisted.filter((m) => m.id.startsWith("BACKLOG-")).every((m) => m.status === "conflict")).toBe(true);
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.locator("main.app")).toHaveAttribute("data-ready", "true");
  expect(await reopened.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").filter((m: { id: string }) => m.id.startsWith("BACKLOG-")).length)).toBe(1111);
  await reopened.close();
});

test("Serverprüfung verlangt Authentifizierung", async ({ request }) => {
  const response = await request.post("/api/sync-conflicts/review", { headers: { "X-WorkCore-E2E-Bypass": "0" }, data: [] });
  expect(response.status()).toBe(401);
});

test("Erneuter Serververgleich schützt inzwischen geänderte Daten und abhängige Mutationen", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify([0, 1, 2].map((i) => ({
      id: `RECHECK-${i}`, entityType: "report_media", entityId: i === 0 ? "ONE" : "SHARED", resourceId: "R", operation: "update", expectedRevision: 1,
      status: "conflict", attempts: 1, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", payload: { name: `Foto ${i}` },
    }))));
  });
  let calls = 0;
  await page.route("**/api/sync-conflicts/review", async (route) => {
    calls++;
    await route.fulfill({ json: { reviews: (route.request().postDataJSON() as { id: string }[]).map((m) => ({ id: m.id, redundant: calls === 1, reason: "Vergleich" })) } });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true }).click();
  await page.getByRole("button", { name: "Konflikte mit Server vergleichen" }).click();
  await expect(page.getByText(/1 nachweislich erledigt/)).toBeVisible();
  await page.getByRole("button", { name: "Erledigte: Serverstand übernehmen" }).click();
  await page.getByRole("dialog", { name: "Serverstand übernehmen?", exact: true }).getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await expect(page.getByText(/0 nachweislich erledigt/)).toBeVisible();
  await expect(page.locator(".sync-conflict-entry")).toHaveCount(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").filter((m: { id: string }) => m.id.startsWith("RECHECK-")).length)).toBe(3);
  await page.unroute("**/api/sync-conflicts/review");
  await page.route("**/api/sync-conflicts/review", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.getByRole("button", { name: "Konflikte mit Server vergleichen" }).click();
  await expect(page.locator(".sync-status-details").getByRole("alert")).toContainText("Lokale Änderungen bleiben erhalten");
  await expect(page.locator(".sync-conflict-entry")).toHaveCount(3);
});

for (const policy of ["never", "ask", "always"] as const) test(`Kamera und Bibliothek mit Gerätespeichern ${policy}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((value) => {
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Testfirma", jobPhotoDeviceSave: value }));
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "UX-FIXTURE": {} }));
  }, policy);
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-field").click();
  await page.getByRole("button", { name: /Gartenpflege und Sichtprüfung/ }).first().click();
  const camera = page.locator('input[type="file"][aria-label^="Foto zu"]').first();
  const library = page.locator('input[type="file"][aria-label^="Bilder zu"]').first();
  await expect(camera).toHaveAttribute("capture", "environment");
  await expect(library).not.toHaveAttribute("capture");
  await expect(library).toHaveAttribute("multiple", "");
  const files = ["eins.png", "zwei.png"].map((name) => ({ name, mimeType: "image/png", buffer: pixel }));
  await library.setInputFiles(files);
  await expect(page.getByRole("region", { name: "Aufnahmen auf dem Gerät speichern" })).toHaveCount(0);
  await camera.setInputFiles(files);
  const save = page.getByRole("region", { name: "Aufnahmen auf dem Gerät speichern" });
  if (policy === "never") await expect(save).toHaveCount(0);
  else {
    await expect(save).toBeVisible();
    await expect(save.getByRole("button", { name: /herunterladen/ })).toHaveCount(2);
    const download = page.waitForEvent("download");
    await save.getByRole("button", { name: "eins.png herunterladen", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("eins.png");
  }
});

test("Fotoeinstellung nutzt revisionierte Firmenkonfiguration", () => {
  for (const value of ["never", "ask", "always"]) {
    const result = prepareSettingMutation("setting", "companySettings", { revision: 4 }, { revision: 4, jobPhotoDeviceSave: value });
    expect(result.mutation).toMatchObject({ entityId: "companySettings", expectedRevision: 4, payload: { value: { jobPhotoDeviceSave: value } } });
  }
});

test("Fotoeinstellung bleibt nach Speichern und Reload erhalten", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "UX-FIXTURE": {} })));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  for (const value of ["ask", "always", "never"]) {
    await page.getByTestId("nav-masterData").click();
    await page.getByRole("button", { name: "Firma", exact: true }).click();
    await page.getByLabel("Auftragsfotos auf dem Gerät speichern", { exact: true }).selectOption(value);
    await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-company-settings") || "{}").jobPhotoDeviceSave)).toBe(value);
    await page.reload();
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-masterData").click();
    await page.getByRole("button", { name: "Firma", exact: true }).click();
    await expect(page.getByLabel("Auftragsfotos auf dem Gerät speichern", { exact: true })).toHaveValue(value);
  }
});
