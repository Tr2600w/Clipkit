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

test('fresh projections leave the adapter cache unchanged when a repository write rejects', async () => {
  const {context, cleanup} = await compatibilityContext('legacy-adapter-rejection');
  try {
    await seedLegacyView(context);
    await context.ClipKitLegacyAdapter.hydrate('default');
    const optimisticView = context.ClipKitLegacyAdapter.getEntries('default');
    optimisticView[0].status = 'completed';
    context.ClipKitRepository.entries.put = async () => { throw new Error('write rejected'); };

    await assert.rejects(context.ClipKitRepository.entries.put(optimisticView[0]), /write rejected/);
    assert.equal(context.ClipKitLegacyAdapter.getEntries('default')[0].status, 'draft');
    assert.notEqual(context.ClipKitLegacyAdapter.getEntries('default')[0], optimisticView[0]);
  } finally {
    await cleanup();
  }
});
