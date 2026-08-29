import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function repositoryContext(tag) {
  const database = await freshDatabase(tag);
  loadDataScript(database.context, 'data/clipkit-db.js');
  loadDataScript(database.context, 'data/records.js');
  loadDataScript(database.context, 'data/repository.js');
  return database;
}

test('entry normalizes defaults without changing the original URL', async () => {
  const {context, cleanup} = await freshDatabase('entry-normalization');
  loadDataScript(context, 'data/records.js');
  const entry = context.ClipKitRecords.entry({
    projectId: 'p1',
    publicationId: 'm1',
    platformId: 'website',
    publishedDate: '2026-08-18',
    prValueSnapshot: '150000',
    urlOriginal: ' https://example.test/?ref=source '
  }, {uuid: () => 'entry-1', now: () => '2026-08-28T00:00:00.000Z'});

  assert.equal(entry.id, 'entry-1');
  assert.equal(entry.prValueSnapshot, 150000);
  assert.equal(entry.recordVersion, 1);
  assert.equal(entry.deletedAt, null);
  assert.equal(entry.workflowStatus, 'draft');
  assert.equal(entry.urlOriginal, ' https://example.test/?ref=source ');
  assert.equal(entry.headline, '');
  assert.equal(entry.logoLockAssetId, null);
  await cleanup();
});

test('entry requires its project, publication, platform, and date', async () => {
  const {context, cleanup} = await freshDatabase('entry-validation');
  loadDataScript(context, 'data/records.js');
  assert.throws(() => context.ClipKitRecords.entry({
    projectId: 'p1', publicationId: 'm1', platformId: 'website'
  }), /publishedDate/);
  await cleanup();
});

test('readiness uses prior calculated readiness rather than workflow status', async () => {
  const {context, cleanup} = await freshDatabase('entry-readiness');
  loadDataScript(context, 'data/records.js');

  const draftReadiness = context.ClipKitRecords.evaluateReadiness({workflowStatus: 'draft'}, {});
  assert.equal(draftReadiness.state, 'blocked');
  assert.deepEqual([...draftReadiness.blockers].sort(), ['capture', 'logo', 'pr-value']);

  const workflowReadyOnly = context.ClipKitRecords.evaluateReadiness({workflowStatus: 'ready'}, {});
  assert.equal(workflowReadyOnly.state, 'blocked');

  const previouslyReady = context.ClipKitRecords.evaluateReadiness(
    {workflowStatus: 'draft'},
    {priorReadinessState: 'ready'}
  );
  assert.equal(previouslyReady.state, 'needs-review');
  await cleanup();
});

test('entry and project repositories do not expose hard deletion', async () => {
  const {context, cleanup} = await repositoryContext('protected-delete');
  try {
    assert.equal('delete' in context.ClipKitRepository.entries, false);
    assert.equal('delete' in context.ClipKitRepository.projects, false);
  } finally {
    await cleanup();
  }
});

test('entry repository lists a project newest first and excludes soft-deleted records', async () => {
  const {context, cleanup} = await repositoryContext('project-queue');
  try {
    await context.ClipKitRepository.entries.put({
      id: 'entry-older', projectId: 'p1', publicationId: 'm1', platformId: 'website',
      publishedDate: '2026-08-17', createdAt: '2026-08-20T00:00:00.000Z', deletedAt: null
    });
    await context.ClipKitRepository.entries.put({
      id: 'entry-second', projectId: 'p1', publicationId: 'm1', platformId: 'website',
      publishedDate: '2026-08-18', createdAt: '2026-08-22T00:00:00.000Z', deletedAt: null
    });
    await context.ClipKitRepository.entries.put({
      id: 'entry-first', projectId: 'p1', publicationId: 'm2', platformId: 'social',
      publishedDate: '2026-08-18', createdAt: '2026-08-21T00:00:00.000Z', deletedAt: null
    });
    await context.ClipKitRepository.entries.put({
      id: 'entry-deleted', projectId: 'p1', publicationId: 'm1', platformId: 'website',
      publishedDate: '2026-08-19', createdAt: '2026-08-19T00:00:00.000Z', deletedAt: '2026-08-20T00:00:00.000Z'
    });

    const entries = await context.ClipKitRepository.entries.listByProject('p1', {includeDeleted: false});
    assert.deepEqual(entries.map((entry) => entry.id), ['entry-first', 'entry-second', 'entry-older']);

    const platformEntries = await context.ClipKitRepository.entries.listByProject('p1', {platformId: 'website'});
    assert.deepEqual(platformEntries.map((entry) => entry.id), ['entry-second', 'entry-older']);
  } finally {
    await cleanup();
  }
});

test('repositories use indexed duplicate and export lookups and preserve append-only audit operations', async () => {
  const {context, cleanup} = await repositoryContext('queries');
  try {
    await context.ClipKitRepository.entries.put({id: 'entry-1', urlFingerprint: 'url-1', platformContentId: 'post-1'});
    await context.ClipKitRepository.entries.put({id: 'entry-2', urlFingerprint: 'url-1', platformContentId: 'post-2'});
    await context.ClipKitRepository.logoMappings.put({id: 'logo-map-1', assetId: 'asset-1'});
    await context.ClipKitRepository.captures.put({id: 'capture-1', assetId: 'asset-1'});
    await context.ClipKitRepository.audit.append({id: 'audit-1', entityType: 'entry', entityId: 'entry-1', createdAt: '2026-08-21T00:00:00.000Z'});
    await context.ClipKitRepository.audit.append({id: 'audit-2', entityType: 'entry', entityId: 'entry-1', createdAt: '2026-08-22T00:00:00.000Z'});
    await context.ClipKitRepository.exports.put({id: 'export-1', entryId: 'entry-1', createdAt: '2026-08-22T00:00:00.000Z'});
    await context.ClipKitRepository.exports.put({
      id: 'export-batch-1',
      entrySnapshot: [{entryId: 'entry-2', order: 2}, {entryId: 'entry-1', order: 1}]
    });

    assert.deepEqual((await context.ClipKitRepository.entries.findByUrlFingerprint('url-1')).map((entry) => entry.id), ['entry-1', 'entry-2']);
    assert.deepEqual((await context.ClipKitRepository.entries.findByPlatformContentId('post-2')).map((entry) => entry.id), ['entry-2']);
    assert.equal(await context.ClipKitRepository.assets.countReferences('asset-1'), 2);
    assert.deepEqual((await context.ClipKitRepository.audit.listForEntity('entry', 'entry-1')).map((event) => event.id), ['audit-1', 'audit-2']);
    assert.deepEqual((await context.ClipKitRepository.exports.listByEntry('entry-1')).map((job) => job.id), ['export-1']);
    assert.deepEqual(Array.from(await context.ClipKitRepository.exports.listBatchEntries('export-batch-1'), (entry) => entry.id), ['entry-1', 'entry-2']);
    assert.equal('put' in context.ClipKitRepository.audit, false);
    assert.equal('delete' in context.ClipKitRepository.audit, false);
  } finally {
    await cleanup();
  }
});
