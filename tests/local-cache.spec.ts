import { expect, test } from "@playwright/test";
import { createSyncMutation } from "../lib/syncQueue";

const logo = `data:image/png;base64,${"A".repeat(300_000)}`;
const pending = createSyncMutation({ entityType: "vehicle_trip", entityId: "TRIP-CACHE-UNSENT", resourceId: "CACHE-CAR", operation: "create", payload: { startOdometer: "203179", purpose: "Ungesendete Fahrt" } });

for (const width of [390, 820]) test(`Grosser Cache wird ohne Datenverlust ausgelagert und offline geladen ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(({ logo, pending }) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    if (!localStorage.getItem("cache-test-ready")) {
      localStorage.setItem("cache-test-ready", "1");
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "cache-fixture": {} }));
      localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Cache Firma", logoUrl: logo }));
      localStorage.setItem("workcore-sync-mutations-v1", JSON.stringify([pending]));
      localStorage.setItem("kolaretorp-quick-trip-draft", JSON.stringify({ purpose: "Ungesendeter Fahrtentwurf", startOdometer: "203179" }));
    }
  }, { logo, pending });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".sidebar .brand")).toHaveText("Cache Firma");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kolaretorp-company-settings"))).toBeNull();
  const preserved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("workcore-read-cache", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const value = await new Promise<string>((resolve, reject) => { const r = db.transaction("sections").objectStore("sections").get("kolaretorp-company-settings"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); return JSON.parse(value).logoUrl;
  });
  expect(preserved).toBe(logo);
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".sidebar .brand")).toHaveText("Cache Firma");
  const saved = await page.evaluate(() => ({ queue: JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]"), draft: JSON.parse(localStorage.getItem("kolaretorp-quick-trip-draft") || "{}") }));
  expect(saved.queue).toContainEqual(expect.objectContaining({ id: pending.id, status: "pending", payload: pending.payload }));
  expect(saved.draft.purpose).toBe("Ungesendeter Fahrtentwurf");
  await expect(page.getByRole("alert").filter({ hasText: "Lokaler Browserspeicher ist voll" })).toHaveCount(0);
});

for (const failure of ["open", "write"]) test(`IndexedDB-${failure}-Fehler erhaelt den vorhandenen lokalen Datenbestand`, async ({ page }) => {
  await page.addInitScript(({ logo, failure }) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    if (failure === "open") IDBFactory.prototype.open = () => { throw new DOMException("Database unavailable", "QuotaExceededError"); };
    else IDBObjectStore.prototype.put = () => { throw new DOMException("Database full", "QuotaExceededError"); };
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "cache-fixture": {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Lokale Firma", logoUrl: logo }));
  }, { logo, failure });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".sidebar .brand")).toHaveText("Lokale Firma");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-company-settings") || "{}").logoUrl)).toBe(logo);
});

test("Echte localStorage-Quota beim Speichern wird durch IndexedDB aufgefangen", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    if (!localStorage.getItem("quota-fixture-ready")) {
      localStorage.setItem("quota-fixture-ready", "1");
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "quota-fixture": {} }));
      localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Quota Firma" }));
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "kolaretorp-company-settings") throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  await page.getByLabel("Firmenname", { exact: true }).fill("Gespeicherte Quota Firma");
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kolaretorp-company-settings"))).toBeNull();
  await page.reload();
  await expect(page.locator(".sidebar .brand")).toHaveText("Gespeicherte Quota Firma");
  await expect(page.getByRole("alert").filter({ hasText: "Lokaler Browserspeicher ist voll" })).toHaveCount(0);
});
