import { expect, test } from "@playwright/test";
import { createSyncMutation, discardConflictingMutations, retrySyncMutation } from "../lib/syncQueue";
import { prepareSettingMutation } from "../lib/settingsSync";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

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
  const entry = page.getByRole("region", { name: "Konflikt ROW-1", exact: true });
  await entry.getByText("Änderung prüfen").click();
  await expect(entry.getByText("Entwurf 1", { exact: true })).toBeVisible();
  await entry.getByRole("button", { name: "Serverstand übernehmen", exact: true }).click();
  await expect(entry).toHaveCount(0);
  await page.getByRole("region", { name: "Konflikt ROW-4", exact: true }).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByRole("region", { name: "Konflikt ROW-4", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Konflikt ROW-2 auswählen", exact: true }).check();
  await page.getByRole("checkbox", { name: "Konflikt ROW-3 auswählen", exact: true }).check();
  await page.getByRole("button", { name: "Ausgewählte: Serverstand übernehmen", exact: true }).click();
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: "Synchronisierungskonflikt", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]").find((item: { id: string }) => item.id === "C-4"))).toMatchObject({ status: "pending", expectedRevision: 1, payload: { summary: "Entwurf 4" } });
});

test("Konflikt-Retry verändert weder Nutzdaten noch erwartete Revision", () => {
  const mutation = { ...createSyncMutation({ entityId: "R", entityType: "report", operation: "update", expectedRevision: 2, resourceId: "R", payload: { summary: "lokal" } }), status: "conflict" as const };
  expect(retrySyncMutation([mutation], mutation.id)[0]).toMatchObject({ id: mutation.id, expectedRevision: 2, payload: mutation.payload, status: "pending" });
  expect(discardConflictingMutations([mutation], [])).toEqual([mutation]);
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
