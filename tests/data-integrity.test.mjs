import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function ctx(tag) {
  const d = await freshDatabase(tag);
  for (const file of ['data/clipkit-db.js','data/repository.js','data/storage-manager.js','data/integrity.js']) loadDataScript(d.context, file);
  return d;
}

test('quickCheck reports expired staging and blocks active migration', async () => {
  const {context, cleanup} = await ctx('integrity-quick');
  try {
    await context.ClipKitRepository.meta.put({key:'migration:v1:active', startedAt:'2026-01-01'});
    await context.ClipKitRepository.assets.stageOriginal({id:'stale', blob:new Blob(['x'], {type:'image/png'}), expiresAt:'2020-01-01'});
    const report = await context.ClipKitIntegrity.quickCheck();
    assert.equal(report.status, 'blocked');
    assert.ok(report.issues.some(i => i.code === 'MIGRATION_ACTIVE'));
    assert.ok(report.issues.some(i => i.code === 'STAGING_EXPIRED'));
  } finally { await cleanup(); }
});

test('deepAudit reports missing references, staged mappings, duplicate mappings and bad metadata', async () => {
  const {context, cleanup} = await ctx('integrity-deep');
  try {
    await context.ClipKitRepository.entries.put({id:'entry-1', assetId:'missing'});
    await context.ClipKitRepository.logoMappings.put({id:'map-1', mediaId:'m', platformId:'web', assetId:'missing'});
    await context.ClipKitRepository.logoMappings.put({id:'map-2', mediaId:'m', platformId:'web', assetId:'missing'});
    await context.ClipKitRepository.assets.put({id:'bad', blob:new Blob(['abc'], {type:'image/png'}), byteLength:99, sha256:'wrong'});
    const report = await context.ClipKitIntegrity.deepAudit();
    const codes = report.issues.map(i => i.code);
    assert.ok(codes.includes('MISSING_ASSET_REFERENCE'));
    assert.ok(codes.includes('DUPLICATE_MAPPING'));
    assert.ok(codes.includes('BAD_CHECKSUM_METADATA'));
  } finally { await cleanup(); }
});

test('storage status applies 70 and 85 percent thresholds', async () => {
  const {context, cleanup} = await ctx('storage-thresholds');
  try {
    context.navigator = {storage:{estimate:async()=>({usage:70, quota:100}), persisted:async()=>true}};
    let status = await context.ClipKitStorage.getStatus();
    assert.equal(status.level, 'warning');
    context.navigator.storage.estimate = async()=>({usage:85, quota:100});
    status = await context.ClipKitStorage.getStatus();
    assert.equal(status.level, 'critical');
  } finally { await cleanup(); }
});

test('cleanup candidates exclude deleted assets that remain referenced', async () => {
  const {context, cleanup} = await ctx('storage-cleanup');
  try {
    await context.ClipKitRepository.assets.put({id:'used', blob:new Blob(['u']), deletedAt:'2020-01-01'});
    await context.ClipKitRepository.assets.put({id:'free', blob:new Blob(['f']), deletedAt:'2020-01-01'});
    await context.ClipKitRepository.projects.put({id:'p', agencyLogoAssetId:'used'});
    const candidates = await context.ClipKitStorage.listCleanupCandidates();
    assert.equal(candidates.some(c => c.id === 'used'), false);
    assert.equal(candidates.some(c => c.id === 'free'), true);
  } finally { await cleanup(); }
});
