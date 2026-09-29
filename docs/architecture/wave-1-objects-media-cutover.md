# Wave 1: Objects and media relational cutover

Status: locally implemented; WorkCore Staging verification pending (28 September 2026)

## Scope and authority

- `homecare_objects` is authoritative for properties, projects, sites and other configured object types.
- `homecare_media` is authoritative for object images, documents and floor plans.
- Stable object/media IDs are retained. Existing customer, job, report, billing and portal references are not rewritten.
- `object_type` and `custom_fields` close the two known lossless-migration gaps in the former relational object row.
- Object and object-media records carry independent revisions and tombstones.

## Runtime contract

- Writes use `homecare_apply_object_mutation` through the tenant-scoped durable mutation queue.
- Duplicate mutation IDs return the journaled response; stale revisions return `conflict`.
- Object media mutations require both `objects.manage` and `media.manage` at the API boundary.
- Storage paths accepted by object-media mutations must begin with the active tenant ID.
- Object deletion requires prior archive and is blocked by active jobs or open billing items.
- Deletes retain object, media and dependent relational rows as tombstones/history. Hard deletes are rejected.
- Relational reads are authoritative even when the result is empty. Object and media tombstones prevent JSON resurrection.

## Legacy boundary

- `/api/sync-sections` rejects whole-object-section writes.
- `/api/app-state` strips object writes and returns an empty object projection.
- Legacy reads are disabled by default and can only be enabled with `WORKCORE_OBJECT_LEGACY_READ_FALLBACK=1`.
- The fallback is read-only, emits `LEGACY_OBJECT_READ_FALLBACK` and the `X-WorkCore-Legacy-Fallback` response marker.
- Relational rows and tombstones always win; enabling the fallback never enables JSON writes.

## Migration checklist

- [x] Audit all object and object-media read/write paths.
- [x] Add lossless columns, revisions, tombstones and live-row indexes.
- [x] Backfill the newest JSON object/media candidate per tenant without overwriting relational rows or tombstones.
- [x] Add tenant-scoped record mutations, idempotency and stale-revision handling.
- [x] Enforce archive-before-delete, dependency guards and hard-delete protection.
- [x] Preserve customer, job, report, billing and portal relationships.
- [x] Enforce domain RLS and tenant-owned object-media storage paths.
- [x] Remove JSON-first and whole-section object writes.
- [x] Overlay pending offline object/media mutations after relational reads.
- [x] Add SQL and Playwright regression coverage.
- [ ] Apply migration twice on dedicated WorkCore Staging.
- [ ] Verify PostgREST/RLS with real authenticated roles and cross-tenant attempts.
- [ ] Verify object media upload/read/delete through private storage on iPhone and desktop.
- [ ] Verify portal visibility for active objects and rejection of archived/tombstoned objects.
- [ ] Verify dependent job/report/billing references and delete guards with staging data.
- [ ] Verify offline replay and stale conflicts across two devices.
- [ ] Remove all temporary staging records.

## Local verification

Run the migration into a disposable local PostgreSQL database, then execute:

```text
supabase/tests/object_media_relational_cutover.sql
supabase/tests/auth_tenant_rls.sql
supabase/tests/sync_foundation_database.sql
supabase/tests/resource_vehicle_position_cutover.sql
supabase/tests/settings_relational_cutover.sql
supabase/tests/customer_contact_relational_cutover.sql
npx tsc --noEmit
npm run build
npm run test:e2e
git diff --check
```

Production migration, deployment, commit and push are outside this wave.
