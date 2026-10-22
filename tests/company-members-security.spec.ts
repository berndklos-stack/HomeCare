import { expect, test } from "@playwright/test";
import { GET, PATCH, POST } from "../app/api/administration/route";
import { PATCH as modulesPatch } from "../app/api/administration/modules/route";
import { GET as brandingGet } from "../app/api/administration/branding/route";
import { GET as companiesGet } from "../app/api/administration/companies/route";

test("Firmenbenutzerverwaltung verlangt Plattformfreigabe und wahrt Heimatfirma, Zielmandant und echten Akteur", async () => {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  const home = "00000000-0000-0000-0000-000000000001", target = "b2112000-0000-4000-8000-000000000002", actor = "a2112000-0000-4000-8000-000000000001";
  let admin = true, archived = false;
  const calls: { url: URL; body: Record<string, unknown> }[] = [];
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://company-security.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service";
    process.env.WORKCORE_E2E_AUTH_BYPASS = "0";
    delete process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, body });
      const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
      const name = url.pathname.split("/").at(-1);
      if (url.pathname === "/auth/v1/user") return json({ id: actor, email: "admin@example.invalid" });
      if (name === "homecare_account_session_status") return json({ mustChangePassword: false, reauthRequired: false, expired: false });
      if (name === "homecare_tenant_memberships") return json([{ tenant: { id: home, name: "Home", slug: "home" }, role: { key: "owner", name: "Owner", permissions: ["data.read", "members.manage", ...(admin ? ["tenant.admin"] : [])] } }]);
      if (name === "homecare_platform_company_detail") return json({ id: target, archived });
      if (name === "homecare_tenants") return json({ id: target, name: "Target" });
      if (name === "homecare_company_user_limits") return json(null);
      if (["homecare_platform_member_directory", "homecare_admin_directory"].includes(name!)) return json({ members: [], total: 0 });
      if (["homecare_platform_member_command", "homecare_admin_member"].includes(name!)) return json({ ok: true });
      if (["homecare_roles", "homecare_personnel", "homecare_tenant_modules", "homecare_feedback"].includes(name!)) return json([]);
      throw new Error(`Unexpected request ${url.pathname}`);
    };
    const request = (method: string, company = target) => new Request(`https://workcore.invalid/api/administration?tenantId=${company}`, { method, headers: { authorization: "Bearer test", "x-workcore-tenant": home, "Content-Type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify({ tenantId: company, action: "suspend", memberId: actor }) } : {}) });
    expect((await GET(request("GET"))).status).toBe(403);
    expect((await PATCH(request("PATCH"))).status).toBe(403);
    expect(calls.some(call => call.url.pathname.endsWith("homecare_platform_company_detail"))).toBe(false);
    process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS = actor;
    admin = false; calls.length = 0;
    expect((await GET(request("GET"))).status).toBe(403);
    expect(calls.some(call => call.url.pathname.includes("homecare_platform_"))).toBe(false);
    admin = true; archived = true;
    expect((await GET(request("GET"))).status).toBe(403);
    archived = false; calls.length = 0;
    expect((await GET(request("GET"))).status).toBe(200);
    expect((await PATCH(request("PATCH"))).status).toBe(200);
    const rpcs = calls.filter(call => /homecare_platform_member_/.test(call.url.pathname));
    expect(rpcs).toHaveLength(2);
    for (const call of rpcs) expect(call.body).toMatchObject({ p_home: home, p_tenant: target, p_actor: actor });
    for (const call of calls.filter(call => /homecare_(roles|personnel|tenant_modules|feedback)$/.test(call.url.pathname))) expect(call.url.searchParams.get("tenant_id")).toBe(`eq.${target}`);
    calls.length = 0;
    expect((await PATCH(request("PATCH", home))).status).toBe(200);
    expect(calls.find(call => call.url.pathname.endsWith("homecare_admin_member"))?.body).toMatchObject({ p_tenant: home, p_actor: actor });
    expect(calls.some(call => call.url.pathname.includes("homecare_platform_"))).toBe(false);
  } finally { globalThis.fetch = originalFetch; process.env = env; }
});

test("Fremdfirma bleibt trotz freigeschaltetem Benutzer von globalen APIs ausgeschlossen; Limit verhindert Auth-Neuanlage", async () => {
  const env = { ...process.env }, oldFetch = globalThis.fetch;
  const tenant = "b2209000-0000-4000-8000-000000000001", actor = "a2209000-0000-4000-8000-000000000001";
  const writes: string[] = [];
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://quota-security.invalid"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service"; process.env.WORKCORE_E2E_AUTH_BYPASS = "0"; process.env.WORKCORE_PLATFORM_ADMIN_USER_IDS = actor;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const name = url.pathname.split("/").at(-1);
      if (init?.method && init.method !== "GET" && init.method !== "HEAD") writes.push(url.pathname);
      const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
      if (url.pathname === "/auth/v1/user") return json({ id: actor, email: "owner@example.invalid" });
      if (name === "homecare_account_session_status") return json({ mustChangePassword: false, reauthRequired: false, expired: false });
      if (name === "homecare_tenant_memberships" && init?.method === "HEAD") return new Response(null, { headers: { "Content-Range": "0-0/1" } });
      if (name === "homecare_tenant_memberships") return json([{ tenant: { id: tenant, name: "Other", slug: "other" }, role: { key: "owner", name: "Owner", permissions: ["data.read", "tenant.admin", "members.manage"] } }]);
      if (name === "homecare_company_user_limits") return json({ max_users: 1 });
      throw new Error(`Unexpected external request ${url.pathname}`);
    };
    const request = (method: string) => new Request("https://workcore.invalid/api/administration", { method, headers: { authorization: "Bearer test", "x-workcore-tenant": tenant, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ email: "new@example.invalid", roleId: actor }) } : {}) });
    expect((await modulesPatch(request("PATCH"))).status).toBe(403);
    expect((await brandingGet(request("GET"))).status).toBe(403);
    expect((await companiesGet(request("GET"))).status).toBe(403);
    expect((await POST(request("POST"))).status).toBe(409);
    expect(writes).toEqual([]);
  } finally { process.env = env; globalThis.fetch = oldFetch; }
});
