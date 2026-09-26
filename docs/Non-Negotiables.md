# Non-Negotiables

1. **Server is the source of truth.** Clients may cache, work offline and queue mutations, but must not become competing permanent sources of truth.
2. **No silent data loss.** Concurrent edits or stale revisions must never silently overwrite newer data.
3. **Stable identity.** Sync-relevant records and mutations require stable globally unique IDs.
4. **Durable offline work.** Offline changes must survive restart, sleep and connection loss.
5. **Idempotent mutations.** Retrying the same mutation must not duplicate business effects.
6. **Recoverable deletion.** Use tombstones/soft deletion where needed so deleted data does not reappear from stale clients.
7. **Revision-aware updates.** Conflict-capable records must check expected revision/version.
8. **Critical rules belong on the server/database.** Important invariants must not rely only on the UI.
9. **Trust before cleverness.** Correctness, clarity and recoverability come before convenience.
10. **No hidden important actions.** AI/automation may prepare and recommend; consequential actions remain under user control unless explicitly configured.
11. **Mobile is a full product surface.**
12. **Offline is a normal operating mode.**
13. **Clear sync state.** Distinguish local, pending, syncing, synced, offline, failed and conflict where relevant.
14. **Permissions are enforced server-side.**
15. **Tenant isolation is mandatory.**
16. **Critical actions are auditable.**
17. **Customers can export their data.**
18. **Critical configuration changes should support preview, impact visibility and rollback/versioning where practical.**
19. **Existing data must be preserved through migrations/refactors unless an explicit migration says otherwise.**
20. **No duplicate long-term platform architectures.** Temporary transition paths must converge.
21. **Critical workflows require quality gates and automated tests.**
22. **Simplicity is a product requirement.** Flexibility must not create an ERP settings maze.
