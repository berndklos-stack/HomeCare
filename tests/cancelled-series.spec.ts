import { expect, test } from "@playwright/test";

test("Stornierte Testserie erzeugt keine neuen Poolpflege-Termine", async ({ page }) => {
  await page.route("**/api/vehicle-positions**", route => route.fulfill({ json: { data: [] } }));
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  await page.addInitScript(() => {
    if (localStorage.getItem("cancelled-series-fixture")) return;
    localStorage.setItem("cancelled-series-fixture", "1");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    const master = { id: "POOL", title: "Poolpflege und Wasserwerte", objectId: "OBJ-1001", customerId: "CUS-1001", description: "Test", assignedTo: "Demo", status: "storniert", priority: "normal", type: "Pool", dueDate: "2026-07-31", billable: false, checklist: [], serviceIds: [], workMinutes: 95, schedule: { type: "serie", frequency: "wöchentlich", interval: 1, weekdays: ["Mo"], end: "nie", endDate: "", occurrences: 0, activeFromMonth: 5, activeToMonth: 9, yearInterval: 1 } };
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([master,
      ...["2027-05-03", "2027-05-10"].map(date => ({ ...master, id: `POOL-OCC-${date.replaceAll("-", "")}`, seriesMasterId: "POOL", seriesOccurrenceDate: date, dueDate: date, startDate: date, endDate: date, status: "geplant", workMinutes: 0, schedule: { ...master.schedule, type: "einmalig" } })),
      { ...master, id: "REAL", title: "Echter Auftrag", status: "geplant", dueDate: "2026-11-18", schedule: { ...master.schedule, type: "einmalig" } },
    ]));
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{ id: "KEEP-REPORT", jobId: "POOL", objectId: "OBJ-1001", title: "Alter Bericht bleibt erhalten", date: "2026-07-31", summary: "Nicht löschen", internalNotes: "", visibleToCustomer: true, media: [], checklistResults: [], customerComment: "" }]));
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText("Echter Auftrag", { exact: true })).toBeVisible();
  await expect(page.getByText("Poolpflege und Wasserwerte", { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText("Poolpflege und Wasserwerte", { exact: true })).toHaveCount(0);
  const reports = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-reports") || "[]"));
  expect(reports.find((report: { id: string }) => report.id === "KEEP-REPORT").summary).toBe("Nicht löschen");
});
