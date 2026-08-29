# ClipKit Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ClipKit's source-of-truth data from synchronous `localStorage` and two legacy IndexedDB databases into one transactional, offline-first IndexedDB foundation without changing current entry, capture, logo, export, or PDF behavior.

**Architecture:** Add a focused data layer under `data/` with a versioned IndexedDB driver, repositories, migration coordinator, audit/revision services, backup/restore, and integrity/storage services. The existing global UI is hydrated through a compatibility cache only after the database is ready; all mutations cross an async repository boundary and commit atomically. Legacy stores remain read-only for 30 days after verified migration and are never deleted silently.

**Tech Stack:** Browser IndexedDB, Web Crypto (`crypto.randomUUID`, SHA-256, PBKDF2, AES-GCM), BroadcastChannel, StorageManager API, vanilla JavaScript, Node.js test runner, `fake-indexeddb` as a development-only test dependency.

**Spec:** `scope.md`

## Global Constraints

- IndexedDB is the only source of truth after successful migration; `localStorage` stores UI preferences and the read-only migration safety snapshot only.
- The active application must remain offline-first and deployable as static files on GitHub Pages.
- New records and assets use `crypto.randomUUID()`; migrated IDs retain an explicit old-ID-to-new-ID map.
- Entry save, Media creation, Mapping creation, Provenance, and Audit writes either commit together or roll back together.
- Original capture and logo blobs are never modified; transforms remain metadata.
- PR Value is a per-entry snapshot. Filename remains derived data. Locked logos retain their asset reference.
- Entry and Project deletion is soft for 30 days. Referenced assets are never removed automatically.
- Google Sheets remains a controlled export/import boundary, not a second source of truth.
- Resolver secrets, Google Sheets secrets, directory handles, cookies, and login data are excluded from backups.
- Existing uncommitted work in `README.md`, `index.html`, `phase2.css`, `phase2.js`, and `tests/phase1-core.test.mjs` belongs to the current worktree and must not be discarded or overwritten.
- Use the bundled Node executable `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` when `node` is unavailable on `PATH`.

---

## File map

### New files

- `data/clipkit-db.js` — database name/version, store/index schema, low-level request/transaction helpers.
- `data/records.js` — UUID/time helpers and normalizers for projects, entries, media, assets, audit events, and export jobs.
- `data/repository.js` — typed repository operations and compound queries; no DOM access.
- `data/save-coordinator.js` — atomic entry/media/mapping/provenance/audit commits and idempotency keys.
- `data/migration.js` — legacy inventory, safety snapshot, deterministic ID remapping, migration verification, rollback metadata.
- `data/legacy-adapter.js` — hydrated in-memory compatibility cache used by the current global UI while it is incrementally converted to async writes.
- `data/concurrency.js` — BroadcastChannel notifications, optimistic revision checks, and expiring locks.
- `data/lifecycle.js` — Entry/Project trash, restore, permanent deletion, asset reference counting, and retention cleanup.
- `data/backup.js` — manifest, checksums, optional password encryption, staging import, and restore conflict classification.
- `data/integrity.js` — startup health check and deep audit.
- `data/storage-manager.js` — storage estimates, persistence request, thresholds, and safe cleanup candidates.
- `tests/data-helpers.mjs` — fake IndexedDB setup, deterministic clock/UUID helpers, and database cleanup.
- `tests/data-schema.test.mjs`
- `tests/data-repository.test.mjs`
- `tests/data-save-coordinator.test.mjs`
- `tests/data-migration.test.mjs`
- `tests/data-concurrency.test.mjs`
- `tests/data-lifecycle.test.mjs`
- `tests/data-backup.test.mjs`
- `tests/data-integrity.test.mjs`
- `tests/data-compatibility.test.mjs`

### Modified files

- `package.json` — add `fake-indexeddb` dev dependency and focused test scripts.
- `index.html` — load data-layer scripts before `app.js`; add migration/storage status surfaces in Settings.
- `app.js` — async bootstrap, repository-backed project/entry/media mutations, revision-aware Sheets payloads, and removal of destructive legacy deletion.
- `phase2.js` — route assets, mappings, captures, history, directories, export jobs, backup, and restore through the unified repository.
- `tests/phase1-core.test.mjs` — inject data-layer globals and retain existing naming/PDF regressions.
- `README.md` — document IndexedDB ownership, migration, backup format, recovery, and test commands.

---

### Task 1: Establish the database schema and test harness

**Files:**
- Create: `data/clipkit-db.js`
- Create: `tests/data-helpers.mjs`
- Create: `tests/data-schema.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `ClipKitDB.open(options?) -> Promise<IDBDatabase>`
- Produces: `ClipKitDB.run(storeNames, mode, work) -> Promise<any>`
- Produces: `ClipKitDB.request(req) -> Promise<any>`
- Produces: `ClipKitDB.deleteDatabase() -> Promise<void>`
- Store names: `meta`, `projects`, `entries`, `media`, `mediaAliases`, `domainMappings`, `usernameMappings`, `platforms`, `mediaPlatformMappings`, `logoMappings`, `assets`, `captures`, `inspections`, `resolverCache`, `provenance`, `auditEvents`, `exportJobs`, `drafts`, `stagingAssets`, `directories`, `locks`, `importReports`

- [ ] **Step 1: Add the IndexedDB test dependency and focused scripts**

Update `package.json` to include:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "test:data": "node --test tests/data-*.test.mjs",
    "check": "node --check app.js && node --check phase2.js && node --check data/*.js && node --test tests/*.test.mjs"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.2.2"
  }
}
```

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm install`

Expected: `pnpm-lock.yaml` is created or updated and `fake-indexeddb` is available only under `devDependencies`.

- [ ] **Step 2: Write the schema test first**

Create `tests/data-schema.test.mjs` with assertions for all stores and critical indexes:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

test('schema creates stores and compound indexes', async () => {
  const {context, cleanup} = await freshDatabase('schema');
  loadDataScript(context, 'data/clipkit-db.js');
  const db = await context.ClipKitDB.open();
  for (const name of ['meta','projects','entries','media','assets','captures','auditEvents','exportJobs','locks']) {
    assert.equal(db.objectStoreNames.contains(name), true, name);
  }
  const tx = db.transaction('entries', 'readonly');
  const indexes = tx.objectStore('entries').indexNames;
  assert.equal(indexes.contains('byProjectDate'), true);
  assert.equal(indexes.contains('byUrlFingerprint'), true);
  assert.equal(indexes.contains('byPlatformContentId'), true);
  await cleanup();
});
```

`tests/data-helpers.mjs` must create a VM context with `indexedDB`, `IDBKeyRange`, `crypto`, `structuredClone`, `Blob`, `TextEncoder`, `TextDecoder`, and load scripts with `vm.runInContext`.

- [ ] **Step 3: Run the schema test and verify it fails**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-schema.test.mjs`

Expected: FAIL because `data/clipkit-db.js` or `ClipKitDB` does not exist.

- [ ] **Step 4: Implement schema version 1**

Implement `data/clipkit-db.js` as an IIFE exporting `ClipKitDB` on `globalThis`. Use database name `clipkit-data`, default version `1`, key path `id` for entity stores and `key` for `meta`, `resolverCache`, and `directories`.

Create these entry indexes exactly:

```js
store.createIndex('byProjectDate', ['projectId', 'publishedDate']);
store.createIndex('byProjectStatus', ['projectId', 'workflowStatus']);
store.createIndex('byProjectPlatform', ['projectId', 'platformId']);
store.createIndex('byProjectPublication', ['projectId', 'publicationId']);
store.createIndex('byUrlFingerprint', 'urlFingerprint', {unique:false});
store.createIndex('byPlatformContentId', 'platformContentId', {unique:false});
store.createIndex('byUpdatedAt', 'updatedAt');
store.createIndex('byDeletedAt', 'deletedAt');
```

Create `exportJobs.byExportBatchId` on `exportBatchId`, plus `byEntryId` and `byCreatedAt`. Create `logoMappings.byMediaPlatform` on `['mediaId', 'platformId']` and `byAssetId` on `assetId`. A logo Asset is an `assets` record with `assetKind:'logo'`; a capture original uses `assetKind:'capture'`.

`run()` must resolve only on `transaction.oncomplete`, abort on callback error, and reject with the transaction error. Never resolve a write on the individual request's `onsuccess` alone.

- [ ] **Step 5: Run the schema tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-schema.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the schema foundation**

```bash
git add package.json pnpm-lock.yaml data/clipkit-db.js tests/data-helpers.mjs tests/data-schema.test.mjs
git commit -m "feat(data): add unified IndexedDB schema"
```

---

### Task 2: Define normalized records and repositories

**Files:**
- Create: `data/records.js`
- Create: `data/repository.js`
- Create: `tests/data-repository.test.mjs`

**Interfaces:**
- Consumes: `ClipKitDB.run`, `ClipKitDB.request`
- Produces: `ClipKitRecords.project(input, deps?)`
- Produces: `ClipKitRecords.entry(input, deps?)`
- Produces: `ClipKitRecords.audit(input, deps?)`
- Produces: `ClipKitRecords.evaluateReadiness(entry, references) -> { state, blockers, warnings }`
- Produces: `ClipKitRepository.projects`, `.entries`, `.media`, `.assets`, `.captures`, `.audit`, `.exports`, `.meta`
- Repository methods: `get(id)`, `put(record)`, `delete(id)`, `getAll()`, plus domain query methods named below

- [ ] **Step 1: Write failing normalization and query tests**

Test that:

```js
const entry = context.ClipKitRecords.entry({
  projectId:'p1', publicationId:'m1', platformId:'website', publishedDate:'2026-08-18', prValueSnapshot:'150000'
}, {uuid:()=> 'entry-1', now:()=> '2026-08-28T00:00:00.000Z'});
assert.equal(entry.id, 'entry-1');
assert.equal(entry.prValueSnapshot, 150000);
assert.equal(entry.recordVersion, 1);
assert.equal(entry.deletedAt, null);
assert.equal(entry.workflowStatus, 'draft');
```

Insert three entries and assert `entries.listByProject('p1', {includeDeleted:false})` excludes a soft-deleted row and sorts by `publishedDate` descending, then `createdAt` ascending.

- [ ] **Step 2: Run the repository test and verify failure**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-repository.test.mjs`

Expected: FAIL because record factories and repositories are missing.

- [ ] **Step 3: Implement record factories**

Implement factories with injected defaults:

```js
const deps = {
  uuid: () => crypto.randomUUID(),
  now: () => new Date().toISOString()
};
```

Reject entries without `projectId`, `publicationId`, `platformId`, or `publishedDate`. Preserve `urlOriginal` exactly. Convert absent optional strings to `''`, absent nullable IDs to `null`, and numeric snapshots to finite numbers or `null`.

Compute readiness separately from the user-controlled workflow status. Missing PR Value, logo, Capture, unresolved URL/date candidates, unconfirmed low DPI, or required Template/Project assets produces blockers/warnings without preventing a Draft save. An Entry changed after becoming Ready returns `needs-review` when a blocker is introduced.

- [ ] **Step 4: Implement repository methods and compound queries**

Implement:

```js
entries.listByProject(projectId, {includeDeleted=false, status='', platformId='', publicationId=''})
entries.findByUrlFingerprint(fingerprint)
entries.findByPlatformContentId(contentId)
assets.countReferences(assetId)
audit.listForEntity(entityType, entityId)
exports.listByEntry(entryId)
```

Use indexes where defined; filter only the remaining predicates in memory. Repository files must not read the DOM or `localStorage`.

Make Audit operations append-only: expose `append` and query methods but no public update/delete method. Queue queries sort published date newest-first then creation order; Batch order reads the immutable Entry-ID/order snapshot stored on the parent Export Job.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-repository.test.mjs
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
```

Expected: both PASS.

- [ ] **Step 6: Commit normalized repositories**

```bash
git add data/records.js data/repository.js tests/data-repository.test.mjs
git commit -m "feat(data): add normalized repositories"
```

---

### Task 3: Add atomic saves, revisions, and audit events

**Files:**
- Create: `data/save-coordinator.js`
- Create: `tests/data-save-coordinator.test.mjs`

**Interfaces:**
- Consumes: `ClipKitDB.run`, `ClipKitRecords.entry`, `ClipKitRecords.audit`
- Produces: `ClipKitSave.saveEntry(command) -> Promise<{entry, media?, mappings:[], auditEvent}>`
- Produces: `ClipKitSave.updateEntry(id, expectedRevision, patch, source) -> Promise<Entry>`
- Produces: error codes `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_FAILED`

- [ ] **Step 1: Write transaction rollback and idempotency tests**

Use a command shaped exactly as:

```js
const command = {
  requestId:'request-1',
  entry:{projectId:'p1', publicationId:'m1', platformId:'website', publishedDate:'2026-08-18'},
  media:null,
  aliases:[],
  mappings:[],
  provenance:[{id:'prov-1', field:'publicationId', value:'m1', source:'user', confirmedByUser:true}],
  inspection:null,
  source:'user'
};
```

Assert a deliberately invalid mapping aborts every store write. Assert repeating the same `requestId` returns the first result without adding a second Entry or Audit event. Assert `updateEntry(..., expectedRevision:1)` increments `recordVersion` to `2`, while repeating expected revision `1` rejects with `REVISION_CONFLICT`.

- [ ] **Step 2: Run the tests and verify failure**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-save-coordinator.test.mjs`

Expected: FAIL because `ClipKitSave` is missing.

- [ ] **Step 3: Implement one-transaction save**

Open one readwrite transaction across `meta`, `entries`, `media`, `mediaAliases`, `domainMappings`, `usernameMappings`, `mediaPlatformMappings`, `provenance`, `inspections`, and `auditEvents`.

Store idempotency receipts under meta key `request:<requestId>` with `{entryId, committedAt}`. Validate all command records before issuing the first `put`. Create one audit event containing `entityType:'entry'`, `entityId`, `action:'created'`, `before:null`, `after:entry`, and `revision:1`.

- [ ] **Step 4: Implement revision-aware update**

Within one transaction, read the current Entry, compare `recordVersion`, apply the patch, increment the version, write the Entry, and append an Audit event. Reject unknown patch keys and prevent changes to `id`, `createdAt`, and `urlOriginal` through the generic patch path.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-save-coordinator.test.mjs
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit atomic saves**

```bash
git add data/save-coordinator.js tests/data-save-coordinator.test.mjs
git commit -m "feat(data): add atomic entry saves and revisions"
```

---

### Task 4: Build deterministic legacy inventory and migration

**Files:**
- Create: `data/migration.js`
- Create: `tests/data-migration.test.mjs`

**Interfaces:**
- Consumes: legacy `safeLS`, database `clipkit-captures`, database `clipkit-phase2`
- Produces: `ClipKitMigration.inventory(legacy) -> Promise<Inventory>`
- Produces: `ClipKitMigration.migrate(options) -> Promise<MigrationReport>`
- Produces: `ClipKitMigration.verify(report) -> Promise<VerificationReport>`
- Produces: `ClipKitMigration.rollback(reportId) -> Promise<void>`

- [ ] **Step 1: Write migration fixtures and failing tests**

Seed:

- two projects in `ck_projects`
- numeric Entry IDs that collide across projects
- one `ck_proj_default` Entry and one legacy `ck_entries` Entry
- custom/imported media, Platform registry, Username mapping
- one capture record, one media logo asset, one mapping, one logo history row, and one mock directory-handle metadata record

Assert migration produces UUID-based Entry IDs, preserves `legacyId`, remaps captures and locked logo references, excludes secrets from migrated project records, writes `migration:v1:complete` only after verification, and returns the same IDs when rerun.

- [ ] **Step 2: Run the migration test and verify failure**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-migration.test.mjs`

Expected: FAIL because migration functions are missing.

- [ ] **Step 3: Implement inventory and safety snapshot**

Inventory must count and fingerprint projects, entries, media rows, mappings, platforms, captures, assets, directories, and legacy schema versions. Before writes, save a JSON safety snapshot in `localStorage` under `ck_idb_safety_<reportId>` and a `meta` migration report with state `inventory-complete`.

- [ ] **Step 4: Implement deterministic ID remapping and batch migration**

Generate UUIDs once and persist each old composite key (`projectId:legacyEntryId`) under `meta` key `legacy-id:<composite>`. Migrate in batches of 100 records. Convert legacy `pub`, `platform`, `date`, `prValue`, `logoLockedAssetId`, `status`, and timestamps to the new Entry shape while retaining `legacySnapshot` inside the migration report, not the live Entry.

- [ ] **Step 5: Implement verification and rollback markers**

Verification compares source/destination counts, every foreign-key reference, and blob SHA-256 checksums. Only then set `migration:v1:complete`. Rollback deletes rows whose `migrationReportId` matches the failed report and preserves all legacy stores untouched.

- [ ] **Step 6: Run migration and full tests**

Run:

```bash
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-migration.test.mjs
/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.mjs
```

Expected: PASS and rerunning migration adds zero rows.

- [ ] **Step 7: Commit migration**

```bash
git add data/migration.js tests/data-migration.test.mjs
git commit -m "feat(data): migrate legacy ClipKit storage safely"
```

---

### Task 5: Add the async bootstrap and compatibility adapter

**Files:**
- Create: `data/legacy-adapter.js`
- Create: `tests/data-compatibility.test.mjs`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `tests/phase1-core.test.mjs`

**Interfaces:**
- Consumes: `ClipKitMigration.migrate`, `ClipKitRepository`
- Produces: `ClipKitLegacyAdapter.hydrate(activeProjectId) -> Promise<LegacySnapshot>`
- Produces: `ClipKitLegacyAdapter.getProjects()`, `.getEntries(projectId)`, `.getMediaRows()`, `.getPlatforms()`, `.getUsernameMap()`
- Produces: `bootstrapClipKit() -> Promise<void>`

- [ ] **Step 1: Write compatibility tests before changing startup**

Assert a migrated Entry becomes the exact legacy view shape expected by current rendering:

```js
assert.deepEqual(adapter.getEntries('default')[0], {
  id:'entry-uuid', date:'2026-08-18', pub:'Bangkok Today', platform:'Website',
  prValue:150000, status:'draft', duration:'', captureCount:0,
  fileName:'260818_Bangkok Today.pdf', logoLockedAssetId:null,
  createdAt:'2026-08-18T00:00:00.000Z', updatedAt:'2026-08-18T00:00:00.000Z'
});
```

Also assert adapter cache mutation rolls back if the repository write rejects.

- [ ] **Step 2: Run the compatibility test and verify failure**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-compatibility.test.mjs`

Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement hydration and legacy projections**

Hydrate Projects, active-project Entries, Media, Platforms, and Username mappings after migration. Freeze repository records and return fresh legacy projections to callers so UI mutation cannot modify source records without a save command.

- [ ] **Step 4: Load the data layer before the application**

Add deferred scripts in this exact order before `app.js`:

```html
<script src="data/clipkit-db.js?v=1.0.0" defer></script>
<script src="data/records.js?v=1.0.0" defer></script>
<script src="data/repository.js?v=1.0.0" defer></script>
<script src="data/save-coordinator.js?v=1.0.0" defer></script>
<script src="data/migration.js?v=1.0.0" defer></script>
<script src="data/legacy-adapter.js?v=1.0.0" defer></script>
<script src="app.js?v=3.0.0" defer></script>
```

- [ ] **Step 5: Convert initialization to one awaited bootstrap**

Replace the current `DOMContentLoaded` body with `bootstrapClipKit()` that migrates, hydrates, assigns the active project and `entries`, then calls existing render functions. Render a blocking recovery panel if migration fails; do not silently fall back to an empty database.

- [ ] **Step 6: Update the VM test harness and run regressions**

Load the five data-layer scripts before `app.js` in `tests/phase1-core.test.mjs`. Inject fake IndexedDB. Keep all existing filename, status, capture, PDF, and vector-text assertions unchanged.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-compatibility.test.mjs tests/phase1-core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit bootstrap compatibility**

```bash
git add data/legacy-adapter.js tests/data-compatibility.test.mjs index.html app.js tests/phase1-core.test.mjs
git commit -m "refactor(data): bootstrap ClipKit from IndexedDB"
```

---

### Task 6: Route Project, Entry, Media, Platform, and Mapping writes through repositories

**Files:**
- Modify: `app.js`
- Modify: `data/legacy-adapter.js`
- Create: `tests/data-app-writes.test.mjs`
- Modify: `tests/phase1-core.test.mjs`

**Interfaces:**
- Consumes: `ClipKitRepository`, `ClipKitSaveCoordinator`, `ClipKitLegacyAdapter`
- Produces: `createProjectCommand`, `updateProjectCommand`, `saveEntryCommand`, `saveMediaCommand`, `savePlatformCommand`, `saveMappingCommand`
- Produces: `mergeMediaCommand({ primaryMediaId, duplicateMediaIds, expectedRevisions })`
- Produces: UI result shape `{ ok, record?, fieldErrors?, conflict?, error? }`

- [ ] **Step 1: Add failing command-boundary tests**

Test that each current create/edit/delete handler calls its command once, does not write source records to `localStorage`, refreshes the adapter only after commit, and leaves the visible cache unchanged after a rejected transaction. Test Media merge moves Entry/mapping/logo references atomically, converts displaced names/domains/usernames to aliases, preserves every logo Asset, records redirect IDs, and rolls back fully if any expected revision is stale.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs`

Expected: FAIL because the handlers still mutate arrays and `localStorage` directly.

- [ ] **Step 2: Implement explicit async commands**

Commands accept plain values plus `{ actor:'user', expectedRevision, idempotencyKey }`. Validate required fields before opening a transaction. Return field-level validation without mutating the adapter. Use the atomic save coordinator whenever a Media, logo Mapping, Provenance, or Audit event must be created with an Entry.

- [ ] **Step 3: Replace direct writes without redesigning the UI**

Convert Project switching/creation, Entry create/edit/status, Media DB add/edit, Platform registry add/edit, aliases, domains, usernames, and Media+Platform mappings. Retain `localStorage` only for active Project ID and display preferences. Remove calls that serialize Projects, Entries, Media rows, Platforms, or mappings back to `localStorage` after migration.

Never merge duplicate Media automatically. Expose merge only after the user chooses a primary record and confirms the reference-move summary.

- [ ] **Step 4: Protect actions while a write is pending**

Disable only the submitted action, keep inputs visible, and restore the previous state on failure. Generate one idempotency key per user submit and reuse it on retry.

- [ ] **Step 5: Run focused and legacy tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-app-writes.test.mjs tests/data-save-coordinator.test.mjs tests/phase1-core.test.mjs`

Expected: PASS, including existing filename and Platform-suffix tests.

- [ ] **Step 6: Commit repository-backed application writes**

```bash
git add app.js data/legacy-adapter.js tests/data-app-writes.test.mjs tests/phase1-core.test.mjs
git commit -m "refactor(data): persist core records transactionally"
```

---

### Task 7: Consolidate assets, captures, mappings, directories, and export history

**Files:**
- Modify: `phase2.js`
- Modify: `data/repository.js`
- Create: `tests/data-assets.test.mjs`
- Modify: `tests/phase1-core.test.mjs`

**Interfaces:**
- Produces: `AssetRepository.putOriginal`, `.getBlob`, `.listReferences`
- Produces: `CaptureRepository.saveTransform`, `.listByEntry`
- Produces: `DirectoryRepository.saveProjectConfig`, `.getProjectConfig`
- Produces: `ExportJobRepository.create`, `.finish`, `.fail`

- [ ] **Step 1: Add failing blob and reference tests**

Cover original Blob preservation, SHA-256 deduplication, separate Capture transform metadata, locked-logo references, Platform-specific logo fallback, a per-Project directory handle stored in IndexedDB, and immutable Export Job snapshots of Entry revision/logo/layout.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-assets.test.mjs`

Expected: FAIL because Phase 2 still owns separate stores.

- [ ] **Step 2: Implement unified asset and capture repositories**

Store immutable originals in `assets`; store Crop, Rotation, Scale, Alignment, page cuts, source dimensions, and source Asset ID in `captures`. Calculate SHA-256 before inserting. Reuse a matching Asset only when hash, byte length, and MIME type match; never overwrite the older Blob.

- [ ] **Step 3: Add staged asset writes**

Place newly selected logo/capture files in `stagingAssets` with `expiresAt`. Promote them into `assets` in the same transaction that creates their Mapping or Capture. Failed and abandoned staging rows remain discoverable for safe cleanup and never appear as usable logos.

- [ ] **Step 4: Replace Phase 2 database calls**

Route Phase 2 assets, logo mappings/history, captures, directory configuration, and export history through the unified repositories. Preserve the existing public helper names as thin async wrappers until all callers are converted. Do not change PDF geometry, image scaling, logo selection, or filename behavior. Backup serialization must omit the stored directory handle and keep only folder names/configuration.

Parent Batch Export Jobs store the selected Entry IDs and order at start. Child results store actual success/failure/skipped status; `export-summary.csv` must be generated from those committed child results. Add a regression proving the same immutable Export snapshot can regenerate byte-equivalent document content when all referenced Assets remain available.

After the first Capture is committed, request persistent storage once per installation through `ClipKitStorage.requestPersistence()` when that service is available. Denial or unsupported browsers must not fail the Capture save.

- [ ] **Step 5: Verify source images are never recompressed during save**

Assert Blob bytes before and after Crop/Rotation/Scale edits are identical and only transform metadata changes.

- [ ] **Step 6: Run regression tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-assets.test.mjs tests/data-repository.test.mjs tests/phase1-core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit unified binary storage**

```bash
git add phase2.js data/repository.js tests/data-assets.test.mjs tests/phase1-core.test.mjs
git commit -m "refactor(data): unify assets and capture storage"
```

---

### Task 8: Add multi-tab notifications, optimistic revisions, and expiring locks

**Files:**
- Create: `data/concurrency.js`
- Create: `tests/data-concurrency.test.mjs`
- Modify: `data/save-coordinator.js`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `ClipKitConcurrency.start({ tabId, onChange, onConflict })`
- Produces: `ClipKitConcurrency.publish(change)`
- Produces: `ClipKitConcurrency.acquireLock(resourceType, resourceId, ttlMs)`
- Produces: `ClipKitConcurrency.releaseLock(lockId)`
- Consumes: record `recordVersion` and command `expectedRevision`

- [ ] **Step 1: Write deterministic concurrency tests**

Use a fake BroadcastChannel and clock. Assert stale `expectedRevision` rejects with `{ conflict:true, currentRecord }`; a successful commit increments once; an expired lock can be reclaimed; a live foreign lock cannot; and remote change messages trigger refetch rather than copying payload data into the cache.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-concurrency.test.mjs`

Expected: FAIL because concurrency support does not exist.

- [ ] **Step 2: Enforce revision checks inside write transactions**

Read the current record and compare its `recordVersion` with `expectedRevision` before writing. Revision mismatches must abort the entire transaction, including audit/provenance/mapping changes.

- [ ] **Step 3: Implement BroadcastChannel invalidation**

Publish `{ type, entityType, entityId, revision, sourceTabId, committedAt }` only after commit. Ignore own-tab messages. On a foreign message, refetch the affected record and refresh the adapter.

- [ ] **Step 4: Add non-destructive conflict UI**

When a form is dirty and a newer revision arrives, show “ข้อมูลถูกแก้ไขจากอีกแท็บ” with actions to reload current data or copy the unsaved values. Never auto-overwrite either version.

- [ ] **Step 5: Run concurrency and save tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-concurrency.test.mjs tests/data-save-coordinator.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit concurrency controls**

```bash
git add data/concurrency.js data/save-coordinator.js tests/data-concurrency.test.mjs app.js index.html
git commit -m "feat(data): guard concurrent ClipKit edits"
```

---

### Task 9: Implement Trash, restore, retention, and reference-safe deletion

**Files:**
- Create: `data/lifecycle.js`
- Create: `tests/data-lifecycle.test.mjs`
- Modify: `data/repository.js`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `ClipKitLifecycle.moveEntryToTrash(entryId, expectedRevision)`
- Produces: `ClipKitLifecycle.moveProjectToTrash(projectId, expectedRevision)`
- Produces: `ClipKitLifecycle.restore(entityType, id)`
- Produces: `ClipKitLifecycle.listTrash({ projectId? })`
- Produces: `ClipKitLifecycle.emptyExpired({ now, dryRun })`
- Produces: `ClipKitLifecycle.getAssetReferences(assetId)`

- [ ] **Step 1: Write failing lifecycle tests**

Assert soft-deleted records disappear from normal queries but remain restorable for 30 days; Project trash includes its Entry membership without deleting referenced records; a referenced logo/capture Asset cannot be permanently deleted; locked-logo counts include historical Entries; and `dryRun` reports exact candidates without mutation.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-lifecycle.test.mjs`

Expected: FAIL because lifecycle services are missing.

- [ ] **Step 2: Implement soft delete and restore transactions**

Set `deletedAt`, `deletedBy`, and increment `recordVersion` in the same transaction as an Audit event. Restore clears deletion metadata and audits the action. Normal repository queries exclude deleted rows unless `includeDeleted:true` is explicit.

- [ ] **Step 3: Implement reference counts and permanent-delete gates**

Count references from Media mappings, Entry locked logos, Captures, Project logos, Export Jobs, and restore staging. Return the referencing record IDs to the UI. Refuse deletion while any reference exists.

When a Project moves to Trash, remove its live directory-handle record without touching files in that directory. Restoring the Project marks its destination state as “กรุณาเลือกโฟลเดอร์ใหม่”.

- [ ] **Step 4: Add a minimal Trash surface**

Add Settings → Trash with record type, name, deletion date, expiry date, restore, and permanent delete. Require confirmation for permanent deletion and show blocking references instead of offering a destructive action.

- [ ] **Step 5: Run lifecycle and repository tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-lifecycle.test.mjs tests/data-repository.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit lifecycle management**

```bash
git add data/lifecycle.js data/repository.js tests/data-lifecycle.test.mjs app.js index.html
git commit -m "feat(data): add recoverable trash lifecycle"
```

---

### Task 10: Add startup integrity checks and Storage Manager

**Files:**
- Create: `data/integrity.js`
- Create: `data/storage-manager.js`
- Create: `tests/data-integrity.test.mjs`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `phase2.css`

**Interfaces:**
- Produces: `ClipKitIntegrity.quickCheck() -> Promise<HealthReport>`
- Produces: `ClipKitIntegrity.deepAudit() -> Promise<IntegrityReport>`
- Produces: `ClipKitStorage.getStatus() -> Promise<StorageStatus>`
- Produces: `ClipKitStorage.requestPersistence() -> Promise<'granted'|'denied'|'unsupported'>`
- Produces: `ClipKitStorage.listCleanupCandidates() -> Promise<CleanupCandidate[]>`

- [ ] **Step 1: Write failing health and storage tests**

Cover missing references, orphan staging rows, stuck migration markers, duplicate current mappings, bad checksum metadata, quota levels, unavailable StorageManager APIs, and the rule that cleanup candidates exclude every referenced Asset.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-integrity.test.mjs`

Expected: FAIL because the services are missing.

- [ ] **Step 2: Implement quick startup checks**

Check schema version, migration state, staging expiry, recent references, and storage pressure without scanning every Blob. Return `healthy`, `warning`, or `blocked`; only `blocked` prevents mutation and Export.

- [ ] **Step 3: Implement opt-in deep audit**

Scan records in bounded batches; validate references, declared checksums, duplicate URL fingerprints/content IDs, mapping collisions, Export Asset integrity, and Audit revision chains; then return repair suggestions. The audit is read-only; each repair must be an explicit later user action.

- [ ] **Step 4: Implement Storage Manager thresholds**

Use `navigator.storage.estimate()` when available. Mark warning at 70% and critical at 85%, display used/quota values, and expose persistence permission. Automatic cleanup is limited to expired resolver cache, expired orphan staging, and expired draft recovery. User-approved cleanup candidates may additionally include old completed Export Job payloads and permanently deleted unreferenced Assets.

- [ ] **Step 5: Add Settings status and recovery actions**

Display database health, migration status, storage use, persistence state, “ตรวจสอบแบบละเอียด”, and safe cleanup candidates. Never run cleanup merely because a threshold is crossed.

- [ ] **Step 6: Run tests and a syntax check**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-integrity.test.mjs tests/data-lifecycle.test.mjs`

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check data/storage-manager.js`

Expected: PASS.

- [ ] **Step 7: Commit integrity and storage tooling**

```bash
git add data/integrity.js data/storage-manager.js tests/data-integrity.test.mjs app.js index.html phase2.css
git commit -m "feat(data): surface storage health and integrity"
```

---

### Task 11: Build verified ZIP backup and staged restore

**Files:**
- Create: `data/backup.js`
- Create: `tests/data-backup.test.mjs`
- Modify: `phase2.js`
- Modify: `index.html`
- Modify: `phase2.css`

**Interfaces:**
- Produces: `ClipKitBackup.create({ scope, password? }) -> Promise<Blob>`
- Produces: `ClipKitBackup.inspect(file, { password? }) -> Promise<BackupInspection>`
- Produces: `ClipKitBackup.restore(file, { mode, resolutions, password? }) -> Promise<RestoreReport>`
- Consumes: injected `{ encodeZip(files), decodeZip(blob) }` adapter backed by the existing stored-ZIP codec in `phase2.js`; tests inject an in-memory codec
- Backup paths: `manifest.json`, `database/projects.json`, `database/entries.json`, `database/media.json`, `database/mappings.json`, `database/metadata.json`, `database/audit-events.json`, `database/export-history.json`, `assets/logos/<assetId>.<ext>`, `assets/captures/<assetId>.<ext>`, `checksums.json`

- [ ] **Step 1: Write failing backup round-trip tests**

Create a fixture with Projects, Entries, Media, mappings, locked logos, Captures, original Blobs, Audit events, and Export Jobs. Assert create→inspect→restore preserves counts, IDs, revisions, references, Blob bytes, and transform metadata. Assert corrupted checksums, a wrong password, and an unsupported schema make zero destination writes.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-backup.test.mjs`

Expected: FAIL because the unified backup service is missing.

- [ ] **Step 2: Implement deterministic manifests and checksums**

Manifest includes format version, app schema, created time, scope, record counts, asset counts, source installation ID, and exclusions. Sort record arrays and checksum entries for repeatable inspection. Hash every record file and original Asset.

- [ ] **Step 3: Add optional password encryption**

When a password is provided, derive a key with PBKDF2 using a random salt and encrypt record/asset payloads with AES-GCM and per-file IVs. Keep only encryption parameters, not secrets, in the manifest. A wrong password fails before restore mutation.

- [ ] **Step 4: Implement two-phase restore**

Phase 1 inspects schema, hashes, counts, references, and conflicts in temporary staging. Classify conflicts as `same`, `new`, `newer`, `older`, or `diverged`. Phase 2 applies explicit resolutions (`keep-existing`, `use-backup`, `duplicate`) in one restore transaction and emits `importReports` plus Audit events with source `import`.

- [ ] **Step 5: Preserve safety boundaries**

Exclude directory handles, permissions, resolver credentials, Google credentials, cookies, and login data. Restore Project folder structure as names/config only and set status “กรุณาเลือกโฟลเดอร์ใหม่”. Before replace mode, generate and download a safety backup; cancel replacement if that backup fails.

- [ ] **Step 6: Replace the legacy one-file backup UI**

Show backup scope, estimated size, optional password, inspection summary, conflict choices, and final report. Do not change existing PDF/ZIP export behavior.

- [ ] **Step 7: Run backup and compatibility tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-backup.test.mjs tests/data-migration.test.mjs tests/data-compatibility.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit verified backup and restore**

```bash
git add data/backup.js tests/data-backup.test.mjs phase2.js index.html phase2.css
git commit -m "feat(data): add verified backup and staged restore"
```

---

### Task 12: Make Google Sheets a revision-aware export/import boundary

**Files:**
- Modify: `app.js`
- Modify: `data/repository.js`
- Create: `tests/data-sheets-boundary.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `buildSheetsExport(projectId, { mode }) -> { exportedAt, projectRevision, entries:[{ id, revision, lastExportedAt, ...columns }] }`
- Produces: `inspectSheetsImport(rows) -> SheetsImportInspection`
- Produces: `applySheetsImport(inspection, resolutions) -> Promise<ImportReport>`

- [ ] **Step 1: Write failing export/import boundary tests**

Assert exports contain stable Entry IDs, revisions, and last-exported timestamps; append mode includes only revisions never successfully sent; update mode shows a field diff; importing an unchanged row is a no-op; a newer local revision is never overwritten automatically; unknown rows are staged; duplicate IDs are rejected; and every accepted change produces Provenance plus an Audit event with source `import`.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-sheets-boundary.test.mjs`

Expected: FAIL because the current Sheet payload has no revision contract.

- [ ] **Step 2: Add stable identity and revision columns to export**

Keep current human-facing columns, then append hidden/technical `clipkit_entry_id`, `clipkit_entry_revision`, `clipkit_project_id`, and `clipkit_last_exported_at`. Record a successful revision in the Export Job only after the Sheet operation succeeds; never mark a failed attempt as sent.

- [ ] **Step 3: Implement inspect-before-apply import**

Normalize rows without writing. Report new, unchanged, changed, missing, invalid, and revision-conflict rows. Require the user to choose each conflict resolution before apply. Never interpret a missing Sheet row as deletion.

- [ ] **Step 4: Apply accepted rows atomically**

Use one idempotency key per import. Persist Entry updates, Provenance, Audit, and `importReports` together. A row failure aborts the batch and leaves an actionable inspection report.

- [ ] **Step 5: Add the review summary to the existing Sheet flow**

Show counts and conflict choices before import. Append sends only unsent revisions; Update shows selectable diffs; Overwrite stays under an Advanced action and requires a successful safety Backup first. Preserve the current export filename and visible column order. Do not store credentials or full unneeded API responses in the sync log.

- [ ] **Step 6: Run tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-sheets-boundary.test.mjs tests/data-save-coordinator.test.mjs tests/phase1-core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the controlled Sheet boundary**

```bash
git add app.js data/repository.js tests/data-sheets-boundary.test.mjs index.html
git commit -m "feat(data): make Sheets sync revision aware"
```

---

### Task 13: Complete migration cutover and recovery controls

**Files:**
- Modify: `data/migration.js`
- Modify: `data/legacy-adapter.js`
- Modify: `data/integrity.js`
- Create: `tests/data-cutover.test.mjs`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `ClipKitMigration.getStatus() -> MigrationStatus`
- Produces: `ClipKitMigration.rollbackToSafetySnapshot() -> Promise<RollbackReport>`
- Produces: `ClipKitMigration.acknowledgeCutover() -> Promise<void>`
- Produces: `ClipKitMigration.listLegacyCleanup() -> Promise<LegacyCleanupReport>`

- [ ] **Step 1: Write failing cutover and rollback tests**

Assert a verified migration enters `safety-window`; app writes go only to IndexedDB; rollback within 30 days restores the safety snapshot and legacy DB identifiers; cleanup is unavailable before expiry or without a verified backup; and cleanup never runs automatically.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-cutover.test.mjs`

Expected: FAIL because cutover states are incomplete.

- [ ] **Step 2: Implement the migration state machine**

Use exact states `not-started`, `inventory`, `copying`, `verifying`, `safety-window`, `complete`, `rollback-required`, and `failed`. Persist the last completed checkpoint, safety-snapshot hash, count report, reference report, started/verified times, and failure details in `meta`.

- [ ] **Step 3: Make safety data read-only**

After verification, never mirror new mutations into old `localStorage` keys or legacy databases. Keep the original snapshot and old databases readable for recovery until the user explicitly removes them after the retention period.

- [ ] **Step 4: Add recovery and cleanup UI**

Show status, migrated counts, verification report, rollback eligibility, expiry date, safety-backup action, and legacy cleanup. Cleanup requires a fresh successful backup and typed confirmation; list exact keys/database names before deletion.

- [ ] **Step 5: Verify interruption recovery**

Test reload at every state checkpoint. Re-running migration with the same installation ID must resume idempotently without duplicate Projects, Entries, Media, mappings, or Assets.

- [ ] **Step 6: Run migration/cutover/integrity tests**

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-migration.test.mjs tests/data-cutover.test.mjs tests/data-integrity.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit migration cutover**

```bash
git add data/migration.js data/legacy-adapter.js data/integrity.js tests/data-cutover.test.mjs app.js index.html
git commit -m "feat(data): complete safe IndexedDB cutover"
```

---

### Task 14: Document, verify, and release the Data Foundation

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `index.html`
- Modify: `phase2.js`
- Modify: `tests/phase1-core.test.mjs`
- Create: `tests/data-end-to-end.test.mjs`

**Interfaces:**
- Produces package scripts: `test:data`, `test:regression`, `check`
- Produces release checklist and recovery instructions in `README.md`

- [ ] **Step 1: Add an end-to-end offline fixture**

Seed representative legacy Projects, Website/Social/TV Entries, Media aliases, Platform suffixes, multiple logos, locked logos, long Captures, manual Scale/page cuts, and export history. Migrate, edit, reload, backup, restore to a clean database, and compare canonical records plus Blob hashes.

Run: `/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-end-to-end.test.mjs`

Expected: FAIL until all integration seams are wired.

- [ ] **Step 2: Add focused package scripts**

Set:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "test:data": "node --test tests/data-*.test.mjs",
    "test:regression": "node --test tests/phase1-core.test.mjs",
    "check": "node --check app.js && node --check phase2.js && node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 3: Document ownership and recovery**

Document which records live in IndexedDB, what remains in `localStorage`, migration states, the 30-day safety window, Backup contents/exclusions, restore conflict meanings, Storage Manager behavior, multi-tab conflicts, Google Sheets revision columns, and exact test commands.

- [ ] **Step 4: Load the complete data layer and update cache versions once**

Load deferred scripts in dependency order: `clipkit-db`, `records`, `repository`, `save-coordinator`, `migration`, `legacy-adapter`, `concurrency`, `lifecycle`, `integrity`, `storage-manager`, `backup`, then `app.js` and `phase2.js`. After all tests pass, bump all query versions in `index.html` in one release edit so GitHub Pages does not mix old and new data-layer files.

- [ ] **Step 5: Run the complete automated verification**

Run: `PATH=/Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/driveigency/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm check`

Expected: every schema, repository, transaction, migration, compatibility, concurrency, lifecycle, backup, integrity, Sheet-boundary, end-to-end, naming, PDF, and capture test passes with zero failures.

- [ ] **Step 6: Perform the browser acceptance pass**

Using a clean browser profile and a copy of representative legacy data, verify:

1. Migration counts and references match the inventory and reload does not duplicate data.
2. Existing Project, Entry, Media DB, logo, Capture editor, Preview, PDF, filename suffix, and folder-export flows behave as before.
3. Closing/reopening and offline reload preserve edits and original image bytes.
4. A second tab creates a visible conflict instead of overwriting.
5. Trash restore works; referenced Assets cannot be removed.
6. Backup inspection catches a deliberately corrupted copy; a valid backup restores into a clean profile.
7. Storage permission denial and unsupported folder APIs fall back without losing Export Job status.
8. Sheet import displays conflicts and does not delete absent rows.

- [ ] **Step 7: Run final diff and artifact checks**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; only intended Data Foundation files are staged for the release commit, while pre-existing unrelated work remains preserved.

- [ ] **Step 8: Commit the verified release**

```bash
git add README.md package.json index.html app.js phase2.js data tests
git commit -m "feat(data): complete offline-first data foundation"
```

---

## Completion gate

Sub-project A is complete only when all automated tests and the browser acceptance pass succeed, migration rollback remains available for the safety window, no existing filename/PDF/Capture behavior regresses, and IndexedDB is the only post-cutover source of truth. Start Sub-project B (URL Intelligence) only after this gate is recorded in the migration report and release notes.
