import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-updated-at", "2026-10-23T08:00:00Z");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "customer-layout": {} }));
    const base = { company: "", contact: "Testkontakt", email: "layout@example.invalid", phone: "+46 123456789", phone2: "", address: "Nybro", language: "Deutsch", portalLoginEmail: "layout@example.invalid", portalPassword: "", portalLoginHistory: [], notes: "", reportMailBody: "", createdAt: "2026-10-23T08:00:00Z" };
    localStorage.setItem("kolaretorp-customers", JSON.stringify([
      { ...base, id: "LAYOUT-C1", name: "Alpha Kunde", personalNumber: "001", objects: [], balance: "0 SEK", portalStatus: "aktiv" },
      { ...base, id: "LAYOUT-C2", name: "Beta Ansprechpartner", company: "Beta Logistik und Spedition mit langem Firmennamen", personalNumber: "002", objects: ["LAYOUT-O"], balance: "1.250 SEK", portalStatus: "einladen" },
      { ...base, id: "LAYOUT-C3", name: "Gamma Kunde", email: "langekundenadresse@example.invalid", personalNumber: "003", objects: ["LAYOUT-O"], balance: "50 SEK", portalStatus: "aktiv" },
    ]));
    localStorage.setItem("kolaretorp-objects", JSON.stringify([{ id: "LAYOUT-O", name: "Projekt mit laengerem Namen", owner: "Beta Ansprechpartner", ownerCustomerId: "LAYOUT-C2", ownerEmail: "", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "Nybro", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, status: "aktiv", type: "Projekt", access: { keySafe: "", alarm: "", parking: "", notes: "" }, equipment: [], utilities: { heating: "", water: "", septic: "", internet: "" }, risks: [], media: { images: 0, documents: 0, floorPlans: 0, items: [] }, nextVisit: "", lastVisit: "" }]));
    localStorage.setItem("kolaretorp-portal-messages", JSON.stringify([
      ...Array.from({ length: 12 }, (_, index) => ({ id: `LAYOUT-M-${index}`, customerId: "LAYOUT-C1", objectId: "", subject: `Nachricht ${index}`, message: "Nachrichteninhalt", createdAt: "2026-10-23T08:00:00Z", status: "gelesen", deliveryStatus: "gesendet" })),
      { id: "LAYOUT-M-G", customerId: "LAYOUT-C3", objectId: "LAYOUT-O", subject: "Gamma Nachricht", message: "Inhalt", createdAt: "2026-10-23T08:00:00Z", status: "gelesen", deliveryStatus: "gesendet" },
    ]));
  });
});

for (const width of [320, 390, 820, 1024, 1440]) test(`Kundenspalten und Kommunikationsvorschau bleiben buendig bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-customers").click();
  const rows = page.locator(".customer-table-list > article");
  await expect(rows).toHaveCount(3);
  const positions = await rows.evaluateAll(rows => rows.map(row => {
    const selectors = [".customer-row-main > div", ".customer-row-main > span:nth-child(2)", ".customer-row-main > span:nth-child(3)", ".row-actions > mark", ".row-actions > button", ".customer-communication-summary > span"];
    return selectors.map(selector => row.querySelector(selector)!.getBoundingClientRect().x);
  }));
  for (const row of positions) for (let column = 0; column < row.length; column++) expect(Math.abs(row[column] - positions[0][column])).toBeLessThan(1);
  for (const row of await rows.all()) {
    const main = (await row.locator(".customer-row-main").boundingBox())!;
    const actions = (await row.locator(":scope > .row-actions").boundingBox())!;
    expect(main.x + main.width <= actions.x + 1 || main.y + main.height <= actions.y + 1).toBe(true);
    expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const mail = (await row.getByRole("button", { name: /^Nachricht .* senden$/ }).boundingBox())!;
    expect(mail.width).toBe(44); expect(mail.height).toBe(44); expect(mail.x + mail.width).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`customers-${width}.png`) });
  const first = rows.first();
  await first.getByRole("button", { name: "Kommunikation 12", exact: true }).click();
  await expect(first.locator(".customer-communication-history > section")).toHaveCount(12);
  await first.getByRole("button", { name: "Kommunikation 12", exact: true }).click();
  await first.getByRole("button", { name: "Nachricht Alpha Kunde senden", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nachricht an Kunde", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nachricht schließen", exact: true }).click();
  await first.locator("strong").first().click();
  await expect(page.getByRole("textbox", { name: "Vorname", exact: true })).toHaveValue("Alpha");
});
