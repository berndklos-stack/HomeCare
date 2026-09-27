import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  defaultRolePermissions,
  resolvePortalAccess,
  resolveTenantMembership,
  type PortalAccess,
  type TenantMembership,
  type WorkcorePermission,
} from "@/lib/authModel";

type RoleRow = { key: string; name: string; permissions: string[] };
type MembershipRow = {
  role: RoleRow | RoleRow[] | null;
  tenant: { id: string; name: string; slug: string } | Array<{ id: string; name: string; slug: string }> | null;
};
type PortalRow = {
  customer_id: string;
  tenant: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

export type ApiAuthContext = {
  client: SupabaseClient;
  membership: TenantMembership;
  serviceClient: SupabaseClient;
  tenantId: string;
  user: User;
};

export type PortalAuthContext = {
  access: PortalAccess;
  serviceClient: SupabaseClient;
  user: User;
};

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase-Authentifizierung ist nicht vollständig konfiguriert.");
  return { anonKey, serviceKey, url };
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function userClient(token: string, tenantId?: string) {
  const { anonKey, url } = env();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (tenantId) headers["X-WorkCore-Tenant"] = tenantId;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers },
  });
}

export function serviceClient() {
  const { serviceKey, url } = env();
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const client = userClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, user: data.user };
}

export async function loadMemberships(admin: SupabaseClient, userId: string): Promise<TenantMembership[]> {
  const { data, error } = await admin
    .from("homecare_tenant_memberships")
    .select("tenant:homecare_tenants!inner(id,name,slug),role:homecare_roles!inner(key,name,permissions)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MembershipRow[]).flatMap((row) => {
    const tenant = first(row.tenant);
    const role = first(row.role);
    if (!tenant || !role) return [];
    return [{
      permissions: (role.permissions ?? []).filter((item): item is WorkcorePermission => typeof item === "string"),
      roleKey: role.key,
      roleName: role.name,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
    }];
  });
}

export async function loadPortalAccess(admin: SupabaseClient, userId: string): Promise<PortalAccess[]> {
  const { data, error } = await admin
    .from("homecare_portal_access")
    .select("customer_id,tenant:homecare_tenants!inner(id,name)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PortalRow[]).flatMap((row) => {
    const tenant = first(row.tenant);
    return tenant ? [{ customerId: row.customer_id, tenantId: tenant.id, tenantName: tenant.name }] : [];
  });
}

function testBypass(request: Request): ApiAuthContext | null {
  if (process.env.NODE_ENV === "production" || process.env.WORKCORE_E2E_AUTH_BYPASS !== "1") return null;
  if (request.headers.get("x-workcore-e2e-bypass") !== "1") return null;
  const tenantId = request.headers.get("x-workcore-tenant") || "00000000-0000-0000-0000-000000000001";
  const admin = serviceClient();
  return {
    client: admin,
    membership: {
      permissions: defaultRolePermissions.owner,
      roleKey: "owner",
      roleName: "Owner",
      tenantId,
      tenantName: "E2E Tenant",
      tenantSlug: "e2e",
    },
    serviceClient: admin,
    tenantId,
    user: { id: "00000000-0000-0000-0000-000000000099", email: "e2e@workcore.local" } as User,
  };
}

export async function requireApiAuth(request: Request, permission: WorkcorePermission): Promise<ApiAuthContext | NextResponse> {
  try {
    const bypass = testBypass(request);
    if (bypass) return bypass;
    const identity = await authenticatedUser(request);
    if (!identity) return NextResponse.json({ error: "Authentifizierung erforderlich." }, { status: 401 });
    const admin = serviceClient();
    const memberships = await loadMemberships(admin, identity.user.id);
    const requestedTenantId = request.headers.get("x-workcore-tenant");
    const resolved = resolveTenantMembership(memberships, requestedTenantId, permission);
    if ("error" in resolved) {
      const status = resolved.error === "TENANT_REQUIRED" ? 400 : 403;
      return NextResponse.json({ error: resolved.error }, { status });
    }
    return {
      client: userClient(bearerToken(request), resolved.membership.tenantId),
      membership: resolved.membership,
      serviceClient: admin,
      tenantId: resolved.membership.tenantId,
      user: identity.user,
    };
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Autorisierung fehlgeschlagen." }, { status: 500 });
  }
}

export async function requirePortalAuth(request: Request): Promise<PortalAuthContext | NextResponse> {
  try {
    const identity = await authenticatedUser(request);
    if (!identity) return NextResponse.json({ error: "Authentifizierung erforderlich." }, { status: 401 });
    const admin = serviceClient();
    const accesses = await loadPortalAccess(admin, identity.user.id);
    const tenantId = request.headers.get("x-workcore-tenant");
    const resolved = resolvePortalAccess(accesses, tenantId);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.error === "TENANT_REQUIRED" ? 400 : 403 });
    return { access: resolved.access, serviceClient: admin, user: identity.user };
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Portal-Autorisierung fehlgeschlagen." }, { status: 500 });
  }
}

export function isAuthError(value: ApiAuthContext | PortalAuthContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
