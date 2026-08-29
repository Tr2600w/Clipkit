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

## Tests

- `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs`
- `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs tests/data-save-coordinator.test.mjs tests/phase1-core.test.mjs`

Both commands passed before this report was written. They were rerun after the report update before committing.

## Commit

- `refactor(data): persist core records transactionally`
