import { expect, test } from "@playwright/test";
import { GET } from "../app/api/cron/daily-jobs/route";

test.describe("Automatische Tagesmail ohne Mandanten-Header", () => {
  let originalFetch: typeof fetch;
  let originalEnv: NodeJS.ProcessEnv;
  let requests: URL[];
  let discovery: { tenant_id: string }[];
  let active: { id: string }[];
  let failTenant: string;
  let due: boolean;
  let sentKeys: Map<string, string[]>;

  test.beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cron-test.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.RESEND_API_KEY = "test-resend-key";
    requests = [];
    discovery = [{ tenant_id: "COMPANY-A" }, { tenant_id: "COMPANY-B" }, { tenant_id: "ARCHIVED" }];
    active = [{ id: "COMPANY-A" }, { id: "COMPANY-B" }];
    failTenant = "";
    due = false;
    sentKeys = new Map();
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push(url);
      const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
      const table = url.pathname.split("/").at(-1);
      const tenant = url.searchParams.get("tenant_id")?.replace(/^eq\./, "");
      if (url.origin === "https://api.resend.com") return json({ id: "simulated-mail" });
      if (url.pathname.includes("/rpc/")) {
        const body = JSON.parse(String(init?.body));
        if (table === "homecare_claim_daily_mail_send") return json(true);
        if (table === "homecare_complete_daily_mail_send") {
          sentKeys.set(body.p_tenant_id, [...(sentKeys.get(body.p_tenant_id) ?? []), body.p_send_key]);
          return json(null);
        }
      }
      if (table === "homecare_settings" && url.searchParams.get("select") === "tenant_id") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        return json(discovery.slice(offset, offset + 100));
      }
      if (table === "homecare_tenants") return json(active);
      if (table === "homecare_daily_mail_state") return json([{ sent_keys: sentKeys.get(tenant ?? "") ?? [] }]);
      if (table === "homecare_jobs" && tenant === failTenant) return new Response(JSON.stringify({ message: "Test database failure" }), { status: 500 });
      if (table === "homecare_jobs" || table === "homecare_objects") return json([]);
      if (table === "homecare_settings") {
        const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Stockholm", weekday: "short" }).format(new Date());
        const tomorrow = String((["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) + 1) % 7);
        return json([{ value: { enabled: true, frequency: due ? "daily" : "custom", weekdays: [tomorrow], sendTimes: ["00:00"],
          toRecipients: "test@example.invalid", ccRecipients: "", calendarSources: "", birthdaySources: "", reminderSources: "" } }]);
      }
      throw new Error(`Unexpected network request: ${url.origin}${url.pathname}`);
    };
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  const request = (headers: Record<string, string> = {}) => new Request("https://workcore.invalid/api/cron/daily-jobs", {
    headers: { authorization: "Bearer test-cron-secret", ...headers },
  });

  test("Vercel-Aufruf findet eingeschaltete aktive Firmen und liest jede Firma getrennt", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.map((result: { tenantId: string }) => result.tenantId)).toEqual(["COMPANY-A", "COMPANY-B"]);
    expect(body.results.every((result: { result: { skipped: boolean } }) => result.result.skipped)).toBe(true);
    const discoveryRequest = requests.find((url) => url.searchParams.get("select") === "tenant_id")!;
    expect(discoveryRequest.searchParams.get("value->>enabled")).toBe("eq.true");
    expect(discoveryRequest.searchParams.get("deleted_at")).toBe("is.null");
    expect(requests.find((url) => url.pathname.endsWith("homecare_tenants"))!.searchParams.get("archived")).toBe("eq.false");
    expect(requests.filter((url) => url.pathname.endsWith("homecare_jobs")).map((url) => url.searchParams.get("tenant_id")))
      .toEqual(["eq.COMPANY-A", "eq.COMPANY-B"]);
  });

  test("fehlende Cron-Autorisierung löst keine Datenabfrage aus", async () => {
    expect((await GET(new Request("https://workcore.invalid/api/cron/daily-jobs"))).status).toBe(401);
    expect(requests).toHaveLength(0);
  });

  test("ausgeschaltete Firmen lösen keinen Versand aus", async () => {
    discovery = [];
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
    expect(requests).toHaveLength(1);
  });

  test("Fehler einer Firma blockiert die übrigen Firmen nicht", async () => {
    failTenant = "COMPANY-A";
    const response = await GET(request());
    expect(response.status).toBe(500);
    const { results } = await response.json();
    expect(results.map((result: { status: number }) => result.status)).toEqual([500, 200]);
  });

  test("expliziter Mandanten-Aufruf bleibt erhalten", async () => {
    const response = await GET(request({ "x-workcore-tenant": "COMPANY-A" }));
    expect(response.status).toBe(200);
    expect((await response.json()).skipped).toBe(true);
    expect(requests.some((url) => url.pathname.endsWith("homecare_tenants"))).toBe(false);
  });

  test("fällige Mails werden getrennt gespeichert und beim nächsten Cron nicht doppelt gesendet", async () => {
    due = true;
    expect((await GET(request())).status).toBe(200);
    expect(requests.filter((url) => url.origin === "https://api.resend.com")).toHaveLength(2);
    expect([...sentKeys.keys()]).toEqual(["COMPANY-A", "COMPANY-B"]);
    const second = await GET(request());
    expect(second.status).toBe(200);
    expect((await second.json()).results.every((result: { result: { skipped: boolean } }) => result.result.skipped)).toBe(true);
    expect(requests.filter((url) => url.origin === "https://api.resend.com")).toHaveLength(2);
  });

  test("Mandanten-Ermittlung berücksichtigt auch die zweite Ergebnisseite", async () => {
    discovery = Array.from({ length: 101 }, (_, index) => ({ tenant_id: `COMPANY-${index}` }));
    active = [];
    expect((await GET(request())).status).toBe(200);
    expect(requests.filter((url) => url.searchParams.get("select") === "tenant_id")
      .map((url) => url.searchParams.get("offset"))).toEqual(["0", "100"]);
  });
});
