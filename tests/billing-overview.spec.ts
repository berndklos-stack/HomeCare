import { expect, test } from "@playwright/test";
import { billingCurrencyTotals, billingTabCounts, selectBillingRows, type BillingOverviewRow } from "../lib/billingOverview";

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
  await page.route("**/api/vehicle-positions", route => route.fulfill({ json: { data: [] } }));
  await page.addInitScript(() => {
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
