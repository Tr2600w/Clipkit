import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function setup(tag){
  const x=await freshDatabase(tag);
  x.context.localStorage={_m:new Map(),getItem(k){return this._m.get(k)||null},setItem(k,v){this._m.set(k,String(v))},removeItem(k){this._m.delete(k)}};
  for(const file of ['data/clipkit-db.js','data/records.js','data/repository.js','data/migration.js']) loadDataScript(x.context,file);
  await x.context.ClipKitDB.open();
  return x;
}
test('cutover status starts safely and exposes cleanup gates',async()=>{
  const x=await setup('cutover-status');
  try { const s=await x.context.ClipKitMigration.getStatus(); assert.equal(s.state,'not-started'); const c=await x.context.ClipKitMigration.listLegacyCleanup(); assert.equal(c.eligible,false); assert.equal(c.requiresFreshBackup,true); assert.equal(c.typedConfirmation,'DELETE LEGACY DATA'); }
  finally {await x.cleanup();}
});
test('acknowledge requires verified migration',async()=>{
  const x=await setup('cutover-ack');
  try { await assert.rejects(x.context.ClipKitMigration.acknowledgeCutover(),e=>e.code==='CUTOVER_NOT_VERIFIED'); }
  finally {await x.cleanup();}
});
