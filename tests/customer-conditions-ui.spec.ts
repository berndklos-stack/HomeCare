import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: info.title.includes("390px") ? 390 : 1440, height: 1000 });
  await page.route("**/api/vehicle-positions**", route => route.fulfill({ json: { data: [] } }));
  await page.addInitScript(() => {
    if (localStorage.getItem("customer-work-fixture")) return;
    localStorage.setItem("customer-work-fixture", "1");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "C1", name: "Alpha Kunde", contact: "Alpha", email: "alpha@example.invalid", phone: "", address: "Nybro", language: "Deutsch", objects: ["O1"], portalLoginHistory: [], portalStatus: "aktiv", balance: "0 SEK", notes: "", serviceConditions: [] }]));
    localStorage.setItem("kolaretorp-objects", JSON.stringify([{ id: "O1", name: "Haus Alpha", owner: "Alpha Kunde", ownerCustomerId: "C1", ownerEmail: "alpha@example.invalid", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, status: "aktiv", type: "Objekt", access: {}, equipment: [], utilities: {}, risks: [], media: { images: 0, documents: 0, floorPlans: 0, items: [] }, nextVisit: "", lastVisit: "" }]));
    localStorage.setItem("kolaretorp-services", JSON.stringify([{ id: "S1", name: "Hauskontrolle", category: "Betreuung", unit: "Stunde", price: "450", currency: "SEK", taxRate: "25", accountingAccount: "3041", description: "", checklist: [], archived: false }]));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{ id: "J1", objectId: "O1", customerId: "C1", title: "Kontrolle Alpha", status: "in Arbeit", priority: "normal", dueDate: "2026-11-15", assignedTo: "Demo", type: "Sonstiges", description: "", schedule: { type: "einmalig" }, checklist: [] }]));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{ id: "R1", jobId: "J1", objectId: "O1", title: "Kontrollbericht", date: "2026-11-15", visibleToCustomer: true, summary: "Alles gut", internalNotes: "", media: [], customerComment: "", attachments: [{ id: "DOC", name: "Plan.pdf", storagePath: "tenant/plan.pdf", type: "application/pdf", size: 20, createdAt: "2026-11-15T12:00:00Z" }], checklistResults: [{ id: "T1", title: "Kontrolle", meta: "", description: "", completed: true, minutes: 15, note: "", photos: [{ id: "IMG", name: "Haus.jpg", storagePath: "tenant/haus.jpg", accepted: true }] }] }]));
  });
  await page.route("**/api/private-media?**", route => route.request().url().includes("haus.jpg") ? route.fulfill({ contentType: "image/png", body: pixel }) : route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 plan" }));
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-customers").click();
  await page.locator(".customer-table-list strong").filter({ hasText: "Alpha Kunde" }).first().click();
  await expect(page.getByRole("textbox", { name: "Vorname", exact: true })).toHaveValue("Alpha");
});

for (const width of [390, 1440]) {
  test(`Kundenpreise und direkte Leistungsanlage ${width}px`, async ({ page }, info) => {
    const terms = page.getByRole("region", { name: "Leistungen und Konditionen", exact: true });
    await terms.getByLabel("Leistung auswählen", { exact: true }).selectOption("S1");
    await terms.getByRole("button", { name: "Zuordnen", exact: true }).click();
    await expect(terms.getByLabel("Kundenpreis netto", { exact: true })).toHaveValue("450");
    await terms.getByLabel("Stammdatenpreis", { exact: true }).uncheck();
    await terms.getByLabel("Kundenpreis netto", { exact: true }).fill("396");
    await terms.getByLabel("Kundenpreis netto", { exact: true }).blur();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-customers") || "[]")[0].serviceConditions?.[0]?.unitPrice)).toBe("396");
    await terms.getByRole("button", { name: "Neue Leistung", exact: true }).click();
    await terms.getByLabel("Bezeichnung", { exact: true }).fill("Winterkontrolle");
    await terms.getByLabel("Kategorie", { exact: true }).fill("Betreuung");
    await terms.getByLabel("Stammdatenpreis netto", { exact: true }).fill("300");
    await terms.getByRole("button", { name: "Anlegen und zuordnen", exact: true }).click();
    await expect(terms.getByText("Winterkontrolle", { exact: true })).toBeVisible();
    await terms.screenshot({ path: info.outputPath("customer-terms.png") });
    expect(await terms.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width > 700) {
      const price = (await terms.getByLabel("Kundenpreis netto", { exact: true }).first().boundingBox())!;
      const currency = (await terms.locator(".customer-condition-row > span").first().boundingBox())!;
      expect(price.x + price.width).toBeLessThanOrEqual(currency.x);
    }
    await page.getByRole("button", { name: "Schließen", exact: true }).click();
    await page.getByTestId("nav-billing").click();
    await page.getByRole("button", { name: "Neue Rechnung", exact: true }).click();
    await page.getByLabel("Kunde", { exact: true }).selectOption("C1");
    await page.getByRole("button", { name: "Artikel wählen zu Position 1", exact: true }).click();
    await page.getByRole("button", { name: /Hauskontrolle.*396 SEK/ }).click();
    await expect(page.getByLabel("Einzelpreis", { exact: true })).toHaveValue("396");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-services") || "[]").find((item: { id: string }) => item.id === "S1").price)).toBe("450");
  });

  test(`Dateien nach Auftrag und Kategorie als ZIP oder einzeln laden ${width}px`, async ({ page }, info) => {
    const files = page.getByRole("region", { name: "Bilder und Dokumente", exact: true });
    await files.scrollIntoViewIfNeeded();
    await expect(files.getByRole("img", { name: "Haus.jpg", exact: true })).toBeVisible();
    await expect(files.getByRole("heading", { name: "Kontrolle Alpha", exact: true })).toBeVisible();
    const zipDownload = page.waitForEvent("download");
    await files.getByRole("button", { name: "Alle angezeigten als ZIP", exact: true }).click();
    const zip = await zipDownload;
    expect(zip.suggestedFilename()).toBe("Alpha Kunde.zip");
    const contents = unzipSync(readFileSync((await zip.path())!));
    expect(Object.keys(contents).sort()).toEqual(["Kontrolle Alpha-J1/Bilder/Haus.jpg", "Kontrolle Alpha-J1/Dokumente/Plan.pdf"]);
    expect(Buffer.from(contents["Kontrolle Alpha-J1/Dokumente/Plan.pdf"]).toString()).toBe("%PDF-1.4 plan");
    await files.getByLabel("Kategorie", { exact: true }).selectOption("document");
    await expect(files.getByRole("img")).toHaveCount(0);
    const singleDownload = page.waitForEvent("download");
    await files.getByRole("button", { name: "Herunterladen Plan.pdf", exact: true }).click();
    expect((await singleDownload).suggestedFilename()).toBe("Plan.pdf");
    await files.screenshot({ path: info.outputPath("customer-files.png") });
    expect(await files.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.route("**/api/private-media?**", route => route.fulfill({ status: 404, json: { error: "Datei fehlt" } }));
    await files.getByRole("button", { name: "Alle angezeigten als ZIP", exact: true }).click();
    await expect(files.getByRole("status")).toContainText("konnte nicht geladen");
  });
}
