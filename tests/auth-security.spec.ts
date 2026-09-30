import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  defaultRolePermissions,
  resolvePortalAccess,
  resolveTenantMembership,
  type TenantMembership,
} from "../lib/authModel";
import { activeTenantStorageKey } from "../lib/apiClient";
import { clearEmployeeSessionContext, resolveEmployeeTenantId } from "../components/AuthGate";
import { syncQueueStorageKey } from "../lib/syncQueue";

function membership(tenantId: string, role: keyof typeof defaultRolePermissions): TenantMembership {
  return {
    permissions: defaultRolePermissions[role],
    roleKey: role,
    roleName: role,
    tenantId,
    tenantName: tenantId,
    tenantSlug: tenantId,
  };
}

test("nicht angemeldete API-Zugriffe werden abgewiesen", async ({ request }) => {
  const sync = await request.get("/api/sync-sections?keys=customers", { headers: { "X-WorkCore-E2E-Bypass": "0" } });
  const portal = await request.get("/api/portal/context", { headers: { "X-WorkCore-E2E-Bypass": "0", "X-WorkCore-Tenant": "tenant-a" } });
  expect(sync.status()).toBe(401);
  expect(portal.status()).toBe(401);
});

test("Mandant A kann Mandant B weder lesen noch ändern", () => {
  const memberships = [membership("tenant-a", "admin")];
  expect(resolveTenantMembership(memberships, "tenant-b", "data.read")).toEqual({ error: "TENANT_FORBIDDEN" });
  expect(resolveTenantMembership(memberships, "tenant-b", "data.write")).toEqual({ error: "TENANT_FORBIDDEN" });
});

test("eingeschränkte Rolle scheitert an Admin-Aktion, Admin darf sie ausführen", () => {
  expect(resolveTenantMembership([membership("tenant-a", "field_worker")], "tenant-a", "members.manage"))
    .toEqual({ error: "PERMISSION_DENIED" });
  expect(resolveTenantMembership([membership("tenant-a", "admin")], "tenant-a", "members.manage"))
    .toMatchObject({ membership: { tenantId: "tenant-a" } });
});

test("Mehrfirmenbenutzer erhält nur explizit zugewiesene Firmen", () => {
  const memberships = [membership("tenant-a", "manager"), membership("tenant-c", "office")];
  expect(resolveTenantMembership(memberships, "tenant-c", "data.read")).toMatchObject({ membership: { tenantId: "tenant-c" } });
  expect(resolveTenantMembership(memberships, "tenant-b", "data.read")).toEqual({ error: "TENANT_FORBIDDEN" });
});

test("Portalbenutzer kann seinen Kunden-/Mandantenbereich nicht verlassen", () => {
  const accesses = [{ customerId: "customer-a", tenantId: "tenant-a", tenantName: "A" }];
  expect(resolvePortalAccess(accesses, "tenant-a")).toMatchObject({ access: { customerId: "customer-a" } });
  expect(resolvePortalAccess(accesses, "tenant-b")).toEqual({ error: "PORTAL_SCOPE_FORBIDDEN" });
});

test("E2E-Admin passiert die serverseitige Rollenprüfung nur mit explizitem Testheader", async ({ request }) => {
  const response = await request.post("/api/odometer", {
    data: {},
    headers: {
      "X-WorkCore-E2E-Bypass": "1",
      "X-WorkCore-Tenant": "00000000-0000-0000-0000-000000000001",
    },
  });
  expect([400, 500]).toContain(response.status());
});

test("Service-Role-Routen besitzen Autorisierung und explizite Mandantenbindung", () => {
  const root = process.cwd();
  for (const file of [
    "app/api/media/route.ts",
    "app/api/private-media/route.ts",
    "app/api/portal/context/route.ts",
    "app/api/portal/invite/route.ts",
    "app/api/sync-mutations/route.ts",
    "app/api/app-state/migrate-media/route.ts",
    "app/api/cron/daily-jobs/route.ts",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    expect(source).toMatch(/require(Api|Portal)Auth/);
    expect(source).toMatch(/tenantId|tenant_id|LEGACY_MEDIA_MIGRATION_RETIRED/);
  }
});

test("Cron-Servicezugriffe sind an einen expliziten Mandanten gebunden", () => {
  const source = readFileSync(path.join(process.cwd(), "app/api/cron/daily-jobs/route.ts"), "utf8");
  expect(source).toContain('request.headers.get("x-workcore-tenant")');
  expect(source).toContain('.eq("tenant_id", tenantId)');
  expect(source).toContain('.from("homecare_daily_mail_state")');
  expect(source).toContain('supabase.rpc("homecare_claim_daily_mail_send"');
  expect(source).toContain('supabase.rpc("homecare_complete_daily_mail_send"');
  expect(source).not.toContain('kolaretorp-daily-job-mail');
});

test("private Medien bleiben nach Rechteentzug nicht im langlebigen Browsercache", () => {
  const source = readFileSync(path.join(process.cwd(), "app/api/private-media/route.ts"), "utf8");
  expect(source).toContain('"Cache-Control": "private, no-store"');
  expect(source).toContain("!mediaRecord || mediaRecord.deleted_at");
  expect(source).toContain(".list(folder");
  expect(source).not.toContain("max-age=31536000, immutable");
});

test("neue Medienuploads erzeugen keine öffentlichen Storage-URLs", () => {
  const source = readFileSync(path.join(process.cwd(), "app/api/media/route.ts"), "utf8");
  expect(source).toContain('const mediaBucket = "homecare-private-media"');
  expect(source).toContain("public: false");
  expect(source).toContain("/api/private-media?path=");
  expect(source).not.toContain("getPublicUrl");
  expect(source).not.toContain("/storage/v1/object/public/");
});

test("RLS bindet Datenzugriff an Benutzer, Berechtigung und Request-Mandant", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260927100000_auth_tenant_rls_roles.sql"), "utf8");
  expect(migration).toContain("auth.uid()");
  expect(migration).toContain("homecare_request_tenant()");
  expect(migration).toContain("tenant_id = public.homecare_request_tenant()");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("homecare_objects_customer_tenant_fk");
  expect(migration).toContain("foreign key (tenant_id, resource_id)");
  expect(migration).toContain("revoke all on table public.app_state from anon");
});

test("Portalpasswörter werden aus relationalen und Legacy-Daten entfernt", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260927100000_auth_tenant_rls_roles.sql"), "utf8");
  const customerMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260928160000_customer_contact_relational_cutover.sql"), "utf8");
  const syncRoute = readFileSync(path.join(process.cwd(), "app/api/sync-sections/route.ts"), "utf8");
  expect(migration).toContain("set portal_password = null");
  expect(migration).toContain("customer - 'portalPassword'");
  expect(customerMigration).not.toContain("p_payload->>'portalPassword'");
  expect(syncRoute).toContain('portalPassword: ""');
});

test("Abmeldung entfernt nur den Sitzungskontext und schützt anschließend die Mitarbeiter-App", () => {
  const values = new Map<string, string>([
    [activeTenantStorageKey, "tenant-a"],
    [`${syncQueueStorageKey}:tenant-a`, '[{"status":"conflict"}]'],
    ["kolaretorp-customers:tenant-a", "[]"],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  clearEmployeeSessionContext(storage);

  expect(storage.getItem(activeTenantStorageKey)).toBeNull();
  expect(storage.getItem(`${syncQueueStorageKey}:tenant-a`)).not.toBeNull();
  expect(storage.getItem("kolaretorp-customers:tenant-a")).toBe("[]");
  expect(resolveEmployeeTenantId([], storage.getItem(activeTenantStorageKey))).toBe("");
});

test("erneute Anmeldung stellt den gültigen Mandantenkontext wieder her", () => {
  const memberships = [{ tenantId: "tenant-a" }, { tenantId: "tenant-b" }];
  expect(resolveEmployeeTenantId(memberships, null)).toBe("tenant-a");
  expect(resolveEmployeeTenantId(memberships, "tenant-b")).toBe("tenant-b");
  expect(resolveEmployeeTenantId(memberships, "tenant-x")).toBe("tenant-a");

  const authGate = readFileSync(path.join(process.cwd(), "components/AuthGate.tsx"), "utf8");
  const appPage = readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");
  expect(authGate).toContain("client.auth.signOut()");
  expect(authGate).toContain("setReady(false)");
  expect(authGate).toContain("onAuthStateChange((_event, session)");
  expect(authGate).toContain("establishContext(session)");
  expect(authGate).toContain("establishContext(data.session)");
  expect(appPage).toContain("<EmployeeLogoutButton");
});
