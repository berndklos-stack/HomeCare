import { expect, test } from "@playwright/test";
import { feedbackPath, validateCompany, validEmail, validUuid, type AdministrationData, type CompanyInput } from "../lib/administration";
import { defaultRolePermissions } from "../lib/authModel";
import { deliverInvitation, isPlatformAdmin } from "../lib/server/administration";
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
    expect(isPlatformAdmin("two")).toBe(true); expect(isPlatformAdmin("three")).toBe(false);
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
test("Administrations-APIs lehnen anonyme Aufrufe ab", async ({ request }) => {
  for (const [url, method] of [["/api/administration", "GET"], ["/api/administration", "POST"], ["/api/administration", "PATCH"], ["/api/administration/companies", "POST"], ["/api/administration/companies", "PATCH"], ["/api/administration/modules", "PATCH"], ["/api/feedback", "POST"]]) {
    const response = await request.fetch(url, { method, headers: { "X-WorkCore-E2E-Bypass": "0" }, data: {} });
    expect(response.status()).toBe(401);
  }
});
test("UI-Testbypass darf keine echten Benutzer oder Feedbackeinträge schreiben", async ({ request }) => {
  for (const url of ["/api/administration", "/api/feedback"]) {
    const response = await request.post(url, { data: {} }); expect(response.status()).toBe(503);
  }
});

for (const width of [390, 820, 1440]) {
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
    await page.route("**/api/administration/companies", route => route.fulfill({ json: { companies: [] } }));
    await page.goto("/administration");
    await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Benutzer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example Owner" })).toBeVisible();
    await page.getByRole("button", { name: "Benutzer einladen", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await dialog.getByLabel("E-Mail", { exact: true }).fill("worker@example.invalid");
    await dialog.getByLabel("Mitarbeiter (optional)").selectOption("employee");
    await dialog.getByRole("button", { name: "Einladen", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(invited).toMatchObject({ email: "worker@example.invalid", employeeId: "employee" });
    await page.getByLabel("Suche", { exact: true }).fill("not-found");
    await expect(page.getByText("Keine Benutzer gefunden.")).toBeVisible();
    await page.getByRole("button", { name: "Rollen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rollen & Berechtigungen" })).toBeVisible();
    await expect(page.getByText("Benutzer verwalten", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pilot/Test", exact: true }).click();
    await page.getByLabel("Firmenname", { exact: true }).fill("Pilot B");
    await page.getByLabel("Eigentümer-E-Mail").fill("pilot-b@example.invalid");
    await expect(page.getByRole("button", { name: "Firma anlegen" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/administration-${width}-${test.info().project.name}.png`, fullPage: true });
  });
}
test("Feedback sendet ausschließlich eingegebene Nachricht und technische Seitenkategorie", async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/feedback", async route => { body = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await page.goto("/feedback");
  await page.getByLabel("Nachricht", { exact: true }).fill("Test feedback");
  await page.getByRole("button", { name: "Feedback senden", exact: true }).click();
  await expect(page.getByText("Vielen Dank. Dein Feedback wurde gespeichert.")).toBeVisible();
  expect(body).toEqual({ category: "problem", message: "Test feedback", pagePath: "/feedback" });
});
