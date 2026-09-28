# Phase 3C Customer Cutover Checklist

Recorded before implementation on 28 September 2026.

## Current data paths

- [x] Customer lists are read from the full `app_state` snapshot, the
  `sync-section:customers` row, browser `localStorage` and
  `homecare_customers`.
- [x] `/api/sync-sections` writes the complete JSON list first and only then
  attempts a best-effort relational upsert. Missing list entries do not delete
  relational rows.
- [x] Relational reads replace JSON only when their newest `updated_at` wins;
  an empty relational table cannot authoritatively clear stale JSON.
- [x] The frontend stores pending customer changes as a whole-section key and
  can resend an old complete customer list after reconnect.
- [x] The current UI exposes one contact person through the customer fields
  `contact`, `email`, `phone` and `phone2`; there is no independent contact
  identity, revision or delete contract.
- [x] Portal login history is customer-owned communication metadata. Portal
  messages remain outside this cutover as their own later domain.

## Dependencies

- [x] `homecare_objects.owner_customer_id` and `homecare_jobs.customer_id`
  reference customers and must remain intact through archive/delete.
- [x] Billing items, inventory movements and portal messages retain customer
  references for business and audit history.
- [x] `homecare_portal_access` scopes portal users to a customer. Customer
  tombstones must not cascade-delete that evidence.
- [x] Portal invitation and context routes must reject tombstoned customers
  without widening portal scope.
- [x] Customer `objects` is a read projection from relational object ownership,
  not customer master data and must not trigger customer mutations.

## Target source of truth

- [x] `homecare_customers` is authoritative for tenant-scoped customer master
  records with stable ID, revision, archive state and tombstone.
- [x] `homecare_customer_contacts` is authoritative for independently
  revisioned contact persons. Existing single-contact fields are migrated to a
  stable primary contact without data loss.
- [x] Customer and contact writes use the shared durable mutation queue and
  tenant-scoped mutation journal.
- [x] `/api/sync-sections` and `/api/app-state` reject or strip customer writes.
- [x] Relational empty/deleted results are authoritative and cannot be filled
  from stale JSON or browser section state.

## Delete and archive rules

- [x] Archive is a revisioned customer update and preserves all references.
- [x] Delete creates a tombstone; no customer or contact is hard-deleted by the
  application mutation path.
- [x] Customer delete requires the customer to be archived first.
- [x] Customer delete is rejected while active objects/jobs, open billing or an
  active portal assignment exists.
- [x] Successful customer tombstoning also tombstones live contacts while
  preserving object, job, billing, inventory, portal and message references.
- [x] Contact delete creates a contact tombstone and cannot be resurrected by
  the compatibility projection or legacy JSON.

## Read and write cutover

- [x] Pending offline customer/contact mutations overlay relational reads
  record by record.
- [x] Customer whole-section keys are removed from pending-section handling.
- [x] Legacy customer reads are available only with
  `WORKCORE_CUSTOMER_LEGACY_READ_FALLBACK=1`, emit
  `LEGACY_CUSTOMER_READ_FALLBACK`, and never enable JSON writes.
- [x] Portal routes continue using explicit tenant/customer scope and ignore
  tombstoned customers.

## Rollback rule

Rollback may enable the observable read-only customer fallback while
record-level customer/contact writes remain active. It must not re-enable
JSON-first writes, whole-list overwrites or hard deletes. Reconcile the durable
mutation queue and relational revisions before disabling the fallback again.

## Local verification

Verified on 28 September 2026 against local PostgreSQL 17.11:

- the migration applied cleanly and remained idempotent on a second run;
- a legacy-data rehearsal preserved JSON-only customers and contacts while
  keeping existing relational customer values authoritative;
- Phase 3C, Auth/RLS, Sync Foundation, Phase 3A and Phase 3B SQL suites passed;
- TypeScript, the production build, all 62 Playwright tests and
  `git diff --check` passed.

## Dedicated staging verification

Verified on 28 September 2026 against the dedicated `WorkCore Staging`
Supabase project (`ealfegjvbyiiporettpq`):

- the migration applied and remained idempotent on repeated execution;
- Phase 3C, Auth/RLS, Sync Foundation, Phase 3A and Phase 3B SQL suites passed;
- real PostgREST/RLS, portal scope, dependency guards, tombstones, hard-delete
  protection, offline replay and stale revision conflicts passed;
- the fallback stayed disabled by default, was read-only when explicitly
  enabled, emitted telemetry and never overrode relational rows or tombstones;
- all 62 Playwright tests, TypeScript, the production build and
  `git diff --check` passed;
- all temporary staging records and users were removed after verification.

Phase 3C is commit-ready. Production migration remains a separate, explicitly
authorised operation.
