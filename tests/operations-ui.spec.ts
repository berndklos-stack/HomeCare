import { expect, test, type Page } from "@playwright/test";
import { jsPDF } from "jspdf";

for (const mobile of [false, true]) {
  test(`Lieferschein aus Bestelluebersicht in App ansehen ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await mock(page);
    const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-PDF", status: "received", revision: 4 };
    await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
    await page.route("**/api/operations?entity=purchase_receipts**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("order")).toBe(order.id); expect(params.has("parent")).toBe(false);
      return route.fulfill({ json: { rows: [
        { id: "receipt", quantity: 55, material: { name: "Kantholz 45x95", unit: "Stk" }, occurred_at: "2026-10-09T07:37:26Z", actor_user_id: "secret-user-id", document: { name: "note.pdf", storage_path: "tenant/purchase-documents/note.pdf" } },
        { id: "receipt-2", quantity: 4442, material: { name: "Latten 28 x 38", unit: "Stk" }, occurred_at: "2026-10-09T07:37:26Z", document: { name: "note.pdf", storage_path: "tenant/purchase-documents/note.pdf" } },
      ], count: 2 } });
    });
    const pdf = new jsPDF(); pdf.text("Delivery note", 20, 20);
    let fail = true;
    await page.route("**/api/private-media?**", (route) => fail ? route.fulfill({ status: 503 }) : route.fulfill({ contentType: "application/pdf", body: Buffer.from(pdf.output("arraybuffer")) }));
    await page.goto("/"); await ready(page); await purchasing(page);
    await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
    await page.getByRole("row").filter({ has: page.getByText("PO-PDF", { exact: true }) }).getByRole("button", { name: "Lieferscheine", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "note.pdf", exact: true })).toHaveCount(1);
    await expect(dialog.getByText("Kantholz 45x95", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Latten 28 x 38", { exact: true })).toBeVisible();
    await expect(dialog).not.toContainText("secret-user-id");
    await expect(dialog).not.toContainText("T07:37");
    await page.screenshot({ path: `test-results/delivery-list-${mobile}-${test.info().project.name}.png` });
    await dialog.getByRole("button", { name: "note.pdf", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    fail = false;
    await dialog.getByRole("button", { name: "note.pdf", exact: true }).click();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
    await expect(dialog.locator("iframe")).toBeVisible();
    await dialogLayout(page);
    await page.screenshot({ path: `test-results/order-pdf-${mobile}-${test.info().project.name}.png` });
    await dialog.getByRole("button", { name: "Zurück zum Lieferverlauf" }).click();
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "note.pdf", exact: true })).toBeVisible();
  });
}

const supplier = { id: "11111111-1111-4111-8111-111111111111", supplier_number: "S-1", company: "Test Supplier", revision: 1, archived: false };
async function ready(page: Page) {
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
}
async function dialogLayout(page: Page, maxHeight?: number) {
  const dialog = page.getByRole("dialog");
  const dimensions = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const header = element.querySelector("header")!.getBoundingClientRect();
    const close = element.querySelector("header button")!.getBoundingClientRect();
    return { height: bounds.height, right: bounds.right, left: bounds.left, top: bounds.top, bottom: bounds.bottom,
      closeRight: close.right, closeTop: close.top, headerTop: header.top, viewport: innerWidth, viewportHeight: innerHeight };
  });
  expect(dimensions.left).toBeGreaterThanOrEqual(12);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport - 12);
  expect(dimensions.top).toBeGreaterThanOrEqual(12);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight - 12);
  expect(dimensions.right - dimensions.closeRight).toBeLessThanOrEqual(24);
  expect(Math.abs(dimensions.closeTop - dimensions.headerTop)).toBeLessThanOrEqual(2);
  if (maxHeight) expect(dimensions.height).toBeLessThan(maxHeight);
}
async function mock(page: Page) {
  // Never let the E2E auth bypass contact production Operations tables.
  await page.route("**/api/operations?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const entity = params.get("entity");
    if (entity === "stock_status") return route.fulfill({ json: { active: true } });
    if (entity === "stock_balances") return route.fulfill({ json: { rows: [] } });
    const rows = entity === "suppliers" ? [supplier] : [];
    await route.fulfill({ json: { rows, count: rows.length, page: 0 } });
  });
  await page.route("**/api/sync-mutations", (route) => route.fulfill({ status: 503, json: { error: "OFFLINE_TEST" } }));
}
async function purchasing(page: Page) {
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Lieferanten & Einkauf", exact: true }).click();
  await expect(page.getByText("Test Supplier", { exact: true })).toBeVisible();
}
async function openMaintenance(page: Page) {
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page.getByRole("button", { name: "Zuweisungen, Ausstattung & Wartung", exact: true }).click();
  await page.getByRole("button", { name: "Wartung & Prüfungen", exact: true }).click();
}
for (const mobile of [false, true]) {
  test(`Lieferantenliste zeigt Kontaktdaten und direkte Links ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mock(page);
    await page.route("**/api/operations?entity=suppliers**", (route) => route.fulfill({ json: { rows: [
      { ...supplier, phone: "+46 (0) 70 123 45 67", email: "info@example.se", address: "Testgatan 1\n123 45 Stockholm", vat_number: "SE123456789001", payment_terms: "30 dagar" },
      { ...supplier, id: "44444444-4444-4444-8444-444444444444", company: "No contact supplier", supplier_number: "S-2", phone: "", email: "  ", address: "" },
    ], count: 2 } }));
    await page.route("**/api/operations?entity=supplier_contacts**", (route) => route.fulfill({ json: { rows: [
      { id: "55555555-5555-4555-8555-555555555555", supplier_id: supplier.id, name: "Test Contact", phone: "+46 70 999 88 77", email: "contact@example.se", role: "Service", revision: 1 },
      { id: "66666666-6666-4666-8666-666666666666", supplier_id: supplier.id, name: "No details contact", phone: "", email: "", role: "" },
    ], count: 2 } }));
    await page.goto("/"); await ready(page); await purchasing(page);
    const row = page.getByRole("row").filter({ hasText: "Test Supplier" });
    await expect(row.getByRole("link", { name: "Telefon: +46 (0) 70 123 45 67", exact: true })).toHaveAttribute("href", "tel:+460701234567");
    await expect(row.getByRole("link", { name: "E-Mail: info@example.se", exact: true })).toHaveAttribute("href", "mailto:info%40example.se");
    await expect(row).toContainText("Testgatan 1");
    await expect(row).toContainText("123 45 Stockholm");
    await expect(row).toContainText("S-1");
    await expect(row).toContainText("SE123456789001");
    await expect(row).toContainText("30 dagar");
    await expect(row.getByRole("button", { name: "Kontakte", exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "No contact supplier" }).getByRole("link")).toHaveCount(0);
    await page.screenshot({ path: `test-results/supplier-contacts-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row.getByRole("button", { name: "Kontakte", exact: true }).click();
    const contact = page.getByRole("row").filter({ hasText: "Test Contact" });
    await expect(contact.getByRole("link", { name: "Telefon: +46 70 999 88 77", exact: true })).toHaveAttribute("href", "tel:+46709998877");
    await expect(contact.getByRole("link", { name: "E-Mail: contact@example.se", exact: true })).toHaveAttribute("href", "mailto:contact%40example.se");
    await expect(contact).toContainText("Service");
    await expect(contact.getByRole("button", { name: "Bearbeiten: Test Contact", exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "No details contact" }).getByRole("link")).toHaveCount(0);
    await page.screenshot({ path: `test-results/supplier-contact-details-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const mobile of [false, true]) {
  test(`Lieferantenformular, Abbruch, durable Queue und Modal ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mock(page); await page.goto("/"); await ready(page); await purchasing(page);
    await page.getByRole("button", { name: "Bearbeiten: Test Supplier", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((e) => e.matches(":modal"))).toBe(true);
    await dialogLayout(page);
    await page.screenshot({ path: `test-results/supplier-form-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    await dialog.getByLabel("Unternehmen", { exact: true }).fill("Cancelled change");
    await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(page.getByText("Cancelled change")).toHaveCount(0);
    await page.getByRole("button", { name: "Neu", exact: true }).click();
    await dialog.getByLabel("Lieferantennummer", { exact: true }).fill("S-2");
    await dialog.getByLabel("Unternehmen", { exact: true }).fill("Offline Supplier");
    await page.context().setOffline(true);
    await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { entityType: string }) => m.entityType === "operations"));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ operation: "create", payload: { kind: "save", entity: "suppliers", values: { company: "Offline Supplier" } } });
    await page.context().setOffline(false); await page.reload(); await ready(page); await purchasing(page);
    await expect(page.getByRole("status").filter({ hasText: "Offline Supplier" })).toBeVisible();
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { entityType: string }) => m.entityType === "operations"));
    expect(restored[0].id).toBe(saved[0].id);
    await page.screenshot({ path: `test-results/operations-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("Lageraktionen stehen oben und Materialfilter ist leerbar", async ({ page }) => {
  await mock(page); await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  const filter = page.getByLabel("Material", { exact: true });
  await expect(filter).toBeVisible();
  const original = await filter.inputValue();
  const master = await page.getByRole("button", { name: "Materialstammdaten", exact: true }).boundingBox();
  const stock = await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).boundingBox();
  expect(master!.y).toBeLessThan(stock!.y);
  await filter.selectOption("");
  await expect(filter).toHaveValue("");
  await expect(page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true })).toBeEnabled();
  await filter.selectOption(original);
  await expect(page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true })).toBeEnabled();
});

test("Materialbuchung hat Quelle, Ziel und separate idempotente Queue-Aktion", async ({ page }) => {
  await mock(page); await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Allgemeine Lagerbuchung", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nach Standort", { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("Menge", { exact: true }).fill("5");
  await dialog.getByLabel("Buchungsgrund", { exact: true }).fill("Delivery test");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { payload: { kind?: string } }) => m.payload.kind === "stock")).toHaveLength(1);
});

test("Bestellung absenden verwendet die aktuelle Revision und sperrt doppelte Aktionen", async ({ page }) => {
  await mock(page);
  const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-1", supplier_id: supplier.id, status: "draft", revision: 4 };
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
  const actions: string[] = [];
  await page.route("**/api/purchase-orders/send", (route) => {
    const request = route.request().postDataJSON();
    actions.push(request.action);
    expect(request).toMatchObject({ orderId: order.id, revision: 4 });
    return route.fulfill({ json: request.action === "preview" ? { to: "supplier@example.se", subject: "Bestellung PO-1", body: "Test order", token: "snapshot-token" } : { sent: true } });
  });
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await page.getByRole("button", { name: "Bestellung absenden", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("supplier@example.se");
  await dialogLayout(page, 480);
  await page.screenshot({ path: `test-results/order-preview-${test.info().project.name}.png` });
  expect(actions).toEqual(["preview"]);
  await page.getByRole("dialog").getByRole("button", { name: "Bestellung per E-Mail senden", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bestellung absenden", exact: true })).toBeDisabled();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { payload: { kind?: string } }) => m.payload.kind === "order")).toMatchObject([{ expectedRevision: 4, entityId: order.id, payload: { kind: "order" } }]);
  expect(actions).toEqual(["preview", "send"]);
});

test("Bestellvorschau: Abbruch und fehlgeschlagener Versand ändern keinen Bestellstatus", async ({ page }) => {
  await mock(page);
  const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-FAIL", status: "draft", revision: 4 };
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
  let sends = 0;
  await page.route("**/api/purchase-orders/send", (route) => {
    if (route.request().postDataJSON().action === "preview") return route.fulfill({ json: { to: "supplier@example.se", subject: "PO-FAIL", body: "Preview", token: "token" } });
    sends++;
    return route.fulfill({ status: 502, json: { error: "MAIL_FAILED" } });
  });
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await page.getByRole("button", { name: "Bestellung absenden", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).last().click();
  expect(sends).toBe(0);
  await page.getByRole("button", { name: "Bestellung absenden", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Bestellung per E-Mail senden", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Versand nicht bestätigt");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((mutation: { payload: { kind?: string } }) => mutation.payload.kind === "order"))).toHaveLength(0);
});

test("Wartungsbeginn schützt Plan- und Ressourcenrevision gemeinsam", async ({ page }) => {
  await mock(page);
  const plan = { id: "33333333-3333-4333-8333-333333333333", resource_id: "RES-1", name: "Service test", maintenance_type: "service", due_date: "2026-10-08", revision: 3, completed: false, in_progress: false };
  await page.route("**/api/operations?entity=maintenance_plans**", (route) => route.fulfill({ json: { rows: [plan], count: 1 } }));
  await page.route("**/api/operations?entity=resource_details**", (route) => route.fulfill({ json: { rows: [{ id: "RES-1", revision: 7, operating_hours: 100, availability: "available" }], count: 1 } }));
  await page.goto("/"); await ready(page);
  await openMaintenance(page);
  await page.getByRole("button", { name: "Wartung beginnen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wartung beginnen", exact: true })).toBeDisabled();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { payload: { kind?: string } }) => m.payload.kind === "start")).toMatchObject([{ expectedRevision: 3, resourceId: "RES-1", payload: { kind: "start", resource_revision: 7 } }]);
});

test("Offline-Lieferant wird nach Wiederverbindung genau einmal bestätigt und bleibt nach Reload gespeichert", async ({ page }) => {
  await mock(page);
  const received: { id: string; entityId: string; payload: { values: Record<string, unknown> } }[] = [];
  await page.route("**/api/sync-mutations", async (route) => {
    const mutation = route.request().postDataJSON();
    if (mutation.entityType !== "operations") return route.fulfill({ json: { status: "synced", mutationId: mutation.id, record: { id: mutation.entityId, ...mutation.payload, revision: (mutation.expectedRevision ?? 0) + 1 } } });
    received.push(mutation);
    await route.fulfill({ json: { status: "synced", mutationId: mutation.id, record: { id: mutation.entityId, ...mutation.payload.values, revision: 1 } } });
  });
  await page.route("**/api/operations?entity=suppliers**", (route) => {
    const rows = [supplier, ...received.map((m) => ({ ...m.payload.values, id: m.entityId, revision: 1 }))];
    return route.fulfill({ json: { rows, count: rows.length } });
  });
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lieferantennummer", { exact: true }).fill("S-OFFLINE");
  await dialog.getByLabel("Unternehmen", { exact: true }).fill("Reconnect Supplier");
  await page.context().setOffline(true);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((m: { entityType: string }) => m.entityType === "operations").id);
  expect(received).toHaveLength(0);
  // Reconnection enables the existing application queue; all Operations traffic
  // remains intercepted and the API rejects unmocked E2E writes independently.
  await page.route("**/api/live-positions**", (route) => route.fulfill({ json: { positions: [] } }));
  await page.context().setOffline(false);
  await expect.poll(() => received.length, { timeout: 15000 }).toBe(1);
  expect(received[0].id).toBe(id);
  await expect.poll(() => page.evaluate((mutationId) => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((m: { id: string }) => m.id === mutationId)?.status, id)).toBe("synced");
  await expect(page.getByText("Reconnect Supplier", { exact: true })).toBeVisible();
  await page.reload(); await ready(page); await purchasing(page);
  await expect(page.getByText("Reconnect Supplier", { exact: true })).toBeVisible();
  expect(received).toHaveLength(1);
  expect(await page.evaluate((mutationId) => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").find((m: { id: string }) => m.id === mutationId)?.status, id)).toBe("synced");
});

async function maintenance(page: Page) {
  const plan = { id: "33333333-3333-4333-8333-333333333333", resource_id: "RES-1", name: "Service test", maintenance_type: "service", revision: 3, completed: false };
  await mock(page);
  await page.route("**/api/operations?entity=maintenance_plans**", (route) => route.fulfill({ json: { rows: [plan], count: 1 } }));
  await page.goto("/"); await ready(page);
  await openMaintenance(page);
}

test("Wartungsbeleg: fehlgeschlagener Upload, Wiederholen mit gleicher ID und Abschlussreferenz", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await maintenance(page);
  const uploads: string[] = [];
  await page.route("**/api/media", async (route) => {
    const body = route.request().postDataBuffer()!.toString();
    const id = body.match(/name="mediaId"\r\n\r\n([^\r]+)/)![1];
    expect(body).toContain("resource-documents");
    uploads.push(id);
    if (uploads.length === 1) return route.fulfill({ status: 500, json: { error: "SIMULATED_FAILURE" } });
    return route.fulfill({ json: { id, path: `tenant/resource-documents/by-id/${id}-receipt.pdf` } });
  });
  await page.getByRole("button", { name: "Wartung abschließen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Beleg hochladen", { exact: true }).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("test document") });
  await expect(dialog.getByText(/Upload fehlgeschlagen/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Speichern", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Upload wiederholen", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Beleg hochgeladen");
  expect(uploads).toHaveLength(2); expect(uploads[0]).toBe(uploads[1]);
  await expect(dialog.getByLabel("Dokumentreferenz")).toHaveValue(uploads[0]);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { payload: { kind: string } }) => m.payload.kind === "complete")).toMatchObject([{ expectedRevision: 3, payload: { document_id: uploads[0] } }]);
});

test("Abbruch während Beleg-Upload erzeugt keine Wartungsmutation und keinen veralteten Formularwert", async ({ page }) => {
  await maintenance(page);
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/media", async (route) => {
    await pending;
    await route.fulfill({ json: { id: "old-upload", path: "tenant/resource-documents/old" } }).catch(() => {});
  });
  await page.getByRole("button", { name: "Wartung abschließen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Beleg hochladen", { exact: true }).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("test") });
  await expect(dialog.getByRole("status")).toContainText("Beleg wird hochgeladen");
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  release();
  await page.getByRole("button", { name: "Wartung abschließen", exact: true }).click();
  await expect(dialog.getByLabel("Dokumentreferenz")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Speichern", exact: true })).toBeEnabled();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { entityType: string }) => m.entityType === "operations")).toHaveLength(0);
});

test("Wartungshistorie lädt nur den ausgewählten Plan und bietet einen privaten Beleg-Download", async ({ page }) => {
  await maintenance(page);
  await page.route("**/api/operations?entity=maintenance_events**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("parent")).toBe("33333333-3333-4333-8333-333333333333");
    return route.fulfill({ json: { rows: [{ id: "event", completed_date: "2026-10-08", cost: 500, currency: "SEK", actor_user_id: "user", notes: "Inspected", document: { name: "receipt.pdf", storage_path: "tenant/resource-documents/receipt.pdf" } }], count: 1 } });
  });
  await page.route("**/api/private-media?**", (route) => route.fulfill({ contentType: "application/pdf", body: "private receipt" }));
  await page.getByRole("button", { name: "Wartungsverlauf", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Inspected", { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download: receipt.pdf", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("receipt.pdf");
});

test("Operations-Lesecache wächst nicht mit Suchanfragen", async ({ page }) => {
  await mock(page); await page.goto("/"); await ready(page); await purchasing(page);
  const search = page.getByRole("searchbox", { name: "Filter: Unternehmen", exact: true });
  for (const value of ["Supplier", "Test", "Another search", ""]) {
    await search.fill(value);
    await expect(search).toHaveValue(value);
  }
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("workcore-operations")).length)).toBe(1);
});

test("Materialbeschaffung lädt bevorzugte Lieferanten auch ohne Wechsel zum Einkaufsreiter", async ({ page }) => {
  await mock(page);
  await page.route("**/api/operations?entity=material_details**", (route) => route.fulfill({ json: { rows: [{ id: "MAT-TEST", revision: 2, preferred_supplier_id: null }], count: 1 } }));
  await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByLabel("Material", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Bearbeiten: MAT-TEST", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Bevorzugter Lieferant").locator("option").filter({ hasText: "Test Supplier" })).toHaveCount(1);
  await dialog.getByLabel("Bevorzugter Lieferant").selectOption(supplier.id);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { entityId: string }) => m.entityId === "MAT-TEST")).toMatchObject([{ expectedRevision: 2, payload: { kind: "save", entity: "material_details", values: { preferred_supplier_id: supplier.id } } }]);
});

for (const mobile of [false, true]) {
 test(`Bestellübersicht und Positionsdetails ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await mock(page);
  const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-DETAIL", supplier_id: supplier.id, status: "partially_received", revision: 4, order_date: "2026-10-08", expected_delivery: "2026-10-15", item_count: 2, open_item_count: 1, currency: "SEK" };
  const items = [
    { id: "55555555-5555-4555-8555-555555555555", order_id: order.id, material_id: "MAT-1", quantity: 10, received_quantity: 4, unit_price: 5, revision: 1 },
    { id: "66666666-6666-4666-8666-666666666666", order_id: order.id, material_id: "MAT-2", quantity: 20, received_quantity: 20, unit_price: 3, revision: 1 },
  ];
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
  await page.route("**/api/operations?entity=purchase_order_items**", (route) => route.fulfill({ json: { rows: items, count: 2 } }));
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  const summary = page.getByRole("row").filter({ hasText: "PO-DETAIL" });
  await expect(summary).toContainText("Test Supplier");
  await expect(summary).toContainText("8.10.2026");
  await expect(summary).toContainText("15.10.2026");
  await expect(summary).toContainText("1 / 2");
  await summary.getByRole("button", { name: "Positionen", exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["Position", "Bestellt", "Geliefert", "Offen", "WE-Menge"]);
  await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveText(["10", "4", "6", ""]);
  await expect(table.getByRole("row").nth(2).getByRole("cell")).toHaveText(["20", "20", "0", "—"]);
  await table.getByRole("button").first().focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(dialog).toContainText("Einzelpreis");
  await expect(dialog).toContainText("50 SEK");
  await dialogLayout(page, 420);
  await expect(dialog.getByRole("button", { name: "Lieferverlauf", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Bearbeiten", exact: true })).toHaveCount(0);
  await page.screenshot({ path: `test-results/purchase-item-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png` });
  await dialog.getByRole("button", { name: "Wareneingang", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Menge", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(table).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 });
}

test("Wareneingangshistorie zeigt Teillieferungen nur der ausgewählten Position", async ({ page }) => {
  await mock(page);
  const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-1", status: "partially_received", revision: 4 };
  const item = { id: "55555555-5555-4555-8555-555555555555", order_id: order.id, material_id: "MAT-1", quantity: 10, unit_price: 5, revision: 1 };
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
  await page.route("**/api/operations?entity=purchase_order_items**", (route) => route.fulfill({ json: { rows: [item], count: 1 } }));
  await page.route("**/api/operations?entity=purchase_receipts**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("parent")).toBe(item.id);
    return route.fulfill({ json: { rows: [{ id: "receipt-1", quantity: 4, occurred_at: "2026-10-08T06:00:00Z", note: "First partial delivery", actor_user_id: "user",
      document: { name: "delivery.pdf", storage_path: "tenant/purchase-documents/delivery.pdf" } }], count: 1 } });
  });
  await page.route("**/api/private-media?**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("path")).toBe("tenant/purchase-documents/delivery.pdf");
    return route.fulfill({ contentType: "application/pdf", body: "private delivery note" });
  });
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await page.getByRole("row").filter({ has: page.getByText("PO-1", { exact: true }) })
    .getByRole("button", { name: "Positionen", exact: true }).click();
  await page.getByRole("table").getByRole("button").first().click();
  await page.getByRole("button", { name: "Lieferverlauf", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("First partial delivery", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Menge: 4", { exact: true })).toBeVisible();
  await dialogLayout(page, 420);
  await page.screenshot({ path: `test-results/receipt-history-${test.info().project.name}.png` });
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Download: delivery.pdf", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("delivery.pdf");
});

for (const mobile of [false, true]) {
  test(`Archivierungsdialog bleibt kompakt und Abbruch unverändert ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mock(page); await page.goto("/"); await ready(page); await purchasing(page);
    await page.getByRole("button", { name: "Archivieren: Test Supplier", exact: true }).click();
    await dialogLayout(page, 300);
    await page.getByRole("dialog").getByRole("button", { name: "Schließen", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Test Supplier", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { entityType: string }) => m.entityType === "operations"))).toHaveLength(0);
  });
}

for (const mobile of [false, true]) {
  test(`Sammel-Wareneingang: Auswahl, Teilmengen, Lagerort und Foto-PDF ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mock(page);
    await page.addInitScript(() => {
      const original = window.fetch;
      window.fetch = async (...args) => {
        const body = args[1]?.body;
        if (body instanceof FormData && body.get("scope") === "purchase-documents") {
          const file = body.get("file") as File;
          sessionStorage.setItem("test-receipt-pdf", JSON.stringify({ name: file.name, size: file.size, type: file.type, header: await file.slice(0, 5).text() }));
        }
        return original(...args);
      };
    });
    const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-BATCH", status: "partially_received", revision: 4 };
    const items = [
      { id: "55555555-5555-4555-8555-555555555555", order_id: order.id, material_id: "MAT-1", quantity: 10, received_quantity: 4, unit_price: 5 },
      { id: "66666666-6666-4666-8666-666666666666", order_id: order.id, material_id: "MAT-2", quantity: 20, received_quantity: 0, unit_price: 3 },
      { id: "77777777-7777-4777-8777-777777777777", order_id: order.id, material_id: "MAT-3", quantity: 1, received_quantity: 1, unit_price: 1 },
    ];
    await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
    await page.route("**/api/operations?entity=purchase_order_items**", (route) => route.fulfill({ json: { rows: items, count: 3 } }));
    let documentId = "";
    await page.route("**/api/media", async (route) => {
      const raw = route.request().postDataBuffer()!.toString("latin1");
      expect(raw).toContain('filename="delivery.pdf"'); expect(raw).toContain("Content-Type: application/pdf");
      // WebKit's intercepted postData omits binary file parts; check the actual
      // outgoing FormData File in-page as well, rather than treating that as data loss.
      if (test.info().project.name !== "webkit") expect(raw).toContain("%PDF-");
      expect(raw).toContain("purchase-documents");
      documentId = raw.match(/name="mediaId"\r\n\r\n([^\r]+)/)![1];
      await route.fulfill({ json: { id: documentId, path: `tenant/purchase-documents/${documentId}.pdf` } });
    });
    await page.goto("/"); await ready(page); await purchasing(page);
    await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "PO-BATCH" }).getByRole("button", { name: "Positionen", exact: true }).click();
    const table = page.getByRole("table");
    const checkboxes = table.getByRole("checkbox");
    await expect(checkboxes.nth(3)).toBeDisabled();
    await checkboxes.nth(1).check(); await expect(checkboxes.first()).toHaveJSProperty("indeterminate", true);
    await checkboxes.first().check();
    const quantities = table.getByRole("spinbutton");
    await expect(quantities.nth(0)).toHaveValue("6"); await expect(quantities.nth(1)).toHaveValue("20");
    await quantities.nth(0).fill("7");
    await page.getByLabel("Standort", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Ausgewählte Wareneingänge buchen (2)", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "gültige Mengen" })).toBeVisible();
    await quantities.nth(0).fill("2.5");
    const png = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 200;
      const context = canvas.getContext("2d")!; context.fillStyle = "#111"; context.fillRect(10, 10, 80, 180); return canvas.toDataURL("image/png").split(",")[1]; });
    await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "delivery.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
    await expect(page.getByRole("status").filter({ hasText: "Beleg hochgeladen" })).toBeVisible();
    const pdf = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-receipt-pdf")!));
    expect(pdf).toMatchObject({ name: "delivery.pdf", type: "application/pdf", header: "%PDF-" });
    expect(pdf.size).toBeGreaterThan(1000);
    await expect(page.locator('input[capture="environment"]')).toHaveAttribute("accept", "image/*");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/receipt-batch-${mobile ? "mobile" : "desktop"}-${test.info().project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Ausgewählte Wareneingänge buchen (2)", exact: true }).click();
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { payload: { kind: string } }) => m.payload.kind === "receive_batch"));
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entityId: order.id, expectedRevision: 4, payload: { document_id: documentId,
      items: [{ item_id: items[0].id, quantity: 2.5 }, { item_id: items[1].id, quantity: 20 }] } });
    await expect(page.getByRole("button", { name: "Ausgewählte Wareneingänge buchen (2)", exact: true })).toBeDisabled();
    await page.context().setOffline(false); await page.reload(); await ready(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]").filter((m: { payload: { kind: string } }) => m.payload.kind === "receive_batch").map((m: { id: string }) => m.id))).toEqual([queued[0].id]);
  });
}
