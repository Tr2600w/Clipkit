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

async function seedDatabase(indexedDB, name, stores) {
  const request = indexedDB.open(name, 2);
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

function fixtureStorage() {
  return new MemoryStorage({
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
    ck_gs_url: 'https://script.example/not-a-secret'
  });
}

async function fixture(tag) {
  const {context, cleanup} = await freshDatabase(tag);
  const safeLS = fixtureStorage();
  context.safeLS = safeLS;
  context.localStorage = safeLS;
  await seedDatabase(context.indexedDB, 'clipkit-captures', {
    captures: {keyPath: 'key', rows: [{
      key: 'alpha:7', projectId: 'alpha', entryId: 7,
      images: [{id: 'capture-image', blob: new Blob(['capture-bytes'], {type: 'image/png'})}],
      updatedAt: '2026-08-05T00:00:00.000Z'
    }]}
  });
  await seedDatabase(context.indexedDB, 'clipkit-phase2', {
    assets: {keyPath: 'id', rows: [{
      id: 'logo-old', name: 'daily-alpha.png', kind: 'media', publication: 'Daily Alpha', platform: 'Facebook',
      blob: new Blob(['logo-bytes'], {type: 'image/png'}), createdAt: '2026-08-01T00:00:00.000Z'
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
  const phase2Before = await readLegacyStore(context.indexedDB, 'clipkit-phase2', 'assets');

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
    legacySchemaVersions: 3
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(JSON.parse(JSON.stringify(first.schemaVersions)), {localStorage: 3, 'clipkit-captures': 2, 'clipkit-phase2': 2});
  assert.deepEqual(await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures'), capturesBefore);
  assert.deepEqual(await readLegacyStore(context.indexedDB, 'clipkit-phase2', 'assets'), phase2Before);
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
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-phase2', 'assets')).length, 1);
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

  await context.ClipKitMigration.rollback(report.reportId);
  assert.equal((await context.ClipKitDB.run('entries', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('entries').getAll()))).length, 0);
  assert.equal((await context.ClipKitDB.run('assets', 'readonly', (tx) => context.ClipKitDB.request(tx.objectStore('assets').getAll()))).length, 0);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-captures', 'captures')).length, 1);
  assert.equal((await readLegacyStore(context.indexedDB, 'clipkit-phase2', 'assets')).length, 1);
  await cleanup();
});
