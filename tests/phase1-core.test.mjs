import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {TextDecoder} from 'node:util';
import vm from 'node:vm';
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';

function storage(seed={}){
  const data=new Map(Object.entries(seed));
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key),
    clear:()=>data.clear()
  };
}

function loadApp(extra='',seedLocal={}){
  const noop=()=>{};
  const bodyChildren=[];
  const element=new Proxy({
    addEventListener:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    style:{},dataset:{},options:[],value:'',checked:false,appendChild:noop,removeChild:noop,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null
  },{get:(target,key)=>key in target?target[key]:noop});
  const document={
    body:{appendChild:child=>bodyChildren.push(child)},addEventListener:noop,
    getElementById:id=>id==='clipkitRecoveryPanel'?bodyChildren.find(child=>child.id===id)||null:element,
    querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new Proxy({
      addEventListener:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
      style:{},dataset:{},options:[],value:'',checked:false,appendChild:noop,removeChild:noop,
      querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null
    },{get:(target,key)=>key in target?target[key]:noop})
  };
  const indexedDB=new IDBFactory();
  const context={
    console,URL,Blob,Date,JSON,Map,Set,Math,Number,String,Object,Array,RegExp,TextEncoder,TextDecoder,
    Uint8Array,atob,crypto:webcrypto,indexedDB,IDBKeyRange,structuredClone,
    setTimeout,clearTimeout,requestAnimationFrame:noop,localStorage:storage(seedLocal),sessionStorage:storage(),document,
    window:{},confirm:()=>false,FileReader:function(){},testAssert:assert
  };
  context.window.window=context.window;
  context.window.indexedDB=indexedDB;
  vm.createContext(context);
  for(const script of ['clipkit-db.js','records.js','repository.js','save-coordinator.js','migration.js','legacy-adapter.js']){
    const dataSource=fs.readFileSync(new URL('../data/'+script,import.meta.url),'utf8');
    vm.runInContext(dataSource,context,{filename:script});
  }
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  vm.runInContext(source+'\n'+extra,context,{filename:'app.js'});
  return context;
}

function loadPhase2(extra=''){
  const noop=()=>{};
  const element=new Proxy({
    addEventListener:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    style:{},dataset:{},options:[],value:'',checked:false,appendChild:noop,removeChild:noop,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null
  },{get:(target,key)=>key in target?target[key]:noop});
  const document={addEventListener:noop,getElementById:()=>element,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>element};
  const indexedDB=new IDBFactory();
  const context={
    console,URL,Blob,Date,JSON,Map,Set,Math,Number,String,Object,Array,RegExp,TextEncoder,TextDecoder,
    Uint8Array,Uint32Array,DataView,atob,setTimeout,clearTimeout,requestAnimationFrame:noop,crypto:webcrypto,indexedDB,IDBKeyRange,structuredClone,
    localStorage:storage(),sessionStorage:storage(),
    document,window:{},confirm:()=>false,FileReader:function(){},testAssert:assert
  };
  context.window.window=context.window;
  context.window.indexedDB=indexedDB;
  vm.createContext(context);
  for(const script of ['clipkit-db.js','records.js','repository.js','save-coordinator.js','migration.js','legacy-adapter.js']){
    const dataSource=fs.readFileSync(new URL('../data/'+script,import.meta.url),'utf8');
    vm.runInContext(dataSource,context,{filename:script});
  }
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const phase2=fs.readFileSync(new URL('../phase2.js',import.meta.url),'utf8');
  vm.runInContext(app+'\n'+phase2+'\n'+extra,context,{filename:'phase2.js'});
  return context;
}

test('bootstrap waits for verified migration before hydration and populates the active view',async()=>{
  const context=loadApp();
  context.bootstrapOrder=[];
  context.ClipKitMigration.migrate=async()=>{
    context.bootstrapOrder.push('migration:start');
    await Promise.resolve();
    context.bootstrapOrder.push('migration:verified');
    return {state:'verified',verification:{ok:true}};
  };
  context.ClipKitLegacyAdapter.hydrate=async projectId=>{
    context.bootstrapOrder.push('hydrate:'+projectId);
    return {activeProjectId:projectId,projects:[{id:'default',name:'Default'}],entries:[{
      id:'entry-uuid',date:'2026-08-18',pub:'Bangkok Today',platform:'Website',prValue:150000,status:'draft'
    }]};
  };
  await vm.runInContext('bootstrapClipKit()',context);
  assert.deepEqual(context.bootstrapOrder,['migration:start','migration:verified','hydrate:default']);
  vm.runInContext("testAssert.equal(entries[0].id,'entry-uuid')",context);
});

test('bootstrap accepts verified migration during safety window and after cutover',async()=>{
  for(const state of ['safety-window','complete']){
    const context=loadApp();
    context.ClipKitMigration.migrate=async()=>({state,verification:{ok:true}});
    context.ClipKitLegacyAdapter.hydrate=async projectId=>({
      activeProjectId:projectId,
      projects:[{id:'default',name:'Default'}],
      entries:[]
    });
    await vm.runInContext('bootstrapClipKit()',context);
    vm.runInContext("testAssert.equal(entries.length,0)",context);
  }
});

test('bootstrap keeps built-in platforms available when hydrated database has no platform rows',async()=>{
  const context=loadApp();
  context.ClipKitMigration.migrate=async()=>({state:'verified',verification:{ok:true}});
  context.ClipKitLegacyAdapter.hydrate=async projectId=>({
    activeProjectId:projectId, projects:[{id:'default',name:'Default'}], entries:[],
    mediaRows:[], platforms:[], usernameMap:{}
  });
  await vm.runInContext('bootstrapClipKit()',context);
  vm.runInContext(`
    testAssert.equal(getPlatformDefinition('Website').name,'Website');
    testAssert.equal(getPlatformDefinition('FB').name,'Facebook');
    testAssert.equal(activePlatforms().length >= 4,true);
  `,context);
});

test('bootstrap wires every hydrated projection into legacy read sources',async()=>{
  const context=loadApp('',{
    ck_active_proj:'idb-project',
    ck_projects:JSON.stringify([{id:'stale-project',name:'Stale project'}]),
    ck_custom:JSON.stringify([{pub:'Stale custom',platform:'Website',value:1}]),
    ck_imported:JSON.stringify([{pub:'Stale imported',platform:'Website',value:2}]),
    ck_platform_registry:JSON.stringify([{id:'stale',name:'Stale platform'}]),
    ck_umap:JSON.stringify({'website:stale':{username:'stale',platform:'Website',pub:'Stale'}})
  });
  context.ClipKitMigration.migrate=async()=>({state:'verified',verification:{ok:true}});
  context.renderRecent=()=>{};
  context.ClipKitLegacyAdapter.hydrate=async projectId=>({
    activeProjectId:projectId,
    projects:[
      {id:'idb-project',name:'IndexedDB Project',clientName:'IndexedDB Client'},
      {id:'second-project',name:'Second Project',clientName:'Second Client'}
    ],
    entries:[{id:projectId==='second-project'?'second-entry':'entry-uuid',date:'2026-08-18',pub:projectId==='second-project'?'Second News':'IndexedDB News',platform:'Fedi',prValue:150000,status:'draft'}],
    mediaRows:[
      {id:'media-custom',pub:'IndexedDB Custom',platform:'Fedi',value:150000,_src:'custom'},
      {id:'media-imported',pub:'IndexedDB Imported',platform:'Fedi',value:210000,_src:'imported'}
    ],
    platforms:[{id:'fedi',name:'Fedi',dbCode:'FD',fileCode:'FD',builtin:false,active:true,aliases:[]}],
    usernameMap:{'fedi:idb':{username:'idb',platform:'Fedi',pub:'IndexedDB Custom'}}
  });

  await vm.runInContext('bootstrapClipKit()',context);

  vm.runInContext(`
    testAssert.equal(JSON.stringify(getAllProjects().map(project=>project.id)),JSON.stringify(['idb-project','second-project']));
    testAssert.equal(JSON.stringify(getCustom().map(row=>row.pub)),JSON.stringify(['IndexedDB Custom']));
    testAssert.equal(JSON.stringify(getImported().map(row=>row.pub)),JSON.stringify(['IndexedDB Imported']));
    testAssert.equal(JSON.stringify(getPlatformRegistry().map(platform=>platform.name)),JSON.stringify(['Fedi']));
    testAssert.equal(JSON.stringify(getUsernameMap()),JSON.stringify({'fedi:idb':{username:'idb',platform:'Fedi',pub:'IndexedDB Custom'}}));
    testAssert.equal(DB.some(row=>row.pub==='IndexedDB Custom'&&row.platform==='Fedi'),true);
    testAssert.equal(DB.some(row=>row.pub==='Stale custom'),false);
  `,context);
  await vm.runInContext("switchProject('second-project')",context);
  vm.runInContext(`
    testAssert.equal(_activeProj,'second-project');
    testAssert.equal(entries.length,1);
    testAssert.equal(entries[0].id,'second-entry');
    testAssert.equal(getProjEntries('second-project')[0].id,'second-entry');
  `,context);
});

test('rendered migrated UUID actions remain callable across row, Capture, PDF, and batch flows',async()=>{
  const context=loadPhase2();
  const id='00000000-0000-4000-8000-000000000123';
  context.testEntryId=id;
  await vm.runInContext(`(async()=>{
    entries.length=0;
    entries.push({id:testEntryId,date:'2026-08-18',pub:'UUID News',platform:'Website',prValue:150000,status:'draft',captureCount:0});
    entries.push({id:'00000000-0000-4000-8000-000000000124',date:'2026-08-18',pub:'UUID News',platform:'Website',prValue:150000,status:'draft',captureCount:0});
    testAssert.equal(p2OutputFileName({...entries[1]}),'260818_UUID News_02.pdf');
    entries.pop();
    renderTable();
    const html=document.getElementById('tbody').innerHTML;
    testAssert.match(html,new RegExp('openCapture\\\\(&quot;'+testEntryId+'&quot;\\\\)'));
    testAssert.match(html,new RegExp('dupEntry\\\\(&quot;'+testEntryId+'&quot;\\\\)'));
    testAssert.match(html,new RegExp('delEntry\\\\(&quot;'+testEntryId+'&quot;\\\\)'));
    testAssert.match(html,new RegExp('editingRowId=&quot;'+testEntryId+'&quot;'));
    let duplicateCommandCalls=0;
    ClipKitLegacyAdapter.getRecord=(store,id)=>store==='entries'&&id===testEntryId?{
      id,projectId:'default',publicationId:'media-uuid',platformId:'website',publishedDate:'2026-08-18',
      workflowStatus:'draft',recordVersion:1
    }:null;
    saveEntryCommand=async()=>{duplicateCommandCalls++;entries.push({id:'duplicate-uuid',date:'2026-08-18',pub:'UUID News',platform:'Website',prValue:150000,status:'draft'});return{ok:true,record:{id:'duplicate-uuid'}};};
    await dupEntry(testEntryId);
    testAssert.equal(duplicateCommandCalls,1);
    testAssert.equal(entries.length,2);
    await delEntry(testEntryId);
    testAssert.equal(entries.some(entry=>entry.id===testEntryId),true);
    await openCapture(testEntryId);
    testAssert.equal(_captureEntryId,testEntryId);
    await openPdfPreview(testEntryId);
    testAssert.equal(p2PreviewEntryId,testEntryId);
    toggleBatchRow(testEntryId,true);
    testAssert.equal(p2SelectedIds.has(testEntryId),true);
    await openBatchExport();
    testAssert.equal(p2BatchRows[0].entry.id,testEntryId);
  })()`,context);
});

test('Phase 2 storage helpers route binary assets, captures, and directory config through unified repositories',async()=>{
  const context=loadPhase2();
  await vm.runInContext(`(async()=>{
    await p2StorePut('assets',{
      id:'phase2-logo',
      assetKind:'logo',
      kind:'media',
      name:'Daily.png',
      mime:'image/png',
      dataUrl:'data:image/png;base64,bG9nby1ieXRlcw==',
      publication:'Daily',
      platform:'Website'
    });
    testAssert.equal((await ClipKitRepository.assets.get('phase2-logo')).id,'phase2-logo');
    testAssert.equal(await (await ClipKitRepository.assets.getBlob('phase2-logo')).text(),'logo-bytes');
    testAssert.equal((await p2StoreGet('assets','phase2-logo')).dataUrl,'data:image/png;base64,bG9nby1ieXRlcw==');

    await p2StorePut('directories',{
      key:p2DirectoryKey('project-1'),
      handle:{kind:'directory',name:'Client Exports'},
      name:'Client Exports',
      separateOutputFolders:{pdf:true,excel:false,backup:true}
    });
    testAssert.equal((await ClipKitRepository.directories.getProjectConfig('project-1')).handle.name,'Client Exports');
    const [backupDirectory]=await ClipKitRepository.directories.serializeForBackup();
    testAssert.equal('handle' in backupDirectory,false);
    testAssert.equal(backupDirectory.name,'Client Exports');

    await saveCaptureRecord('project-1','entry-1',[{
      id:'capture-image',
      name:'screen.png',
      type:'image/png',
      dataUrl:'data:image/png;base64,cHJldmlldy1ieXRlcw==',
      originalDataUrl:'data:image/png;base64,Y2FwdHVyZS1ieXRlcw==',
      width:120,
      height:240,
      transform:{rotation:90,scalePercent:70,align:'right',cutVersion:2,manualCuts:[0.5]}
    }]);
    const [capture]=await ClipKitRepository.captures.listByEntry('entry-1');
    testAssert.equal(capture.images[0].transform.rotation,90);
    testAssert.equal(await (await ClipKitRepository.assets.getBlob(capture.images[0].assetId)).text(),'capture-bytes');
    const hydrated=await getCaptureRecord('project-1','entry-1');
    testAssert.equal(hydrated.images[0].originalDataUrl,'data:image/png;base64,Y2FwdHVyZS1ieXRlcw==');
  })()`,context);
});

test('bootstrap rejects migration failure and renders a blocking recovery panel',async()=>{
  const context=loadApp();
  context.console={...console,error:()=>{}};
  context.ClipKitMigration.migrate=async()=>{throw new Error('migration failed');};
  await assert.rejects(vm.runInContext('bootstrapClipKit()',context),/migration failed/);
  assert.equal(context.document.getElementById('clipkitRecoveryPanel').role,'alertdialog');
});

test('Phase 1 core safety and naming rules',()=>{
  loadApp(`
    testAssert.equal(safeHttpUrl('javascript:alert(1)'), '');
    testAssert.equal(safeHttpUrl('https://example.com/news').startsWith('https://example.com/news'), true);
    testAssert.equal(normalizeUrl('https://Example.com/story/?utm_source=x&fbclid=y'), 'https://example.com/story');
    testAssert.equal(buildOutputFileName('2026-08-06','Zipeventapp.com','Website',{
      name:'MMAD',clientName:'MMAD',filePattern:'{YYMMDD}_{Publication}.pdf'
    }), '260806_Zipeventapp.com.pdf');
    testAssert.equal(buildOutputFileName('2026-08-06','Zipeventapp.com','Website',{
      name:'MMAD',clientName:'MMAD',filePattern:'{Project}_{YYMMDD}_{Publication}-{Platform}'
    }), 'MMAD_260806_Zipeventapp.com-WEB.pdf');
    testAssert.equal(normalizeEntry({id:1}).status, 'draft');
    testAssert.equal(WORK_STATUSES.includes(normalizeEntry({status:'completed'}).status), true);
  `);
});

test('corrupt stored JSON falls back safely',()=>{
  loadApp(`
    safeLS.setItem('broken','{not-json');
    testAssert.deepEqual(readJSON('broken',[]),[]);
  `);
});

test('legacy entries migrate without being discarded',()=>{
  const legacy=JSON.stringify([{id:7,date:'2026-08-06',pub:'Zipeventapp.com',platform:'Website',prValue:210000}]);
  loadApp(`
    migrateStorage();
    testAssert.equal(safeLS.getItem('ck_schema_version'),'5');
    testAssert.equal(safeLS.getItem('ck_entries'),null);
    testAssert.equal(!!safeLS.getItem('ck_backup_pre_v2'),true);
    testAssert.equal(!!safeLS.getItem('ck_backup_pre_v5'),true);
    const migrated=JSON.parse(safeLS.getItem('ck_proj_default'));
    testAssert.equal(migrated.length,1);
    testAssert.equal(migrated[0].fileName,'260806_Zipeventapp.com.pdf');
    testAssert.equal(migrated[0].status,'draft');
  `,{'ck_entries':legacy});
});

test('platform registry controls DB suffixes and file-name abbreviations',()=>{
  loadApp(`
    const registry=getPlatformRegistry();
    registry.push({id:'bluesky',name:'Bluesky',dbCode:'BS',fileCode:'BSKY',builtin:false,active:true,aliases:['Blue Sky']});
    savePlatformRegistry(registry);
    testAssert.equal(normPlatform('Blue Sky'),'Bluesky');
    testAssert.equal(makeDbKey('Example Media','Bluesky'),'Example Media - BS');
    testAssert.equal(buildOutputFileName('2026-08-06','Example Media','Bluesky',{
      name:'MMAD',filePattern:'{YYMMDD}_{Publication}-{Platform}.pdf'
    }),'260806_Example Media-BSKY.pdf');
    testAssert.equal(buildOutputFileName('2026-08-06','Example Media','Facebook',{
      name:'MMAD',filePattern:'{YYMMDD}_{Publication}{PlatformSuffix}.pdf'
    }),'260806_Example Media - FB.pdf');
    testAssert.equal(buildOutputFileName('2026-08-06','Example.com','Website',{
      name:'MMAD',filePattern:'{YYMMDD}_{Publication}{PlatformSuffix}.pdf'
    }),'260806_Example.com.pdf');
    testAssert.equal(buildOutputFileName('2026-08-06','Channel 3','TV',{
      name:'MMAD',filePattern:'{YYMMDD}_{Publication}{PlatformSuffix}.pdf'
    },'2.29 min'),'260806_Channel 3 - TV - 2.29 min.pdf');
    const edited=getPlatformRegistry();
    edited.find(p=>p.id==='bluesky').dbCode='BLUE';
    savePlatformRegistry(edited);
    testAssert.equal(makeDbKey('Example Media','Bluesky'),'Example Media - BLUE');
  `);
});

test('legacy custom platforms migrate into the registry',()=>{
  loadApp(`
    migrateStorage();
    const p=getPlatformDefinition('Blockdit');
    testAssert.equal(p.name,'Blockdit');
    testAssert.equal(p.builtin,false);
    testAssert.equal(safeLS.getItem('ck_custom_plats'),null);
  `,{'ck_schema_version':'2','ck_custom_plats':JSON.stringify(['Blockdit'])});
});

test('Phase 2 capture sizing and PDF pagination stay within safe bounds',()=>{
  loadApp(`
    const resized=captureTargetSize(4000,12000);
    testAssert.equal(resized.width<=2200,true);
    testAssert.equal(resized.height<=10000,true);
    testAssert.equal(resized.width*resized.height<=15000000,true);
    const slices=capturePageSlices(1200,6000);
    testAssert.equal(slices.length>1,true);
    testAssert.equal(slices[0].y,0);
    testAssert.equal(slices.reduce((sum,s)=>sum+s.height,0),6000);
    testAssert.equal(normalizeEntry({id:2,captureCount:'3'}).captureCount,3);
    const pdf=buildImagePDFBlob([{dataUrl:'data:image/jpeg;base64,/9j/2Q==',width:1,height:1}]);
    testAssert.equal(pdf.type,'application/pdf');
    testAssert.equal(pdf.size>300,true);
  `);
});

test('Phase 2 Letter naming and logo identities follow the Platform Registry',()=>{
  loadPhase2(`
    const social=p2FileIdentity('CommoCommu - IG.png');
    testAssert.equal(social.publication,'CommoCommu');
    testAssert.equal(social.platform,'Instagram');
    const main=p2FileIdentity('Zipeventapp.com.jpg');
    testAssert.equal(main.publication,'Zipeventapp.com');
    testAssert.equal(main.platform,'');
    entries.push({id:1,date:'2026-08-06',pub:'CommoCommu',platform:'Instagram'});
    entries.push({id:2,date:'2026-08-06',pub:'CommoCommu',platform:'Instagram'});
    testAssert.equal(p2OutputFileName(entries[0]),'260806_CommoCommu - IG.pdf');
    testAssert.equal(p2OutputFileName(entries[1]),'260806_CommoCommu - IG_02.pdf');
    testAssert.equal(p2PublicationDisplay({pub:'Morning News',platform:'TV',duration:'2.29 min'}),'Morning News - TV - 2.29 min');
    testAssert.equal(p2PublicationDisplay({pub:'Example.com',platform:'Website'}),'Example.com');
    testAssert.equal(p2FormatDate('2026-08-13'),'13/08/2026');
    testAssert.equal(P2_LETTER.frame.x,43.5);
    testAssert.equal(P2_LETTER.frame.w,521.85);
    testAssert.deepEqual(P2_LETTER.title,{x:249.65,y:25.8,w:112.7,h:13.56});
    testAssert.equal(P2_LETTER.media.w,128);
    testAssert.equal(P2_LETTER.client.w,128);
    testAssert.equal(P2_LETTER.content.w,500);
    testAssert.equal(P2_LETTER.content.firstH,430);
    testAssert.equal(P2_LETTER.content.nextH,560);
    testAssert.equal(p2Layout('a4').pageW,595.28);
    testAssert.equal(p2Layout('a4').pageH,841.89);
    testAssert.equal(p2Layout('a4').frame.w,P2_LETTER.frame.w);
    testAssert.equal(p2Layout('a4').content.w,P2_LETTER.content.w);
    testAssert.equal(p2Layout('a4').content.firstH,430);
    testAssert.equal(p2Layout('a4').content.nextH,560);
    testAssert.equal(P2_BODY_FONT,'400 8.5px Arial,sans-serif');
    testAssert.equal(P2_LINK_FONT,'400 7.8px Arial,sans-serif');
    testAssert.equal(p2DpiForQuality('standard'),150);
    testAssert.equal(p2DpiForQuality('high'),300);
    testAssert.deepEqual(p2Transform(),{cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,breakRatios:[],scalePercent:100,align:'center',firstPageOffsetPt:0,cutVersion:0,manualCuts:[]});
    testAssert.equal('dataUrl' in p2Transform({id:'legacy',dataUrl:'data:image/png;base64,x'}),false);
    testAssert.deepEqual(p2Transform({breakRatios:[.5]}).manualCuts,[]);
    testAssert.deepEqual(p2Transform({cutVersion:2,manualCuts:[.7,.3]}).manualCuts,[.3,.7]);
    testAssert.deepEqual(p2ManualCutsForOutput({transform:{breakRatios:[.5]}}),[]);
    testAssert.deepEqual(p2ManualCutsForOutput({transform:{cutVersion:2,manualCuts:[.4]}}),[.4]);
    testAssert.equal(p2Transform({scalePercent:10,align:'free'}).scalePercent,25);
    testAssert.equal(p2Transform({scalePercent:120,align:'right'}).scalePercent,100);
    testAssert.equal(p2Transform({scalePercent:75}).align,'center');
    testAssert.equal(p2Transform({firstPageOffsetPt:24}).firstPageOffsetPt,24);
    testAssert.equal(p2Transform({firstPageOffsetPt:999}).firstPageOffsetPt,200);
    testAssert.equal(p2DrawWidthPt({width:2000},P2_LETTER,{scalePercent:100}),500);
    testAssert.equal(p2DrawWidthPt({width:2000},P2_LETTER,{scalePercent:75}),375);
    testAssert.equal(p2DrawWidthPt({width:2000},P2_LETTER,{scalePercent:50}),250);
    testAssert.equal(p2QualityLevel(p2EffectiveDpi({width:2000},P2_LETTER,{scalePercent:100})),'good');
    testAssert.equal(p2QualityLevel(p2EffectiveDpi({width:800},P2_LETTER,{scalePercent:100})),'warn');
    testAssert.equal(p2QualityLevel(p2EffectiveDpi({width:800},P2_LETTER,{scalePercent:75})),'good');
    testAssert.equal(p2QualityLevel(p2EffectiveDpi({width:400},P2_LETTER,{scalePercent:100})),'bad');
    testAssert.equal(p2SegmentLeft(P2_LETTER,375,'left'),56);
    testAssert.equal(p2SegmentLeft(P2_LETTER,375,'center'),118.5);
    testAssert.equal(p2SegmentLeft(P2_LETTER,375,'right'),181);
    testAssert.equal(p2MaxSegmentPixels({width:1000},430,P2_LETTER,{scalePercent:50})>p2MaxSegmentPixels({width:1000},430,P2_LETTER,{scalePercent:100}),true);
    let drawArgs=[];
    p2DrawSegment({drawImage(...args){drawArgs=args;}},{width:2000},{y:0,height:800},true,1,P2_LETTER,{scalePercent:75,align:'right'});
    testAssert.equal(drawArgs[5],181);
    testAssert.equal(drawArgs[6],184);
    testAssert.equal(drawArgs[7],375);
    p2DrawSegment({drawImage(...args){drawArgs=args;}},{width:2000},{y:0,height:800},true,1,P2_LETTER,{scalePercent:75,align:'right',firstPageOffsetPt:24});
    testAssert.equal(drawArgs[6],208);
    const segmentCanvas={width:1200,height:2400,getContext(){return{getImageData(){throw new Error('no pixels');}}}};
    testAssert.equal(p2AutoSegments(segmentCanvas,true,P2_LETTER,{scalePercent:50}).length<p2AutoSegments(segmentCanvas,true,P2_LETTER,{scalePercent:100}).length,true);
    const fitsFirst={width:1200,height:1000,getContext(){return{getImageData(){throw new Error('no pixels');}}}};
    testAssert.equal(p2PageSegments(fitsFirst,[.5],true,P2_LETTER,{scalePercent:100}).length,1);
    const tinyTail={width:1200,height:1080,getContext(){return{getImageData(){throw new Error('no pixels');}}}};
    const tinyPages=p2PageSegments(tinyTail,[],true,P2_LETTER,{scalePercent:100});
    testAssert.equal(tinyPages.length,2);
    testAssert.equal(tinyPages[1].height*500/1200<=P2_LETTER.content.nextH*.12,true);
    const offsetPages=p2PageSegments(fitsFirst,[],true,P2_LETTER,{scalePercent:100,firstPageOffsetPt:24});
    testAssert.equal(offsetPages.length,2);
    testAssert.equal(offsetPages[0].capacityPt,406);
    const manualPages=p2PageSegments(segmentCanvas,[.3],true,P2_LETTER,{scalePercent:100});
    testAssert.equal(manualPages[0].cutMode,'manual');
    testAssert.equal(manualPages[0].height,720);
    const whiteData=new Array(1200*4).fill(255),whiteCanvas={width:1200,height:2600,getContext(){return{getImageData(){return{data:whiteData};}}}};
    const whitespaceCut=p2PaperBreak(whiteCanvas,0,1032,2600,1344);
    testAssert.equal(whitespaceCut<1032&&whitespaceCut>=1032-Math.round(1032*.04),true);
    testAssert.equal(p2PaperBreak({...whiteCanvas,height:1100},0,1032,1100,1344),1032);
    testAssert.equal(p2PageSegments({width:1200,height:1200,getContext(){return{getImageData(){throw new Error('no pixels');}}}},[],false,P2_LETTER,{scalePercent:100}).length,1);
    testAssert.equal(p2CanVectorText('PUBLICATION: Example - FB'),true);
  `);
});

test('Phase 2 PDF builder keeps header metadata as extractable vector text',async()=>{
  const context=loadPhase2(`
    globalThis.pdfPromise=p2BuildPdfBlob([{
      dataUrl:'data:image/jpeg;base64,/9j/2Q==',width:1,height:1,lossless:false,
      vector:[{text:'PUBLICATION:',x:72,y:106,size:8.5},{text:'Example Media - FB',x:143.5,y:106,size:8.5}]
    }],612,792).then(async pdf=>{
      testAssert.equal(pdf.type,'application/pdf');
      const bytes=new Uint8Array(await pdf.arrayBuffer());
      const source=new TextDecoder('latin1').decode(bytes);
      testAssert.equal(source.startsWith('%PDF-1.4'),true);
      testAssert.equal(source.includes('(PUBLICATION:) Tj'),true);
      testAssert.equal(source.includes('(Example Media - FB) Tj'),true);
    });
  `);
  await context.pdfPromise;
});
