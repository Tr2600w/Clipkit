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

async function textOf(blob) {
  return blob ? blob.text() : '';
}

test('asset originals preserve Blob bytes and deduplicate only exact binary identity', async () => {
  const {context, cleanup} = await repositoryContext('asset-dedup');
  try {
    const first = await context.AssetRepository.putOriginal({
      id: 'asset-original',
      assetKind: 'logo',
      kind: 'media',
      name: 'Daily Logo.png',
      blob: new Blob(['logo-bytes'], {type: 'image/png'}),
      publication: 'Daily News',
      platform: 'Website'
    }, {now: () => '2026-08-28T00:00:00.000Z'});
    const duplicate = await context.AssetRepository.putOriginal({
      id: 'asset-duplicate-attempt',
      assetKind: 'logo',
      kind: 'media',
      name: 'Renamed Logo.png',
      blob: new Blob(['logo-bytes'], {type: 'image/png'})
    }, {now: () => '2026-08-29T00:00:00.000Z'});
    const differentMime = await context.AssetRepository.putOriginal({
      id: 'asset-different-mime',
      assetKind: 'logo',
      kind: 'media',
      name: 'Daily Logo.jpg',
      blob: new Blob(['logo-bytes'], {type: 'image/jpeg'})
    });

    assert.equal(first.id, 'asset-original');
    assert.equal(duplicate.id, 'asset-original');
    assert.equal(differentMime.id, 'asset-different-mime');
    assert.equal(await textOf(await context.AssetRepository.getBlob(first.id)), 'logo-bytes');

    const stored = await context.ClipKitRepository.assets.getAll();
    assert.equal(stored.length, 2);
    assert.equal(stored.find((asset) => asset.id === first.id).name, 'Daily Logo.png');
    assert.equal(stored.find((asset) => asset.id === first.id).byteLength, 10);
    assert.match(stored.find((asset) => asset.id === first.id).sha256, /^[a-f0-9]{64}$/);
  } finally {
    await cleanup();
  }
});

test('staged logo assets are not usable until mapping promotion and platform lookup prefers specific mappings', async () => {
  const {context, cleanup} = await repositoryContext('asset-staging-logo');
  try {
    await context.AssetRepository.putOriginal({
      id: 'asset-generic',
      assetKind: 'logo',
      kind: 'media',
      name: 'Daily Generic.png',
      blob: new Blob(['generic-logo'], {type: 'image/png'})
    });
    const staged = await context.AssetRepository.stageOriginal({
      id: 'asset-specific',
      assetKind: 'logo',
      kind: 'media',
      name: 'Daily Facebook.png',
      blob: new Blob(['specific-logo'], {type: 'image/png'})
    }, {expiresAt: '2026-08-30T00:00:00.000Z'});

    assert.equal(await context.AssetRepository.get(staged.id), null);
    assert.deepEqual(await context.AssetRepository.listReferences(staged.id), []);

    await context.ClipKitRepository.logoMappings.save({
      id: 'mapping-generic',
      mediaId: 'media-daily',
      platformId: '',
      assetId: 'asset-generic',
      confirmed: true,
      scope: 'main'
    });
    const promotedMapping = await context.ClipKitRepository.logoMappings.save({
      id: 'mapping-specific',
      mediaId: 'media-daily',
      platformId: 'facebook',
      assetId: staged.id,
      confirmed: true,
      scope: 'platform'
    });

    assert.equal(promotedMapping.assetId, 'asset-specific');
    assert.equal(await textOf(await context.AssetRepository.getBlob(promotedMapping.assetId)), 'specific-logo');
    assert.deepEqual(
      (await context.AssetRepository.listReferences(promotedMapping.assetId)).map((reference) => reference.store),
      ['logoMappings']
    );

    const specific = await context.ClipKitRepository.logoMappings.resolve('media-daily', 'facebook');
    const fallback = await context.ClipKitRepository.logoMappings.resolve('media-daily', 'website');
    assert.equal(specific.assetId, 'asset-specific');
    assert.equal(fallback.assetId, 'asset-generic');
  } finally {
    await cleanup();
  }
});

test('capture transforms reference immutable originals and request persistence once', async () => {
  const {context, cleanup} = await repositoryContext('capture-transforms');
  let persistenceRequests = 0;
  context.ClipKitStorage = {
    requestPersistence: async () => {
      persistenceRequests += 1;
      return false;
    }
  };

  try {
    const staged = await context.AssetRepository.stageOriginal({
      id: 'capture-asset',
      assetKind: 'capture',
      name: 'screen.png',
      blob: new Blob(['capture-original-bytes'], {type: 'image/png'})
    });

    const first = await context.CaptureRepository.saveTransform({
      id: 'capture-record-1',
      projectId: 'project-1',
      entryId: 'entry-1',
      images: [{
        id: 'image-1',
        assetId: staged.id,
        name: 'screen.png',
        width: 1200,
        height: 2400,
        type: 'image/png',
        dataUrl: 'data:image/png;base64,cHJldmlldw==',
        transform: {
          rotation: 90,
          cropLeft: 8,
          cropRight: 4,
          scalePercent: 75,
          align: 'right',
          cutVersion: 2,
          manualCuts: [0.35]
        }
      }]
    }, {now: () => '2026-08-28T00:00:00.000Z'});
    await context.CaptureRepository.saveTransform({
      id: 'capture-record-1',
      projectId: 'project-1',
      entryId: 'entry-1',
      images: [{
        ...first.images[0],
        dataUrl: 'data:image/png;base64,cmVjb21wcmVzc2VkLXByZXZpZXc=',
        transform: {...first.images[0].transform, rotation: 180, scalePercent: 60}
      }]
    }, {now: () => '2026-08-29T00:00:00.000Z'});

    const [stored] = await context.CaptureRepository.listByEntry('entry-1');
    assert.equal(stored.images[0].assetId, 'capture-asset');
    assert.equal(stored.images[0].transform.rotation, 180);
    assert.equal(stored.images[0].transform.scalePercent, 60);
    assert.equal(await textOf(await context.AssetRepository.getBlob('capture-asset')), 'capture-original-bytes');
    assert.equal(persistenceRequests, 1);
  } finally {
    await cleanup();
  }
});

test('directory configs keep handles in IndexedDB and remove handles from backup serialization', async () => {
  const {context, cleanup} = await repositoryContext('directory-config');
  try {
    const handle = {kind: 'directory', name: 'Client Exports'};
    await context.DirectoryRepository.saveProjectConfig('project-1', {
      handle,
      name: 'Client Exports',
      duplicateMode: 'suffix',
      separateOutputFolders: {pdf: true, excel: false, backup: true},
      folderNames: {pdf: 'PDF', excel: 'Excel', backup: 'Backup'}
    }, {now: () => '2026-08-28T00:00:00.000Z'});

    const stored = await context.DirectoryRepository.getProjectConfig('project-1');
    assert.strictEqual(context.ClipKitRepository.directories, context.DirectoryRepository);
    assert.equal(stored.handle.name, 'Client Exports');
    assert.deepEqual(stored.folderNames, {pdf: 'PDF', excel: 'Excel', backup: 'Backup'});

    const [backup] = await context.DirectoryRepository.serializeForBackup();
    assert.equal(backup.name, 'Client Exports');
    assert.equal('handle' in backup, false);
    assert.deepEqual(backup.separateOutputFolders, {pdf: true, excel: false, backup: true});
  } finally {
    await cleanup();
  }
});

test('export jobs snapshot selected order, summarize committed child results, and rematerialize from assets', async () => {
  const {context, cleanup} = await repositoryContext('export-jobs');
  try {
    const asset = await context.AssetRepository.putOriginal({
      id: 'asset-export',
      assetKind: 'capture',
      blob: new Blob(['document-source'], {type: 'image/png'})
    });

    const batch = await context.ExportJobRepository.create({
      id: 'batch-1',
      projectId: 'project-1',
      jobType: 'batch-pdf',
      entryIds: ['entry-2', 'entry-1']
    }, {now: () => '2026-08-28T00:00:00.000Z'});
    assert.deepEqual(batch.entrySnapshot.map((entry) => entry.entryId), ['entry-2', 'entry-1']);
    assert.deepEqual(batch.entrySnapshot.map((entry) => entry.order), [0, 1]);

    await context.ExportJobRepository.finish('batch-1', {status: 'succeeded'});
    await context.ExportJobRepository.create({
      id: 'job-entry-2',
      exportBatchId: 'batch-1',
      entryId: 'entry-2',
      snapshot: {
        entry: {id: 'entry-2', pub: 'Daily Two', platform: 'Website', date: '2026-08-28'},
        assetIds: [asset.id],
        layout: {template: 'news', quality: 'standard'}
      }
    });
    await context.ExportJobRepository.create({
      id: 'job-entry-1',
      exportBatchId: 'batch-1',
      entryId: 'entry-1',
      snapshot: {
        entry: {id: 'entry-1', pub: 'Daily One', platform: 'Facebook', date: '2026-08-27'},
        assetIds: [asset.id],
        layout: {template: 'news', quality: 'standard'}
      }
    });
    await context.ExportJobRepository.finish('job-entry-2', {fileName: 'two.pdf', pages: 3, status: 'exported'});
    await context.ExportJobRepository.fail('job-entry-1', new Error('disk full'));

    const csv = await context.ExportJobRepository.summaryCsv('batch-1');
    assert.equal(
      csv,
      'File Name,Publication,Platform,Date,Pages,Status\r\n'
        + 'two.pdf,Daily Two,Website,2026-08-28,3,exported\r\n'
        + 'entry-1.pdf,Daily One,Facebook,2026-08-27,0,failed: disk full'
    );

    const render = ({job, assets}) => new Blob([
      assets[0].blob,
      JSON.stringify(job.snapshot.entry),
      JSON.stringify(job.snapshot.layout)
    ], {type: 'application/pdf'});
    const first = await context.ExportJobRepository.materializeSnapshot('job-entry-2', render);
    const second = await context.ExportJobRepository.materializeSnapshot('job-entry-2', render);
    assert.deepEqual(
      new Uint8Array(await first.arrayBuffer()),
      new Uint8Array(await second.arrayBuffer())
    );
  } finally {
    await cleanup();
  }
});
