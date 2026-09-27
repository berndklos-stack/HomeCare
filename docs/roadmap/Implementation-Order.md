# WorkCore Implementation Order

This order combines the roadmap workshop with the V1 readiness audit.

## Phase 0 — Freeze uncontrolled feature expansion
Do not start broad new-module development until critical blockers are resolved.

## Phase 1 — Authentication, Tenant Isolation, RLS and Roles
Resolve:
- authoritative authentication
- tenant/company context
- server-side authorization
- RLS / tenant isolation
- role model
- secure portal login
- service-role review
- multi-company membership rules

## Phase 2 — Verify Sync Foundation Against Real PostgreSQL
Verify:
- migration
- mutation RPC
- revision conflicts
- idempotency
- tombstones
- one-active-trip constraint
- kilometer rules
- concurrency
- existing-data preservation

## Phase 3 — End Parallel Source-of-Truth Writes
Converge away from competing writes between:
- `app_state`
- relational tables
- local caches

Target:
- server SSOT
- record-level mutations
- stable UUIDs
- revisions
- tombstones
- durable offline queue

## Phase 4 — Harden Customers and Objects
Add/verify auth, tenant scope, record-level sync, mobile/offline, conflict handling, deletion/restore and tests.

## Phase 5 — Harden Jobs, Planning and Recurring Work
Secure and stabilize jobs, scheduling, recurring work, resource assignment, mobile/offline and tests.

## Phase 6 — Harden Reports, Media and Communication
Unify media permissions/deletion, protect communication routes, make sends idempotent, enforce internal/external visibility.

## Phase 7 — Harden Invoices, Payments and Accounting Export
Make numbering server-authoritative, writes transactional and idempotent, tenant-safe, deterministic and tested.

## Phase 8 — Harden Inventory, Resources and Maintenance
Make stock/resource state authoritative and safe, with stable IDs, history and appropriate offline behavior.

## Phase 9 — Complete Backup / Restore / Export
Cover DB + object storage, test restore, document recovery, support tenant-scoped export.

## Phase 10 — Complete remaining V1 gaps
Only after foundations are stable, close remaining V1 gaps based on the readiness audit.

## Phase 11 — Release hardening
Add CI/security/multi-tenant/sync/migration/mobile/localization/performance gates, status page and go-live checklist.

## Phase 12 — Launch review
Launch only when critical security, data-loss, migration, backup/restore and core-workflow criteria are met.

## Phase 13 — V2
Move to employee portal, role-based dashboards, push notifications, SSO, advanced approvals, advanced monitoring, workflow simulation, anomaly detection, forecasting and structured e-invoices.
