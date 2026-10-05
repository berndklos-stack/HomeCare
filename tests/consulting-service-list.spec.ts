import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { exportServiceListExcel, exportServiceListPdf, filterServiceList, serviceListTotals, type ServiceListEntry } from "../lib/consultingServiceList";

const entries: ServiceListEntry[] = [
  { id: "TIME-1", date: "2026-09-14", startTime: "09:00", endTime: "10:00", minutes: 60, description: "Partnerrecherche", billingStatus: "offen" },
  { id: "TIME-2", date: "2026-09-15", startTime: "10:00", endTime: "10:30", minutes: 30, description: "Abstimmung mit Börjes", billingStatus: "offen" },
  { id: "TIME-3", date: "2026-10-05", startTime: "09:00", endTime: "09:45", minutes: 45, description: "Telefonat", billingStatus: "abgerechnet" },
];

test("Leistungsliste filtert Zeitraum, Text und Status ohne Datensatzänderungen", () => {
  const before = JSON.stringify(entries);
  expect(filterServiceList(entries, { from: "2026-09-15", through: "2026-10-05", search: "BÖRJES", status: "offen", descending: false }).map((entry) => entry.id)).toEqual(["TIME-2"]);
  expect(filterServiceList(entries, { from: "", through: "", search: "", status: "all", descending: true }).map((entry) => entry.id)).toEqual(["TIME-3", "TIME-2", "TIME-1"]);
  expect(serviceListTotals(entries, 800)).toEqual({ minutes: 135, cents: 180000 });
  expect(JSON.stringify(entries)).toBe(before);
});

test("Excel enthält echte Zahlen und behandelt Leistungstext nicht als Formel", async ({}, testInfo) => {
  const file = testInfo.outputPath("service-list.xlsx");
  const data = await exportServiceListExcel({ title: "Testauftrag", company: "Testfirma", currency: "SEK", rate: 800, language: "de", entries: [{ ...entries[0], description: "=HYPERLINK(\"https://example.invalid\")" }] });
  writeFileSync(file, data);
  expect(Buffer.from(data).subarray(0, 2).toString()).toBe("PK");
  const xml = execFileSync("unzip", ["-p", file, "xl/worksheets/sheet1.xml"], { encoding: "utf8" });
  expect(xml).toContain("800");
  expect(xml).not.toContain("<f>");
  expect(xml).toContain('ySplit="5"');
  const pdf = await exportServiceListPdf({ title: "Testauftrag", company: "Testfirma", currency: "SEK", rate: 800, language: "de", entries });
  expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
  writeFileSync(testInfo.outputPath("service-list.pdf"), pdf);
  const longPdf = await exportServiceListPdf({ title: "Testauftrag", company: "Testfirma", currency: "SEK", rate: 800, language: "sv", entries: Array.from({ length: 40 }, (_, index) => ({ ...entries[0], id: `LONG-${index}`, description: "Avstämning med Börjes och genomgång av partnerförslag. ".repeat(5) })) });
  expect(Buffer.from(longPdf).toString("latin1").match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  writeFileSync(testInfo.outputPath("service-list-long.pdf"), longPdf);
});

for (const width of [1440, 390]) test(`Leistungsliste bei ${width}px: Auswahl und Exporte ohne Abrechnung`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript((items) => {
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{ id: "JOB-LIST", title: "Leistungslisten-Test", status: "in Arbeit", priority: "normal", dueDate: "2026-10-05", description: "", assignedTo: "Bernd Klos", type: "Sonstiges", schedule: { type: "einmalig" }, checklist: [], consulting: { enabled: true, hourlyRate: "800", currency: "SEK", openEnded: true, entries: items } }]));
  }, entries);
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-jobs").click();
  const jobsBefore = await page.evaluate(() => localStorage.getItem("kolaretorp-jobs"));
  const queueBefore = await page.evaluate(() => localStorage.getItem("workcore-sync-mutations-v1"));
  await page.getByRole("button", { name: "Leistungsliste", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Leistungsliste", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("service-list-row")).toHaveCount(3);
  await dialog.getByLabel("Von", { exact: true }).fill("2026-09-15");
  await dialog.getByLabel("Bis", { exact: true }).fill("2026-09-30");
  await expect(dialog.getByTestId("service-list-row")).toHaveCount(1);
  await expect(dialog).toContainText("400,00 SEK");
  await dialog.getByLabel("Alle auswählen", { exact: true }).uncheck();
  await expect(dialog.getByRole("button", { name: "PDF", exact: true })).toBeDisabled();
  await dialog.getByLabel("Alle auswählen", { exact: true }).check();
  await dialog.getByLabel("Leistungen suchen", { exact: true }).fill("Börjes");
  await expect(dialog.getByTestId("service-list-row")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("service-list.png") });
  for (const format of ["Excel", "PDF"]) {
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: format, exact: true }).click();
    const result = await download;
    expect(result.suggestedFilename()).toMatch(format === "Excel" ? /\.xlsx$/ : /\.pdf$/);
    const file = await result.path();
    expect(readFileSync(file!).subarray(0, format === "Excel" ? 2 : 4).toString()).toBe(format === "Excel" ? "PK" : "%PDF");
  }
  expect(await page.evaluate(() => localStorage.getItem("kolaretorp-jobs"))).toBe(jobsBefore);
  expect(await page.evaluate(() => localStorage.getItem("workcore-sync-mutations-v1"))).toBe(queueBefore);
  await dialog.getByRole("button", { name: "Leistungsliste schließen" }).click();
  await expect(dialog).not.toBeVisible();
});
