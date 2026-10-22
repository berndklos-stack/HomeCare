import { test, expect, type Page } from "@playwright/test";
import { formatStaffMinutes, staffLeaveSummary, staffMinutesInMonth, suggestedLeaveDays, validateStaffCommand, type StaffCommand, type StaffTimeData } from "../lib/staffTime";
import { buildStaffReport, staffReportRows } from "../lib/staffTimeReports";
import { execFileSync } from "node:child_process";

const entryId = "e2110000-0000-4000-8000-000000000001";
const leaveId = "f2110000-0000-4000-8000-000000000001";
const year = new Date().getFullYear();
const month = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const date = new Date(year, new Date().getMonth(), Math.min(10, new Date().getDate()), 8);
function fixture(manager: boolean): StaffTimeData {
  return { employeeId: "PER-1", ownEmployeeId: "PER-1", canManage: manager, employees: [{ id: "PER-1", name: "Example Worker" }, ...(manager ? [{ id: "PER-2", name: "Other Worker" }] : [])], month,
    entries: [{ id: entryId, employee_id: "PER-1", kind: "work", reason: "Office", note: "Existing", started_at: date.toISOString(), ended_at: new Date(date.getTime() + 3600000).toISOString(), minutes: 60, locked_at: null, revision: 1 }],
    balances: [{ employee_id: "PER-1", year, entitlement_days: 25, carryover_days: 2, used_days: 3, revision: 1 }],
    leaves: [{ id: leaveId, employee_id: "PER-1", from_date: `${year}-11-02`, to_date: `${year}-11-04`, days: 3, note: "Family", status: "requested", decision_reason: "", decided_at: null, revision: 1 }],
    events: [{ id: "event-1", request_id: leaveId, action: "requested", reason: "", created_at: date.toISOString() }],
  };
}
async function open(page: Page, manager = false, failManual = false) {
  const data = fixture(manager); const commands: { mutationId: string; command: StaffCommand }[] = [];
  await page.route("**/api/staff-time**", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: data });
    const body = route.request().postDataJSON(); commands.push(body);
    const command = body.command as StaffCommand;
    if (command.action === "clock") {
      const active = data.entries.find(row => !row.ended_at);
      expect(command.activeId).toBe(active?.id ?? null);
      if (active) { expect(command.revision).toBe(active.revision); active.ended_at = new Date().toISOString(); active.minutes = 1; }
      if (command.kind) data.entries.push({ id: crypto.randomUUID(), employee_id: "PER-1", kind: command.kind, reason: command.reason ?? "", note: command.note ?? "", started_at: new Date(Date.now() - 60000).toISOString(), ended_at: null, minutes: null, locked_at: null, revision: 1 });
    }
    if (command.action === "time_save" && failManual) { failManual = false; return route.fulfill({ status: 409, json: { error: "Bitte neu laden; Entwurf bleibt erhalten." } }); }
    if (command.action === "time_save") data.entries.push({ id: crypto.randomUUID(), employee_id: "PER-1", kind: command.kind!, reason: command.reason ?? "", note: command.note ?? "", started_at: command.startedAt!, ended_at: command.endedAt!, minutes: 60, locked_at: null, revision: 1 });
    if (command.action === "time_lock") data.entries[0].locked_at = new Date().toISOString();
    if (command.action === "leave_approve") { data.leaves[0].status = "approved"; data.leaves[0].decision_reason = command.reason ?? ""; data.leaves[0].revision++; data.events.push({ id: "event-2", request_id: leaveId, action: "approved", reason: command.reason ?? "", created_at: new Date().toISOString() }); }
    if (command.action === "balance_save") { data.balances[0].entitlement_days = command.entitlementDays!; data.balances[0].revision++; }
    if (command.action === "leave_request") data.leaves.push({ ...data.leaves[0], id: crypto.randomUUID(), from_date: command.from!, to_date: command.to!, days: command.days!, note: command.note ?? "", status: "requested", revision: 1 });
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/"); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("nav-time")).toHaveCount(0);
  await page.getByRole("button", { name: "Zeiterfassung", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Zeiterfassung", exact: true });
  await expect(workspace.getByLabel("Mitarbeiter", { exact: true })).toHaveValue("PER-1");
  await expect(workspace.getByRole("button", { name: "Arbeit beginnen", exact: true })).toBeEnabled();
  expect((await workspace.getByLabel("Mitarbeiter", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await workspace.getByRole("button", { name: "Aktualisieren", exact: true }).boundingBox())!.width).toBeLessThanOrEqual(46);
  return { data, commands, workspace };
}

test("Zeitvalidierung, halbe Urlaubstage und Monatsgrenzen", () => {
  expect(formatStaffMinutes(125)).toBe("2:05");
  expect(suggestedLeaveDays("2026-10-23", "2026-10-26")).toBe(2);
  expect(suggestedLeaveDays("bad", "2026-10-26")).toBe(0);
  const crossMonth = { started_at: new Date(2026, 8, 30, 23).toISOString(), ended_at: new Date(2026, 9, 1, 1).toISOString() };
  expect(staffMinutesInMonth(crossMonth, "2026-09")).toBe(60);
  expect(staffMinutesInMonth(crossMonth, "2026-10")).toBe(60);
  expect(staffMinutesInMonth({ ...crossMonth, ended_at: null }, "2026-10")).toBe(0);
  expect(validateStaffCommand({ action: "leave_request", from: "2026-11-02", to: "2026-11-04", days: 2.5 }).days).toBe(2.5);
  for (const command of [
    { action: "unknown" }, { action: "clock", kind: "private" }, { action: "clock", kind: "work", activeId: entryId },
    { action: "time_save", kind: "work", startedAt: "bad", endedAt: "2026-01-01" },
    { action: "time_lock", id: entryId }, { action: "leave_request", from: "2026-02-31", to: "2026-03-02", days: 1 },
    { action: "leave_request", from: "2026-12-31", to: "2027-01-02", days: 1 },
    { action: "leave_request", from: "2026-11-02", to: "2026-11-03", days: 3 },
    { action: "balance_save", year: 2026, revision: 0, entitlementDays: -1, carryoverDays: 0, usedDays: 0 },
  ]) expect(() => validateStaffCommand(command)).toThrow();
  const data = fixture(false);
  expect(staffLeaveSummary(data.balances[0], data.leaves, year)).toEqual({ approved: 0, requested: 3, remaining: 24 });
  data.leaves[0].status = "approved";
  expect(staffLeaveSummary(data.balances[0], data.leaves, year).remaining).toBe(21);
  expect(staffLeaveSummary(undefined, data.leaves, year).remaining).toBeNull();
});

test("Berichte begrenzen Zeiten auf Tag und Monat und maskieren Inhalte", () => {
  const data = fixture(true);
  data.entries[0] = { ...data.entries[0], started_at: new Date(2026, 8, 30, 23).toISOString(), ended_at: new Date(2026, 9, 1, 2).toISOString(), minutes: 180, note: '<script>alert("x")</script>' };
  const monthly = buildStaffReport(data, "2026-10", "month", "2026-10-01", "de");
  expect(monthly.rows).toHaveLength(1);
  expect(monthly.rows[0].work).toBe(120);
  expect(monthly.html).not.toContain('<script>');
  expect(monthly.html).toContain('&lt;script&gt;');
  expect(monthly.text).toContain("Arbeitszeit: 2:00 h");
  expect(staffReportRows(data, "2026-09", "day", "2026-09-30")[0].work).toBe(60);
  expect(staffReportRows(data, "2026-10", "company", "2026-10-01")).toHaveLength(2);
  expect(staffReportRows(data, "2026-10", "month", "2026-10-01", "")).toHaveLength(2);
  expect(staffReportRows(data, "2026-10", "day", "2026-10-01", "PER-2").map(row => row.employee.id)).toEqual(["PER-2"]);
  data.entries[0].ended_at = null;
  expect(staffReportRows(data, "2026-10", "month", "2026-10-01")[0].work).toBe(0);
});

for (const width of [320, 390, 820, 1440]) test(`Personal-Zeiterfassung und Berichte bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const { workspace } = await open(page, true);
  await expect(page.getByRole("navigation", { name: "Personal", exact: true })).toBeVisible();
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  const reports = workspace.getByRole("region", { name: "Berichte", exact: true });
  const frame = page.frameLocator('iframe[title^="Monatsbericht"]');
  await expect(frame.getByRole("heading", { name: "Example Worker", exact: true })).toBeVisible();
  await expect(frame.getByText("1:00 h", { exact: true }).first()).toBeVisible();
  await frame.locator("body").evaluate(body => { window.print = () => { body.setAttribute("data-print-requested", "true"); }; });
  await reports.getByRole("button", { name: "Drucken / PDF", exact: true }).click();
  await expect(frame.locator("body")).toHaveAttribute("data-print-requested", "true");
  await expect(reports.getByRole("link", { name: "E-Mail", exact: true })).toHaveAttribute("href", /^mailto:\?subject=/);
  const downloadPromise = page.waitForEvent("download");
  await reports.getByRole("button", { name: "Excel", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`staff-report-month-${month}.xlsx`);
  await reports.getByLabel("Bericht", { exact: true }).selectOption("company");
  await expect(page.frameLocator('iframe[title^="Personalbericht"]').getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
  await reports.getByLabel("Bericht", { exact: true }).selectOption("day");
  await reports.getByLabel("Datum", { exact: true }).fill(`${month}-${String(date.getDate()).padStart(2, "0")}`);
  await expect(page.frameLocator('iframe[title^="Tagesbericht"]').getByRole("cell", { name: "Office · Existing", exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/staff-time-personnel-reports-${width}-${test.info().project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("navigation", { name: "Personal", exact: true }).getByRole("button", { name: "Übersicht", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Personal verwalten", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Personal", exact: true }).getByRole("button", { name: "Zeiterfassung", exact: true }).click();
  await expect(workspace).toBeVisible();
});

test("Zeiterfassungs-API verweigert anonyme und echte Testbypass-Zugriffe", async ({ request }) => {
  for (const method of ["GET", "POST"]) {
    const anonymous = await request.fetch("/api/staff-time", { method, headers: { "X-WorkCore-E2E-Bypass": "0" }, ...(method === "POST" ? { data: {} } : {}) });
    expect(anonymous.status()).toBe(401);
    expect((await request.fetch("/api/staff-time", { method, ...(method === "POST" ? { data: {} } : {}) })).status()).toBe(503);
  }
});

for (const width of [390, 820, 1440]) test(`Mitarbeiter stempelt, korrigiert und beantragt Urlaub bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const { workspace, commands } = await open(page, false, true);
  await expect(workspace.getByLabel("Mitarbeiter", { exact: true })).toBeDisabled();
  await workspace.getByRole("button", { name: "Arbeit beginnen", exact: true }).click();
  await workspace.getByRole("heading", { name: "Arbeit", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/staff-time-clock-${width}-${test.info().project.name}.png` });
  await workspace.getByRole("button", { name: "Pause", exact: true }).click();
  await workspace.getByRole("button", { name: "Arbeit fortsetzen", exact: true }).click();
  await workspace.getByRole("button", { name: "Unterbrechung", exact: true }).click();
  await workspace.getByRole("button", { name: "Beenden", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "Keine Zeit läuft", exact: true })).toBeVisible();
  expect(commands.filter(row => row.command.action === "clock").map(row => row.command.kind)).toEqual(["work", "pause", "work", "interruption", null]);
  await workspace.getByRole("button", { name: "Zeiten", exact: true }).click();
  await workspace.getByRole("button", { name: "Zeit nachtragen", exact: true }).click();
  await workspace.getByLabel("Notiz", { exact: true }).fill("Nachtrag test");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByTestId("nav-masterData").click();
  await expect(workspace.getByLabel("Notiz", { exact: true })).toHaveValue("Nachtrag test");
  await workspace.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(workspace.getByRole("alert")).toContainText("Entwurf bleibt erhalten");
  await expect(workspace.getByLabel("Notiz", { exact: true })).toHaveValue("Nachtrag test");
  await workspace.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(workspace.getByText("Nachtrag test", { exact: true })).toBeVisible();
  const attempts = commands.filter(row => row.command.action === "time_save");
  expect(attempts[0].mutationId).toBe(attempts[1].mutationId);
  const downloadPromise = page.waitForEvent("download");
  await workspace.getByRole("button", { name: "Zeiten als Excel", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`times-${month}.xlsx`);
  await expect(workspace.getByRole("button", { name: /Freigeben und sperren/ })).toHaveCount(0);
  await workspace.getByRole("button", { name: "Urlaub", exact: true }).click();
  await expect(workspace.getByRole("button", { name: "Urlaubskonto Bearbeiten", exact: true })).toHaveCount(0);
  await expect(workspace.getByRole("button", { name: "Genehmigen", exact: true })).toHaveCount(0);
  await workspace.getByRole("button", { name: "Urlaub beantragen", exact: true }).click();
  await workspace.getByLabel("Von", { exact: true }).fill(`${year}-12-07`);
  await workspace.getByLabel("Bis", { exact: true }).fill(`${year}-12-09`);
  await workspace.getByLabel("Urlaubstage", { exact: true }).fill("2.5");
  await workspace.getByRole("button", { name: "Urlaub beantragen", exact: true }).last().click();
  await expect(workspace.getByLabel("Von", { exact: true })).toHaveCount(0);
  expect(commands.at(-1)?.command).toMatchObject({ action: "leave_request", employeeId: "PER-1", days: 2.5 });
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  await expect(workspace.getByLabel("Bericht", { exact: true }).locator('option[value="company"]')).toHaveCount(0);
  await expect(workspace.getByLabel("Mitarbeiter", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await workspace.getByRole("heading", { name: "Zeiterfassung", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/staff-time-leave-${width}-${test.info().project.name}.png`, fullPage: true });
  if (width === 390) {
    await page.getByRole("button", { name: "Dunkelmodus", exact: true }).click();
    await workspace.getByRole("heading", { name: "Zeiterfassung", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/staff-time-dark-${test.info().project.name}.png` });
  }
});

test("Firmenadministrator sperrt Zeiten und genehmigt Urlaub mit Verlauf", async ({ page }) => {
  const { workspace, commands } = await open(page, true);
  await expect(workspace.getByLabel("Mitarbeiter", { exact: true })).toBeEnabled();
  await workspace.getByRole("button", { name: "Zeiten", exact: true }).click();
  await workspace.getByRole("button", { name: /Freigeben und sperren/ }).click();
  await expect(workspace.getByText("Freigegeben", { exact: true })).toBeVisible();
  await expect(workspace.getByRole("button", { name: /^Bearbeiten / })).toHaveCount(0);
  await workspace.getByRole("button", { name: "Urlaub", exact: true }).click();
  await workspace.getByRole("button", { name: "Urlaubskonto Bearbeiten", exact: true }).click();
  await workspace.getByLabel("Jahresanspruch", { exact: true }).fill("30");
  await workspace.getByRole("button", { name: "Speichern", exact: true }).click();
  await workspace.getByRole("button", { name: "Genehmigen", exact: true }).click();
  await workspace.getByLabel("Entscheidungsgrund", { exact: true }).fill("Vertretung geklärt");
  await workspace.getByRole("button", { name: "Genehmigen", exact: true }).last().click();
  await workspace.getByText("Verlauf", { exact: true }).click();
  await expect(workspace.getByText(/Genehmigt · Vertretung geklärt/)).toBeVisible();
  expect(commands.at(-1)?.command).toMatchObject({ action: "leave_approve", id: leaveId, revision: 1, reason: "Vertretung geklärt" });
});

test("Firmenlogo steht rechts im druckbaren Personalbericht und ist in allen Excelblaettern eingebettet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas"); canvas.width = 80; canvas.height = 20;
    const context = canvas.getContext("2d")!; context.fillStyle = "#126b30"; context.fillRect(0, 0, 80, 20);
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Eigene Berichtsfirma", logoUrl: canvas.toDataURL("image/png") }));
  });
  const { workspace } = await open(page, true);
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  const reports = workspace.getByRole("region", { name: "Berichte", exact: true });
  const frame = page.frameLocator('iframe[title^="Monatsbericht"]');
  const logo = frame.getByRole("img", { name: "Eigene Berichtsfirma", exact: true });
  await expect(logo).toHaveAttribute("src", /^data:image\/png/);
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(80);
  expect((await logo.boundingBox())!.x).toBeGreaterThan((await frame.locator("body").boundingBox())!.x + 150);
  const printable = await page.context().newPage();
  await printable.setViewportSize({ width: 794, height: 1123 });
  await printable.setContent(await frame.locator("html").evaluate(element => element.outerHTML));
  await printable.emulateMedia({ media: "print" });
  const printLogo = printable.getByRole("img", { name: "Eigene Berichtsfirma", exact: true });
  await expect.poll(() => printLogo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(80);
  const printBox = (await printLogo.boundingBox())!, header = (await printable.locator("header").boundingBox())!;
  expect(printBox.y).toBeGreaterThanOrEqual(header.y);
  expect(printBox.x + printBox.width).toBeLessThanOrEqual(header.x + header.width + 1);
  expect(printBox.x).toBeGreaterThan(header.x + header.width / 2);
  await printable.screenshot({ path: test.info().outputPath("staff-report-print.png"), fullPage: true });
  if (test.info().project.name === "chromium") {
    const pdf = await printable.pdf({ path: test.info().outputPath("staff-report.pdf"), format: "A4", preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
  }
  await printable.close();
  const downloading = page.waitForEvent("download");
  await reports.getByRole("button", { name: "Excel", exact: true }).click();
  const file = (await (await downloading).path())!;
  const files = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" });
  expect(files.match(/xl\/media\/[^\n]+\.png/g)).toHaveLength(3);
  for (let number = 1; number <= 3; number++) {
    const drawing = execFileSync("unzip", ["-p", file, `xl/drawings/drawing${number}.xml`], { encoding: "utf8" });
    expect(drawing).toContain("Eigene Berichtsfirma");
    expect(drawing).toMatch(/<(?:xdr:)?row>0<\//);
  }
});

for (const width of [390, 820]) test(`Berichte zeigen alle Mitarbeiter und filtern unabhängig vom Stempeln ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const { data, workspace } = await open(page, true);
  data.entries.push({ ...data.entries[0], id: "e2110000-0000-4000-8000-000000000002", employee_id: "PER-2", note: "Nur anderer Mitarbeiter", ended_at: new Date(date.getTime() + 7200000).toISOString(), minutes: 120 });
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  const reports = workspace.getByRole("region", { name: "Berichte", exact: true });
  const frame = page.frameLocator('iframe[title^="Monatsbericht"]');
  await expect(reports.getByLabel("Mitarbeiter", { exact: true })).toHaveValue("");
  await expect(frame.getByRole("heading", { name: "Example Worker", exact: true })).toBeVisible();
  await expect(frame.getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
  await reports.getByLabel("Mitarbeiter", { exact: true }).selectOption("PER-2");
  await expect(frame.getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
  await expect(frame.getByRole("heading", { name: "Example Worker", exact: true })).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await reports.getByRole("button", { name: "Excel", exact: true }).click();
  const xml = execFileSync("unzip", ["-p", (await (await downloading).path())!, "xl/sharedStrings.xml"], { encoding: "utf8" });
  expect(xml).toContain("Other Worker"); expect(xml).not.toContain("Example Worker");
  await reports.getByLabel("Bericht", { exact: true }).selectOption("day");
  await reports.getByLabel("Datum", { exact: true }).fill(`${month}-${String(date.getDate()).padStart(2, "0")}`);
  await expect(page.frameLocator('iframe[title^="Tagesbericht"]').getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
  await reports.getByLabel("Mitarbeiter", { exact: true }).selectOption("");
  await expect(page.frameLocator('iframe[title^="Tagesbericht"]').getByRole("heading", { name: "Example Worker", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await workspace.getByRole("button", { name: "Stempeln", exact: true }).click();
  await expect(workspace.getByLabel("Mitarbeiter", { exact: true })).toHaveValue("PER-1");
});

test("Firmenadministrator ohne eigene Mitarbeiterzuordnung kann alle Personalberichte öffnen", async ({ page }) => {
  const data = { ...fixture(true), employeeId: "", ownEmployeeId: null };
  await page.route("**/api/staff-time**", route => route.fulfill({ json: data }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Zeiterfassung", exact: true }).click();
  await page.getByRole("region", { name: "Zeiterfassung", exact: true }).getByRole("button", { name: "Berichte", exact: true }).click();
  await expect(page.frameLocator('iframe[title^="Monatsbericht"]').getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
});

test("Kommunikationsleiste bleibt mobil erreichbar und teilt nur den ausgewählten Bericht", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { document.body.dataset.sharedReport = JSON.stringify(data); } });
  });
  const { workspace } = await open(page, true);
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  const reports = workspace.getByRole("region", { name: "Berichte", exact: true });
  const actions = reports.getByRole("group", { name: "Dokumentaktionen" });
  await expect(actions).toBeVisible();
  const controls = actions.locator(":scope > button, :scope > a");
  await expect(controls).toHaveCount(5);
  for (const control of await controls.all()) {
    const box = (await control.boundingBox())!;
    expect(box.width).toBe(44); expect(box.height).toBe(44);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
    await expect(control).toHaveAttribute("title", /.+/);
  }
  await reports.getByLabel("Mitarbeiter", { exact: true }).selectOption("PER-2");
  await expect(page.frameLocator('iframe[title^="Monatsbericht"]').getByRole("heading", { name: "Other Worker", exact: true })).toBeVisible();
  await actions.getByRole("button", { name: "Teilen", exact: true }).click();
  const payload = JSON.parse((await page.locator("body").getAttribute("data-shared-report"))!);
  expect(payload.text).toContain("Other Worker"); expect(payload.text).not.toContain("Example Worker");
  expect(payload.url).toBeUndefined();
  const mail = await actions.getByRole("link", { name: "E-Mail", exact: true }).getAttribute("href");
  expect(new URL(mail!).searchParams.get("body")).toBe(payload.text);
  const sms = await actions.getByRole("link", { name: "SMS", exact: true }).getAttribute("href");
  expect(new URL(sms!).searchParams.get("body")).toBe(`${payload.title}\n\n${payload.text}`);
  await page.screenshot({ path: test.info().outputPath("communication-actions-mobile.png") });
});

test("Teilen-Abbruch ist kein Fehler und Browser ohne Teilen können Inhalte kopieren", async ({ page }) => {
  const { workspace } = await open(page, true);
  await workspace.getByRole("button", { name: "Berichte", exact: true }).click();
  const reports = workspace.getByRole("region", { name: "Berichte", exact: true });
  const actions = reports.getByRole("group", { name: "Dokumentaktionen" });
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("Cancelled", "AbortError")) }));
  await actions.getByRole("button", { name: "Teilen", exact: true }).click();
  await expect(actions).toHaveAttribute("aria-busy", "false");
  await expect(reports.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.body.dataset.copiedReport = text; } } });
  });
  await actions.getByRole("button", { name: "Teilen", exact: true }).click();
  await expect(reports.getByRole("status")).toHaveText("Inhalt zum Teilen kopiert.");
  expect(await page.locator("body").getAttribute("data-copied-report")).toContain("Example Worker");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("Denied")) } }));
  await actions.getByRole("button", { name: "Teilen", exact: true }).click();
  await expect(reports.getByRole("alert")).toHaveText("Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.");
});
