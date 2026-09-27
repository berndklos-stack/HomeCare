# Tenant, RLS and Role Model

## Tables

- `homecare_roles`: company-specific role and permission definitions.
- `homecare_tenant_memberships`: active, suspended or revoked staff assignments.
- `homecare_portal_access`: customer-scoped portal assignments, separate from staff membership.
- Domain tables: carry `tenant_id` and are protected by tenant-aware RLS.

## Request flow

1. Supabase Auth validates the bearer token.
2. The server loads active assignments for `auth.users.id` using the service role.
3. The requested tenant and route permission are resolved.
4. Relational work uses a user-scoped Supabase client carrying the same tenant header.
5. RLS independently checks identity, permission and active tenant.

No fallback tenant is selected on the server. Missing tenant context is an error. This avoids accidental access when a user belongs to several companies.

## Portal boundary

Portal users do not receive staff membership. Portal queries use their `homecare_portal_access.customer_id`, then constrain objects, jobs, reports and messages to that customer. A portal assignment for one company does not grant access to any other company.

## Current transition boundary

`app_state` and section sync are still legacy data architecture. They are now authenticated, tenant-keyed and RLS protected, but remain whole-snapshot/section mechanisms. They must be retired module by module; this hardening phase does not migrate additional business modules.

The daily mail cron is still based on the legacy single-company state. It is secret-protected but must be redesigned before multi-company scheduling is enabled.
