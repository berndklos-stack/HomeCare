# Report transition diagnostics

Local reproduction: five existing reports without photos, mobile 390x844,
WebKit, 29 typed characters per report, then close and open the next report.
The existing E2E environment disables remote synchronization. No production
records were edited. This measures the offline/delayed-sync accumulation path,
not authenticated production requests.

Before correction:

| Checkpoint | Report mutations | Queue characters | Intervals | Window/document listeners | API requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial | 0 | 2 | 3 | 170 | 1 |
| Report 1 | 30 | 16027 | 3 | 170 | 1 |
| Report 2 | 60 | 32053 | 3 | 170 | 1 |
| Report 5 | 150 | 80131 | 3 | 170 | 1 |

Every text input invokes updateReportRecord, prepares a full report mutation,
appends it to the durable queue, and serializes that growing queue again.
Closing the editor does not remove pending work, correctly, but consequently
the next report inherits the accumulated cost. No duplicate timer/listener or
request growth was observed in this reproduction. Timers fluctuate with the
development runtime; the fixed interval count does not increase.

Correction: consecutive never-attempted pending updates for the same report are
compacted, retaining their first server revision and mutation identity. Attempted,
in-flight, conflicting and lifecycle mutations are not rewritten. The optimistic
report revision follows the compacted queue so it does not advance per keystroke.
The single queue sender reads its live queue rather than a captured batch, to
avoid sending an obsolete payload after another report has been edited.

After correction the same five edits produce 5 mutations, 2741 serialized
characters, unchanged listeners/intervals and no extra API requests. Reload
recovers all five text drafts. The regression also checks an idle window and
guards against compacting attempted/conflicting/deleted records.

Limitations: the physical iPhone process crash was not reproduced. WebKit does
not provide a portable JS heap measurement here. Queue serialization is a
measured resource proxy, not a heap/crash proof. Authenticated production replay,
and device-level crash diagnostics remain necessary before
declaring the user's entire incident resolved. No new report-specific timers or
async subscriptions were added, and durable offline work is not cancelled merely
because the user closes an editor. Existing queued production mutations are not
retroactively compacted or discarded by this change.

## Confirmed user workflow: Mobil vor Ort

The user clarified that editing takes place through Mobil vor Ort. A second
instrumented scenario opens each of five completed reports there, edits a
checklist note and the Einsatznotiz, saves, returns from the object view and
opens the next report. All photos/attachments are empty.

Before extending the correction to field_progress and job_note, pending relevant
mutations grew 0 -> 57 -> 114 -> 171 -> 228 -> 285; serialized queue length grew
to 116451 characters. The interval count stayed at 3 and window/document listener
count at 170. The API request count stayed at 2 through all five transitions.

After correction: 0 -> 5 -> 10 -> 15 -> 20 -> 25 relevant mutations and 18331
serialized characters (including unrelated job/object updates in the same queue).
Each report intentionally retains progress/note create-delete pairs and a report
update; save/delete lifecycle operations are not silently removed. The legitimate
15-second vehicle-position poll may execute once in the 10-second idle check.
There is no per-report poll or observed additional subscription accumulation.

Only never-attempted pending field creates/updates are compacted. Their original
server revision and operation remain intact. Optimistic progress/note revisions
are projected from the actual durable queue, preventing per-keystroke drift.
Attempted requests keep their original payload for idempotent retry. The test
also reloads a still-unsaved Einsatznotiz to verify draft recovery.
Reopening a completed report now preserves an existing local progress/note
draft instead of initializing it again from the older saved report.

This identifies and fixes a concrete accumulation defect in the user's path;
it does not prove an iPhone out-of-memory termination. Device crash logs and an
authenticated production replay remain outstanding. Database and production
business data were not changed.
