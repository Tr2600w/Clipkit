/* ClipKit Phase 2 — NEWSCLIPPING Letter templates, assets, proofing and batch output */
'use strict';

const P2_ASSET_DB='clipkit-phase2-assets';
const P2_ASSET_VERSION=2;
const P2_GLOBAL_KEY='ck_phase2_global';
const P2_DEFAULTS={title:'NEWSCLIPPING',prFormat:'number'};
const P2_DEFAULT_NEXT_OFFSET_PT=80;
let p2DbPromise=null;
let p2SelectedIds=new Set();
let p2PreviewEntryId=null,p2PreviewPages=[],p2PreviewReady=false,p2PreviewTimer=null;
let p2EditingImageId=null,p2EditRotation=0,p2EditBreaks=[],p2EditBreaksManual=false,p2EditScale=100,p2EditAlign='center',p2EditOffset=0,p2EditNextOffset=0,p2EditView='layout',p2EditZoom=75,p2EditPreviewMetrics=null,p2EditSourceCanvas=null,p2ApplyAllUndo=null,p2CutUndo=null,p2FitScale=null,p2EditorLayoutTimer=null;
let p2BatchRows=[];
let p2ExportFolderOnce=null;
let p2PreviewSessionLogoId='';
const P2_LETTER={pageW:612,pageH:792,frame:{x:43.5,y:27.05,w:521.85,h:136.45},title:{x:249.65,y:25.8,w:112.7,h:13.56},media:{x:72,y:44,w:128,h:44},client:{x:418.8,y:44,w:128,h:40},footer:{x:261,y:731,w:89.51,h:32.65},content:{x:56,w:500,firstTop:184,nextTop:56,firstH:511,nextH:648}};
const P2_A4={pageW:595.28,pageH:841.89,frame:{x:35.14,y:27.05,w:521.85,h:136.45},title:{x:241.29,y:25.8,w:112.7,h:13.56},media:{x:63.64,y:44,w:128,h:44},client:{x:410.44,y:44,w:128,h:40},footer:{x:252.64,y:780.89,w:89.51,h:32.65},content:{x:47.64,w:500,firstTop:184,nextTop:56,firstH:561,nextH:696}};
const P2_BODY_FONT='400 8.5px Arial,sans-serif';
const P2_LINK_FONT='400 7.8px Arial,sans-serif';
function p2Layout(format){return format==='a4'?P2_A4:P2_LETTER;}
function p2Transform(itemOrTransform={}){const isCapture=itemOrTransform&&typeof itemOrTransform==='object'&&('transform'in itemOrTransform||'dataUrl'in itemOrTransform||'originalDataUrl'in itemOrTransform),value=isCapture?(itemOrTransform.transform||{}):(itemOrTransform||{}),scale=Math.max(25,Math.min(100,Math.round(Number(value.scalePercent)||100))),align=['left','center','right'].includes(value.align)?value.align:'center',firstPageOffsetPt=Math.max(0,Math.min(480,Math.round(Number(value.firstPageOffsetPt)||0))),nextOffsetSource=value.nextPageOffsetPt===undefined?P2_DEFAULT_NEXT_OFFSET_PT:value.nextPageOffsetPt,nextPageOffsetPt=Math.max(0,Math.min(200,Math.round(Number(nextOffsetSource)||0))),cutVersion=Number(value.cutVersion)||0,manualCuts=cutVersion===2&&Array.isArray(value.manualCuts)?value.manualCuts.map(Number).filter(r=>r>.01&&r<.99).sort((a,b)=>a-b):[];return{cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,breakRatios:[],...value,scalePercent:scale,align,firstPageOffsetPt,nextPageOffsetPt,cutVersion,manualCuts};}
function p2ManualCutsForOutput(itemOrTransform){const transform=p2Transform(itemOrTransform);return transform.cutVersion===2?transform.manualCuts:[];}
function p2AlignLabel(value){return value==='left'?'ชิดซ้าย':value==='right'?'ชิดขวา':'กึ่งกลาง';}

function p2OpenDb(){
  if(p2DbPromise)return p2DbPromise;
  p2DbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(P2_ASSET_DB,P2_ASSET_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});
      if(!db.objectStoreNames.contains('mappings'))db.createObjectStore('mappings',{keyPath:'key'});
      if(!db.objectStoreNames.contains('directories'))db.createObjectStore('directories',{keyPath:'key'});
      if(!db.objectStoreNames.contains('history'))db.createObjectStore('history',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('เปิดคลังโลโก้ไม่ได้'));
  });
  return p2DbPromise;
}
function p2Unified(){return typeof ClipKitRepository!=='undefined'&&ClipKitRepository&&ClipKitRepository.assets;}
async function p2BlobDataUrl(blob){
  if(!blob)return null;
  const Reader=typeof FileReader==='function'?FileReader:null;
  if(Reader&&Reader.prototype&&typeof Reader.prototype.readAsDataURL==='function'){
    try{return await new Promise((resolve,reject)=>{const reader=new Reader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('อ่าน Blob ไม่สำเร็จ'));reader.readAsDataURL(blob);});}catch{}
  }
  const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);
  const encode=typeof btoa==='function'?btoa(raw):(typeof Buffer!=='undefined'?Buffer.from(bytes).toString('base64'):'');
  if(!encode)throw new Error('เบราว์เซอร์ไม่รองรับการแปลง Blob เป็น Data URL');
  return'data:'+(blob.type||'application/octet-stream')+';base64,'+encode;
}
async function p2HydrateAsset(record){if(!record)return null;const out={...record};if(!out.dataUrl&&p2Unified())out.dataUrl=await p2BlobDataUrl(await ClipKitRepository.assets.getBlob(out.id));return out;}
async function p2StoreGet(store,key){
  if(p2Unified()&&store==='assets')return p2HydrateAsset(await ClipKitRepository.assets.get(key));
  if(p2Unified()&&store==='directories')return ClipKitRepository.directories.get(key);
  if(p2Unified()&&store==='captures')return ClipKitRepository.captures.get(key);
  const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
}
async function p2StoreAll(store){
  if(p2Unified()&&store==='assets'){const rows=await ClipKitRepository.assets.getAll();return Promise.all(rows.map(p2HydrateAsset));}
  if(p2Unified()&&store==='directories')return ClipKitRepository.directories.getAll();
  if(p2Unified()&&store==='captures')return ClipKitRepository.captures.getAll();
  const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
}
async function p2StorePut(store,value){
  if(p2Unified()&&store==='assets'){
    let input=value;
    if(!value.blob&&!value.originalBlob&&!value.dataUrl&&!value.originalDataUrl&&value.id){
      const blob=await ClipKitRepository.assets.getBlob(value.id);
      if(blob)input={...value,blob};
    }
    const saved=await ClipKitRepository.assets.putOriginal(input);return p2HydrateAsset(saved);
  }
  if(p2Unified()&&store==='directories')return ClipKitRepository.directories.saveProjectConfig(value.projectId||String(value.key||'').replace(/^directory:/,''),value);
  if(p2Unified()&&store==='captures')return ClipKitRepository.captures.saveTransform(value);
  const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readwrite').objectStore(store).put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error);});
}
async function p2StoreDelete(store,key){
  if(p2Unified()&&store==='assets')return ClipKitRepository.assets.delete(key);
  if(p2Unified()&&store==='directories')return ClipKitRepository.directories.delete(key);
  if(p2Unified()&&store==='captures')return ClipKitRepository.captures.delete(key);
  const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readwrite').objectStore(store).delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
}
async function p2StoreClear(store){
  if(p2Unified()&&(store==='assets'||store==='directories'||store==='captures')){for(const row of await p2StoreAll(store))await p2StoreDelete(store,row.id||row.key);return;}
  const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readwrite').objectStore(store).clear();req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
}

function p2Global(){return{...P2_DEFAULTS,...readJSON(P2_GLOBAL_KEY,{})};}
function p2SaveGlobal(value){safeLS.setItem(P2_GLOBAL_KEY,JSON.stringify({...p2Global(),...value}));}
function p2Norm(value){return String(value||'').toLowerCase().normalize('NFKC').replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i,'').replace(/\.(co\.th|com\.th|in\.th|or\.th|com|net|org)$/i,'').replace(/[^a-z0-9ก-๙]+/g,'');}
function p2SafeName(value){return String(value||'Untitled').replace(/[\\/:*?"<>|]/g,'-').replace(/[. ]+$/g,'').trim()||'Untitled';}
function p2PlatformSuffix(platform){const normalized=normPlatform(platform||'');return(!normalized||normalized==='Website'||normalized==='Web')?'':(getPlatformCode(normalized,'file')||normalized);}
function p2PublicationDisplay(entry,publication){
  const pub=String(publication||entry.pub||'').trim();
  const suffix=p2PlatformSuffix(entry.platform);
  let out=suffix?pub+' - '+suffix:pub;
  if(normPlatform(entry.platform)==='TV'&&entry.duration)out+=' - '+entry.duration;
  return out;
}
function p2OutputFileName(entry,publication){
  const base=p2SafeName(buildOutputFileName(entry.date,publication||entry.pub,entry.platform,getActiveProject(),entry.duration)).replace(/\.pdf$/i,'');
  const entryIndex=entries.findIndex(e=>sameEntryId(e.id,entry.id)),peers=entries.filter((e,index)=>index<entryIndex&&e.date===entry.date&&p2Norm(e.pub)===p2Norm(entry.pub)&&e.platform===entry.platform).length;
  return base+(peers?'_'+String(peers+1).padStart(2,'0'):'')+'.pdf';
}
function p2FormatDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(value||'');}
function p2FormatPr(value,format){const n=Number(value)||0,text=n.toLocaleString('en-US');return format==='baht-prefix'?'฿'+text:format==='baht-suffix'?text+' บาท':text;}
function p2MappingKey(pub,platform){return 'media:'+p2Norm(pub)+(platform?'|'+String(platform).toLowerCase():'');}
function p2FileIdentity(name){
  let stem=String(name||'').replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i,'').trim(),platform='';
  const registry=getPlatformRegistry();
  for(const item of registry){
    const codes=[item.fileCode,item.dbCode,item.name,...(item.aliases||[])].filter(Boolean).sort((a,b)=>b.length-a.length);
    const code=codes.find(c=>new RegExp('\\s[-–]\\s'+String(c).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i').test(stem));
    if(code){stem=stem.replace(new RegExp('\\s[-–]\\s'+String(code).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'),'').trim();platform=item.name;break;}
  }
  return{publication:stem,platform};
}
async function p2ImageInfo(dataUrl){try{const img=await loadImageSource(dataUrl);return{width:img.naturalWidth,height:img.naturalHeight};}catch{return{width:0,height:0};}}
async function p2AssetFromFile(file,kind='media'){
  const dataUrl=await fileAsDataURL(file),size=await p2ImageInfo(dataUrl),identity=p2FileIdentity(file.name);
  return{id:'asset-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),name:file.name||'logo',kind,mime:file.type||String(dataUrl).slice(5,String(dataUrl).indexOf(';')),dataUrl,width:size.width,height:size.height,publication:identity.publication,platform:identity.platform,source:file.webkitRelativePath||file.name||'upload',createdAt:new Date().toISOString()};
}
async function p2LogLogoChange(pub,platform,previousAssetId,assetId,scope,entryId=''){
  if(previousAssetId===assetId)return;
  return p2StorePut('history',{id:'history-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),publication:pub,platform:platform||'',previousAssetId:previousAssetId||'',assetId:assetId||'',scope,entryId:entryId||'',projectId:_activeProj,changedAt:new Date().toISOString()});
}
async function p2SetMapping(pub,platform,assetId,confirmed=true,scope='platform'){
  const key=p2MappingKey(pub,platform),previous=await p2StoreGet('mappings',key),updatedAt=new Date().toISOString();
  await p2StorePut('mappings',{key,publication:pub,platform:platform||'',assetId,confirmed,updatedAt});
  const asset=await p2StoreGet('assets',assetId);if(asset)await p2StorePut('assets',{...asset,lastUsedAt:updatedAt,updatedAt});
  await p2LogLogoChange(pub,platform,previous&&previous.assetId,assetId,scope);
}
async function p2FindMediaLogo(entry){
  if(entry.logoLockedAssetId){const locked=await p2StoreGet('assets',entry.logoLockedAssetId);if(locked)return locked;}
  if(p2PreviewEntryId===entry.id&&p2PreviewSessionLogoId){const session=await p2StoreGet('assets',p2PreviewSessionLogoId);if(session)return session;}
  const specific=await p2StoreGet('mappings',p2MappingKey(entry.pub,entry.platform));
  if(specific){const asset=await p2StoreGet('assets',specific.assetId);if(asset)return asset;}
  const generic=await p2StoreGet('mappings',p2MappingKey(entry.pub,''));
  if(generic){const asset=await p2StoreGet('assets',generic.assetId);if(asset)return asset;}
  const assets=await p2StoreAll('assets');
  const logoFile=String(entry.logoFile||'');
  let asset=assets.find(a=>a.kind==='media'&&logoFile&&a.name.toLowerCase()===logoFile.toLowerCase());
  if(asset)return asset;
  asset=assets.filter(a=>a.kind==='media'&&p2Norm(a.publication||a.name)===p2Norm(entry.pub)&&(!a.platform||a.platform===entry.platform)).sort((a,b)=>String(b.lastUsedAt||b.createdAt).localeCompare(String(a.lastUsedAt||a.createdAt)))[0];
  if(asset)return asset;
  return null;
}
async function p2GetProjectAsset(project,kind){
  // Preview/editor can be opened before a project row is hydrated (for
  // example after clearing browser storage). Treat that as an empty project
  // instead of dereferencing a missing logo setting.
  project=project||{};
  let id='';
  if(kind==='client')id=project.clientLogoAssetId||'';
  else if(project.agencyLogoMode==='asset')id=project.agencyLogoAssetId||'';
  else if(project.agencyLogoMode!=='none')id=p2Global().agencyLogoAssetId||'';
  if(id)return p2StoreGet('assets',id);
  // If a project setting was not persisted (for example after a storage
  // migration), recover the most recently uploaded project logo so the
  // settings panel does not appear empty immediately after upload.
  if(kind==='client'){
    const recent=(await p2StoreAll('assets')).filter(asset=>asset.kind==='client').sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))[0];
    return recent||null;
  }
  return null;
}

async function importLogoFolder(event){
  const files=[...(event.target.files||[])].filter(f=>String(f.type||'').startsWith('image/')||/\.(jpe?g|png|webp|gif|svg)$/i.test(f.name));event.target.value='';
  if(!files.length){toast('ไม่พบไฟล์ภาพในโฟลเดอร์','err');return;}
  const summary=document.getElementById('logoLibrarySummary');let imported=0,matched=0;
  for(const file of files){
    if(summary)summary.textContent='กำลังนำเข้า '+(imported+1)+'/'+files.length;
    try{
      const asset=await p2AssetFromFile(file,'media');await p2StorePut('assets',asset);imported++;
      const candidates=DB.filter(d=>p2Norm(d.pub)===p2Norm(asset.publication));
      const exact=asset.platform?candidates.find(d=>d.platform===asset.platform):candidates[0];
      if(exact){await p2SetMapping(exact.pub,asset.platform||'',asset.id,true);matched++;}
    }catch(err){console.warn('[ClipKit] ข้ามโลโก้',file.name,err);}
  }
  if(summary)summary.textContent=imported+' โลโก้ · จับคู่ตรง '+matched+' รายการ';
  toast('✓ นำเข้า '+imported+' โลโก้แล้ว','ok');renderLogoManager();
}
async function uploadProjectAsset(event,kind){
  const file=event.target.files&&event.target.files[0];event.target.value='';if(!file)return;
  try{
    const asset=await p2AssetFromFile(file,kind);const saved=await p2StorePut('assets',asset);const persisted=saved||asset;
    if(kind==='agency'&&!p2Global().agencyLogoAssetId)p2SaveGlobal({agencyLogoAssetId:asset.id});
    const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);
    if(idx>=0){if(kind==='client')projects[idx].clientLogoAssetId=persisted.id;else{projects[idx].agencyLogoAssetId=persisted.id;projects[idx].agencyLogoMode='asset';}saveProjectList(projects);}
    const preview=document.getElementById(kind==='client'?'cfgClientLogoPreview':'cfgAgencyLogoPreview');
    if(preview&&persisted.dataUrl)preview.innerHTML='<img src="'+escAttr(persisted.dataUrl)+'" alt="โลโก้">';
    await p2PopulateSettings();toast('✓ บันทึกโลโก้แล้ว','ok');
  }catch(err){toast(err.message,'err');}
}

const p2BaseOpenSettings=openSettings;
openSettings=function(){p2BaseOpenSettings();p2PopulateSettings();};
async function p2PopulateSettings(){
  const project=getActiveProject(),global=p2Global(),title=document.getElementById('cfgNewsTitle'),pr=document.getElementById('cfgPrFormat');
  if(title)title.value=project.newsTitleOverride||global.title||'NEWSCLIPPING';if(pr)pr.value=project.prFormat||global.prFormat||'number';
  const client=await p2GetProjectAsset(project,'client'),preview=document.getElementById('cfgClientLogoPreview');
  if(preview)preview.innerHTML=client?'<img src="'+escAttr(client.dataUrl)+'" alt="โลโก้ลูกค้า">':'ยังไม่มี';
  const assets=(await p2StoreAll('assets')).filter(a=>a.kind==='agency'),select=document.getElementById('cfgAgencyLogoSelect');
  if(select){select.innerHTML='<option value="none">ไม่แสดง</option><option value="global">ใช้ค่าเริ่มต้นบริษัท</option>'+assets.map(a=>'<option value="'+escAttr(a.id)+'">'+esc(a.name)+'</option>').join('');select.value=project.agencyLogoMode==='none'?'none':project.agencyLogoMode==='asset'&&project.agencyLogoAssetId?project.agencyLogoAssetId:'global';}
  const transparent=document.getElementById('cfgLogoTransparent');if(transparent)transparent.checked=Boolean(project.logoWhiteTransparent);
  const duplicate=document.getElementById('cfgDuplicateMode');if(duplicate)duplicate.value=project.duplicateMode||'suffix';
  const folderTitle=document.getElementById('cfgOutputFolderTitle');if(folderTitle)folderTitle.textContent=_activeProj===DEFAULT_PROJ?'โฟลเดอร์ปลายทางค่าเริ่มต้นระบบ':'โฟลเดอร์ปลายทางของโปรเจกต์';
  const folders={pdf:false,excel:false,backup:false,...(project.separateOutputFolders||{})};
  [['cfgSeparatePdf','pdf'],['cfgSeparateExcel','excel'],['cfgSeparateBackup','backup']].forEach(([id,key])=>{const field=document.getElementById(id);if(field)field.checked=Boolean(folders[key]);});
  await previewAgencySelection();
  const media=(await p2StoreAll('assets')).filter(a=>a.kind==='media'),summary=document.getElementById('logoLibrarySummary');if(summary)summary.textContent=media.length?media.length+' โลโก้ใน DB':'ยังไม่ได้นำเข้าโฟลเดอร์';
  await p2RefreshFolderStatus();
}
const p2BaseSaveSettings=saveSettings;
saveSettings=function(){
  const title=(document.getElementById('cfgNewsTitle').value||'NEWSCLIPPING').trim()||'NEWSCLIPPING',prFormat=document.getElementById('cfgPrFormat').value||'number',agency=document.getElementById('cfgAgencyLogoSelect').value||'none',logoWhiteTransparent=document.getElementById('cfgLogoTransparent').checked,duplicateMode=(document.getElementById('cfgDuplicateMode')||{}).value||'suffix',separateOutputFolders={pdf:Boolean((document.getElementById('cfgSeparatePdf')||{}).checked),excel:Boolean((document.getElementById('cfgSeparateExcel')||{}).checked),backup:Boolean((document.getElementById('cfgSeparateBackup')||{}).checked)};
  p2BaseSaveSettings();
  const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);
  if(idx>=0){
    const isSystemProject=_activeProj===DEFAULT_PROJ;
    if(isSystemProject)p2SaveGlobal({title,prFormat});
    projects[idx]={...projects[idx],newsTitleOverride:isSystemProject?'':title,prFormat,logoWhiteTransparent,duplicateMode,separateOutputFolders,agencyLogoMode:agency==='none'?'none':agency==='global'?'global':'asset',agencyLogoAssetId:agency!=='none'&&agency!=='global'?agency:projects[idx].agencyLogoAssetId||''};saveProjectList(projects);
  }
};

function p2DirectoryKey(projectId=_activeProj){return'directory:'+(projectId===DEFAULT_PROJ?'global':projectId);}
async function getCaptureRecord(projectId,entryId){
  if(!p2Unified())return window.getCaptureRecord?window.getCaptureRecord(projectId,entryId):{key:projectId+':'+entryId,projectId,entryId,images:[]};
  const rows=await ClipKitRepository.captures.listByEntry(entryId),record=rows.find(row=>row.projectId===projectId)||rows[0];
  if(!record)return{key:projectId+':'+entryId,projectId,entryId,images:[]};
  const images=await Promise.all((record.images||[]).map(async image=>{const out={...image};if(image.assetId){const asset=await ClipKitRepository.assets.get(image.assetId),blob=await ClipKitRepository.assets.getBlob(image.assetId);if(asset){out.originalDataUrl=image.sourceOriginalDataUrl||await p2BlobDataUrl(blob);out.dataUrl=out.dataUrl||image.previewDataUrl||out.originalDataUrl;out.type=out.type||asset.mime;out.mime=out.mime||asset.mime;}}return out;}));
  return{...record,key:record.key||projectId+':'+entryId,projectId,entryId,images};
}
async function saveCaptureRecord(projectId,entryId,images){
  if(!p2Unified())return window.saveCaptureRecord?window.saveCaptureRecord(projectId,entryId,images):null;
  // A transformed capture must be stored as a new asset. Reusing the old
  // asset id makes the transactional repository reject the new bytes.
  const storedImages=(images||[]).map(image=>{
    const next={...image,previewDataUrl:image.dataUrl,sourceOriginalDataUrl:image.originalDataUrl};
    if(next.assetId){next.id=String(next.id||'capture')+'-edit-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);delete next.assetId;}
    return next;
  });
  return ClipKitRepository.captures.saveTransform({id:projectId+':'+entryId,key:projectId+':'+entryId,projectId,entryId,images:storedImages});
}
async function p2ChooseProjectFolder(){
  if(!window.showDirectoryPicker){toast('เบราว์เซอร์นี้ยังเลือกโฟลเดอร์ปลายทางไม่ได้ · จะใช้ Download ปกติ','err');return;}
  try{const handle=await window.showDirectoryPicker({mode:'readwrite'});await p2StorePut('directories',{key:p2DirectoryKey(),handle,name:handle.name,updatedAt:new Date().toISOString()});const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].outputFolderName=handle.name;saveProjectList(projects);}await p2RefreshFolderStatus();toast('✓ ตั้งโฟลเดอร์ '+handle.name+(_activeProj===DEFAULT_PROJ?' เป็นค่าเริ่มต้นระบบแล้ว':' สำหรับโปรเจกต์นี้แล้ว'),'ok');}catch(err){if(err&&err.name!=='AbortError')toast('เลือกโฟลเดอร์ไม่สำเร็จ: '+err.message,'err');}
}
async function p2ClearProjectFolder(){await p2StoreDelete('directories',p2DirectoryKey());const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].outputFolderName='';saveProjectList(projects);}await p2RefreshFolderStatus();toast('กลับไปใช้ Download ปกติแล้ว','ok');}
async function p2RefreshFolderStatus(){
  const el=document.getElementById('cfgOutputFolderStatus');if(!el)return;el.dataset.source='';let row=await p2StoreGet('directories',p2DirectoryKey());
  if(!window.showDirectoryPicker){el.textContent='เบราว์เซอร์ไม่รองรับ · ใช้ Download ปกติ';el.dataset.state='unsupported';return;}
  if(!row||!row.handle){const fallback=_activeProj===DEFAULT_PROJ?null:await p2StoreGet('directories',p2DirectoryKey(DEFAULT_PROJ));if(!fallback||!fallback.handle){el.textContent='ยังไม่ได้เลือก · ใช้ Download ปกติ';el.dataset.state='empty';return;}row=fallback;el.dataset.source='global';}
  let permission='prompt';try{permission=await row.handle.queryPermission({mode:'readwrite'});}catch{}
  el.textContent=(el.dataset.source==='global'?'ใช้ค่าเริ่มต้นระบบ · ':'')+(permission==='granted'?'พร้อมบันทึก: ':'ต้องอนุญาตอีกครั้ง: ')+(row.name||row.handle.name||'โฟลเดอร์');el.dataset.state=permission;
}
async function p2ChooseExportFolderOnce(){
  if(!window.showDirectoryPicker){toast('เบราว์เซอร์นี้ยังไม่รองรับ · จะใช้ Download ปกติ','err');return null;}
  try{p2ExportFolderOnce=await window.showDirectoryPicker({mode:'readwrite'});toast('✓ Export รอบนี้ไปที่ '+p2ExportFolderOnce.name,'ok');return p2ExportFolderOnce;}catch(err){if(err&&err.name!=='AbortError')toast(err.message,'err');return null;}
}
async function p2WritableDirectory(requestPermission=true){
  let handle=p2ExportFolderOnce;if(!handle){let row=await p2StoreGet('directories',p2DirectoryKey());if((!row||!row.handle)&&_activeProj!==DEFAULT_PROJ)row=await p2StoreGet('directories',p2DirectoryKey(DEFAULT_PROJ));handle=row&&row.handle;}
  if(!handle)return null;
  try{let permission=await handle.queryPermission({mode:'readwrite'});if(permission!=='granted'&&requestPermission)permission=await handle.requestPermission({mode:'readwrite'});return permission==='granted'?handle:null;}catch{return null;}
}
async function p2UniqueFileName(directory,fileName,mode){
  if(mode==='overwrite')return fileName;
  const exists=async name=>{try{await directory.getFileHandle(name);return true;}catch{return false;}};
  if(!await exists(fileName))return fileName;
  if(mode==='ask'&&confirm('มีไฟล์ '+fileName+' อยู่แล้ว\nกด OK เพื่อเขียนทับ หรือ Cancel เพื่อเติมเลขต่อท้าย'))return fileName;
  const dot=fileName.lastIndexOf('.'),base=dot>0?fileName.slice(0,dot):fileName,ext=dot>0?fileName.slice(dot):'';let n=2,candidate='';do{candidate=base+'_'+String(n++).padStart(2,'0')+ext;}while(await exists(candidate));return candidate;
}
async function p2WriteBlob(directory,blob,fileName){const handle=await directory.getFileHandle(fileName,{create:true}),writer=await handle.createWritable();await writer.write(blob);await writer.close();return fileName;}
async function p2SaveBlob(blob,fileName,category='pdf',options={}){
  let directory=options.directory||await p2WritableDirectory(true);const project=getActiveProject(),separate={pdf:false,excel:false,backup:false,...(project.separateOutputFolders||{})};
  if(directory&&separate[category])directory=await directory.getDirectoryHandle(category==='pdf'?'PDF':category==='excel'?'Excel':'Backup',{create:true});
  if(directory){const resolved=await p2UniqueFileName(directory,fileName,project.duplicateMode||'suffix');await p2WriteBlob(directory,blob,resolved);return{mode:'directory',fileName:resolved,directory:directory.name};}
  downloadLocalBlob(blob,fileName);return{mode:'download',fileName};
}
async function previewAgencySelection(){
  const select=document.getElementById('cfgAgencyLogoSelect'),preview=document.getElementById('cfgAgencyLogoPreview');if(!select||!preview)return;
  const id=select.value==='global'?p2Global().agencyLogoAssetId:select.value==='none'?'':select.value,asset=id?await p2StoreGet('assets',id):null;
  preview.innerHTML=asset?'<img src="'+escAttr(asset.dataUrl)+'" alt="โลโก้บริษัท">':'ยังไม่มีโลโก้บริษัท';
}
async function clearProjectAsset(kind){
  const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx<0)return;
  if(kind==='client')projects[idx].clientLogoAssetId='';else{projects[idx].agencyLogoMode='none';projects[idx].agencyLogoAssetId='';}
  saveProjectList(projects);await p2PopulateSettings();toast(kind==='client'?'นำโลโก้ลูกค้าออกแล้ว':'ปิดโลโก้บริษัทสำหรับโปรเจกต์นี้แล้ว','ok');
}
async function setAgencyAsGlobal(){
  const select=document.getElementById('cfgAgencyLogoSelect'),id=select&&select.value!=='none'&&select.value!=='global'?select.value:'';
  if(!id){toast('เลือกหรือเพิ่มโลโก้บริษัทก่อน','err');return;}p2SaveGlobal({agencyLogoAssetId:id});toast('✓ ตั้งเป็นโลโก้บริษัทค่าเริ่มต้นแล้ว','ok');await p2PopulateSettings();
}

function toggleBatchRow(id,checked){const key=String(id);if(checked)p2SelectedIds.add(key);else p2SelectedIds.delete(key);p2SyncSelection();}
function toggleAllBatchRows(checked){document.querySelectorAll('.batch-row-check').forEach(cb=>{cb.checked=checked;toggleBatchRow(cb.value,checked);});}
function p2SyncSelection(){
  document.querySelectorAll('.batch-row-check').forEach(cb=>cb.checked=p2SelectedIds.has(String(cb.value)));
  const count=document.getElementById('batchSelectedCount'),btn=document.getElementById('batchPdfBtn');if(count)count.textContent=p2SelectedIds.size;if(btn)btn.disabled=!p2SelectedIds.size;
  const all=document.getElementById('batchSelectAll'),boxes=[...document.querySelectorAll('.batch-row-check')];if(all){all.checked=boxes.length>0&&boxes.every(cb=>cb.checked);all.indeterminate=boxes.some(cb=>cb.checked)&&!all.checked;}
}
const p2BaseRenderTable=renderTable;
renderTable=function(){p2BaseRenderTable();requestAnimationFrame(p2SyncSelection);};

async function openLogoManager(){
  const modal=document.getElementById('logoManagerModal');if(!modal)return;modal.style.display='flex';
  const platform=document.getElementById('logoManagerPlatform'),formPlatform=document.getElementById('logoFormPlatform');if(platform)platform.innerHTML='<option value="">ทุก Platform</option>'+platformOptions('',true);if(formPlatform)formPlatform.innerHTML=platformOptions('',true);
  const entry=entries.find(e=>e.id===(p2PreviewEntryId||_captureEntryId));
  const pub=entry&&entry.pub||(document.getElementById('fPub')||{}).value||'',plat=entry&&entry.platform||(document.getElementById('fPlat')||{}).value||'Website',pr=entry&&entry.prValue||(document.getElementById('fPR')||{}).value||150000;
  const search=document.getElementById('logoManagerSearch');if(search&&pub)search.value=pub;
  document.getElementById('logoFormPublication').value=pub;document.getElementById('logoFormPlatform').value=normPlatform(plat)||'Website';document.getElementById('logoFormPrValue').value=Number(pr)||150000;
  await renderLogoManager();
}
function closeLogoManager(){const modal=document.getElementById('logoManagerModal');if(modal)modal.style.display='none';}
async function renderLogoManager(){
  const grid=document.getElementById('logoManagerGrid');if(!grid)return;grid.innerHTML='<div class="logo-empty">กำลังเปิดคลังโลโก้…</div>';
  const q=p2Norm((document.getElementById('logoManagerSearch')||{}).value||''),platform=(document.getElementById('logoManagerPlatform')||{}).value||'';
  const mappings=await p2StoreAll('mappings'),mappingByAsset=new Map();mappings.forEach(m=>{if(!mappingByAsset.has(m.assetId))mappingByAsset.set(m.assetId,[]);mappingByAsset.get(m.assetId).push(m);});
  let assets=(await p2StoreAll('assets')).filter(a=>a.kind==='media').map(a=>({...a,_score:q?Math.max(similarity(q,p2Norm(a.publication)),similarity(q,p2Norm(a.name))):1,_mappings:mappingByAsset.get(a.id)||[]}));
  if(q)assets=assets.filter(a=>p2Norm(a.name).includes(q)||p2Norm(a.publication).includes(q)||a._score>=.34);if(platform)assets=assets.filter(a=>!a.platform||a.platform===platform);
  assets.sort((a,b)=>q&&b._score!==a._score?b._score-a._score:String(b.lastUsedAt||b.createdAt).localeCompare(String(a.lastUsedAt||a.createdAt))||String(a.publication||a.name).localeCompare(String(b.publication||b.name),'th')).splice(160);
  if(!assets.length){grid.innerHTML='<div class="logo-empty">ยังไม่มีโลโก้ที่ตรงกัน · เพิ่มไฟล์จากแผงด้านซ้ายได้ทันที</div>';return;}
  const current=entries.find(e=>e.id===(p2PreviewEntryId||_captureEntryId));
  grid.innerHTML=assets.map(a=>{const badges=[];if(a._mappings.some(m=>!m.platform))badges.push('Default สื่อ');if(a._mappings.some(m=>m.platform))badges.push('Default Platform');if(current&&current.logoLockedAssetId===a.id)badges.push('ล็อกกับข่าว');if(current&&current.logoAssetId===a.id)badges.push('กำลังใช้');return '<article class="logo-card"><div class="logo-card-badges">'+badges.map(b=>'<i>'+esc(b)+'</i>').join('')+'</div><img src="'+escAttr(a.dataUrl)+'" alt="'+escAttr(a.name)+'"><strong>'+esc(a.publication||a.name)+'</strong><span>'+esc(a.name)+(a.platform?' · '+esc(a.platform):' · โลโก้หลัก')+'</span><span title="'+escAttr(a.source||'')+'">'+esc(a.source||'upload')+' · '+(a.lastUsedAt?'ใช้ล่าสุด '+new Date(a.lastUsedAt).toLocaleDateString('th-TH'):'เพิ่ม '+new Date(a.createdAt).toLocaleDateString('th-TH'))+'</span><div class="logo-card-actions"><button type="button" onclick="useLogoAsset(\''+escAttr(a.id)+'\',\'platform\')">ใช้ + Platform</button><button type="button" onclick="useLogoAsset(\''+escAttr(a.id)+'\',\'main\')">ตั้งเป็นหลัก</button><button type="button" onclick="useLogoAsset(\''+escAttr(a.id)+'\',\'session\')">รอบนี้</button><button type="button" onclick="useLogoAsset(\''+escAttr(a.id)+'\',\'lock\')">ล็อกข่าว</button><button class="danger" type="button" onclick="p2DeleteLogoAsset(\''+escAttr(a.id)+'\')">ลบ</button></div></article>';}).join('');
}
async function useLogoAsset(assetId,mode='platform'){
  const asset=await p2StoreGet('assets',assetId);if(!asset)return;
  const entry=entries.find(e=>e.id===(_captureEntryId||p2PreviewEntryId));
  const pub=entry?entry.pub:asset.publication,platform=entry?entry.platform:(asset.platform||'');
  if(!pub){toast('ไม่พบชื่อสื่อสำหรับผูกโลโก้','err');return;}
  if(mode==='session'){if(!p2PreviewEntryId){toast('ตัวเลือกเฉพาะรอบนี้ใช้ได้จาก Preview','err');return;}p2PreviewSessionLogoId=asset.id;}
  else if(mode==='lock'){
    if(!entry){toast('เปิดจากรายการข่าวก่อนจึงจะล็อกโลโก้ได้','err');return;}const previous=entry.logoLockedAssetId||'';entry.logoLockedAssetId=asset.id;await p2LogLogoChange(pub,platform,previous,asset.id,'entry-lock',entry.id);
  }else await p2SetMapping(pub,mode==='main'?'':platform,asset.id,true,mode);
  if(entry){entry.logoFile=asset.name;entry.logoAssetId=asset.id;entry.updatedAt=new Date().toISOString();saveProjEntries(_activeProj,entries);}
  toast(mode==='session'?'✓ ใช้โลโก้นี้เฉพาะ Export รอบนี้':'✓ บันทึกโลโก้ '+pub+(mode==='main'?' · โลโก้หลัก':platform?' · '+platform:''),'ok');closeLogoManager();
  if(p2PreviewEntryId){await p2RenderPdfPreview();}renderTable();
}
async function p2CreateMediaWithLogo(){
  const pub=(document.getElementById('logoFormPublication').value||'').trim(),platform=document.getElementById('logoFormPlatform').value||'',prValue=Number(document.getElementById('logoFormPrValue').value),file=document.getElementById('logoFormFile').files[0],scope=document.getElementById('logoFormScope').value||'platform';
  if(!pub||!platform||!Number.isFinite(prValue)||prValue<=0){toast('กรอก Publication, Platform และ PR Value ให้ครบ','err');return;}
  const previous=getCustom();let asset=null,mappingKey='',previousMapping=null;try{
    saveToCustom(pub,platform,prValue);
    if(file){asset=await p2AssetFromFile(file,'media');asset.publication=pub;asset.platform=scope==='main'?'':platform;await p2StorePut('assets',asset);mappingKey=p2MappingKey(pub,scope==='main'?'':platform);previousMapping=await p2StoreGet('mappings',mappingKey);await p2SetMapping(pub,scope==='main'?'':platform,asset.id,true,scope);}
    document.getElementById('logoFormFile').value='';renderRecent();renderDB();await renderLogoManager();toast(file?'✓ เพิ่มสื่อและโลโก้แล้ว':'✓ เพิ่มสื่อแล้ว · เพิ่มโลโก้ก่อน Export','ok');
  }catch(err){saveCustom(previous);rebuildDB();if(mappingKey){if(previousMapping)await p2StorePut('mappings',previousMapping).catch(()=>{});else await p2StoreDelete('mappings',mappingKey).catch(()=>{});}if(asset){await p2StoreDelete('assets',asset.id).catch(()=>{});const history=await p2StoreAll('history').catch(()=>[]);for(const row of history.filter(row=>row.assetId===asset.id))await p2StoreDelete('history',row.id).catch(()=>{});}toast('บันทึกไม่สำเร็จ: '+err.message,'err');}
}
async function p2UploadLogoForContext(event){
  const file=event.target.files&&event.target.files[0];event.target.value='';if(!file)return;
  const entry=entries.find(e=>e.id===(p2PreviewEntryId||_captureEntryId)),pub=entry&&entry.pub||(document.getElementById('logoFormPublication').value||'').trim(),platform=entry&&entry.platform||document.getElementById('logoFormPlatform').value||'';
  if(!pub||!platform){toast('ระบุ Publication และ Platform ก่อน','err');return;}
  try{const asset=await p2AssetFromFile(file,'media');asset.publication=pub;asset.platform=platform;await p2StorePut('assets',asset);await renderLogoManager();toast('✓ เพิ่มโลโก้เข้าคลังแล้ว · กด “ใช้ + Platform” เพื่อบันทึกเป็น Default','ok');}catch(err){toast(err.message,'err');}
}
async function p2DeleteLogoAsset(assetId){
  const allMappings=await p2StoreAll('mappings'),mapped=allMappings.filter(m=>m.assetId===assetId),locked=[];getAllProjects().forEach(project=>getProjEntries(project.id).forEach(entry=>{if(entry.logoLockedAssetId===assetId)locked.push(project.name+' / '+entry.pub);}));
  if(mapped.length||locked.length){toast('ลบไม่ได้ · โลโก้นี้ยังเป็น Default '+mapped.length+' รายการ และล็อกกับข่าว '+locked.length+' รายการ','err');return;}
  if(!confirm('ลบไฟล์โลโก้นี้ออกจากคลัง?'))return;await p2StoreDelete('assets',assetId);await renderLogoManager();toast('ลบโลโก้แล้ว','ok');
}
async function toggleEntryLogoLock(){
  const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;
  const previous=entry.logoLockedAssetId||'';if(entry.logoLockedAssetId)entry.logoLockedAssetId='';
  else{const asset=await p2FindMediaLogo({...entry,logoLockedAssetId:''});if(!asset){toast('ยังไม่มีโลโก้ให้ล็อก','err');return;}entry.logoLockedAssetId=asset.id;}
  await p2LogLogoChange(entry.pub,entry.platform,previous,entry.logoLockedAssetId,'entry-lock',entry.id);entry.updatedAt=new Date().toISOString();saveProjEntries(_activeProj,entries);await p2RenderPdfPreview();
  toast(entry.logoLockedAssetId?'✓ ล็อกโลโก้สำหรับข่าวนี้แล้ว':'✓ ใช้โลโก้ล่าสุดจาก Media DB แล้ว','ok');
}

const p2BasePrepareCaptureFile=prepareCaptureFile;
prepareCaptureFile=async function(file){
  const item=await p2BasePrepareCaptureFile(file);
  try{item.originalDataUrl=await fileAsDataURL(file);}catch{item.originalDataUrl=item.dataUrl;}
  // A freshly reset browser can have no project row yet. Capture import must
  // still succeed and use the same neutral defaults as a normal project.
  const project=typeof getActiveProject==='function'?(getActiveProject()||{}):{};
  const preset=project.captureLayoutDefault||{};item.transform=p2Transform({...preset,cutVersion:2,manualCuts:[]});
  return item;
};
const p2BaseOpenCapture=openCapture;
openCapture=async function(entryId){
  await p2BaseOpenCapture(entryId);
  const entry=entryById(entryId);if(!entry)return;
  const project=getActiveProject(),template=document.getElementById('captureTemplate');if(template)template.value=project.pdfTemplate||'news';
  const quality=document.getElementById('captureQuality');if(quality)quality.value=project.pdfQuality||'standard';
  const file=document.getElementById('captureFileName');if(file)file.textContent=p2OutputFileName(entry);
  renderCaptureImages();
};
const p2BaseCloseCapture=closeCapture;
closeCapture=function(){p2ApplyAllUndo=null;p2BaseCloseCapture();};
renderCaptureImages=function(){
  const list=document.getElementById('captureList'),empty=document.getElementById('captureEmpty'),count=document.getElementById('captureCount');if(!list||!empty||!count)return;
  count.textContent=_captureImages.length+' ภาพ';empty.style.display=_captureImages.length?'none':'flex';
  list.innerHTML=_captureImages.map((img,i)=>'<article class="capture-card"><div class="capture-order">'+String(i+1).padStart(2,'0')+'</div><img src="'+escAttr(img.dataUrl)+'" alt="ภาพแคป '+(i+1)+'"><div class="capture-card-meta"><strong>'+esc(img.name)+'</strong><span>'+img.width+' × '+img.height+' px'+((img.transform&&img.transform.rotation)?' · หมุน '+img.transform.rotation+'°':'')+'</span><span class="capture-scale-meta" id="captureScaleMeta'+escAttr(img.id)+'">กำลังคำนวณขนาด…</span></div><div class="capture-card-actions"><button type="button" class="edit-image" onclick="openImageEditor(\''+img.id+'\')" title="ครอป หมุน ย่อขนาด และแบ่งหน้า">ปรับภาพ</button><button type="button" onclick="moveCaptureImage(\''+img.id+'\',-1)" '+(i===0?'disabled':'')+' title="เลื่อนขึ้น">↑</button><button type="button" onclick="moveCaptureImage(\''+img.id+'\',1)" '+(i===_captureImages.length-1?'disabled':'')+' title="เลื่อนลง">↓</button><button type="button" class="danger" onclick="removeCaptureImage(\''+img.id+'\')" title="ลบภาพ">×</button></div></article>').join('');
  const button=document.getElementById('captureExportBtn');if(button)button.disabled=!_captureImages.length;
  p2UpdateCaptureMetrics();
};

async function p2UpdateCaptureMetrics(){
  const format=((document.getElementById('captureTemplate')||{}).value||'news')==='standard'?'a4':'letter',layout=p2Layout(format);
  await Promise.all(_captureImages.map(async item=>{const el=document.getElementById('captureScaleMeta'+item.id);if(!el)return;try{const size=await p2ProcessedSize(item),transform=p2Transform(item),width=p2DrawWidthPt(size,layout,transform),dpi=p2EffectiveDpi(size,layout,transform);el.textContent=transform.scalePercent+'% · '+Math.round(width)+' pt · '+p2AlignLabel(transform.align)+(transform.firstPageOffsetPt?' · Y +'+transform.firstPageOffsetPt+' pt':'')+' · '+dpi+' DPI';el.dataset.level=p2QualityLevel(dpi);}catch{el.textContent='ไม่สามารถคำนวณขนาดได้';}}));
}

async function p2ProcessedSize(item){const source=await loadImageSource(item.originalDataUrl||item.dataUrl),t=p2Transform(item),sx=Math.round(source.naturalWidth*t.cropLeft/100),sy=Math.round(source.naturalHeight*t.cropTop/100),sw=Math.max(1,source.naturalWidth-sx-Math.round(source.naturalWidth*t.cropRight/100)),sh=Math.max(1,source.naturalHeight-sy-Math.round(source.naturalHeight*t.cropBottom/100)),rot=((Number(t.rotation)||0)%360+360)%360,swap=rot===90||rot===270;return{width:swap?sh:sw,height:swap?sw:sh};}

async function p2ProcessedCanvas(item,scale=1){
  const source=await loadImageSource(item.originalDataUrl||item.dataUrl),t={cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,...(item.transform||{})};
  const sx=Math.round(source.naturalWidth*t.cropLeft/100),sy=Math.round(source.naturalHeight*t.cropTop/100),sw=Math.max(1,source.naturalWidth-sx-Math.round(source.naturalWidth*t.cropRight/100)),sh=Math.max(1,source.naturalHeight-sy-Math.round(source.naturalHeight*t.cropBottom/100));
  const rot=((Number(t.rotation)||0)%360+360)%360,swap=rot===90||rot===270,canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((swap?sh:sw)*scale));canvas.height=Math.max(1,Math.round((swap?sw:sh)*scale));
  const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rot*Math.PI/180);ctx.drawImage(source,sx,sy,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);return canvas;
}
async function openImageEditor(id){
  const item=_captureImages.find(img=>img.id===id);if(!item)return;p2EditingImageId=id;
  const raw=item.transform||{},t=p2Transform(item),legacyCuts=t.cutVersion!==2&&Array.isArray(raw.breakRatios)?raw.breakRatios.map(Number).filter(r=>r>.01&&r<.99):[];p2EditRotation=t.rotation||0;p2EditBreaks=t.cutVersion===2?[...t.manualCuts]:[];p2EditBreaksManual=p2EditBreaks.length>0;p2EditScale=t.scalePercent;p2EditAlign=t.align;p2EditOffset=t.firstPageOffsetPt;p2EditNextOffset=t.nextPageOffsetPt;p2EditView='layout';p2ApplyAllUndo=null;p2CutUndo=legacyCuts.length?{cuts:legacyCuts,reason:'legacy'}:null;p2FitScale=null;
  ['Left','Right','Top','Bottom'].forEach(k=>document.getElementById('crop'+k).value=t['crop'+k]||0);
  const index=_captureImages.findIndex(img=>img.id===id),meta=document.getElementById('imageEditorMeta');if(meta)meta.textContent='Capture '+(index+1)+' / '+_captureImages.length+' · '+(item.name||'ภาพข่าว');p2SyncScaleControls();p2SyncOffsetControls();setEditorView('layout');setEditorZoom(p2EditZoom);document.getElementById('undoScaleAllBtn').hidden=true;document.getElementById('undoPageCutsBtn').hidden=!p2CutUndo;
  document.getElementById('imageEditModal').style.display='flex';await updateImageEditPreview();
}
function closeImageEditor(){if(p2ApplyAllUndo)for(const old of p2ApplyAllUndo){const item=_captureImages.find(row=>row.id===old.id);if(item)item.transform=old.transform;}clearTimeout(p2EditorLayoutTimer);p2ApplyAllUndo=null;p2CutUndo=null;document.getElementById('imageEditModal').style.display='none';p2EditingImageId=null;p2EditPreviewMetrics=null;p2EditSourceCanvas=null;renderCaptureImages();}
function p2ClampScale(value){return Math.max(25,Math.min(100,Math.round(Number(value)||100)));}
function p2SyncScaleControls(){const range=document.getElementById('imageScaleRange'),number=document.getElementById('imageScalePercent');if(range)range.value=p2EditScale;if(number)number.value=p2EditScale;['left','center','right'].forEach(value=>{const button=document.getElementById('imageAlign'+value[0].toUpperCase()+value.slice(1));if(button)button.classList.toggle('active',p2EditAlign===value);});p2UpdateEditorScaleLayout();}
function p2SyncOffsetControls(){const range=document.getElementById('imageOffsetRange'),number=document.getElementById('imageOffsetPt'),summary=document.getElementById('imageOffsetSummary'),nextRange=document.getElementById('imageNextOffsetRange'),nextNumber=document.getElementById('imageNextOffsetPt'),nextSummary=document.getElementById('imageNextOffsetSummary');if(range)range.value=p2EditOffset;if(number)number.value=p2EditOffset;if(summary)summary.textContent='Y +'+p2EditOffset+' pt';if(nextRange)nextRange.value=p2EditNextOffset;if(nextNumber)nextNumber.value=p2EditNextOffset;if(nextSummary)nextSummary.textContent='Y +'+p2EditNextOffset+' pt';}
function p2RememberCutUndo(reason='geometry'){if(p2EditBreaks.length&&!p2CutUndo)p2CutUndo={cuts:[...p2EditBreaks],reason};const button=document.getElementById('undoPageCutsBtn');if(button)button.hidden=!p2CutUndo;}
function p2InvalidatePageCuts(reason='geometry'){p2RememberCutUndo(reason);p2EditBreaks=[];p2EditBreaksManual=false;}
function setEditedScale(value){const next=p2ClampScale(value);if(next!==p2EditScale)p2InvalidatePageCuts('scale');p2EditScale=next;p2SyncScaleControls();p2QueueEditorLayoutRender();}
function setEditedAlignment(value){p2EditAlign=['left','center','right'].includes(value)?value:'center';p2SyncScaleControls();p2QueueEditorLayoutRender();}
function p2MaxFirstOffsetPt(){return 480;}
function setEditedOffset(value,render=true){const next=Math.max(0,Math.min(p2MaxFirstOffsetPt(),Math.round(Number(value)||0)));if(next!==p2EditOffset)p2InvalidatePageCuts('offset');p2EditOffset=next;p2SyncOffsetControls();const marker=document.getElementById('editorOffsetMarker'),layout=p2CurrentEditorLayout();if(marker)marker.style.top=(p2EditOffset/layout.content.firstH*100)+'%';if(render)p2QueueEditorLayoutRender();}
function setEditedNextOffset(value,render=true){const next=Math.max(0,Math.min(200,Math.round(Number(value)||0)));if(next!==p2EditNextOffset)p2InvalidatePageCuts('next-offset');p2EditNextOffset=next;p2SyncOffsetControls();if(render)p2QueueEditorLayoutRender();}
function setEditorView(view){p2EditView=view==='source'?'source':'layout';const layout=document.getElementById('editorLayoutViewport'),source=document.getElementById('editorSourceViewport');if(layout)layout.hidden=p2EditView!=='layout';if(source)source.hidden=p2EditView!=='source';document.querySelectorAll('.editor-view-switch button').forEach(button=>button.classList.toggle('active',button.dataset.view===p2EditView));if(p2EditView==='layout')p2QueueEditorLayoutRender(0);}
function setEditorZoom(value){p2EditZoom=Math.max(40,Math.min(130,Math.round(Number(value)||75)));const list=document.getElementById('imageEditorPageList'),output=document.getElementById('editorZoomValue');if(list)list.style.setProperty('--editor-zoom',p2EditZoom/100);if(output)output.textContent=p2EditZoom+'%';}
function adjustEditorZoom(delta){setEditorZoom(p2EditZoom+delta);}
function p2CurrentEditorTransform(){return p2Transform({cropLeft:Number(document.getElementById('cropLeft').value),cropRight:Number(document.getElementById('cropRight').value),cropTop:Number(document.getElementById('cropTop').value),cropBottom:Number(document.getElementById('cropBottom').value),rotation:p2EditRotation,breakRatios:[],cutVersion:2,manualCuts:p2EditBreaksManual?p2EditBreaks:[],scalePercent:p2EditScale,align:p2EditAlign,firstPageOffsetPt:p2EditOffset,nextPageOffsetPt:p2EditNextOffset});}
function p2UpdateEditorScaleLayout(){
  const wrapper=document.getElementById('imageScaledPreview'),summary=document.getElementById('imageScaleSummary'),warning=document.getElementById('imageScaleWarning');if(!wrapper||!p2EditPreviewMetrics)return;
  const width=p2EditPreviewMetrics.baseWidth*p2EditScale/100,dpi=Math.round(p2EditPreviewMetrics.pixelWidth/width*72),percent=Math.max(1,Math.min(100,width/500*100));wrapper.style.width=percent+'%';wrapper.style.marginLeft=p2EditAlign==='right'?'auto':p2EditAlign==='center'?'auto':'0';wrapper.style.marginRight=p2EditAlign==='left'?'auto':p2EditAlign==='center'?'auto':'0';wrapper.dataset.align=p2EditAlign;summary.textContent=p2EditScale+'% · '+Math.round(width)+' pt · '+dpi+' DPI';summary.dataset.level=p2QualityLevel(dpi);const quality=document.getElementById('imageEditorQuality');if(quality){quality.dataset.level=p2QualityLevel(dpi);quality.textContent=Math.round(width)+' pt · '+dpi+' DPI · '+(dpi>=150?'คมชัด':dpi>=100?'อาจอ่านยาก':'ความละเอียดต่ำ');}warning.textContent=p2EditScale<50?'ภาพคมชัด แต่ขนาดตัวหนังสืออาจเล็กเกินไป':'';warning.hidden=p2EditScale>=50;const img=document.getElementById('imageEditorPreview');if(img&&img.complete)p2RenderPageOverlay(img);
}
async function updateImageEditPreview(){
  const item=_captureImages.find(img=>img.id===p2EditingImageId);if(!item)return;
  const transform=p2CurrentEditorTransform(),temp={...item,transform},source=await p2ProcessedCanvas(temp,1),preview=document.createElement('canvas');preview.width=Math.max(1,Math.round(source.width*.45));preview.height=Math.max(1,Math.round(source.height*.45));preview.getContext('2d').drawImage(source,0,0,preview.width,preview.height);const format=((document.getElementById('captureTemplate')||{}).value||'news')==='standard'?'a4':'letter',layout=p2Layout(format),img=document.getElementById('imageEditorPreview');p2EditSourceCanvas=source;p2EditPreviewMetrics={pixelWidth:source.width,pixelHeight:source.height,baseWidth:p2BaseDrawWidthPt(source,layout)};img.src=preview.toDataURL('image/png');img.onload=()=>{p2UpdateEditorScaleLayout();p2RenderPageOverlay(img);p2QueueEditorLayoutRender(0);};
}
function updateImageGeometry(){p2InvalidatePageCuts('geometry');updateImageEditPreview();}
function rotateEditedImage(delta){p2InvalidatePageCuts('rotation');p2EditRotation=(p2EditRotation+delta+360)%360;updateImageEditPreview();}
function resetEditedImage(){p2InvalidatePageCuts('reset');p2EditRotation=0;p2EditBreaks=[];p2EditBreaksManual=false;p2EditScale=100;p2EditAlign='center';p2EditOffset=0;p2EditNextOffset=P2_DEFAULT_NEXT_OFFSET_PT;['Left','Right','Top','Bottom'].forEach(k=>document.getElementById('crop'+k).value=0);p2SyncScaleControls();p2SyncOffsetControls();updateImageEditPreview();}
function p2QueueEditorLayoutRender(delay=180){clearTimeout(p2EditorLayoutTimer);if(p2EditView!=='layout'||!p2EditingImageId)return;p2EditorLayoutTimer=setTimeout(p2RenderEditorLayoutPreview,delay);}
async function p2RenderEditorLayoutPreview(){
  const list=document.getElementById('imageEditorPageList'),item=_captureImages.find(img=>img.id===p2EditingImageId),entry=entries.find(row=>row.id===_captureEntryId);if(!list||!item||!entry)return;list.classList.add('busy');
  try{const transform=p2CurrentEditorTransform(),captureIndex=_captureImages.findIndex(img=>img.id===p2EditingImageId),temp={...item,transform,__p2FirstHasHeader:captureIndex===0},template=((document.getElementById('captureTemplate')||{}).value||'news'),values={publication:entry.pub,date:entry.date,link:entry.url,prValue:entry.prValue,duration:entry.duration||''},result=template==='standard'?await p2GenerateStandardPages(entry,[temp],'standard',true):await p2GeneratePages(entry,[temp],values,'standard',true),layout=p2Layout(template==='standard'?'a4':'letter');list.innerHTML=result.pages.map((page,i)=>'<article class="editor-proof-page" style="aspect-ratio:'+layout.pageW+'/'+layout.pageH+'"><img src="'+escAttr(page.dataUrl)+'" alt="ตัวอย่างหน้าที่ '+(i+1)+'">'+(i===0&&captureIndex===0?'<div class="editor-placement-rail" style="left:'+((layout.content.x-12)/layout.pageW*100)+'%;top:'+(layout.content.firstTop/layout.pageH*100)+'%;height:'+(layout.content.firstH/layout.pageH*100)+'%"><span>Y</span><button id="editorOffsetMarker" type="button" style="top:'+(p2EditOffset/layout.content.firstH*100)+'%" onpointerdown="startEditorOffsetDrag(event)" aria-label="เลื่อนภาพแนวตั้ง">'+p2EditOffset+'</button></div>':'')+'<b>หน้า '+(i+1)+'</b></article>').join('');}
  catch(err){list.innerHTML='<div class="editor-preview-error">สร้างตัวอย่างไม่สำเร็จ · '+esc(err.message)+'</div>';}
  finally{list.classList.remove('busy');setEditorZoom(p2EditZoom);}
}
function p2CurrentEditorLayout(){const format=((document.getElementById('captureTemplate')||{}).value||'news')==='standard'?'a4':'letter';return p2Layout(format);}
function startEditorOffsetDrag(event){const marker=event.currentTarget,rail=marker.parentElement,layout=p2CurrentEditorLayout();marker.setPointerCapture(event.pointerId);marker.onpointermove=move=>{if(!marker.hasPointerCapture(move.pointerId))return;const rect=rail.getBoundingClientRect(),value=Math.max(0,Math.min(p2MaxFirstOffsetPt(),Math.round((move.clientY-rect.top)/rect.height*layout.content.firstH)));setEditedOffset(value,false);marker.textContent=value;};marker.onpointerup=()=>p2QueueEditorLayoutRender(0);}
function saveEditorLayoutDefault(){const projects=getAllProjects(),idx=projects.findIndex(project=>project.id===_activeProj);if(idx<0)return;projects[idx]={...projects[idx],captureLayoutDefault:{scalePercent:p2EditScale,align:p2EditAlign,firstPageOffsetPt:p2EditOffset,nextPageOffsetPt:p2EditNextOffset}};saveProjectList(projects);toast('✓ บันทึกขนาดและตำแหน่งเป็นค่าเริ่มต้นของโปรเจกต์แล้ว','ok');}
function p2RenderPageOverlay(img){
  const layer=document.getElementById('imageBreakLayer');if(!layer||!p2EditSourceCanvas)return;const format=(document.getElementById('captureTemplate').value||'news')==='standard'?'a4':'letter',layout=p2Layout(format),firstCapture=_captureImages.findIndex(item=>item.id===p2EditingImageId)===0,transform=p2CurrentEditorTransform(),segments=p2PageSegments(p2EditSourceCanvas,p2EditBreaksManual?p2EditBreaks:[],firstCapture,layout,transform),total=p2EditSourceCanvas.height;
  layer.innerHTML=segments.map((segment,i)=>'<div class="paper-page-band '+(i%2?'even':'odd')+'" style="top:'+(segment.y/total*100).toFixed(3)+'%;height:'+(segment.height/total*100).toFixed(3)+'%"><span>หน้า '+(i+1)+' · '+segment.capacityPt+' pt</span><em>พื้นที่โลโก้บริษัท</em></div>'+(i<segments.length-1?'<div class="page-break-handle '+segment.cutMode+'" data-page-index="'+i+'" style="top:'+((segment.y+segment.height)/total*100).toFixed(3)+'%"><b>'+(segment.cutMode==='manual'?'Manual cut':'Auto cut')+' · หน้า '+(i+1)+'</b></div>':'')).join('');
  layer.querySelectorAll('.page-break-handle').forEach(handle=>{const pageIndex=Number(handle.dataset.pageIndex),segment=segments[pageIndex];handle.onpointerdown=event=>{event.preventDefault();p2RememberCutUndo('manual');handle.setPointerCapture(event.pointerId);};handle.onpointermove=event=>{if(!handle.hasPointerCapture(event.pointerId))return;const rect=img.getBoundingClientRect(),raw=(event.clientY-rect.top)/rect.height,min=(segment.y+Math.max(10,segment.capacityPx*.1))/total,max=segment.maxEnd/total,ratio=Math.max(min,Math.min(max,raw));p2EditBreaks=p2EditBreaks.filter(value=>value<segment.y/total-.001);p2EditBreaks.push(ratio);p2EditBreaksManual=true;handle.className='page-break-handle manual';handle.style.top=(ratio*100).toFixed(3)+'%';handle.querySelector('b').textContent='Manual cut · หน้า '+(pageIndex+1);};handle.onpointerup=()=>p2RenderPageOverlay(img);});
  p2UpdateTailWarning(segments,layout,firstCapture,transform);
}
function p2UpdateTailWarning(segments,layout,firstCapture,transform){const box=document.getElementById('pageTailWarning'),button=document.getElementById('fitOnePageBtn');if(!box||!button||!p2EditSourceCanvas)return;const t=p2Transform(transform),drawWidth=p2DrawWidthPt(p2EditSourceCanvas,layout,t),last=segments[segments.length-1],lastPt=last?last.height*drawWidth/p2EditSourceCanvas.width:0,nextAvailable=Math.max(1,layout.content.nextH-t.nextPageOffsetPt),tiny=segments.length>1&&lastPt<=nextAvailable*p2TinyTailRatio(),manual=segments.some(segment=>segment.cutMode==='manual'),baseHeight=p2EditSourceCanvas.height*p2BaseDrawWidthPt(p2EditSourceCanvas,layout)/p2EditSourceCanvas.width,available=firstCapture?Math.max(1,layout.content.firstH-t.firstPageOffsetPt):nextAvailable,needed=Math.floor(available/baseHeight*100);p2FitScale=needed>=25&&needed<p2EditScale?needed:null;box.hidden=!tiny;if(tiny)box.textContent=(manual?'Manual cut ทำให้':'ภาพนี้ทำให้')+'หน้าสุดท้ายเหลือเพียง '+Math.round(lastPt)+' pt';button.hidden=!tiny;button.disabled=!p2FitScale;button.textContent=p2FitScale?'ย่อให้พอดีหน้าเดียว · '+p2FitScale+'%':'ไม่สามารถย่อให้พอดีหน้าเดียวได้ (ต่ำกว่า 25%)';}
function fitEditedImageToOnePage(){if(!p2FitScale)return;if(!confirm('ปรับ Scale จาก '+p2EditScale+'% เป็น '+p2FitScale+'% เพื่อให้พอดีหน้าเดียว?'))return;setEditedScale(p2FitScale);toast('ปรับเป็น '+p2EditScale+'% แล้ว · กดบันทึกการปรับภาพเพื่อยืนยัน','ok');}
function undoPageCutReset(){if(!p2CutUndo)return;p2EditBreaks=[...p2CutUndo.cuts];p2EditBreaksManual=p2EditBreaks.length>0;p2CutUndo=null;document.getElementById('undoPageCutsBtn').hidden=true;const img=document.getElementById('imageEditorPreview');if(img)p2RenderPageOverlay(img);toast('นำเส้นแบ่งหน้าเดิมกลับมาแล้ว','ok');}
function applyScaleToAllCaptures(){
  if(_captureImages.length<2){toast('รายการนี้มี Capture เพียงภาพเดียว','err');return;}if(!confirm('ใช้ '+p2EditScale+'% · '+p2AlignLabel(p2EditAlign)+' กับ Capture ทั้ง '+_captureImages.length+' ภาพ?\nCrop และ Rotation จะไม่เปลี่ยน · เส้นแบ่งหน้าจะคำนวณใหม่เมื่อ Scale เปลี่ยน'))return;
  p2ApplyAllUndo=_captureImages.map(item=>({id:item.id,transform:{...(item.transform||{}),breakRatios:[...((item.transform&&item.transform.breakRatios)||[])],manualCuts:[...((item.transform&&item.transform.manualCuts)||[])]}}));for(const item of _captureImages){const t=p2Transform(item),scaleChanged=t.scalePercent!==p2EditScale;item.transform={...t,scalePercent:p2EditScale,align:p2EditAlign,breakRatios:[],cutVersion:2,manualCuts:scaleChanged?[]:t.manualCuts};}document.getElementById('undoScaleAllBtn').hidden=false;renderCaptureImages();toast('ใช้ขนาดกับ '+_captureImages.length+' Capture แล้ว · กดบันทึกเพื่อยืนยัน','ok');
}
function undoApplyScaleAll(){if(!p2ApplyAllUndo)return;for(const old of p2ApplyAllUndo){const item=_captureImages.find(row=>row.id===old.id);if(item)item.transform=old.transform;}const current=_captureImages.find(row=>row.id===p2EditingImageId),t=p2Transform(current);p2EditScale=t.scalePercent;p2EditAlign=t.align;p2ApplyAllUndo=null;document.getElementById('undoScaleAllBtn').hidden=true;p2SyncScaleControls();renderCaptureImages();toast('ย้อนกลับการใช้ขนาดกับทุกภาพแล้ว','ok');}
async function saveImageEdits(){
  const item=_captureImages.find(img=>img.id===p2EditingImageId);if(!item)return;
  try{
    item.transform=p2CurrentEditorTransform();
    const preview=await p2ProcessedCanvas(item,.7);item.dataUrl=preview.toDataURL('image/png');item.type='image/png';item.width=preview.width;item.height=preview.height;await persistCaptureImages();p2ApplyAllUndo=null;p2CutUndo=null;document.getElementById('imageEditModal').style.display='none';p2EditingImageId=null;p2EditPreviewMetrics=null;p2EditSourceCanvas=null;renderCaptureImages();toast('✓ บันทึกการปรับภาพแล้ว','ok');
  }catch(err){
    const message=err&&err.message?err.message:'บันทึกการปรับภาพไม่สำเร็จ';
    toast(message,'err');
    const list=document.getElementById('imageEditorPageList');if(list)list.insertAdjacentHTML('afterbegin','<div class="editor-preview-error">บันทึกไม่สำเร็จ · '+esc(message)+'</div>');
  }
}

function p2Canvas(scale,layout=P2_LETTER){const canvas=document.createElement('canvas');canvas.width=Math.round(layout.pageW*scale);canvas.height=Math.round(layout.pageH*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);return{canvas,ctx};}
function p2DrawSpaced(ctx,text,x,y,spacing){for(const char of String(text||'')){ctx.fillText(char,x,y);x+=ctx.measureText(char).width+spacing;}}
function p2WrapChars(ctx,text,maxWidth,maxLines=3){
  const value=String(text||''),lines=[];let line='';
  for(const char of value){const next=line+char;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=char;if(lines.length>=maxLines)break;}else line=next;}
  if(line&&lines.length<maxLines)lines.push(line);if(lines.length===maxLines&&lines.join('').length<value.length)lines[maxLines-1]=lines[maxLines-1].replace(/…?$/,'…');return lines;
}
async function p2DrawAsset(ctx,asset,x,y,w,h,align='center',transparent=false){
  if(!asset||!asset.dataUrl)return;try{
    const img=await loadImageSource(asset.dataUrl);let source=img;
    if(transparent){const cut=document.createElement('canvas');cut.width=img.naturalWidth;cut.height=img.naturalHeight;const c=cut.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const pixels=c.getImageData(0,0,cut.width,cut.height),d=pixels.data;for(let i=0;i<d.length;i+=4){const min=Math.min(d[i],d[i+1],d[i+2]),max=Math.max(d[i],d[i+1],d[i+2]);if(min>225&&max-min<22)d[i+3]=Math.max(0,Math.round(255-(min-225)*8.5));}c.putImageData(pixels,0,0);source=cut;}
    const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height,ratio=Math.min(w/sw,h/sh),dw=sw*ratio,dh=sh*ratio,dx=align==='left'?x:align==='right'?x+w-dw:x+(w-dw)/2;ctx.drawImage(source,dx,y+(h-dh)/2,dw,dh);
  }catch(err){console.warn('[ClipKit] วาดโลโก้ไม่ได้',err);}
}
async function p2DrawFooter(ctx,agency,transparent=false,layout=P2_LETTER){if(!agency)return;const f=layout.footer;await p2DrawAsset(ctx,agency,f.x,f.y,f.w,f.h,'center',transparent);}
function p2CanVectorText(value){return /^[\x20-\x7e]*$/.test(String(value||''));}
function p2HeaderVectors(ctx,entry,values,project,layout=P2_LETTER){
  const L=layout,dx=L.frame.x-P2_LETTER.frame.x,labelX=72+dx;ctx.font=P2_BODY_FONT;const dataX=Math.max(143.5+dx,labelX+ctx.measureText('PUBLICATION:').width+14),prLabelX=396+dx,prDataX=Math.max(468.4+dx,prLabelX+ctx.measureText('PR VALUE:').width+14),publication=p2PublicationDisplay(entry,values.publication),items=[
    {text:'PUBLICATION:',x:labelX,y:106,size:8.5},{text:'DATE:',x:labelX,y:121.5,size:8.5},{text:'LINK:',x:labelX,y:137.5,size:8.5},{text:'PR VALUE:',x:prLabelX,y:106,size:8.5},
    {text:publication,x:dataX,y:106,size:8.5},{text:p2FormatDate(values.date),x:dataX,y:121.5,size:8.5},{text:p2FormatPr(values.prValue,project.prFormat||'number'),x:prDataX,y:106,size:8.5}
  ];
  ctx.font=P2_LINK_FONT;p2WrapChars(ctx,values.link,L.frame.x+L.frame.w-14-dataX,2).forEach((line,i)=>items.push({text:line,x:dataX,y:137.5+i*9,size:7.8}));return items;
}
async function p2DrawHeader(ctx,entry,values,assets,project,layout=P2_LETTER,drawText=true){
  const L=layout,t=L.title,dx=L.frame.x-P2_LETTER.frame.x,transparent=Boolean(project.logoWhiteTransparent);ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.strokeRect(L.frame.x,L.frame.y,L.frame.w,L.frame.h);
  const title=project.newsTitleOverride||p2Global().title||'NEWSCLIPPING';ctx.fillStyle='#050505';ctx.fillRect(t.x,t.y,t.w,t.h);ctx.fillStyle='#fff';ctx.font='700 11.04px "Century Gothic",Arial,sans-serif';const titleSpacing=2.2,textWidth=[...title].reduce((s,c)=>s+ctx.measureText(c).width+titleSpacing,0)-titleSpacing,p2TitleX=t.x+(t.w-textWidth)/2;p2DrawSpaced(ctx,title,p2TitleX,t.y+10.9,titleSpacing);
  await p2DrawAsset(ctx,assets.media,L.media.x,L.media.y,L.media.w,L.media.h,'left',transparent);await p2DrawAsset(ctx,assets.client,L.client.x,L.client.y,L.client.w,L.client.h,'right',transparent);
  const vectors=p2HeaderVectors(ctx,entry,values,project,L);ctx.fillStyle='#111';for(const item of vectors){if(drawText||!p2CanVectorText(item.text)){ctx.font='400 '+item.size+'px Arial,sans-serif';ctx.fillText(item.text,item.x,item.y);}}ctx.restore();return vectors.filter(item=>p2CanVectorText(item.text));
}
function p2TailPixels(remaining,nextCapacity){if(remaining<=0)return 0;const value=remaining%nextCapacity;return value<1?nextCapacity:value;}
function p2TinyTailRatio(){return .3;}
function p2PaperBreak(canvas,start,capacity,maxY,nextCapacity){
  const ideal=Math.min(maxY,start+capacity);if(ideal>=maxY-1)return maxY;const tinyTailLimit=nextCapacity*p2TinyTailRatio(),idealTail=p2TailPixels(maxY-ideal,nextCapacity);if(idealTail<=tinyTailLimit)return ideal;const range=Math.max(4,Math.round(capacity*.02)),from=Math.max(start+10,ideal-range),step=Math.max(2,Math.floor(range/28)),ctx=canvas.getContext('2d');let best=ideal,bestScore=0;
  try{for(let y=from;y<ideal;y+=step){const data=ctx.getImageData(0,y,canvas.width,1).data;let white=0,count=0;for(let x=0;x<data.length;x+=64){count++;if(data[x]>242&&data[x+1]>242&&data[x+2]>242)white++;}const ratio=count?white/count:0,score=ratio-(ideal-y)/range*.08;if(ratio>=.93&&score>bestScore){bestScore=score;best=y;}}}catch{return ideal;}
  const candidateTail=p2TailPixels(maxY-best,nextCapacity);if(best<ideal&&candidateTail<=tinyTailLimit)return ideal;return best;
}
function p2DpiForQuality(quality){return quality==='high'?300:150;}
function p2BaseDrawWidthPt(canvas,layout){return Math.min(layout.content.w,canvas.width*72/96);}
function p2DrawWidthPt(canvas,layout,transform){return p2BaseDrawWidthPt(canvas,layout)*p2Transform(transform).scalePercent/100;}
function p2MaxSegmentPixels(canvas,maxPt,layout,transform){return Math.max(1,Math.floor(maxPt*canvas.width/p2DrawWidthPt(canvas,layout,transform)));}
function p2EffectiveDpi(canvas,layout,transform){return Math.round(canvas.width/p2DrawWidthPt(canvas,layout,transform)*72);}
function p2QualityLevel(dpi){return dpi>=150?'good':dpi>=100?'warn':'bad';}
function p2PageCapacityPt(page,firstHasHeader,layout,transform){const t=p2Transform(transform);return firstHasHeader&&page===0?Math.max(1,layout.content.firstH-t.firstPageOffsetPt):Math.max(1,layout.content.nextH-t.nextPageOffsetPt);}
function p2PageSegments(canvas,manualRatios=[],firstHasHeader=true,layout=P2_LETTER,transform={}){const t=p2Transform(transform),points=(manualRatios||[]).filter(r=>r>.01&&r<.99).sort((a,b)=>a-b).map(r=>Math.round(r*canvas.height)),segments=[];let y=0,page=0;while(y<canvas.height){const capacityPt=p2PageCapacityPt(page,firstHasHeader,layout,t),capacityPx=p2MaxSegmentPixels(canvas,capacityPt,layout,t),maxEnd=Math.min(canvas.height,y+capacityPx);if(maxEnd>=canvas.height){segments.push({y,height:canvas.height-y,capacityPt,capacityPx,maxEnd:canvas.height,cutMode:'end'});break;}const nextCapacityPt=p2PageCapacityPt(page+1,firstHasHeader,layout,t),manual=points.find(point=>point>y+10&&point<=maxEnd),end=manual||p2PaperBreak(canvas,y,capacityPx,canvas.height,p2MaxSegmentPixels(canvas,nextCapacityPt,layout,t));segments.push({y,height:Math.max(1,end-y),capacityPt,capacityPx,maxEnd,cutMode:manual?'manual':'auto'});y=Math.max(y+1,end);page++;}return segments;}
function p2AutoSegments(canvas,firstHasHeader,layout=P2_LETTER,transform={}){return p2PageSegments(canvas,[],firstHasHeader,layout,transform);}
function p2ManualSegments(canvas,ratios,firstHasHeader,layout=P2_LETTER,transform={}){return p2PageSegments(canvas,ratios,firstHasHeader,layout,transform);}
function p2SegmentLeft(layout,drawWidth,align='center'){return align==='left'?layout.content.x:align==='right'?layout.content.x+layout.content.w-drawWidth:layout.content.x+(layout.content.w-drawWidth)/2;}
function p2DrawSegment(ctx,source,segment,hasHeader,scale,layout=P2_LETTER,transform={}){
  const L=layout.content,t=p2Transform(transform),top=hasHeader?L.firstTop+t.firstPageOffsetPt:L.nextTop+t.nextPageOffsetPt,drawW=p2DrawWidthPt(source,layout,t),drawH=segment.height*drawW/source.width;
  ctx.drawImage(source,0,segment.y,source.width,segment.height,p2SegmentLeft(layout,drawW,t.align),top,drawW,drawH);
}
async function p2GeneratePages(entry,images,values,quality='standard',preview=false,format='letter'){
  const project=typeof getActiveProject==='function'?(getActiveProject()||{}):{},layout=p2Layout(format),scale=preview?2:p2DpiForQuality(quality)/72,media=await p2FindMediaLogo(entry),client=await p2GetProjectAsset(project,'client'),agency=await p2GetProjectAsset(project,'agency'),assets={media,client,agency},pages=[],qualityRows=[];
  for(let imageIndex=0;imageIndex<images.length;imageIndex++){
    const item=images[imageIndex],firstHasHeader=item.__p2FirstHasHeader!==undefined?Boolean(item.__p2FirstHasHeader):imageIndex===0,transform=p2Transform(item),source=await p2ProcessedCanvas(item,1),manual=p2ManualCutsForOutput(item),segments=p2PageSegments(source,manual,firstHasHeader,layout,transform),widthPt=p2DrawWidthPt(source,layout,transform),dpi=p2EffectiveDpi(source,layout,transform),last=segments[segments.length-1],lastPt=last?last.height*widthPt/source.width:0,nextTailLimit=Math.max(1,layout.content.nextH-transform.nextPageOffsetPt)*p2TinyTailRatio();qualityRows.push({name:item.name||'Capture '+(imageIndex+1),dpi,widthPt:Math.round(widthPt),scalePercent:transform.scalePercent,align:transform.align,level:p2QualityLevel(dpi),readabilityWarning:transform.scalePercent<50,pageCount:segments.length,tinyTail:segments.length>1&&lastPt<=nextTailLimit});
    for(let segmentIndex=0;segmentIndex<segments.length;segmentIndex++){
      const hasHeader=firstHasHeader&&segmentIndex===0,{canvas,ctx}=p2Canvas(scale,layout);let vector=[];if(hasHeader)vector=await p2DrawHeader(ctx,entry,values,assets,project,layout,false);p2DrawSegment(ctx,source,segments[segmentIndex],hasHeader,scale,layout,transform);await p2DrawFooter(ctx,agency,Boolean(project.logoWhiteTransparent),layout);const lossless=quality==='high'||/image\/(png|webp|svg)/i.test(item.type||String(item.originalDataUrl||'').slice(5,30));pages.push({dataUrl:canvas.toDataURL(lossless?'image/png':'image/jpeg',quality==='high'?.96:.92),width:canvas.width,height:canvas.height,canvas,vector,lossless});
    }
  }
  const estimate=pages.reduce((sum,page)=>sum+Math.round((String(page.dataUrl).length*3)/4),0);return{pages,mediaLogo:media,assets,qualityRows,estimatedBytes:estimate};
}

async function p2GenerateStandardPages(entry,images,quality='standard',preview=false){
  const values={publication:entry.pub,date:entry.date,link:entry.link||entry.url,prValue:entry.prValue,duration:entry.duration||''};return p2GeneratePages(entry,images,values,quality,preview,'a4');
}

function p2PdfLiteral(value){return'('+String(value||'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')';}
async function p2DeflateRgb(canvas){
  if(!window.CompressionStream)return null;const rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data,rgb=new Uint8Array(canvas.width*canvas.height*3);for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}
  const stream=new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function p2PdfPageImage(page){
  if(page.lossless&&page.canvas){const bytes=await p2DeflateRgb(page.canvas);if(bytes)return{bytes,filter:'FlateDecode',width:page.canvas.width,height:page.canvas.height};}
  const dataUrl=page.canvas?page.canvas.toDataURL('image/jpeg',page.lossless?.98:.96):page.dataUrl;return{bytes:dataUrlBinary(dataUrl),filter:'DCTDecode',width:page.width,height:page.height};
}
async function p2BuildPdfBlob(pages,pageWidth,pageHeight){
  if(!pages.length)throw new Error('ไม่มีหน้าสำหรับ PDF');const objectCount=4+pages.length*3,objects=new Array(objectCount+1),kids=[];objects[1]=pdfTextBytes('<< /Type /Catalog /Pages 2 0 R >>');objects[3]=pdfTextBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');objects[4]=pdfTextBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  for(let index=0;index<pages.length;index++){
    const page=pages[index],pageObj=5+index*3,contentObj=pageObj+1,imageObj=pageObj+2,image=await p2PdfPageImage(page);kids.push(pageObj+' 0 R');let command='q\n'+pageWidth.toFixed(3)+' 0 0 '+pageHeight.toFixed(3)+' 0 0 cm\n/Im'+index+' Do\nQ\n';
    for(const item of page.vector||[]){if(!p2CanVectorText(item.text))continue;command+='BT\n/F1 '+Number(item.size||8.5).toFixed(2)+' Tf\n1 0 0 1 '+Number(item.x).toFixed(2)+' '+(pageHeight-Number(item.y)).toFixed(2)+' Tm\n'+p2PdfLiteral(item.text)+' Tj\nET\n';}
    const commandBytes=pdfTextBytes(command);objects[pageObj]=pdfTextBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im'+index+' '+imageObj+' 0 R >> >> /Contents '+contentObj+' 0 R >>');objects[contentObj]=joinByteArrays([pdfTextBytes('<< /Length '+commandBytes.length+' >>\nstream\n'),commandBytes,pdfTextBytes('endstream')]);objects[imageObj]=joinByteArrays([pdfTextBytes('<< /Type /XObject /Subtype /Image /Width '+image.width+' /Height '+image.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /'+image.filter+' /Length '+image.bytes.length+' >>\nstream\n'),image.bytes,pdfTextBytes('\nendstream')]);
  }
  objects[2]=pdfTextBytes('<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages.length+' >>');const chunks=[new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10])],offsets=new Array(objectCount+1).fill(0);let length=chunks[0].length;for(let i=1;i<=objectCount;i++){offsets[i]=length;const chunk=joinByteArrays([pdfTextBytes(i+' 0 obj\n'),objects[i],pdfTextBytes('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;}const xrefOffset=length;let xref='xref\n0 '+(objectCount+1)+'\n0000000000 65535 f \n';for(let i=1;i<=objectCount;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';chunks.push(pdfTextBytes(xref+'trailer\n<< /Size '+(objectCount+1)+' /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF'));return new Blob(chunks,{type:'application/pdf'});
}
function p2VectorSvg(page,layout){if(!page.vector||!page.vector.length)return'';return'<svg class="pdf-vector-layer" viewBox="0 0 '+layout.pageW+' '+layout.pageH+'" aria-hidden="true">'+page.vector.map(item=>'<text x="'+item.x+'" y="'+item.y+'" font-family="Arial, sans-serif" font-size="'+item.size+'" font-weight="400">'+esc(item.text)+'</text>').join('')+'</svg>';}
function p2FormatBytes(bytes){const value=Number(bytes)||0;return value>=1048576?(value/1048576).toFixed(1)+' MB':Math.max(1,Math.round(value/1024))+' KB';}

exportCapturePDF=async function(){
  if(!_captureEntryId||!_captureImages.length)return;await openPdfPreview(_captureEntryId);
};
async function openPdfPreview(entryId,fromBatch=false){
  const entry=entryById(entryId);if(!entry)return;
  if(_captureEntryId!==entry.id){const record=await getCaptureRecord(_activeProj,entry.id);_captureImages=Array.isArray(record.images)?record.images:[];}
  p2PreviewEntryId=entry.id;p2PreviewSessionLogoId='';document.getElementById('pdfPreviewModal').style.display='flex';
  document.getElementById('previewPublication').value=entry.pub||'';document.getElementById('previewDate').value=entry.date||'';document.getElementById('previewLink').value=entry.url||'';document.getElementById('previewPrValue').value=entry.prValue||'';document.getElementById('previewDuration').value=entry.duration||'';document.getElementById('previewDurationWrap').style.display=entry.platform==='TV'?'':'none';
  const quality=document.getElementById('captureQuality'),template=document.getElementById('captureTemplate');document.getElementById('previewQuality').value=(quality&&quality.value)||'standard';document.getElementById('previewTemplate').value=(template&&template.value)||getActiveProject().pdfTemplate||'news';document.getElementById('pdfPreviewMeta').textContent=entry.platform+' · '+_captureImages.length+' Capture';
  await p2RenderPdfPreview();
}
function closePdfPreview(){document.getElementById('pdfPreviewModal').style.display='none';p2PreviewEntryId=null;p2PreviewPages=[];p2PreviewReady=false;p2PreviewSessionLogoId='';p2ExportFolderOnce=null;}
function p2PreviewValues(){return{publication:(document.getElementById('previewPublication').value||'').trim(),date:document.getElementById('previewDate').value||'',link:(document.getElementById('previewLink').value||'').trim(),prValue:Number(document.getElementById('previewPrValue').value)||0,duration:(document.getElementById('previewDuration').value||'').trim()};}
function queuePdfPreviewRender(){clearTimeout(p2PreviewTimer);p2PreviewTimer=setTimeout(p2RenderPdfPreview,220);}
async function p2RenderPdfPreview(){
  const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;const busy=document.getElementById('pdfPreviewBusy'),list=document.getElementById('pdfPageList'),download=document.getElementById('pdfDownloadBtn');busy.style.display='flex';download.disabled=true;p2PreviewReady=false;
  try{
    const values=p2PreviewValues(),effective={...entry,...values,pub:values.publication,url:values.link},template=document.getElementById('previewTemplate').value||'news',quality=document.getElementById('previewQuality').value,result=template==='standard'?await p2GenerateStandardPages(effective,_captureImages,quality,true):await p2GeneratePages(effective,_captureImages,values,quality,true);p2PreviewPages=result.pages;document.getElementById('pdfPreviewEyebrow').textContent=template==='standard'?'A4 PROOF':'LETTER PROOF';document.getElementById('pdfPreviewTitle').textContent=template==='standard'?'NEWSCLIPPING A4 Preview':'NEWSCLIPPING Preview';
    const layout=p2Layout(template==='standard'?'a4':'letter'),ratio=layout.pageW+'/'+layout.pageH;list.innerHTML=result.pages.map((page,i)=>'<article class="pdf-page" data-page="'+(i+1)+'" style="aspect-ratio:'+ratio+'"><img src="'+escAttr(page.dataUrl)+'" alt="หน้าที่ '+(i+1)+'">'+p2VectorSvg(page,layout)+'</article>').join('');
    const logoState=document.getElementById('previewLogoState');if(result.mediaLogo){const locked=Boolean(entry.logoLockedAssetId);logoState.className='preview-logo-state ok';logoState.innerHTML='✓ โลโก้สื่อ: <strong>'+esc(result.mediaLogo.name)+'</strong><br>'+(p2PreviewSessionLogoId?'ใช้เฉพาะ Export รอบนี้':locked?'ล็อกไว้สำหรับข่าวนี้':'อ้างอิงโลโก้ล่าสุดจาก Media DB')+'<br><button type="button" onclick="openLogoManager()">เปลี่ยนโลโก้</button> <button type="button" onclick="toggleEntryLogoLock()">'+(locked?'ปลดล็อก':'ล็อกโลโก้')+'</button>';}else{logoState.className='preview-logo-state warn';logoState.innerHTML='⚠ ยังไม่มีโลโก้สื่อ<br><button type="button" onclick="openLogoManager()">เพิ่มหรือเลือกโลโก้</button>';}
    const qualityState=document.getElementById('previewQualityState'),worst=result.qualityRows.some(row=>row.level==='bad')?'bad':result.qualityRows.some(row=>row.level==='warn'||row.tinyTail)?'warn':'good';qualityState.className='preview-quality-state '+worst;qualityState.innerHTML=result.qualityRows.map(row=>'<span><i></i>'+esc(row.name)+' · '+row.scalePercent+'% · '+row.widthPt+' pt · '+row.dpi+' DPI'+(row.readabilityWarning?' · ตัวหนังสืออาจเล็ก':'')+(row.tinyTail?' · หน้าสุดท้ายเหลือเนื้อหาเล็กน้อย':'')+'</span>').join('')+'<strong>ประมาณ '+p2FormatBytes(result.estimatedBytes)+'</strong>';
    const file=p2OutputFileName(effective,values.publication);document.getElementById('pdfPreviewFileName').textContent=file;document.getElementById('pdfPreviewStatus').textContent=result.pages.length+' หน้า · '+(template==='standard'?'A4':'Letter')+' · '+p2FormatBytes(result.estimatedBytes);p2PreviewReady=Boolean(result.mediaLogo&&effective.platform);download.disabled=!p2PreviewReady;if(!effective.platform)logoState.innerHTML+='<br>⚠ กรุณาระบุ Platform ก่อน Export';
  }catch(err){list.innerHTML='<div class="logo-empty">จัดหน้าไม่สำเร็จ: '+esc(err.message)+'</div>';document.getElementById('pdfPreviewStatus').textContent=err.message;}
  finally{busy.style.display='none';}
}
async function downloadPreviewPdf(){
  if(!p2PreviewReady)return;const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;const button=document.getElementById('pdfDownloadBtn'),values=p2PreviewValues(),quality=document.getElementById('previewQuality').value,template=document.getElementById('previewTemplate').value||'news';button.disabled=true;button.textContent='กำลังสร้าง…';
  try{const effective={...entry,...values,pub:values.publication,url:values.link},result=template==='standard'?await p2GenerateStandardPages(effective,_captureImages,quality,false):await p2GeneratePages(effective,_captureImages,values,quality,false),file=p2OutputFileName(effective,values.publication),layout=p2Layout(template==='standard'?'a4':'letter');if(result.qualityRows.some(row=>row.level==='bad')&&!confirm('ภาพบางรายการต่ำกว่า 100 DPI และอาจอ่านยาก\nยืนยัน Export ต่อหรือไม่?'))return;const pdf=await p2BuildPdfBlob(result.pages,layout.pageW,layout.pageH),saved=await p2SaveBlob(pdf,file,'pdf');const idx=entries.findIndex(e=>e.id===entry.id);entries[idx]={...entries[idx],status:entries[idx].status==='completed'?'completed':'ready',pdfGeneratedAt:new Date().toISOString(),fileName:saved.fileName,updatedAt:new Date().toISOString()};saveProjEntries(_activeProj,entries);renderTable();document.getElementById('pdfPreviewStatus').textContent=(saved.mode==='directory'?'บันทึก ':'ดาวน์โหลด ')+saved.fileName+' แล้ว';toast('✓ บันทึก PDF แล้ว','ok');p2ExportFolderOnce=null;}
  catch(err){toast('สร้าง PDF ไม่สำเร็จ: '+err.message,'err');}
  finally{button.disabled=false;button.textContent='บันทึก PDF';}
}

async function openBatchExport(){
  const chosen=entries.filter(e=>p2SelectedIds.has(String(e.id)));if(!chosen.length){toast('เลือกรายการข่าวก่อน','err');return;}
  const template=getActiveProject().pdfTemplate||'news';document.getElementById('batchPdfModal').style.display='flex';document.getElementById('batchCardGrid').innerHTML='<div class="logo-empty">กำลังตรวจ '+chosen.length+' รายการ…</div>';p2BatchRows=[];
  for(let i=0;i<chosen.length;i++){
    const entry=chosen[i];let images=[],logo=null,preview='',qualityRows=[];
    try{const record=await getCaptureRecord(_activeProj,entry.id);images=Array.isArray(record.images)?record.images:[];logo=await p2FindMediaLogo(entry);if(images.length){const values={publication:entry.pub,date:entry.date,link:entry.url,prValue:entry.prValue,duration:entry.duration||''},result=template==='standard'?await p2GenerateStandardPages(entry,images,'standard',true):await p2GeneratePages(entry,images,values,'standard',true);preview=result.pages[0]&&result.pages[0].dataUrl;qualityRows=result.qualityRows||[];}}
    catch(err){console.warn('[ClipKit] ตรวจ Batch ไม่สำเร็จ',entry.pub,err);}
    const issues=[];if(!images.length)issues.push('ไม่มี Capture');if(!logo)issues.push('ไม่มีโลโก้สื่อ');if(!entry.platform)issues.push('กรุณาระบุ Platform');else if(!entry.date||!entry.pub)issues.push('ข้อมูลไม่ครบ');if(entry.prValue===null||entry.prValue===undefined||entry.prValue==='')issues.push('ไม่มี PR Value');p2BatchRows.push({entry,images,logo,preview,issues,qualityRows,template});
    document.getElementById('batchPdfSummary').textContent='ตรวจแล้ว '+(i+1)+'/'+chosen.length;
  }
  refreshBatchExport();
}
function closeBatchExport(){document.getElementById('batchPdfModal').style.display='none';p2BatchRows=[];p2ExportFolderOnce=null;}
function refreshBatchExport(){
  const grid=document.getElementById('batchCardGrid'),skip=document.getElementById('batchSkipInvalid').checked,invalid=p2BatchRows.filter(r=>r.issues.length),ready=p2BatchRows.length-invalid.length;
  document.getElementById('batchPdfSummary').textContent=ready+' พร้อม · '+invalid.length+' ต้องตรวจสอบ';
  grid.innerHTML=p2BatchRows.map(row=>{const name=p2OutputFileName(row.entry),low=row.qualityRows.some(q=>q.level==='bad'),small=row.qualityRows.some(q=>q.readabilityWarning),tinyTail=row.qualityRows.some(q=>q.tinyTail),state=row.exportStatus==='failed'?'✕ บันทึกไม่สำเร็จ · '+esc(row.exportError||''):row.exportStatus==='exported'?'✓ บันทึกสำเร็จ':row.issues.length?'⚠ '+esc(row.issues.join(' · ')):low?'⚠ ภาพต่ำกว่า 100 DPI · ต้องยืนยัน':small?'⚠ Scale ต่ำกว่า 50% · ตัวหนังสืออาจเล็ก':tinyTail?'⚠ หน้าสุดท้ายเหลือเนื้อหาเล็กน้อย':'✓ พร้อมสร้าง PDF';return '<article class="batch-card '+(row.issues.length||row.exportStatus==='failed'?'invalid':'ready')+'"><div class="batch-card-preview">'+(row.preview?'<img src="'+escAttr(row.preview)+'" alt="หน้าแรก">':'NO PREVIEW')+'</div><div class="batch-card-info"><strong>'+esc(p2PublicationDisplay(row.entry,row.entry.pub))+'</strong><span>'+esc(name)+'</span><span>'+row.images.length+' Capture · '+esc(row.entry.platform)+' · '+(row.template==='standard'?'A4':'Letter')+'</span><div class="batch-card-status">'+state+'</div><button type="button" onclick="previewBatchEntry('+inlineJsArg(row.entry.id)+')">เปิด Preview</button></div></article>';}).join('');
  const button=document.getElementById('batchDownloadBtn');button.disabled=!ready||(!skip&&invalid.length>0);document.getElementById('batchStatus').textContent=invalid.length?(skip?'จะข้าม '+invalid.length+' รายการ':'กรุณากลับไปแก้ไขรายการที่ไม่พร้อม'):'พร้อมสร้าง '+ready+' PDF';
}
async function previewBatchEntry(id){closeBatchExport();await openCapture(id);await openPdfPreview(id,true);}

let p2CrcTable=null;
function p2Crc32(bytes){if(!p2CrcTable){p2CrcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;p2CrcTable[n]=c>>>0;}}let crc=0xffffffff;for(const byte of bytes)crc=p2CrcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function p2DosTime(date=new Date()){return{time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),date:((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};}
function p2U16(value){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,value,true);return b;}
function p2U32(value){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,value>>>0,true);return b;}
function p2Bytes(value){return value instanceof Uint8Array?value:new TextEncoder().encode(String(value));}
function p2Zip(entriesToZip){
  const locals=[],centrals=[];let offset=0;const stamp=p2DosTime();
  for(const file of entriesToZip){const name=p2Bytes(file.name),data=p2Bytes(file.data),crc=p2Crc32(data),local=joinByteArrays([p2U32(0x04034b50),p2U16(20),p2U16(0x800),p2U16(0),p2U16(stamp.time),p2U16(stamp.date),p2U32(crc),p2U32(data.length),p2U32(data.length),p2U16(name.length),p2U16(0),name,data]);locals.push(local);centrals.push(joinByteArrays([p2U32(0x02014b50),p2U16(20),p2U16(20),p2U16(0x800),p2U16(0),p2U16(stamp.time),p2U16(stamp.date),p2U32(crc),p2U32(data.length),p2U32(data.length),p2U16(name.length),p2U16(0),p2U16(0),p2U16(0),p2U16(0),p2U32(0),p2U32(offset),name]));offset+=local.length;}
  const central=joinByteArrays(centrals),end=joinByteArrays([p2U32(0x06054b50),p2U16(0),p2U16(0),p2U16(entriesToZip.length),p2U16(entriesToZip.length),p2U32(central.length),p2U32(offset),p2U16(0)]);return new Blob([...locals,central,end],{type:'application/zip'});
}
function p2CsvCell(value){const text=String(value??'');return /[",\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
async function downloadBatchZip(onlyFailed=false){
  const skip=document.getElementById('batchSkipInvalid').checked,rows=p2BatchRows.filter(r=>!r.issues.length&&(!onlyFailed||r.exportStatus==='failed')),button=document.getElementById('batchDownloadBtn'),retry=document.getElementById('batchRetryBtn'),quality=document.getElementById('batchQuality').value;button.disabled=true;button.textContent='กำลังสร้าง…';if(retry)retry.hidden=true;const files=[],summary=[['File Name','Publication','Platform','Date','Pages','Status']];
  try{
    if(!rows.length){toast('ไม่มีรายการที่ต้องลองใหม่','err');return;}
    if(rows.some(row=>row.qualityRows.some(q=>q.level==='bad'))&&!confirm('Batch นี้มีภาพต่ำกว่า 100 DPI\nยืนยัน Export รายการที่พร้อมต่อหรือไม่?'))return;
    const directory=await p2WritableDirectory(true),project=getActiveProject(),separate={pdf:false,excel:false,backup:false,...(project.separateOutputFolders||{})},pdfDirectory=directory&&separate.pdf?await directory.getDirectoryHandle('PDF',{create:true}):directory,csvDirectory=directory&&separate.excel?await directory.getDirectoryHandle('Excel',{create:true}):directory;let succeeded=0,failed=0;
    for(let i=0;i<rows.length;i++){
      const row=rows[i],entry=row.entry,values={publication:entry.pub,date:entry.date,link:entry.url,prValue:entry.prValue,duration:entry.duration||''};document.getElementById('batchStatus').textContent='กำลังสร้าง '+(i+1)+'/'+rows.length+' · '+entry.pub;
      try{const result=row.template==='standard'?await p2GenerateStandardPages(entry,row.images,quality,false):await p2GeneratePages(entry,row.images,values,quality,false),fileName=p2OutputFileName(entry),layout=p2Layout(row.template==='standard'?'a4':'letter'),pdf=await p2BuildPdfBlob(result.pages,layout.pageW,layout.pageH);let savedName=fileName;if(pdfDirectory){savedName=await p2UniqueFileName(pdfDirectory,fileName,project.duplicateMode||'suffix');await p2WriteBlob(pdfDirectory,pdf,savedName);}else files.push({name:fileName,data:new Uint8Array(await pdf.arrayBuffer())});summary.push([savedName,entry.pub,entry.platform,entry.date,result.pages.length,'exported']);row.exportStatus='exported';row.exportError='';succeeded++;const idx=entries.findIndex(e=>e.id===entry.id);if(idx>=0)entries[idx]={...entries[idx],status:entries[idx].status==='completed'?'completed':'ready',pdfGeneratedAt:new Date().toISOString(),fileName:savedName,updatedAt:new Date().toISOString()};}
      catch(err){failed++;row.exportStatus='failed';row.exportError=err.message;summary.push([p2OutputFileName(entry),entry.pub,entry.platform,entry.date,0,'failed: '+err.message]);}
    }
    if(skip)for(const row of p2BatchRows.filter(r=>r.issues.length))summary.push([p2OutputFileName(row.entry),row.entry.pub,row.entry.platform,row.entry.date,0,'skipped: '+row.issues.join('; ')]);
    const csv='\ufeff'+summary.map(row=>row.map(p2CsvCell).join(',')).join('\r\n'),csvBlob=new Blob([csv],{type:'text/csv;charset=utf-8'});if(csvDirectory){const csvName=await p2UniqueFileName(csvDirectory,'export-summary.csv',project.duplicateMode||'suffix');await p2WriteBlob(csvDirectory,csvBlob,csvName);}else{files.push({name:'export-summary.csv',data:p2Bytes(csv)});const zipName='ClipKit_PDF_'+new Date().toISOString().slice(0,10)+(onlyFailed?'_retry':'')+'.zip';downloadLocalBlob(p2Zip(files),zipName);}saveProjEntries(_activeProj,entries);renderTable();refreshBatchExport();document.getElementById('batchStatus').textContent=succeeded+' สำเร็จ · '+failed+' ไม่สำเร็จ · '+p2BatchRows.filter(r=>r.issues.length).length+' ถูกข้าม';if(retry)retry.hidden=!p2BatchRows.some(row=>row.exportStatus==='failed');toast(failed?'Batch เสร็จแล้ว · มี '+failed+' รายการให้ลองใหม่':'✓ Export Batch สำเร็จ','ok');if(!failed)p2ExportFolderOnce=null;
  }catch(err){toast('สร้าง Batch ไม่สำเร็จ: '+err.message,'err');document.getElementById('batchStatus').textContent=err.message;}
  finally{button.disabled=false;button.textContent='Export Batch';}
}
function retryFailedBatch(){return downloadBatchZip(true);}

async function p2AllCaptureRecords(){try{const db=await openCaptureDB();return await new Promise((resolve,reject)=>{const req=db.transaction(CAPTURE_STORE,'readonly').objectStore(CAPTURE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return[];}}
async function p2ReplaceCaptureRecords(records){const db=await openCaptureDB();await new Promise((resolve,reject)=>{const tx=db.transaction(CAPTURE_STORE,'readwrite'),store=tx.objectStore(CAPTURE_STORE);store.clear();(records||[]).forEach(r=>store.put(r));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
const p2BaseExportBackup=exportBackup,p2BaseRestoreBackup=restoreBackup;
exportBackup=async function(){
  if(globalThis.ClipKitBackup){try{const scopeValue=(document.getElementById('backupScope')||{}).value||'all',password=(document.getElementById('backupPassword')||{}).value||'',blob=await ClipKitBackup.create({scope:scopeValue,password:password||undefined,encodeZip:async files=>new Blob([p2Zip(files.map(f=>({name:f.name,data:f.data})))],{type:'application/zip'}),now:()=>new Date().toISOString()}),name='ClipKit_Backup_'+new Date().toISOString().slice(0,10)+'.zip';downloadLocalBlob(blob,name);toast('✓ สร้าง Backup แบบตรวจสอบได้แล้ว','ok');return;}catch(err){console.error(err);toast('สำรองข้อมูลไม่สำเร็จ: '+err.message,'err');return;}}
  try{const payload={format:'ClipKit ZIP Backup',version:2,exportedAt:new Date().toISOString(),core:collectBackup(),phase2:{global:p2Global(),assets:await p2StoreAll('assets'),mappings:await p2StoreAll('mappings'),history:await p2StoreAll('history'),captures:await p2AllCaptureRecords()}},name='ClipKit_Backup_'+new Date().toISOString().slice(0,10)+'.zip',saved=await p2SaveBlob(p2Zip([{name:'backup.json',data:p2Bytes(JSON.stringify(payload))}]),name,'backup');toast('✓ สำรองข้อมูลพร้อมภาพ โลโก้ และประวัติแล้ว'+(saved.mode==='directory'?' · '+saved.directory:''),'ok');}catch(err){console.error(err);toast('สำรองข้อมูลไม่สำเร็จ: '+err.message,'err');}
};
function p2ReadStoredZip(bytes){
  const files={};let offset=0,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();
  while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){const method=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),nameLen=view.getUint16(offset+26,true),extraLen=view.getUint16(offset+28,true),nameStart=offset+30,dataStart=nameStart+nameLen+extraLen,name=decoder.decode(bytes.slice(nameStart,nameStart+nameLen));if(method!==0)throw new Error('ZIP นี้ใช้การบีบอัดที่รุ่นนี้ยังไม่รองรับ');files[name]=bytes.slice(dataStart,dataStart+size);offset=dataStart+size;}return files;
}
async function p2RestoreCore(data){
  if(!isValidBackup(data))throw new Error('ข้อมูลหลักใน Backup ไม่ถูกต้อง');safeLS.setItem('ck_backup_before_restore',JSON.stringify(collectBackup()));
  if(Array.isArray(data.platformRegistry))savePlatformRegistry(data.platformRegistry);else saveCustomPlatforms(data.customPlatforms||[]);saveProjectList(data.projects);data.projects.forEach(p=>saveProjEntries(p.id,(data.entriesByProject[p.id]||[]).map(normalizeEntry)));saveCustom((data.mediaDatabase&&data.mediaDatabase.custom)||[]);saveImported((data.mediaDatabase&&data.mediaDatabase.imported)||[]);saveUsernameMap(data.usernameMap||{});if(data.sheets&&data.sheets.url)safeLS.setItem('ck_gs_url',data.sheets.url);if(data.sheets&&data.sheets.sheetUrl)safeLS.setItem('ck_gs_sheeturl',data.sheets.sheetUrl);_activeProj=data.projects.some(p=>p.id===data.activeProject)?data.activeProject:data.projects[0].id;safeLS.setItem('ck_active_proj',_activeProj);entries.length=0;getProjEntries(_activeProj).forEach(e=>entries.push(e));
}
restoreBackup=async function(event){
  const file=event.target.files&&event.target.files[0];event.target.value='';if(!file)return;if(!/\.zip$/i.test(file.name))return p2BaseRestoreBackup({target:{files:[file],value:''}});
  if(globalThis.ClipKitBackup){try{const password=(document.getElementById('backupPassword')||{}).value||'',adapter={decodeZip:async blob=>Object.entries(p2ReadStoredZip(new Uint8Array(await blob.arrayBuffer()))).map(([name,data])=>({name,data}))},inspection=await ClipKitBackup.inspect(file,{password:password||undefined,...adapter}),box=document.getElementById('backupInspection');if(box){box.hidden=false;box.textContent='ตรวจสอบ Backup แล้ว: '+Object.values(inspection.recordCounts||{}).reduce((a,b)=>a+b,0)+' รายการ · '+inspection.files.length+' ไฟล์';}if(!confirm('Backup ถูกต้อง ต้องการกู้คืนหรือไม่?'))return;const replace=confirm('เลือก OK เพื่อแทนที่ข้อมูลเดิม หรือ Cancel เพื่อรวมข้อมูลแบบปลอดภัย');const mode=replace?'replace':'merge',preview=await ClipKitBackup.restore(file,{password:password||undefined,mode,inspectOnly:true,...adapter}),resolutions={};for(const conflict of preview.conflicts||[])if(conflict.type!=='new'){const choice=(prompt('รายการ '+conflict.store+'/'+conflict.id+' ('+conflict.type+')\nพิมพ์ keep-existing, use-backup หรือ duplicate','keep-existing')||'').trim();if(choice)resolutions[conflict.store+':'+conflict.id]=choice;}const restoreReport=await ClipKitBackup.restore(file,{password:password||undefined,mode,resolutions,...adapter,createSafetyBackup:replace?async()=>{const safety=await ClipKitBackup.create({scope:'all',encodeZip:async files=>new Blob([p2Zip(files)],{type:'application/zip'})});downloadLocalBlob(safety,'ClipKit_Safety_Backup.zip');return safety;}:undefined});if(!restoreReport||restoreReport.valid===false||restoreReport.unresolved?.length){const unresolved=(restoreReport?.unresolved||restoreReport?.conflicts||[]).map(c=>c.store+'/'+c.id+' ('+c.type+')').join(', ')||'ไม่ทราบสาเหตุ';if(box){box.hidden=false;box.textContent='ยังไม่กู้คืน · Conflict ที่ยังไม่ได้แก้: '+unresolved;}toast('กู้คืนไม่สำเร็จ: กรุณาแก้ Conflict ที่ค้างอยู่','err');return;}toast('✓ กู้คืนข้อมูลจาก Backup แล้ว','ok');location.reload();return;}catch(err){toast('กู้คืน Backup ไม่สำเร็จ: '+err.message,'err');return;}}
  try{const files=p2ReadStoredZip(new Uint8Array(await file.arrayBuffer())),raw=files['backup.json'];if(!raw)throw new Error('ไม่พบ backup.json ใน ZIP');const payload=JSON.parse(new TextDecoder().decode(raw));if(!payload.core||!payload.phase2)throw new Error('รูปแบบ ZIP Backup ไม่ถูกต้อง');if(!confirm('กู้คืน '+file.name+'?\nข้อมูล Project, Capture และโลโก้ปัจจุบันจะถูกแทนที่'))return;await p2RestoreCore(payload.core);await p2StoreClear('assets');await p2StoreClear('mappings');await p2StoreClear('history');for(const asset of payload.phase2.assets||[])await p2StorePut('assets',asset);for(const mapping of payload.phase2.mappings||[])await p2StorePut('mappings',mapping);for(const history of payload.phase2.history||[])await p2StorePut('history',history);await p2ReplaceCaptureRecords(payload.phase2.captures||[]);p2SaveGlobal(payload.phase2.global||{});rebuildDB();rebuildUrlHistory();updProjBtn();syncPlatOptions();renderCustomPlatChips();renderTable();renderRecent();updBadge();toast('✓ กู้คืนข้อมูลพร้อมภาพ โลโก้ และประวัติแล้ว · กรุณาเลือกโฟลเดอร์ปลายทางใหม่','ok');closeSettings();}
  catch(err){toast('กู้คืนไม่สำเร็จ: '+err.message,'err');}
};

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('captureTemplate').addEventListener('change',event=>{const entry=entries.find(e=>e.id===_captureEntryId),file=document.getElementById('captureFileName');if(entry&&file)file.textContent=p2OutputFileName(entry);const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].pdfTemplate=event.target.value;saveProjectList(projects);}p2UpdateCaptureMetrics();});
  document.getElementById('captureQuality').addEventListener('change',event=>{const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].pdfQuality=event.target.value;saveProjectList(projects);}});
  p2SyncSelection();
});
