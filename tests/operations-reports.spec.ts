import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { exportOperationsReport } from "../lib/operationsReport";

test("Lagerberichte behalten Zahlen und behandeln Texte nicht als Excel-Formeln", async ({}, info) => {
  const file = info.outputPath("report.xlsx");
  const blob = await exportOperationsReport("Inventur", "Test", ["Material", "Menge"], [["=1+1", -2.25]], "xlsx");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  const xml = execFileSync("unzip", ["-p", file, "xl/worksheets/sheet1.xml"], { encoding: "utf8" });
  expect(xml).toContain("-2.25"); expect(xml).not.toContain("<f>");
  expect(execFileSync("unzip", ["-p", file, "xl/sharedStrings.xml"], { encoding: "utf8" })).toContain("=1+1");
  const pdf = await exportOperationsReport("Buchungen", "Test", ["Material", "Grund"], Array.from({ length: 65 }, (_, index) => [`Material ${index}`, "Langer Buchungsgrund ".repeat(25)]), "pdf");
  const content = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
  expect(content).toContain("Material 64"); expect((content.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1);
});

for (const width of [320, 820, 1440]) {
  test(`Buchungsaktionen exportieren alle gefilterten Seiten bei ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem("kolaretorp-updated-at", "2026-10-23T08:00:00Z");
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "report-test": {} }));
      localStorage.setItem("kolaretorp-materials", JSON.stringify([{ id: "report-material", name: "Berichtsholz", sku: "REPORT", unit: "Meter", inventory: [] }]));
      localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Berichtsfirma", logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" }));
    });
    const reads: number[] = [];
    let failed = false;
    await page.route("**/api/operations?**", route => {
      const params = new URL(route.request().url()).searchParams;
      if (params.get("entity") === "stock_status") return route.fulfill({ json: { active: true } });
      if (params.get("entity") === "stock_movements") {
        const page = Number(params.get("page")); reads.push(page);
        if (failed && page === 1) return route.fulfill({ status: 503, json: { error: "FAILED" } });
        const rows = Array.from({ length: 61 }, (_, index) => ({ id: `REPORT-${index}`, material_id: "report-material", quantity: index + 0.25, destination_id: "warehouse", occurred_at: "2026-10-23T08:00:00Z", actor_name: "Testbenutzer", note: `${index === 0 || index === 60 ? "Behalten" : "Ausblenden"} ${index}` }));
        return route.fulfill({ json: { rows: rows.slice(page * 50, page * 50 + 50), count: rows.length } });
      }
      return route.fulfill({ json: { rows: [], count: 0 } });
    });
    await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Lager & Material", exact: true }).click();
    await page.getByRole("tab", { name: "Buchungen", exact: true }).click();
    const table = page.getByRole("table", { name: "Buchungen", exact: true });
    await expect(table).toContainText("Behalten 0");
    await expect(table).toContainText("Berichtsholz");
    await table.getByRole("searchbox", { name: "Filter: Buchungsgrund", exact: true }).fill("Behalten");
    const actions = page.getByRole("group", { name: "Dokumentaktionen", exact: true });
    await expect(actions.locator(":scope > button, :scope > a, :scope > details")).toHaveCount(5);
    for (const control of await actions.locator(":scope > button, :scope > a, :scope > details").all()) {
      const box = (await control.boundingBox())!;
      expect(box.width).toBe(44); expect(box.height).toBe(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await expect(actions.getByRole("link", { name: "E-Mail", exact: true })).toHaveAttribute("href", /^mailto:/);
    await expect(actions.getByRole("link", { name: "SMS", exact: true })).toHaveAttribute("href", /^sms:/);
    for (const format of ["PDF", "Excel"]) {
      await actions.getByLabel("Herunterladen", { exact: true }).click();
      const downloaded = page.waitForEvent("download"); await actions.getByRole("button", { name: format, exact: true }).click();
      const file = await downloaded; const path = info.outputPath(`bookings.${format === "PDF" ? "pdf" : "xlsx"}`); await file.saveAs(path);
      const text = format === "PDF" ? readFileSync(path).toString("latin1") : execFileSync("unzip", ["-p", path, "xl/sharedStrings.xml"], { encoding: "utf8" });
      expect(text).toContain("Behalten 60"); expect(text).not.toContain("Ausblenden");
      expect(text).toContain("Berichtsholz");
      if (format === "PDF") expect(text).toMatch(/\/Subtype\s*\/Image/);
    }
    expect(reads).toContain(1);
    if (width === 1440) {
      const opened = page.waitForEvent("popup");
      await actions.getByRole("button", { name: "Drucken / PDF", exact: true }).click();
      const preview = await opened;
      await expect(preview.locator("iframe")).toHaveAttribute("src", /^blob:/);
      await preview.close();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("bookings-actions.png") });
    failed = true;
    let partialDownload = false;
    page.on("download", () => { partialDownload = true; });
    await actions.getByLabel("Herunterladen", { exact: true }).click();
    await actions.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Die Aktion konnte nicht ausgeführt werden" })).toBeVisible();
    expect(partialDownload).toBe(false);
  });
}
