import assert from 'node:assert/strict';
import test from 'node:test';

import {freshDatabase, loadDataScript} from './data-helpers.mjs';

const CREATED_AT = '2026-08-18T00:00:00.000Z';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

async function compatibilityContext(tag, legacySeed = {}) {
  const fixture = await freshDatabase(tag);
  fixture.context.localStorage = memoryStorage(legacySeed);
  for (const script of [
    'data/clipkit-db.js',
    'data/records.js',
    'data/repository.js',
    'data/save-coordinator.js',
    'data/migration.js',
    'data/legacy-adapter.js'
  ]) loadDataScript(fixture.context, script);
  return fixture;
}

async function seedLegacyView(context) {
  await context.ClipKitRepository.projects.put({
    id: 'default', name: 'Default', clientName: 'Default',
    settings: {filePattern: '{YYMMDD}_{Publication}{PlatformSuffix}.pdf'},
    resolverConfigRef: null, createdAt: CREATED_AT, updatedAt: CREATED_AT,
    deletedAt: null, recordVersion: 1
  });
  await context.ClipKitRepository.media.put({
    id: 'media-uuid', publication: 'Bangkok Today', name: 'Bangkok Today',
    platform: 'Website', prValue: 150000, source: 'custom', sourceKey: 'Bangkok Today',
    createdAt: CREATED_AT, updatedAt: CREATED_AT, recordVersion: 1
  });
  await context.ClipKitRepository.entries.put({
    id: 'entry-uuid', projectId: 'default', publicationId: 'media-uuid',
    publicationDisplayOverride: '', platformId: 'website', publishedDate: '2026-08-18',
    publishedAtRaw: '2026-08-18', publishedTimezone: '', urlOriginal: '',
    urlCanonical: '', urlDisplay: '', urlFingerprint: '', platformContentId: '',
    prValueSnapshot: 150000, prSource: 'legacy', duration: '', headline: '', remark: '',
    workflowStatus: 'draft', logoLockAssetId: null, exportOrder: null,
    createdAt: CREATED_AT, updatedAt: CREATED_AT, deletedAt: null, recordVersion: 1,
    migrationReportId: 'report-uuid'
  });
  await context.ClipKitDB.run(['platforms', 'usernameMappings'], 'readwrite', (transaction) => {
    transaction.objectStore('platforms').put({
      id: 'website', name: 'Website', dbCode: '', fileCode: '', builtin: true,
      active: true, aliases: ['Web'], createdAt: CREATED_AT, updatedAt: CREATED_AT,
      recordVersion: 1
    });
    transaction.objectStore('usernameMappings').put({
      id: 'mapping-uuid', username: 'bangkoktoday', platformId: 'website',
      mediaId: 'media-uuid', publication: 'Bangkok Today',
      createdAt: CREATED_AT, updatedAt: CREATED_AT, recordVersion: 1
    });
  });
}

test('adapter hydrates a migrated entry into the exact legacy projection', async () => {
  const {context, cleanup} = await compatibilityContext('legacy-adapter-projection');
  try {
    await seedLegacyView(context);
    let hydratedEntryRecords;
    const listByProject = context.ClipKitRepository.entries.listByProject.bind(context.ClipKitRepository.entries);
    context.ClipKitRepository.entries.listByProject = async (...args) => {
      hydratedEntryRecords = await listByProject(...args);
      return hydratedEntryRecords;
    };

    const snapshot = await context.ClipKitLegacyAdapter.hydrate('default');
    assert.equal(snapshot.activeProjectId, 'default');
    assert.equal(context.ClipKitLegacyAdapter.getProjects()[0].filePattern, '{YYMMDD}_{Publication}{PlatformSuffix}.pdf');
    assert.equal(context.ClipKitLegacyAdapter.getMediaRows()[0].pub, 'Bangkok Today');
    assert.equal(context.ClipKitLegacyAdapter.getPlatforms()[0].name, 'Website');
    assert.deepEqual(
      JSON.parse(JSON.stringify(context.ClipKitLegacyAdapter.getUsernameMap())),
      {'website:bangkoktoday': {username: 'bangkoktoday', platform: 'Website', pub: 'Bangkok Today'}}
    );
    assert.equal(Object.isFrozen(hydratedEntryRecords[0]), true);
    assert.deepEqual(JSON.parse(JSON.stringify(context.ClipKitLegacyAdapter.getEntries('default')[0])), {
      id: 'entry-uuid', date: '2026-08-18', pub: 'Bangkok Today', platform: 'Website',
      prValue: 150000, status: 'draft', duration: '', captureCount: 0,
      fileName: '260818_Bangkok Today.pdf', logoLockedAssetId: null,
      createdAt: CREATED_AT, updatedAt: CREATED_AT
    });
  } finally {
    await cleanup();
  }
});

test('adapter refreshes only after a repository write commits and preserves visible cache on rejection', async () => {
  const {context, cleanup} = await compatibilityContext('legacy-adapter-rejection');
  try {
    await seedLegacyView(context);
    await context.ClipKitLegacyAdapter.hydrate('default');
    const before = context.ClipKitLegacyAdapter.getEntries('default');
    await assert.rejects(
      context.ClipKitLegacyAdapter.refreshAfter(async () => { throw new Error('write rejected'); }),
      /write rejected/
    );
    assert.equal(context.ClipKitLegacyAdapter.getEntries('default')[0].status, 'draft');
    assert.notEqual(context.ClipKitLegacyAdapter.getEntries('default')[0], before[0]);

    const canonical = await context.ClipKitRepository.entries.get('entry-uuid');
    await context.ClipKitLegacyAdapter.refreshAfter(() => context.ClipKitRepository.entries.put({
      ...canonical, workflowStatus: 'completed', recordVersion: canonical.recordVersion + 1
    }));
    assert.equal(context.ClipKitLegacyAdapter.getEntries('default')[0].status, 'completed');
  } finally {
    await cleanup();
  }
});

test('verified localStorage migration hydrates its opaque entry ID through the adapter', async () => {
  const legacySeed = {
    ck_schema_version: '3',
    ck_projects: JSON.stringify([{id: 'alpha', name: 'Alpha', clientName: 'Alpha Client'}]),
    ck_proj_alpha: JSON.stringify([{id: 7, pub: 'Daily Alpha', platform: 'Website', date: '2026-08-18', prValue: 150000}]),
    ck_custom: JSON.stringify([{key: 'Daily Alpha', pub: 'Daily Alpha', platform: 'Website', value: 150000}]),
    ck_imported: '[]',
    ck_platform_registry: JSON.stringify([{id: 'website', name: 'Website', dbCode: '', fileCode: '', active: true}]),
    ck_umap: '{}'
  };
  const {context, cleanup} = await compatibilityContext('migration-adapter-boundary', legacySeed);
  try {
    const migration = await context.ClipKitMigration.migrate();
    assert.equal(migration.state, 'verified');
    const snapshot = await context.ClipKitLegacyAdapter.hydrate('alpha');
    assert.match(snapshot.entries[0].id, /^[0-9a-f-]{36}$/i);
    assert.equal(snapshot.entries[0].pub, 'Daily Alpha');
  } finally {
    await cleanup();
  }
});
