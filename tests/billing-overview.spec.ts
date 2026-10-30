import { expect, test } from "@playwright/test";
import { billingCurrencyTotals, billingTabCounts, selectBillingRows, type BillingOverviewRow } from "../lib/billingOverview";
import { billingDraftError, billingDraftTotals, copyBillingDraft, type BillingDraftEdit } from "../lib/billingDraft";

test("Rechnungskopie uebernimmt nur Entwurfsfelder und erzeugt frische Positionskennungen", () => {
  const source = { customerId: "C", objectId: "O", invoiceDate: "2025-01-01", dueDate: "2025-02-01", serviceDate: "2025-01-01", notes: "Hinweis", invoiceNumber: "ALT-123", invoiceStatus: "bezahlt", paidAt: "2025-02-01", jobId: "JOB-ALT", revision: 9, lines: [{ id: "ALT-L", revision: 8, kind: "Leistung" as const, name: "Montage", quantity: "2", unit: "h", unitPrice: "100", taxRate: "25", currency: "SEK", articleNumber: "SVC-1", comment: "Kommentar", discountPercent: "10" }] };
  const before = JSON.stringify(source);
  const result = copyBillingDraft(source, "2026-10-29", "2026-11-28");
  expect(result).toMatchObject({ customerId: "C", invoiceDate: "2026-10-29", dueDate: "2026-11-28", serviceDate: "" });
  for (const key of ["invoiceNumber", "invoiceStatus", "paidAt", "jobId", "revision"]) expect(result).not.toHaveProperty(key);
  expect(result.lines[0]).toMatchObject({ articleNumber: "SVC-1", comment: "Kommentar", discountPercent: "10" });
  expect(result.lines[0].id).not.toBe("ALT-L"); expect(result.lines[0]).not.toHaveProperty("revision");
  expect(JSON.stringify(source)).toBe(before);
});
import { overlayPendingFinancialMutations, prepareFinancialMutations } from "../lib/financialSync";

test("Positionskommentar bleibt bei erneutem Serverabgleich offline erhalten", () => {
  const before = [{ id: "I", revision: 1, lines: [{ id: "L", revision: 1, comment: "Alt" }] }];
  const planned = prepareFinancialMutations(before, [{ ...before[0], lines: [{ ...before[0].lines[0], comment: "Neu", articleNumber: "ART-1", discountPercent: "10" }] }]);
  expect(planned.mutations).toHaveLength(1);
  expect(overlayPendingFinancialMutations(before, planned.mutations)[0].lines).toMatchObject([{ comment: "Neu", articleNumber: "ART-1", discountPercent: "10" }]);
});

test("Entwurfsvalidierung weist ungueltige Daten, Zahlen und gemischte Waehrungen ab", () => {
  const draft: BillingDraftEdit = { customerId: "C", objectId: "O", invoiceDate: "2026-10-25", dueDate: "2026-11-25", serviceDate: "", notes: "", lines: [{ id: "L", kind: "Leistung", name: "Montage", quantity: "1,5", unit: "h", unitPrice: "100", taxRate: "25", currency: "SEK" }] };
  expect(billingDraftError(draft)).toBeNull();
  expect(billingDraftError({ ...draft, objectId: "" })).toBeNull();
  expect(billingDraftError({ ...draft, customerId: "", objectId: "" })).toBe("customer");
  expect(billingDraftTotals(draft.lines).gross).toBe(187.5);
  expect(billingDraftTotals([{ ...draft.lines[0], quantity: "1", unitPrice: "0.035", taxRate: "25" }])).toMatchObject({ net: 0.04, tax: 0.01, gross: 0.05 });
  expect(billingDraftError({ ...draft, invoiceDate: "2026-02-31" })).toBe("date");
  expect(billingDraftError({ ...draft, invoiceDate: "2026-99-99" })).toBe("date");
  expect(billingDraftError({ ...draft, dueDate: "2026-01-01" })).toBe("date");
  expect(billingDraftError({ ...draft, lines: [] })).toBe("lines");
  expect(billingDraftError({ ...draft, lines: [{ ...draft.lines[0], quantity: "12abc" }] })).toBe("lines");
  expect(billingDraftError({ ...draft, lines: [...draft.lines, { ...draft.lines[0], id: "L2", currency: "EUR" }] })).toBe("currency");
  expect(billingDraftTotals([{ ...draft.lines[0], quantity: "2", unitPrice: "150", discountPercent: "10" }])).toMatchObject({ net: 270, tax: 67.5, gross: 337.5 });
  for (const discountPercent of ["-1", "101", "NaN", "10abc"]) expect(billingDraftError({ ...draft, lines: [{ ...draft.lines[0], discountPercent }] })).toBe("lines");
});

const base: BillingOverviewRow = { id: "a", number: "INV-2", customerNumber: "001", customer: "Alpha", project: "Terrasse", invoiceDate: "2026-10-20", dueDate: "2026-11-20", status: "entwurf", amount: 125, currency: "SEK", transferStatus: "nicht gesendet", category: "service", searchText: "Montage" };
const rows = [base, { ...base, id: "b", number: "INV-10", status: "gebucht", amount: 250 }, { ...base, id: "c", status: "überfällig", currency: "EUR" }, { ...base, id: "d", status: "bezahlt" }, { ...base, id: "e", status: "storniert", amount: 999 }];
const filter = { tab: "all" as const, query: "", status: "all", category: "all", transfer: "all", sort: "number" as const, descending: false };

test("Drei Rechnungsbereiche trennen Entwuerfe, offene und abgeschlossene Rechnungen", () => {
  expect(billingTabCounts(rows)).toEqual({ drafts: 1, unpaid: 2, all: 5 });
  expect(selectBillingRows(rows, { ...filter, tab: "unpaid" }).map(row => row.id)).toEqual(["c", "b"]);
  expect(selectBillingRows(rows, { ...filter, tab: "drafts" })).toEqual([base]);
});
test("Summen bleiben je Waehrung getrennt und ignorieren Stornos und ungueltige Betraege", () => {
  expect(billingCurrencyTotals([...rows, { ...base, amount: NaN }])).toEqual([["EUR", 125], ["SEK", 500]]);
  expect(rows[0]).toEqual(base);
});
test("Suche, Kategorie, Status, Uebergabe und numerische Sortierung kombinieren sich", () => {
  expect(selectBillingRows(rows, { ...filter, query: " terrasse ", status: "gebucht", category: "service", transfer: "nicht gesendet" }).map(row => row.number)).toEqual(["INV-10"]);
  expect(selectBillingRows(rows, { ...filter, query: "001", tab: "drafts" })).toEqual([base]);
  expect(selectBillingRows(rows, { ...filter, category: "material" })).toEqual([]);
  expect(selectBillingRows(rows, { ...filter, descending: true })[0].number).toBe("INV-10");
});

test.beforeEach(async ({ page }) => {
  page.on("pageerror", error => { throw error; });
  await page.route("**/api/vehicle-positions", route => route.fulfill({ json: { data: [] } }));
  await page.addInitScript(() => {
    if (localStorage.getItem("billing-overview-fixture")) return;
    localStorage.setItem("billing-overview-fixture", "1");
    localStorage.setItem("kolaretorp-updated-at", "2026-10-25T08:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "billing-test": {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Musterhandwerk Demo", organizationNumber: "DEMO-001", currency: "SEK", countryCode: "SE", address: "Demo-Werkstatt", email: "firma@example.invalid", logoUrl: "", logoStoragePath: "" }));
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "BILL-C", name: "Testkunde Handwerk", personalNumber: "002", company: "", contact: "Demo", email: "kunde@example.invalid", language: "Deutsch", objects: ["BILL-O"], balance: "0 SEK", portalStatus: "einladen", portalLoginHistory: [], notes: "", createdAt: "2026-10-25T08:00:00Z" }]));
    localStorage.setItem("kolaretorp-objects", JSON.stringify([{ id: "BILL-O", name: "Terrasse Seeblick", type: "Projekt", ownerCustomerId: "BILL-C", owner: "Testkunde Handwerk", status: "aktiv", address: "Musterort", region: "Demo", customFields: {}, media: { images: 0, documents: 0, floorPlans: 0, items: [] }, access: {}, utilities: {}, equipment: [], risks: [] }]));
    localStorage.setItem("kolaretorp-jobs", "[]");
    localStorage.setItem("kolaretorp-reports", "[]");
    const common = { customerId: "BILL-C", objectId: "BILL-O", source: "Manuell", label: "Montage", notes: "Demo", status: "abrechenbar", createdAt: "2026-10-25T08:00:00Z", invoiceDate: "2026-10-23", dueDate: "2026-11-06", externalExportStatus: "nicht gesendet", externalExportSystem: "Spiris / Visma Buchhaltung", revision: 1 };
    const line = (id: string, price: string, currency = "SEK", kind = "Leistung") => ({ id, kind, name: kind === "Material" ? "Terrassendielen" : "Montage", quantity: "1", unit: "Stunde", unitPrice: price, taxRate: "25", currency, accountingAccount: "3051", revision: 1 });
    localStorage.setItem("kolaretorp-billing", JSON.stringify([
      { ...common, id: "BILL-DRAFT", invoiceNumber: "INV-1", invoiceStatus: "entwurf", amount: "1250", lines: [line("LINE-1", "1000")] },
      { ...common, id: "BILL-ISSUED", invoiceNumber: "INV-2", invoiceStatus: "gebucht", status: "abgerechnet", amount: "2500", invoicedAt: "2026-10-23T08:00:00Z", outgoingBookNumber: "K-2", lines: [{ ...line("LINE-2", "2000", new URL(location.href).searchParams.get("testCurrency") || "SEK"), taxRate: new URL(location.href).searchParams.get("testTax") || "25" }] },
      { ...common, id: "BILL-PAID", invoiceNumber: "INV-3", invoiceStatus: "bezahlt", status: "abgerechnet", amount: "125", paidAt: "2026-10-24T08:00:00Z", lines: [line("LINE-3", "100", "EUR")] },
      { ...common, id: "BILL-OVERDUE", invoiceNumber: "INV-10", invoiceStatus: "gesendet", status: "abgerechnet", dueDate: "2020-01-01", amount: "375", lines: [line("LINE-4", "100"), line("LINE-5", "200", "SEK", "Material")] },
      { ...common, id: "BILL-CANCELLED", invoiceNumber: "INV-4", invoiceStatus: "storniert", cancelledAt: "2026-10-24T08:00:00Z", amount: "125", lines: [line("LINE-6", "100")] },
    ]));
  });
});

for (const width of [320, 390, 820, 1440]) test(`Neue Rechnung vorschauen drucken speichern bearbeiten und loeschen bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  const before = await page.evaluate(() => ({ billing: localStorage.getItem("kolaretorp-billing"), queue: localStorage.getItem("workcore-sync-mutations-v1") }));
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await editor.getByRole("button", { name: "Vorschau", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeVisible(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await editor.getByRole("combobox", { name: "Kunde", exact: true }).selectOption("BILL-C");
  await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Neue Vorschau-Montage");
  await editor.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("100");
  await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
  await editor.getByRole("textbox", { name: "Kommentar", exact: true }).fill("Vorschau-Kommentar");
  await editor.getByRole("button", { name: "Vorschau", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Rechnung Entwurf", exact: true });
  await expect(preview).toContainText("Neue Vorschau-Montage"); await expect(preview).toContainText("Vorschau-Kommentar");
  await expect(preview.locator(".invoice-draft-label")).toHaveText("Entwurf");
  await preview.screenshot({ path: info.outputPath(`invoice-unsaved-preview-${width}.png`) });
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-billing"))).toBe(before.billing);
  expect(await page.evaluate(() => localStorage.getItem("workcore-sync-mutations-v1"))).toBe(before.queue);
  const download = page.waitForEvent("download"); await preview.getByRole("button", { name: "Herunterladen", exact: true }).click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks).toString("latin1");
  expect(pdf).toContain("Utkast / Entwurf"); expect(pdf).toContain("Neue Vorschau-Montage");
  const popup = page.waitForEvent("popup"); await preview.getByRole("button", { name: "Drucken / PDF", exact: true }).click();
  await (await popup).close();
  await expect(preview.getByRole("group", { name: "Dokumentaktionen", exact: true })).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-billing"))).toBe(before.billing);
  await preview.getByRole("button", { name: "Weiter bearbeiten", exact: true }).click();
  await expect(editor.getByRole("textbox", { name: "Kommentar", exact: true })).toHaveValue("Vorschau-Kommentar");
  await editor.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("200");
  await editor.getByRole("button", { name: "Vorschau", exact: true }).click();
  await expect(preview.locator(".invoice-preview-totals")).toContainText("250 SEK");
  await preview.getByRole("button", { name: "Als Entwurf speichern", exact: true }).click();
  await expect(preview).toHaveCount(0); await expect(editor).toHaveCount(0);
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((r: { label: string }) => r.label === "Neue Vorschau-Montage"));
  const saved = await read(); expect(saved.invoiceStatus).toBe("entwurf"); expect(saved.invoicedAt).toBeUndefined();
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Rechnungsvorschau Neue Vorschau-Montage", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entwurf bearbeiten", exact: true }).click();
  await editor.getByRole("textbox", { name: "Menge", exact: true }).fill("2");
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  expect((await read()).amount).toBe("500");
  await page.getByRole("button", { name: "Rechnungsvorschau Neue Vorschau-Montage", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entwurf löschen", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Entwurf löschen?", exact: true });
  await confirmation.getByRole("button", { name: "Abbrechen", exact: true }).click(); expect(await read()).toBeTruthy();
  await page.getByRole("button", { name: "Rechnungsvorschau Neue Vorschau-Montage", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Entwurf löschen", exact: true }).click();
  await confirmation.getByRole("button", { name: "Entwurf löschen", exact: true }).click();
  await expect(confirmation).toHaveCount(0); expect(await read()).toBeUndefined();
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]"));
  expect(queue.some((r: { entityType: string; entityId: string; operation: string }) => r.entityType === "invoice" && r.entityId === saved.id && r.operation === "delete")).toBe(true);
});

for (const invoice of ["INV-1", "INV-2", "INV-3", "INV-4"]) test(`Bestehende Rechnung ${invoice} als unabhaengigen Entwurf kopieren`, async ({ page }) => {
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("tab", { name: "Alle Rechnungen 5", exact: true }).click();
  const original = await page.evaluate((number) => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((r: { invoiceNumber: string }) => r.invoiceNumber === number), invoice);
  await page.getByRole("button", { name: `Details und Aktionen ${invoice}`, exact: true }).click();
  await page.getByRole("button", { name: `Rechnung ${invoice} kopieren`, exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await expect(editor.getByRole("textbox", { name: "Einzelpreis", exact: true })).toHaveValue(original.lines[0].unitPrice);
  await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill(`Kopie ${invoice}`);
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]"));
  const copied = rows.find((r: { label: string }) => r.label === `Kopie ${invoice}`);
  expect(copied.id).not.toBe(original.id); expect(copied.lines[0].id).not.toBe(original.lines[0].id);
  expect(copied).toMatchObject({ invoiceStatus: "entwurf", source: "Manuell", serviceDate: "", customerId: original.customerId });
  for (const key of ["invoiceNumber", "paidAt", "invoicedAt", "outgoingBookNumber", "cancelledAt", "jobId", "reportId"]) expect(copied[key]).toBeUndefined();
  expect(rows.find((r: { id: string }) => r.id === original.id)).toEqual(original);
});

for (const width of [320, 820, 1440]) test(`Kunde und Leistung direkt in Rechnung anlegen und erhalten bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  page.on("dialog", () => { throw new Error("Keine Browserdialoge im Rechnungseditor erwartet"); });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await editor.getByRole("textbox", { name: "Ihre Referenz", exact: true }).fill("Nicht verlieren");
  await editor.getByRole("button", { name: "Neuer Kunde", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Neue Handwerkskundin");
  await dialog.getByRole("textbox", { name: "E-Mail", exact: true }).fill("kunde@example.invalid");
  await dialog.getByRole("textbox", { name: "Adresse", exact: true }).fill("Musterstrasse 2, Musterort");
  await dialog.getByRole("button", { name: "Speichern und übernehmen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editor.getByRole("combobox", { name: "Kunde", exact: true }).locator("option:checked")).toHaveText("Neue Handwerkskundin");
  await expect(editor.getByRole("textbox", { name: "Ihre Referenz", exact: true })).toHaveValue("Nicht verlieren");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await dialog.getByRole("searchbox", { name: "Suche", exact: true }).fill("gibt es noch nicht");
  await expect(dialog.getByRole("status")).toContainText("Keine passenden");
  await dialog.getByRole("button", { name: "Neue Leistung", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Fensterreinigung mit langer vollstaendiger Leistungsbezeichnung");
  await dialog.getByRole("textbox", { name: "Kategorie", exact: true }).fill("Reinigung");
  await dialog.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("ungültig");
  await dialog.getByRole("button", { name: "Speichern und übernehmen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("gültigen Preis");
  await dialog.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("396,50");
  await dialog.getByRole("button", { name: "Speichern und übernehmen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editor.getByRole("textbox", { name: "Einzelpreis", exact: true })).toHaveValue("396.5");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await dialog.getByRole("searchbox", { name: "Suche", exact: true }).fill("Fensterreinigung mit langer");
  const match = dialog.getByRole("button", { name: /Fensterreinigung mit langer/ });
  await expect(match).toBeVisible();
  expect((await dialog.boundingBox())!.height).toBeLessThan(750);
  expect(await match.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
  await dialog.screenshot({ path: info.outputPath(`article-selection-${width}.png`) });
  await match.click();
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const data = await page.evaluate(() => ({ customers: JSON.parse(localStorage.getItem("kolaretorp-customers") || "[]"), services: JSON.parse(localStorage.getItem("kolaretorp-services") || "[]"), billing: JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]") }));
  const customer = data.customers.find((row: { name: string }) => row.name === "Neue Handwerkskundin");
  const service = data.services.find((row: { name: string }) => row.name.startsWith("Fensterreinigung mit langer"));
  expect(customer.address).toBe("Musterstrasse 2, Musterort");
  expect(service.category).toBe("Reinigung");
  expect(data.billing.find((row: { customerId: string }) => row.customerId === customer.id).lines[0]).toMatchObject({ articleNumber: service.id, unitPrice: "396.5" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Artikelwahl uebernimmt Leistung und Material aus den Stammdaten ohne Kommentarverlust", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-services", JSON.stringify([{ id: "ART-SERVICE", name: "Montagestunde", unit: "h", price: "80", currency: "SEK", taxRate: "25", category: "Montage", description: "", checklist: [] }]));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([{ id: "MAT-ART", sku: "WOOD-42", name: "Kantholz", unit: "m", price: "12,50", currency: "SEK", taxRate: "25", category: "Holz", description: "" }]));
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
  await editor.getByRole("textbox", { name: "Kommentar", exact: true }).fill("Bleibt erhalten");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Montagestunde/ }).click();
  await expect(editor.getByRole("textbox", { name: "Bezeichnung", exact: true })).toHaveValue("Montagestunde");
  await expect(editor.getByRole("textbox", { name: "Einzelpreis", exact: true })).toHaveValue("80");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Kantholz/ }).click();
  await expect(editor.getByRole("combobox", { name: "Art", exact: true })).toHaveValue("Material");
  await expect(editor.getByRole("textbox", { name: "Einzelpreis", exact: true })).toHaveValue("12.5");
  await expect(editor.getByRole("textbox", { name: "Kommentar", exact: true })).toHaveValue("Bleibt erhalten");
  await editor.getByRole("combobox", { name: "Währung", exact: true }).selectOption("EUR");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Kantholz/ })).toHaveCount(0);
});

for (const width of [320, 390, 820, 1440]) test(`Visma-Kopfdaten, Positionskommentar und Rabatt bleiben in Entwurf und PDF bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await editor.getByRole("combobox", { name: "Kunde", exact: true }).selectOption("BILL-C");
  await editor.getByRole("textbox", { name: "Ihre Referenz", exact: true }).fill("Anna Referenz");
  await editor.getByRole("textbox", { name: "Unsere Referenz", exact: true }).fill("Paul Referenz");
  await editor.getByRole("textbox", { name: "Ihre Bestellreferenz", exact: true }).fill("PO-123");
  await editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
  await page.getByText("Eigene Artikelnummer", { exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Artikelnummer", exact: true }).fill("ART-42");
  await page.getByRole("dialog").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Montage Kommentar");
  await editor.getByRole("textbox", { name: "Menge", exact: true }).fill("2");
  await editor.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("150");
  await editor.getByRole("textbox", { name: "Rabatt %", exact: true }).fill("10");
  await editor.getByRole("button", { name: "Kommentar zu Position 1", exact: true }).click();
  await editor.getByRole("textbox", { name: "Kommentar", exact: true }).fill("Montage am Nebeneingang\nNach Kundenfreigabe");
  await expect(editor.locator(".billing-editor-totals")).toContainText("337,50 SEK");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await editor.screenshot({ path: info.outputPath(`invoice-fields-${width}.png`) });
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Details und Aktionen Montage Kommentar", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung Montage Kommentar bearbeiten", exact: true }).click();
  await expect(editor.getByRole("textbox", { name: "Kommentar", exact: true })).toHaveValue("Montage am Nebeneingang\nNach Kundenfreigabe");
  await expect(editor.getByRole("textbox", { name: "Unsere Referenz", exact: true })).toHaveValue("Paul Referenz");
  await expect(editor.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true })).toHaveAttribute("title", "Montage Kommentar (ART-42)");
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("button", { name: "Details und Aktionen Montage Kommentar", exact: true }).click();
  const event = page.waitForEvent("download"); await page.getByRole("button", { name: "Rechnung Montage Kommentar als PDF herunterladen", exact: true }).click();
  const stream = await (await event).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks).toString("latin1");
  for (const text of ["Montage am Nebeneingang", "Nach Kundenfreigabe", "ART-42", "Anna Referenz", "Paul Referenz", "PO-123"]) expect(pdf).toContain(text);
  await page.getByRole("button", { name: "Rechnungsvorschau Montage Kommentar", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Montage am Nebeneingang");
});

for (const width of [320, 390, 820, 1440]) test(`Manuelle Rechnung ohne Auftrag oder Objekt mit PDF, Reload und Buchung bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  const originalJobs = await page.evaluate(() => localStorage.getItem("kolaretorp-jobs"));
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await editor.getByRole("combobox", { name: "Kunde", exact: true }).selectOption("BILL-C");
  await expect(editor.getByRole("combobox", { name: "Projekt / Objekt", exact: true })).toHaveValue("");
  await editor.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Montage manuell");
  await editor.getByRole("textbox", { name: "Menge", exact: true }).fill("2");
  await editor.getByRole("textbox", { name: "Einzelpreis", exact: true }).fill("150");
  await expect(editor.locator(".billing-editor-totals")).toContainText("375,00 SEK");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await editor.screenshot({ path: info.outputPath(`manual-invoice-${width}.png`) });
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  const readManual = () => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((row: { id: string }) => row.id.startsWith("BIL-MANUAL-")));
  const created = await readManual();
  expect(created).toMatchObject({ objectId: "", customerId: "BILL-C", invoiceStatus: "entwurf", amount: "375" });
  expect(created.jobId).toBeUndefined(); expect(created.reportId).toBeUndefined(); expect(created.invoiceNumber).toBeUndefined();
  const mutations = await page.evaluate(() => JSON.parse(localStorage.getItem("workcore-sync-mutations-v1") || "[]"));
  expect(mutations.some((row: { entityType: string; entityId: string; operation: string }) => row.entityType === "invoice" && row.entityId === created.id && row.operation === "create")).toBe(true);
  expect(mutations.some((row: { entityType: string; resourceId: string }) => row.entityType === "invoice_line" && row.resourceId === created.id)).toBe(true);
  await page.getByRole("button", { name: "Details und Aktionen Montage manuell", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung Montage manuell buchen", exact: true }).click();
  await expect(page.getByText("Die Rechnungsnummer ist noch nicht bestätigt. Bitte zuerst synchronisieren und den Entwurf danach buchen.", { exact: true })).toBeVisible();
  expect((await readManual()).invoiceStatus).toBe("entwurf");
  const pdfEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Rechnung Montage manuell als PDF herunterladen", exact: true }).click();
  const download = await pdfEvent;
  expect(download.suggestedFilename()).toContain("Entwurf");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks).toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect(pdf).toContain("Testkunde Handwerk"); expect(pdf).toContain("Montage manuell");
  await page.getByRole("button", { name: "Rechnungsvorschau Montage manuell", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Testkunde Handwerk");
  await expect(page.getByRole("dialog")).not.toContainText("Objekt fehlt");
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  expect((await readManual()).id).toBe(created.id);
  await page.getByRole("button", { name: "Details und Aktionen Montage manuell", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung Montage manuell bearbeiten", exact: true }).click();
  await expect(editor.getByRole("textbox", { name: "Bezeichnung", exact: true })).toHaveValue("Montage manuell");
  await expect(editor.getByRole("combobox", { name: "Projekt / Objekt", exact: true })).toHaveValue("");
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  // Simuliert die Nummern-Rueckmeldung der bestehenden Finanz-Synchronisierung.
  await page.evaluate(id => {
    const rows = JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]");
    localStorage.setItem("kolaretorp-billing", JSON.stringify(rows.map((row: { id: string }) => row.id === id ? { ...row, invoiceNumber: "INV-2026-999" } : row)));
  }, created.id);
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Details und Aktionen INV-2026-999", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung INV-2026-999 buchen", exact: true }).click();
  expect((await readManual()).invoiceStatus).toBe("gebucht");
  expect((await readManual()).outgoingBookNumber).toBeTruthy();
  await page.getByRole("tab", { name: "Unbezahlte Rechnungen 3", exact: true }).click();
  const details = page.getByRole("button", { name: "Details und Aktionen INV-2026-999", exact: true });
  if (await details.getAttribute("aria-expanded") !== "true") await details.click();
  const sieEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "SIE-Datei für Rechnung INV-2026-999 für Spiris erstellen", exact: true }).click();
  expect((await sieEvent).suggestedFilename()).toContain("Spiris-SIE-INV-2026-999");
  expect((await readManual()).externalExportStatus).toBe("nicht gesendet");
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-jobs"))).toBe(originalJobs);
});

test("Neue manuelle Rechnung abbrechen erzeugt keinen leeren Datensatz", async ({ page }) => {
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  const before = await page.evaluate(() => localStorage.getItem("kolaretorp-billing"));
  await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
  await page.getByRole("textbox", { name: "Bezeichnung", exact: true }).fill("Nicht speichern");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Änderungen verwerfen", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-billing"))).toBe(before);
});

for (const width of [320, 390, 820, 1440]) test(`Entwurf bearbeiten, Summen und Speichern bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  await page.getByRole("button", { name: "Details und Aktionen INV-1", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung INV-1 bearbeiten", exact: true }).click();
  const editor = page.getByRole("region", { name: "Rechnung bearbeiten", exact: true });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await editor.getByLabel("Menge", { exact: true }).fill("2,5");
  await editor.getByLabel("Einzelpreis", { exact: true }).fill("120");
  await editor.getByRole("textbox", { name: "Notizen", exact: true }).fill("Montage nach Absprache");
  await expect(editor.locator(".billing-editor-totals")).toContainText("375,00 SEK");
  await editor.getByRole("button", { name: "Position hinzufügen", exact: true }).click();
  await expect(editor.locator("fieldset")).toHaveCount(2);
  await editor.getByRole("button", { name: "Position entfernen 2", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await editor.getByRole("button").all()) { const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); }
  await page.screenshot({ path: info.outputPath(`billing-editor-${width}.png`), fullPage: true });
  await editor.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const invoice = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((row: { id: string }) => row.id === "BILL-DRAFT"));
  expect(invoice.invoiceNumber).toBe("INV-1");
  expect(invoice.invoiceStatus).toBe("entwurf");
  expect(invoice.lines[0].quantity).toBe("2,5");
  expect(invoice.lines[0].accountingAccount).toBe("3051");
  expect(Number(invoice.amount)).toBe(375);
  expect(invoice.notes).toBe("Montage nach Absprache");
});

test("Abbrechen behaelt Original; gebuchte Rechnung hat keine Bearbeitungsaktion", async ({ page }) => {
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  const original = await page.evaluate(() => localStorage.getItem("kolaretorp-billing"));
  await page.getByRole("button", { name: "Details und Aktionen INV-1", exact: true }).click();
  await page.getByRole("button", { name: "Rechnung INV-1 bearbeiten", exact: true }).click();
  await page.getByRole("textbox", { name: "Notizen", exact: true }).fill("Nicht speichern");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Weiter bearbeiten", exact: true }).click();
  await expect(page.getByRole("region", { name: "Rechnung bearbeiten", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Änderungen verwerfen", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-billing"))).toBe(original);
  await page.getByRole("tab", { name: "Unbezahlte Rechnungen 2", exact: true }).click();
  await page.getByRole("button", { name: "Details und Aktionen INV-2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rechnung INV-2 bearbeiten", exact: true })).toHaveCount(0);
});

for (const width of [320, 390, 820, 1440]) test(`Rechnungsuebersicht mit Filtern und Details bleibt sauber bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-billing").click();
  await expect(page.getByRole("tab", { name: "Entwürfe 1", exact: true })).toHaveAttribute("aria-selected", "true");
  const entries = page.locator(".billing-ledger-table tbody > tr:not(.billing-ledger-detail)");
  await expect(entries).toHaveCount(1);
  await page.getByRole("tab", { name: "Unbezahlte Rechnungen 2", exact: true }).click(); await expect(entries).toHaveCount(2);
  await page.getByRole("tab", { name: "Alle Rechnungen 5", exact: true }).click(); await expect(entries).toHaveCount(5);
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption("mixed"); await expect(entries).toHaveCount(1);
  await expect(entries).toContainText("INV-10");
  await page.getByRole("combobox", { name: "Kategorie", exact: true }).selectOption("all");
  await page.getByRole("searchbox", { name: "Suche", exact: true }).fill("INV-2"); await expect(entries).toHaveCount(1);
  await page.getByRole("button", { name: "Details und Aktionen INV-2", exact: true }).click();
  await expect(page.locator(".billing-ledger-detail")).toContainText("Kontierung");
  for (const button of await page.locator(".billing-ledger-actions button").all()) { const box = (await button.boundingBox())!; expect(box.width).toBe(44); expect(box.height).toBe(44); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`billing-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Rechnungsvorschau INV-2", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Rechnung INV-2", exact: true });
  await expect(preview).toContainText("Musterhandwerk Demo");
  await expect(preview).not.toContainText("Kolaretorp Service AB");
});

test("SIE-Download markiert keine Uebernahme; Bestaetigung ist bewusst und abbrechbar", async ({ page }) => {
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("tab", { name: "Unbezahlte Rechnungen 2", exact: true }).click();
  await page.getByRole("button", { name: "Details und Aktionen INV-2", exact: true }).click();
  const readInvoice = () => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((row: { id: string }) => row.id === "BILL-ISSUED"));
  const before = await readInvoice();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SIE-Datei für Rechnung INV-2 für Spiris erstellen", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("Spiris-SIE-INV-2");
  expect((await readInvoice()).externalExportStatus).toBe("nicht gesendet");
  const confirm = page.getByRole("button", { name: "Übernahme der Rechnung INV-2 in Spiris bestätigen", exact: true });
  page.once("dialog", dialog => dialog.dismiss()); await confirm.click(); expect((await readInvoice()).externalExportStatus).toBe("nicht gesendet");
  page.once("dialog", dialog => dialog.accept()); await confirm.click();
  await expect.poll(async () => (await readInvoice()).externalExportStatus).toBe("gesendet");
  expect((await readInvoice()).invoiceNumber).toBe(before.invoiceNumber); expect((await readInvoice()).lines).toEqual(before.lines);
});

for (const query of ["testCurrency=EUR", "testTax=12"]) test(`Nicht freigegebene SIE-Faelle brechen ohne Statusaenderung ab: ${query}`, async ({ page }) => {
  await page.goto(`/?${query}`); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true"); await page.getByTestId("nav-billing").click();
  await page.getByRole("tab", { name: "Unbezahlte Rechnungen 2", exact: true }).click();
  await page.getByRole("button", { name: "Details und Aktionen INV-2", exact: true }).click();
  let downloads = 0; page.on("download", () => downloads++);
  await page.getByRole("button", { name: "SIE-Datei für Rechnung INV-2 für Spiris erstellen", exact: true }).click();
  await expect(page.getByText(/Keine SIE-Datei erstellt: Die bestehende Vorlage/)).toBeVisible();
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") || "[]").find((row: { id: string }) => row.id === "BILL-ISSUED").externalExportStatus)).toBe("nicht gesendet");
});

for (const language of ["sv", "en"]) test(`Die neue Rechnungsuebersicht folgt der App-Sprache ${language}`, async ({ page }) => {
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.locator(".app-toolbar-language select").selectOption(language);
  await page.getByTestId("nav-billing").click();
  await expect(page.getByRole("tab", { name: language === "sv" ? "Utkast 1" : "Drafts 1", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: language === "sv" ? "Obetalda kundfakturor 2" : "Unpaid invoices 2", exact: true })).toBeVisible();
});
