import { test, expect } from "@playwright/test";
import { validateCompanyUpdate, type CompanyInput } from "../lib/administration";

const profile: CompanyInput = { name: "Andere Firma", country: "SE", locale: "de", timezone: "Europe/Stockholm", organizationNumber: "ORG", vatNumber: "", ownerEmail: "owner@example.invalid", accountType: "production", pilotStartDate: "", pilotEndDate: "", contactPerson: "Kontakt", internalLabel: "", notes: "", modules: ["jobs"] };
const target = "b2015000-0000-4000-8000-000000000002";
const administration = { company: { name: "Verwaltungsfirma" }, members: [], roles: [], employees: [], modules: [], feedback: [], canManageCompany: true, canManageMembers: true, canManageRoles: true, platformAdmin: true, owner: true };

test("Bestehende Firma ohne Eigentuemermail bleibt bearbeitbar, ungueltige Angaben nicht", () => {
  expect(validateCompanyUpdate({ ...profile, ownerEmail: "" }).ownerEmail).toBe("");
  expect(() => validateCompanyUpdate({ ...profile, timezone: "invalid" })).toThrow();
});

for (const width of [390, 820, 1440]) test(`Zentrale Firmen: richtige Firma, Konfliktschutz und bearbeitbare Einstellungen ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  let detail = { id: target, revision: 4, settingsRevision: 7, archived: false, company: { ...profile } };
  const writes: Record<string, unknown>[] = [];
  let conflict = true;
  await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: administration }));
  await page.route(url => url.pathname === "/api/administration/companies", async route => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON(); writes.push(body);
      if (conflict) return route.fulfill({ status: 409, json: { error: "Die Firma wurde zwischenzeitlich geändert. Bitte neu laden; deine Eingaben bleiben erhalten." } });
      detail = { ...detail, revision: 5, settingsRevision: 8, company: body.company };
      return route.fulfill({ json: { ok: true } });
    }
    const params = new URL(route.request().url()).searchParams;
    if (params.has("tenantId")) { expect(params.get("tenantId")).toBe(target); return route.fulfill({ json: detail }); }
    const search = params.get("search") || "";
    const companies = [{ id: "b2015000-0000-4000-8000-000000000001", name: "Verwaltungsfirma", email: "home@example.invalid", account_type: "production", archived: false }, { id: target, name: "Andere Firma", email: "owner@example.invalid", account_type: "production", archived: true }].filter(company => company.name.includes(search));
    return route.fulfill({ json: { companies, total: search ? companies.length : 51 } });
  });
  await page.goto("/administration");
  const navigation = page.getByRole("navigation", { name: "Administration", exact: true });
  await expect(navigation.getByRole("button", { name: "Pilot/Test", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Firma", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Benutzer", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Firmen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Firma Andere Firma bearbeiten", exact: true })).toBeVisible();
  await expect(page.getByText("Gesperrt / archiviert", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nächste Seite", exact: true })).toBeEnabled();
  await page.getByLabel("Firma suchen", { exact: true }).fill("Andere");
  await expect(page.getByRole("button", { name: "Firma Verwaltungsfirma bearbeiten", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Firma Andere Firma bearbeiten", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Eigentümer-E-Mail", { exact: true })).toHaveAttribute("readonly", "");
  await expect(page.getByRole("combobox", { name: "Kontotyp", exact: true }).locator('option[value="pilot"]')).toHaveText("Testkonto");
  await expect(page.getByLabel("Testbeginn", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Testende", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Firmendaten neu laden", exact: true })).toHaveCSS("width", "44px");
  await page.getByLabel("Firmenname", { exact: true }).fill("Bearbeitete Firma");
  await page.getByLabel("Interne Notizen", { exact: true }).fill("Nur diese Firma");
  await page.getByLabel("Fahrtenbuch", { exact: true }).check();
  await page.getByRole("button", { name: "Einstellungen speichern", exact: true }).click();
  await expect(page.getByRole("region", { name: "Firmeneinstellungen" }).getByRole("alert")).toContainText("zwischenzeitlich geändert");
  await expect(page.getByLabel("Firmenname", { exact: true })).toHaveValue("Bearbeitete Firma");
  conflict = false;
  await page.getByRole("button", { name: "Einstellungen speichern", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Firmeneinstellungen gespeichert.");
  expect(writes.at(-1)).toMatchObject({ action: "save", tenantId: target, revision: 4, settingsRevision: 7, company: { name: "Bearbeitete Firma", notes: "Nur diese Firma", modules: ["jobs", "logbook"] } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/company-directory-${width}-${test.info().project.name}.png`, fullPage: true });
});

test("Firmenadministrator sieht keine zentrale Firmenverwaltung", async ({ page, request }) => {
  await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: { ...administration, platformAdmin: false } }));
  await page.goto("/administration");
  await expect(page.getByRole("button", { name: "Firmen", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Firma", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Alle Firmen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Neue Firma anlegen", exact: true })).toHaveCount(0);
  for (const method of ["GET", "PATCH"]) {
    const response = await request.fetch(`/api/administration/companies?tenantId=${target}`, { method, ...(method === "PATCH" ? { data: { action: "save", tenantId: target } } : {}) });
    expect(response.status()).toBe(403);
  }
  const anonymous = await request.get(`/api/administration/companies?tenantId=${target}`, { headers: { "X-WorkCore-E2E-Bypass": "0" } });
  expect(anonymous.status()).toBe(401);
});
