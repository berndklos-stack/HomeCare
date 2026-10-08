# Operations Wave: implementation checkpoint

## Status

The foundation, command gateway and four-module UI are implemented
locally. The package is **not yet approved for production deployment**. No
migration, stock import, commit or push has been performed against production.

## Existing system

- Material and warehouse master records already live in `homecare_materials`
  and `homecare_inventory_locations`.
- Their current mutation routine preserves inventory entries in individual
  `record_data.inventoryEntries` arrays. The active warehouse UI calculates
  totals from those arrays, not from the relational movement table.
- `homecare_resources`, trips and vehicle positions already have revisioned
  mutation protection. Existing vehicle columns and functions remain untouched.

## Implemented foundation

Migration `20261007230000_operations_foundation.sql` adds:

- Suppliers and supplier contacts.
- Preferred suppliers and reorder quantities on existing materials.
- Typed storage locations referring to existing resources/projects.
- Nullable equipment metadata on existing resources, without changing their
  current types, mileage, trips or active-trip rules.
- Purchase orders, individual order items and immutable partial receipts.
- Time-bounded resource assignments with one open assignment per resource.
- Maintenance plans and immutable completion events, with optional private
  media references through tenant-scoped foreign keys.
- An immutable stock journal with explicit source/destination, actor, reason,
  job/project, receipt, maintenance-event and purchase-price references.

New tables use tenant-composite keys, RLS, restricted grants and revision
triggers on editable records. Direct writes by ordinary authenticated clients
are not enabled. The booking functions are service-only; the API derives tenant
and actor from authenticated membership rather than the payload.

The stock, receipt and maintenance functions implement repeat-safe event IDs.
Reusing an ID with changed content is rejected. A material row lock serializes
stock issues/transfers. Order locks serialize partial receipts; ordered line
items cannot be altered. Purchase receipts and stock movements commit together.
Insufficient stock aborts the entire booking. Maintenance completion uses an
expected plan revision and generates the next date/meter thresholds.

`lib/operations.ts` contains stock projections, order status derivation,
maintenance warnings/recurrence and DE/SV/EN module/status labels. This library
does not write browser storage or perform network requests.

## Application integration

- `operations_commands` adds typed, allowlisted per-record commands to the existing
  `homecare_sync_mutations` journal and the single existing browser queue. API
  authorization supplies tenant/user; callers cannot edit identities, revision
  columns, trip state or odometers through the extension forms.
- Suppliers/contacts, draft purchase headers/items, order/cancel/receive actions,
  resource extensions/assignments and maintenance plans use revision protection.
  Ordered headers/items cannot be changed; item changes also advance the order
  revision. Receipts require material/order currencies to match (no implicit FX).
- Starting maintenance changes availability atomically and rejects active vehicle
  trips. Completing maintenance posts optional material consumption atomically,
  advances meter/date thresholds and restores availability only if another user
  has not since changed that resource revision.
- The existing Inventory navigation now contains four compact sub-tabs. Forms
  are native modal dialogs with focus restoration, DE/SV/EN labels, bounded
  read pages and server-side search. Existing material/resource master forms are
  linked directly instead of creating duplicate CRUD implementations.
- Stock bookings explicitly record source/destination, reason and job/project.
  The stock screen replaces the old mutable stock editor only after cutover.
  Computed stock totals are read-only and excluded from master-data mutations.
  Receipt, transfer and maintenance-consumption acknowledgements return canonical
  totals and per-location balances for every affected material, updating the
  existing master-data view without generating new stock writes.
- Dashboard warnings cover low stock, overdue/upcoming inspections and unavailable
  resources. Requests are cancelled on unmount; there is no added polling loop.
- Completion documents can be selected from existing private resource documents
  or uploaded directly. The existing private media API is reused with a stable
  media ID across retries. In-progress/failed uploads block completion until the
  user retries or explicitly proceeds without that document. Closing cancels
  stale asynchronous work. The completion event retains the tenant-scoped media
  FK; deleted/foreign documents are rejected. Document uploads require internet;
  unsent file bytes are not advertised as reload-safe offline attachments.
- Per-item receipt and per-plan maintenance histories open in native dialogs,
  use paginated tenant-scoped reads and offer authenticated private downloads.
- The optional session read cache retains only one page of at most 50 records,
  never a growing set of search/page/report snapshots. Mutation durability stays
  in the existing queue, independently of this cache.

## Controlled stock activation

`operations_inventory_cutover` defines an explicit service-only administrative
import. It is NOT executed by migration application or the UI. It imports the
historical source used by the current reader: `record_data.inventoryEntries`
when present, otherwise the legacy relational movements. Both are never summed
together. Every original entry is archived, including zero-delta counts. Signed
adjustment/count quantities are preserved and nonzero movements get deterministic
IDs. Unknown actors are explicitly marked as undocumented, not fabricated.

Unknown/ambiguous locations, malformed entries, duplicate identities, an existing
new journal or unequal totals abort the entire import. Totals are checked per
material/location. The completion marker activates the new editor and blocks old
array/movement writes at the database boundary. New receipts/material-consuming
maintenance are unavailable before that marker exists.

Before actual activation, all devices' old stock queues must be synchronized and
location discrepancies explicitly reconciled. Unsent old edits are never silently
discarded. Production import requires separate reviewed authorization.

## Backup integration

`operations_backup` adds all new tables in FK-safe order and defers the new location
references during restore. The existing authorized, empty-target restore routine
is wrapped with a transaction-local restore flag so received order items can be
restored without relaxing normal edit protection or modifying saved revisions.

## Still Required Before Release

1. Review existing production location mappings and pending legacy queues before
   authorizing stock activation. No production data has been inspected/changed
   during these tests. The feature's Staging checks passed, but they do not
   authorize a production stock import or replace this per-company review.

## Dedicated Staging Verification (8 October 2026)

The user confirmed the existing **WorkCore Staging** project
(`ealfegjvbyiiporettpq`). The earlier assumption that no isolated project was
available was corrected after reading the authenticated CLI project inventory.

`scripts/test-operations-staging.mjs` refuses any other linked project. It stores
a protected logical snapshot of existing public WorkCore records, column
metadata and function definitions in a mode-0700 temporary directory with a
mode-0600 snapshot file. This is not a full physical database/Storage backup.
Only the four Operations migrations were applied, twice. Unrelated missing
historical repair migrations were deliberately not applied. Every pre-existing
record was compared using its original columns and remained unchanged.

The current application API was run locally on port 3102 with Staging-only keys
held in process memory, no Auth bypass and no intercepted test responses.
Production `.env.local` was not modified. Real GoTrue password sessions,
PostgREST/RLS and private Storage verified:

- Unauthenticated and cross-tenant application access is denied.
- Supplier create/update, stable-ID retry and HTTP-409 revision protection work.
- Ordinary authenticated sessions cannot execute the service-only gateway RPC.
- Stock activation applies only to the newly created synthetic tenant; repeated
  stock commands do not create duplicate movements.
- Reloaded material balances sum locations sharing the same display name rather
  than overwriting them. Special property names are retained safely in the
  JSON projection without using object-prototype values as quantities.
- A purchase order passes through ordered, partially received and received.
  Two distinct receipts create two history rows; replay does not duplicate stock.
- Private document upload retries reuse the media ID/path. Anonymous, public-URL
  and cross-tenant downloads are denied; the owning tenant can download the file.
- Maintenance start changes availability; completion links the private document,
  consumes material atomically and calculates the next recurring due date.
- Archiving maintenance without resources.manage is denied with HTTP 403.
- All synthetic tenants/users/files are removed afterward, and existing Staging
  records remain unchanged. Immutable journal cleanup is restricted to the newly
  generated tenant UUIDs in one administrative transaction.

To repeat against this explicitly confirmed project:

```sh
node scripts/test-operations-staging.mjs --verify-only
```

Use `--apply-migrations` only when deliberately applying the four Operations
migrations to this Staging project. Neither mode supports production.

## Verification

Run the SQL tests with:

```sh
node scripts/test-operations-database.mjs
node scripts/test-operations-database.mjs --full-chain
```

This creates a fresh local PostgreSQL cluster in a random temporary directory,
uses only its Unix socket (no network listener), never reads `.env.local` or
`DATABASE_URL`, applies the migration twice and stops/deletes the cluster afterward.
The default fixture represents referenced canonical keys/permission helpers.
The full-chain mode instead applies every historical migration and exercises
real membership-based RLS, the command journal, and a full backup/restore round
trip with exact per-table JSON equality. It checks stock and revision preservation
and that restored received items remain immutable. Only the isolated cluster is
cleared to simulate an empty disaster-recovery target. Neither mode replaces a
live Supabase staging test.

```sh
npx playwright test --workers=2
npx tsc --noEmit
npm run build
git diff --check
```

The Operations UI suite has 24 passing tests, including Chromium and mobile
WebKit, upload failure/retry/cancellation and authenticated private downloads.
It covers bounded search caching, preferred-supplier selection from inventory
and tenant/order-scoped partial-receipt history. The full browser suite passed
294 tests in the final run; the focused Operations/security/vehicle/sync run passed
90 tests. TypeScript and the production build also passed. Both local SQL modes
passed after the final material-balance acknowledgement changes.
It also exercises the actual application's offline-to-online queue processing
and reload persistence with intercepted server acknowledgements. SQL integration
tests independently exercise the real database gateway; this is not claimed as
one continuous live-Supabase browser test. Isolated SQL tests cover receipt/stock idempotency, signed
legacy import, revision conflicts, atomic maintenance rollback, availability and
active-trip protection, RLS/grants and backup list/item protection. Every new
migration is applied twice in fixture mode.

E2E Operations API requests must be mocked; unmocked test-bypass reads/writes are
explicitly rejected, even if `.env.local` contains production credentials.
No push or production activation until the remaining verification is complete.
