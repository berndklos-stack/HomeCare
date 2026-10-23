import { expect, test, type Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const object = { id: "OBJ-LAYOUT", name: "Layout Projekt", owner: "Testkunde", ownerCustomerId: "CUS-LAYOUT", ownerEmail: "customer@example.invalid", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "Nybro", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, status: "aktiv", type: "Projekt", access: { keySafe: "", alarm: "", parking: "", notes: "" }, equipment: [], utilities: { heating: "", water: "", septic: "", internet: "" }, risks: [], media: { images: 0, documents: 0, floorPlans: 0, items: [] }, nextVisit: "", lastVisit: "" };
    const job = { id: "JOB-LAYOUT", objectId: object.id, customerId: "CUS-LAYOUT", title: "Auftrag mit vollstaendiger Kommunikationsleiste", status: "in Arbeit", priority: "hoch", dueDate: "2026-10-22", description: "Beschreibung", assignedTo: "Bernd Klos", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [], consulting: { enabled: true, hourlyRate: "800", currency: "SEK", openEnded: true, entries: [] } };
    localStorage.setItem("kolaretorp-objects", JSON.stringify([object]));
    localStorage.setItem("kolaretorp-customers", JSON.stringify([{ id: "CUS-LAYOUT", name: "Testkunde", language: "Deutsch", email: "customer@example.invalid", phone: "", contacts: [], objects: [object.id], portalLoginHistory: [] }]));
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([job, { ...job, id: "JOB-OFFER-LAYOUT", title: "Offerte mit Kommunikationsleiste", status: "offerte", consulting: undefined }]));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{ id: "REPORT-LAYOUT", jobId: job.id, objectId: object.id, title: "LAYOUT Bericht mit laengerer Ueberschrift", date: "2026-10-22", sentAt: "2026-10-22T10:00:00Z", summary: "Berichtstext", media: [], customerComment: "", checklistResults: [] }]));
  });
});

async function checkStrip(group: Locator, width: number) {
  const controls = group.locator(":scope > button, :scope > a");
  await expect(controls).toHaveCount(5);
  const bounds = await controls.evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  expect(Math.max(...bounds.map(box => box.y)) - Math.min(...bounds.map(box => box.y))).toBeLessThan(1);
  for (const box of bounds) {
    expect(box.width).toBe(44); expect(box.height).toBe(44);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
}

for (const width of [320, 390, 820, 1024, 1440]) {
  test(`Bericht: gebuendelte Aktionen und einheitliche Werkzeuge bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: /^1 Berichte$/ }).click();
    await page.getByRole("button", { name: /LAYOUT Bericht mit laengerer Ueberschrift/ }).first().click();
    const header = page.locator(".report-detail-header");
    await checkStrip(header.getByRole("group", { name: "Dokumentaktionen" }), width);
    const tools = header.locator(".report-record-actions > button");
    await expect(tools).toHaveCount(3);
    for (const tool of await tools.all()) { const box = (await tool.boundingBox())!; expect(box.width).toBe(44); expect(box.height).toBe(44); }
    const heading = (await header.locator("h2").boundingBox())!, actions = (await header.locator(".report-detail-communication").boundingBox())!;
    expect(heading.x + heading.width <= actions.x + 1 || heading.y + heading.height <= actions.y + 1).toBe(true);
    const share = (await header.getByRole("group", { name: "Dokumentaktionen" }).locator(":scope > button").last().boundingBox())!;
    const firstTool = (await tools.first().boundingBox())!;
    expect(share.x + share.width + 8 <= firstTool.x || firstTool.y + firstTool.height <= share.y).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await header.screenshot({ path: test.info().outputPath(`report-actions-${width}.png`) });
  });

  test(`Auftraege: kein Statusueberlappen und gleich grosse Symbole bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("nav-jobs").click();
    const rows = page.locator(".job-row");
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      await checkStrip(row.getByRole("group", { name: "Dokumentaktionen" }), width);
      const meta = (await row.locator(".job-row-meta-line").boundingBox())!, actions = (await row.locator(".job-row-meta > .row-actions").boundingBox())!;
      expect(meta.y + meta.height).toBeLessThanOrEqual(actions.y);
      const main = (await row.locator(".job-row-main").boundingBox())!, side = (await row.locator(".job-row-meta").boundingBox())!;
      expect(main.x + main.width <= side.x + 1 || main.y + main.height <= side.y + 1).toBe(true);
      for (const button of await row.locator(".job-row-meta > .row-actions > button").all()) { const box = (await button.boundingBox())!; expect(box.width).toBe(44); expect(box.height).toBe(44); }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await rows.first().screenshot({ path: test.info().outputPath(`job-actions-${width}.png`) });
  });
}
