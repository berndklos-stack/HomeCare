import { test, expect } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

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
