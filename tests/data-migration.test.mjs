import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

const NODE = {
  request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  transaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
};

class MemoryStorage {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class QuotaStorage extends MemoryStorage {
  setItem(key, value) {
    if (String(key).startsWith('ck_idb_safety_')) {
      throw Object.assign(new Error('exceeded the quota'), {name: 'QuotaExceededError', code: 22});
    }
    super.setItem(key, value);
  }
}

async function seedDatabase(indexedDB, name, stores, version = 2) {
  const request = indexedDB.open(name, version);
  request.onupgradeneeded = () => {
    for (const [storeName, config] of Object.entries(stores)) {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, {keyPath: config.keyPath});
      }
    }
  };
  const database = await NODE.request(request);
  const transaction = database.transaction(Object.keys(stores), 'readwrite');
  for (const [storeName, config] of Object.entries(stores)) {
    const store = transaction.objectStore(storeName);
    for (const row of config.rows) store.put(row);
  }
  await NODE.transaction(transaction);
  database.close();
}

async function readLegacyStore(indexedDB, name, storeName) {
  const database = await NODE.request(indexedDB.open(name));
  const rows = await NODE.request(database.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  database.close();
  return rows;
}

function fixtureStorage(overrides = {}) {
  return new MemoryStorage({...{
    ck_schema_version: '3',
    ck_projects: JSON.stringify([
      {id: 'alpha', name: 'Alpha', clientName: 'Alpha Client', resolverSecret: 'never-copy-me', settings: {theme: 'dark', apiToken: 'also-secret'}},
      {id: 'beta', name: 'Beta', clientName: 'Beta Client'}
    ]),
    ck_proj_alpha: JSON.stringify([
      {id: 7, pub: 'Daily Alpha', platform: 'Facebook', date: '2026-08-01', prValue: '120000', logoLockedAssetId: 'logo-old', status: 'ready', url: 'https://alpha.example/story', createdAt: '2026-08-01T01:00:00.000Z'}
    ]),
    ck_proj_beta: JSON.stringify([
      {id: 7, pub: 'Beta News', platform: 'Website', date: '2026-08-02', prValue: 90000, status: 'draft', createdAt: '2026-08-02T01:00:00.000Z'}
    ]),
    ck_proj_default: JSON.stringify([
      {id: 8, pub: 'Daily Alpha', platform: 'Facebook', date: '2026-08-03', prValue: 130000}
    ]),
    ck_entries: JSON.stringify([
      {id: 9, pub: 'Beta News', platform: 'Website', date: '2026-08-04', prValue: 95000}
    ]),
    ck_custom: JSON.stringify([
      {key: 'Daily Alpha - FB', pub: 'Daily Alpha', platform: 'Facebook', value: 120000}
    ]),
    ck_imported: JSON.stringify([
      {key: 'Beta News', pub: 'Beta News', platform: 'Website', value: 90000}
    ]),
    ck_platform_registry: JSON.stringify([
      {id: 'facebook', name: 'Facebook', dbCode: 'FB', fileCode: 'FB', active: true},
      {id: 'website', name: 'Website', dbCode: '', fileCode: 'WEB', active: true}
    ]),
    ck_umap: JSON.stringify({
      'facebook:dailyalpha': {username: 'dailyalpha', platform: 'Facebook', pub: 'Daily Alpha'}
    }),
    ck_gs_url: 'https://script.example/not-a-secret',
    ck_phase2_global: JSON.stringify({title: 'NEWSCLIPPING', agencyLogoAssetId: 'logo-old'})
  }, ...overrides});
}

async function fixture(tag, options = {}) {
  const {context, cleanup} = await freshDatabase(tag);
  const safeLS = options.safeLS || fixtureStorage(options.storage);
  context.safeLS = safeLS;
  context.localStorage = safeLS;
  await seedDatabase(context.indexedDB, 'clipkit-captures', {
    captures: {keyPath: 'key', rows: [{
      key: 'alpha:7', projectId: 'alpha', entryId: 7,
      images: [{id: 'capture-image', blob: new Blob(['capture-bytes'], {type: 'image/png'})}],
      updatedAt: '2026-08-05T00:00:00.000Z'
    }]}
  });
  await seedDatabase(context.indexedDB, options.phase2Name || 'clipkit-phase2-assets', {
    assets: {keyPath: 'id', rows: [{
      id: 'logo-old', name: 'daily-alpha.png', kind: 'media', publication: 'Daily Alpha', platform: 'Facebook',
      blob: new Blob(['logo-bytes'], {type: 'image/png'}),
      dataUrl: 'data:image/png;base64,bG9nby1ieXRlcw==',
      createdAt: '2026-08-01T00:00:00.000Z'
    }]},
    mappings: {keyPath: 'key', rows: [{key: 'media:dailyalpha|facebook', publication: 'Daily Alpha', platform: 'Facebook', assetId: 'logo-old', confirmed: true}]},
    history: {keyPath: 'id', rows: [{id: 'history-old', publication: 'Daily Alpha', platform: 'Facebook', assetId: 'logo-old', scope: 'entry-lock', entryId: 7, projectId: 'alpha', changedAt: '2026-08-02T00:00:00.000Z'}]},
    directories: {keyPath: 'key', rows: [{key: 'directory:alpha', name: 'Alpha Exports', handle: {kind: 'directory', name: 'Alpha Exports'}, updatedAt: '2026-08-03T00:00:00.000Z'}]}
  });
  loadDataScript(context, 'data/clipkit-db.js');
  loadDataScript(context, 'data/records.js');
  loadDataScript(context, 'data/migration.js');
  return {context, safeLS, cleanup};
}

test('inventory deterministically fingerprints every legacy category without changing the sources', async () => {
  const {context, safeLS, cleanup} = await fixture('migration-inventory');
  const capturesBefore = await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures');
  const phase2Before = await readLegacyStore(context.indexedDB, 'clipkit-phase2-assets', 'assets');

  const first = await context.ClipKitMigration.inventory({safeLS, indexedDB: context.indexedDB});
  const second = await context.ClipKitMigration.inventory({safeLS, indexedDB: context.indexedDB});

  assert.deepEqual(JSON.parse(JSON.stringify(first.counts)), {
    projects: 3,
    entries: 4,
    media: 2,
    mappings: 2,
    usernameMappings: 1,
    logoMappings: 1,
    platforms: 2,
    captures: 1,
    assets: 1,
    directories: 1,
    logoHistory: 1,
    phase2Globals: 1,
    legacySchemaVersions: 3
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(JSON.parse(JSON.stringify(first.schemaVersions)), {localStorage: 3, 'clipkit-captures': 2, 'clipkit-phase2-assets': 2});
  assert.deepEqual(await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures'), capturesBefore);
  assert.deepEqual(await readLegacyStore(context.indexedDB, 'clipkit-phase2-assets', 'assets'), phase2Before);
  await cleanup();
});

test('migration remaps colliding entry IDs and binary references, verifies, and reruns with zero additions', async () => {
  const {context, safeLS, cleanup} = await fixture('migration-success');
  let sequence = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

  const report = await context.ClipKitMigration.migrate({legacy: {safeLS, indexedDB: context.indexedDB}, uuid, now: () => '2026-08-28T00:00:00.000Z'});
  const [projects, entries, assets, captures, logoMappings, auditEvents, directories, marker] = await Promise.all([
    context.ClipKitDB.run('projects', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('projects').getAll())),
    context.ClipKitDB.run('entries', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('entries').getAll())),
    context.ClipKitDB.run('assets', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('assets').getAll())),
    context.ClipKitDB.run('captures', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('captures').getAll())),
    context.ClipKitDB.run('logoMappings', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('logoMappings').getAll())),
    context.ClipKitDB.run('auditEvents', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('auditEvents').getAll())),
    context.ClipKitDB.run('directories', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('directories').getAll())),
    context.ClipKitDB.run('meta', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('meta').get('migration:v1:complete')))
  ]);

  assert.equal(report.state, 'verified');
  assert.equal(report.verification.ok, true);
  assert.equal(marker.reportId, report.reportId);
  assert.equal(JSON.parse(safeLS.getItem(`ck_idb_safety_${report.reportId}`)).reportId, report.reportId);
  assert.equal(projects.some((project) => JSON.stringify(project).includes('never-copy-me') || JSON.stringify(project).includes('also-secret')), false);
  assert.equal(entries.length, 4);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 4);
  assert.equal(entries.every((entry) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.id)), true);
  assert.deepEqual(entries.filter((entry) => entry.legacyId === 7).map((entry) => entry.projectId).sort(), ['alpha', 'beta']);
  const alphaEntry = entries.find((entry) => entry.projectId === 'alpha' && entry.legacyId === 7);
  assert.equal(alphaEntry.logoLockAssetId, assets[0].id);
  assert.equal(captures[0].entryId, alphaEntry.id);
  assert.equal(logoMappings[0].assetId, assets[0].id);
  assert.equal(auditEvents[0].entityId, alphaEntry.id);
  assert.equal(directories[0].handle.name, 'Alpha Exports');
  assert.equal(await assets[0].blob.text(), 'logo-bytes');
  assert.equal(await captures[0].images[0].blob.text(), 'capture-bytes');
  assert.equal(report.legacySnapshot.entries.length, 4);
  assert.equal(entries.some((entry) => Object.hasOwn(entry, 'legacySnapshot')), false);

  const firstIds = Object.fromEntries(entries.map((entry) => [`${entry.projectId}:${entry.legacyId}`, entry.id]));
  const rerun = await context.ClipKitMigration.migrate({legacy: {safeLS, indexedDB: context.indexedDB}, uuid});
  const rerunEntries = await context.ClipKitDB.run('entries', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('entries').getAll()));
  assert.equal(rerun.addedRows, 0);
  assert.deepEqual(Object.fromEntries(rerunEntries.map((entry) => [`${entry.projectId}:${entry.legacyId}`, entry.id])), firstIds);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures')).length, 1);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-phase2-assets', 'assets')).length, 1);
  await cleanup();
});

test('completion waits for verification and rollback removes only rows from the failed report', async () => {
  const {context, safeLS, cleanup} = await fixture('migration-rollback');
  let sequence = 100;
  const report = await context.ClipKitMigration.migrate({
    legacy: {safeLS, indexedDB: context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    autoVerify: false
  });
  const markerBefore = await context.ClipKitDB.run('meta', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('meta').get('migration:v1:complete')));
  assert.equal(markerBefore, undefined);
  const resumed = await context.ClipKitMigration.migrate({
    legacy: {safeLS, indexedDB: context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    autoVerify: false
  });
  assert.equal(resumed.reportId, report.reportId);
  assert.equal(resumed.addedRows, 0);

  const assets = await context.ClipKitDB.run('assets', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('assets').getAll()));
  const audits = await context.ClipKitDB.run('auditEvents', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('auditEvents').getAll()));
  await context.ClipKitDB.run('assets', 'readwrite', (tx) => {
    tx.objectStore('assets').put({...assets[0], blob: new Blob(['tampered'], {type: 'image/png'})});
  });
  await context.ClipKitDB.run('auditEvents', 'readwrite', (tx) => {
    tx.objectStore('auditEvents').put({...audits[0], entityId: 'missing-entry', after: {assetId: 'missing-asset'}});
  });
  const verification = await context.ClipKitMigration.verify(report);
  assert.equal(verification.ok, false);
  assert.equal(verification.errors.some((error) => error.code === 'CHECKSUM_MISMATCH'), true);
  assert.equal(verification.errors.some((error) => error.code === 'FOREIGN_KEY_MISSING' && error.store === 'auditEvents'), true);
  assert.equal(await context.ClipKitDB.run('meta', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('meta').get('migration:v1:complete'))), undefined);

  const transactionModes = [];
  const originalRun = context.ClipKitDB.run;
  context.ClipKitDB.run = (stores, mode, work) => {
    transactionModes.push({stores, mode});
    return originalRun(stores, mode, work);
  };
  await context.ClipKitMigration.rollback(report.reportId);
  context.ClipKitDB.run = originalRun;
  const entryTransactions = transactionModes.filter((call) => call.stores === 'entries').map((call) => call.mode);
  assert.deepEqual(JSON.parse(JSON.stringify(entryTransactions)), ['readonly', 'readwrite']);
  assert.equal((await context.ClipKitDB.run('entries', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('entries').getAll()))).length, 0);
  assert.equal((await context.ClipKitDB.run('assets', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('assets').getAll()))).length, 0);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures')).length, 1);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-phase2-assets', 'assets')).length, 1);
  await cleanup();
});

test('inventory merges both Phase 2 database names and blocks conflicting duplicate source rows', async () => {
  const identical = await fixture('migration-phase2-dedupe');
  const producerAssets = await readLegacyStore(identical.context.indexedDB, 'clipkit-phase2-assets', 'assets');
  await seedDatabase(identical.context.indexedDB, 'clipkit-phase2', {
    assets: {keyPath: 'id', rows: producerAssets},
    mappings: {keyPath: 'key', rows: []},
    history: {keyPath: 'id', rows: []},
    directories: {keyPath: 'key', rows: []}
  });
  const deduped = await identical.context.ClipKitMigration.inventory({safeLS: identical.safeLS, indexedDB: identical.context.indexedDB});
  assert.equal(deduped.counts.assets, 1);
  await identical.cleanup();

  const conflicting = await fixture('migration-phase2-conflict');
  await seedDatabase(conflicting.context.indexedDB, 'clipkit-phase2', {
    assets: {keyPath: 'id', rows: [{...producerAssets[0], blob: new Blob(['different-logo'])}]},
    mappings: {keyPath: 'key', rows: []},
    history: {keyPath: 'id', rows: []},
    directories: {keyPath: 'key', rows: []}
  });
  await assert.rejects(
    conflicting.context.ClipKitMigration.inventory({safeLS: conflicting.safeLS, indexedDB: conflicting.context.indexedDB}),
    (error) => error.code === 'LEGACY_SOURCE_CONFLICT' && error.store === 'assets'
  );
  await conflicting.cleanup();
});

test('legacy discovery probes without creating databases when database enumeration is unavailable', async () => {
  const present = await fixture('migration-probe-present');
  Object.defineProperty(present.context.indexedDB, 'databases', {value: undefined, configurable: true});
  const inventory = await present.context.ClipKitMigration.inventory({safeLS: present.safeLS, indexedDB: present.context.indexedDB});
  assert.equal(inventory.counts.assets, 1);
  delete present.context.indexedDB.databases;
  await present.cleanup();

  const missing = await freshDatabase('migration-probe-missing');
  const storage = fixtureStorage({ck_projects: '[]', ck_proj_alpha: '[]', ck_proj_beta: '[]', ck_proj_default: '[]', ck_entries: '[]'});
  Object.defineProperty(missing.context.indexedDB, 'databases', {value: undefined, configurable: true});
  loadDataScript(missing.context, 'data/clipkit-db.js');
  loadDataScript(missing.context, 'data/records.js');
  loadDataScript(missing.context, 'data/migration.js');
  const empty = await missing.context.ClipKitMigration.inventory({
    safeLS: storage,
    indexedDB: missing.context.indexedDB,
    databaseNames: ['clipkit-captures', 'clipkit-phase2', 'clipkit-phase2-assets']
  });
  assert.equal(empty.counts.assets, 0);
  delete missing.context.indexedDB.databases;
  const names = (await missing.context.indexedDB.databases()).map((database) => database.name);
  assert.equal(names.includes('clipkit-captures'), false);
  assert.equal(names.includes('clipkit-phase2'), false);
  assert.equal(names.includes('clipkit-phase2-assets'), false);
  await missing.cleanup();
});

test('completed reruns and active resumes reject source drift before mixing records', async () => {
  const completed = await fixture('migration-completed-drift');
  let completeSequence = 200;
  await completed.context.ClipKitMigration.migrate({
    legacy: {safeLS: completed.safeLS, indexedDB: completed.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++completeSequence).padStart(12, '0')}`
  });
  const changedAlpha = JSON.parse(completed.safeLS.getItem('ck_proj_alpha'));
  changedAlpha[0].headline = 'source changed after completion';
  completed.safeLS.setItem('ck_proj_alpha', JSON.stringify(changedAlpha));
  await assert.rejects(
    completed.context.ClipKitMigration.migrate({legacy: {safeLS: completed.safeLS, indexedDB: completed.context.indexedDB}}),
    (error) => error.code === 'MIGRATION_SOURCE_CHANGED'
  );
  assert.equal(await completed.context.ClipKitDB.run('meta', 'readonly', (tx) => completed.context.ClipKitDB.request(tx.objectStore('meta').get('migration:v1:complete'))), undefined);
  assert.equal((await completed.context.ClipKitDB.run('entries', 'readonly', (tx) => completed.context.ClipKitDB.request(tx.objectStore('entries').getAll()))).some((entry) => entry.headline === 'source changed after completion'), false);
  await completed.cleanup();

  const active = await fixture('migration-active-drift');
  let activeSequence = 300;
  await active.context.ClipKitMigration.migrate({
    legacy: {safeLS: active.safeLS, indexedDB: active.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++activeSequence).padStart(12, '0')}`,
    autoVerify: false
  });
  active.safeLS.setItem('ck_umap', JSON.stringify({'facebook:changed': {username: 'changed', platform: 'Facebook', pub: 'Daily Alpha'}}));
  await assert.rejects(
    active.context.ClipKitMigration.migrate({legacy: {safeLS: active.safeLS, indexedDB: active.context.indexedDB}}),
    (error) => error.code === 'MIGRATION_SOURCE_CHANGED'
  );
  assert.equal((await active.context.ClipKitDB.run('usernameMappings', 'readonly', (tx) => active.context.ClipKitDB.request(tx.objectStore('usernameMappings').getAll()))).some((row) => row.username === 'changed'), false);
  await active.cleanup();

  const partial = await fixture('migration-partial-drift', {storage: {ck_custom: '{broken'}});
  let partialSequence = 350;
  await assert.rejects(
    partial.context.ClipKitMigration.migrate({
      legacy: {safeLS: partial.safeLS, indexedDB: partial.context.indexedDB},
      uuid: () => `00000000-0000-4000-8000-${String(++partialSequence).padStart(12, '0')}`
    }),
    (error) => error.code === 'MIGRATION_SOURCE_PARSE_ERROR'
  );
  partial.safeLS.setItem('ck_custom', '[]');
  await assert.rejects(
    partial.context.ClipKitMigration.migrate({legacy: {safeLS: partial.safeLS, indexedDB: partial.context.indexedDB}}),
    (error) => error.code === 'MIGRATION_SOURCE_CHANGED'
  );
  assert.equal((await partial.context.ClipKitDB.run('entries', 'readonly', (tx) => partial.context.ClipKitDB.request(tx.objectStore('entries').getAll()))).length, 0);
  await partial.cleanup();
});

test('unresolved source references remain in the report and prevent completion', async () => {
  const brokenProjects = JSON.parse(fixtureStorage().getItem('ck_projects'));
  brokenProjects[0].clientLogoAssetId = 'missing-project-logo';
  const broken = await fixture('migration-unresolved', {storage: {
    ck_projects: JSON.stringify(brokenProjects),
    ck_umap: JSON.stringify({'facebook:unknown': {username: 'unknown', platform: 'Facebook', pub: 'Missing Publication'}})
  }});
  const captureDatabase = await NODE.request(broken.context.indexedDB.open('clipkit-captures'));
  const captureWrite = captureDatabase.transaction('captures', 'readwrite');
  captureWrite.objectStore('captures').put({key: 'alpha:404', projectId: 'alpha', entryId: 404, images: []});
  await NODE.transaction(captureWrite);
  captureDatabase.close();
  const producer = await NODE.request(broken.context.indexedDB.open('clipkit-phase2-assets'));
  const mappingWrite = producer.transaction(['mappings', 'history'], 'readwrite');
  mappingWrite.objectStore('mappings').put({key: 'missing-logo', publication: 'Daily Alpha', platform: 'Facebook', assetId: 'missing-logo'});
  mappingWrite.objectStore('history').put({id: 'missing-history', projectId: 'alpha', entryId: 404, assetId: 'missing-logo'});
  await NODE.transaction(mappingWrite);
  producer.close();

  let sequence = 400;
  const report = await broken.context.ClipKitMigration.migrate({
    legacy: {safeLS: broken.safeLS, indexedDB: broken.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
  });
  assert.equal(report.state, 'verification-failed');
  assert.equal(report.sourceReferences.some((reference) => reference.legacyValue === 'missing-project-logo' && reference.resolvedId == null), true);
  assert.equal(report.sourceReferences.some((reference) => reference.legacyValue === 'missing-logo' && reference.resolvedId == null), true);
  assert.equal(report.sourceReferences.some((reference) => String(reference.legacyValue) === '404' && reference.resolvedId == null), true);
  assert.equal(report.verification.errors.some((error) => error.code === 'SOURCE_REFERENCE_UNRESOLVED'), true);
  assert.equal(await broken.context.ClipKitDB.run('meta', 'readonly', (tx) => broken.context.ClipKitDB.request(tx.objectStore('meta').get('migration:v1:complete'))), undefined);
  await broken.cleanup();
});

test('destination collisions abort before writes and rollback preserves unrelated rows', async () => {
  const collision = await fixture('migration-destination-collision');
  await collision.context.ClipKitDB.run('projects', 'readwrite', (tx) => {
    tx.objectStore('projects').add({id: 'alpha', name: 'User-owned Alpha', recordVersion: 9});
  });
  let sequence = 500;
  await assert.rejects(
    collision.context.ClipKitMigration.migrate({
      legacy: {safeLS: collision.safeLS, indexedDB: collision.context.indexedDB},
      uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    }),
    (error) => error.code === 'MIGRATION_DESTINATION_COLLISION' && error.store === 'projects'
  );
  const metadataBeforeRollback = await collision.context.ClipKitDB.run('meta', 'readonly', (tx) => collision.context.ClipKitDB.request(tx.objectStore('meta').getAll()));
  const collisionReport = metadataBeforeRollback.find((row) => row.key.startsWith('migration:report:'));
  assert.equal(collisionReport.error.code, 'MIGRATION_DESTINATION_COLLISION');
  assert.equal(metadataBeforeRollback.some((row) => row.key.startsWith('legacy-id:')), false);
  assert.equal(metadataBeforeRollback.some((row) => row.key === 'migration:v1:active'), false);
  await collision.context.ClipKitMigration.rollback(collisionReport.reportId);
  const preserved = await collision.context.ClipKitDB.run('projects', 'readonly', (tx) => collision.context.ClipKitDB.request(tx.objectStore('projects').get('alpha')));
  assert.equal(preserved.name, 'User-owned Alpha');
  assert.equal((await collision.context.ClipKitDB.run('entries', 'readonly', (tx) => collision.context.ClipKitDB.request(tx.objectStore('entries').getAll()))).length, 0);
  await collision.cleanup();
});

test('safety snapshot preserves raw storage errors and checksums every binary representation', async () => {
  const corrupt = await fixture('migration-safety-binaries', {storage: {ck_custom: '{broken-json', ck_entries: '{also-broken'}});
  const inventory = await corrupt.context.ClipKitMigration.inventory({safeLS: corrupt.safeLS, indexedDB: corrupt.context.indexedDB});
  assert.equal(inventory.parseErrors.some((error) => error.key === 'ck_custom'), true);
  assert.equal(inventory.parseErrors.filter((error) => error.key === 'ck_entries').length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(inventory.binaryManifest.filter((item) => item.legacyId === 'logo-old').map((item) => item.field).sort())), ['blob', 'dataUrl']);
  assert.equal(inventory.binaryManifest.find((item) => item.legacyId === 'logo-old' && item.field === 'dataUrl').sha256, '6ca6e2b588e6eac72bbddfe9a172818a9dce1fe141b5645912838bdec2f9ca98');
  let sequence = 600;
  await assert.rejects(
    corrupt.context.ClipKitMigration.migrate({
      legacy: {safeLS: corrupt.safeLS, indexedDB: corrupt.context.indexedDB},
      uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    }),
    (error) => error.code === 'MIGRATION_SOURCE_PARSE_ERROR'
  );
  const safetyKey = [...corrupt.safeLS.values.keys()].find((key) => key.startsWith('ck_idb_safety_'));
  const snapshot = JSON.parse(corrupt.safeLS.getItem(safetyKey));
  assert.equal(snapshot.localStorage.find((item) => item.key === 'ck_custom').value, '{broken-json');
  assert.equal(snapshot.parseErrors.some((error) => error.key === 'ck_custom'), true);
  assert.equal(snapshot.binaryManifest.some((item) => item.field === 'blob' && item.sha256), true);
  assert.equal(JSON.stringify(snapshot).includes('logo-bytes'), false);
  await corrupt.cleanup();
});

test('migration falls back to IndexedDB safety snapshot when localStorage quota is exceeded', async () => {
  const safeLS = new QuotaStorage(fixtureStorage().values ? Object.fromEntries(fixtureStorage().values) : {});
  const {context, cleanup} = await fixture('migration-quota-safety', {safeLS});
  try {
    let sequence = 700;
    const report = await context.ClipKitMigration.migrate({
      legacy: {safeLS, indexedDB: context.indexedDB},
      uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
      now: () => '2026-08-28T00:00:00.000Z'
    });
    assert.equal(report.state, 'verified');
    assert.equal(report.safetySnapshotStorage, 'indexedDB');
    assert.equal(safeLS.getItem(`ck_idb_safety_${report.reportId}`), null);
    const stored = await context.ClipKitDB.run('meta', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('meta').get(`migration:safety:${report.reportId}`)));
    assert.equal(stored.snapshot.reportId, report.reportId);
    const cleanupPlan = await context.ClipKitMigration.listLegacyCleanup();
    assert.equal(cleanupPlan.keys.includes('ck_projects'), true);
  } finally {
    await cleanup();
  }
});

test('verification hashes every binary field and detects independent data-url corruption', async () => {
  const multiple = await fixture('migration-multiple-binaries');
  const producer = await NODE.request(multiple.context.indexedDB.open('clipkit-phase2-assets'));
  const sourceWrite = producer.transaction('assets', 'readwrite');
  const sourceAsset = await NODE.request(sourceWrite.objectStore('assets').get('logo-old'));
  sourceWrite.objectStore('assets').put({...sourceAsset, originalDataUrl: 'data:application/octet-stream,%89PNG'});
  await NODE.transaction(sourceWrite);
  producer.close();
  let sequence = 700;
  const report = await multiple.context.ClipKitMigration.migrate({
    legacy: {safeLS: multiple.safeLS, indexedDB: multiple.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    autoVerify: false
  });
  assert.equal(report.binaryManifest.some((item) => item.field === 'blob'), true);
  assert.equal(report.binaryManifest.some((item) => item.field === 'dataUrl'), true);
  assert.equal(report.binaryManifest.some((item) => item.field === 'originalDataUrl'), true);
  const assets = await multiple.context.ClipKitDB.run('assets', 'readonly', (tx) => multiple.context.ClipKitDB.request(tx.objectStore('assets').getAll()));
  await multiple.context.ClipKitDB.run('assets', 'readwrite', (tx) => {
    tx.objectStore('assets').put({...assets[0], dataUrl: 'data:image/png;base64,dGFtcGVyZWQ='});
  });
  const verification = await multiple.context.ClipKitMigration.verify(report);
  assert.equal(verification.errors.some((error) => error.code === 'CHECKSUM_MISMATCH' && error.field === 'dataUrl'), true);
  await multiple.cleanup();
});

test('global and Project logo asset references migrate to UUIDs and verify', async () => {
  const projectRefs = JSON.parse(fixtureStorage().getItem('ck_projects'));
  projectRefs[0].clientLogoAssetId = 'logo-old';
  projectRefs[0].agencyLogoAssetId = 'logo-old';
  const referenced = await fixture('migration-project-assets', {storage: {ck_projects: JSON.stringify(projectRefs)}});
  let sequence = 800;
  const report = await referenced.context.ClipKitMigration.migrate({
    legacy: {safeLS: referenced.safeLS, indexedDB: referenced.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
  });
  const asset = (await referenced.context.ClipKitDB.run('assets', 'readonly', (tx) => referenced.context.ClipKitDB.request(tx.objectStore('assets').getAll())))[0];
  const project = await referenced.context.ClipKitDB.run('projects', 'readonly', (tx) => referenced.context.ClipKitDB.request(tx.objectStore('projects').get('alpha')));
  const globalSettings = await referenced.context.ClipKitDB.run('meta', 'readonly', (tx) => referenced.context.ClipKitDB.request(tx.objectStore('meta').get('phase2:global')));
  assert.equal(project.clientLogoAssetId, asset.id);
  assert.equal(project.agencyLogoAssetId, asset.id);
  assert.equal(globalSettings.agencyLogoAssetId, asset.id);
  assert.equal(report.verification.ok, true);
  await referenced.cleanup();
});

test('reserved legacy mapping rows require exact ownership metadata before reuse', async () => {
  const seeded = await fixture('migration-reserved-mapping');
  const conflicting = {
    key: 'legacy-id:alpha:7',
    id: 'not-a-uuid',
    legacyKey: 'beta:7',
    mappingKind: 'media',
    schemaNamespace: 'someone-else:v9',
    mappingSchemaVersion: 99
  };
  await seeded.context.ClipKitDB.run('meta', 'readwrite', (tx) => {
    tx.objectStore('meta').add(conflicting);
  });
  let sequence = 900;
  await assert.rejects(
    seeded.context.ClipKitMigration.migrate({
      legacy: {safeLS: seeded.safeLS, indexedDB: seeded.context.indexedDB},
      uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    }),
    (error) => error.code === 'MIGRATION_DESTINATION_COLLISION' && error.store === 'meta'
  );
  const allMetadata = await seeded.context.ClipKitDB.run('meta', 'readonly', (tx) => seeded.context.ClipKitDB.request(tx.objectStore('meta').getAll()));
  const reservedRows = allMetadata.filter((row) => row.key.startsWith('legacy-'));
  assert.equal(reservedRows.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(reservedRows[0])), conflicting);
  assert.deepEqual(
    allMetadata.filter((row) => row.key !== conflicting.key).map((row) => row.key),
    [allMetadata.find((row) => row.key.startsWith('migration:report:')).key]
  );
  for (const storeName of ['projects', 'entries', 'media', 'assets', 'captures', 'logoMappings']) {
    const rows = await seeded.context.ClipKitDB.run(storeName, 'readonly', (tx) => seeded.context.ClipKitDB.request(tx.objectStore(storeName).getAll()));
    assert.equal(rows.length, 0, storeName);
  }
  await seeded.cleanup();
});

test('rollback rechecks ownership after discovery and preserves a concurrent replacement', async () => {
  const raced = await fixture('migration-rollback-race');
  let sequence = 1000;
  const report = await raced.context.ClipKitMigration.migrate({
    legacy: {safeLS: raced.safeLS, indexedDB: raced.context.indexedDB},
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    autoVerify: false
  });
  const original = (await raced.context.ClipKitDB.run('entries', 'readonly', (tx) => raced.context.ClipKitDB.request(tx.objectStore('entries').getAll())))[0];
  const replacement = {...original, headline: 'concurrent replacement', migrationReportId: 'another-report'};
  const originalRun = raced.context.ClipKitDB.run;
  let replaced = false;
  raced.context.ClipKitDB.run = async (stores, mode, work) => {
    if (stores === 'entries' && mode === 'readwrite' && !replaced) {
      replaced = true;
      await originalRun('entries', 'readwrite', (tx) => {
        tx.objectStore('entries').put(replacement);
      });
    }
    return originalRun(stores, mode, work);
  };
  try {
    await raced.context.ClipKitMigration.rollback(report.reportId);
  } finally {
    raced.context.ClipKitDB.run = originalRun;
  }
  const preserved = await raced.context.ClipKitDB.run('entries', 'readonly', (tx) => raced.context.ClipKitDB.request(tx.objectStore('entries').get(replacement.id)));
  assert.equal(preserved.headline, 'concurrent replacement');
  assert.equal(preserved.migrationReportId, 'another-report');
  await raced.cleanup();
});

test('dual database conflicts include MIME type and byte length in binary identity', async () => {
  const mimeConflict = await fixture('migration-mime-conflict');
  const producerAsset = (await readLegacyStore(mimeConflict.context.indexedDB, 'clipkit-phase2-assets', 'assets'))[0];
  await seedDatabase(mimeConflict.context.indexedDB, 'clipkit-phase2', {
    assets: {keyPath: 'id', rows: [{...producerAsset, blob: new Blob(['logo-bytes'], {type: 'image/jpeg'})}]},
    mappings: {keyPath: 'key', rows: []},
    history: {keyPath: 'id', rows: []},
    directories: {keyPath: 'key', rows: []}
  });
  await assert.rejects(
    mimeConflict.context.ClipKitMigration.inventory({safeLS: mimeConflict.safeLS, indexedDB: mimeConflict.context.indexedDB}),
    (error) => error.code === 'LEGACY_SOURCE_CONFLICT' && error.store === 'assets'
  );
  await mimeConflict.cleanup();

  const manifestFixture = await fixture('migration-binary-identity');
  const inventory = await manifestFixture.context.ClipKitMigration.inventory({safeLS: manifestFixture.safeLS, indexedDB: manifestFixture.context.indexedDB});
  const blobIdentity = inventory.binaryManifest.find((item) => item.legacyId === 'logo-old' && item.field === 'blob');
  const dataUrlIdentity = inventory.binaryManifest.find((item) => item.legacyId === 'logo-old' && item.field === 'dataUrl');
  assert.equal(blobIdentity.mimeType, 'image/png');
  assert.equal(blobIdentity.byteLength, 10);
  assert.equal(dataUrlIdentity.mimeType, 'image/png');
  assert.equal(dataUrlIdentity.byteLength, 10);
  await manifestFixture.cleanup();
});
