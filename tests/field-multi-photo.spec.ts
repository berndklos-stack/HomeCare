import { expect, test, type Page } from "@playwright/test";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const photos = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `auswahl-${i + 1}.png`, mimeType: "image/png", buffer: pixel }));

test("Mehrfachauswahl rendert keine unskalierten Originale parallel zur Bildverarbeitung", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const original = window.createImageBitmap.bind(window);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    Object.assign(window, { releasePhotoDecode: release });
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await gate;
      return original(...args);
    }) as typeof createImageBitmap;
  });
  await openJob(page);
  await page.locator('input[aria-label^="Bilder zu"]').first().setInputFiles(photos(5));
  await expect(page.locator(".captured-photo-card")).toHaveCount(5);
  await expect(page.locator('.captured-photo-card img[src^="blob:"]')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releasePhotoDecode: () => void }).releasePhotoDecode());
  await expect(page.locator(".captured-photo-card img")).toHaveCount(5);
});

test("Vier hochauflösende Fotos werden auch bei überlappender Auswahl einzeln verkleinert", async ({ page }) => {
  const { default: sharp } = await import("sharp");
  const buffer = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: "#729eb4" } }).jpeg().toBuffer();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const original = window.createImageBitmap.bind(window);
    const counters = { active: 0, maximum: 0, closed: 0 };
    Object.assign(window, { photoDecodeCounters: counters });
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      counters.active++;
      counters.maximum = Math.max(counters.maximum, counters.active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const bitmap = await original(...args);
      const close = bitmap.close.bind(bitmap);
      bitmap.close = () => { counters.active--; counters.closed++; close(); };
      return bitmap;
    }) as typeof createImageBitmap;
  });
  await openJob(page);
  const input = page.locator('input[aria-label^="Bilder zu"]').first();
  const files = Array.from({ length: 4 }, (_, index) => ({ name: `large-${index}.jpg`, mimeType: "image/jpeg", buffer }));
  await input.setInputFiles(files.slice(0, 2));
  await input.setInputFiles(files.slice(2));
  await expect(page.locator(".captured-photo-card")).toHaveCount(4);
  await expect(page.locator(".captured-photo-card img")).toHaveCount(4, { timeout: 30_000 });
  await expect.poll(() => page.locator(".captured-photo-card img").evaluateAll((images) => images.every((image) => {
    const img = image as HTMLImageElement;
    return img.naturalWidth > 0 && img.naturalWidth <= 1920 && img.naturalHeight <= 1920;
  }))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { photoDecodeCounters: object }).photoDecodeCounters)).toEqual({ active: 0, maximum: 1, closed: 4 });
});

async function openJob(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByTestId("nav-field").click();
  await page.getByRole("button", { name: /Gartenpflege und Sichtprüfung/ }).first().click();
  await expect(page.locator(".service-task-list")).toBeVisible();
}

async function storedPhotos(page: Page) {
  return page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("kolaretorp-field-progress") || "{}");
    return Object.values(progress).flatMap((tasks) => Object.values(tasks as Record<string, { photos: { id: string; uploadStatus: string; storagePath?: string; previewUrl?: string }[] }>).flatMap((task) => task.photos));
  });
}

for (const count of [1, 5]) test(`${count} Bibliotheksfotos erscheinen sofort und bleiben nach Berichtsspeicherung erhalten`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const uploads = new Promise<void>((resolve) => { release = resolve; });
  const mediaIds = new Set<string>();
  await page.route("**/api/media", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataBuffer()!.toString();
    const id = body.match(/name="mediaId"\r\n\r\n([^\r]+)/)?.[1];
    expect(id).toBeTruthy();
    mediaIds.add(id!);
    await uploads;
    await route.fulfill({ json: { id, name: "foto.jpg", path: `tenant/field-photos/${id}.jpg`, url: `/api/private-media?path=tenant/field-photos/${id}.jpg` } });
  });
  await page.route("**/api/media?**", (route) => {
    expect(route.request().resourceType()).toBe("fetch");
    expect(route.request().headers()["x-workcore-e2e-bypass"]).toBe("1");
    return route.fulfill({ contentType: "image/png", body: pixel });
  });
  await openJob(page);
  const input = page.locator('input[aria-label^="Bilder zu"]').first();
  await input.setInputFiles(photos(count));
  await expect(page.locator(".captured-photo-card img")).toHaveCount(count);
  await expect.poll(() => storedPhotos(page)).toHaveLength(count);
  release();
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "uploaded").length).toBe(count);
  expect(mediaIds.size).toBe(count);
  await page.getByRole("button", { name: "Einsatz abschließen", exact: true }).click();
  const reportPhotos = () => page.evaluate(() => {
    const report = JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]").find((item: { title: string }) => item.title === "Gartenpflege und Sichtprüfung");
    return report?.checklistResults.flatMap((task: { photos: { id: string; storagePath?: string }[] }) => task.photos) ?? [];
  });
  await expect.poll(reportPhotos).toHaveLength(count);
  const ids = (await reportPhotos()).map((photo: { id: string }) => photo.id);
  expect(new Set(ids).size).toBe(count);
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]") as { entityType: string; entityId: string; resourceId: string }[]);
  expect(queue.filter((item) => item.entityType === "report_media" && ids.includes(item.entityId))).toHaveLength(count);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect.poll(reportPhotos).toHaveLength(count);
  await page.getByTestId("nav-field").click();
  await page.getByRole("button", { name: /^Abgeschlossene Berichte/ }).click();
  await page.getByRole("button", { name: /Gartenpflege und Sichtprüfung.*Bericht/ }).click();
  await expect(page.locator(".captured-photo-card img")).toHaveCount(count);
  await expect.poll(() => page.locator(".captured-photo-card img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("Ein fehlgeschlagener Upload blockiert keine weiteren Fotos und Retry behält seine ID", async ({ page }) => {
  const attempts = new Map<string, number>();
  let failedId = "";
  let allowRetry = false;
  await page.route("**/api/media", async (route) => {
    const body = route.request().postDataBuffer()!.toString();
    const id = body.match(/name="mediaId"\r\n\r\n([^\r]+)/)![1];
    attempts.set(id, (attempts.get(id) ?? 0) + 1);
    failedId ||= id;
    if (id === failedId && !allowRetry) return route.fulfill({ status: 500, json: { error: "Testfehler" } });
    await route.fulfill({ json: { id, path: `tenant/field-photos/${id}.jpg`, url: "" } });
  });
  await openJob(page);
  await page.locator('input[aria-label^="Bilder zu"]').first().setInputFiles(photos(5));
  await expect(page.locator(".captured-photo-card img")).toHaveCount(5);
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "uploaded").length).toBe(4);
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "failed").length).toBe(1);
  const before = (await storedPhotos(page)).map((photo) => photo.id).sort();
  allowRetry = true;
  await page.getByRole("button", { name: "Upload erneut versuchen", exact: true }).click();
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "uploaded").length).toBe(5);
  expect((await storedPhotos(page)).map((photo) => photo.id).sort()).toEqual(before);
  expect(attempts.size).toBe(5);
});

test("Offline-Bibliotheksauswahl bleibt nach Reload erhalten und lädt nach Reconnect hoch", async ({ page, context, browserName }) => {
  const ids = new Set<string>();
  await page.route("**/api/media", async (route) => {
    const id = route.request().postDataBuffer()!.toString().match(/name="mediaId"\r\n\r\n([^\r]+)/)![1];
    ids.add(id);
    await route.fulfill({ json: { id, path: `tenant/field-photos/${id}.jpg`, url: "" } });
  });
  await openJob(page);
  // WebKit's network emulation can reject local blob image decoding as well.
  // Exercise its offline queue via the connection flag; Chromium also loses network.
  if (browserName !== "webkit") await context.setOffline(true);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  await page.locator('input[aria-label^="Bilder zu"]').first().setInputFiles(photos(5));
  await expect(page.locator(".captured-photo-card img")).toHaveCount(5);
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "queued" && !photo.storagePath && photo.previewUrl?.startsWith("data:image/")).length).toBe(5);
  expect(ids.size).toBe(0);
  // The dev server has no offline app-shell cache. Keep navigator offline while
  // allowing its HTML request so the durable draft can be checked after reload.
  await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
  await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-field").click();
  await expect(page.locator(".captured-photo-card img")).toHaveCount(5);
  expect(ids.size).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "uploaded").length).toBe(5);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  expect((await storedPhotos(page)).length).toBe(5);
  expect(ids.size).toBe(5);
});

test("Einzelaufnahme mit Kamera bleibt nutzbar", async ({ page }) => {
  await openJob(page);
  const camera = page.locator('input[aria-label^="Foto zu"]').first();
  await expect(camera).toHaveAttribute("capture", "environment");
  await camera.setInputFiles(photos(1));
  await expect(page.locator(".captured-photo-card img")).toHaveCount(1);
  await expect.poll(async () => (await storedPhotos(page)).filter((photo) => photo.uploadStatus === "uploaded").length).toBe(1);
});

test("Upload-Wiederholung liefert dieselbe Medien-ID und verlangt Authentifizierung", async ({ request }) => {
  const upload = (mediaId: string, authenticated = true) => request.post("/api/media", {
    headers: { "X-WorkCore-E2E-Bypass": authenticated ? "1" : "0" },
    multipart: { scope: "field-photos", mediaId, file: { name: "foto.png", mimeType: "image/png", buffer: pixel } },
  });
  expect((await upload("PHOTO-TEST", false)).status()).toBe(401);
  expect((await upload("../invalid")).status()).toBe(400);
  const first = await upload("PHOTO-TEST");
  expect(first.ok()).toBe(true);
  const repeated = await upload("PHOTO-TEST");
  expect(repeated.ok()).toBe(true);
  expect(await repeated.json()).toEqual(await first.json());
  const route = await import("node:fs").then((fs) => fs.readFileSync("app/api/media/route.ts", "utf8"));
  expect(route).toContain('.eq("tenant_id", auth.tenantId).eq("id", requestedId)');
  expect(route).toContain('existing.deleted_at || !existing.storage_path?.startsWith(`${auth.tenantId}/${scope}/`)');
  expect(route).toContain("upsert: false");
});

test("Upload-Antwort nach Auftragswechsel verändert den neuen Auftrag nicht", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let uploadStarted = false;
  await page.route("**/api/media", async (route) => {
    uploadStarted = true;
    await gate;
    await route.fulfill({ json: { id: "OLD", path: "tenant/old.jpg", url: "" } }).catch(() => {});
  });
  await openJob(page);
  await page.locator('input[aria-label^="Bilder zu"]').first().setInputFiles(photos(1));
  await expect.poll(() => uploadStarted).toBe(true);
  await page.getByRole("button", { name: /Auftrag Gartenpflege und Sichtprüfung Auftrag schließen/ }).click();
  await page.getByRole("button", { name: /^Beibehalten/ }).click();
  await page.getByRole("button", { name: /Poolpflege und Wasserwerte/ }).first().click();
  release();
  await expect(page.locator(".service-task-list")).toBeVisible();
  await expect(page.locator(".captured-photo-card")).toHaveCount(0);
  expect((await storedPhotos(page)).filter((photo) => photo.storagePath === "tenant/old.jpg")).toEqual([]);
});
