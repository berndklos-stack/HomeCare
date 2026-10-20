import { expect, test, type Page } from "@playwright/test";
import { appVersion } from "../../lib/appVersion";

test.skip(process.env.WORKCORE_TEST_ONLINE !== "1", "Requires WORKCORE_TEST_ONLINE=1; every API is mocked.");

const vehicle = {
  id: "RES-1", type: "Fahrzeug", name: "Testfahrzeug", identifier: "TEST", status: "aktiv",
  responsiblePersonId: "PER-1", location: "Lager", notes: "", media: [],
  logbookYear: "2026", odometerYearStart: "200", odometerYearEnd: "", logbook: [],
};
function sections(name = "Aktueller Serverstand", odometer = "200") {
  return {
    companySettings: { value: { name }, updatedAt: "2026-10-20T12:00:00Z" },
    resources: { value: [{ ...vehicle, odometerYearStart: odometer }], updatedAt: "2026-10-20T12:00:00Z" },
    jobs: { value: [] }, reports: { value: [] },
  };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("button", { name: "Aktualisieren", exact: true })).toBeEnabled();
  await expect(page.locator(".sidebar .brand")).toHaveText("Aktueller Serverstand");
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Veralteter Cache" }));
  });
  // Never send fixture reads or writes to a real backend.
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path === "/api/version" ? appVersion : { data: path === "/api/sync-sections" ? sections() : [] } });
  });
});

for (const close of [false, true]) test(`Fahrt sofort sichtbar, parallele gezielte Abfragen und Schliessen ${close}`, async ({ page }) => {
  await ready(page);
  const positions = gate();
  const resources = gate();
  const positionStarted = gate();
  const resourceStarted = gate();
  let fullFetches = 0;
  await page.route("**/api/vehicle-positions", async route => {
    positionStarted.release();
    await positions.promise;
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/api/sync-sections*", async route => {
    const keys = new URL(route.request().url()).searchParams.get("keys");
    if (keys !== "resources") fullFetches++;
    resourceStarted.release();
    await resources.promise;
    await route.fulfill({ json: { data: { resources: sections("", "250").resources } } });
  });
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  const trip = page.locator("section.quick-trip-page");
  try {
    await expect(trip).toBeVisible();
    await expect(trip.getByRole("status")).toContainText("Fahrzeugdaten");
    await expect(trip.getByLabel("Start-Km", { exact: true })).toBeDisabled();
    // Both requests must have started before either response is released.
    await Promise.all([positionStarted.promise, resourceStarted.promise]);
    expect(fullFetches).toBe(0);
    if (close) {
      await trip.getByRole("button", { name: "Fahrt erfassen Schließen", exact: true }).click();
      await expect(trip).toHaveCount(0);
    }
  } finally { positions.release(); resources.release(); }
  if (close) {
    await expect(page.getByRole("button", { name: "Fahrt", exact: true })).toBeEnabled();
    // Reopening must not be triggered by the completed, dismissed request.
    await expect.poll(() => page.locator("fieldset[aria-busy=true]").count()).toBe(0);
    await expect(trip).toHaveCount(0);
    await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  }
  await expect(trip.getByLabel("Start-Km", { exact: true })).toBeEnabled();
  await expect(trip.getByLabel("Start-Km", { exact: true })).toHaveValue("250");
});

test("Start ersetzt alten Cache mit genau einem Gesamtabruf", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/sync-sections*", async route => {
    reads++;
    await route.fulfill({ json: { data: sections() } });
  });
  await ready(page);
  expect(reads).toBe(1);
});

test("Einmal Aktualisieren wartet auf laufenden Abgleich und holt danach frisch", async ({ page }) => {
  await ready(page);
  const background = gate();
  const started = gate();
  let reads = 0;
  await page.route("**/api/sync-sections*", async route => {
    const request = ++reads;
    if (request === 1) { started.release(); await background.promise; }
    await route.fulfill({ json: { data: sections(request === 1 ? "Alter laufender Abruf" : "Frisch nach einem Klick") } });
  });
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "kolaretorp-resources" })));
  await started.promise;
  try {
    await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
    await expect(page.getByRole("button", { name: "Aktualisiere", exact: true })).toBeDisabled();
    await expect(page.getByText(/^Daten aktualisiert:/)).toHaveCount(0);
  } finally { background.release(); }
  await expect(page.locator(".sidebar .brand")).toHaveText("Frisch nach einem Klick");
  await expect(page.getByRole("button", { name: "Aktualisieren", exact: true })).toBeEnabled();
  expect(reads).toBe(2);
});

test("Fehlgeschlagene Aktualisierung meldet keinen Erfolg und erhaelt lokale Daten", async ({ page }) => {
  await ready(page);
  await page.route("**/api/sync-sections*", route => route.fulfill({ status: 503, json: { error: "Test: Server voruebergehend nicht erreichbar" } }));
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await expect(page.getByText("Test: Server voruebergehend nicht erreichbar", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Daten aktualisiert:/)).toHaveCount(0);
  await expect(page.locator(".sidebar .brand")).toHaveText("Aktueller Serverstand");
});
