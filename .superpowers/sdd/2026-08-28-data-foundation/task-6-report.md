# Task 6 Report: Transactional Core Writes

## Summary

Task 6 finishes the repository-backed write boundary for core ClipKit records. Public application commands now return `{ok, record?, fieldErrors?, conflict?, error?}`, validate before opening transactions, write through async IndexedDB repositories/transactions, and refresh the legacy adapter only after a successful commit.

The implementation covers Project, Entry, Media, Platform, Mapping, and confirmed Media merge writes. Entry creation can atomically persist Entry, Media, logo/domain/username/platform mappings, Provenance, Inspection, and Audit rows. Rejected writes and stale revisions leave the visible legacy cache unchanged.

Pending submit actions now disable only the active action and reuse the same idempotency key across retries until the action succeeds. Project and Entry hard delete paths are intentionally blocked until the later lifecycle/trash task owns deletion behavior.

## Files

- `app.js`
  - Added public commands: `createProjectCommand`, `updateProjectCommand`, `saveEntryCommand`, `saveMediaCommand`, `savePlatformCommand`, `saveMappingCommand`, and `mergeMediaCommand`.
  - Added transaction/idempotency helpers and adapter-refresh sequencing.
  - Routed entry, media, mapping, platform, and project UI writes through commands where in scope.
  - Blocked Project and Entry hard delete behavior pending Task 9 lifecycle work.
- `data/legacy-adapter.js`
  - Added frozen record caches plus `getRecord`/`getRecords` accessors for command callers.
  - Filtered deleted/redirected records out of legacy projections.
- `tests/data-app-writes.test.mjs`
  - Added coverage for validation-before-transaction, no core localStorage persistence after migration, commit-then-refresh ordering, atomic Entry compound saves, unchanged visible cache after rejection, idempotent retries, and confirmed Media merge behavior.
- `tests/phase1-core.test.mjs`
  - Preserved the existing Phase 1/Phase 2 changes and adjusted UUID action expectations for the new non-destructive Entry lifecycle behavior.

## Fix Round 1

The review findings against `8071bae` were addressed in the app command boundary:

- Entry create retries now use stable generated IDs for command-owned Entry, Media, Mapping, and Provenance rows and compare idempotency receipts against the original user payload, so the same key and payload returns the committed Entry while changed payloads still conflict.
- Entry add/edit flows now carry `logoFile` and `type` from `logoManual`/`fType` and `er_logo`/`er_type`, preserve those fields on the stored Entry record, and project them through the legacy adapter for table/export consumers.
- Platform creates now derive the canonical slug before the transactional conflict check, preventing a create for an existing slug such as `Website` from overwriting that Platform.

Regression tests were added to `tests/data-app-writes.test.mjs` for all three cases.

## Fix Round 2

The full-suite compatibility expectation in `tests/data-compatibility.test.mjs` now includes the intentional legacy adapter defaults for Entry `logoFile` and `type`, matching the Task 6 UI/export projection added in Fix Round 1.

## Tests

- `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs`
- `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs tests/data-save-coordinator.test.mjs tests/phase1-core.test.mjs`
- `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs`

The focused Task 6 suite and full test suite passed before committing Fix Round 2.

## Commit

- `refactor(data): persist core records transactionally`
