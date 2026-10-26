import { expect, test } from "@playwright/test";
import { billingCurrencyTotals, billingTabCounts, selectBillingRows, type BillingOverviewRow } from "../lib/billingOverview";
import { billingDraftError, billingDraftTotals, type BillingDraftEdit } from "../lib/billingDraft";

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
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
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
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Rechnung bearbeiten", exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
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
  const preview = page.getByRole("dialog", { name: "Faktura INV-2", exact: true });
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
