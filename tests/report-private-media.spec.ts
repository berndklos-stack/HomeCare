import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("PDF-Medienabruf authentifiziert nur interne private Endpunkte", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const helper = source.slice(source.indexOf("async function mediaSourceToDataUrl("), source.indexOf("async function withTimeout"));
  expect(helper).toContain('await apiFetch(normalizedSource, { cache: "no-store" })');
  expect(helper).toContain(": await fetch(normalizedSource)");
});

test("Privates Berichtsfoto wird dauerhaft in die PDF-Datei eingebettet", async ({ page }) => {
  await page.route(/\/api\/(private-media|media)\?/, async (route) => {
    expect(route.request().resourceType()).toBe("fetch");
    await route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") });
  });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{
      id: "PDF-PRIVATE", jobId: "JOB-2407", objectId: "OBJ-1001", title: "PDF Fotopruefung",
      date: "2026-10-06", summary: "Ein privates Foto", media: ["1 Foto"], customerComment: "",
      checklistResults: [{ id: "TASK", title: "Kontrolle", completed: true, minutes: 15, note: "",
        meta: "", photos: [{ id: "PDF-PHOTO", name: "private.png", accepted: true, storagePath: "tenant/photos/private.png" }] }],
    }]));
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: /^1 Berichte$/ }).click();
  await page.getByRole("button", { name: /PDF Fotopruefung/ }).first().click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF für PDF Fotopruefung herunterladen", exact: true }).click();
  const download = await downloadPromise;
  const bytes = readFileSync((await download.path())!);
  expect(bytes.toString("latin1")).toMatch(/\/Subtype \/Image\s+\/Width 1\s+\/Height 1/);
});

test("Projektfotos zeigen private Uploads sofort und in der vergrößerten Vorschau", async ({ page }) => {
  await page.setViewportSize({ width: test.info().project.name === "webkit" ? 390 : 1440, height: 900 });
  const requests: string[] = [];
  await page.route("**/api/media", async (route) => route.fulfill({ json: {
    id: "PENDING-PHOTO", name: "project.png", path: "tenant/object-photos/project.png",
    url: "/api/private-media?path=tenant%2Fobject-photos%2Fproject.png", contentType: "image/png", size: 100,
  } }));
  await page.route(/\/api\/(private-media|media)\?/, async (route) => {
    expect(route.request().resourceType()).toBe("fetch");
    expect(route.request().headers()["x-workcore-e2e-bypass"]).toBe("1");
    requests.push(route.request().url());
    await route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-objects").click();
  await page.getByRole("button", { name: "Neues Projekt / Objekt", exact: true }).click();
  await page.getByLabel("Typ").selectOption("Projekt");
  await page.getByLabel("Neues Foto hinzufügen", { exact: true }).setInputFiles({
    name: "project.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64"),
  });
  const photo = page.locator(".object-photo-tile img");
  await expect(photo).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Foto project.png Vorschau öffnen", exact: true }).click();
  const preview = page.locator(".document-preview-modal img");
  await expect(preview).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const count = requests.length;
  await page.waitForTimeout(1000);
  expect(requests).toHaveLength(count);
  await page.screenshot({ path: `test-results/project-private-photo-${test.info().project.name}.png` });
});

test("Private Berichtsfotos werden authentifiziert geladen, Fehler bleiben begrenzt", async ({ page }) => {
  const requests: string[] = [];
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/media(?:\?|$)/.test(request.url())) uploads.push(request.url());
  });
  await page.route(/\/api\/(private-media|media)\?/, async (route) => {
    const request = route.request();
    requests.push(request.url());
    expect(request.headers()["x-workcore-e2e-bypass"]).toBe("1");
    expect(request.resourceType()).toBe("fetch");
    if (request.url().includes("missing.jpg")) {
      await route.fulfill({ status: 404, body: "Not found" });
    } else {
      await route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") });
    }
  });
  await page.addInitScript((image) => {
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{
      id: "REP-PRIVATE-TEST", jobId: "JOB-2407", objectId: "OBJ-1001",
      title: "Private Fotopruefung", date: "2026-09-29", visibleToCustomer: true,
      summary: "Drei Testreferenzen", media: ["3 Fotos"], customerComment: "",
      checklistResults: [{ id: "TASK-PRIVATE", title: "Kontrolle", meta: "", description: "",
        completed: true, minutes: 15, note: "", photos: [
          { id: "PRIVATE-1", name: "private.png", accepted: true, storagePath: "test/photos/private.png" },
          { id: "PRIVATE-2", name: "missing.jpg", accepted: true, storagePath: "test/photos/missing.jpg" },
          { id: "INLINE-3", name: "inline.png", accepted: true, previewUrl: `data:image/png;base64,${image}` },
        ] }],
    }]));
  }, pixel);
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: /^1 Berichte$/ }).click();
  await page.getByRole("button", { name: /Private Fotopruefung/ }).click();
  const photo = page.locator('img[alt*="private.png"]').first();
  await expect(photo).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('img[alt*="inline.png"]').first()).toHaveAttribute("src", /^data:image/);
  await expect(page.getByText("Bild nicht lesbar", { exact: true }).first()).toBeVisible();
  const settled = requests.length;
  await page.waitForTimeout(3000);
  expect(requests.length).toBe(settled);
  const reportMutations = () => page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]")
    .filter((item: { entityType: string }) => ["report", "report_media"].includes(item.entityType)));
  expect(await reportMutations()).toEqual([]);
  await page.getByRole("textbox", { name: "Berichtstext", exact: true }).focus();
  await page.getByRole("button", { name: "Bericht Private Fotopruefung Schließen", exact: true }).click();
  expect(await reportMutations()).toEqual([]);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(3000);
  expect(uploads).toEqual([]);
  expect(await reportMutations()).toEqual([]);
});
