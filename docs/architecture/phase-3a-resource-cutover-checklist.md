# Phase 3A Resource Cutover Checklist

Recorded before implementation on 27 September 2026.

## Current paths

- [x] Resource reads: `GET /api/sync-sections?keys=resources` loads
  `sync-section:resources`, `homecare_resources`, `homecare_vehicle_trips` and
  `homecare_media`, then merges relational and legacy records.
- [x] Resource writes: `POST /api/sync-sections` writes the complete resource
  section to `app_state` first, then upserts resource/media rows. Trips already
  bypass this writer and use `/api/sync-mutations`.
- [x] Resource offline path: tenant-scoped `localStorage` plus the legacy
  `pendingSyncKeys` whole-section retry; trip changes additionally use the
  durable mutation queue.
- [x] Position reads: `/api/vehicle-positions` merges relational rows with
  JSON-only positions from the `app_state` row `vehicle-positions`.
- [x] Position writes: relational upsert first, with a whole-list `app_state`
  fallback when it fails.
- [x] Resource deletion currently removes the item from the client list; no
  authoritative resource tombstone mutation is sent.

## Expected write cutover

- [x] Resource create/update/delete/restore and vehicle-position updates use
  tenant-scoped, idempotent record mutations with revisions.
- [x] The durable offline queue accepts resource and vehicle-position entities.
- [x] Resource changes no longer write `sync-section:resources` or the full
  snapshot; no complete relational list is overwritten.
- [x] Resource and related media tombstones prevent legacy/cache resurrection.
- [x] Trip mutations and the one-active-trip invariant remain unchanged.

## Expected read cutover

- [x] Relational resources, non-deleted media, trips and positions are returned
  as the authoritative view.
- [x] Legacy resource/position JSON is consulted only behind an explicit
  rollback/read-fallback switch and every use emits telemetry.
- [x] Pending local resource/position mutations are overlaid record-by-record,
  never as a complete section.
- [x] Rollback can re-enable the observable legacy read fallback without
  re-enabling JSON writes or making JSON authoritative.

## Verification gate

- [x] Create, update, stale update, delete, restore and offline replay pass.
- [x] Deleted resources cannot return from `app_state`.
- [x] Position update, tenant isolation and active-trip compatibility pass.
- [x] TypeScript, production build, Playwright, SQL/integration tests and
  `git diff --check` pass.

## Cutover and rollback

1. Apply `20260928100000_resource_vehicle_position_cutover.sql`. It first
   imports JSON-only resource, media and position records without overwriting
   an existing relational row or tombstone.
2. Deploy the application write cutover. `/api/sync-mutations` is then the only
   resource/position writer; the old section endpoint rejects resource writes
   and the old snapshot RPC loses execute permission.
3. The read cutover is the default: `app_state` resources are removed from API
   responses and relational reads include only non-deleted rows.
4. For a read-only rollback, set
   `WORKCORE_RESOURCE_LEGACY_READ_FALLBACK=1`. Every fallback use emits
   `LEGACY_RESOURCE_READ_FALLBACK` and the response header
   `X-WorkCore-Legacy-Fallback`. This does not restore JSON writes.
5. If the mutation handler itself must be rolled back, restore the previous
   application version while leaving the new columns, journal entries and
   tombstones intact. Do not run a destructive down migration. Reconcile queued
   mutations before removing any database object.

## WorkCore Staging verification (28 September 2026)

- Project ref: `ealfegjvbyiiporettpq`; PostgreSQL 17.6.
- The migration applied cleanly through Supabase CLI and passed a second full
  execution through the Management SQL API.
- Phase 3A, Sync Foundation and Auth/RLS SQL suites passed against the remote
  database. Their transactions rolled back, leaving no fixture resources or
  mutation-journal rows.
- The current local application code was run against the real staging database
  because no Vercel deployment was authorized. It returned `409` for resource
  section writes and `410` for the retired position POST route.
- The legacy snapshot RPC returned `403` for `service_role`.
- A temporary JSON-only resource stayed invisible with the fallback disabled.
  With `WORKCORE_RESOURCE_LEGACY_READ_FALLBACK=1`, it became visible and emitted
  `LEGACY_RESOURCE_READ_FALLBACK` plus the fallback response header; writes
  remained rejected. The temporary row was removed after verification.
- TypeScript, production build, 29 relevant Playwright tests and
  `git diff --check` passed. No production system was accessed or changed.
