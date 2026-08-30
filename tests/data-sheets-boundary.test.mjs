import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function setup(tag='sheets') {
  const x=await freshDatabase(tag); loadDataScript(x.context,'data/clipkit-db.js'); loadDataScript(x.context,'data/records.js'); loadDataScript(x.context,'data/repository.js');
  await x.context.ClipKitDB.open();
  await x.context.ClipKitRepository.projects.put({id:'p1',name:'P',createdAt:'2026-01-01',updatedAt:'2026-01-01',deletedAt:null,recordVersion:1});
  await x.context.ClipKitRepository.entries.put({id:'e1',projectId:'p1',publicationId:'Media',platformId:'web',publishedDate:'2026-08-01',prValueSnapshot:100,recordVersion:2,createdAt:'2026-01-01',updatedAt:'2026-01-02',deletedAt:null});
  return x;
}

test('Sheets export includes stable identity and append filters previously successful revisions', async()=>{
  const x=await setup('sheets-export'); const c=x.context;
  let out=await c.buildSheetsExport('p1',{mode:'append'}); assert.equal(out.entries.length,1); assert.equal(out.entries[0].clipkit_entry_id,'e1'); assert.equal(out.entries[0].Full_Key,'Media - WEB');
  await c.ClipKitRepository.exports.create({id:'job1',sheetProjectId:'p1',status:'succeeded',entries:[{id:'e1',revision:2}]});
  out=await c.buildSheetsExport('p1',{mode:'append'}); assert.equal(out.entries.length,0); await x.cleanup();
});

test('Sheets import inspects conflicts and applies accepted rows atomically with provenance/audit', async()=>{
  const x=await setup('sheets-import'); const c=x.context;
  const inspection=await c.inspectSheetsImport([{clipkit_entry_id:'e1',clipkit_entry_revision:1,clipkit_project_id:'p1',publicationId:'Changed',platformId:'web',publishedDate:'2026-08-01',prValueSnapshot:100},{clipkit_entry_id:'e2',clipkit_entry_revision:1,clipkit_project_id:'p1',publicationId:'New',platformId:'web',publishedDate:'2026-08-02',prValueSnapshot:50}]);
  assert.equal(inspection.counts.conflict,1); assert.equal(inspection.counts.new,1);
  const report=await c.applySheetsImport(inspection,{'e1':'use-import'}); assert.equal(Array.from(report.written).join(','),'e1,e2');
  assert.equal((await c.ClipKitRepository.entries.get('e1')).publicationId,'Changed');
  assert.equal((await c.ClipKitRepository.audit.getAll()).length,2); assert.equal((await c.ClipKitDB.run('provenance','readonly',t=>c.ClipKitDB.request(t.objectStore('provenance').getAll()))).length,2);
  await x.cleanup();
});

test('missing sheet rows are never interpreted as deletion', async()=>{ const x=await setup('sheets-missing'); const c=x.context; const i=await c.inspectSheetsImport([]); assert.equal(i.counts.missing,0); assert.equal((await c.ClipKitRepository.entries.get('e1')).deletedAt,null); await x.cleanup(); });

test('legacy registry rows from _db_custom remain inspectable', async()=>{
  const x=await setup('sheets-legacy'); const i=await x.context.inspectSheetsImport([{pub:'News',platform:'FB',value:150000}]);
  assert.equal(i.counts.invalid,0); assert.equal(i.rows[0].incoming.publicationId,'News'); assert.equal(i.rows[0].incoming.platformId,'FB'); await x.cleanup();
});
