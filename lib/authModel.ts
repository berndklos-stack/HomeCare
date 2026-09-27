export const workcorePermissions = [
  "data.read",
  "data.write",
  "customers.manage",
  "objects.manage",
  "jobs.manage",
  "invoices.manage",
  "resources.manage",
  "media.manage",
  "communication.send",
  "sync.write",
  "backups.manage",
  "tenant.admin",
  "members.manage",
  "roles.manage",
] as const;

export type WorkcorePermission = typeof workcorePermissions[number];
export type WorkcoreRoleKey = "owner" | "admin" | "manager" | "office" | "field_worker";

export type TenantMembership = {
  permissions: WorkcorePermission[];
  roleKey: string;
  roleName: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

export type PortalAccess = {
  customerId: string;
  tenantId: string;
  tenantName: string;
};

export type AuthContextPayload = {
  activeTenantId: string | null;
  memberships: TenantMembership[];
  portalAccess: PortalAccess[];
  user: { email: string; id: string };
};

export const defaultRolePermissions: Record<WorkcoreRoleKey, WorkcorePermission[]> = {
  owner: [...workcorePermissions],
  admin: [...workcorePermissions],
  manager: [
    "data.read", "data.write", "customers.manage", "objects.manage", "jobs.manage",
    "invoices.manage", "resources.manage", "media.manage", "communication.send", "sync.write",
  ],
  office: [
    "data.read", "data.write", "customers.manage", "objects.manage", "jobs.manage",
    "invoices.manage", "resources.manage", "media.manage", "communication.send", "sync.write",
  ],
  field_worker: ["data.read", "jobs.manage", "resources.manage", "media.manage", "sync.write"],
};

export function membershipAllows(membership: Pick<TenantMembership, "permissions">, permission: WorkcorePermission) {
  return membership.permissions.includes(permission);
}

export function resolveTenantMembership(
  memberships: TenantMembership[],
  requestedTenantId: string | null,
  permission: WorkcorePermission,
) {
  if (!requestedTenantId) return { error: "TENANT_REQUIRED" as const };
  const membership = memberships.find((item) => item.tenantId === requestedTenantId);
  if (!membership) return { error: "TENANT_FORBIDDEN" as const };
  if (!membershipAllows(membership, permission)) return { error: "PERMISSION_DENIED" as const };
  return { membership };
}

export function resolvePortalAccess(accesses: PortalAccess[], requestedTenantId: string | null) {
  if (!requestedTenantId) return { error: "TENANT_REQUIRED" as const };
  const access = accesses.find((item) => item.tenantId === requestedTenantId);
  return access ? { access } : { error: "PORTAL_SCOPE_FORBIDDEN" as const };
}
