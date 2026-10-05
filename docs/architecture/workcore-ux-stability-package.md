# WorkCore UX and Stability Package

## Production observation (2026-10-03)

Read-only inspection of the authenticated browser showed 1,112 conflict entries:
1,109 report_media and 3 job mutations. The toolbar count was 1,114, which also
includes pending/failed entries. All 1,109 media conflicts lacked a server revision.
The job conflicts included differing statusUpdatedAt values. None were discarded.
Missing server records are not proof that unsynced data can safely be removed.
This is one browser's queue, not an inventory of all devices.

## Changes

- Render at most 25 conflict entries per page and only one expanded comparison.
  Previously every payload was rendered even inside closed details elements.
- Add an authenticated, tenant-filtered, read-only conflict review endpoint.
  Requires sync.write, jobs.manage and media.manage. Returns verdicts, not media
  URLs or private row data. Does not mutate database records or sync ledger.
- Review batches of at most 25 on explicit user action, with a 15-second request
  timeout and cancellation on unmount/context change. No background review loop.
- Only report/communication media updates with all payload fields already present
  in metadata AND matching affected relational columns can be redundant. Deletes
  need an actual owned tombstone. Missing rows, creates/restores, unsupported
  domains, different ownership or values remain protected/manual.
- Before accepting redundant entries, read the server again and check that the
  local mutation is unchanged and has no other outstanding mutation for that
  entity. Persist removal immediately through the existing durable queue.
- Job conflicts are intentionally not automatically classified as redundant.
  Revision, status and schedule differences require explicit review.

## Existing functionality retained

Sticky header, safe areas, camera/library multiple selection, private uploads,
and the revisioned company jobPhotoDeviceSave setting were already implemented.
They are regression-tested here, not implemented as a second sync mechanism.
No schema migration and no operational app_state access are added.

Never offers no additional device-save action; Ask offers saving or skipping;
Always presents captured photos for saving. On iOS Safari/PWA, a user must invoke
sharing or download; there is no automatic background photo-library write.
Library-selected photos are not offered for re-saving. Downloads may land in
Files, not Photos. See https://webkit.org/blog/13862/the-user-activation-api/.

## Release limitations

Production cleanup requires the new review endpoint to be deployed and a fresh
review of the device queue. No production queue was cleared during implementation.
The actual number of safely redundant production mutations is still unknown.
Tests use fixtures and mocked review responses; they are not a production login
or real iPhone camera/Photos test. Reload and same-context app reopening exercise
durability; real logout/login verification remains a release smoke-test item.
This work is included with Branding and Fahrtenbuch in the consolidated 1.425.0 release.

## Timer measurement

The parallel WebKit run exposed a flaky total-timeout comparison (two rather
than one). Captured scheduling stacks identify the extra 200/500ms timers as
Next.js next-devtools indicator animations, not report autosave or sync work.
The report regression now records both all timers and application timers with
their immediate scheduling origin. Only that known devtools caller is excluded
from the application-growth assertion; unknown callers remain counted. Three
isolated repetitions (nine tests) passed with stable listeners/intervals and
bounded queues. This does not establish physical-iPhone memory stability.

## Package files

- app/page.tsx
- app/api/sync-conflicts/review/route.ts
- components/SyncStatus.tsx
- lib/conflictReview.ts
- lib/useSyncQueue.ts
- tests/workcore-ux.spec.ts
- tests/report-transitions.spec.ts
- docs/architecture/workcore-ux-stability-package.md

## Final local verification (2026-10-04)

- TypeScript: passed.
- Production build: passed; no deployment performed for this package.
- The earlier full Playwright run had 135 passed and one date-dependent billing-fixture failure.
- All 26 workcore-ux cases passed across Chromium and WebKit.
- All WebKit cases passed, including five sequential reports and draft reload.
- The billing fixture's future entry is now calculated relative to the test day.
- git diff --check: passed.
- Production conflict count before/after inspection: 1,112 / 1,112; zero removed.
  Genuine-versus-redundant counts remain unconfirmed until fresh server review.
- Dashboard-only commit 6978b56193a25d485a078a374c70ad971bd91d17 was pushed and
  confirmed on origin/main before the consolidated 1.425.0 release.

## Consolidated release verification (2026-10-05)

- Version: 1.425.0, including Branding, Fahrtenbuch and conflict review.
- TypeScript and production build: passed.
- Full Playwright: 161 passed, including Chromium and WebKit.
- The seven affected Branding/UI tests also passed independently.
- git diff --check: passed.
- No database migration or production business-data modification was performed.

Full release clearance is withheld: resolve the independent test failure and
review the production queue with the new endpoint after an approved deployment.
