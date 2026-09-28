# Phase 3B Settings Cutover Checklist

Recorded before implementation on 28 September 2026.

## Current paths

- [x] `companySettings` and `dailyMailSettings` are read from the full
  `app_state` snapshot, `sync-section:*`, browser `localStorage` and
  `homecare_settings`.
- [x] Their writes go to JSON first through `/api/sync-sections`; the relational
  upsert is best-effort and failures are reduced to warnings.
- [x] `tenantSettings` is read from JSON plus `homecare_tenants`, the latest
  subscription and module rows. Its relational loader incorrectly targets the
  historical default tenant instead of the authenticated request tenant.
- [x] Tenant-setting writes may trust a tenant ID supplied by the payload and
  therefore are not an acceptable authoritative write boundary.
- [x] `translationOverrides` is a whole-section JSON list plus
  `homecare_translations`; empty or removed translations can return from JSON.
- [x] Daily-mail configuration is mirrored in `homecare_settings`, while send
  history is stored in the `app_state` row `kolaretorp-daily-job-mail`.
- [x] The cron route requires an explicit `X-WorkCore-Tenant`, but still reads
  the full legacy snapshot and records operational state in generic JSON.

## Target ownership

- [x] `homecare_settings` is authoritative for company and daily-mail
  configuration, with tenant scope, revision and tombstone.
- [x] Tenant plan, subscription interval/status and module switches are one
  revisioned aggregate rooted in `homecare_tenants`; request tenant identity is
  authoritative and payload tenant IDs are ignored.
- [x] `homecare_translations` is authoritative per translation key, with
  revision and tombstone semantics.
- [x] Daily-mail operational state is separate from configuration and stored in
  a tenant-owned relational state table with an atomic send claim.
- [x] All mutable writes use the shared durable mutation queue and mutation
  journal. No setting is written as a whole sync section or full snapshot.
- [x] Relational reads return authoritative empty/deleted states so legacy JSON
  cannot restore removed values.

## Read and write cutover

- [x] `/api/sync-sections` excludes these domains from normal JSON fallback
  reads and rejects their writes.
- [x] `/api/app-state` strips these domains from writes and client responses.
- [x] A read-only fallback is available only through
  `WORKCORE_SETTINGS_LEGACY_READ_FALLBACK=1` and emits
  `LEGACY_SETTINGS_READ_FALLBACK` telemetry plus a response header.
- [x] Enabling fallback never restores JSON writes.
- [x] Pending offline setting/translation mutations overlay relational reads
  record-by-record.

## Verification gate

- [x] Setting create/update/delete/restore and stale revision checks pass.
- [x] Company, daily-mail, tenant and translation writes remain tenant-isolated.
- [x] Translation deletion cannot be resurrected from `app_state`.
- [x] Legacy values are imported idempotently without overwriting newer
  relational rows or tombstones.
- [x] Cron state and send claims are tenant-specific and concurrent claims for
  the same tenant/send key cannot both succeed.
- [x] Existing trip/resource behavior and unrelated sections remain unchanged.
- [x] TypeScript, production build, relevant Playwright tests, SQL integration
  tests and `git diff --check` pass.

## Rollback rule

Rollback may enable the observable read-only fallback while record-level writes
remain active. It must not re-enable JSON-first writes, section overwrites or
the legacy cron-state row. New revision, tombstone and cron-state records remain
intact; reconcile queued mutations before changing the write handler.

## Verification record

- PostgreSQL 17.11 accepted the complete migration chain and a second execution
  of `20260928130000_settings_relational_cutover.sql`.
- A seeded legacy-data rehearsal preserved newer relational company settings,
  imported mail settings, translations, tenant plan/modules and cron state, and
  remained stable on a second migration run.
- Two concurrent database sessions claiming the same tenant/send key returned
  exactly one success.
- Dedicated WorkCore Staging accepted the migration and its idempotent rerun.
- Phase 3B, Auth/RLS, Sync Foundation and Phase 3A SQL regression suites passed
  against the staging database; the pre/post data fingerprints were unchanged.
- Two concurrent staging claims for the same tenant/send key returned exactly
  one success, and all synthetic verification data was removed afterwards.
