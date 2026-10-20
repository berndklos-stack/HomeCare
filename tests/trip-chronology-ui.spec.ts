import { test, expect } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";
import { latestCompletedTripForDate, maximumTripEndForDate } from "../lib/tripChronology";

const historicalTrips = [
  { id: "FIRST", date: "2026-10-01", startOdometer: "100", endOdometer: "150", endAddress: "Erster Ort" },
  { id: "LOWER", date: "2026-10-02", startedAt: "2026-10-02T18:00:00Z", startOdometer: "150", endOdometer: "175", endAddress: "Niedrigerer Stand" },
  { id: "HIGHER", date: "2026-10-02", startedAt: "2026-10-02T08:00:00Z", startOdometer: "175", endOdometer: "200", endAddress: "Letzter Ort am Tag" },
  { id: "NEXT", date: "2026-10-03", startOdometer: "230", endOdometer: "240", endAddress: "Spaeterer Ort" },
  { id: "DELETED", date: "2026-10-03", startOdometer: "205", endOdometer: "210", endAddress: "Geloescht" },
  { id: "ACTIVE", date: "2026-10-02", startOdometer: "200", endOdometer: "999", status: "laufend", endAddress: "Nicht abgeschlossen" },
];

test("Datumsvorschlaege verwenden hoechsten Tagesendstand und spaetere Startgrenze", () => {
  expect(latestCompletedTripForDate(historicalTrips, "2026-10-02")?.id).toBe("HIGHER");
  expect(latestCompletedTripForDate(historicalTrips, "2026-09-30")).toBeUndefined();
  expect(latestCompletedTripForDate(historicalTrips, "2026-10-04", ["NEXT", "DELETED"])?.id).toBe("HIGHER");
  expect(maximumTripEndForDate(historicalTrips, "2026-10-02", ["DELETED"])).toBe("230");
  expect(maximumTripEndForDate(historicalTrips, "2026-10-04")).toBe("");
  expect(maximumTripEndForDate([{ id: "X", date: "2026-10-03", startOdometer: "invalid" }], "2026-10-02")).toBe("");
});

for (const width of [390, 820]) test(`Datumswahl in Schnellfahrt und Fahrtenbuch setzt Startort, Tages-KM und maximalen Endstand ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(trips => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-resources", JSON.stringify([{
      id: "RES-1", type: "Fahrzeug", name: "Datumsfahrzeug", identifier: "TEST", status: "aktiv",
      responsiblePersonId: "PER-1", location: "Aktueller Fahrzeugort", notes: "", media: [],
      logbookYear: "2026", odometerYearStart: "100", odometerYearEnd: "", deletedLogbookEntryIds: ["DELETED"],
      logbook: trips.filter(t => t.id !== "ACTIVE").map(t => ({
        driverId: "PER-1", startAddress: "Start", tripType: "Dienstfahrt", purpose: "Test", visited: "Test", fuelOrCharge: "", notes: "", kilometers: "25", status: "abgeschlossen", ...t,
      })),
    }]));
  }, historicalTrips);
  await page.route("**/api/resource-types", route => route.fulfill({ json: { types: defaultResourceTypes.map(type => ({ ...type, revision: 1 })) } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  const quick = page.locator("section.quick-trip-page");
  await quick.getByLabel("Datum", { exact: true }).fill("2026-10-02");
  await expect(quick.getByLabel("Start-Km", { exact: true })).toHaveValue("200");
  await expect(quick.getByLabel("Startadresse", { exact: true })).toHaveValue("Letzter Ort am Tag");
  await expect(quick.getByLabel("End-Km", { exact: true })).toHaveValue("230");
  await expect(quick.getByText("Maximal 230 km", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/trip-date-quick-${width}-${test.info().project.name}.png` });
  await quick.getByLabel("End-Km", { exact: true }).fill("225");
  await expect(quick.getByLabel("Kilometer", { exact: true })).toHaveValue("25");
  await quick.getByRole("button", { name: "Fahrtenbuch öffnen", exact: true }).click();
  const resource = page.locator(".resource-editor-modal, .resource-editor-workspace");
  await resource.getByRole("button", { name: "Neue Fahrt", exact: true }).click();
  const editor = page.locator("section.logbook-entry-page");
  await editor.getByLabel("Datum", { exact: true }).fill("2026-10-02");
  await expect(editor.getByLabel("Start-Km", { exact: true })).toHaveValue("200");
  await expect(editor.getByLabel("Startadresse", { exact: true })).toHaveValue("Letzter Ort am Tag");
  await expect(editor.getByLabel("End-Km", { exact: true })).toHaveValue("230");
  await expect(editor.getByText("Maximal 230 km", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/trip-date-logbook-${width}-${test.info().project.name}.png` });
  await editor.getByLabel("End-Km", { exact: true }).fill("225");
  await editor.getByLabel("Startzeit", { exact: true }).fill("12:00");
  await expect(editor.getByLabel("End-Km", { exact: true })).toHaveValue("225");
  await editor.getByLabel("Datum", { exact: true }).fill("2026-10-04");
  await expect(editor.getByLabel("Start-Km", { exact: true })).toHaveValue("240");
  await expect(editor.getByLabel("End-Km", { exact: true })).toHaveValue("");
  await expect(editor.getByText(/^Maximal /)).toHaveCount(0);
});

for (const mobile of [false, true]) test(`Historische Fahrt: Zeitwahl, Vorschlag und sichtbare Luecke ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.route("**/api/resource-types", (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.evaluate(() => {
    const resources = JSON.parse(localStorage.getItem("kolaretorp-resources") || JSON.stringify([{ id: "RES-1", type: "Fahrzeug", name: "Servicebil Kolaretorp", identifier: "ABC123", status: "aktiv", responsiblePersonId: "PER-1", location: "Lager", notes: "", media: [], logbookYear: "2026", odometerYearStart: "202900", odometerYearEnd: "", logbook: [] }]));
    const car = resources.find((item: { id: string }) => item.id === "RES-1");
    car.logbookLanguage = "sv";
    const base = { id: "", date: "", startOdometer: "", endOdometer: "", tripType: "Dienstfahrt", status: "abgeschlossen", revision: 1,
      driverId: "", startAddress: "Kolaretorp 106, 382 93 Nybro", endAddress: "Patron Trägårdhs Väg 28, 382 74 Alsterbro", purpose: "Test", visited: "Testkunde", notes: "", fuelOrCharge: "", kilometers: "47", waypoints: [], odometerPhotos: [] };
    car.logbook = [
      { ...base, id: "TRIP-A", date: "2026-10-01", startedAt: new Date("2026-10-01T09:00:00").toISOString(), startOdometer: "202900", endOdometer: "202947" },
      { ...base, id: "TRIP-B", date: "2026-10-03", startedAt: new Date("2026-10-03T10:00:00").toISOString(), startOdometer: "203132", endOdometer: "203200" },
    ];
    localStorage.setItem("kolaretorp-resources", JSON.stringify(resources));
  });
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page.locator("article").filter({ hasText: "Servicebil Kolaretorp" }).first().click();
  const resource = page.locator(".resource-editor-modal, .resource-editor-workspace");
  await resource.getByRole("button", { name: "Fahrtenbuch", exact: true }).click();
  await expect(resource.getByLabel("Offene Kilometerluecken")).toContainText("185 km");
  await page.getByLabel("Sprache", { exact: true }).selectOption("sv");
  await expect(resource.getByLabel("Kilometerluckor")).toContainText("till");
  await expect(resource.locator('.logbook-table td[data-label="Typ"]').first()).toHaveText("Tjänsteresa");
  await page.getByLabel("Språk", { exact: true }).selectOption("de");
  await expect(resource.locator('.logbook-table td[data-label="Art"]').first()).toHaveText("Dienstfahrt");
  if (mobile) {
    const table = resource.locator(".logbook-table");
    const tableSize = await table.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    const overflow = await table.evaluate((element) => Array.from(element.querySelectorAll("*"))
      .filter((child) => child.getBoundingClientRect().right > element.getBoundingClientRect().right + 2)
      .map((child) => ({ tag: child.tagName, class: child.className, width: child.getBoundingClientRect().width, minWidth: getComputedStyle(child).minWidth, text: child.textContent?.slice(0, 60) })));
    expect(tableSize.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(tableSize.client + 2);
    const route = table.locator(".logbook-route-cell").first();
    expect(await route.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/logbook-list-mobile-${test.info().project.name}.png` });
  }
  await resource.getByRole("button", { name: "Neue Fahrt", exact: true }).click();
  const editor = page.locator("section.logbook-entry-page");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(editor.getByLabel("Startzeit", { exact: true })).toBeVisible();
  await editor.getByLabel("Datum", { exact: true }).fill("2026-10-02");
  await editor.getByLabel("Startzeit", { exact: true }).fill("12:00");
  await expect(editor.getByLabel("Start-Km", { exact: true })).toHaveValue("202947");
  await editor.getByLabel("Start-Km", { exact: true }).fill("202950");
  await expect(editor.getByLabel("Start-Km", { exact: true })).toHaveValue("202950");
  await editor.getByLabel("Datum", { exact: true }).fill("2026-09-01");
  await expect(editor.getByLabel("Start-Km", { exact: true })).toHaveValue("");
  await page.screenshot({ path: `test-results/trip-chronology-${mobile ? "mobile" : "desktop"}.png` });
  const sizes = await editor.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 2);
  const header = await editor.locator("header").boundingBox();
  expect(header?.height).toBeLessThanOrEqual(64);
  if (mobile) {
    const input = editor.getByLabel("Start-Km", { exact: true });
    expect(await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    expect((await input.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});
