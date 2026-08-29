import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function ctx(tag) { const d = await freshDatabase(tag); loadDataScript(d.context, 'data/clipkit-db.js'); loadDataScript(d.context, 'data/repository.js'); loadDataScript(d.context, 'data/lifecycle.js'); return d; }

test('lifecycle soft deletes and restores records with retention metadata', async () => {
  const {context, cleanup} = await ctx('lifecycle-trash');
  try {
    await context.ClipKitRepository.projects.put({id:'p1',name:'Project',deletedAt:null,recordVersion:1});
    const trashed = await context.ClipKitLifecycle.softDelete('project','p1',{now:()=> '2026-08-29T00:00:00.000Z'});
    assert.equal(trashed.deletedAt, '2026-08-29T00:00:00.000Z');
    assert.equal(new Date(trashed.purgeAfter).toISOString(), '2026-09-28T00:00:00.000Z');
    assert.equal((await context.ClipKitLifecycle.listTrash()).length, 1);
    const restored = await context.ClipKitLifecycle.restore('project','p1',{now:()=> '2026-08-30T00:00:00.000Z'});
    assert.equal(restored.deletedAt, null);
    assert.equal((await context.ClipKitLifecycle.listTrash()).length, 0);
  } finally { await cleanup(); }
});

test('asset permanent delete is blocked while references exist and dryRun is exact', async () => {
  const {context, cleanup} = await ctx('lifecycle-assets');
  try {
    await context.AssetRepository.putOriginal({id:'a1',blob:new Blob(['x'],{type:'image/png'})});
    await context.ClipKitRepository.projects.put({id:'p1',name:'P',agencyLogoAssetId:'a1'});
    const blocked = await context.ClipKitLifecycle.deleteAsset('a1');
    assert.equal(blocked.deleted, false); assert.equal(blocked.blocked, true); assert.equal(blocked.references.length, 1);
    await context.ClipKitLifecycle.softDelete('asset','a1',{now:()=> '2026-08-29T00:00:00.000Z'});
    const plan = await context.ClipKitLifecycle.dryRun({now:()=> '2026-09-29T00:00:00.000Z'});
    assert.equal(plan.candidates.length, 1); assert.equal(plan.deletable.length, 0); assert.equal(plan.blocked.length, 1);
  } finally { await cleanup(); }
});

test('directory handle loss is represented by a restore marker', async () => {
  const {context, cleanup} = await ctx('lifecycle-directory');
  try {
    await context.ClipKitRepository.directories.saveProjectConfig('p1',{name:'Exports',handle:{opaque:true}});
    const missing = await context.ClipKitLifecycle.directoryHandleRemoved('p1',{now:()=> '2026-08-29T00:00:00.000Z'});
    assert.equal(missing.handle, null); assert.equal(missing.needsPermission, true);
    const restored = await context.ClipKitLifecycle.directoryHandleRestored('p1',{name:'new-handle'},{now:()=> '2026-08-30T00:00:00.000Z'});
    assert.equal(restored.needsPermission, false); assert.deepEqual(restored.handle,{name:'new-handle'});
  } finally { await cleanup(); }
});
