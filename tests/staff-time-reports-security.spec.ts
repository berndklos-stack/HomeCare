import { expect, test } from "@playwright/test";
import { GET } from "../app/api/staff-time/route";

test("Personalberichte bleiben admin- und mandantengebunden; Mitarbeiter lesen nur eigene Zeiten", async () => {
  const originalEnv = { ...process.env }; const originalFetch = globalThis.fetch;
  const tenant = "00000000-0000-4000-8000-000000000001";
  let manager = false; const requests: URL[] = [];
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://staff-security.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service";
    process.env.WORKCORE_E2E_AUTH_BYPASS = "0";
    globalThis.fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : String(input)); requests.push(url);
      const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
      if (url.pathname === "/auth/v1/user") return json({ id: "00000000-0000-4000-8000-000000000002", email: "worker@example.invalid" });
      if (url.pathname.endsWith("/homecare_account_session_status")) return json({ mustChangePassword: false, reauthRequired: false, expired: false });
      const table = url.pathname.split("/").at(-1);
      if (table === "homecare_tenant_memberships") return json(url.searchParams.get("select") === "employee_id" ? { employee_id: "PER-1" } : [{ tenant: { id: tenant, name: "Test", slug: "test" }, role: { key: "employee", name: "Employee", permissions: ["data.read", ...(manager ? ["tenant.admin"] : [])] } }]);
      if (table === "homecare_tenant_modules") return json({ enabled: true });
      if (table === "homecare_personnel") return json([{ id: "PER-1", first_name: "Example", last_name: "Worker" }]);
      if (table?.startsWith("homecare_staff_")) return json([]);
      throw new Error(`Unexpected request ${url.pathname}`);
    };
    const request = (query: string, target = tenant) => new Request(`https://workcore.invalid/api/staff-time?month=2026-10&${query}`, { headers: { authorization: "Bearer test-token", "x-workcore-tenant": target } });
    expect((await GET(request("scope=company"))).status).toBe(403);
    expect(requests.some(url => url.pathname.includes("homecare_staff_"))).toBe(false);
    requests.length = 0;
    expect((await GET(request("employeeId=PER-2"))).status).toBe(403);
    expect((await GET(request(""))).status).toBe(200);
    const own = requests.filter(url => url.pathname.includes("homecare_staff_"));
    expect(own.length).toBeGreaterThan(0);
    for (const url of own) { expect(url.searchParams.get("tenant_id")).toBe(`eq.${tenant}`); expect(url.searchParams.get("employee_id")).toBe("eq.PER-1"); }
    manager = true; requests.length = 0;
    expect((await GET(request("scope=company"))).status).toBe(200);
    const company = requests.filter(url => url.pathname.includes("homecare_staff_"));
    expect(company.length).toBeGreaterThan(0);
    for (const url of company) { expect(url.searchParams.get("tenant_id")).toBe(`eq.${tenant}`); expect(url.searchParams.has("employee_id")).toBe(false); }
    requests.length = 0;
    expect((await GET(request("scope=company", "00000000-0000-4000-8000-000000000003"))).status).toBe(403);
    expect(requests.some(url => url.pathname.includes("homecare_staff_"))).toBe(false);
  } finally { globalThis.fetch = originalFetch; process.env = originalEnv; }
});
