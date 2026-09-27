# Legacy Backup Sanitization

Status: prepared, not executed. No production row or backup chunk has been changed.

## Confirmed exposure

The read-only inventory found:

- 301 readable compressed application backups.
- 301 backups containing at least one non-empty historical `portalPassword` value.
- Zero unreadable backup sets in the inspected snapshot.
- Backup payloads stored in `app_state` as `app-backup:` index rows plus ordered `app-backup-chunk:` rows.

The Auth migration removes relational passwords and direct active JSON fields, but cannot sanitize gzip/base64 backup chunks in SQL safely.

## Security handling

- Treat source backups and generated manifests as restricted security data.
- Work only in an encrypted temporary directory with file mode `0600`.
- Never log payloads, email addresses, password values, invitation URLs or decoded backup content.
- Use a dedicated staging copy first.
- Require two-person approval before replacing or deleting production backup rows.

## Prepared offline transformation

For each `app-backup:` index:

1. Read the referenced chunk IDs in `storagePaths` order.
2. Verify all chunks share the expected `backupId`, indexes are contiguous and `total` is consistent.
3. Concatenate `data.content`, base64-decode and gzip-decompress.
4. Parse JSON and recursively remove keys whose normalized name is `portalPassword` or `portal_password`.
5. Do not replace the value with an empty string; remove the key entirely.
6. Serialize deterministically, gzip and base64-encode.
7. Calculate source and sanitized SHA-256 checksums and byte sizes.
8. Split using the application's current chunk size.
9. Write new rows under a new immutable ID such as `sanitized-app-backup:<batch>:<source-hash>`.
10. Write a new index containing provenance, source index ID hash, source/sanitized checksums, counts, batch ID and sanitization timestamp.

The transform must be idempotent by `(tenant_id, source checksum, sanitizer version)`. A retry returns the existing sanitized backup after checksum verification.

## Dry-run manifest

The dry run produces no database writes. Its manifest contains only:

```json
{
  "batchId": "...",
  "tenantId": "...",
  "sourceIndexIdHash": "...",
  "sourceChecksum": "...",
  "sanitizedChecksum": "...",
  "sourceBytes": 0,
  "sanitizedBytes": 0,
  "removedCredentialFields": 0,
  "chunkCount": 0,
  "sanitizerVersion": "1"
}
```

Do not include original backup IDs, customer data or removed values in general logs.

## Staging execution sequence

1. Export staging backup rows to the encrypted working directory.
2. Run the offline transform and retain source files unchanged.
3. Assert every readable backup produces exactly one sanitized output.
4. Assert recursive scans find zero non-empty credential keys.
5. Insert sanitized rows under new IDs in one tenant/batch transaction.
6. Restore a representative old, middle and newest sanitized backup into a disposable tenant.
7. Verify customer/job/report/media counts and critical relationships.
8. Verify portal passwords are absent after restore.
9. Verify the application can list and restore the sanitized format.
10. Record approval before any source deletion.

## Production cutover, separately authorized

Production execution requires an explicit later approval and maintenance window.

- Pause backup creation for the affected tenant.
- Create and verify sanitized replacements first.
- Switch backup indexes/references to sanitized IDs without deleting sources.
- Keep source chunks inaccessible to application users during the rollback window.
- After restore sign-off, delete original index and chunk rows in an audited batch.
- Resume backup creation only after new backups are confirmed credential-free.

## Rollback

Before source deletion, rollback removes the new sanitized index/chunks and restores the previous index visibility. Source rows remain unchanged.

After source deletion, rollback is allowed only from the encrypted, access-controlled retention copy with documented security approval. Never restore an exposed backup into an active tenant without immediately sanitizing it again.

## Retention and incident response

- Default rollback retention: 30 days unless legal requirements dictate otherwise.
- Access to retained originals must be logged and limited to named custodians.
- Delete retained originals securely when the rollback period expires.
- Record this as historical credential exposure because users may have reused passwords elsewhere.
- New portal access uses Supabase Auth invitations; legacy passwords must never become valid again.

## Acceptance criteria

- 301 of 301 source backups accounted for.
- 301 sanitized replacements checksum-verified.
- Zero `portalPassword` or `portal_password` values in decoded retained backups.
- Representative restores preserve non-credential data and relationships.
- Original chunks are either deleted after approval or covered by an explicit legal retention record.
- No production action occurs as part of this preparation task.
