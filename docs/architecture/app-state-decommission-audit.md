# App State Decommission Audit

Status: 27 September 2026
Scope: audit only. No production data or cutover behavior was changed.

## Phase 3A implementation update (28 September 2026)

The classifications below describe the baseline at the time of the audit. The
local, uncommitted Phase 3A implementation has since changed two domains:

- **Resource/vehicle master data: relational authoritative.** Writes use
  tenant-scoped, record-level mutations with stable IDs, expected revisions,
  tombstones and the shared durable mutation journal. `/api/sync-sections` and
  `/api/app-state` reject or strip resource writes.
- **Vehicle positions: relational authoritative.** Position writes use the same
  record mutation protocol. The former direct POST and JSON fallback write are
  disabled.

Legacy JSON can only be used as a temporary read fallback when
`WORKCORE_RESOURCE_LEGACY_READ_FALLBACK=1`. Each activation emits
`LEGACY_RESOURCE_READ_FALLBACK` telemetry and a response header. With the
default setting, stale JSON resources and positions cannot reappear. The
historical details below remain useful as the pre-cutover evidence and must not
be read as the current Phase 3A runtime behavior.

## Phase 3B implementation update (28 September 2026)

The committed Phase 3B implementation makes these domains
relationally authoritative:

- company and daily-mail configuration in `homecare_settings`;
- tenant plan, subscription and module settings in the tenant aggregate;
- custom translations in `homecare_translations` per translation key;
- daily-mail send state in `homecare_daily_mail_state`, separate from
  configuration and protected by an atomic tenant/send-key claim.

Writes use the shared durable mutation queue and tenant-scoped mutation journal
with expected revisions. `/api/sync-sections` rejects these domain writes and
`/api/app-state` strips them. Legacy reads require
`WORKCORE_SETTINGS_LEGACY_READ_FALLBACK=1`, emit
`LEGACY_SETTINGS_READ_FALLBACK`, and never enable legacy writes. The cron route
requires an explicit tenant, filters all reads by it and no longer reads or
writes its legacy `app_state` state row.

The baseline tables and findings below remain the pre-cutover audit record.

## Phase 3C local implementation update (28 September 2026)

Customer master records and customer contacts are relationally authoritative.
`homecare_customers` owns customer revisions, archive state and tombstones;
`homecare_customer_contacts` owns independently revisioned contact persons.
Existing single-contact fields are migrated to a stable primary-contact row.

Customer/contact writes use the durable tenant-scoped mutation queue and
journal. `/api/sync-sections` rejects customer writes and `/api/app-state`
strips them. Relational empty/deleted results are authoritative. A read-only
rollback fallback requires `WORKCORE_CUSTOMER_LEGACY_READ_FALLBACK=1`, emits
`LEGACY_CUSTOMER_READ_FALLBACK`, and cannot restore JSON writes.

Customer deletion is a tombstone and preserves every foreign-key reference.
It requires prior archive and is blocked by active objects/jobs, open billing
or active portal access. Portal context and invitation ignore tombstoned
customers while retaining their tenant/customer scope.

The local PostgreSQL and application regression gates pass. Dedicated WorkCore
Supabase Staging verification also passed before commit, including PostgREST,
RLS, portal, dependency guards, offline conflicts and the read-only fallback.

## Executive finding

`app_state`, `/api/sync-sections`, tenant-scoped browser `localStorage`, and the
normalized `homecare_*` tables still form a multi-master system for most
business domains. The server-side route writes the JSON fallback first and then
attempts a relational write. Most relational failures are logged and converted
to a successful fallback save. Reads then combine the full snapshot, section
rows, relational rows, local pending sections, and several domain-specific
merge rules.

The Sync Foundation has made vehicle-trip mutations relational, revisioned and
idempotent. It has not yet removed the surrounding whole-resource section sync.
Consequently, the trip rows are relational authoritative, while vehicle master
data, positions, media references and the encompassing resource list still
participate in legacy fallback behavior.

## Persistence layers

| Layer | Current role | Authority risk |
| --- | --- | --- |
| `app_state` row `kolaretorp-service-app` | Full `AppSnapshot`, patch target, bootstrap source and restore target | Contains all business domains and can replace newer relational state during merge or recovery |
| `app_state` rows `sync-section:<key>` | One whole JSON value per section | Written before relational persistence and therefore remains a valid server-side source after relational failure |
| `homecare_*` tables | Normalized mirror for most sections; authoritative for trip mutations | Most domains have no record-level revision/mutation contract and are populated by whole-list upserts |
| Tenant-scoped browser `localStorage` | Offline cache and pending whole-section source | A pending key promotes the complete local section over the server result |
| `homecare_sync_mutations` | Durable mutation journal for vehicle trips/media mutation types | Correct foundation pattern, but currently used only by the reference domain |
| Backup rows in `app_state` | Full-snapshot and report recovery archive | Restore updates only JSON and does not restore relational tables atomically |

## Runtime reads from `app_state`

| Location | Read purpose | Consequence |
| --- | --- | --- |
| `app/api/app-state/route.ts:139,158,899,933,949` | Read current snapshot, backup metadata and merge base for full/patch saves | Full JSON remains the frontend bootstrap and write-merge base |
| `app/api/app-backups/route.ts:78,152,196,215` | Read current snapshot, list backup indexes, read index and chunks for restore | Backup/restore is JSON-only |
| `app/api/app-backups/report-photos/route.ts:173,190,318` | Read backup chunks/indexes and current snapshot for photo recovery | Recovery starts from legacy JSON rather than relational report/progress rows |
| `app/api/app-state/migrate-media/route.ts:121` | Read full snapshot before recursively replacing embedded media | Runtime migration depends on legacy snapshot shape |
| `app/api/report-backups/route.ts:63` | Read per-report JSON backups | Report recovery has an additional JSON source |
| `app/api/cron/daily-jobs/route.ts:724,734` | Read send-state and full legacy snapshot | Jobs/objects are replaced with relational rows, but personnel, company/calendar/reminder context can still come from JSON |
| `app/api/sync-sections/route.ts:2193` | Load `sync-section:*` fallback values for every requested key | Every section can fall back to JSON |
| `app/api/vehicle-positions/route.ts:43,85` | Load and merge legacy position list; read it before fallback write | Relational and JSON positions are dual-read |
| `scripts/audit-private-media.mjs:144-148` | Inspect media references in all app-state rows | Private-media audit still requires legacy JSON |
| `scripts/generate-security-cleanup-reports.mjs:253` | Inspect active and backup JSON for credentials/media | Security cleanup still depends on legacy rows |
| `scripts/export-supabase-rehearsal.mjs:36,54` | Include `app_state` in rehearsal exports | Recovery rehearsal treats JSON as retained business evidence |

The browser does not query `app_state` directly. It reads it through
`GET /api/app-state?compact=1` in `app/page.tsx:3993`.

## Runtime writes to `app_state`

| Location | Write purpose | Divergence mode |
| --- | --- | --- |
| `app/api/app-state/route.ts:192,198,853` | Automatic backup chunks/index and current full/patch snapshot | Updates JSON independently of relational tables |
| `app/api/app-backups/route.ts:110,131,244` | Manual backup chunks/index and JSON-only restore | Restore immediately creates a split state |
| `app/api/app-backups/report-photos/route.ts:428` | Save repaired reports into current snapshot before relational upsert | Non-transactional dual write; either side can succeed alone |
| `app/api/app-state/migrate-media/route.ts:135` | Replace embedded media recursively in current snapshot | Does not update every relational reference in the same transaction |
| `app/api/report-backups/route.ts:94` | Upsert `report-backup:<id>` JSON | Independent report copy |
| `app/api/cron/daily-jobs/route.ts:821` | Store daily-mail send history | Operational state remains in generic JSON |
| `app/api/sync-sections/route.ts:2242` | Write every supplied whole section before relational persistence | Primary dual-write source; relational errors are normally swallowed |
| `app/api/vehicle-positions/route.ts:100` | Write entire fallback position list when relational upsert fails | Successful API response can mean relational or JSON persistence |

## `/api/sync-sections` usage

### Production frontend

- `app/page.tsx:4011` loads all or selected sections.
- `app/page.tsx:4100` saves a whole-section patch.
- Initial load starts `GET /api/app-state` and `GET /api/sync-sections` in
  parallel, merges section values over the snapshot, and then overlays locally
  pending sections.
- Background refresh repeats both reads every 90 seconds and on focus/online
  transitions.
- `persistSnapshotNow`, the automatic change detector, and
  `persistResourcesFast` enqueue complete section values, not record mutations.
- `syncedResourcesForQuickTrip` loads both the full snapshot and the resource
  section before opening a trip.

### Scripts and tests

- `scripts/repair-project-object-ids.mjs` reads and writes customers, objects and
  jobs through `/api/sync-sections`.
- `tests/onboarding.spec.ts` mocks the route as the onboarding persistence API.
- `tests/branding-object-types.spec.ts` reads/mocks section sync for settings and
  business data.
- `tests/auth-security.spec.ts` verifies authentication and scans the route for
  the expected RLS/tenant boundary.

## Section read and write algorithm

`GET /api/sync-sections` first loads JSON fallback rows. It then overlays
relational values:

- customers, objects and jobs only replace fallback data when the maximum
  relational `updated_at` is newer than the section row;
- resources use a custom merge and can retain JSON-only resources;
- objects copy `type` and `customFields` back from JSON because the relational
  schema does not contain them;
- settings replace fallback values when a relational setting row exists;
- most other relational loaders return `null` when their table is empty, so an
  empty relational domain cannot authoritatively clear a non-empty fallback;
- the frontend merges jobs by ID to preserve consulting content that the
  relational job conversion does not represent.

`POST /api/sync-sections` always saves the JSON fallback first. Each relational
save then runs in a separate `try/catch`. A relational failure logs a warning
but the request still returns success with the fallback timestamp.

## Domain classification

Each domain receives exactly one primary classification. The notes identify
secondary read behavior where relevant.

| Domain/module | Classification | Current stores and important gaps |
| --- | --- | --- |
| Full application snapshot | **legacy JSON authoritative** | `/api/app-state`, browser bootstrap and JSON-only restore still treat the complete `AppSnapshot` as a valid server truth |
| Customers and contacts | **relational authoritative** | `homecare_customers`, `homecare_customer_contacts`, record-level mutation journal, revisions and tombstones; legacy customer JSON is explicit read-only fallback only |
| Projects/objects/sites | **dual-write** | `sync-section:objects`, `homecare_objects`, `homecare_media`; `type` and `customFields` remain JSON authoritative; object-media removal is not tombstoned by `saveObjectsSection` |
| Personnel | **dual-write** | Section plus `homecare_personnel`; empty list and deletions cannot clear relation |
| Services | **dual-write** | Section plus `homecare_services`; checklist remains row JSON but the containing service list is whole-section synced |
| Service packages | **dual-write** | Section plus `homecare_service_packages`; no record revisions or deletion propagation |
| Accounting accounts | **dual-write** | Section plus `homecare_accounting_accounts`; fallback succeeds even if relational write fails |
| Inventory locations | **dual-write** | Section plus `homecare_inventory_locations`; empty/delete behavior is not authoritative |
| Materials and inventory movements | **dual-write** | Material list and nested movements are written to fallback and two relational tables; missing movements are never deleted |
| Jobs/orders and recurring jobs | **dual-write** | Section, full snapshot and `homecare_jobs`; frontend intentionally merges JSON jobs to retain consulting entries; nested schedule/checklist/material/service data is whole-row JSON |
| Active job selection | **dual-write** | `homecare_settings`, section fallback and local storage; likely user/device state but currently tenant-global |
| Field progress/time entries | **dual-write** | Section plus `homecare_field_progress`; merge rules preserve completion/photos but stale/missing rows cannot be removed deterministically |
| Field notes | **dual-write** | Generic JSON object in `homecare_settings`, section fallback and local storage; no record identity or revision |
| Service reports | **dual-write** | Section, `homecare_reports`, full snapshot and `report-backup:*`; list save merges but does not propagate authoritative deletes |
| Billing/invoices/payment/export | **dual-write** | Section plus `homecare_billing_items`; invoice lines remain row JSON; no record-level conflict or delete protocol |
| Portal messages | **dual-write** | Section plus `homecare_portal_messages`; replies are nested JSON and complete message lists are rewritten |
| Translation overrides | **dual-write** | Section plus `homecare_translations`; relational empty state cannot clear fallback |
| Company settings | **dual-write** | Generic `homecare_settings` JSON plus fallback and local storage |
| Daily-mail settings | **dual-write** | Generic setting plus fallback/local storage; cron also reads the full snapshot as legacy context |
| Tenant/subscription/module settings | **dual-write** | Section plus tenant/subscription/module tables; route still uses `defaultTenantId` for reads and may write the ID supplied by JSON |
| Deleted entity/report markers | **dual-write** | Generic settings plus fallback/local storage; parallel tombstone mechanism can disagree with relational rows |
| Resource/vehicle master data | **dual-read** | Relational resource/media rows are merged with JSON-only resources; complete resource lists are still dual-written |
| Vehicle trips | **relational authoritative** | `homecare_vehicle_trips` plus mutation journal/revision/tombstone; old JSON logbooks are deliberately ignored, while offline mutations are overlaid client-side |
| Vehicle positions | **dual-read** | Relational rows win per resource, but JSON-only positions are appended and become the write fallback on relational error |
| Resource/object media metadata | **dual-write** | Media rows and references embedded in section/full JSON coexist; resource deletion handling is stronger than object-media handling |
| Full app backups | **legacy JSON authoritative** | Backup payload and restore target are full JSON snapshots in `app_state`; relational state is outside the restore transaction |
| Report text backups | **fallback-only** | `report-backup:*` rows repair report content after normal reads; they are another retained copy but are not the primary UI store |
| Legacy media migration | **fallback-only** | Recursively transforms media in the full snapshot; required until references are cut over and verified |

## Authoritative nested JSON

Nested JSON inside a relational row is not automatically a second source of
truth. It becomes risky here because the same aggregate is also stored in a
section/full snapshot and overwritten as a whole. Current relational JSON
aggregates include:

- customer portal login history;
- object equipment and risks;
- service checklists and package service IDs;
- job resource/material/service selections, checklist, schedule, execution log,
  discounts and recurrence exclusions;
- field-progress photos;
- report checklist results, media IDs and attachments;
- invoice lines;
- inventory receipts/change history;
- resource tracking, maintenance, odometer history and standard trips;
- trip coordinates, waypoints, evidence photos, warnings and audit entries;
- portal-message replies;
- generic company/daily-mail/deletion/field-note settings.

These fields need an explicit aggregate ownership and revision policy before
their domain write cutover. They must not be decomposed merely to avoid JSON;
decomposition is required only where independent mutation, constraints,
auditing or conflict resolution demand it.

## Frontend legacy fallbacks

1. Every sync section has a tenant-scoped `localStorage` copy.
2. `readLocalSnapshot` supplies seed data when local entries are absent.
3. A pending section key causes the complete local section to be overlaid on the
   server result and later resent.
4. Initial load and background refresh combine `/api/app-state` with
   `/api/sync-sections` rather than requesting domain records directly.
5. Jobs are merged by ID with JSON/local state to preserve consulting entries.
6. Objects recover `type` and `customFields` from fallback JSON.
7. Resources retain JSON-only vehicles, while relational trips/media replace
   their nested equivalents.
8. Report text backups are applied after snapshot/section merge.
9. Offline trip mutations use the new durable mutation queue; all other domains
   still use pending whole-section keys.
10. Failed non-retryable legacy sync can disable Supabase sync and leave the
    browser cache as the only current value until manual recovery.

## Migration and import dependencies

- `20260912093000_import_app_state_into_homecare_tables.sql` imports every main
  business section from the full snapshot into relational tables.
- `20260912101000_create_homecare_settings.sql` imports setting section rows.
- `20260927100000_auth_tenant_rls_roles.sql` assigns tenants to app-state rows
  and removes historical portal passwords from full/section JSON.
- `20260927110000_resolve_field_progress_orphans.sql` consults the legacy
  snapshot to reconstruct missing jobs before archiving unresolved evidence.
- `app/api/app-state/migrate-media` is a runtime JSON media migration.
- Backup restore, report-photo recovery, legacy-backup sanitization, private
  media classification and rehearsal export all still parse legacy JSON.
- `supabase/schema.sql` still documents the original public app-state policies
  and must not be treated as the current deployable security definition.

Historical migrations may continue to reference `app_state` for fresh installs.
They should become one-way import history, not runtime dependencies.

## Concrete divergence points

1. Fallback JSON is committed before relational writes; relational exceptions
   are swallowed and the API reports success.
2. Most section writers return early for empty arrays. Clearing a domain in the
   UI leaves all relational rows intact, which can later repopulate the UI.
3. Upserts do not identify missing records as deletions. Customers, objects,
   personnel, jobs, reports, billing items and catalog rows can resurrect.
4. Whole-section timestamps are compared with maximum row timestamps. One new
   row can make an otherwise stale relational list appear newer.
5. Pending whole-section retries have no expected revision and can overwrite
   unrelated changes from another device.
6. Full snapshot cache, section timestamps and individual relational timestamps
   are not one causal clock.
7. Job conversion omits consulting-specific nested data; frontend merge keeps
   JSON authoritative for those fields.
8. Object conversion omits `type` and `customFields`; JSON is explicitly merged
   back into relational objects.
9. Resource merge retains JSON-only resources; position merge retains JSON-only
   positions.
10. Object-media writes only upsert current items. Removed relational media can
    return because no stale-row tombstone is written.
11. Report-photo repair writes JSON and relational reports sequentially without
    a transaction.
12. JSON backup restore does not restore relational tables, revisions,
    tombstones or mutation journal entries.
13. Daily mail combines relational jobs/objects with legacy snapshot context and
    stores execution state in a generic app-state row.
14. Tenant settings read the hard-coded default tenant instead of the selected
    request tenant.
15. Generic deletion-marker settings can disagree with relational soft deletes.
16. Legacy imports are one-time snapshots; continued JSON writes after import
    are not automatically reconciled by migrations.

## Immediate audit conclusion

No additional business module should be added to section sync. The route must
be treated as a temporary compatibility boundary. Vehicle trips demonstrate
the target pattern: stable IDs, record mutations, a durable idempotency journal,
server revisions, tombstones, tenant constraints and explicit conflict status.
The remaining domains should adopt that pattern incrementally according to the
decommission plan.
