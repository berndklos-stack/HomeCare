# WorkCore Staging Setup Checklist

Purpose: create a dedicated non-production Supabase project named **WorkCore Staging** for Auth/Tenant/RLS, Sync Foundation, portal and private-media verification.

## 1. Isolation and ownership

- [ ] Create a new Supabase project named exactly `WorkCore Staging`.
- [ ] Use the existing EU organization and an EU region, preferably matching production latency requirements.
- [ ] Confirm its project ref differs from every production and unrelated project ref.
- [ ] Store the database password and service key in the team password manager.
- [ ] Restrict dashboard access to named maintainers.
- [ ] Do not restore production Auth secrets, SMTP credentials or Storage policies unchanged.
- [ ] Use synthetic users and customer data for functional tests.
- [ ] Any real-data rehearsal copy must be temporary, access-restricted and deleted after aggregated results are recorded.

## 2. Local/CI environment

Use a staging-only environment file that is excluded from Git. Never overwrite `.env.local` while it points at another environment.

Required:

| Variable | Staging value/rule |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<WORKCORE_STAGING_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging publishable/anon key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service-role key; server runtime only |
| `CUSTOMER_PORTAL_URL` | Staging application URL ending in `/portal` |
| `CRON_SECRET` | Random staging-only secret, at least 32 bytes |
| `NEXT_PUBLIC_DISABLE_SUPABASE_SYNC` | `0` or unset |
| `WORKCORE_E2E_AUTH_BYPASS` | unset outside isolated automated tests |
| `NEXT_PUBLIC_E2E_AUTH_BYPASS` | unset outside isolated automated tests |

Optional integrations must use sandbox credentials and sink recipients:

| Variable | Staging rule |
| --- | --- |
| `RESEND_API_KEY` | Resend test/sandbox key |
| `REPORT_SENDER_EMAIL` | Verified staging sender |
| `DAILY_JOB_LIST_EMAIL` | Controlled test inbox, never a customer list |
| `REPORT_UNLOCK_PASSWORD` | Unique staging value, if route remains enabled |
| `OPENAI_API_KEY` | Restricted test key or leave feature disabled |
| `OPENAI_ODOMETER_MODEL` | Explicit approved test model |
| `GOOGLE_MAPS_API_KEY` / `GOOGLE_GEOCODING_API_KEY` | Domain/API-restricted staging key |

- [ ] Confirm client bundles contain only the publishable key, never `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Confirm CI logs redact tokens, invitation links and database URLs containing passwords.
- [ ] Run `supabase projects list` and visually verify the staging ref before every remote write.

## 3. Supabase Auth / GoTrue

- [ ] Enable email authentication.
- [ ] Disable anonymous sign-in.
- [ ] Set Site URL to the staging application origin.
- [ ] Add the exact staging `/portal` URL to allowed redirect URLs.
- [ ] Add localhost redirects only for controlled local development.
- [ ] Require sufficiently strong passwords and email confirmation/invitation acceptance.
- [ ] Configure staging SMTP or Supabase test delivery; never send test invitations to real customers.
- [ ] Use a short, documented JWT lifetime appropriate for testing revocation.
- [ ] Verify sign-out/session revocation and expired invitation behavior.
- [ ] Keep service-role keys out of browser code and user-visible responses.

## 4. Database and migrations

- [ ] Start from the current pre-Foundation migration state.
- [ ] Record PostgreSQL, GoTrue, PostgREST and Storage versions.
- [ ] Take a staging backup before applying Foundation migrations.
- [ ] Apply `20260926120000_sync_foundation_vehicle_trips.sql`.
- [ ] Apply `20260927100000_auth_tenant_rls_roles.sql`.
- [ ] Apply `20260927110000_resolve_field_progress_orphans.sql`.
- [ ] Apply `20260927120000_harden_service_function_acl.sql`.
- [ ] Apply `20260927130000_refine_role_rls.sql`.
- [ ] Apply `20260927140000_validate_tenant_foreign_keys.sql`.
- [ ] Apply `20260927150000_revoke_anonymous_table_access.sql`.
- [ ] Apply `20260927160000_correct_import_helper_volatility.sql`.
- [ ] Run `supabase/tests/auth_tenant_rls.sql`.
- [ ] Run `supabase/tests/sync_foundation_database.sql`.
- [ ] Run `supabase/tests/field_progress_orphan_resolution.sql`.
- [ ] Validate every `NOT VALID` foreign key in a transaction.
- [ ] Verify all tables with `tenant_id` have RLS enabled.
- [ ] Verify `anon` has no business-table access.
- [ ] Verify privileged RPCs are executable only by `service_role`.
- [ ] Confirm no plaintext `portal_password`, `portalPassword` or equivalent remains in active relational/JSON data.

## 5. Storage

- [ ] Create `homecare-private-media` with `public = false` and 25 MB file limit.
- [ ] Create `homecare-backups` with `public = false` and 60 MB file limit only when Storage backups are enabled.
- [ ] Create `homecare-media` only as a temporary legacy-migration fixture; new uploads must not use it.
- [ ] Revoke anonymous object reads for private and backup buckets.
- [ ] Store all application media below `<tenant-id>/...`.
- [ ] Reserve `quarantine/unassigned/...` for objects without confirmed ownership; it must not be application-readable.
- [ ] Verify `/api/private-media` returns `Cache-Control: private, no-store`.
- [ ] Verify upload responses never contain `/storage/v1/object/public/` after cutover code is enabled.
- [ ] Test tombstoned/deleted media and permission revocation immediately block a new request.

## 6. Test tenants and identities

Create two synthetic tenants, `staging-company-a` and `staging-company-b`, with separate customers, jobs and vehicles.

| Test identity | Membership/scope | Required checks |
| --- | --- | --- |
| `owner-a@staging.invalid` | Owner in A | All permissions, member/role administration |
| `admin-a@staging.invalid` | Admin in A | Same initial V1 admin permissions |
| `manager-a@staging.invalid` | Manager in A | Operational writes, no member/role administration |
| `office-a@staging.invalid` | Office in A | Operational writes, no tenant administration |
| `field-a@staging.invalid` | Field worker in A | Read/jobs/resources/media/sync only; no generic admin write |
| `multi@staging.invalid` | Manager in A, office in B | Explicit tenant switch; no third-tenant access |
| `owner-b@staging.invalid` | Owner in B | Tenant-B control identity |
| `portal-a@staging.invalid` | Portal access to one customer in A | Customer-only portal scope |
| `unassigned@staging.invalid` | Auth user with no membership/access | No business data access |

- [ ] Create staff identities through Supabase Auth and explicit memberships.
- [ ] Create the portal identity through `auth.admin.inviteUserByEmail` via the application route.
- [ ] Accept the invitation and log in through the real staging portal.
- [ ] Verify a portal identity cannot select another customer, tenant, object, job, report or invoice.

## 7. Required end-to-end tests

- [ ] Unauthenticated PostgREST and API requests fail.
- [ ] Tenant A cannot read or mutate Tenant B through PostgREST.
- [ ] All five initial roles match the documented permission matrix.
- [ ] Multi-company selection works only for explicit memberships.
- [ ] Service-role routes reject missing/invalid user context before using service access.
- [ ] Portal invitation, acceptance, login and customer scope work.
- [ ] Same mutation ID retries without duplication.
- [ ] Same mutation ID may exist independently in two tenants.
- [ ] Stale revision returns conflict without data loss.
- [ ] Two concurrent starts for one tenant/vehicle produce one active trip and one conflict.
- [ ] Vehicle positions remain tenant-scoped and update correctly after ending a trip.
- [ ] Daily-jobs cron rejects missing/wrong `CRON_SECRET`.
- [ ] Daily-jobs cron rejects a missing `X-WorkCore-Tenant`.
- [ ] Daily-jobs cron with valid secret/header includes only that tenant's data.
- [ ] Private media cannot be downloaded anonymously or across tenants.

## 8. Exit criteria

- [ ] Both migrations and SQL suites pass without manual intervention.
- [ ] GoTrue, PostgREST, Storage and application-route tests pass.
- [ ] Zero unresolved cross-tenant reads/writes.
- [ ] Zero orphaned foreign keys in the staging rehearsal dataset.
- [ ] Zero active plaintext portal credentials, including retained backups.
- [ ] Zero new public upload URLs.
- [ ] Test artifacts and invitation users are removed or retained under a documented staging policy.
- [ ] Results include timestamps, versions, project ref and operator, but no secrets.

## 9. Verification run 2026-09-27

Environment: dedicated Supabase project `WorkCore Staging`
(`ealfegjvbyiiporettpq`) and the separate Vercel project at
`https://workcorestaging.vercel.app`. No production database, Storage bucket or
deployment was modified.

Service versions:

| Service | Staging version |
| --- | --- |
| PostgreSQL | `17.6.1.166` |
| GoTrue | `v2.197.0` |
| PostgREST | `v14.5` |
| Storage API | `v1.77.5` |

Results:

- **PASS:** Complete migration history through
  `20260927160000_correct_import_helper_volatility.sql` applied without manual SQL.
- **PASS:** `auth_tenant_rls.sql`, `sync_foundation_database.sql` and
  `field_progress_orphan_resolution.sql` pass against the final remote schema.
- **PASS:** All WorkCore tables have RLS enabled; `anon` has no table grants;
  service-only RPCs are executable only by `service_role`.
- **PASS:** Cross-tenant reads and writes, role restrictions, multi-company
  memberships and portal customer scope were verified through PostgREST.
- **PASS:** A real GoTrue invitation token was generated, accepted and used for
  password login. Actual SMTP delivery through `inviteUserByEmail` remains open
  because no authorised receiving staging inbox was available.
- **PASS:** Service-role-backed application routes reject absent, unauthorised
  and cross-tenant contexts before performing privileged operations.
- **PASS:** Mutation idempotency, stale-revision conflicts, vehicle positions
  and concurrent trip starts were verified. Two simultaneous starts produced
  one success and one conflict, with exactly one active database row.
- **PASS:** Daily-jobs rejects missing/wrong secrets and a missing tenant header;
  a valid tenant-scoped disabled configuration returns a safe skipped result.
- **PASS:** New media uploads use `homecare-private-media`, return only
  `/api/private-media` URLs, cannot be read anonymously/across tenants, and are
  blocked immediately after Storage deletion or relational tombstoning.
- **PASS:** `homecare-private-media`, legacy `homecare-media` and
  `homecare-backups` are private. Quarantine paths are not application-readable.
- **PASS:** Zero unvalidated tenant foreign keys, field-progress orphans, active
  duplicate trips, relational plaintext portal passwords and JSON
  `portalPassword` keys in this synthetic staging dataset.
- **PASS:** Supabase database lint reports no schema errors or warnings after
  correcting the import helpers' function volatility.
- **OPEN:** The project Storage limit permits 50 MB, not the planned 60 MB, for
  `homecare-backups`. Raise the project limit or adopt 50 MB as the documented
  application maximum before enabling Storage backups.
- **OPEN:** Verify real `auth.admin.inviteUserByEmail` delivery, expiry and
  revocation with a controlled staging mailbox. Do not use customer addresses.
- **NOTE:** The project contains synthetic test identities and tenant fixtures by
  design. Retain them only under the documented staging-data policy.

Foundation recommendation: the code and database migrations are technically
ready for review and commit. The overall staging release gate remains
conditional until SMTP invitation delivery and the backup-object size decision
are closed.

## 10. Production blockers

The verified Foundation commit does not authorize a production rollout. The
following blockers must be closed and approved separately before production
migration or cutover:

1. Verify real SMTP delivery, acceptance, expiry and revocation for
   `auth.admin.inviteUserByEmail` with a controlled non-customer mailbox.
2. Decide and document whether `homecare-backups` uses the current 50 MB project
   limit or whether the Supabase project limit is raised to the planned 60 MB.
3. Execute and verify the approved legacy-backup sanitization runbook; the
   historical backup chunks containing `portalPassword` must not remain in the
   active backup set.
4. Execute the private-media production cutover, including tenant assignment,
   checksum/reference verification, authenticated delivery, rollback readiness
   and final removal of public access.
