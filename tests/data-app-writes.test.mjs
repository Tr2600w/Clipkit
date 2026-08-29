import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {TextDecoder, TextEncoder} from 'node:util';
import vm from 'node:vm';
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  const writes = [];
  return {
    writes,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes.push(['set', key, String(value)]); values.set(key, String(value)); },
    removeItem(key) { writes.push(['remove', key]); values.delete(key); }
  };
}

function appContext(tag) {
  const noop = () => {};
  const elements = new Map();
  const element = (id = '') => new Proxy({
    id, addEventListener: noop,
    classList: {add: noop, remove: noop, toggle: noop, contains: () => false},
    style: {}, dataset: {}, options: [], value: '', checked: false,
    appendChild: noop, removeChild: noop, querySelector: () => null,
    querySelectorAll: () => [], closest: () => null
  }, {get: (target, key) => key in target ? target[key] : noop});
  const elementById = (id) => {
    const key = String(id);
    if (!elements.has(key)) elements.set(key, element(key));
    return elements.get(key);
  };
  const document = {
    body: {appendChild: noop}, addEventListener: noop,
    getElementById: elementById, querySelector: () => null,
    querySelectorAll: () => [], createElement: () => element()
  };
  const localStorage = memoryStorage({ck_active_proj: 'default'});
  const context = {
    console, URL, Blob, Date, JSON, Map, Set, Math, Number, String, Object, Array,
    RegExp, TextEncoder, TextDecoder, Uint8Array, atob, crypto: webcrypto,
    indexedDB: new IDBFactory(), IDBKeyRange, structuredClone,
    setTimeout, clearTimeout, requestAnimationFrame: noop, localStorage,
    sessionStorage: memoryStorage(), document, window: {}, confirm: () => true,
    FileReader: function FileReader() {}
  };
  context.window.window = context.window;
  context.window.indexedDB = context.indexedDB;
  context.globalThis = context;
  vm.createContext(context, {name: `clipkit-app-writes-${tag}`});
  for (const script of [
    'clipkit-db.js', 'records.js', 'repository.js', 'save-coordinator.js',
    'migration.js', 'legacy-adapter.js'
  ]) {
    vm.runInContext(
      fs.readFileSync(new URL(`../data/${script}`, import.meta.url), 'utf8'),
      context,
      {filename: script}
    );
  }
  vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), context, {filename: 'app.js'});
  return context;
}

const CREATED_AT = '2026-08-18T00:00:00.000Z';

async function seedCore(context) {
  await context.ClipKitRepository.projects.put({
    id: 'default', name: 'Default', clientName: 'Default',
    settings: {filePattern: '{YYMMDD}_{Publication}{PlatformSuffix}.pdf'},
    resolverConfigRef: null, createdAt: CREATED_AT, updatedAt: CREATED_AT,
    deletedAt: null, recordVersion: 1
  });
  await context.ClipKitRepository.media.put({
    id: 'media-1', publication: 'Bangkok Today', name: 'Bangkok Today',
    platform: 'Website', prValue: 150000, source: 'custom', sourceKey: 'Bangkok Today',
    aliases: [], redirectIds: [], createdAt: CREATED_AT, updatedAt: CREATED_AT,
    recordVersion: 1
  });
  await context.ClipKitDB.run('platforms', 'readwrite', (transaction) => {
    transaction.objectStore('platforms').put({
      id: 'website', name: 'Website', dbCode: '', fileCode: 'WEB', builtin: true,
      active: true, aliases: ['Web'], createdAt: CREATED_AT, updatedAt: CREATED_AT,
      recordVersion: 1
    });
  });
  await context.ClipKitLegacyAdapter.hydrate('default');
}

async function rows(context, storeName) {
  return context.ClipKitDB.run(storeName, 'readonly', (transaction) =>
    context.ClipKitDB.request(transaction.objectStore(storeName).getAll()));
}

function options(idempotencyKey, expectedRevision) {
  return {actor: 'user', idempotencyKey, expectedRevision};
}

function setValue(context, id, value) {
  context.document.getElementById(id).value = value;
}

function setChecked(context, id, value) {
  context.document.getElementById(id).checked = value;
}

test('commands validate required fields before a transaction or adapter refresh', async () => {
  const context = appContext('validation');
  let transactionCount = 0;
  let refreshCount = 0;
  const run = context.ClipKitDB.run;
  const refreshAfter = context.ClipKitLegacyAdapter.refreshAfter;
  context.ClipKitDB.run = (...args) => { transactionCount += 1; return run(...args); };
  context.ClipKitLegacyAdapter.refreshAfter = (...args) => { refreshCount += 1; return refreshAfter(...args); };

  const project = await context.createProjectCommand({name: ''}, options('invalid-project'));
  const entry = await context.saveEntryCommand({projectId: '', publicationId: '', platformId: '', publishedDate: ''}, options('invalid-entry'));
  const media = await context.saveMediaCommand({publication: '', platformId: ''}, options('invalid-media'));
  const platform = await context.savePlatformCommand({name: ''}, options('invalid-platform'));
  const mapping = await context.saveMappingCommand({mappingType: 'domain', mediaId: '', domain: ''}, options('invalid-mapping'));
  const invalidUpdate = await context.saveEntryCommand({id: 'entry-1', platformId: ''}, options('invalid-entry-update', 1));

  for (const result of [project, entry, media, platform, mapping, invalidUpdate]) {
    assert.equal(result.ok, false);
    assert.ok(result.fieldErrors && Object.keys(result.fieldErrors).length > 0);
  }
  assert.equal(invalidUpdate.fieldErrors.platformId, 'required');
  assert.equal(transactionCount, 0);
  assert.equal(refreshCount, 0);
});

test('Project, Media, Platform, and Mapping commands persist then refresh without core localStorage writes', async () => {
  const context = appContext('core-commands');
  await seedCore(context);
  context.localStorage.writes.length = 0;
  const events = [];
  const originalRefresh = context.ClipKitLegacyAdapter.refreshAfter;
  context.ClipKitLegacyAdapter.refreshAfter = async (write, projectId) => {
    events.push('write:start');
    const snapshot = await originalRefresh(async () => {
      const value = await write();
      events.push('write:committed');
      return value;
    }, projectId);
    events.push('adapter:refreshed');
    return snapshot;
  };

  const createdProject = await context.createProjectCommand(
    {name: 'Campaign', clientName: 'Campaign Client'},
    options('project-create')
  );
  assert.equal(createdProject.ok, true);
  const updatedProject = await context.updateProjectCommand(
    {id: createdProject.record.id, clientName: 'Updated Client'},
    options('project-update', 1)
  );
  assert.equal(updatedProject.record.recordVersion, 2);

  const media = await context.saveMediaCommand(
    {publication: 'Daily News', name: 'Daily News', platform: 'Website', prValue: 210000, source: 'custom'},
    options('media-create')
  );
  const platform = await context.savePlatformCommand(
    {name: 'Bluesky', dbCode: 'BS', fileCode: 'BSKY', active: true},
    options('platform-create')
  );
  const mapping = await context.saveMappingCommand(
    {mappingType: 'domain', mediaId: media.record.id, domain: 'daily.example'},
    options('mapping-create')
  );
  assert.equal(platform.ok, true);
  assert.equal(mapping.ok, true);
  assert.deepEqual(events.slice(0, 3), ['write:start', 'write:committed', 'adapter:refreshed']);
  assert.equal((await context.ClipKitRepository.projects.get(createdProject.record.id)).clientName, 'Updated Client');
  assert.equal((await rows(context, 'domainMappings'))[0].mediaId, media.record.id);

  const forbidden = new Set(['ck_projects', 'ck_custom', 'ck_imported', 'ck_platform_registry', 'ck_umap']);
  assert.deepEqual(context.localStorage.writes.filter(([, key]) => forbidden.has(key)), []);
});

test('Platform command rejects a create whose derived slug collides with an existing Platform', async () => {
  const context = appContext('platform-slug-collision');
  await seedCore(context);
  const before = (await rows(context, 'platforms')).find((platform) => platform.id === 'website');

  const result = await context.savePlatformCommand(
    {name: 'Website', dbCode: 'COLLIDE', fileCode: 'COLLIDE', active: true},
    options('platform-slug-collision')
  );

  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  const after = (await rows(context, 'platforms')).find((platform) => platform.id === 'website');
  assert.deepEqual(after, before);
  assert.equal((await rows(context, 'auditEvents')).length, 0);
});

test('Entry create command returns the committed record when retried with the same key and payload', async () => {
  const context = appContext('entry-create-idempotent');
  await seedCore(context);
  const payload = {
    projectId: 'default',
    publication: 'Retry News',
    platformId: 'website',
    publishedDate: '2026-08-30',
    urlOriginal: 'https://retry.example/story',
    urlDisplay: 'https://retry.example/story',
    prValueSnapshot: 150000,
    media: {
      publication: 'Retry News',
      name: 'Retry News',
      platform: 'Website',
      prValue: 150000,
      source: 'custom'
    },
    mappings: [{mappingType: 'domain', domain: 'retry.example'}],
    provenance: [{field: 'publicationId', value: 'Retry News', source: 'user', confirmedByUser: true}]
  };

  const first = await context.saveEntryCommand(structuredClone(payload), options('entry-create-retry'));
  const second = await context.saveEntryCommand(structuredClone(payload), options('entry-create-retry'));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.record.id, first.record.id);
  assert.equal((await rows(context, 'entries')).length, 1);
  assert.equal((await rows(context, 'media')).filter((record) => record.publication === 'Retry News').length, 1);
  assert.equal((await rows(context, 'domainMappings')).length, 1);
  assert.equal((await rows(context, 'auditEvents')).filter((event) => event.action === 'created').length, 1);

  const conflictPayload = structuredClone(payload);
  conflictPayload.headline = 'Different user payload';
  const conflict = await context.saveEntryCommand(conflictPayload, options('entry-create-retry'));
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);
});

test('Entry add and row edit preserve logo file and type through the adapter view', async () => {
  const context = appContext('entry-logo-type');
  await seedCore(context);
  setValue(context, 'mPub', 'Logo News');
  setValue(context, 'fPub', '');
  setValue(context, 'mPlat', 'Website');
  setValue(context, 'fDate', '2026-08-29');
  setValue(context, 'mLink', 'https://logo.example/story');
  setValue(context, 'mPR', '170000');
  setValue(context, 'logoManual', 'Logo News.jpg');
  setValue(context, 'fType', 'Online');
  setValue(context, 'fStatus', 'draft');
  setChecked(context, 'autoSaveDB', false);

  const created = await context.addEntry();

  assert.equal(created.ok, true);
  let stored = await context.ClipKitRepository.entries.get(created.record.id);
  assert.equal(stored.logoFile, 'Logo News.jpg');
  assert.equal(stored.type, 'Online');
  let view = context.ClipKitLegacyAdapter.getEntries('default').find((entry) => entry.id === created.record.id);
  assert.equal(view.logoFile, 'Logo News.jpg');
  assert.equal(view.type, 'Online');

  setValue(context, 'er_pub', 'Logo News');
  setValue(context, 'er_plat', 'Website');
  setValue(context, 'er_date', '2026-08-30');
  setValue(context, 'er_url', 'https://logo.example/updated');
  setValue(context, 'er_pr', '180000');
  setValue(context, 'er_logo', 'Logo News Updated.jpg');
  setValue(context, 'er_type', 'Feature');
  setValue(context, 'er_duration', '');
  setValue(context, 'er_status', 'ready');

  const edited = await context.saveEdit(created.record.id);

  assert.equal(edited.ok, true);
  stored = await context.ClipKitRepository.entries.get(created.record.id);
  assert.equal(stored.logoFile, 'Logo News Updated.jpg');
  assert.equal(stored.type, 'Feature');
  view = context.ClipKitLegacyAdapter.getEntries('default').find((entry) => entry.id === created.record.id);
  assert.equal(view.logoFile, 'Logo News Updated.jpg');
  assert.equal(view.type, 'Feature');
});

test('Entry command commits Media, Mapping, Provenance, Audit, and Entry atomically and preserves cache on rejection', async () => {
  const context = appContext('entry-atomic');
  await seedCore(context);
  const before = JSON.stringify(context.ClipKitLegacyAdapter.getEntries('default'));
  const result = await context.saveEntryCommand({
    projectId: 'default', publication: 'New Publication', platformId: 'website',
    publishedDate: '2026-08-29', urlOriginal: 'https://new.example/story',
    prValueSnapshot: 210000,
    media: {publication: 'New Publication', name: 'New Publication', platform: 'Website', prValue: 210000, source: 'custom'},
    mappings: [
      {mappingType: 'domain', domain: 'new.example'},
      {mappingType: 'logo', assetId: 'asset-logo-entry', platformId: 'website'}
    ],
    provenance: [{field: 'publicationId', value: 'New Publication', source: 'user', confirmedByUser: true}]
  }, options('entry-compound'));

  assert.equal(result.ok, true);
  assert.equal((await rows(context, 'entries')).length, 1);
  assert.equal((await rows(context, 'media')).length, 2);
  assert.equal((await rows(context, 'domainMappings')).length, 1);
  assert.equal((await rows(context, 'logoMappings')).length, 1);
  assert.equal((await rows(context, 'provenance')).length, 1);
  assert.equal((await rows(context, 'auditEvents')).length, 1);

  const visibleAfterCommit = JSON.stringify(context.ClipKitLegacyAdapter.getEntries('default'));
  assert.notEqual(visibleAfterCommit, before);
  const updated = await context.saveEntryCommand({
    id: result.record.id, workflowStatus: 'ready'
  }, options('entry-update-retry', 1));
  assert.equal(updated.ok, true);
  assert.equal(updated.record.recordVersion, 2);
  const retried = await context.saveEntryCommand({
    id: result.record.id, workflowStatus: 'ready'
  }, options('entry-update-retry', 1));
  assert.equal(retried.ok, true);
  assert.equal(retried.record.recordVersion, 2);
  assert.equal((await rows(context, 'auditEvents')).filter((event) =>
    event.entityId === result.record.id && event.action === 'updated').length, 1);
  const visibleAfterUpdate = JSON.stringify(context.ClipKitLegacyAdapter.getEntries('default'));
  const rejected = await context.saveEntryCommand({
    id: result.record.id, headline: 'stale edit'
  }, options('entry-stale', 99));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.conflict, true);
  assert.equal(JSON.stringify(context.ClipKitLegacyAdapter.getEntries('default')), visibleAfterUpdate);
});

test('confirmed Media merge moves references, preserves logo assets, records redirects, and rolls back stale revisions', async () => {
  const context = appContext('media-merge');
  await seedCore(context);
  await context.ClipKitRepository.media.put({
    id: 'media-2', publication: 'BangkokToday.com', name: 'BangkokToday.com',
    platform: 'Website', prValue: 150000, source: 'custom', sourceKey: 'BangkokToday.com',
    aliases: [], redirectIds: [], createdAt: CREATED_AT, updatedAt: CREATED_AT,
    recordVersion: 1
  });
  await context.ClipKitRepository.entries.put({
    id: 'entry-2', projectId: 'default', publicationId: 'media-2',
    publicationDisplayOverride: '', platformId: 'website', publishedDate: '2026-08-28',
    publishedAtRaw: '', publishedTimezone: '', urlOriginal: '', urlCanonical: '',
    urlDisplay: '', urlFingerprint: '', platformContentId: '', prValueSnapshot: 150000,
    prSource: 'custom', duration: '', headline: '', remark: '', workflowStatus: 'draft',
    logoLockAssetId: 'asset-locked', exportOrder: null, createdAt: CREATED_AT,
    updatedAt: CREATED_AT, deletedAt: null, recordVersion: 1
  });
  await context.ClipKitDB.run(
    ['domainMappings', 'usernameMappings', 'mediaPlatformMappings', 'logoMappings', 'assets'],
    'readwrite',
    (transaction) => {
      transaction.objectStore('domainMappings').put({id: 'domain-2', domain: 'bangkoktoday.com', mediaId: 'media-2', recordVersion: 1});
      transaction.objectStore('usernameMappings').put({id: 'user-2', username: 'bangkoktoday', platformId: 'website', mediaId: 'media-2', recordVersion: 1});
      transaction.objectStore('mediaPlatformMappings').put({id: 'mp-2', mediaId: 'media-2', platformId: 'website', recordVersion: 1});
      transaction.objectStore('logoMappings').put({id: 'logo-2', mediaId: 'media-2', platformId: 'website', assetId: 'asset-logo', recordVersion: 1});
      transaction.objectStore('assets').put({id: 'asset-logo', blob: new Blob(['logo']), recordVersion: 1});
    }
  );
  await context.ClipKitLegacyAdapter.hydrate('default');

  const stale = await context.mergeMediaCommand({
    primaryMediaId: 'media-1', duplicateMediaIds: ['media-2'],
    expectedRevisions: {'media-1': 1, 'media-2': 99}, confirmed: true,
    actor: 'user', idempotencyKey: 'merge-stale'
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  assert.equal((await context.ClipKitRepository.entries.get('entry-2')).publicationId, 'media-2');

  const merged = await context.mergeMediaCommand({
    primaryMediaId: 'media-1', duplicateMediaIds: ['media-2'],
    expectedRevisions: {'media-1': 1, 'media-2': 1}, confirmed: true,
    actor: 'user', idempotencyKey: 'merge-accepted'
  });
  assert.equal(merged.ok, true);
  assert.equal((await context.ClipKitRepository.entries.get('entry-2')).publicationId, 'media-1');
  assert.equal((await rows(context, 'domainMappings'))[0].mediaId, 'media-1');
  assert.equal((await rows(context, 'usernameMappings'))[0].mediaId, 'media-1');
  assert.equal((await rows(context, 'mediaPlatformMappings'))[0].mediaId, 'media-1');
  assert.equal((await rows(context, 'logoMappings'))[0].mediaId, 'media-1');
  assert.equal((await context.ClipKitRepository.assets.get('asset-logo')).id, 'asset-logo');
  assert.equal((await context.ClipKitRepository.media.get('media-2')).redirectToMediaId, 'media-1');
  const aliases = await rows(context, 'mediaAliases');
  assert.ok(aliases.some((alias) => alias.mediaId === 'media-1' && alias.alias === 'BangkokToday.com'));
  assert.ok(aliases.some((alias) => alias.mediaId === 'media-1' && alias.alias === 'bangkoktoday.com'));
  assert.ok(aliases.some((alias) => alias.mediaId === 'media-1' && alias.alias === 'bangkoktoday'));
  assert.ok(merged.record.redirectIds.includes('media-2'));
});
