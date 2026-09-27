# Private Media Migration Plan

Status: preparation only. No production object or database row has been changed.

## Preconditions

- A dedicated Supabase staging project exists and is explicitly identified as non-production.
- The Auth/Tenant/RLS and Sync Foundation migrations pass in that project.
- Application media writes are paused for the cutover window or dual-written to both buckets.
- A database backup, Storage inventory and restore test are complete.
- The migration operator has a short-lived service credential and writes an immutable audit log.

## Current inventory snapshot

Read-only inventory on 2026-09-27:

| Bucket | Public | Objects | Assigned | Unowned | Conflicts |
| --- | ---: | ---: | ---: | ---: | ---: |
| `homecare-media` | yes | 2,623 | 587 | 2,036 | 0 |
| `homecare-private-media` | no | 104 | 98 | 6 | 0 |
| `homecare-backups` | absent | 0 | 0 | 0 | 0 |

The relational media table contains 12 rows. Eleven have no `storage_path`; the one stored path resolves to an existing object. The legacy `app_state` store contains 1,800 rows. Two direct JSON rows and 301 of 301 readable compressed application backups contain historical `portalPassword` values before the Auth migration.

Recreate the inventory without exposing object paths in terminal output:

```bash
node scripts/audit-private-media.mjs
```

Write the sensitive object-level manifest only to an encrypted/restricted working directory:

```bash
node scripts/audit-private-media.mjs --manifest=/secure/workcore/media-manifest.json
chmod 600 /secure/workcore/media-manifest.json
```

## Tenant assignment

Assign each object using this precedence:

1. Exact `homecare_media.storage_path` reference and its `tenant_id`.
2. Exact reference in a tenant-scoped `app_state` row.
3. A first path segment that is an existing tenant UUID.
4. A reviewed owner relationship from object/resource/report metadata.
5. Otherwise classify as `unassigned`; never guess a tenant.

Multiple different tenant candidates are a blocking conflict. `unassigned` objects are copied to a private quarantine namespace and are never exposed through an application delivery endpoint.

For the inventory recorded in `docs/security/Unowned-Media-Classification.md`, the human-approved classification is fixed at **0 migrate, 2036 quarantine, 0 delete-later, 0 unknown**. The single currently plausible tenant is not ownership evidence. Inventory drift after that snapshot requires a new report and a separate human decision; new unowned files default to quarantine.

## Copy phase

For every assigned object, use a destination path that starts with its tenant UUID:

```text
<tenant-id>/legacy/<sha256-of-source-path>/<sanitized-filename>
```

For every unassigned object, use:

```text
quarantine/unassigned/<sha256-of-source-path>/<sanitized-filename>
```

The copy worker must:

1. Download the source object without modifying it.
2. Calculate SHA-256 and byte length locally.
3. Preserve MIME type and relevant object metadata.
4. Upload to `homecare-private-media` with `upsert: false`.
5. Download the destination and compare SHA-256, byte length and MIME type.
6. Record source bucket/path hash, destination path, tenant, checksums, size, MIME type, attempt ID and result in the migration manifest.
7. Retry only by stable attempt ID. A destination with a different checksum is a hard conflict.

No source object is deleted or made private during this phase.

## Reference updates

After all assigned copies verify successfully, update references in a database transaction per tenant and migration batch:

- `homecare_media.storage_path` receives the private destination path.
- `homecare_media.preview_url` and `source` must no longer contain public Storage URLs.
- Active `app_state` and sync-section JSON references become `/api/private-media?path=<encoded-path>`.
- New media rows receive provenance in `metadata`: migration batch, old path hash, checksum and migrated timestamp.
- Deleted/tombstoned media remains deleted and is not reintroduced by JSON fallback data.

Before commit, assert that every changed destination exists and has a matching manifest checksum. Roll back the tenant batch on any missing object, conflict or ambiguous owner.

## Authenticated delivery

`/api/private-media` remains the only application delivery route for migrated files. It must verify:

- a valid Supabase Auth user;
- explicit tenant membership and `data.read`;
- tenant ownership of the path or a non-deleted `homecare_media` row;
- tombstone state before download;
- portal customer scope for customer-visible media before portal delivery is enabled.

Do not issue permanent public URLs. If signed URLs are introduced, generate them server-side only after the same authorization checks, use a short lifetime, and never persist them as canonical media references.

## Cache behavior

During migration and deletion hardening, return `Cache-Control: private, no-store` or a short private lifetime. The current one-year immutable response is not suitable while deletion and access changes must take effect promptly.

Use versioned private paths, not mutable files at one path. After public access is removed, verify old anonymous URLs from an unauthenticated network and account for CDN/browser retention. Do not declare removal complete while a sampled old public URL still returns `200`.

## Legacy backup cleanup

The compressed backups are stored as `app-backup:` index rows and `app-backup-chunk:` rows in `app_state`, not in a current `homecare-backups` Storage bucket.

Safe cleanup:

1. Apply the Auth migration so active relational and direct JSON portal passwords are removed.
2. Export each backup to encrypted, access-restricted temporary storage and record its original checksum.
3. Decompress locally, recursively remove every `portalPassword` key, recompress and calculate a new checksum.
4. Restore-test a representative sanitized backup and verify that no password key remains.
5. Write sanitized chunks under a new backup ID and migration batch; never overwrite the only source copy.
6. After approval, delete the exposed original chunk/index rows as one audited batch.
7. Retain encrypted originals only when legally required, with named custodians and a short documented expiry. Otherwise securely delete them after the rollback window.

Because legacy portal passwords may have been reused elsewhere, communicate credential invalidation as a security event even though the new portal uses Supabase Auth.

## Orphans and retention

- `unassigned` files remain inaccessible in private quarantine.
- Keep the source-to-quarantine manifest for 90 days unless legal requirements specify otherwise.
- Product/data owners review orphans in batches and either assign a tenant, retain for a documented legal reason, or approve deletion.
- No quarantined object can be served by `/api/private-media`.
- Conflicting assignments block the whole affected tenant batch.
- The 2036 approved quarantine objects must be copied losslessly and checksum-verified; quarantine does not assign them to a tenant.
- Their source objects may be deleted only after the private-media migration is complete, application references are migrated, public access is disabled, the retention period has expired, the manifest fully reconciles and a human explicitly approves deletion.

## Cutover and removal of public access

Proceed only when copied object count, checksum count and updated reference count all reconcile.

1. Change `app/api/media/route.ts` to upload new files directly to `homecare-private-media`, return only `/api/private-media?path=<encoded-path>`, remove `getPublicUrl`, and refuse to create or recreate a public bucket.
2. Deploy private delivery and verify that no upload response contains `/storage/v1/object/public/`.
3. Run the copy and reference phases tenant by tenant.
4. Verify staff and portal authorization, deletion, mobile access and offline retry in staging.
5. Set `homecare-media` to private and remove anonymous Storage policies.
6. Verify anonymous access fails for a representative sample, including previously cached URLs.
7. Keep source objects for the approved rollback window without public access.
8. Delete legacy source objects only after sign-off and manifest reconciliation.

## Rollback

Before public cutover, rollback means restoring database references from the manifest; source objects remain untouched.

After public access is removed, rollback must not make the bucket public again. Restore the previous application release while continuing authenticated delivery from either the verified private destination or an authenticated compatibility route to the retained source objects.

Database updates are grouped by tenant and migration batch. Roll back only the affected batch, verify checksums again, and preserve the audit record.

## Go/no-go checks

- Zero ownership conflicts.
- Every active referenced file has exactly one tenant.
- Every copied object has matching source and destination checksums.
- Zero canonical public URLs in relational and active JSON data.
- Zero readable `portalPassword` values in relational, active JSON and retained backups.
- Staff and portal authorization tests pass through the real Supabase stack.
- Anonymous access to sampled legacy URLs fails.
- Restore from a sanitized backup succeeds.
