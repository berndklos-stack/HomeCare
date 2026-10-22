import { expect, test, type Page } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

async function openMaster(page: Page) {
  await page.route("**/api/resource-types", (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
  await page.route("**/api/sync-mutations", (route) => route.fulfill({ status: 503, json: { error: "OFFLINE_TEST" } }));
  await page.route("**/api/operations?**", (route) => route.fulfill({ json: { rows: [], active: true, count: 0 } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
}

for (const width of [390, 820]) test(`Ressourcenfoto erscheint nach Upload in Galerie, Liste und Kachel bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  let reads = 0;
  await page.route("**/api/media", route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postData()).toContain("resource-photos");
    return route.fulfill({ json: { path: "tenant/resource-photos/mower.png", url: "/api/media?path=tenant%2Fresource-photos%2Fmower.png", contentType: "image/png", size: 100 } });
  });
  await page.route("**/api/media?**", route => {
    expect(route.request().resourceType()).toBe("fetch");
    expect(route.request().headers()["x-workcore-e2e-bypass"]).toBe("1");
    reads++;
    return route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") });
  });
  await openMaster(page);
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page.getByRole("button", { name: "Neue Ressource anlegen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(defaultResourceTypes[2].id);
  await dialog.getByLabel("Name", { exact: true }).fill("Foto Rasenmäher");
  await dialog.getByRole("button", { name: "Ressource anlegen", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("wurde gespeichert");
  await dialog.getByLabel("Bild zur Ressource hinzufügen", { exact: true }).setInputFiles({ name: "mower.png", mimeType: "image/png", buffer: Buffer.from(pixel, "base64") });
  await expect(dialog.getByRole("img", { name: "Ressourcenbild mower.png", exact: true })).toHaveCSS("background-image", /blob:/);
  await page.screenshot({ path: test.info().outputPath(`resource-photo-${width}.png`) });
  await dialog.getByRole("button", { name: "Ressource schließen", exact: true }).click();
  await expect(page.getByRole("img", { name: "Vorschaubild Foto Rasenmäher", exact: true })).toHaveCSS("background-image", /blob:/);
  await page.getByRole("button", { name: "Ressourcen als Liste anzeigen", exact: true }).click();
  await expect(page.getByRole("img", { name: "Vorschaubild Foto Rasenmäher", exact: true })).toHaveCSS("background-image", /blob:/);
  // The database may return only a storage path after a reload; that remains displayable.
  await page.evaluate(() => {
    const resources = JSON.parse(localStorage.getItem("kolaretorp-resources") ?? "[]");
    const resource = resources.find((entry: { name: string }) => entry.name === "Foto Rasenmäher");
    for (const item of resource.media) delete item.previewUrl;
    localStorage.setItem("kolaretorp-resources", JSON.stringify(resources));
  });
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await expect(page.getByRole("img", { name: "Vorschaubild Foto Rasenmäher", exact: true })).toHaveCSS("background-image", /blob:/);
  await page.getByRole("button", { name: "Ressource Foto Rasenmäher bearbeiten", exact: true }).click();
  await expect(dialog.getByRole("img", { name: "Ressourcenbild mower.png", exact: true })).toHaveCSS("background-image", /blob:/);
  const settled = reads;
  await page.waitForTimeout(600);
  expect(reads).toBe(settled);
});

for (const mobile of [false, true]) {
  test(`Typgesteuerte Ressource, versteckte Werte und Reload ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await openMaster(page);
    await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
    await page.getByRole("button", { name: "Neue Ressource anlegen", exact: true }).click();
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveCount(0);
    await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(defaultResourceTypes[0].id);
    await dialog.getByLabel("Name", { exact: true }).fill("Test Mower");
    await dialog.getByLabel("Kennzeichen", { exact: true }).fill("HIDDEN-123");
    await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(defaultResourceTypes[2].id);
    await expect(dialog.getByLabel("Kennzeichen", { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel("Steuerland Fahrtenbuch", { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel("Fahrtenbuch aktiv", { exact: true })).toHaveCount(0);
    await dialog.getByLabel("Betriebsstunden", { exact: true }).fill("125");
    await dialog.getByLabel("Seriennummer", { exact: true }).fill("MOWER-SN");
    await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(defaultResourceTypes[0].id);
    await expect(dialog.getByLabel("Kennzeichen", { exact: true })).toHaveValue("HIDDEN-123");
    await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(defaultResourceTypes[2].id);
    await expect(dialog.getByLabel("Betriebsstunden", { exact: true })).toHaveValue("125");
    await dialog.getByRole("button", { name: "Ressource anlegen", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("wurde gespeichert");
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { entityType: string; payload: { name?: string } }) => m.entityType === "resource" && m.payload.name === "Test Mower"));
    await expect.poll(async () => (await read()).length).toBe(1);
    expect((await read())[0].payload).toMatchObject({ resourceTypeId: defaultResourceTypes[2].id, serialNumber: "MOWER-SN", operatingHours: "125", licensePlate: "HIDDEN-123" });
    expect(await dialog.locator(".resource-main-fields .resource-field").evaluateAll((fields) => fields.every((field) => {
      const control = field.querySelector("input, select");
      return !control || control.getBoundingClientRect().right <= field.getBoundingClientRect().right + 1;
    }))).toBe(true);
    await page.screenshot({ path: `test-results/resource-types-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    await dialog.getByRole("button", { name: "Ressource schließen", exact: true }).click();
    await page.reload();
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
    await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
    await page.getByRole("button", { name: "Ressource Test Mower bearbeiten", exact: true }).click();
    await expect(dialog.getByLabel("Seriennummer", { exact: true })).toHaveValue("MOWER-SN");
    await expect(dialog.getByLabel("Betriebsstunden", { exact: true })).toHaveValue("125");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Eigener Ressourcentyp konfiguriert Pflichtfelder und überlebt Reload offline", async ({ page }) => {
  await openMaster(page);
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page.getByRole("button", { name: "Ressourcentypen", exact: true }).click();
  await page.getByRole("button", { name: "Neuer Ressourcentyp", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Messgerät");
  expect(await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const close = element.querySelector("header button")!.getBoundingClientRect();
    return rect.left >= 12 && rect.right <= innerWidth - 12 && rect.top >= 12 && rect.bottom <= innerHeight - 12 && rect.right - close.right <= 24;
  })).toBe(true);
  await dialog.getByLabel("Aktiviert Seriennummer", { exact: true }).check();
  await dialog.getByLabel("Pflichtfeld Seriennummer", { exact: true }).check();
  await dialog.getByLabel("Reihenfolge Seriennummer", { exact: true }).fill("1");
  await page.context().setOffline(true);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const mutation = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((m: { entityType: string }) => m.entityType === "resource_type"));
  expect(mutation.payload.fields.find((field: { key: string }) => field.key === "serialNumber")).toMatchObject({ enabled: true, required: true, order: 1 });
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page.getByRole("button", { name: "Neue Ressource anlegen", exact: true }).click();
  await dialog.getByLabel("Ressourcentyp", { exact: true }).selectOption(mutation.entityId);
  await dialog.getByLabel("Name", { exact: true }).fill("Messgerät A");
  await dialog.getByRole("button", { name: "Ressource anlegen", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Pflichtfeld: Seriennummer");
  await dialog.getByLabel("Seriennummer", { exact: true }).fill("ME-1");
  await dialog.getByRole("button", { name: "Ressource anlegen", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("wurde gespeichert");
});

test("Materialstammdaten bleiben ausschließlich im Lagermodul", async ({ page }) => {
  await openMaster(page);
  await expect(page.locator(".master-data-tabs").getByRole("button", { name: "Material", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ressourcen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Wartung & Prüfungen", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Stammdaten", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Material", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ressourcentypen", exact: true })).toHaveCount(0);
});

for (const mobile of [false, true]) {
  test(`Wartung und Prüfungen gehören zu Ressourcen ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await openMaster(page);
    await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
    await expect(page.getByRole("button", { name: "Wartung & Prüfungen", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
    await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
    await page.getByRole("button", { name: "Zuweisungen, Ausstattung & Wartung", exact: true }).click();
    await expect(page.getByRole("button", { name: "Material & Lager", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Wartung & Prüfungen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Wartungspläne", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Neu", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Abbrechen", exact: true }).click();
    await page.screenshot({ path: `test-results/resource-maintenance-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
