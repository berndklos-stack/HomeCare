# Wave 3: Reports, media and communication relational cutover

Status: locally implemented; WorkCore Staging verification pending (28 September 2026)

## Scope and authority

- `homecare_reports` is authoritative for report content and customer/job/object relationships.
- `homecare_media` is authoritative for report attachments, checklist photos and communication attachments.
- `homecare_portal_messages` and `homecare_portal_message_replies` are authoritative for communication and reply history.
- Existing report, object, customer, job and billing IDs and current `/api/private-media?path=...` URLs are preserved.
- Embedded attachment, photo and reply JSON is migrated once and is no longer written as the authoritative source.

## Runtime and offline contract

- All changes use `homecare_apply_report_communication_mutation` through the existing durable sync queue.
- Reports, messages, replies and media have independent revisions and tombstones.
- Mutation IDs are idempotent. Stale expected revisions return a conflict instead of overwriting another device.
- Pending offline report/message mutations overlay relational reads and replay after reconnect.
- Relational empty results are authoritative. `app_state`, section JSON and old report backups cannot resurrect rows.
- `/api/sync-sections` rejects `reports`, `portalMessages` and `deletedReportIds` writes.
- `/api/app-state` strips those domains from writes and serves empty legacy values.
- `/api/report-backups` is relational read compatibility only; its write endpoint rejects JSON backups.

## Security contract

- `homecare-private-media` remains non-public.
- A matching live `homecare_media` row and matching tenant path are required for every media download.
- Uploads create a tenant-owned pending media row before the URL is returned. A queued mutation atomically claims it for a report or message.
- Tombstoned and unregistered files return `404`; cross-tenant paths return `403`.
- RLS scopes reports, portal messages, replies and media to the selected tenant.
- Portal reads include only active customer-owned objects, visible nondeleted reports and nondeleted messages.
- Report deletion is blocked by active billing dependencies. Allowed deletes tombstone associated media; hard deletes are rejected.

## Consolidated checklist

- [x] Audit reports, report backups, uploads, private downloads, portal messages and replies.
- [x] Add report/message revisions, tombstones and lossless relational payload fields.
- [x] Add tenant-scoped relational portal-message replies.
- [x] Backfill newest legacy reports and messages without replacing existing relational rows.
- [x] Normalize embedded report/message media and replies into child records.
- [x] Replace report and communication list writes with queued record mutations.
- [x] Preserve report content, attachments, checklist photos and customer/object/job relationships.
- [x] Preserve portal history and report-linked communication.
- [x] Keep media URLs and authenticated API behavior stable.
- [x] Require live tenant-owned metadata for private media delivery.
- [x] Enforce private bucket, RLS, tombstones, hard-delete protection and billing dependency guards.
- [x] Prevent legacy JSON writes and resurrection from `app_state`.
- [x] Add SQL and Playwright regression coverage for replay, stale conflicts, media privacy and tenant isolation.
- [ ] Apply the migration twice on dedicated WorkCore Staging.
- [ ] Verify real PostgREST/RLS reads and mutations for reports, messages, replies and media.
- [ ] Verify iPhone/desktop concurrent report and message edits.
- [ ] Verify offline media/report creation and reconnect replay on a real mobile device.
- [ ] Verify private media delivery, tombstones and cross-tenant rejection against Supabase Storage.
- [ ] Remove all temporary staging records.

## Local verification gate

Result on 29 September 2026: the migration and its idempotent second application
passed; all eight SQL suites passed; TypeScript, the production build and
`git diff --check` passed; Playwright passed 77/77 tests.

```text
supabase/tests/report_media_communication_relational_cutover.sql
supabase/tests/auth_tenant_rls.sql
supabase/tests/sync_foundation_database.sql
supabase/tests/resource_vehicle_position_cutover.sql
supabase/tests/settings_relational_cutover.sql
supabase/tests/customer_contact_relational_cutover.sql
supabase/tests/object_media_relational_cutover.sql
supabase/tests/job_operations_relational_cutover.sql
npx tsc --noEmit
npm run build
npm run test:e2e
git diff --check
```

Production migration, deployment, commit and push are outside this wave.
