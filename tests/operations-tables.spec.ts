import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { storageLocationPath } from "../lib/locationLabel";

test("Lagerweg enthaelt Standort und alle zugehoerigen Lagerplaetze", () => {
  const locations = [
    { id: "site", name: "KOLARETORP" },
    { id: "warehouse", name: "Hauptlager", parentLocationId: "site" },
    { id: "bin", name: "A1", parentLocationId: "warehouse" },
  ];
  expect(storageLocationPath("site", locations)).toBe("KOLARETORP");
  expect(storageLocationPath("bin", locations)).toBe("KOLARETORP / Hauptlager / A1");
  expect(storageLocationPath("missing", locations)).toBe("");
  expect(storageLocationPath("a", [{ id: "a", name: "A", parentLocationId: "b" }, { id: "b", name: "B", parentLocationId: "a" }])).toBe("B / A");
});

for (const mobile of [false, true]) test(`Kommissionierplatz Abholcode und Auftrag ${mobile ? "mobil" : "desktop"}`, async ({ page }, testInfo) => {
 await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
 await page.addInitScript(() => { localStorage.setItem("kolaretorp-updated-at", "2026-10-11T10:00:00Z"); localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-pick": {} })); });
 const order = { id: "55555555-5555-4555-8555-555555555555", job_id: "pick-job", title: "Gartenhaus", revision: 1, status: "open", created_at: "2026-10-11T10:00:00Z", staging_id: null as string | null, pickup_code: null as string | null };
 const pickup = "66666666-6666-4666-8666-666666666666";
 const items = [{ material_id: "pick-material", quantity: 2.5, picked: 0, material: { name: "Kantholz", sku: "KH001", unit: "Meter", record_data: { scanCode: "PICK-MAT" } } }];
 const posts: Record<string, unknown>[] = [];
 await page.route("**/api/picking-orders**", (route) => {
  if (route.request().method() === "GET") return route.fulfill({ json: { rows: [order], items, count: 1 } });
  const input = route.request().postDataJSON(); posts.push(input);
  if (input.action === "pick") { expect(input).toMatchObject({ material: "pick-material", source: "pick-source", destination: "pick-place", quantity: 2.5 }); order.status = "completed"; order.revision = 2; order.staging_id = "pick-place"; order.pickup_code = pickup; items[0].picked = 2.5; }
  else { expect(input).toMatchObject({ action: "dispatch", destination: null, pickup, revision: 2 }); order.status = "dispatched"; order.revision = 3; }
  return route.fulfill({ json: { id: order.id, revision: order.revision } });
 });
 await page.route("**/api/operations?**", (route) => {
  const params = new URL(route.request().url()).searchParams, entity = params.get("entity");
  if (entity === "stock_status") return route.fulfill({ json: { active: true } });
  if (entity === "scan_targets") return route.fulfill({ json: { jobs: [{ id: "pick-job", name: "Gartenhaus", code: "JOB-PICK", status: "in Arbeit", billable: true }], objects: [{ code: "OBJECT-NO-BOOK" }] } });
  const rows = entity === "location_details" && params.get("storage_places") !== "1" ? [{ id: "pick-source", name: "Hauptlager", location_code: "SOURCE" }, { id: "pick-place", name: "Kommissionierplatz 1", location_code: "STAGING" }]
   : entity === "stock_balances" ? [{ location_id: "pick-source", quantity: 10 }] : [];
  return route.fulfill({ json: { rows, count: rows.length } });
 });
 await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
 await page.getByRole("button", { name: "Lager & Material", exact: true }).click(); await page.getByRole("tab", { name: "Scanabläufe", exact: true }).click();
 await page.getByRole("dialog", { name: "Scanabläufe", exact: true }).getByRole("button", { name: "Kommissionierung", exact: true }).click();
 await page.getByRole("textbox", { name: "Kommissioniercode", exact: true }).fill(`PICK:${order.id}`); await page.getByRole("textbox", { name: "Kommissioniercode", exact: true }).press("Enter");
 await page.getByRole("button", { name: "Kommissionierung scannen", exact: true }).click();
 const scan = page.getByRole("dialog", { name: "Kommissionierung scannen", exact: true }), code = scan.getByRole("textbox", { name: "Code", exact: true });
 for (const value of ["PICK-MAT", "SOURCE", "STAGING"]) { await code.fill(value); await code.press("Enter"); }
 await scan.getByRole("spinbutton", { name: "Menge", exact: true }).fill("2.5"); await scan.getByRole("button", { name: "Umlagerung buchen", exact: true }).click();
 await expect(page.getByText(`Abholcode: PICKUP:${pickup}`, { exact: true })).toBeVisible();
 const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Abholcode als PDF", exact: true }).click(); await (await download).saveAs(`test-results/pickup-label-${mobile}-${testInfo.project.name}.pdf`);
 const listDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "Kommissionierliste als PDF", exact: true }).click(); await (await listDownload).saveAs(`test-results/picking-list-${mobile}-${testInfo.project.name}.pdf`);
 await page.getByRole("button", { name: "Abholung scannen", exact: true }).click();
 const dispatch = page.getByRole("dialog", { name: "Abholung scannen", exact: true });
 const pickupInput = dispatch.getByRole("textbox", { name: "Abholcode", exact: true }); await pickupInput.fill("WRONG"); await pickupInput.press("Enter"); await expect(dispatch.getByRole("alert")).toContainText("Abholcode");
 await pickupInput.fill(`PICKUP:${pickup}`); await pickupInput.press("Enter");
 const target = dispatch.getByRole("textbox", { name: "Auftragscode / Fahrzeugcode", exact: true }); await target.fill("OBJECT-NO-BOOK"); await target.press("Enter"); await expect(dispatch.getByRole("alert")).toContainText("nicht bebucht");
 await target.fill("JOB-PICK"); await target.press("Enter");
 await page.screenshot({ path: `test-results/pickup-review-${mobile}-${testInfo.project.name}.png`, fullPage: true });
 expect(await dispatch.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
 await dispatch.getByRole("button", { name: "Gesamte Ware buchen", exact: true }).click(); await expect(dispatch).not.toBeVisible(); expect(posts).toHaveLength(2);
});

for (const withOrder of [false, true]) test(`Scan-Auswahl und gemeinsamer Wareneingang ${withOrder ? "mit" : "ohne"} Bestellung`, async ({ page }, testInfo) => {
 await page.setViewportSize(withOrder ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
 await page.addInitScript(() => {
  localStorage.setItem("kolaretorp-updated-at", "2026-10-11T10:00:00Z"); localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-receipt": {} }));
  localStorage.setItem("kolaretorp-materials", JSON.stringify([{ id: "receipt-material", name: "Scanmaterial", scanCode: "MAT-RECEIPT", unit: "Meter", inventory: [] }]));
 });
 await page.route("**/api/operations?**", (route) => {
  const params = new URL(route.request().url()).searchParams, entity = params.get("entity");
  if (entity === "stock_status") return route.fulfill({ json: { active: true } });
  const rows = entity === "suppliers" ? [{ id: "22222222-2222-4222-8222-222222222222", company: "Testlieferant" }]
   : entity === "purchase_orders" ? [{ id: "33333333-3333-4333-8333-333333333333", supplier_id: "22222222-2222-4222-8222-222222222222", order_number: "BEST-001", status: "ordered", revision: 3 }]
   : entity === "purchase_order_items" ? [{ id: "44444444-4444-4444-8444-444444444444", material_id: "receipt-material", quantity: 10, received_quantity: 2 }]
   : entity === "location_details" ? params.get("storage_places") === "1" ? [{ id: "receipt-bin", name: "Regal 1", parent_location_id: "receipt-root" }] : [{ id: "receipt-root", name: "Wareneingang" }] : [];
  return route.fulfill({ json: { rows, count: rows.length } });
 });
 const posts: Record<string, unknown>[] = [];
 await page.route("**/api/goods-receipts", (route) => { posts.push(route.request().postDataJSON()); return route.fulfill({ json: { id: "receipt-success" } }); });
 await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
 await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
 await page.getByRole("tab", { name: "Scanabläufe", exact: true }).click();
 const chooser = page.getByRole("dialog", { name: "Scanabläufe", exact: true });
 for (const name of ["Wareneingang scannen", "Kommissionierung", "Warenausgang & Abholung", "Umlagerung scannen"]) await expect(chooser.getByRole("button", { name, exact: true })).toBeVisible();
 await page.screenshot({ path: `test-results/scan-chooser-${withOrder}-${testInfo.project.name}.png` });
 await chooser.getByRole("button", { name: "Wareneingang scannen", exact: true }).click();
 await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption("22222222-2222-4222-8222-222222222222");
 await page.getByRole("textbox", { name: "Lieferscheinnummer", exact: true }).fill("LS-TEST");
 if (withOrder) await page.getByRole("combobox", { name: "Bestellungen", exact: true }).selectOption("33333333-3333-4333-8333-333333333333");
 await page.getByRole("combobox", { name: "Nach Standort / Lagerort", exact: true }).selectOption("receipt-bin");
 await page.getByRole("button", { name: "Materialien scannen", exact: true }).click();
 await page.getByRole("textbox", { name: "Code", exact: true }).fill("MAT-RECEIPT"); await page.getByRole("textbox", { name: "Code", exact: true }).press("Enter");
 await page.getByRole("spinbutton", { name: "Menge", exact: true }).fill("2.5");
 await page.getByRole("button", { name: "Position übernehmen", exact: true }).click();
 expect(posts).toHaveLength(0);
 await page.getByRole("button", { name: "Scanablauf auswählen", exact: true }).click();
 await chooser.getByRole("button", { name: "Kommissionierung", exact: true }).click();
 await page.getByRole("button", { name: "Scanablauf auswählen", exact: true }).click(); await chooser.getByRole("button", { name: "Wareneingang scannen", exact: true }).click();
 await expect(page.getByRole("table", { name: "Wareneingang scannen", exact: true })).toContainText("2.5 Meter");
 await page.screenshot({ path: `test-results/scan-receipt-${withOrder}-${testInfo.project.name}.png` });
 await page.getByRole("button", { name: "Wareneingang abschließen", exact: true }).click();
 await expect(page.getByRole("status")).toContainText("Wareneingang gebucht");
 expect(posts).toHaveLength(1); expect(posts[0]).toMatchObject({ payload: { delivery_number: "LS-TEST", location_id: "receipt-bin", order_id: withOrder ? "33333333-3333-4333-8333-333333333333" : null, items: [{ material_id: "receipt-material", quantity: 2.5 }] } });
});

for (const mobile of [false, true]) test(`Scan-Umlagerung mit Teilmenge und Bestandspruefung ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-updated-at", "2026-10-10T10:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-scan-test": {} }));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([
      { id: "scan-material", name: "Scanmaterial", sku: "SM-001", scanCode: "0012345678905", unit: "Meter", inventory: [] },
      { id: "scan-archived", name: "Archiviert", scanCode: "ARCHIVE", archived: true, inventory: [] },
      { id: "scan-duplicate-a", name: "Doppelt A", scanCode: "DUPLICATE", inventory: [] },
      { id: "scan-duplicate-b", name: "Doppelt B", scanCode: "DUPLICATE", inventory: [] },
    ]));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => { throw new DOMException("Denied", "NotAllowedError"); } });
  });
  let balance = 20;
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("entity") === "stock_status") return route.fulfill({ json: { active: true } });
    const rows = params.get("entity") === "stock_balances" ? [{ location_id: "scan-root", quantity: balance }]
      : params.get("entity") === "location_details" ? params.get("storage_places") === "1" ? [{ id: "scan-bin", name: "Regal A", parent_location_id: "scan-root", location_code: "REG-A" }]
        : [{ id: "scan-root", name: "Hauptlager", location_code: "LAGER-01" }, { id: "scan-deleted", name: "Archivlager", location_code: "ARCHIVE-LOC", archived: true }]
      : [];
    return route.fulfill({ json: { rows, count: rows.length } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("tab", { name: "Scanabläufe", exact: true }).click();
  await page.getByRole("dialog", { name: "Scanabläufe", exact: true }).getByRole("button", { name: "Umlagerung scannen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Umlagerung scannen", exact: true });
  const code = dialog.getByRole("textbox", { name: "Code", exact: true });
  await expect(code).toBeVisible();
  await dialog.getByRole("button", { name: "Mit Kamera scannen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Kamera nicht verfügbar");
  for (const invalid of ["UNKNOWN", "ARCHIVE", "LAGER-01", "DUPLICATE"]) {
    await code.fill(invalid); await code.press("Enter");
    await expect(dialog.getByRole("alert")).toContainText(invalid === "DUPLICATE" ? "mehrfach vergeben" : "nicht gefunden");
  }
  await code.fill("0012345678905"); await code.press("Enter");
  await expect(dialog).toContainText("SM-001 · Scanmaterial");
  await code.fill("ARCHIVE-LOC"); await code.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("nicht gefunden");
  await code.fill("LAGER-01"); await code.press("Enter");
  await code.fill("LAGER-01"); await code.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("unterschiedlich");
  await code.fill("REG-A"); await code.press("Enter");
  await expect(dialog).toContainText("Hauptlager / Regal A");
  await expect(dialog.getByRole("status")).toContainText("20 Meter");
  const quantity = dialog.getByRole("spinbutton", { name: "Menge", exact: true });
  await quantity.fill("21");
  await expect(dialog.getByRole("button", { name: "Umlagerung buchen", exact: true })).toBeDisabled();
  await quantity.fill("2.5");
  await page.screenshot({ path: `test-results/scan-transfer-${mobile}-${test.info().project.name}.png` });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  balance = 1;
  await dialog.getByRole("button", { name: "Umlagerung buchen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Bestand");
  await expect(dialog).toBeVisible();
  await quantity.fill("0.5");
  await dialog.getByRole("button", { name: "Umlagerung buchen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((mutation: { payload: { kind?: string } }) => mutation.payload.kind === "stock"));
  expect(queued).toHaveLength(1);
  expect(queued[0].payload).toMatchObject({ material_id: "scan-material", source_id: "scan-root", destination_id: "scan-bin", quantity: 0.5 });
});

test("Kamera liest echten QR-Code und beendet den Videostream", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Canvas-Videostream nur in Chromium verfügbar");
  const qr = await QRCode.toDataURL("0012345678905", { width: 600, margin: 4 });
  await page.addInitScript(({ qr }) => {
    localStorage.setItem("kolaretorp-updated-at", "2026-10-10T10:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-camera-test": {} }));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([{ id: "camera-material", name: "Kameramaterial", scanCode: "0012345678905", unit: "Stück", inventory: [] }]));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const image = new Image(); image.src = qr; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 600;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      const stream = canvas.captureStream(15);
      (window as unknown as { scanTestStream: MediaStream }).scanTestStream = stream;
      return stream;
    } });
  }, { qr });
  await page.route("**/api/operations?**", (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.get("entity") === "stock_status" ? { active: true } : { rows: [], count: 0 } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("tab", { name: "Scanabläufe", exact: true }).click();
  await page.getByRole("dialog", { name: "Scanabläufe", exact: true }).getByRole("button", { name: "Umlagerung scannen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Umlagerung scannen", exact: true });
  await dialog.getByRole("button", { name: "Mit Kamera scannen", exact: true }).click();
  await expect(dialog).toContainText("Kameramaterial");
  await expect.poll(() => page.evaluate(() => (window as unknown as { scanTestStream: MediaStream }).scanTestStream.getTracks().map((track) => track.readyState))).toEqual(["ended"]);
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
});

for (const mobile of [false, true]) test(`Materialstammdaten und Lagerplaetze bleiben in der Reiteransicht ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const roots = [{ id: "inline-root", name: "Testlager", revision: 1, parent_location_id: null, location_code: "LAGER-01", location_kind: "warehouse" }];
  const bins = [{ id: "inline-bin", name: "Regal A", revision: 1, parent_location_id: "inline-root", location_code: "REG-A", location_kind: "warehouse" }];
  const parentReads: string[] = [];
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const entity = params.get("entity");
    if (entity === "stock_status") return route.fulfill({ json: { active: true } });
    if (params.get("id") === "inline-root") parentReads.push(entity!);
    const rows = entity === "location_details" ? params.get("id") ? roots.filter((root) => root.id === params.get("id")) : params.get("storage_places") === "1" || params.get("parent") ? bins : roots
      : entity === "location_types" ? [{ id: "inline-type", name: "Regal", revision: 1 }] : [];
    return route.fulfill({ json: { rows, count: rows.length } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const tabs = page.getByRole("tablist", { name: "Lager & Material", exact: true });
  const materialsTab = tabs.getByRole("tab", { name: "Materialstammdaten", exact: true });
  await expect(materialsTab.locator("svg")).toHaveCount(0);
  await materialsTab.click();
  await expect(materialsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Materialstammdaten", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Materialstammdaten", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zurück", exact: true })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: "Buchungen", exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/material-inline-${mobile}-${test.info().project.name}.png`, fullPage: true });
  await tabs.getByRole("tab", { name: "Standorte", exact: true }).click();
  const sites = page.getByRole("table", { name: "Standorte", exact: true });
  await expect(sites).toContainText("Testlager");
  await expect(sites).not.toContainText("Regal A");
  const createLocation = page.getByRole("button", { name: "Neuer Lagerort", exact: true });
  await expect(createLocation.locator("xpath=ancestor::*[@id='inventory-master-panel']")).toHaveCount(1);
  await sites.getByText("Testlager", { exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Zugehöriger Standort", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByLabel("Übergeordneter Lagerort", { exact: true })).toHaveCount(0);
  const rootDownload = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Etikett als PDF", exact: true }).click();
  await (await rootDownload).saveAs(`test-results/location-label-${mobile}-${test.info().project.name}.pdf`);
  await page.getByRole("dialog").getByRole("button", { name: "Lagerplätze", exact: true }).click();
  const places = page.getByRole("table", { name: "Lagerplätze", exact: true });
  await expect(places).toContainText("Regal A");
  await expect.poll(() => parentReads).toEqual(["location_details"]);
  await tabs.getByRole("tab", { name: "Lagerplätze", exact: true }).click();
  await expect(places).toContainText("Regal A");
  await expect(places).toContainText("Testlager");
  await places.locator("tbody tr").first().press("Enter");
  const dialog = page.getByRole("dialog", { name: "Standorte", exact: true });
  await expect(dialog.getByLabel("Bezeichnung", { exact: true })).toHaveValue("Regal A");
  await expect(dialog.getByLabel("Zugehöriger Standort", { exact: true })).toHaveValue("inline-root");
  const binDownload = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Etikett als PDF", exact: true }).click();
  await (await binDownload).saveAs(`test-results/bin-label-${mobile}-${test.info().project.name}.pdf`);
  await dialog.getByLabel("Lagerkennung", { exact: true }).fill("CHANGED");
  await dialog.getByRole("button", { name: "Etikett als PDF", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("zuerst speichern");
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.screenshot({ path: `test-results/storage-places-inline-${mobile}-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Neuer Lagerplatz", exact: true }).click();
  await dialog.getByLabel("Bezeichnung", { exact: true }).fill("Regal B");
  await expect(dialog.getByLabel("Zugehöriger Standort", { exact: true })).toHaveAttribute("required", "");
  await dialog.getByLabel("Zugehöriger Standort", { exact: true }).selectOption("inline-root");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((mutation: { payload: { values?: { name?: string } } }) => mutation.payload.values?.name === "Regal B"));
  expect(queued.payload.values.parent_location_id).toBe("inline-root");
  await tabs.getByRole("tab", { name: "Lagerorttypen", exact: true }).click();
  await expect(page.getByRole("table", { name: "Lagerorttypen", exact: true })).toContainText("Regal");
  await expect(page.getByRole("button", { name: "Neu", exact: true }).locator("xpath=ancestor::*[@id='inventory-master-panel']")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const mobile of [false, true]) test(`Lagerreiter trennen Ansichten und zeigen alle Buchungsmaterialien ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  let movementRows: Record<string, unknown>[] = [];
  let unfilteredRead = false;
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const entity = params.get("entity");
    if (entity === "stock_status") return route.fulfill({ json: { active: true } });
    if (entity === "stock_movements") {
      if (!params.get("parent")) unfilteredRead = true;
      const rows = movementRows.filter((row) => !params.get("parent") || row.material_id === params.get("parent"));
      return route.fulfill({ json: { rows, count: rows.length } });
    }
    return route.fulfill({ json: { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const filter = page.locator("#inventory-stock-panel > div > section").first().getByRole("combobox", { name: "Bezeichnung", exact: true });
  await expect(filter).toHaveValue("");
  const materials = await filter.locator("option").evaluateAll((options) => options.filter((option) => (option as HTMLOptionElement).value).slice(0, 2).map((option) => ({ id: (option as HTMLOptionElement).value, label: option.textContent! })));
  expect(materials).toHaveLength(2);
  movementRows = materials.map((material, index) => ({ id: `tab-movement-${index}`, material_id: material.id, quantity: 5, destination_id: "warehouse", occurred_at: "2026-10-10T08:00:00Z", actor_name: "Bernd Klos", note: `Reitertest ${index}` }));
  await expect(page.getByRole("table", { name: "Lagerbestandsübersicht", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  const bookings = page.getByRole("table", { name: "Buchungen", exact: true });
  await expect(bookings).toContainText("Reitertest 1");
  expect(unfilteredRead).toBe(true);
  await expect(page.getByRole("table", { name: "Lagerbestandsübersicht", exact: true })).toHaveCount(0);
  for (const material of materials) await expect(bookings).toContainText(material.label.split(" · ").pop()!);
  await bookings.getByText("Reitertest 1", { exact: true }).click();
  const details = page.getByRole("dialog");
  await expect(details).toContainText(materials[1].label);
  await details.getByRole("button", { name: "Korrekturbuchung", exact: true }).click();
  const correction = page.getByRole("dialog", { name: "Korrekturbuchung", exact: true });
  await correction.getByRole("textbox", { name: "Korrekturgrund", exact: true }).fill("Reitertest korrigieren");
  await correction.getByRole("button", { name: "Korrektur buchen", exact: true }).click();
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((mutation: { payload: { note?: string } }) => mutation.payload.note?.includes("Reitertest korrigieren")));
  expect(queued.payload.material_id).toBe(materials[1].id);
  await filter.selectOption(materials[0].id);
  await expect(bookings).not.toContainText("Reitertest 1");
  await page.getByRole("tab", { name: "Standorte", exact: true }).click();
  await expect(page.getByRole("table", { name: "Standorte", exact: true })).toBeVisible();
  await expect(bookings).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Zurück", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await expect(filter).toHaveValue(materials[0].id);
  await expect(page.getByRole("table", { name: "Bestand je Lagerort", exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/inventory-tabs-${mobile}-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const mobile of [false, true]) test(`Scancodes bleiben Text ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    const parent = new URL(route.request().url()).searchParams.get("parent");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : { rows: entity === "location_details" && !parent ? [{ id: "scan-location", name: "Testlager", location_code: "001-LAGER", location_kind: "warehouse", revision: 1 }]
      : entity === "location_types" ? [{ id: "scan-type", name: "Kommissionierwagen", revision: 1 }] : [], count: (entity === "location_details" && !parent) || entity === "location_types" ? 1 : 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("tab", { name: "Materialstammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Neues Material anlegen", exact: true }).click();
  const material = page.getByRole("dialog", { name: "Neues Material anlegen", exact: true });
  await material.getByLabel("Bezeichnung", { exact: true }).fill("Scan Testmaterial");
  await material.getByLabel("Artikelnummer / SKU", { exact: true }).fill("MAT-QR-001");
  await material.getByLabel("EAN / Scancode", { exact: true }).fill("0012345678905");
  await page.screenshot({ path: `test-results/material-scan-${mobile}-${test.info().project.name}.png` });
  await material.getByRole("button", { name: "Material anlegen", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-materials") ?? "[]").find((row: { name: string }) => row.name === "Scan Testmaterial"));
  expect(saved.scanCode).toBe("0012345678905");
  const materialRow = page.getByRole("button", { name: "Material Scan Testmaterial bearbeiten", exact: true });
  expect(await materialRow.evaluate((element) => element.tagName)).toBe("ARTICLE");
  await expect(materialRow.locator("button")).toHaveCount(1);
  await materialRow.press("Enter");
  await expect(page.getByRole("dialog", { name: "Material bearbeiten", exact: true }).getByLabel("EAN / Scancode", { exact: true })).toHaveValue("0012345678905");
  const editMaterial = page.getByRole("dialog", { name: "Material bearbeiten", exact: true });
  const labelDownload = page.waitForEvent("download");
  await editMaterial.getByRole("button", { name: "Etikett als PDF", exact: true }).click();
  const label = await labelDownload;
  expect(label.suggestedFilename()).toBe("Material-MAT-QR-001.pdf");
  await label.saveAs(`test-results/material-label-${mobile}-${test.info().project.name}.pdf`);
  await editMaterial.getByLabel("EAN / Scancode", { exact: true }).fill("CHANGED");
  await editMaterial.getByRole("button", { name: "Etikett als PDF", exact: true }).click();
  await expect(editMaterial.getByRole("alert").filter({ hasText: "zuerst speichern" })).toBeVisible();
  await page.screenshot({ path: `test-results/material-label-dialog-${mobile}-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Material-Dialog schließen", exact: true }).click();
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await page.getByRole("tab", { name: "Standorte", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bestandsübersicht", exact: true })).not.toBeVisible();
  const locations = page.getByRole("table", { name: "Standorte", exact: true });
  await expect(locations).toContainText("001-LAGER");
  await locations.locator("tbody tr").first().click();
  const location = page.getByRole("dialog", { name: "Standorte", exact: true });
  await expect(location.getByLabel("Lagerkennung", { exact: true })).toHaveValue("001-LAGER");
  for (const label of ["Lagerorttyp", "Auftrag", "Ressource", "Projekt / Objekt"]) {
    await expect(location.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await location.getByRole("button", { name: "Lagerplätze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lagerplätze: Testlager", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Neuer Lagerplatz", exact: true }).click();
  await location.getByLabel("Bezeichnung", { exact: true }).fill("Wagen 1");
  await location.getByLabel("Lagerorttyp", { exact: true }).selectOption("scan-type");
  await location.getByRole("button", { name: "Speichern", exact: true }).click();
  const place = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((row: { payload: { values?: { name?: string } } }) => row.payload.values?.name === "Wagen 1"));
  expect(place.payload.values).toMatchObject({ parent_location_id: "scan-location", location_type_id: "scan-type" });
  await page.getByRole("tab", { name: "Standorte", exact: true }).click();
  await locations.locator("tbody tr").first().click();
  await location.getByLabel("Lagerkennung", { exact: true }).fill("002-LAGER");
  await location.getByRole("button", { name: "Speichern", exact: true }).click();
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((row: { operation: string; payload: { entity?: string } }) => row.operation === "update" && row.payload.entity === "location_details"));
  expect(queued.payload.values.location_code).toBe("002-LAGER");
  await expect(locations.getByRole("columnheader", { name: "Aktionen", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Neuer Lagerort", exact: true }).click();
  await location.getByLabel("Bezeichnung", { exact: true }).fill("Neuer Testlagerort");
  await location.getByLabel("Lagerkennung", { exact: true }).fill("003-LAGER");
  await location.getByLabel("Notizen", { exact: true }).fill("Standortnotiz");
  await page.screenshot({ path: `test-results/location-create-${mobile}-${test.info().project.name}.png` });
  await location.getByRole("button", { name: "Speichern", exact: true }).click();
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((row: { operation: string; payload: { values?: { name?: string } } }) => row.operation === "create" && row.payload.values?.name === "Neuer Testlagerort"));
  expect(created.payload.values).toMatchObject({ name: "Neuer Testlagerort", location_code: "003-LAGER", location_kind: "warehouse", note: "Standortnotiz" });
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bestandsübersicht", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Lagerorttypen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bestandsübersicht", exact: true })).not.toBeVisible();
  const typeTable = page.getByRole("table", { name: "Lagerorttypen", exact: true });
  await expect(typeTable.getByRole("columnheader", { name: "Aktionen", exact: true })).toHaveCount(0);
  await typeTable.locator("tbody tr").first().press("Enter");
  await expect(page.getByRole("dialog", { name: "Lagerorttypen", exact: true }).getByLabel("Bezeichnung", { exact: true })).toHaveValue("Kommissionierwagen");
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  const type = page.getByRole("dialog", { name: "Lagerorttypen", exact: true });
  await type.getByLabel("Bezeichnung", { exact: true }).fill("Eigener Lagertyp");
  await type.getByRole("button", { name: "Speichern", exact: true }).click();
  const newType = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((row: { payload: { entity?: string } }) => row.payload.entity === "location_types"));
  expect(newType.payload.values.name).toBe("Eigener Lagertyp");
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bestandsübersicht", exact: true })).toBeVisible();
});

test("Archivierungsaktionen oeffnen keinen Editor und archivierte Materialzeilen sind bearbeitbar", async ({ page }) => {
  await page.route("**/api/operations?**", (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.get("entity") === "stock_status" ? { active: true } : { rows: [], count: 0 } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("tab", { name: "Materialstammdaten", exact: true }).click();
  const row = page.locator("article.clickable-record-row").first();
  const name = await row.locator("strong").first().textContent();
  await row.getByRole("button", { name: `Material ${name} archivieren`, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Material bearbeiten", exact: true })).toHaveCount(0);
  const archived = page.getByRole("button", { name: `Archiviertes Material ${name} bearbeiten`, exact: true });
  await archived.press(" ");
  await expect(page.getByRole("dialog", { name: "Material bearbeiten", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Material-Dialog schließen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zurück", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Materialstammdaten", exact: true })).toHaveAttribute("aria-selected", "true");
});

for (const mobile of [false, true]) test(`Beschaffung ist direkt am Material bearbeitbar statt in der Lageruebersicht ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-updated-at", "2026-10-10T10:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "synthetic-test": {} }));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([{ id: "purchasing-material", name: "Testmaterial", category: "Material", unit: "Meter", price: "0", currency: "SEK", description: "Test", revision: 4 }]));
  });
  const supplierId = "f465fa78-717c-4f6a-87bb-5cf99b81318d";
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const entity = params.get("entity");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : { rows: entity === "material_details" ? [{ id: "purchasing-material", revision: 4, preferred_supplier_id: supplierId, reorder_quantity: 2, notes: "Vorhandene Notiz" }] : entity === "suppliers" ? [{ id: supplierId, company: "Testlieferant" }] : [], count: 1 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByRole("table", { name: "Beschaffung", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Materialstammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Material Testmaterial bearbeiten", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Material bearbeiten", exact: true });
  await expect(dialog.getByLabel("Bevorzugter Lieferant", { exact: true })).toHaveValue(supplierId);
  await expect(dialog.getByLabel("Nachbestellmenge", { exact: true })).toHaveValue("2");
  await expect(dialog.getByLabel("Notizen", { exact: true })).toHaveValue("Vorhandene Notiz");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("heading", { name: "Beschaffung", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/material-purchasing-${mobile}-${test.info().project.name}.png` });
  await dialog.getByLabel("Nachbestellmenge", { exact: true }).fill("5.5");
  await dialog.getByRole("button", { name: "Beschaffungsdaten speichern", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Material speichern", exact: true })).toBeDisabled();
  const mutation = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((row: { payload: { entity?: string } }) => row.payload.entity === "material_details"));
  expect(mutation).toMatchObject({ entityId: "purchasing-material", expectedRevision: 4, payload: { values: { preferred_supplier_id: supplierId, reorder_quantity: 5.5, notes: "Vorhandene Notiz" } } });
});

test("Lageroeffnung zeigt Beschaffung nicht vor der Lageruebersicht", async ({ page }) => {
  let releaseStatus!: () => void;
  const status = new Promise<void>((resolve) => { releaseStatus = resolve; });
  await page.route("**/api/operations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("entity") === "stock_status") {
      await status;
      return route.fulfill({ json: { active: true } });
    }
    return route.fulfill({ json: { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Beschaffung", exact: true })).toHaveCount(0);
  releaseStatus();
  await expect(page.getByRole("heading", { name: "Bestandsübersicht", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beschaffung", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue("");
});

for (const direction of ["in", "out", "transfer"]) test(`Korrektur bucht ${direction} separat in Gegenrichtung`, async ({ page }) => {
  await page.setViewportSize(direction === "out" ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const source = direction === "in" ? null : "source-location";
  const destination = direction === "out" ? null : "destination-location";
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : { rows: entity === "stock_movements" ? [{
      id: "original-movement", quantity: 10, source_id: source, destination_id: destination, occurred_at: "2026-10-10T08:00:00Z", note: "Original booking", job_id: "job-ref", project_id: "project-ref",
    }] : [], count: entity === "stock_movements" ? 1 : 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("combobox", { name: "Bezeichnung", exact: true }).selectOption({ index: 1 });
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  const row = page.getByRole("table", { name: "Buchungen", exact: true }).locator("tbody tr").first();
  await row.click();
  await page.getByRole("dialog").getByRole("button", { name: "Korrekturbuchung", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Korrekturbuchung", exact: true });
  await expect(dialog.getByRole("button", { name: "Korrektur buchen", exact: true })).toBeDisabled();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(direction === "out" ? 390 : 1440);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `test-results/stock-correction-${direction}-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { payload: { kind?: string } }) => m.payload.kind === "stock"))).toHaveLength(0);
  await row.press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "Korrekturbuchung", exact: true }).click();
  const amount = direction === "in" ? 10 : 2;
  await dialog.getByRole("spinbutton", { name: "Menge", exact: true }).fill("11");
  await dialog.getByRole("textbox", { name: "Korrekturgrund", exact: true }).fill("Falsche Menge");
  await dialog.getByRole("button", { name: "Korrektur buchen", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "Menge", exact: true }).fill(String(amount));
  await dialog.locator("form").evaluate((form) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect(dialog).toHaveCount(0);
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { payload: { kind?: string } }) => m.payload.kind === "stock"));
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({ operation: "create", payload: { kind: "stock", source_id: destination, destination_id: source, quantity: amount, note: "Korrekturbuchung [original-movement]: Falsche Menge", job_id: "job-ref", project_id: "project-ref" } });
  await expect(row).toContainText("Original booking");
  await row.click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Korrekturbuchung", exact: true })).toBeDisabled();
});

test("Lageransicht verwendet die Panel- und Kennzahlgestaltung der Auswertung", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/operations?**", (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    return route.fulfill({ json: entity === "stock_status" ? { active: true } : { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Auswertung", exact: true }).click();
  const panel = page.locator(".analytics-view > .panel").first();
  await expect(panel).toBeVisible();
  const appearance = (element: Element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, radius: style.borderRadius, border: style.border, padding: style.padding };
  };
  const panelStyle = await panel.evaluate(appearance);
  const metricStyle = await panel.locator(".analytics-summary-grid > div").first().evaluate(appearance);
  await page.screenshot({ path: `test-results/analytics-reference-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const stockPanel = page.getByRole("heading", { name: "Bestandsübersicht", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(stockPanel).toBeVisible();
  expect(await stockPanel.evaluate(appearance)).toEqual(panelStyle);
  const material = stockPanel.getByRole("combobox", { name: "Bezeichnung", exact: true });
  await expect(material).toHaveValue("");
  await material.selectOption({ index: 1 });
  expect(await stockPanel.locator(".analytics-summary-grid > div").first().evaluate(appearance)).toEqual(metricStyle);
});

for (const mobile of [false, true]) test(`Materialstammdaten kehren ohne alten Lagerbildschirm zurueck ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  let statusReads = 0;
  await page.route("**/api/operations?**", async (route) => {
    const entity = new URL(route.request().url()).searchParams.get("entity");
    if (entity === "stock_status") {
      statusReads++;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({ json: { active: true } });
    }
    if (entity === "stock_balances") return route.fulfill({ json: { rows: [{ location_id: "test-location", quantity: 55 }] } });
    if (entity === "stock_movements") return route.fulfill({ json: { rows: [
      { id: "movement-1", quantity: 55, source_id: null, destination_id: "test-location", occurred_at: "2026-10-09T07:37:26Z", note: "Anlieferung", actor_user_id: "1924d8ca-0781-42e3-98cf-3aa69fcc1f90", actor_name: "Bernd Klos" },
      { id: "movement-2", quantity: 5, source_id: "test-location", destination_id: null, occurred_at: "2026-10-09T08:37:26Z", note: "Inventur [525ebe5c-92e5-40d2-a5b8-28892576d623]: INV 001" },
      { id: "movement-3", quantity: 2, source_id: "test-location", destination_id: "other-location", occurred_at: "2026-10-09T09:37:26Z", note: "Transport" },
    ], count: 3 } });
    return route.fulfill({ json: { rows: [], count: 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  const material = page.locator("#inventory-stock-panel > div > section").first().getByRole("combobox", { name: "Bezeichnung", exact: true });
  await expect(material).toBeVisible();
  await expect(material).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Buchungen", exact: true })).toHaveCount(0);
  const value = await material.locator("option").last().getAttribute("value");
  expect(value).toBeTruthy();
  await material.selectOption(value!);
  await expect(page.getByRole("table", { name: "Buchungen", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  const bookings = page.getByRole("table", { name: "Buchungen", exact: true });
  await expect(bookings).toContainText("Anlieferung");
  await expect(bookings.getByRole("columnheader", { name: "Gebucht von", exact: true })).toBeVisible();
  await expect(bookings.getByRole("columnheader", { name: "Gebucht am", exact: true })).toBeVisible();
  await expect(bookings).toContainText("Bernd Klos");
  await expect(bookings).toContainText("09:37:26");
  await expect(bookings).toContainText("Inventur · INV 001");
  await expect(bookings).not.toContainText("525ebe5c-92e5-40d2-a5b8-28892576d623");
  await bookings.getByText("Inventur · INV 001", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Inventur [525ebe5c-92e5-40d2-a5b8-28892576d623]: INV 001");
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).first().click();
  const filterBounds = await material.boundingBox();
  expect(filterBounds!.height).toBeGreaterThanOrEqual(48);
  if (!mobile) expect(filterBounds!.width).toBeGreaterThanOrEqual(400);
  const directionColors = [];
  for (const direction of ["Eingang", "Ausgang", "Umbuchung"]) {
    await expect(bookings.getByText(direction, { exact: true })).toBeVisible();
    const indicator = bookings.locator(`[title="${direction}"]`);
    await expect(indicator.locator("svg")).toHaveCount(1);
    directionColors.push(await indicator.evaluate((node) => getComputedStyle(node).color));
  }
  expect(new Set(directionColors).size).toBe(3);
  await bookings.locator("tbody tr").first().getByText("Anlieferung", { exact: true }).click();
  const movementDetails = page.getByRole("dialog");
  await expect(movementDetails).toContainText("Buchungsdetails");
  await expect(movementDetails).toContainText("Anlieferung");
  await expect(movementDetails).toContainText("Bernd Klos");
  await expect(movementDetails).toContainText("09:37:26");
  await movementDetails.getByRole("button", { name: "Schließen", exact: true }).first().click();
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await page.getByRole("table", { name: "Bestand je Lagerort", exact: true }).locator("tbody tr").first().press("Enter");
  await expect(page.getByRole("dialog")).toContainText("55");
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).first().click();
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  await bookings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/booking-directions-${mobile}-${test.info().project.name}.png` });
  await expect(bookings.getByRole("columnheader", { name: "Bezeichnung", exact: true })).toBeVisible();
  await expect(bookings.getByRole("columnheader", { name: "Material", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Buchungen", exact: true }).locator("xpath=ancestor::section[1]")).toHaveClass(/panel/);
  await expect(page.locator(".analytics-summary-grid")).toHaveCount(0);
  await expect(bookings).not.toContainText("1924d8ca-0781-42e3-98cf-3aa69fcc1f90");
  await expect(bookings).not.toContainText("2026-10-09T07:37:26Z");
  await bookings.getByRole("searchbox", { name: "Filter: Buchungsgrund", exact: true }).fill("Anlieferung");
  const reads = statusReads;
  await page.getByRole("tab", { name: "Materialstammdaten", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Materialstammdaten", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
  await expect(material).toBeVisible();
  await expect(material).toHaveValue(value!);
  expect(statusReads).toBe(reads);
  await expect(bookings.getByRole("searchbox", { name: "Filter: Buchungsgrund", exact: true })).toHaveValue("Anlieferung");
  const options = await material.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ id: (node as HTMLOptionElement).value, name: node.textContent ?? "" })).filter((row) => row.id));
  await page.route("**/api/operations?entity=material_details**", (route) => route.fulfill({ json: { rows: options.map((row) => ({ ...row, revision: 1 })), count: options.length } }));
  const materialTable = page.getByRole("table", { name: "Beschaffung", exact: true });
  await expect(materialTable).toHaveCount(0);
  await expect(bookings.locator("tbody")).toContainText(options.find((row) => row.id === value)!.name);
  await expect(page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Beschaffung", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Lagerbuchung", exact: true });
  await expect(dialog).toContainText(options.find((row) => row.id === value)!.name);
  await expect(dialog.getByRole("combobox", { name: "Bezeichnung", exact: true })).toHaveValue(value!);
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("tab", { name: "Bestandsübersicht", exact: true }).click();
  await material.selectOption("");
  await expect(page.getByRole("table", { name: "Lagerbestandsübersicht", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Speichern", exact: true })).toBeDisabled();
  const bookingMaterial = dialog.getByRole("combobox", { name: "Bezeichnung", exact: true });
  await bookingMaterial.selectOption(value!);
  await expect(dialog).toContainText(options.find((row) => row.id === value)!.name);
  await expect(material).toHaveValue("");
  await page.screenshot({ path: `test-results/global-booking-${mobile}-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await material.selectOption(value!);
  const overviewBounds = await page.getByRole("heading", { name: "Bestandsübersicht", exact: true }).boundingBox();
  expect(overviewBounds!.x + overviewBounds!.width).toBeLessThanOrEqual(mobile ? 390 : 1440);
  await expect(page.getByText("Materialbestand, Lagerorte, Ein- und Ausgänge sowie Einkaufsbelege zentral verwalten.", { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/material-return-${mobile}-${test.info().project.name}.png`, fullPage: true });
});

for (const mobile of [false, true]) test(`Spaltenfilter kombinieren alle Lieferantenseiten ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  const rows = Array.from({ length: 55 }, (_, i) => ({ id: `supplier-${i}`, company: `Supplier ${i}`, supplier_number: `S-${i}`, phone: `+46${i}`, email: i === 54 ? "target@example.test" : "other@example.test", revision: 1 }));
  await page.route("**/api/operations?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("entity") === "stock_status") return route.fulfill({ json: { active: true } });
    const p = Number(params.get("page") ?? 0);
    return route.fulfill({ json: { rows: params.get("entity") === "suppliers" ? rows.slice(p * 50, p * 50 + 50) : [], count: params.get("entity") === "suppliers" ? rows.length : 0 } });
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await expect(page.getByRole("button", { name: "Beschaffung", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("searchbox")).toHaveCount(7);
  for (const input of await table.getByRole("searchbox").all()) await expect(input).toHaveValue("");
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("Supplier 5");
  await table.getByRole("searchbox", { name: "Filter: E-Mail", exact: true }).fill("target");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody")).toContainText("Supplier 54");
  await table.locator("tbody tr td").nth(1).click();
  await expect(page.getByRole("dialog", { name: "Lieferanten", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Unternehmen", { exact: true })).toHaveValue("Supplier 54");
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await table.locator("tbody tr").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Lieferanten", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("missing");
  await expect(table.locator("tbody")).toContainText("Keine Einträge");
  await table.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true }).fill("");
  await expect(table.locator("tbody")).toContainText("Supplier 54");
  await page.screenshot({ path: `test-results/master-table-${mobile}-${test.info().project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [
    { id: "order-1", order_number: "B-100", supplier_id: "supplier-54", status: "received", order_date: "2026-10-08", expected_delivery: "2026-10-10", open_item_count: 0, item_count: 3 },
    { id: "order-2", order_number: "B-200", supplier_id: "supplier-1", status: "draft", order_date: "2026-10-09", open_item_count: 2, item_count: 2 },
  ], count: 2 } }));
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await expect(table.getByRole("searchbox")).toHaveCount(6);
  await table.getByRole("searchbox", { name: "Filter: Lieferant", exact: true }).fill("Supplier 54");
  await table.getByRole("searchbox", { name: "Filter: Bestelldatum", exact: true }).fill("8.10.2026");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody")).toContainText("B-100");
  await expect(table.locator("tbody")).not.toContainText("B-200");
  await page.screenshot({ path: `test-results/order-table-${mobile}-${test.info().project.name}.png` });
});
