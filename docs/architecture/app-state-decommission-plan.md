# App State Decommission Plan

> Abschluss 29. September 2026: Waves 1 bis 5 sind lokal implementiert. Der
> aktuelle Endzustand steht in
> `docs/architecture/app-state-final-retirement.md`; dieses Dokument bleibt als
> historischer Migrationsplan erhalten.

Status: proposed plan, 27 September 2026
No cutover or production data change is authorized by this document.

## Phase 3A status (28 September 2026)

Resource/vehicle master records and vehicle positions have completed the local
write and read cutover implementation. The relational tables are authoritative;
offline changes use the shared durable record-mutation queue, and legacy JSON
is an opt-in, observable read fallback only. The implementation still requires
the documented migration and tests in a safe environment before deployment.
Rollback means re-enabling the read fallback while keeping mutation writes
active; it never restores JSON writes or whole-section overwrites.

## Objective

Make one server-side relational domain the single source of truth for each
business capability, while retaining reliable offline work and preserving all
existing user data. `app_state` and section rows become immutable migration
evidence, then are archived after every domain has completed read and write
cutover.

This is not a big-bang rewrite. Each domain advances independently through the
same gated state machine.

## Non-negotiable rules

1. Never delete or truncate legacy data during a domain cutover.
2. Never use a whole-list overwrite as the replacement sync protocol.
3. Every persistent record has a stable UUID or a documented stable natural key.
4. Every offline mutation has a tenant-scoped mutation ID and durable status.
5. Mutable/conflict-capable records have a server revision and expected-revision
   check; deletes use tombstones where cross-device propagation is required.
6. Tenant ownership, RLS, foreign keys and business constraints are enforced by
   PostgreSQL, not only by UI code.
7. Read cutover and write cutover are separate release gates.
8. Legacy fallback must never silently activate after write cutover.
9. A rollback may change application routing, but must not discard relational
   writes or make a stale JSON copy authoritative.
10. Backup/restore must cover the authoritative relational model before the
    final `app_state` shutdown.

## Accelerated Decommission Wave 1 status (28 September 2026)

The object/property/project/site aggregate and its object media have completed
the local read/write cutover implementation in one consolidated wave. Stable
IDs, revisions, tombstones, tenant-scoped queued mutations, dependency guards
and secure media ownership are implemented. Legacy object JSON is read-only,
disabled by default and cannot become authoritative over relational rows or
tombstones. WorkCore Staging verification remains the release gate.

## Per-domain cutover state machine

### 0. Inventory and contract

- Define the domain aggregate, table ownership and all nested JSON fields.
- Compare field-by-field conversion with TypeScript models and document fields
  that currently exist only in JSON.
- Add missing tenant IDs, constraints, indexes, revisions, tombstones and audit
  requirements.
- Decide which nested JSON remains one aggregate and which data needs child
  records for independent mutation or validation.
- Record baseline counts, IDs, checksums and orphan reports per tenant.

Exit gate: every legacy field has a lossless relational destination or an
explicit archival destination.

### 1. Backfill and parity observation

- Run an idempotent, tenant-scoped backfill from full snapshot and section rows.
- Never overwrite a newer relational revision during backfill.
- Store migration provenance and deterministic checksums.
- Run a shadow comparator that reports missing IDs, extra IDs and field-level
  differences without changing either side.
- Resolve differences by a documented precedence rule and human review where
  evidence is ambiguous.

Exit gate: zero unexplained records or fields; repeated backfill is a no-op.

### 2. Read cutover

- Add a domain-specific read endpoint/repository backed only by relational
  tables.
- Continue the existing write path temporarily so rollback remains possible.
- Switch frontend reads for only this domain behind a server-controlled flag.
- Do not merge section/full JSON into the returned domain.
- Keep the old reader available only as an observable rollback path; log every
  invocation and prohibit silent fallback.
- Compare rendered/domain results in staging and a read-only production shadow
  before enabling the flag broadly.

Rollback: switch the read flag back before write cutover. Investigate parity;
do not mutate either store as part of rollback.

### 3. Write cutover

- Introduce record-level create/update/delete/restore mutations using the Sync
  Foundation queue and mutation journal.
- Apply each mutation transactionally to the relational aggregate with tenant,
  permission and expected-revision checks.
- Stop writing this domain to `sync-section:*`, the full snapshot and pending
  whole-section keys.
- Replace list deletions with explicit tombstones/mutations.
- Keep local materialized views as caches only. Rebuild them from relational
  reads plus pending record mutations.
- Treat conflicts as visible queue entries requiring retry, refresh or user
  resolution; never mark a local-only change as synchronized.

Rollback after write cutover: keep relational data authoritative. Roll back to
the last application version that understands the relational mutation contract,
or deploy a forward fix. A temporary legacy reader may be regenerated from
relational records into a new, clearly marked compatibility projection, but the
old JSON must not be promoted to authority and no reverse whole-list overwrite
is allowed.

### 4. Legacy freeze and removal

- Mark the domain's section row read-only and record the freeze timestamp.
- Remove its key from frontend `SyncSectionKey`, pending-key storage and
  `/api/sync-sections` allowlists.
- Preserve the final JSON/checksum in restricted archival storage for the
  retention period.
- Remove domain-specific merge, fallback and repair code only after rollback
  window expiry.

Exit gate: telemetry shows zero legacy reads/writes for at least one agreed
release window and all required restore tests use relational backups.

## Offline and conflict model

The current trip queue becomes the shared mechanism, extended one domain at a
time:

- queue storage is tenant scoped and durable across reload/restart;
- queue items contain mutation ID, entity/aggregate ID, operation, payload,
  expected revision, creation time, retry metadata and status;
- statuses remain `pending`, `syncing`, `synced`, `failed`, `conflict`;
- exact mutation retries return the stored journal result;
- server responses return the authoritative record/revision or a structured
  conflict;
- local lists are projections of last server state plus pending mutations;
- server refresh never removes unsynced mutations, and pending mutations never
  replace an unrelated full list;
- dependency ordering is explicit, for example customer before object and job
  before report;
- permanent validation errors stay visible and do not disable all sync.

## Required tests before every read cutover

1. Legacy-to-relational backfill is idempotent and lossless for all fields.
2. Counts, stable IDs, tenant IDs and deterministic checksums match.
3. Empty relational result is treated as authoritative when expected and does
   not repopulate from JSON.
4. Deleted/tombstoned records never reappear from snapshot, section or cache.
5. Relational reads enforce tenant isolation and role permissions through the
   real API/RLS path.
6. Nested aggregate JSON round-trips without field loss.
7. Frontend behavior and mobile layout work with the relational-only response.
8. Read flag rollback restores the prior reader without a data write.
9. Shadow comparison has zero unexplained differences.

## Required tests before every write cutover

1. Create, update, delete and restore operate on one record/aggregate.
2. Duplicate mutation ID is idempotent.
3. Stale expected revision returns `conflict` without data loss.
4. Two devices changing the same record cannot silently overwrite each other.
5. Offline mutations survive reload and synchronize later in order.
6. Failed and conflicted mutations remain visible and retryable.
7. Cross-tenant read/write and restricted-role mutations are rejected.
8. Referential/business constraints are enforced under concurrent transactions.
9. No request writes this domain to the full snapshot or section fallback.
10. Local cache reconstruction plus pending mutations matches the server after
    reconnect.
11. Deleting the final record leaves an authoritative empty domain.
12. Backup and restore preserve revisions, tombstones and required audit data.
13. Post-write rollback keeps every relational mutation made after cutover.

Domain-specific concurrency and compliance tests are added to these generic
gates, not substituted for them.

## Recommended module order

### 1. Vehicle positions and resource/vehicle master data

Why first: vehicle trips already use the target mutation architecture. Remove
the JSON position fallback, make resources/media record-mutation based, and
stop merging JSON-only vehicles. Preserve trip, odometer and one-active-trip
tests. This completes the reference domain instead of starting a second pattern.

Special rollback: keep trip mutation RPC and relational trip reads active under
all rollback modes. Never fall back to JSON logbooks.

### 2. Tenant/company settings, daily-mail settings and translations

Why second: small aggregates with few dependencies expose the reusable read and
write cutover flags at low business risk. Correct the hard-coded default tenant
before read cutover. Decide whether active-job selection is device/user state
rather than tenant business data.

Special rollback: retain versioned setting rows; do not restore a whole setting
map over newer keys.

Implementation status (28 September 2026): locally implemented and verified on
PostgreSQL 17.11, including an idempotent legacy-data rehearsal and concurrent
daily-mail claims. The read-only fallback is controlled by
`WORKCORE_SETTINGS_LEGACY_READ_FALLBACK=1`; rollback keeps relational writes,
revisions, tombstones and mutation-journal entries active. Dedicated Supabase
Staging verification passed before commit.

### 3. Customers and contacts

Why third: customers are upstream of objects, jobs, billing, portal access and
messages. Add record revisions and tombstones before removing the section.
Portal access remains Supabase-Auth based and must not return to customer JSON.

Special rollback: relational customer IDs and portal assignments remain
authoritative; legacy projection must omit all password fields.

Implementation status (28 September 2026): customer and contact writes use
tenant-scoped record mutations, expected revisions and tombstones. Customer
deletion preserves references and is blocked while active dependencies exist.
The read-only rollback fallback is controlled by
`WORKCORE_CUSTOMER_LEGACY_READ_FALLBACK=1`; it does not restore JSON writes.
Local PostgreSQL, application and dedicated WorkCore Supabase Staging
verification passed before commit.

### 4. Objects/projects and object media

Why fourth: close schema gaps for `type` and `customFields`, define media
tombstones, and eliminate the current JSON extension merge. Customer ownership
and private-media authorization must remain relational.

Special rollback: never restore deleted media from JSON URLs or cached metadata.

### 5. Personnel and master catalogs

Includes personnel, services, packages, accounting accounts, inventory
locations and then materials/inventory movements. These records are dependencies
for jobs, billing, reports and resources. Material movement deletion and stock
calculation require record-level semantics before cutover.

Special rollback: preserve immutable movement/audit history and recalculate
stock from authoritative movements rather than a legacy material list.

### 6. Jobs, planning and recurring work

Close the consulting-data gap first. Define aggregate ownership for schedule,
checklist, recurrence, resources, services, materials and execution log. Use
record revisions and server-side recurrence/concurrency rules; do not rewrite
the complete job list.

Wave 2 implements this cutover locally through
`20260928220000_jobs_operations_relational_cutover.sql`; dedicated WorkCore
Staging verification remains pending. See
`docs/architecture/wave-2-jobs-operations-cutover.md`.

Special rollback: retain all post-cutover job revisions and recurrence
occurrences; a legacy reader may only project them.

### 7. Field progress, time tracking and field notes

Move task progress and work entries as record mutations keyed by job,
occurrence/date and task. Replace the generic field-notes map with identified,
revisioned records or an explicitly versioned job aggregate. Keep orphan archive
evidence intact.

Special rollback: completed work, minutes and photos are append/merge evidence
and may not be removed by a stale client.

These domains are included in the same Wave 2 mutation and staging checklist so
that job status, dated progress, notes and time records cannot diverge across
separate sync mechanisms.

### 8. Reports and report media/backups

Wave 3 implements this cutover locally through
`20260928233000_reports_media_communication_relational_cutover.sql`. Report
rows and media references are authoritative, `report-backup:*` writes are
retired, and uploads are journaled through tenant-owned pending media rows.

Special rollback: preserve report versions and media tombstones; never re-enable
JSON photo resurrection.

### 9. Portal messages and communication history

Wave 3 makes messages authoritative and decomposes replies into revisioned
child rows for delivery retries and auditability. Whole-message-list writes and
nested reply authority are removed.

Special rollback: delivered/failed mail status is append-only evidence and must
not be overwritten by an older thread projection.

### 10. Billing, invoices, payments and accounting export

Wave 4 implements this cutover locally through
`20260929090000_financial_relational_cutover.sql`. Invoice headers, lines,
payments and export events use the existing durable mutation journal. Issued
records are immutable where fiscally required, and migration reconciliation is
fatal for count, total, numbering or relationship mismatches.

Special rollback: issued invoice numbers, postings, payments and export markers
remain immutable/append-only according to accounting rules.

### 11. Cron state, backup/restore and final snapshot shutdown

Move daily-mail execution state to a dedicated tenant table and build backup,
export and restore around the complete relational model. Rehearse restore into
an empty staging tenant and verify revisions, tombstones, storage references and
mutation journals. Sanitize and archive legacy backups according to the existing
security runbook.

Only then:

- disable `POST/PUT /api/app-state`;
- remove frontend `GET /api/app-state` bootstrap;
- remove `/api/sync-sections` after its allowlist reaches zero;
- revoke application access to active `app_state` rows;
- retain a read-restricted, checksummed archive for the approved retention
  period;
- drop the table only through a separately approved migration after retention,
  legal and rollback requirements are satisfied.

## Cross-cutting implementation artifacts

Before the first domain cutover, add:

- a domain authority registry with states `legacy`, `shadow`,
  `relational-read`, `relational-only`;
- per-domain parity metrics and an operator-visible discrepancy report;
- a generic record mutation envelope and server handler built on the current
  mutation journal;
- a tenant-scoped local materialized-view/cache abstraction;
- a feature-flagged read repository boundary so UI components do not know about
  legacy sources;
- a cutover ledger containing tenant, domain, backfill version, parity result,
  read-cutover time, write-cutover time and rollback-window end;
- relational backup manifests and restore verification tooling.

Transition code must be named and documented as compatibility code. It must not
become a second permanent sync architecture.

## Completion criteria

The decommission is complete only when:

- every business domain is `relational-only`;
- all writes are record/aggregate mutations with idempotency and conflict rules;
- no frontend code loads or merges `/api/app-state` or `/api/sync-sections`;
- no operational route silently falls back to JSON;
- relational backup/restore is tested end to end;
- legacy media and backup security work is complete;
- telemetry confirms zero app-state reads/writes for the agreed window;
- production removal receives separate approval.
