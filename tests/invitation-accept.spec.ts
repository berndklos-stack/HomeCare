import { test, expect } from "@playwright/test";
import { invitationLinkError } from "../lib/invitationLink";

const user = { id: "12345678-1234-4123-a123-123456789012", email: "demo@example.invalid", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-24T00:00:00Z" };
function fakeToken() {
  return [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url"), "test-signature"].join(".");
}

test("Einladungsfehler werden sicher erkannt statt rohe URL-Texte anzuzeigen", () => {
  expect(invitationLinkError("https://app.invalid/auth/accept#error=access_denied&error_code=otp_expired&error_description=private-token")).toContain("abgelaufen");
  expect(invitationLinkError("https://app.invalid/auth/accept?error=access_denied&error_description=private-token")).not.toContain("private-token");
  expect(invitationLinkError("https://app.invalid/auth/accept#access_token=token&type=invite")).toBeNull();
});

for (const width of [390, 820]) test(`Abgelaufene Einladung bietet neuen Link und bleibt bedienbar ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const requests: Record<string, unknown>[] = [];
  await page.route("**/auth/v1/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    expect(new URL(route.request().url()).pathname).toBe("/auth/v1/otp");
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: {}, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await page.goto("/auth/accept#error=access_denied&error_code=otp_expired&error_description=private-token");
  await expect(page.locator("main").getByRole("alert")).toContainText("abgelaufen oder wurde bereits verwendet");
  await expect(page.getByLabel("Passwort festlegen (optional)")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await expect(page.locator("body")).not.toContainText("private-token");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("demo@example.invalid");
  await page.getByRole("button", { name: "Neuen Anmeldelink anfordern" }).click();
  await expect(page.getByRole("status")).toContainText("Wenn für diese Adresse ein Zugang besteht");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ email: "demo@example.invalid", create_user: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`invitation-${width}.png`), fullPage: true });
});

test("Leere Einladung bleibt nicht in einer Sackgasse und sendet Fehler ohne Details", async ({ page }) => {
  await page.route("**/auth/v1/**", route => route.fulfill({ status: 429, json: { msg: "private-provider-error" }, headers: { "Access-Control-Allow-Origin": "*" } }));
  await page.goto("/auth/accept");
  await expect(page.getByLabel("E-Mail-Adresse", { exact: true })).toBeVisible();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("demo@example.invalid");
  await page.getByRole("button", { name: "Neuen Anmeldelink anfordern" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("in einer Minute");
  await expect(page.locator("body")).not.toContainText("private-provider-error");
  await expect(page.getByRole("button", { name: "Neuen Anmeldelink anfordern" })).toBeEnabled();
});

test("Fehlerlink darf trotz vorhandener Sitzung kein Passwortformular freischalten", async ({ page }) => {
  await page.addInitScript(({ user, token }) => localStorage.setItem("sb-auth-demo-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", expires_at: Math.floor(Date.now()/1000)+3600, token_type: "bearer", user })), { user, token: fakeToken() });
  await page.goto("/auth/accept?error=access_denied&error_code=otp_expired");
  await expect(page.locator("main").getByRole("alert")).toContainText("abgelaufen");
  await expect(page.getByRole("button", { name: "Firmenzugang aktivieren" })).toHaveCount(0);
  await expect(page.getByLabel("Passwort festlegen (optional)")).toHaveCount(0);
});

for(const recovery of [false,true])test(`Gueltiger Link erlaubt bestaetigte Passwortvergabe: ${recovery?"Recovery":"Einladung"}`,async({page})=>{
  let updates=0,contexts=0;
  await page.route("**/auth/v1/**",async route=>{
    if(route.request().method()==="OPTIONS")return route.fulfill({status:200,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,PUT,POST,OPTIONS"}});
    expect(new URL(route.request().url()).pathname).toBe("/auth/v1/user");
    if(route.request().method()==="PUT"){updates++;expect(route.request().postDataJSON()).toMatchObject({password:"Test-Passwort-123!"});}
    await route.fulfill({json:user,headers:{"Access-Control-Allow-Origin":"*"}});
  });
  await page.route("**/api/auth/context",route=>{contexts++;return route.fulfill({json:{activeTenantId:"demo-company",memberships:[{tenantId:"demo-company"}]}});});
  await page.route(url=>url.pathname==="/",route=>route.fulfill({contentType:"text/html",body:"<h1>Demo-Firma</h1>"}));
  await page.goto(`/auth/accept#access_token=${fakeToken()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=${recovery?"recovery":"invite"}`);
  await expect(page.getByText("Angemeldet als demo@example.invalid")).toBeVisible();
  await page.getByLabel(recovery?"Neues Passwort":"Passwort festlegen (optional)",{exact:true}).fill("Test-Passwort-123!");
  await page.getByLabel("Passwort bestätigen",{exact:true}).fill("Anderes-Passwort-123!");
  await page.getByRole("button",{name:recovery?"Passwort speichern":"Firmenzugang aktivieren"}).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("zweimal identisch");expect(updates).toBe(0);
  await page.getByLabel("Passwort bestätigen",{exact:true}).fill("Test-Passwort-123!");
  await page.getByRole("button",{name:recovery?"Passwort speichern":"Firmenzugang aktivieren"}).click();
  if(recovery){await expect(page.getByRole("status")).toHaveText("Dein Passwort wurde geändert.");expect(contexts).toBe(0);}
  else{await expect(page.getByRole("heading",{name:"Demo-Firma"})).toBeVisible();expect(contexts).toBe(1);expect(await page.evaluate(()=>sessionStorage.getItem("workcore-active-tenant-id"))).toBe("demo-company");}
  expect(updates).toBe(1);
});
