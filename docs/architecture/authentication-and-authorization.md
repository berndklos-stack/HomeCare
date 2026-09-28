# Authentication and Authorization

Status: V1 security foundation, 2026-09-27.

## Identity

Supabase Auth is the only authoritative identity provider for staff and portal users. Browser requests send the current Supabase access token as `Authorization: Bearer ...`. API routes validate that token with Supabase before reading application data.

Legacy customer portal passwords are no longer authentication credentials. The security migration clears the relational plaintext column and removes `portalPassword` from legacy JSON snapshots. Portal access requires a Supabase Auth user plus an active `homecare_portal_access` assignment.

Portal invitations are created by the protected `/api/portal/invite` route. It verifies the staff permission and customer tenant, asks Supabase Auth to invite the identity, and grants only the selected customer scope through a service-role-only database function.

## Tenant context

Every authenticated application request must include `X-WorkCore-Tenant`. `homecare_tenant_memberships` is the authoritative assignment between an Auth user and a company. A request is accepted only when the membership is active and its role contains the required permission.

The browser stores only the selected tenant ID. It is not trusted as authorization evidence. The API validates it on every request. Users assigned to multiple companies can switch only among those assignments.

## Roles and permissions

Roles are tenant-owned rows in `homecare_roles`; permissions are stored as an extensible text array. V1 seeds `owner`, `admin`, `manager`, `office` and `field_worker`. Server routes request a named permission and never rely on hidden UI controls.

The first field-worker policy is intentionally narrow. Legacy whole-snapshot writes require `data.write`; field workers use only explicitly permitted modern endpoints until affected legacy sections have granular authorization.

## RLS

Tenant tables use RLS checks combining all three conditions:

1. `auth.uid()` has an active tenant membership.
2. The assigned role contains the required permission.
3. `tenant_id` equals the validated `X-WorkCore-Tenant` request header.

An insert trigger assigns the request tenant for authenticated writes. The trigger is defense in depth; API authorization remains mandatory.

## Service role

The service role remains limited to operations that cannot use ordinary RLS directly: loading the caller's membership context, storage administration/download with an explicit ownership check, portal reads constrained by tenant and customer, and idempotent mutation RPCs. The daily cron is protected by `CRON_SECRET`, requires `X-WorkCore-Tenant`, filters every database read by that tenant and stores its operational state in the tenant-owned `homecare_daily_mail_state` table. Manual daily-mail execution derives the tenant from the authenticated request instead of accepting a caller-supplied tenant.

## Test bypass

The E2E bypass is unavailable in production and requires both server configuration and the explicit `X-WorkCore-E2E-Bypass: 1` header. Merely running a development build does not bypass authentication.
