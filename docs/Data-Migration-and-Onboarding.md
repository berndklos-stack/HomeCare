# Data Migration and Onboarding

## Onboarding
Goal: productive in about 5–10 minutes without demo data.

Suggested flow:
1. Language
2. Company information
3. Business type(s)
4. Workspace/object terminology
5. First customer
6. First object/project/site
7. First job
8. Optional employees
9. PWA install guidance
10. Finish/dashboard/first-steps checklist

## Import
Support CSV, Excel-compatible files, standard exports and APIs/connectors where practical.

Before import:
- detect columns
- suggest field mappings
- detect duplicates
- validate required values
- show create/update/skip counts
- allow correction before commit

## Duplicate handling
Merge, skip, create separate or map to existing.

## Dry run
Use real validation/mapping logic without changing production data.

## Rollback
Imports should be grouped by batch and be reversible where practical.

## Relationships
Preserve customer-job, job-invoice, project-document, employee-time, vehicle-trip and item-price relationships.

## Files
Migrate PDFs, photos, contracts, reports, invoices and attachments while preserving links.

## Provenance
Store import batch, source system, original external ID, date, mapping profile and actor.

## Logging
Record total, created, updated, skipped, failed and warnings.

## Reusable profiles
Saved mappings and transformation rules should be reusable.

## Staged migration
Support master data, relationships, transactions, documents/media, validation and approval as separate phases.

## Data quality
Check required fields, formats, orphaned references, duplicate IDs, unusual values and missing links.

## Cutover
Define a clear point where new work belongs in WorkCore and the old system becomes read-only.

## Go-live approval
Critical data, users, roles, workflows and integrations must be checked before declaring migration complete.
