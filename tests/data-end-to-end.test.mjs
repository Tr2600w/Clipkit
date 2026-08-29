import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

function codec() {
  return {
    encodeZip: async files => new Blob([JSON.stringify(files.map(file => ({name:file.name, data:[...new Uint8Array(file.data)]})))], {type:'application/zip'}),
    decodeZip: async blob => JSON.parse(await blob.text()).map(file => ({name:file.name, data:Uint8Array.from(file.data)}))
  };
}

class MemoryStorage {
  constructor(seed) { this.values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)])); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('offline lifecycle migrates, edits, reloads, and restores canonical records with Blob hashes', async () => {
  const x = await freshDatabase('e2e-canonical');
  try {
    for (const file of ['data/clipkit-db.js','data/records.js','data/repository.js','data/migration.js','data/backup.js']) loadDataScript(x.context, file);
    const legacy = new MemoryStorage({
      ck_projects: JSON.stringify([{id:'legacy-project',name:'Legacy project'}]),
      'ck_proj_legacy-project': JSON.stringify([{id:'legacy-entry',pub:'Example.com',platform:'Website',date:'2026-08-18',url:'https://example.test/story',prValue:150000}])
    });
    const migration = await x.context.ClipKitMigration.migrate({safeLS:legacy, indexedDB:x.context.indexedDB});
    assert.equal(migration.state, 'verified');
    const migrated = (await x.context.ClipKitRepository.entries.getAll()).find(row => row.legacyId === 'legacy-entry');
    assert.ok(migrated, 'legacy entry is promoted into canonical storage');
    const blob = new Blob(['immutable capture bytes'], {type:'image/png'});
    const asset = await x.context.AssetRepository.putOriginal({id:'capture-1',assetKind:'capture',mime:'image/png',blob,sha256:'placeholder'});
    const entry = await x.context.ClipKitRepository.entries.put({...migrated, captureAssetId:asset.id, headline:'Edited after migration',updatedAt:'2026-08-19T00:00:00.000Z'});
    assert.equal(entry.headline, 'Edited after migration');
    const before = await x.context.AssetRepository.getBlob(asset.id);
    const originalBytes = [...new Uint8Array(await before.arrayBuffer())];
    assert.deepEqual(originalBytes, [...new Uint8Array(await blob.arrayBuffer())]);
    const backup = await x.context.ClipKitBackup.create({...codec(),now:()=> '2026-08-20T00:00:00.000Z'});
    const resetStores = ['projects','entries','media','mediaAliases','domainMappings','usernameMappings','platforms','mediaPlatformMappings','logoMappings','assets','captures','inspections','resolverCache','provenance','auditEvents','exportJobs','drafts','stagingAssets','directories','locks','importReports'];
    await x.context.ClipKitDB.run(resetStores, 'readwrite', tx => Promise.all(resetStores.map(name => x.context.ClipKitDB.request(tx.objectStore(name).clear()))));
    const preview = await x.context.ClipKitBackup.restore(backup, {...codec(),mode:'merge',inspectOnly:true});
    const resolutions = Object.fromEntries(preview.conflicts.map(conflict => [`${conflict.store}:${conflict.id}`, 'use-backup']));
    const restored = await x.context.ClipKitBackup.restore(backup, {...codec(),mode:'merge',resolutions});
    assert.equal(restored.valid, true);
    const reloaded = await x.context.ClipKitRepository.entries.get(entry.id);
    assert.equal(reloaded.headline, 'Edited after migration');
    const after = await x.context.AssetRepository.getBlob(asset.id);
    assert.deepEqual([...new Uint8Array(await after.arrayBuffer())], originalBytes);
  } finally { await x.cleanup(); }
});
