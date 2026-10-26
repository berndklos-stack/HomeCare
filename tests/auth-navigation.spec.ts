import { expect, test } from "@playwright/test";

const user = { id: "12345678-1234-4123-a123-123456789012", email: "demo@example.invalid", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-25T00:00:00Z" };
const tenantId = "00000000-0000-0000-0000-000000000001";
const context = { user, activeTenantId: tenantId, platformAdmin: true, portalAccess: [], memberships: [{ tenantId, tenantName: "Testfirma", tenantSlug: "test", roleKey: "owner", roleName: "Owner", permissions: ["data.read", "tenant.admin"] }] };

async function seedSession(page: import("@playwright/test").Page) {
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url"), "test-signature"].join(".");
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem("sb-auth-demo-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user }));
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
  }, { user, token });
  await page.route("**/auth/v1/**", route => route.abort());
  await page.route(url => url.pathname === "/api/administration", route => route.fulfill({ json: { company: { id: tenantId, name: "Testfirma" }, roles: [], members: [], employees: [], modules: [], feedback: [], platformAdmin: true, canManageCompany: true, canManageMembers: true, canManageRoles: true, owner: true } }));
  await page.route("**/api/administration/companies**", route => route.fulfill({ json: { companies: [], total: 0 } }));
}

for (const pathname of ["/administration", "/feedback"]) {
  for (const width of [390, 820]) test(`Bestehende Sitzung zeigt kein Login waehrend der Zugriffspruefung: ${pathname} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seedSession(page);
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route("**/api/auth/context", async route => {
      requested = true;
      await gate;
      await route.fulfill({ json: context });
    });
    await page.goto(`${pathname}?workcore-auth-test=session`);
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByRole("status")).toContainText("Sitzung wird geprüft");
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: pathname === "/administration" ? "Administration" : "Feedback senden", exact: true })).toHaveCount(0);
    release!();
    await expect(page.getByRole("heading", { name: pathname === "/administration" ? "Administration" : "Feedback senden", exact: true })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test(`Ohne Sitzung bleibt die Anmeldung erforderlich: ${pathname}`, async ({ page }) => {
    let checks = 0;
    await page.route("**/api/auth/context", route => { checks++; return route.fulfill({ json: context }); });
    await page.goto(`${pathname}?workcore-auth-test=logged-out`);
    await expect(page.getByLabel("E-Mail", { exact: true })).toBeEnabled();
    await expect(page.getByLabel("Passwort", { exact: true })).toBeVisible();
    expect(checks).toBe(0);
    await expect(page.getByRole("heading", { name: pathname === "/administration" ? "Administration" : "Feedback senden", exact: true })).toHaveCount(0);
  });

  test(`Abgewiesener Firmenzugriff zeigt keine geschuetzten Inhalte: ${pathname}`, async ({ page }) => {
    await seedSession(page);
    await page.route("**/api/auth/context", route => route.fulfill({ status: 403, json: { error: "Firmenzugriff verweigert." } }));
    await page.goto(`${pathname}?workcore-auth-test=denied`);
    await expect(page.locator("main.auth-app").getByRole("alert")).toContainText("Firmenzugriff verweigert.");
    await expect(page.getByLabel("Passwort", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: pathname === "/administration" ? "Administration" : "Feedback senden", exact: true })).toHaveCount(0);
  });
}

test("Feedback-Menue navigiert intern ohne vollstaendigen Seitenneustart", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} })); });
  await page.route("**/api/auth/context", route => route.fulfill({ json: context }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => { Object.assign(window, { workcoreNavigationMarker: "same-document" }); });
  await page.getByRole("link", { name: "Feedback senden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Feedback senden", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { workcoreNavigationMarker?: string }).workcoreNavigationMarker)).toBe("same-document");
});
