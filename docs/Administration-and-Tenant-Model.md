# Administration and Tenant Model

Administration must be powerful without becoming an ERP settings maze.

## Company model
Each company may have its own:
- legal identity
- tax settings
- currency
- language/timezone
- numbering
- invoice defaults
- modules
- templates
- users/teams
- permissions
- integrations

## Multi-company
Support separate identity, numbering, taxation, reporting and permissions with optional shared master data.

## User administration
Invite, activate/deactivate, assign roles/companies/teams, revoke sessions and transfer open responsibilities when staff leave.

## Permissions
Support view/create/edit/approve/delete/export/admin. Enforce all security-relevant checks server-side.

Current V1 foundation: Supabase Auth provides identity; `homecare_tenant_memberships` assigns users to companies; tenant-owned `homecare_roles` carry extensible permissions. Every protected API request validates both the selected company and the required permission. See `docs/architecture/authentication-and-authorization.md` and `docs/architecture/tenant-rls-and-roles.md`.

## Delegation
Vacation, illness, temporary absence, approval limits, dates and auditability.

## Module management
Enable/disable per company; validate dependencies before disabling.

## Defaults
Provide safe defaults for roles, statuses, numbering, invoice terms, workflow basics and common module settings.

## Configuration hierarchy
Prefer:
1. platform default
2. company default
3. team/site override
4. customer/project/object override where justified

## Audit/versioning
Critical configuration changes need actor/time/old/new value. Important workflows/templates/permissions should support versioning and rollback where practical.

## Impact preview
Show likely effects before critical changes.

## Admin health dashboard
Surface sync failures, conflicts, integration failures, users without roles, expiring credentials, migration/import issues and abnormal errors.
