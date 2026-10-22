import { expect, test } from "@playwright/test";
import { feedbackPath, platformTenantId, validateCompany, validEmail, validUuid, type AdministrationData, type AdministrationMember, type CompanyInput } from "../lib/administration";
import { defaultRolePermissions } from "../lib/authModel";
import { deliverInvitation, isPlatformAdmin } from "../lib/server/administration";
import { readBranding, saveCompanyBranding, validateBranding } from "../lib/server/companyBranding";
import { defaultAppBranding } from "../lib/branding";
import { deliverMemberPasswordReset } from "../lib/server/memberPasswordReset";
import { activateTenant, activeTenantStorageKey, getActiveTenantId, pendingTenantStorageKey, tenantScopedStorageKey } from "../lib/apiClient";

const company: CompanyInput = { name: "Pilot A", ownerEmail: "owner@example.invalid", country: "SE", locale: "de", timezone: "Europe/Stockholm", accountType: "pilot", pilotStartDate: "2026-10-15", pilotEndDate: "", contactPerson: "", internalLabel: "", notes: "", organizationNumber: "", vatNumber: "", modules: ["jobs", "reports"] };
const roleId = "a1514000-0000-4000-8000-000000000001";
const data: AdministrationData = {
  company: { id: "b1514000-0000-4000-8000-000000000001", name: "Pilot A", country_code: "SE", locale: "de", timezone: "Europe/Stockholm", account_type: "pilot" },
  roles: [{ id: roleId, key: "owner", name: "Owner", permissions: defaultRolePermissions.owner, system_role: true }, { id: "a1514000-0000-4000-8000-000000000002", key: "field_worker", name: "Field worker", permissions: defaultRolePermissions.field_worker, system_role: true }],
  members: [{ id: "m1", user_id: "u1", role_id: roleId, status: "active", name: "Example Owner", email: "owner@example.invalid", lastLogin: null, invitation: null, employee_id: null }],
  employees: [{ id: "employee", first_name: "Example", last_name: "Worker" }], modules: [{ module: "jobs", enabled: true }], feedback: [],
  canManageCompany: true, canManageMembers: true, canManageRoles: true, platformAdmin: true, owner: true,
};

test("Firmenanlage validiert Pflichtfelder, Module, Zeitzone und Pilotdaten", () => {
  expect(validateCompany(company)).toEqual(company);
  for (const patch of [{ name: "" }, { country: "invalid" }, { locale: "xx" }, { timezone: "Europe/Unknown" }, { pilotStartDate: "" }, { pilotEndDate: "2026-10-14" }, { pilotStartDate: "2026-02-31" }, { modules: ["unknown"] }, { modules: ["jobs", "jobs"] }, { ownerEmail: "invalid" }]) {
    expect(() => validateCompany({ ...company, ...patch })).toThrow();
  }
  expect(validEmail(1)).toBe(false); expect(validUuid("tenant-a")).toBe(false);
});
test("Feedbackkontext enthält keine Geschäftskennungen oder URL-Parameter", () => {
  expect(feedbackPath("/administration")).toBe("/administration");
  for (const path of ["/objects/customer-secret", "/?customer=secret", "/jobs#secret", "https://external.invalid/"]) expect(feedbackPath(path)).toBe("/app");
});
test("Firmenkontext bleibt tabgebunden, Wechsel wird erst nach validiertem Neustart aktiv", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const local = new Map<string, string>(); const tabA = new Map<string, string>(); const tabB = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  function selectTab(values: Map<string, string>) { Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage(local), sessionStorage: storage(values) } }); }
  try {
    selectTab(tabA); activateTenant("tenant-a");
    selectTab(tabB); activateTenant("tenant-b"); expect(getActiveTenantId()).toBe("tenant-b");
    selectTab(tabA); expect(getActiveTenantId()).toBe("tenant-a");
    expect(local.get(activeTenantStorageKey)).toBe("tenant-b");
    tabA.set(pendingTenantStorageKey, "tenant-b"); expect(getActiveTenantId()).toBe("tenant-a");
    expect(tenantScopedStorageKey("business-cache")).toBe("business-cache:tenant-a");
    activateTenant("tenant-b"); expect(getActiveTenantId()).toBe("tenant-b");
  } finally { if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window"); }
});
test("Plattformanlage benötigt explizite Freischaltung", () => {
  const previous = process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS;
  try {
    delete process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS;
    expect(isPlatformAdmin("owner")).toBe(false);
    process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS = "one, two";
    expect(isPlatformAdmin("two", platformTenantId)).toBe(true); expect(isPlatformAdmin("three", platformTenantId)).toBe(false);
    expect(isPlatformAdmin("two", data.company.id!)).toBe(false);
  } finally { if (previous === undefined) delete process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS; else process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS = previous; }
});
test("Einladungsversand: Zustellung, Providerfehler und Doppelsendesperre bleiben nachvollziehbar", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY, oldFrom = process.env.RESEND_FROM_EMAIL, oldUrl = process.env.WORKCORE_APP_URL;
  try {
    process.env.RESEND_API_KEY = "test-not-a-real-key"; process.env.RESEND_FROM_EMAIL = "sender@example.invalid"; process.env.WORKCORE_APP_URL = "https://app.example.invalid";
    for (const mode of ["success", "failure", "leased"]) {
      const writes: Record<string, unknown>[] = []; let sends = 0;
      globalThis.fetch = async () => { sends++; return new Response("{}", { status: mode === "failure" ? 503 : 200 }); };
      const row = { id: roleId, email: "invite@example.invalid", auth_user_id: roleId, delivery_status: "pending", last_sent_at: null };
      const builder = {
        select() { return this; }, eq() { return this; }, in() { return this; }, lt() { return this; }, is() { return this; },
        update(value: Record<string, unknown>) { writes.push(value); return this; },
        async single() { return { data: row, error: null }; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: mode === "leased" ? [] : [{ id: roleId }], error: null }).then(resolve); },
      };
      const client = { from: () => builder, auth: { admin: {
        getUserById: async () => ({ data: { user: { id: roleId, email: row.email } }, error: null }),
        generateLink: async (input: { type: string }) => { expect(input.type).toBe("magiclink"); return { data: { user: { id: roleId }, properties: { action_link: "https://auth.example.invalid/private-token" } }, error: null }; },
      } } };
      const result = await deliverInvitation({ serviceClient: client } as never, roleId, roleId);
      expect(result.sent).toBe(mode === "success"); expect(JSON.stringify(result)).not.toContain("private-token");
      expect(sends).toBe(mode === "leased" ? 0 : 1);
      if (mode !== "leased") expect(writes.at(-1)?.delivery_status).toBe(mode === "success" ? "sent" : "failed");
    }
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of [["RESEND_API_KEY", oldKey], ["RESEND_FROM_EMAIL", oldFrom], ["WORKCORE_APP_URL", oldUrl]]) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; }
  }
});
test("Branding akzeptiert nur vorhandene Markenfelder", () => {
  expect(validateBranding({ ...defaultAppBranding, claimGerman: " Neu " }).claimGerman).toBe("Neu");
  expect(readBranding({ brandNameSweden: "Firma", name: "nicht sichtbar", claimGerman: null }).claimGerman).toBe("");
  for (const input of [null, [], {}, { ...defaultAppBranding, name: "fremd" }, { ...defaultAppBranding, claimGerman: 7 }, { ...defaultAppBranding, claimGerman: "x".repeat(301) }]) expect(() => validateBranding(input)).toThrow();
});

test("Branding speichert mandantengebunden mit CAS und erhält Firma, Logo und Altwerte", async () => {
  for (const mode of ["success", "stale", "race", "missing", "error"] as const) {
    const filters: unknown[][] = []; const writes: Record<string, unknown>[] = [];
    const original = { name: "Firma", countryCode: "SE", logoUrl: "https://example.invalid/logo.svg", bankDetails: "erhalten", legacy: { keep: true }, ...defaultAppBranding };
    const client = { from(table: string) {
      expect(table).toBe("homecare_settings");
      let writing = false;
      return {
        select() { return this; },
        eq(key: string, value: unknown) { filters.push([writing, key, value]); return this; },
        update(value: Record<string, unknown>) { writing = true; writes.push(value); return this; },
        async maybeSingle() { return { data: writing ? (mode === "race" ? null : { revision: 8 }) : mode === "missing" ? null : { value: original, revision: mode === "stale" ? 8 : 7 }, error: mode === "error" ? { message: "failed" } : null }; },
      };
    } };
    const branding = { ...defaultAppBranding, claimGerman: "Neu" };
    const result = await saveCompanyBranding(client as never, "tenant-a", 7, branding);
    expect(filters).toContainEqual([false, "tenant_id", "tenant-a"]);
    expect(result.conflict).toBe(["stale", "race", "missing"].includes(mode));
    if (["success", "race"].includes(mode)) {
      expect(writes).toEqual([{ value: { ...original, ...branding } }]);
      expect(filters).toContainEqual([true, "tenant_id", "tenant-a"]);
      expect(filters).toContainEqual([true, "key", "companySettings"]);
      expect(filters).toContainEqual([true, "revision", 7]);
    } else expect(writes).toHaveLength(0);
  }
});

test("Administrations-APIs lehnen anonyme Aufrufe ab", async ({ request }) => {
  for (const method of ["GET", "PATCH"]) {
    const response = await request.fetch("/api/administration/branding", { method, headers: { "X-WorkCore-E2E-Bypass": "0" }, ...(method === "PATCH" ? { data: {} } : {}) });
    expect(response.status()).toBe(401);
  }
  for (const [url, method] of [["/api/administration", "GET"], ["/api/administration", "POST"], ["/api/administration", "PATCH"], ["/api/administration/companies", "POST"], ["/api/administration/companies", "PATCH"], ["/api/administration/modules", "PATCH"], ["/api/feedback", "POST"]]) {
    const response = await request.fetch(url, { method, headers: { "X-WorkCore-E2E-Bypass": "0" }, data: {} });
    expect(response.status()).toBe(401);
  }
});
test("UI-Testbypass darf keine echten Benutzer oder Feedbackeinträge schreiben", async ({ request }) => {
  expect((await request.get("/api/administration/branding")).status()).toBe(503);
  expect((await request.patch("/api/administration/branding", { data: {} })).status()).toBe(503);
  for (const url of ["/api/administration", "/api/feedback"]) {
    const response = await request.post(url, { data: {} }); expect(response.status()).toBe(503);
  }
});

for (const width of [390, 820, 1440]) {
  test(`Branding in Administration: Speichern, Konflikt und mobile Eingabe bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: data }));
    let current = { ...defaultAppBranding }; let revision = 7; let conflict = true;
    await page.route("**/api/administration/branding", async route => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        expect(body.revision).toBe(revision);
        expect(Object.keys(body.branding).sort()).toEqual(Object.keys(defaultAppBranding).sort());
        if (conflict) return route.fulfill({ status: 409, json: { error: "Zwischenzeitlich geändert. Deine Eingaben bleiben erhalten." } });
        current = body.branding; revision++;
      }
      await route.fulfill({ json: { branding: current, revision } });
    });
    await page.goto("/administration");
    await page.getByRole("button", { name: "System / Branding", exact: true }).click();
    await page.getByLabel("Internationaler Markenname", { exact: true }).fill("FieldSuite");
    await page.getByLabel("Deutscher Claim", { exact: true }).fill("Alles im Blick.");
    await page.getByRole("button", { name: "Branding speichern", exact: true }).click();
    await expect(page.getByRole("region", { name: "System / Branding", exact: true }).getByRole("alert")).toContainText("Eingaben bleiben erhalten");
    await expect(page.getByLabel("Internationaler Markenname", { exact: true })).toHaveValue("FieldSuite");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Firmen", exact: true }).click();
    await expect(page.getByLabel("Deutscher Claim", { exact: true })).toHaveValue("Alles im Blick.");
    conflict = false;
    await page.getByRole("button", { name: "Branding speichern", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Branding gespeichert.");
    await page.screenshot({ path: `test-results/administration-branding-${width}-${test.info().project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Firmen", exact: true }).click();
    await page.getByRole("button", { name: "System / Branding", exact: true }).click();
    await expect(page.getByLabel("Internationaler Markenname", { exact: true })).toHaveValue("FieldSuite");
  });
  test(`Administration, Einladungsdialog und Pilotanlage bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let invited: Record<string, unknown> | undefined;
    await page.route(url => url.pathname === "/api/administration", async route => {
      if (route.request().method() === "POST") { invited = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, sent: true } }); }
      else {
        const query = new URL(route.request().url()).searchParams;
        const search = (query.get("search") ?? "").toLowerCase();
        const members = data.members.filter(m => `${m.name} ${m.email}`.toLowerCase().includes(search));
        await route.fulfill({ json: { ...data, members, memberTotal: members.length } });
      }
    });
    await page.route(url => url.pathname === "/api/administration/companies", route => route.fulfill({ json: new URL(route.request().url()).searchParams.has("tenantId") ? { id: data.company.id, revision: 1, settingsRevision: 1, archived: false, company } : { companies: [{ ...data.company, email: company.ownerEmail, archived: false }], total: 1 } }));
    await page.goto("/administration");
    await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Firma Pilot A bearbeiten", exact: true }).click();
    await page.getByRole("button", { name: "Benutzer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example Owner" })).toBeVisible();
    await page.getByRole("button", { name: "Benutzer einladen", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await dialog.getByLabel("E-Mail", { exact: true }).fill("worker@example.invalid");
    await dialog.getByLabel("Mitarbeiter (optional)").selectOption("employee");
    await dialog.getByRole("button", { name: "Einladen", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(invited).toMatchObject({ email: "worker@example.invalid", employeeId: "employee", tenantId: data.company.id });
    await page.getByLabel("Suche", { exact: true }).fill("not-found");
    await expect(page.getByText("Keine Benutzer gefunden.")).toBeVisible();
    await page.getByRole("button", { name: "Rollen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rollen & Berechtigungen" })).toBeVisible();
    await expect(page.getByText("Benutzer verwalten", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Firmen", exact: true }).click();
    await page.getByRole("button", { name: "Neue Firma anlegen", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Zeiterfassung", exact: true })).toBeVisible();
    await page.getByLabel("Firmenname", { exact: true }).fill("Pilot B");
    await page.getByLabel("Eigentümer-E-Mail").fill("pilot-b@example.invalid");
    await expect(page.getByRole("button", { name: "Firma anlegen" })).toBeVisible();
    await page.getByRole("button", { name: "Module", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Zeiterfassung", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/administration-${width}-${test.info().project.name}.png`, fullPage: true });
  });
}
test("Branding bleibt ohne Firmenadministrationsrecht verborgen", async ({ page }) => {
  await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: { ...data, canManageCompany: false, platformAdmin: false } }));
  await page.goto("/administration");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("globale Administration");
  await expect(page.getByRole("button", { name: "System / Branding", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Administration", exact: true }).getByRole("button", { name: "Feedback", exact: true })).toHaveCount(0);
});

test("Passwort-Reset sendet nur an bestaetigte Auth-Identitaet und gibt keine Tokens aus", async () => {
  const env = { ...process.env }, oldFetch = globalThis.fetch;
  try {
    process.env.WORKCORE_APP_URL = "https://workcore.example.invalid";
    process.env.RESEND_API_KEY = "test-key"; process.env.RESEND_FROM_EMAIL = "sender@example.invalid";
    for (const mode of ["success", "failure", "mismatch"]) {
      let sends = 0;
      globalThis.fetch = async (input, init) => {
        expect(String(input)).toBe("https://api.resend.com/emails"); sends++;
        const body = JSON.parse(String(init?.body)); expect(body.to).toEqual(["canonical@example.invalid"]);
        expect(body.text).toContain("private-recovery-token");
        return new Response("{}", { status: mode === "failure" ? 503 : 200 });
      };
      const admin = { auth: { admin: { generateLink: async (input: { type: string; email: string; options: { redirectTo: string } }) => {
        expect(input).toEqual({ type: "recovery", email: "canonical@example.invalid", options: { redirectTo: "https://workcore.example.invalid/auth/accept" } });
        return { data: { user: { id: mode === "mismatch" ? "different-user" : "target-user" }, properties: { action_link: "https://auth.example.invalid/private-recovery-token" } }, error: null };
      } } } };
      const result = await deliverMemberPasswordReset(admin as never, { userId: "target-user", email: "canonical@example.invalid" });
      expect(result.sent).toBe(mode === "success"); expect(sends).toBe(mode === "mismatch" ? 0 : 1);
      expect(JSON.stringify(result)).not.toContain("private-recovery-token");
    }
  } finally { process.env = env; globalThis.fetch = oldFetch; }
});

test("Recovery-Link verlangt neues Passwort und Bestaetigung ohne Einladung anzunehmen", async ({ page }) => {
  const userId = "a2209000-0000-4000-8000-000000000001";
  const user = { id: userId, aud: "authenticated", role: "authenticated", email: "recovery@example.invalid", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "test-signature"].join(".");
  const updates: unknown[] = [];
  await page.route(/\/auth\/v1\//, async route => {
    expect(new URL(route.request().url()).pathname).toBe("/auth/v1/user");
    if (route.request().method() === "PUT") updates.push(route.request().postDataJSON());
    return route.fulfill({ json: user });
  });
  await page.route(url => url.pathname === "/api/auth/context", () => { throw new Error("Recovery must not accept a company invitation"); });
  await page.goto(`/auth/accept#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery`);
  await expect(page.getByRole("heading", { name: "Passwort zurücksetzen", exact: true })).toBeVisible();
  await page.getByLabel("Neues Passwort", { exact: true }).fill("Test-Password-1234");
  await page.getByLabel("Neues Passwort bestätigen", { exact: true }).fill("Other-Password-1234");
  await page.getByRole("button", { name: "Passwort speichern", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("zweimal identisch"); expect(updates).toHaveLength(0);
  await page.getByLabel("Neues Passwort bestätigen", { exact: true }).fill("Test-Password-1234");
  await page.getByRole("button", { name: "Passwort speichern", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Dein Passwort wurde geändert.");
  expect(updates).toHaveLength(1); expect(updates[0]).toMatchObject({ password: "Test-Password-1234" });
});

for (const width of [390, 820]) test(`Eigene Firmenbenutzer: Limit, Reset und Verwaltung ohne Plattformzugriff ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const commands: unknown[] = [];
  await page.route(url => url.pathname === "/api/administration", async route => {
    if (route.request().method() === "PATCH") { commands.push(route.request().postDataJSON()); return route.fulfill({ json: { sent: true } }); }
    return route.fulfill({ json: { ...data, platformAdmin: false, userCount: 1, userLimit: 1 } });
  });
  await page.goto("/?masterData=users");
  const users = page.getByRole("region", { name: "Benutzerverwaltung", exact: true });
  await expect(users).toContainText("1 / 1 Firmenzugänge");
  await expect(users.getByRole("button", { name: "Benutzer einladen", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0);
  page.once("dialog", dialog => dialog.accept());
  await users.getByRole("button", { name: "Passwort zurücksetzen: owner@example.invalid", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "E-Mail zum Passwort-Reset versandt." })).toBeVisible();
  expect(commands).toEqual([{ memberId: data.members[0].id, action: "resetPassword" }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
for (const width of [390, 820]) test(`Feedback als eigener Reiter und aktive/inaktive Benutzergruppen ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const suspended = { ...data.members[0], id: "c2112000-0000-4000-8000-000000000002", name: "Inaktiver Benutzer", email: "inactive@example.invalid", status: "suspended" as const };
  const pending = { ...data.members[0], id: "c2112000-0000-4000-8000-000000000003", name: "Offene Einladung", email: "pending@example.invalid", status: "suspended" as const, invitation: { id: roleId, delivery_status: "sent", expires_at: "2026-12-01T00:00:00Z" } };
  const members: AdministrationMember[] = [data.members[0], suspended, pending, { ...data.members[0], id: "c2112000-0000-4000-8000-000000000004", name: "Entzogener Zugang", email: "revoked@example.invalid", status: "revoked" }];
  await page.route(url => url.pathname === "/api/administration", route => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ memberId: suspended.id, action: "reactivate" });
      members[1] = { ...members[1], status: "active" };
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ...data, platformAdmin: true, members, feedback: [{ id: roleId, category: "problem", message: "Feedback der eigenen Firma", created_at: "2026-10-22T08:00:00Z" }] } });
  });
  await page.goto("/?masterData=users");
  const active = page.getByRole("region", { name: "Aktive Benutzer", exact: true });
  const inactive = page.getByRole("region", { name: "Inaktive Benutzer", exact: true });
  await expect(active.getByRole("heading", { name: "Example Owner", exact: true })).toBeVisible();
  for (const name of ["Inaktiver Benutzer", "Offene Einladung", "Entzogener Zugang"]) await expect(inactive.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Feedback der eigenen Firma", { exact: true })).toHaveCount(0);
  await inactive.getByRole("button", { name: "Reaktivieren: inactive@example.invalid", exact: true }).click();
  await expect(active.getByRole("heading", { name: "Inaktiver Benutzer", exact: true })).toBeVisible();
  await expect(inactive.getByRole("heading", { name: "Inaktiver Benutzer", exact: true })).toHaveCount(0);
  await page.goto("/administration");
  await page.getByRole("navigation", { name: "Administration", exact: true }).getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(page.getByRole("region", { name: "Feedback", exact: true }).getByText("Feedback der eigenen Firma", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`administration-feedback-${width}.png`), fullPage: true });
});
for (const sent of [true, false]) test(`Firmenanlage öffnet zielgebundene Benutzerverwaltung; Einladungsversand ${sent ? "erfolgreich" : "fehlgeschlagen"}`, async ({ page }) => {
  const target = "b2112000-0000-4000-8000-000000000003";
  let finish: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  let saving = false;
  await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: data }));
  await page.route(url => url.pathname === "/api/administration/companies", async route => {
    if (route.request().method() === "POST") {
      saving = true; await gate;
      return route.fulfill({ json: { tenantId: target, sent, error: sent ? undefined : "Mailversand fehlgeschlagen." } });
    }
    return route.fulfill({ json: new URL(route.request().url()).searchParams.has("tenantId") ? { id: target, company: { ...company, name: "Neue Firma" }, archived: false, revision: 1, settingsRevision: 1 } : { companies: [], total: 0 } });
  });
  await page.goto("/administration");
  await page.getByRole("button", { name: "Neue Firma anlegen", exact: true }).click();
  await page.getByLabel("Firmenname", { exact: true }).fill("Neue Firma");
  await page.getByLabel("Eigentümer-E-Mail", { exact: true }).fill("new@example.invalid");
  await page.getByRole("button", { name: "Firma anlegen", exact: true }).click();
  await expect.poll(() => saving).toBe(true);
  await expect(page.getByRole("button", { name: "Firmenübersicht", exact: true })).toBeDisabled();
  const directory = page.waitForRequest(request => new URL(request.url()).pathname === "/api/administration" && new URL(request.url()).searchParams.get("tenantId") === target);
  finish!(); await directory;
  await expect(page.getByRole("button", { name: "Benutzer einladen", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(sent ? "Eigentümer eingeladen" : "Mailversand fehlgeschlagen");
});
test("Feedback sendet ausschließlich eingegebene Nachricht und technische Seitenkategorie", async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/feedback", async route => { body = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await page.goto("/feedback");
  await page.getByLabel("Nachricht", { exact: true }).fill("Test feedback");
  await page.getByRole("button", { name: "Feedback senden", exact: true }).click();
  await expect(page.getByText("Vielen Dank. Dein Feedback wurde gespeichert.")).toBeVisible();
  expect(body).toEqual({ category: "problem", message: "Test feedback", pagePath: "/feedback" });
});
