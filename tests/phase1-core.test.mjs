import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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
  const element=new Proxy({
    addEventListener:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    style:{},dataset:{},options:[],value:'',checked:false,appendChild:noop,removeChild:noop,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null
  },{get:(target,key)=>key in target?target[key]:noop});
  const document={
    addEventListener:noop,getElementById:()=>element,querySelector:()=>null,querySelectorAll:()=>[],
    createElement:()=>element
  };
  const context={
    console,URL,Blob,Date,JSON,Map,Set,Math,Number,String,Object,Array,RegExp,TextEncoder,Uint8Array,atob,
    setTimeout,clearTimeout,localStorage:storage(seedLocal),sessionStorage:storage(),document,
    window:{},confirm:()=>false,FileReader:function(){},testAssert:assert
  };
  context.window.window=context.window;
  vm.createContext(context);
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  vm.runInContext(source+'\n'+extra,context,{filename:'app.js'});
}

function loadPhase2(extra=''){
  const noop=()=>{};
  const element=new Proxy({
    addEventListener:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    style:{},dataset:{},options:[],value:'',checked:false,appendChild:noop,removeChild:noop,
    querySelector:()=>null,querySelectorAll:()=>[],closest:()=>null
  },{get:(target,key)=>key in target?target[key]:noop});
  const document={addEventListener:noop,getElementById:()=>element,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>element};
  const context={
    console,URL,Blob,Date,JSON,Map,Set,Math,Number,String,Object,Array,RegExp,TextEncoder,TextDecoder,
    Uint8Array,Uint32Array,DataView,atob,setTimeout,clearTimeout,localStorage:storage(),sessionStorage:storage(),
    document,window:{},confirm:()=>false,FileReader:function(){},testAssert:assert
  };
  context.window.window=context.window;
  vm.createContext(context);
  const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const phase2=fs.readFileSync(new URL('../phase2.js',import.meta.url),'utf8');
  vm.runInContext(app+'\n'+phase2+'\n'+extra,context,{filename:'phase2.js'});
}

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
    testAssert.equal(safeLS.getItem('ck_schema_version'),'4');
    testAssert.equal(safeLS.getItem('ck_entries'),null);
    testAssert.equal(!!safeLS.getItem('ck_backup_pre_v2'),true);
    testAssert.equal(!!safeLS.getItem('ck_backup_pre_v4'),true);
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
    }),'260806_ExampleMedia-BSKY.pdf');
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
    testAssert.equal(p2PublicationDisplay({pub:'Morning News',platform:'TV',duration:'2.29 min'}),'Morning News - TV – 2.29 min');
    testAssert.equal(p2FormatDate('2026-08-13'),'13/08/2026');
    testAssert.equal(P2_LETTER.frame.x,43.5);
    testAssert.equal(P2_LETTER.frame.w,521.85);
    testAssert.deepEqual(P2_LETTER.title,{x:249.65,y:25.8,w:112.7,h:13.56});
    testAssert.equal(P2_LETTER.media.w,128);
    testAssert.equal(P2_LETTER.client.w,128);
    testAssert.equal(P2_LETTER.content.w,468);
    testAssert.equal(p2Layout('a4').pageW,595.28);
    testAssert.equal(p2Layout('a4').pageH,841.89);
    testAssert.equal(p2Layout('a4').frame.w,P2_LETTER.frame.w);
    testAssert.equal(p2Layout('a4').content.w,P2_LETTER.content.w);
    testAssert.equal(P2_BODY_FONT,'400 8.5px Arial,sans-serif');
    testAssert.equal(P2_LINK_FONT,'400 7.8px Arial,sans-serif');
  `);
});
