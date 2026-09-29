# Wave 4: Financial relational cutover

Status: locally implemented; WorkCore Staging verification pending (29 September 2026)

## Scope and authority

- `homecare_billing_items` is authoritative for invoice headers and billing state.
- `homecare_invoice_lines` is authoritative for invoice positions and deterministic net, tax and gross totals.
- `homecare_payments` stores immutable payment events with stable associations.
- `homecare_accounting_exports` stores immutable export and correction events.
- `homecare_financial_audit` records every relational financial insert and update.
- Existing invoice IDs, invoice numbers, outgoing-book numbers, customer/job/object/report relationships and accounting fields are preserved.

## Integrity contract

- All writes use `homecare_apply_financial_mutation` through the existing durable mutation queue.
- Mutation IDs are idempotent; stale expected revisions return conflicts instead of overwriting another device.
- Invoice numbers are tenant-unique and allocated under an advisory transaction lock when a requested number is already occupied.
- Issued, sent, paid and cancelled invoices cannot have fiscal identity, amount or relationship fields destructively replaced.
- Positions become immutable as soon as an invoice leaves draft state.
- Payments and accounting export events cannot be updated or hard-deleted. Corrections require a new explicit event.
- Invoice totals are recalculated from live positions with one deterministic rounding rule.
- Draft deletion uses tombstones. Hard deletion of financial records is rejected.

## Reconciliation gate

The migration runs in one transaction and raises an exception on any mismatch. It verifies:

- every legacy financial record has a relational invoice row;
- invoice numbers are unchanged and duplicate-free per tenant;
- every embedded invoice position has exactly one relational position;
- paid invoices have a payment with the preserved amount;
- exported invoices have a matching export event;
- customer, job and report relationships resolve within the same tenant;
- stored invoice totals equal the deterministic sum of live positions.

Relational rows always win during import. The legacy snapshot is a one-way source only for absent records and cannot overwrite current relational data.

## Runtime cutover

- `/api/sync-sections` serves composed relational invoice projections and rejects `billing` writes.
- `/api/app-state` strips `billing` from writes and always serves an empty legacy billing list.
- Backup restore and media migration strip legacy billing JSON, preventing resurrection.
- Pending invoice mutations overlay relational reads and replay after reconnect.
- The customer portal reads only nondeleted relational invoices.

## Consolidated checklist

- [x] Audit invoices, lines, payments, statuses, numbering and accounting export paths.
- [x] Add tenant-scoped relational line, payment, export and audit tables.
- [x] Add revisions, tombstones and deterministic totals.
- [x] Preserve invoice numbers, outgoing-book numbers and payment associations.
- [x] Preserve customer, object, job, report and consulting-derived billing relationships.
- [x] Replace whole-list financial writes with durable record mutations.
- [x] Reject stale revisions and make offline replay idempotent.
- [x] Protect issued invoices and immutable payment/export evidence.
- [x] Add fatal migration reconciliation for counts, totals, numbers and unmatched records.
- [x] Prevent JSON resurrection through app state, section sync and backup restore.
- [x] Add SQL and Playwright coverage for integrity, conflicts and tenant isolation.
- [ ] Apply the migration twice on dedicated WorkCore Staging.
- [ ] Verify real PostgREST/RLS reads and mutations for every financial table.
- [ ] Verify concurrent mobile/desktop draft edits and stale conflicts.
- [ ] Verify offline invoice creation and reconnect replay.
- [ ] Compare staging record counts, invoice totals, payment totals and invoice numbers.
- [ ] Remove all temporary staging records.

## Local verification gate

Result on 29 September 2026: the migration and its idempotent second application
passed. A seeded legacy rehearsal preserved one invoice, one line, the `125.00`
gross total, one payment, one export and invoice number `INV-2026-77`. All nine
SQL suites, TypeScript, the production build, `git diff --check` and Playwright
(`81/81`) passed.

```text
supabase/tests/auth_tenant_rls.sql
supabase/tests/sync_foundation_database.sql
supabase/tests/resource_vehicle_position_cutover.sql
supabase/tests/settings_relational_cutover.sql
supabase/tests/customer_contact_relational_cutover.sql
supabase/tests/object_media_relational_cutover.sql
supabase/tests/job_operations_relational_cutover.sql
supabase/tests/report_media_communication_relational_cutover.sql
supabase/tests/financial_relational_cutover.sql
npx tsc --noEmit
npm run build
npm run test:e2e -- --workers=4
git diff --check
```

Production migration, deployment, commit and push are outside this wave.
