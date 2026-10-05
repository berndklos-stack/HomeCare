import { expect, test, type Page } from "@playwright/test";

const resourcesKey = "kolaretorp-resources";
const queueKey = "workcore-sync-mutations-v1";

async function ready(page: Page) {
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
}

async function openTrip(page: Page) {
  await page.getByRole("button", { name: "Fahrt", exact: true }).click();
  const dialog = page.locator("dialog.quick-trip-modal");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillTrip(page: Page) {
  const dialog = await openTrip(page);
  await dialog.getByLabel("Startadresse", { exact: true }).fill("Kolaretorp 106");
  await dialog.getByLabel("Zieladresse", { exact: true }).fill("Gunnabo");
  await dialog.getByLabel("Start-Km", { exact: true }).fill("12648");
  await dialog.getByLabel("End-Km", { exact: true }).fill("12680");
  await dialog.getByLabel("Zweck / Ärende", { exact: true }).fill("UX Testfahrt");
  await dialog.getByLabel("Name / besucht bei", { exact: true }).fill("Testkunde");
  return dialog;
}

async function vehicle(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]").find((item: { id: string }) => item.id === "RES-1"), resourcesKey);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Avoid demo migration side effects; all mutations stay in the local E2E queue.
    if (!localStorage.getItem("drive-log-fixture")) {
      localStorage.setItem("drive-log-fixture", "1");
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "DRIVE-UX": {} }));
    }
  });
  await page.goto("/");
  await ready(page);
});

for (const mobile of [false, true]) {
  test(`Fahrt-Dialog: Kilometer, Validierung, aktive Queue, Abschluss ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const forbidden: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && /\/api\/(app-state|sync-sections)/.test(request.url())) forbidden.push(request.url());
    });
    const dialog = await fillTrip(page);
    await expect(dialog.getByLabel("Kilometer", { exact: true })).toHaveValue("32");
    await dialog.getByLabel("Start-Km", { exact: true }).fill("12650");
    await expect(dialog.getByLabel("Kilometer", { exact: true })).toHaveValue("30");
    await dialog.getByLabel("End-Km", { exact: true }).fill("12649");
    await expect(dialog.getByLabel("Kilometer", { exact: true })).toHaveValue("");
    await dialog.getByRole("button", { name: "Fahrt abschließen & speichern", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("nicht kleiner");
    await dialog.getByLabel("End-Km", { exact: true }).fill("12680");
    await expect(dialog.locator(".trip-actions button")).toHaveText([
      "Fahrt verwerfen", "Zwischenstand speichern", "Fahrt abschließen & speichern",
    ]);
    await page.context().setOffline(true);
    await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Kilometerstand weicht um 2 km");
    await expect.poll(async () => (await vehicle(page))?.logbook.find((trip: { purpose: string }) => trip.purpose === "UX Testfahrt")?.status).toBe("laufend");
    const entry = (await vehicle(page)).logbook.find((trip: { purpose: string }) => trip.purpose === "UX Testfahrt");
    expect(entry).toMatchObject({ endAddress: "Gunnabo", endOdometer: "12680", kilometers: "30", visited: "Testkunde" });
    await page.context().setOffline(false);
    await page.reload();
    await ready(page);
    await openTrip(page);
    await expect(dialog.getByLabel("Zweck / Ärende", { exact: true })).toHaveValue("UX Testfahrt");
    await dialog.getByRole("button", { name: "Fahrt abschließen & speichern", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await vehicle(page))?.logbook.find((trip: { id: string }) => trip.id === entry.id)?.status).toBe("abgeschlossen");
    expect((await vehicle(page)).logbook.filter((trip: { id: string }) => trip.id === entry.id)).toHaveLength(1);
    const queue = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), queueKey);
    expect(queue.some((mutation: { entityId: string; payload: { status?: string } }) => mutation.entityId === entry.id && mutation.payload.status === "abgeschlossen")).toBe(true);
    expect(forbidden).toEqual([]);
    await page.reload();
    await ready(page);
    await openTrip(page);
    await expect(dialog.getByLabel("Zweck / Ärende", { exact: true })).toHaveValue("");
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
    await page.screenshot({ path: `test-results/drive-log-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
  });
}

test("Benannte Standardfahrt: Pflichtname, keine Duplikate, Auswahl und keine Live-Daten", async ({ page }) => {
  const dialog = await fillTrip(page);
  await dialog.getByLabel("Als Standardfahrt speichern", { exact: true }).check();
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Namen");
  await dialog.getByLabel("Wie soll die Standardfahrt heißen?", { exact: true }).fill("Gunnabo Route");
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect.poll(async () => (await vehicle(page))?.standardTrips?.length).toBe(1);
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await dialog.getByRole("button", { name: "Fahrt abschließen & speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await vehicle(page))?.standardTrips?.length).toBe(1);
  const standard = (await vehicle(page)).standardTrips[0];
  expect(standard).toMatchObject({ label: "Gunnabo Route", startAddress: "Kolaretorp 106", endAddress: "Gunnabo" });
  for (const key of ["status", "startedAt", "endedAt", "startOdometer", "endOdometer", "date"]) expect(standard).not.toHaveProperty(key);
  await openTrip(page);
  await dialog.getByLabel("Standardfahrt wählen", { exact: true }).selectOption(standard.id);
  await expect(dialog.getByLabel("Zieladresse", { exact: true })).toHaveValue("Gunnabo");
  await expect(dialog.getByLabel("End-Km", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("Als Standardfahrt speichern", { exact: true })).not.toBeChecked();
  await dialog.getByLabel("Als Standardfahrt speichern", { exact: true }).check();
  await dialog.getByLabel("Zieladresse", { exact: true }).fill("Andere Route");
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("bereits für eine andere Standardfahrt");
  expect((await vehicle(page)).standardTrips).toEqual([standard]);
});

test("Ungespeicherten Entwurf verwerfen und neue Fahrt direkt abschließen", async ({ page }) => {
  const dialog = await fillTrip(page);
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Fahrt verwerfen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await ready(page);
  await openTrip(page);
  await expect(dialog.getByLabel("Zweck / Ärende", { exact: true })).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await fillTrip(page);
  await dialog.getByRole("button", { name: "Fahrt abschließen & speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await vehicle(page))?.logbook.find((trip: { purpose: string }) => trip.purpose === "UX Testfahrt")?.status).toBe("abgeschlossen");
});

test("Verwerfen bestätigt aktive Fahrt und entfernt sie dauerhaft", async ({ page }) => {
  const dialog = await fillTrip(page);
  await dialog.getByRole("button", { name: "Zwischenstand speichern", exact: true }).click();
  await expect.poll(async () => (await vehicle(page))?.logbook.some((trip: { purpose: string }) => trip.purpose === "UX Testfahrt")).toBe(true);
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await dialog.getByRole("button", { name: "Fahrt verwerfen", exact: true }).click();
  await expect(dialog).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Fahrt verwerfen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await vehicle(page))?.logbook.some((trip: { purpose: string }) => trip.purpose === "UX Testfahrt")).toBe(false);
  await page.reload();
  await ready(page);
  await openTrip(page);
  await expect(dialog.getByLabel("Zweck / Ärende", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("End-Km", { exact: true })).toHaveValue("");
});

test("Bestehende Fahrt im Modal: Abbrechen, Fokus, Live-KM und Speichern ohne Seitensprung", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const quick = await openTrip(page);
  await quick.getByRole("button", { name: "Fahrtenbuch öffnen", exact: true }).click();
  const list = page.locator(".resource-logbook-modal");
  await expect(list).toBeVisible();
  const row = list.getByRole("row").filter({ hasText: "Kundenauftrag Hauskontrolle" });
  const edit = row.getByRole("button", { name: /Bearbeiten/ });
  await edit.scrollIntoViewIfNeeded();
  await edit.focus();
  const scroll = await list.evaluate((element) => element.scrollTop);
  await edit.click();
  const dialog = page.locator("dialog.logbook-edit-modal");
  await expect(dialog).toBeVisible();
  await expect(row).toBeVisible();
  await dialog.getByLabel("Zweck", { exact: true }).fill("Nicht speichern");
  await dialog.getByRole("button", { name: "Bearbeitung abbrechen", exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("Kundenauftrag Hauskontrolle");
  await expect(edit).toBeFocused();
  expect(await list.evaluate((element) => element.scrollTop)).toBe(scroll);
  await edit.click();
  await dialog.getByLabel("Start-Km", { exact: true }).fill("12600");
  await dialog.getByLabel("End-Km", { exact: true }).fill("12650");
  await expect(dialog.getByLabel("Kilometer", { exact: true })).toHaveValue("50");
  await dialog.getByLabel("Zweck", { exact: true }).fill("Geänderte Fahrt");
  await dialog.getByRole("button", { name: "Fahrt speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole("row").filter({ hasText: "Geänderte Fahrt" })).toContainText("50");
});
