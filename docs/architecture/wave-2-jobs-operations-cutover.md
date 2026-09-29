# Wave 2: Jobs and operational work relational cutover

Status: locally implemented and verified; WorkCore Staging verification pending (28 September 2026)

## Scope and authority

- `homecare_jobs` is authoritative for jobs, orders, planning and recurring work.
- `homecare_field_progress` is authoritative for dated task progress and field evidence.
- `homecare_job_time_entries` is authoritative for consulting and other job time entries.
- `homecare_job_notes` is authoritative for dated field notes.
- Job, customer and object IDs are preserved. Child records use tenant-scoped stable IDs and tenant/job foreign keys.
- Existing report, billing, material, personnel and resource relationships are retained.

## Runtime contract

- Every write uses `homecare_apply_job_operation_mutation` through the existing durable sync queue.
- Jobs, progress records, time entries and notes have independent revisions and tombstones.
- Duplicate mutation IDs return their journaled response. Stale expected revisions return `conflict`.
- Pending offline mutations are overlaid after relational reads and replayed after reconnect.
- Relational empty results are authoritative. Tombstones prevent stale local or JSON data from resurrecting records.
- Recurrence IDs remain deterministic via `seriesOccurrenceId(masterId, date)`. A live tenant/master/date uniqueness constraint rejects duplicate occurrences.
- Deleting a job requires status `storniert`, is blocked by reports or active billing dependencies, and tombstones operational child records.
- Physical deletion of jobs, progress, time entries and notes is rejected.

## Legacy boundary

- `/api/sync-sections` rejects writes for `jobs`, `fieldProgress`, `fieldNotes` and `jobNoteMeta`.
- `/api/app-state` strips these domains from writes and never serves their legacy values.
- Legacy section reads are disabled by default and can only be enabled with `WORKCORE_JOB_OPERATIONS_LEGACY_READ_FALLBACK=1`.
- The fallback is read-only and emits `LEGACY_JOB_OPERATIONS_READ_FALLBACK` plus the `X-WorkCore-Legacy-Fallback` response marker.
- Relational rows and tombstones always win. Enabling the fallback never re-enables JSON or whole-section writes.

## Consolidated checklist

- [x] Audit job, planning, recurrence, field-progress, time-entry and field-note paths.
- [x] Add lossless job payload storage, revisions, tombstones and live-row indexes.
- [x] Add relational time-entry and field-note tables with tenant/job constraints.
- [x] Backfill the newest legacy candidates without replacing relational rows or tombstones.
- [x] Replace whole-list writes with record-level queued mutations.
- [x] Preserve the existing mobile workflow and local optimistic state.
- [x] Add deterministic recurrence generation and a duplicate-occurrence database guard.
- [x] Add idempotent replay and stale-revision conflict handling.
- [x] Preserve progress photos and dated progress during partial updates.
- [x] Enforce cancellation/dependency rules, tombstones and hard-delete protection.
- [x] Make empty relational reads authoritative and prevent `app_state` resurrection.
- [x] Add SQL and Playwright coverage for multi-device conflicts, offline replay, recurrence, progress, time, deletion and tenant isolation.
- [x] Rehearse the migration twice in a disposable local PostgreSQL database.
- [x] Run Auth/RLS, Sync Foundation and Phase 3A-3C SQL regressions locally.
- [ ] Apply the migration twice on dedicated WorkCore Staging.
- [ ] Verify real PostgREST/RLS requests for all four record types.
- [ ] Verify iPhone/desktop concurrent status, planning, progress, notes and time-entry edits.
- [ ] Verify offline create/update and reconnect replay on a real mobile device.
- [ ] Verify recurring generation across two clients without duplicate occurrences.
- [ ] Verify delete guards with staging reports and billing dependencies.
- [ ] Remove all temporary staging records.

## Local verification

Result on 28 September 2026: migration and second idempotency application passed,
all eight SQL suites passed, TypeScript and the production build passed, and
Playwright passed 72/72 tests.

The local gate consists of:

```text
supabase/tests/job_operations_relational_cutover.sql
supabase/tests/auth_tenant_rls.sql
supabase/tests/sync_foundation_database.sql
supabase/tests/resource_vehicle_position_cutover.sql
supabase/tests/settings_relational_cutover.sql
supabase/tests/customer_contact_relational_cutover.sql
supabase/tests/object_media_relational_cutover.sql
npx tsc --noEmit
npm run build
npm run test:e2e
git diff --check
```

Production migration, deployment, commit and push are outside this wave.
