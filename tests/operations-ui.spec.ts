import { expect, test, type Page } from "@playwright/test";

const supplier = { id: "11111111-1111-4111-8111-111111111111", supplier_number: "S-1", company: "Test Supplier", revision: 1, archived: false };
async function ready(page: Page) {
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
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
for (const mobile of [false, true]) {
  test(`Lieferantenformular, Abbruch, durable Queue und Modal ${mobile ? "mobil" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await mock(page); await page.goto("/"); await ready(page); await purchasing(page);
    await page.getByRole("button", { name: "Bearbeiten: Test Supplier", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((e) => e.matches(":modal"))).toBe(true);
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

test("Materialbuchung hat Quelle, Ziel und separate idempotente Queue-Aktion", async ({ page }) => {
  await mock(page); await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Lagerbuchung", exact: true }).click();
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
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await page.getByRole("button", { name: "Bestellung absenden", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bestellung absenden", exact: true })).toBeDisabled();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { payload: { kind?: string } }) => m.payload.kind === "order")).toMatchObject([{ expectedRevision: 4, entityId: order.id, payload: { kind: "order" } }]);
});

test("Wartungsbeginn schützt Plan- und Ressourcenrevision gemeinsam", async ({ page }) => {
  await mock(page);
  const plan = { id: "33333333-3333-4333-8333-333333333333", resource_id: "RES-1", name: "Service test", maintenance_type: "service", due_date: "2026-10-08", revision: 3, completed: false, in_progress: false };
  await page.route("**/api/operations?entity=maintenance_plans**", (route) => route.fulfill({ json: { rows: [plan], count: 1 } }));
  await page.route("**/api/operations?entity=resource_details**", (route) => route.fulfill({ json: { rows: [{ id: "RES-1", revision: 7, operating_hours: 100, availability: "available" }], count: 1 } }));
  await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Wartung & Prüfungen", exact: true }).click();
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
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Wartung & Prüfungen", exact: true }).click();
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
  await dialog.getByRole("button", { name: "receipt.pdf", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("receipt.pdf");
});

test("Operations-Lesecache wächst nicht mit Suchanfragen", async ({ page }) => {
  await mock(page); await page.goto("/"); await ready(page); await purchasing(page);
  const search = page.getByRole("searchbox", { name: "Einträge suchen", exact: true });
  for (const value of ["Supplier", "Test", "Another search", ""]) {
    await search.fill(value);
    await expect.poll(() => page.evaluate(() => {
      const key = Object.keys(sessionStorage).find((k) => k.startsWith("workcore-operations-read-page"));
      return key ? JSON.parse(sessionStorage.getItem(key)!).search : null;
    })).toBe(value);
  }
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("workcore-operations")).length)).toBe(1);
});

test("Materialbeschaffung lädt bevorzugte Lieferanten auch ohne Wechsel zum Einkaufsreiter", async ({ page }) => {
  await mock(page);
  await page.route("**/api/operations?entity=material_details**", (route) => route.fulfill({ json: { rows: [{ id: "MAT-TEST", revision: 2, preferred_supplier_id: null }], count: 1 } }));
  await page.goto("/"); await ready(page);
  await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
  await page.getByRole("button", { name: "Bearbeiten: MAT-TEST", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Bevorzugter Lieferant").locator("option").filter({ hasText: "Test Supplier" })).toHaveCount(1);
  await dialog.getByLabel("Bevorzugter Lieferant").selectOption(supplier.id);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") ?? "[]"));
  expect(queue.filter((m: { entityId: string }) => m.entityId === "MAT-TEST")).toMatchObject([{ expectedRevision: 2, payload: { kind: "save", entity: "material_details", values: { preferred_supplier_id: supplier.id } } }]);
});

test("Wareneingangshistorie zeigt Teillieferungen nur der ausgewählten Position", async ({ page }) => {
  await mock(page);
  const order = { id: "22222222-2222-4222-8222-222222222222", order_number: "PO-1", status: "partially_received", revision: 4 };
  const item = { id: "55555555-5555-4555-8555-555555555555", order_id: order.id, material_id: "MAT-1", quantity: 10, unit_price: 5, revision: 1 };
  await page.route("**/api/operations?entity=purchase_orders**", (route) => route.fulfill({ json: { rows: [order], count: 1 } }));
  await page.route("**/api/operations?entity=purchase_order_items**", (route) => route.fulfill({ json: { rows: [item], count: 1 } }));
  await page.route("**/api/operations?entity=purchase_receipts**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("parent")).toBe(item.id);
    return route.fulfill({ json: { rows: [{ id: "receipt-1", quantity: 4, occurred_at: "2026-10-08T06:00:00Z", note: "First partial delivery", actor_user_id: "user" }], count: 1 } });
  });
  await page.goto("/"); await ready(page); await purchasing(page);
  await page.getByRole("button", { name: "Bestellungen", exact: true }).click();
  await page.locator("article").filter({ has: page.getByText("PO-1", { exact: true }) })
    .getByRole("button", { name: "Positionen", exact: true }).click();
  await page.getByRole("button", { name: "Wareneingänge", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("First partial delivery", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Menge: 4", { exact: true })).toBeVisible();
});
