import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

function codec() {
  return {
    encodeZip: async files => new Blob([JSON.stringify(files.map(f => ({name:f.name,data:[...new Uint8Array(f.data)]})))], {type:'application/zip'}),
    decodeZip: async blob => JSON.parse(await blob.text()).map(f => ({name:f.name,data:Uint8Array.from(f.data)}))
  };
}
async function ctx(tag) { const x=await freshDatabase(tag); loadDataScript(x.context,'data/clipkit-db.js'); loadDataScript(x.context,'data/records.js'); loadDataScript(x.context,'data/repository.js'); loadDataScript(x.context,'data/backup.js'); return x; }

test('backup creates deterministic manifest, excludes handles, and restores blobs', async () => {
  const x=await ctx('backup-roundtrip');
  try {
    await x.context.ClipKitRepository.projects.put({id:'p1',name:'Project',createdAt:'2026-01-01',updatedAt:'2026-01-01',recordVersion:1});
    await x.context.AssetRepository.putOriginal({id:'a1',assetKind:'logo',mime:'image/png',blob:new Blob(['bytes'],{type:'image/png'})});
    await x.context.ClipKitRepository.directories.saveProjectConfig('p1',{name:'Exports',handle:{kind:'directory',name:'secret'},updatedAt:'2026-01-01'});
    const options={...codec(),now:()=> '2026-01-02T00:00:00.000Z'};
    const backup=await x.context.ClipKitBackup.create(options);
    const inspected=await x.context.ClipKitBackup.inspect(backup,options);
    assert.equal(inspected.valid,true); assert.equal(inspected.manifest.assetCount,1);
    await x.context.ClipKitDB.run(['projects','assets'],'readwrite',t=>Promise.all(['projects','assets'].map(n=>x.context.ClipKitDB.request(t.objectStore(n).clear()))));
    const report=await x.context.ClipKitBackup.restore(backup,{...options,mode:'merge'});
    assert.equal(report.valid,true); assert.equal((await x.context.ClipKitRepository.projects.get('p1')).name,'Project');
    assert.equal(await (await x.context.AssetRepository.getBlob('a1')).text(),'bytes');
  } finally { await x.cleanup(); }
});

test('corrupt backup and wrong password fail before writes', async () => {
  const x=await ctx('backup-errors');
  try {
    const options={...codec(),password:'correct'}; const backup=await x.context.ClipKitBackup.create(options);
    await assert.rejects(()=>x.context.ClipKitBackup.inspect(backup,{...options,password:'wrong'}));
    const corrupted=new Blob([JSON.stringify([{name:'manifest.json',data:[1,2,3]}])]);
    await assert.rejects(()=>x.context.ClipKitBackup.inspect(corrupted,codec()));
    assert.equal((await x.context.ClipKitRepository.projects.getAll()).length,0);
  } finally { await x.cleanup(); }
});

test('restore exposes conflict classes and requires safety backup for replace', async () => {
  const x=await ctx('backup-conflicts');
  try {
    await x.context.ClipKitRepository.projects.put({id:'p1',name:'old',updatedAt:'2026-01-01',createdAt:'2026-01-01',recordVersion:1});
    const backup=await x.context.ClipKitBackup.create({...codec(),now:()=> '2026-01-02'});
    const inspect=await x.context.ClipKitBackup.restore(backup,{...codec(),inspectOnly:true});
    assert.ok(inspect.conflicts.some(c=>c.type==='same'));
    await assert.rejects(()=>x.context.ClipKitBackup.restore(backup,{...codec(),mode:'replace',createSafetyBackup:async()=>null}),/safety backup failed/);
    assert.equal((await x.context.ClipKitRepository.projects.get('p1')).name,'old');
    const unresolved=await x.context.ClipKitBackup.restore(backup,{...codec(),mode:'merge'});
    assert.equal(unresolved.valid,false); assert.equal(unresolved.unresolved.length,1);
    const applied=await x.context.ClipKitBackup.restore(backup,{...codec(),mode:'merge',resolutions:{'projects:p1':'use-backup'}});
    assert.equal(applied.valid,true); assert.equal((await x.context.ClipKitRepository.projects.get('p1')).name,'old');
    assert.equal((await x.context.ClipKitRepository.audit.getAll()).at(-1).source,'import');
  } finally { await x.cleanup(); }
});

test('string scope is normalized and excludes unrelated stores', async () => {
  const x=await ctx('backup-scope');
  try {
    await x.context.ClipKitRepository.projects.put({id:'p1',name:'Project',createdAt:'2026-01-01',updatedAt:'2026-01-01',recordVersion:1});
    await x.context.AssetRepository.putOriginal({id:'a1',assetKind:'logo',blob:new Blob(['logo'],{type:'image/png'})});
    const backup=await x.context.ClipKitBackup.create({...codec(),scope:'projects'});
    const inspected=await x.context.ClipKitBackup.inspect(backup,codec());
    assert.ok(inspected.files.includes('database/projects.json'));
    assert.equal(inspected.files.some(name=>name.startsWith('assets/')),false);
    assert.equal(inspected.files.includes('database/assets.json'),false);
    assert.deepEqual(inspected.manifest.scope.stores.includes('projects'),true);
  } finally { await x.cleanup(); }
});
