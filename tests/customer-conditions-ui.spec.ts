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
  await page.route("**/api/customer-files?**", route => {
    const id = new URL(route.request().url()).searchParams.get("id");
    if (id) return id === "IMG" ? route.fulfill({ contentType: "image/png", body: pixel }) : route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 plan" });
    return route.fulfill({ json: { files: [{ id: "IMG", name: "Haus.jpg", category: "image", jobId: "J1", jobTitle: "Kontrolle Alpha", date: "2026-11-15", source: "/api/customer-files?customerId=C1&id=IMG" }, { id: "DOC", name: "Plan.pdf", category: "document", jobId: "J1", jobTitle: "Kontrolle Alpha", date: "2026-11-15", source: "/api/customer-files?customerId=C1&id=DOC" }] } });
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-customers").click();
  await page.locator(".customer-table-list strong").filter({ hasText: "Alpha Kunde" }).first().click();
  await expect(page.getByRole("textbox", { name: "Vorname", exact: true })).toHaveValue("Alpha");
});

for (const width of [390, 1440]) {
  test(`Kundenseite mit drei Dateigruppen, Inhaltsduplikaten und fehlenden Originalen ${width}px`, async ({ page }, info) => {
    const base = { jobId: "J1", jobTitle: "Kontrolle Alpha", date: "2026-11-15" };
    const entries = [
      { ...base, id: "REPORT", name: "Einsatzbericht.pdf", category: "report", source: "/api/customer-files?customerId=C1&id=REPORT", date: "2026-11-16" },
      { ...base, id: "OLD", name: "image.jpg", category: "image", source: "/api/customer-files?customerId=C1&id=OLD", contentKey: "same-original", date: "2026-08-13" },
      { ...base, id: "COPY", name: "IMG_1523.jpeg", category: "image", source: "/api/customer-files?customerId=C1&id=COPY", contentKey: "same-original", date: "2026-08-13" },
      { ...base, id: "NEW", name: "image.jpg", category: "image", source: "/api/customer-files?customerId=C1&id=NEW", contentKey: "different-original" },
      { ...base, id: "MISSING", name: "Fehlend.jpg", category: "image", source: "/api/customer-files?customerId=C1&id=MISSING", unavailable: true, date: "2026-11-14" },
      { ...base, id: "DOC", name: "Plan.pdf", category: "document", source: "/api/customer-files?customerId=C1&id=DOC" },
    ];
    const requested: string[] = [];
    await page.route("**/api/customer-files?**", route => {
      const id = new URL(route.request().url()).searchParams.get("id");
      if (!id) return route.fulfill({ json: { files: entries } });
      requested.push(id);
      return ["REPORT", "DOC"].includes(id) ? route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4 test" }) : route.fulfill({ contentType: "image/png", body: pixel });
    });
    await page.getByRole("button", { name: "Zurück zur Kundenübersicht", exact: true }).click();
    await page.locator(".customer-table-list strong").filter({ hasText: "Alpha Kunde" }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const files = page.getByRole("region", { name: "Bilder und Dokumente", exact: true });
    await expect(files.locator(".customer-file-row")).toHaveCount(5);
    await expect(files.locator(".customer-file-group h4")).toHaveText(["Einsatzberichte (1)", "Bilder (3)", "Dokumente (1)"]);
    await expect(files.locator(".customer-file-group").nth(1).locator("time")).toHaveText(["15.11.2026", "14.11.2026", "13.8.2026"]);
    await expect(files.getByRole("button", { name: "Herunterladen Fehlend.jpg", exact: true })).toBeDisabled();
    const zipEvent = page.waitForEvent("download");
    await files.getByRole("button", { name: "Alle verfügbaren als ZIP", exact: true }).click();
    const zip = unzipSync(readFileSync((await (await zipEvent).path())!));
    expect(Object.keys(zip)).toHaveLength(4);
    expect(Object.keys(zip).filter(path => path.startsWith("Einsatzberichte/"))).toHaveLength(1);
    expect(requested).not.toContain("MISSING");
    await files.scrollIntoViewIfNeeded();
    for (const row of await files.locator('.customer-file-row').filter({ has: page.getByRole("button", { name: "Herunterladen image.jpg", exact: true }) }).all()) {
      await row.scrollIntoViewIfNeeded();
      await expect.poll(() => row.locator("img").evaluateAll(images => images.length === 1 && (images[0] as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
    expect(await files.locator(".customer-file-row").evaluateAll(rows => rows.every(row => row.getBoundingClientRect().height <= 100))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await files.screenshot({ path: info.outputPath("customer-files-grouped.png") });
    await files.getByText("Plan.pdf", { exact: true }).scrollIntoViewIfNeeded();
    await expect(files.getByRole("button", { name: "Herunterladen Plan.pdf", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("customer-files-page.png") });
    await page.getByTestId("nav-customers").click();
    await expect(page.locator(".customer-editor-workspace")).toHaveCount(0);
    await expect(page.locator(".customer-table-list")).toBeVisible();
  });

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
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Zurück zur Kundenübersicht", exact: true }).click();
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
    await expect(files.locator(".customer-file-name small").filter({ hasText: "Kontrolle Alpha" }).first()).toBeVisible();
    const zipDownload = page.waitForEvent("download");
    await files.getByRole("button", { name: "Alle angezeigten als ZIP", exact: true }).click();
    const zip = await zipDownload;
    expect(zip.suggestedFilename()).toBe("Alpha Kunde.zip");
    const contents = unzipSync(readFileSync((await zip.path())!));
    expect(Object.keys(contents).sort()).toEqual(["Bilder/Kontrolle Alpha-J1/Haus.jpg", "Dokumente/Kontrolle Alpha-J1/Plan.pdf"]);
    expect(Buffer.from(contents["Dokumente/Kontrolle Alpha-J1/Plan.pdf"]).toString()).toBe("%PDF-1.4 plan");
    await files.getByLabel("Kategorie", { exact: true }).selectOption("document");
    await expect(files.getByRole("img")).toHaveCount(0);
    const singleDownload = page.waitForEvent("download");
    await files.getByRole("button", { name: "Herunterladen Plan.pdf", exact: true }).click();
    expect((await singleDownload).suggestedFilename()).toBe("Plan.pdf");
    await files.screenshot({ path: info.outputPath("customer-files.png") });
    expect(await files.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.route("**/api/customer-files?**", route => route.fulfill({ status: 404, json: { error: "Datei fehlt" } }));
    await files.getByRole("button", { name: "Alle angezeigten als ZIP", exact: true }).click();
    await expect(files.getByRole("status")).toContainText("konnte nicht geladen");
  });
}
