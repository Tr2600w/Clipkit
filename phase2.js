/* ClipKit Phase 2 — NEWSCLIPPING Letter templates, assets, proofing and batch output */
'use strict';

const P2_ASSET_DB='clipkit-phase2-assets';
const P2_ASSET_VERSION=1;
const P2_GLOBAL_KEY='ck_phase2_global';
const P2_DEFAULTS={title:'NEWSCLIPPING',prFormat:'number'};
let p2DbPromise=null;
let p2SelectedIds=new Set();
let p2PreviewEntryId=null,p2PreviewPages=[],p2PreviewReady=false,p2PreviewTimer=null;
let p2EditingImageId=null,p2EditRotation=0,p2EditBreaks=[];
let p2BatchRows=[];
const P2_LETTER={pageW:612,pageH:792,frame:{x:43.5,y:27.05,w:521.85,h:136.45},title:{x:249.65,y:25.8,w:112.7,h:13.56},media:{x:72,y:44,w:128,h:44},client:{x:418.8,y:44,w:128,h:40},footer:{x:261,y:731,w:89.51,h:32.65},content:{x:72,w:468,firstTop:204,nextTop:117.64,firstH:505,nextH:585}};
const P2_A4={pageW:595.28,pageH:841.89,frame:{x:35.14,y:27.05,w:521.85,h:136.45},title:{x:241.29,y:25.8,w:112.7,h:13.56},media:{x:63.64,y:44,w:128,h:44},client:{x:410.44,y:44,w:128,h:40},footer:{x:252.64,y:780.89,w:89.51,h:32.65},content:{x:63.64,w:468,firstTop:204,nextTop:117.64,firstH:555,nextH:635}};
const P2_BODY_FONT='400 8.5px Arial,sans-serif';
const P2_LINK_FONT='400 7.8px Arial,sans-serif';
function p2Layout(format){return format==='a4'?P2_A4:P2_LETTER;}

function p2OpenDb(){
  if(p2DbPromise)return p2DbPromise;
  p2DbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(P2_ASSET_DB,P2_ASSET_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});
      if(!db.objectStoreNames.contains('mappings'))db.createObjectStore('mappings',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('เปิดคลังโลโก้ไม่ได้'));
  });
  return p2DbPromise;
}
async function p2StoreGet(store,key){const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
async function p2StoreAll(store){const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function p2StorePut(store,value){const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readwrite').objectStore(store).put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error);});}
async function p2StoreClear(store){const db=await p2OpenDb();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readwrite').objectStore(store).clear();req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});}

function p2Global(){return{...P2_DEFAULTS,...readJSON(P2_GLOBAL_KEY,{})};}
function p2SaveGlobal(value){safeLS.setItem(P2_GLOBAL_KEY,JSON.stringify({...p2Global(),...value}));}
function p2Norm(value){return String(value||'').toLowerCase().normalize('NFKC').replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i,'').replace(/\.(co\.th|com\.th|in\.th|or\.th|com|net|org)$/i,'').replace(/[^a-z0-9ก-๙]+/g,'');}
function p2SafeName(value){return String(value||'Untitled').replace(/[\\/:*?"<>|]/g,'-').replace(/[. ]+$/g,'').trim()||'Untitled';}
function p2PlatformSuffix(platform){return getPlatformCode(platform,'file')||((platform==='Website'||platform==='Web')?'':platform||'');}
function p2PublicationDisplay(entry,publication){
  const pub=String(publication||entry.pub||'').trim();
  const suffix=p2PlatformSuffix(entry.platform);
  let out=suffix?pub+' - '+suffix:pub;
  if(entry.platform==='TV'&&entry.duration)out+=' – '+entry.duration;
  return out;
}
function p2OutputFileName(entry,publication){
  const compact=String(entry.date||'').replace(/-/g,'');
  const date=compact.length===8?compact.slice(2):compact;
  const base=p2SafeName(date+'_'+p2PublicationDisplay(entry,publication));
  const peers=entries.filter(e=>e.id!==entry.id&&e.date===entry.date&&p2Norm(e.pub)===p2Norm(entry.pub)&&e.platform===entry.platform&&Number(e.id)<Number(entry.id)).length;
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
async function p2SetMapping(pub,platform,assetId,confirmed=true){return p2StorePut('mappings',{key:p2MappingKey(pub,platform),publication:pub,platform:platform||'',assetId,confirmed,updatedAt:new Date().toISOString()});}
async function p2FindMediaLogo(entry){
  if(entry.logoLockedAssetId){const locked=await p2StoreGet('assets',entry.logoLockedAssetId);if(locked)return locked;}
  const specific=await p2StoreGet('mappings',p2MappingKey(entry.pub,entry.platform));
  if(specific){const asset=await p2StoreGet('assets',specific.assetId);if(asset)return asset;}
  const generic=await p2StoreGet('mappings',p2MappingKey(entry.pub,''));
  if(generic){const asset=await p2StoreGet('assets',generic.assetId);if(asset)return asset;}
  const assets=await p2StoreAll('assets');
  const logoFile=String(entry.logoFile||'');
  let asset=assets.find(a=>a.kind==='media'&&logoFile&&a.name.toLowerCase()===logoFile.toLowerCase());
  if(asset)return asset;
  asset=assets.find(a=>a.kind==='media'&&p2Norm(a.publication||a.name)===p2Norm(entry.pub)&&(!a.platform||a.platform===entry.platform));
  if(asset){await p2SetMapping(entry.pub,asset.platform||'',asset.id,true);return asset;}
  return null;
}
async function p2GetProjectAsset(project,kind){
  let id='';
  if(kind==='client')id=project.clientLogoAssetId||'';
  else if(project.agencyLogoMode==='asset')id=project.agencyLogoAssetId||'';
  else if(project.agencyLogoMode!=='none')id=p2Global().agencyLogoAssetId||'';
  return id?p2StoreGet('assets',id):null;
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
    const asset=await p2AssetFromFile(file,kind);await p2StorePut('assets',asset);
    if(kind==='agency'&&!p2Global().agencyLogoAssetId)p2SaveGlobal({agencyLogoAssetId:asset.id});
    const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);
    if(idx>=0){if(kind==='client')projects[idx].clientLogoAssetId=asset.id;else{projects[idx].agencyLogoAssetId=asset.id;projects[idx].agencyLogoMode='asset';}saveProjectList(projects);}
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
  await previewAgencySelection();
  const media=(await p2StoreAll('assets')).filter(a=>a.kind==='media'),summary=document.getElementById('logoLibrarySummary');if(summary)summary.textContent=media.length?media.length+' โลโก้ใน DB':'ยังไม่ได้นำเข้าโฟลเดอร์';
}
const p2BaseSaveSettings=saveSettings;
saveSettings=function(){
  const title=(document.getElementById('cfgNewsTitle').value||'NEWSCLIPPING').trim()||'NEWSCLIPPING',prFormat=document.getElementById('cfgPrFormat').value||'number',agency=document.getElementById('cfgAgencyLogoSelect').value||'none',logoWhiteTransparent=document.getElementById('cfgLogoTransparent').checked;
  p2BaseSaveSettings();
  const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);
  if(idx>=0){
    const isSystemProject=_activeProj===DEFAULT_PROJ;
    if(isSystemProject)p2SaveGlobal({title,prFormat});
    projects[idx]={...projects[idx],newsTitleOverride:isSystemProject?'':title,prFormat,logoWhiteTransparent,agencyLogoMode:agency==='none'?'none':agency==='global'?'global':'asset',agencyLogoAssetId:agency!=='none'&&agency!=='global'?agency:projects[idx].agencyLogoAssetId||''};saveProjectList(projects);
  }
};
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

function toggleBatchRow(id,checked){if(checked)p2SelectedIds.add(Number(id));else p2SelectedIds.delete(Number(id));p2SyncSelection();}
function toggleAllBatchRows(checked){document.querySelectorAll('.batch-row-check').forEach(cb=>{cb.checked=checked;toggleBatchRow(Number(cb.value),checked);});}
function p2SyncSelection(){
  document.querySelectorAll('.batch-row-check').forEach(cb=>cb.checked=p2SelectedIds.has(Number(cb.value)));
  const count=document.getElementById('batchSelectedCount'),btn=document.getElementById('batchPdfBtn');if(count)count.textContent=p2SelectedIds.size;if(btn)btn.disabled=!p2SelectedIds.size;
  const all=document.getElementById('batchSelectAll'),boxes=[...document.querySelectorAll('.batch-row-check')];if(all){all.checked=boxes.length>0&&boxes.every(cb=>cb.checked);all.indeterminate=boxes.some(cb=>cb.checked)&&!all.checked;}
}
const p2BaseRenderTable=renderTable;
renderTable=function(){p2BaseRenderTable();requestAnimationFrame(p2SyncSelection);};

async function openLogoManager(){
  const modal=document.getElementById('logoManagerModal');if(!modal)return;modal.style.display='flex';
  const platform=document.getElementById('logoManagerPlatform');if(platform)platform.innerHTML='<option value="">ทุก Platform</option>'+platformOptions('',true);
  if(_captureEntryId){const entry=entries.find(e=>e.id===_captureEntryId),search=document.getElementById('logoManagerSearch');if(entry&&search)search.value=entry.pub;}
  await renderLogoManager();
}
function closeLogoManager(){const modal=document.getElementById('logoManagerModal');if(modal)modal.style.display='none';}
async function renderLogoManager(){
  const grid=document.getElementById('logoManagerGrid');if(!grid)return;grid.innerHTML='<div class="logo-empty">กำลังเปิดคลังโลโก้…</div>';
  const q=p2Norm((document.getElementById('logoManagerSearch')||{}).value||''),platform=(document.getElementById('logoManagerPlatform')||{}).value||'';
  let assets=(await p2StoreAll('assets')).filter(a=>a.kind==='media').map(a=>({...a,_score:q?Math.max(similarity(q,p2Norm(a.publication)),similarity(q,p2Norm(a.name))):1}));
  if(q)assets=assets.filter(a=>p2Norm(a.name).includes(q)||p2Norm(a.publication).includes(q)||a._score>=.34);if(platform)assets=assets.filter(a=>!a.platform||a.platform===platform);
  assets.sort((a,b)=>q?b._score-a._score:String(a.publication||a.name).localeCompare(String(b.publication||b.name),'th')).splice(160);
  if(!assets.length){grid.innerHTML='<div class="logo-empty">ไม่พบโลโก้ · นำเข้าโฟลเดอร์จากหน้าตั้งค่าก่อน</div>';return;}
  grid.innerHTML=assets.map(a=>'<article class="logo-card"><img src="'+escAttr(a.dataUrl)+'" alt="'+escAttr(a.name)+'"><strong>'+esc(a.publication||a.name)+'</strong><span>'+esc(a.name)+(a.platform?' · '+esc(a.platform):' · โลโก้หลัก')+'</span><span title="'+escAttr(a.source||'')+'">'+esc(a.source||'upload')+(q?' · ตรงกัน '+Math.round(a._score*100)+'%':'')+'</span><div class="logo-card-actions"><button type="button" onclick="useLogoAsset(\''+escAttr(a.id)+'\')">ใช้และบันทึก DB</button></div></article>').join('');
}
async function useLogoAsset(assetId){
  const asset=await p2StoreGet('assets',assetId);if(!asset)return;
  const entry=entries.find(e=>e.id===(_captureEntryId||p2PreviewEntryId));
  const pub=entry?entry.pub:asset.publication,platform=entry?entry.platform:(asset.platform||'');
  if(!pub){toast('ไม่พบชื่อสื่อสำหรับผูกโลโก้','err');return;}
  await p2SetMapping(pub,platform,asset.id,true);
  if(entry){entry.logoFile=asset.name;entry.logoAssetId=asset.id;entry.updatedAt=new Date().toISOString();saveProjEntries(_activeProj,entries);}
  toast('✓ บันทึกโลโก้ '+pub+(platform?' · '+platform:''),'ok');closeLogoManager();
  if(p2PreviewEntryId){await p2RenderPdfPreview();}renderTable();
}
async function toggleEntryLogoLock(){
  const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;
  if(entry.logoLockedAssetId)entry.logoLockedAssetId='';
  else{const asset=await p2FindMediaLogo({...entry,logoLockedAssetId:''});if(!asset){toast('ยังไม่มีโลโก้ให้ล็อก','err');return;}entry.logoLockedAssetId=asset.id;}
  entry.updatedAt=new Date().toISOString();saveProjEntries(_activeProj,entries);await p2RenderPdfPreview();
  toast(entry.logoLockedAssetId?'✓ ล็อกโลโก้สำหรับข่าวนี้แล้ว':'✓ ใช้โลโก้ล่าสุดจาก Media DB แล้ว','ok');
}

const p2BasePrepareCaptureFile=prepareCaptureFile;
prepareCaptureFile=async function(file){
  const item=await p2BasePrepareCaptureFile(file);
  try{item.originalDataUrl=await fileAsDataURL(file);}catch{item.originalDataUrl=item.dataUrl;}
  item.transform={cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,breakRatios:[]};
  return item;
};
const p2BaseOpenCapture=openCapture;
openCapture=async function(entryId){
  await p2BaseOpenCapture(entryId);
  const entry=entries.find(e=>e.id===Number(entryId));if(!entry)return;
  const project=getActiveProject(),template=document.getElementById('captureTemplate');if(template)template.value=project.pdfTemplate||'news';
  const quality=document.getElementById('captureQuality');if(quality)quality.value=project.pdfQuality||'standard';
  const file=document.getElementById('captureFileName');if(file)file.textContent=(template&&template.value==='standard')?buildOutputFileName(entry.date,entry.pub,entry.platform,project):p2OutputFileName(entry);
  renderCaptureImages();
};
const p2BaseCloseCapture=closeCapture;
closeCapture=function(){p2BaseCloseCapture();};
renderCaptureImages=function(){
  const list=document.getElementById('captureList'),empty=document.getElementById('captureEmpty'),count=document.getElementById('captureCount');if(!list||!empty||!count)return;
  count.textContent=_captureImages.length+' ภาพ';empty.style.display=_captureImages.length?'none':'flex';
  list.innerHTML=_captureImages.map((img,i)=>'<article class="capture-card"><div class="capture-order">'+String(i+1).padStart(2,'0')+'</div><img src="'+escAttr(img.dataUrl)+'" alt="ภาพแคป '+(i+1)+'"><div class="capture-card-meta"><strong>'+esc(img.name)+'</strong><span>'+img.width+' × '+img.height+' px'+((img.transform&&img.transform.rotation)?' · หมุน '+img.transform.rotation+'°':'')+'</span></div><div class="capture-card-actions"><button type="button" class="edit-image" onclick="openImageEditor(\''+img.id+'\')" title="ครอป หมุน และแบ่งหน้า">ปรับภาพ</button><button type="button" onclick="moveCaptureImage(\''+img.id+'\',-1)" '+(i===0?'disabled':'')+' title="เลื่อนขึ้น">↑</button><button type="button" onclick="moveCaptureImage(\''+img.id+'\',1)" '+(i===_captureImages.length-1?'disabled':'')+' title="เลื่อนลง">↓</button><button type="button" class="danger" onclick="removeCaptureImage(\''+img.id+'\')" title="ลบภาพ">×</button></div></article>').join('');
  const button=document.getElementById('captureExportBtn');if(button)button.disabled=!_captureImages.length;
};

async function p2ProcessedCanvas(item,scale=1){
  const source=await loadImageSource(item.originalDataUrl||item.dataUrl),t={cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,...(item.transform||{})};
  const sx=Math.round(source.naturalWidth*t.cropLeft/100),sy=Math.round(source.naturalHeight*t.cropTop/100),sw=Math.max(1,source.naturalWidth-sx-Math.round(source.naturalWidth*t.cropRight/100)),sh=Math.max(1,source.naturalHeight-sy-Math.round(source.naturalHeight*t.cropBottom/100));
  const rot=((Number(t.rotation)||0)%360+360)%360,swap=rot===90||rot===270,canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((swap?sh:sw)*scale));canvas.height=Math.max(1,Math.round((swap?sw:sh)*scale));
  const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rot*Math.PI/180);ctx.drawImage(source,sx,sy,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);return canvas;
}
async function openImageEditor(id){
  const item=_captureImages.find(img=>img.id===id);if(!item)return;p2EditingImageId=id;
  const t={cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,rotation:0,breakRatios:[],...(item.transform||{})};p2EditRotation=t.rotation||0;p2EditBreaks=[...(t.breakRatios||[])];
  ['Left','Right','Top','Bottom'].forEach(k=>document.getElementById('crop'+k).value=t['crop'+k]||0);
  document.getElementById('imageEditModal').style.display='flex';await updateImageEditPreview();
}
function closeImageEditor(){document.getElementById('imageEditModal').style.display='none';p2EditingImageId=null;}
async function updateImageEditPreview(){
  const item=_captureImages.find(img=>img.id===p2EditingImageId);if(!item)return;
  const temp={...item,transform:{cropLeft:Number(document.getElementById('cropLeft').value),cropRight:Number(document.getElementById('cropRight').value),cropTop:Number(document.getElementById('cropTop').value),cropBottom:Number(document.getElementById('cropBottom').value),rotation:p2EditRotation,breakRatios:p2EditBreaks}};
  const canvas=await p2ProcessedCanvas(temp,.45),img=document.getElementById('imageEditorPreview');img.src=canvas.toDataURL('image/jpeg',.88);img.onload=()=>p2RenderBreakHandles(img);
}
function rotateEditedImage(delta){p2EditRotation=(p2EditRotation+delta+360)%360;updateImageEditPreview();}
function resetEditedImage(){p2EditRotation=0;p2EditBreaks=[];['Left','Right','Top','Bottom'].forEach(k=>document.getElementById('crop'+k).value=0);updateImageEditPreview();}
function p2DefaultBreakRatios(img){
  const format=(document.getElementById('captureTemplate').value||'news')==='standard'?'a4':'letter',layout=p2Layout(format),isFirstCapture=_captureImages.findIndex(item=>item.id===p2EditingImageId)===0,firstHeight=isFirstCapture?layout.content.firstH:layout.content.nextH;
  const firstRatio=Math.min(.9,(firstHeight/layout.content.w)*(img.clientWidth/img.clientHeight)),nextRatio=Math.min(.9,(layout.content.nextH/layout.content.w)*(img.clientWidth/img.clientHeight)),out=[];let y=firstRatio;
  while(y<.97){out.push(y);y+=nextRatio;}return out;
}
function p2RenderBreakHandles(img){
  const layer=document.getElementById('imageBreakLayer');if(!layer)return;const ratios=p2EditBreaks.length?p2EditBreaks:p2DefaultBreakRatios(img);if(!p2EditBreaks.length)p2EditBreaks=ratios;
  layer.innerHTML=ratios.map((ratio,i)=>'<div class="page-break-handle" data-break-index="'+i+'" style="top:'+Math.round(ratio*img.clientHeight)+'px"></div>').join('');
  layer.querySelectorAll('.page-break-handle').forEach(handle=>{
    handle.onpointerdown=event=>{event.preventDefault();handle.setPointerCapture(event.pointerId);};
    handle.onpointermove=event=>{if(!handle.hasPointerCapture(event.pointerId))return;const rect=img.getBoundingClientRect(),ratio=Math.max(.05,Math.min(.95,(event.clientY-rect.top)/rect.height)),idx=Number(handle.dataset.breakIndex),min=idx?p2EditBreaks[idx-1]+.04:.04,max=idx<p2EditBreaks.length-1?p2EditBreaks[idx+1]-.04:.96;p2EditBreaks[idx]=Math.max(min,Math.min(max,ratio));handle.style.top=Math.round(p2EditBreaks[idx]*img.clientHeight)+'px';};
  });
}
async function saveImageEdits(){
  const item=_captureImages.find(img=>img.id===p2EditingImageId);if(!item)return;item.transform={cropLeft:Number(document.getElementById('cropLeft').value),cropRight:Number(document.getElementById('cropRight').value),cropTop:Number(document.getElementById('cropTop').value),cropBottom:Number(document.getElementById('cropBottom').value),rotation:p2EditRotation,breakRatios:p2EditBreaks};
  const preview=await p2ProcessedCanvas(item,.7);item.dataUrl=preview.toDataURL('image/jpeg',.9);item.width=preview.width;item.height=preview.height;await persistCaptureImages();closeImageEditor();toast('✓ บันทึกการปรับภาพแล้ว','ok');
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
async function p2DrawHeader(ctx,entry,values,assets,project,layout=P2_LETTER){
  const L=layout,t=L.title,dx=L.frame.x-P2_LETTER.frame.x,transparent=Boolean(project.logoWhiteTransparent);ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.strokeRect(L.frame.x,L.frame.y,L.frame.w,L.frame.h);
  const title=project.newsTitleOverride||p2Global().title||'NEWSCLIPPING';ctx.fillStyle='#050505';ctx.fillRect(t.x,t.y,t.w,t.h);ctx.fillStyle='#fff';ctx.font='700 11.04px "Century Gothic",Arial,sans-serif';const titleSpacing=2.2,textWidth=[...title].reduce((s,c)=>s+ctx.measureText(c).width+titleSpacing,0)-titleSpacing,p2TitleX=t.x+(t.w-textWidth)/2;p2DrawSpaced(ctx,title,p2TitleX,t.y+10.9,titleSpacing);
  await p2DrawAsset(ctx,assets.media,L.media.x,L.media.y,L.media.w,L.media.h,'left',transparent);await p2DrawAsset(ctx,assets.client,L.client.x,L.client.y,L.client.w,L.client.h,'right',transparent);
  ctx.fillStyle='#111';ctx.font=P2_BODY_FONT;const labelX=72+dx,dataX=Math.max(143.5+dx,labelX+ctx.measureText('PUBLICATION:').width+14),prLabelX=396+dx,prDataX=Math.max(468.4+dx,prLabelX+ctx.measureText('PR VALUE:').width+14);ctx.fillText('PUBLICATION:',labelX,106);ctx.fillText('DATE:',labelX,121.5);ctx.fillText('LINK:',labelX,137.5);ctx.fillText('PR VALUE:',prLabelX,106);
  ctx.font=P2_BODY_FONT;ctx.fillText(values.publication,dataX,106);ctx.fillText(p2FormatDate(values.date),dataX,121.5);ctx.fillText(p2FormatPr(values.prValue,project.prFormat||'number'),prDataX,106);
  ctx.font=P2_LINK_FONT;p2WrapChars(ctx,values.link,L.frame.x+L.frame.w-14-dataX,2).forEach((line,i)=>ctx.fillText(line,dataX,137.5+i*9));ctx.restore();
}
function p2SmartBreak(canvas,start,target,maxY){
  const ideal=Math.min(maxY,start+target);if(ideal>=maxY-2)return maxY;const ctx=canvas.getContext('2d'),range=Math.max(20,Math.round(target*.1)),from=Math.max(start+Math.round(target*.72),ideal-range),to=Math.min(maxY,ideal+range),step=Math.max(2,Math.floor((to-from)/45));let best=ideal,bestScore=-1;
  try{for(let y=from;y<=to;y+=step){const data=ctx.getImageData(0,y,canvas.width,1).data;let bright=0,variance=0,count=0;for(let x=0;x<data.length;x+=64){const v=(data[x]+data[x+1]+data[x+2])/3;bright+=v;variance+=Math.abs(v-245);count++;}const score=bright/count-variance/count*.35-Math.abs(y-ideal)/range*8;if(score>bestScore){bestScore=score;best=y;}}}catch{return ideal;}return Math.max(start+10,Math.min(maxY,best));
}
function p2AutoSegments(canvas,firstHasHeader,layout=P2_LETTER){
  const segments=[];let y=0,page=0;
  while(y<canvas.height){const maxPt=firstHasHeader&&page===0?layout.content.firstH:layout.content.nextH,drawPt=Math.min(layout.content.w,canvas.width/2),target=Math.max(1,Math.floor(maxPt*canvas.width/drawPt)),end=p2SmartBreak(canvas,y,target,canvas.height);segments.push({y,height:end-y});y=end;page++;}
  return segments;
}
function p2ManualSegments(canvas,ratios){const points=[0,...(ratios||[]).filter(r=>r>.02&&r<.98).sort((a,b)=>a-b).map(r=>Math.round(r*canvas.height)),canvas.height],out=[];for(let i=0;i<points.length-1;i++)if(points[i+1]>points[i])out.push({y:points[i],height:points[i+1]-points[i]});return out;}
function p2DrawSegment(ctx,source,segment,hasHeader,scale,layout=P2_LETTER){
  const L=layout.content,left=L.x,top=hasHeader?L.firstTop:L.nextTop,maxW=L.w,maxH=hasHeader?L.firstH:L.nextH,ratio=Math.min(1,maxW/(source.width/2),maxH/(segment.height/2)),drawW=source.width/2*ratio,drawH=segment.height/2*ratio;
  ctx.drawImage(source,0,segment.y,source.width,segment.height,left+(maxW-drawW)/2,top,drawW,drawH);
}
async function p2GeneratePages(entry,images,values,quality='standard',preview=false,format='letter'){
  const project=getActiveProject(),layout=p2Layout(format),scale=preview?1:(quality==='high'?3:2),media=await p2FindMediaLogo(entry),client=await p2GetProjectAsset(project,'client'),agency=await p2GetProjectAsset(project,'agency'),assets={media,client,agency},pages=[];
  for(let imageIndex=0;imageIndex<images.length;imageIndex++){
    const item=images[imageIndex],source=await p2ProcessedCanvas(item,1),manual=(item.transform&&item.transform.breakRatios)||[],segments=manual.length?p2ManualSegments(source,manual):p2AutoSegments(source,imageIndex===0,layout);
    for(let segmentIndex=0;segmentIndex<segments.length;segmentIndex++){
      const hasHeader=imageIndex===0&&segmentIndex===0,{canvas,ctx}=p2Canvas(scale,layout);if(hasHeader)await p2DrawHeader(ctx,entry,values,assets,project,layout);p2DrawSegment(ctx,source,segments[segmentIndex],hasHeader,scale,layout);await p2DrawFooter(ctx,agency,Boolean(project.logoWhiteTransparent),layout);pages.push({dataUrl:canvas.toDataURL('image/jpeg',quality==='high'?.96:.9),width:canvas.width,height:canvas.height});
    }
  }
  return{pages,mediaLogo:media,assets};
}

async function p2GenerateStandardPages(entry,images,quality='standard',preview=false){
  const values={publication:entry.pub,date:entry.date,link:entry.link||entry.url,prValue:entry.prValue,duration:entry.duration||''};return p2GeneratePages(entry,images,values,quality,preview,'a4');
}

exportCapturePDF=async function(){
  if(!_captureEntryId||!_captureImages.length)return;await openPdfPreview(_captureEntryId);
};
async function openPdfPreview(entryId,fromBatch=false){
  const entry=entries.find(e=>e.id===Number(entryId));if(!entry)return;
  if(_captureEntryId!==entry.id){const record=await getCaptureRecord(_activeProj,entry.id);_captureImages=Array.isArray(record.images)?record.images:[];}
  p2PreviewEntryId=entry.id;document.getElementById('pdfPreviewModal').style.display='flex';
  document.getElementById('previewPublication').value=entry.pub||'';document.getElementById('previewDate').value=entry.date||'';document.getElementById('previewLink').value=entry.url||'';document.getElementById('previewPrValue').value=entry.prValue||'';document.getElementById('previewDuration').value=entry.duration||'';document.getElementById('previewDurationWrap').style.display=entry.platform==='TV'?'':'none';
  const quality=document.getElementById('captureQuality'),template=document.getElementById('captureTemplate');document.getElementById('previewQuality').value=(quality&&quality.value)||'standard';document.getElementById('previewTemplate').value=(template&&template.value)||getActiveProject().pdfTemplate||'news';document.getElementById('pdfPreviewMeta').textContent=entry.platform+' · '+_captureImages.length+' Capture';
  await p2RenderPdfPreview();
}
function closePdfPreview(){document.getElementById('pdfPreviewModal').style.display='none';p2PreviewEntryId=null;p2PreviewPages=[];p2PreviewReady=false;}
function p2PreviewValues(){return{publication:(document.getElementById('previewPublication').value||'').trim(),date:document.getElementById('previewDate').value||'',link:(document.getElementById('previewLink').value||'').trim(),prValue:Number(document.getElementById('previewPrValue').value)||0,duration:(document.getElementById('previewDuration').value||'').trim()};}
function queuePdfPreviewRender(){clearTimeout(p2PreviewTimer);p2PreviewTimer=setTimeout(p2RenderPdfPreview,220);}
async function p2RenderPdfPreview(){
  const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;const busy=document.getElementById('pdfPreviewBusy'),list=document.getElementById('pdfPageList'),download=document.getElementById('pdfDownloadBtn');busy.style.display='flex';download.disabled=true;p2PreviewReady=false;
  try{
    const values=p2PreviewValues(),effective={...entry,...values,pub:values.publication,url:values.link},template=document.getElementById('previewTemplate').value||'news',quality=document.getElementById('previewQuality').value,result=template==='standard'?await p2GenerateStandardPages(effective,_captureImages,quality,true):await p2GeneratePages(effective,_captureImages,values,quality,true);p2PreviewPages=result.pages;document.getElementById('pdfPreviewEyebrow').textContent=template==='standard'?'A4 PROOF':'LETTER PROOF';document.getElementById('pdfPreviewTitle').textContent=template==='standard'?'NEWSCLIPPING A4 Preview':'NEWSCLIPPING Preview';
    const ratio=template==='standard'?'595.28/841.89':'612/792';list.innerHTML=result.pages.map((page,i)=>'<article class="pdf-page" data-page="'+(i+1)+'" style="aspect-ratio:'+ratio+'"><img src="'+escAttr(page.dataUrl)+'" alt="หน้าที่ '+(i+1)+'"></article>').join('');
    const logoState=document.getElementById('previewLogoState');if(result.mediaLogo){const locked=Boolean(entry.logoLockedAssetId);logoState.className='preview-logo-state ok';logoState.innerHTML='✓ โลโก้สื่อ: <strong>'+esc(result.mediaLogo.name)+'</strong><br>'+(locked?'ล็อกไว้สำหรับข่าวนี้':'อ้างอิงโลโก้ล่าสุดจาก Media DB')+'<br><button type="button" onclick="toggleEntryLogoLock()">'+(locked?'ปลดล็อกโลโก้':'ล็อกโลโก้สำหรับข่าวนี้')+'</button>';p2PreviewReady=true;}else{logoState.className='preview-logo-state warn';logoState.innerHTML='⚠ ยังไม่มีโลโก้สื่อ<br><button type="button" onclick="openLogoManager()">ค้นหาและบันทึกโลโก้</button>';}
    const file=template==='standard'?buildOutputFileName(effective.date,effective.pub,effective.platform,getActiveProject()):p2OutputFileName(effective,values.publication);document.getElementById('pdfPreviewFileName').textContent=file;document.getElementById('pdfPreviewStatus').textContent=result.pages.length+' หน้า · '+(template==='standard'?'A4':'Letter');download.disabled=!p2PreviewReady;
  }catch(err){list.innerHTML='<div class="logo-empty">จัดหน้าไม่สำเร็จ: '+esc(err.message)+'</div>';document.getElementById('pdfPreviewStatus').textContent=err.message;}
  finally{busy.style.display='none';}
}
async function downloadPreviewPdf(){
  if(!p2PreviewReady)return;const entry=entries.find(e=>e.id===p2PreviewEntryId);if(!entry)return;const button=document.getElementById('pdfDownloadBtn'),values=p2PreviewValues(),quality=document.getElementById('previewQuality').value,template=document.getElementById('previewTemplate').value||'news';button.disabled=true;button.textContent='กำลังสร้าง…';
  try{const effective={...entry,...values,pub:values.publication,url:values.link},result=template==='standard'?await p2GenerateStandardPages(effective,_captureImages,quality,false):await p2GeneratePages(effective,_captureImages,values,quality,false),file=template==='standard'?buildOutputFileName(effective.date,effective.pub,effective.platform,getActiveProject()):p2OutputFileName(effective,values.publication),pageW=template==='standard'?595.28:612,pageH=template==='standard'?841.89:792;downloadLocalBlob(buildImagePDFBlob(result.pages,pageW,pageH,0),file);const idx=entries.findIndex(e=>e.id===entry.id);entries[idx]={...entries[idx],status:entries[idx].status==='completed'?'completed':'ready',pdfGeneratedAt:new Date().toISOString(),fileName:file,updatedAt:new Date().toISOString()};saveProjEntries(_activeProj,entries);renderTable();document.getElementById('pdfPreviewStatus').textContent='ดาวน์โหลด '+file+' แล้ว';toast('✓ ดาวน์โหลด PDF แล้ว','ok');}
  catch(err){toast('สร้าง PDF ไม่สำเร็จ: '+err.message,'err');}
  finally{button.disabled=false;button.textContent='ดาวน์โหลด PDF';}
}

async function openBatchExport(){
  const chosen=entries.filter(e=>p2SelectedIds.has(Number(e.id)));if(!chosen.length){toast('เลือกรายการข่าวก่อน','err');return;}
  const template=getActiveProject().pdfTemplate||'news';document.getElementById('batchPdfModal').style.display='flex';document.getElementById('batchCardGrid').innerHTML='<div class="logo-empty">กำลังตรวจ '+chosen.length+' รายการ…</div>';p2BatchRows=[];
  for(let i=0;i<chosen.length;i++){
    const entry=chosen[i];let images=[],logo=null,preview='';
    try{const record=await getCaptureRecord(_activeProj,entry.id);images=Array.isArray(record.images)?record.images:[];logo=await p2FindMediaLogo(entry);if(images.length){const values={publication:entry.pub,date:entry.date,link:entry.url,prValue:entry.prValue,duration:entry.duration||''},result=template==='standard'?await p2GenerateStandardPages(entry,images,'standard',true):await p2GeneratePages(entry,images,values,'standard',true);preview=result.pages[0]&&result.pages[0].dataUrl;}}
    catch(err){console.warn('[ClipKit] ตรวจ Batch ไม่สำเร็จ',entry.pub,err);}
    const issues=[];if(!images.length)issues.push('ไม่มี Capture');if(!logo)issues.push('ไม่มีโลโก้สื่อ');if(!entry.date||!entry.pub||!entry.platform)issues.push('ข้อมูลไม่ครบ');if(entry.prValue===null||entry.prValue===undefined||entry.prValue==='')issues.push('ไม่มี PR Value');p2BatchRows.push({entry,images,logo,preview,issues,template});
    document.getElementById('batchPdfSummary').textContent='ตรวจแล้ว '+(i+1)+'/'+chosen.length;
  }
  refreshBatchExport();
}
function closeBatchExport(){document.getElementById('batchPdfModal').style.display='none';p2BatchRows=[];}
function refreshBatchExport(){
  const grid=document.getElementById('batchCardGrid'),skip=document.getElementById('batchSkipInvalid').checked,invalid=p2BatchRows.filter(r=>r.issues.length),ready=p2BatchRows.length-invalid.length;
  document.getElementById('batchPdfSummary').textContent=ready+' พร้อม · '+invalid.length+' ต้องตรวจสอบ';
  grid.innerHTML=p2BatchRows.map(row=>{const name=row.template==='standard'?buildOutputFileName(row.entry.date,row.entry.pub,row.entry.platform,getActiveProject()):p2OutputFileName(row.entry);return '<article class="batch-card '+(row.issues.length?'invalid':'ready')+'"><div class="batch-card-preview">'+(row.preview?'<img src="'+escAttr(row.preview)+'" alt="หน้าแรก">':'NO PREVIEW')+'</div><div class="batch-card-info"><strong>'+esc(row.entry.pub)+'</strong><span>'+esc(name)+'</span><span>'+row.images.length+' Capture · '+esc(row.entry.platform)+' · '+(row.template==='standard'?'A4':'Letter')+'</span><div class="batch-card-status">'+(row.issues.length?'⚠ '+esc(row.issues.join(' · ')):'✓ พร้อมสร้าง PDF')+'</div><button type="button" onclick="previewBatchEntry('+row.entry.id+')">เปิด Preview</button></div></article>';}).join('');
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
async function downloadBatchZip(){
  const skip=document.getElementById('batchSkipInvalid').checked,rows=p2BatchRows.filter(r=>!r.issues.length),button=document.getElementById('batchDownloadBtn'),quality=document.getElementById('batchQuality').value;button.disabled=true;button.textContent='กำลังสร้าง…';const files=[],summary=[['File Name','Publication','Platform','Date','Pages','Status']];
  try{
    for(let i=0;i<rows.length;i++){
      const row=rows[i],entry=row.entry,values={publication:entry.pub,date:entry.date,link:entry.url,prValue:entry.prValue,duration:entry.duration||''};document.getElementById('batchStatus').textContent='กำลังสร้าง '+(i+1)+'/'+rows.length+' · '+entry.pub;
      const result=row.template==='standard'?await p2GenerateStandardPages(entry,row.images,quality,false):await p2GeneratePages(entry,row.images,values,quality,false),fileName=row.template==='standard'?buildOutputFileName(entry.date,entry.pub,entry.platform,getActiveProject()):p2OutputFileName(entry),pageW=row.template==='standard'?595.28:612,pageH=row.template==='standard'?841.89:792,pdf=buildImagePDFBlob(result.pages,pageW,pageH,0);files.push({name:fileName,data:new Uint8Array(await pdf.arrayBuffer())});summary.push([fileName,entry.pub,entry.platform,entry.date,result.pages.length,'exported']);
      const idx=entries.findIndex(e=>e.id===entry.id);if(idx>=0)entries[idx]={...entries[idx],status:entries[idx].status==='completed'?'completed':'ready',pdfGeneratedAt:new Date().toISOString(),fileName,updatedAt:new Date().toISOString()};
    }
    if(skip)for(const row of p2BatchRows.filter(r=>r.issues.length))summary.push([row.template==='standard'?buildOutputFileName(row.entry.date,row.entry.pub,row.entry.platform,getActiveProject()):p2OutputFileName(row.entry),row.entry.pub,row.entry.platform,row.entry.date,0,'skipped: '+row.issues.join('; ')]);
    const csv='\ufeff'+summary.map(row=>row.map(p2CsvCell).join(',')).join('\r\n');files.push({name:'export-summary.csv',data:p2Bytes(csv)});const zipName='ClipKit_PDF_'+new Date().toISOString().slice(0,10)+'.zip';downloadLocalBlob(p2Zip(files),zipName);saveProjEntries(_activeProj,entries);renderTable();document.getElementById('batchStatus').textContent='สร้าง '+rows.length+' PDF แล้ว';toast('✓ ดาวน์โหลด '+zipName,'ok');
  }catch(err){toast('สร้าง Batch ไม่สำเร็จ: '+err.message,'err');document.getElementById('batchStatus').textContent=err.message;}
  finally{button.disabled=false;button.textContent='สร้าง ZIP';}
}

async function p2AllCaptureRecords(){try{const db=await openCaptureDB();return await new Promise((resolve,reject)=>{const req=db.transaction(CAPTURE_STORE,'readonly').objectStore(CAPTURE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return[];}}
async function p2ReplaceCaptureRecords(records){const db=await openCaptureDB();await new Promise((resolve,reject)=>{const tx=db.transaction(CAPTURE_STORE,'readwrite'),store=tx.objectStore(CAPTURE_STORE);store.clear();(records||[]).forEach(r=>store.put(r));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
const p2BaseExportBackup=exportBackup,p2BaseRestoreBackup=restoreBackup;
exportBackup=async function(){
  try{const payload={format:'ClipKit ZIP Backup',version:1,exportedAt:new Date().toISOString(),core:collectBackup(),phase2:{global:p2Global(),assets:await p2StoreAll('assets'),mappings:await p2StoreAll('mappings'),captures:await p2AllCaptureRecords()}},name='ClipKit_Backup_'+new Date().toISOString().slice(0,10)+'.zip';downloadLocalBlob(p2Zip([{name:'backup.json',data:p2Bytes(JSON.stringify(payload))}]),name);toast('✓ สำรองข้อมูลพร้อมภาพและโลโก้แล้ว','ok');}catch(err){console.error(err);toast('สำรองข้อมูลไม่สำเร็จ: '+err.message,'err');}
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
  try{const files=p2ReadStoredZip(new Uint8Array(await file.arrayBuffer())),raw=files['backup.json'];if(!raw)throw new Error('ไม่พบ backup.json ใน ZIP');const payload=JSON.parse(new TextDecoder().decode(raw));if(!payload.core||!payload.phase2)throw new Error('รูปแบบ ZIP Backup ไม่ถูกต้อง');if(!confirm('กู้คืน '+file.name+'?\nข้อมูล Project, Capture และโลโก้ปัจจุบันจะถูกแทนที่'))return;await p2RestoreCore(payload.core);await p2StoreClear('assets');await p2StoreClear('mappings');for(const asset of payload.phase2.assets||[])await p2StorePut('assets',asset);for(const mapping of payload.phase2.mappings||[])await p2StorePut('mappings',mapping);await p2ReplaceCaptureRecords(payload.phase2.captures||[]);p2SaveGlobal(payload.phase2.global||{});rebuildDB();rebuildUrlHistory();updProjBtn();syncPlatOptions();renderCustomPlatChips();renderTable();renderRecent();updBadge();toast('✓ กู้คืนข้อมูลพร้อมภาพและโลโก้แล้ว','ok');closeSettings();}
  catch(err){toast('กู้คืนไม่สำเร็จ: '+err.message,'err');}
};

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('captureTemplate').addEventListener('change',event=>{const entry=entries.find(e=>e.id===_captureEntryId),file=document.getElementById('captureFileName');if(entry&&file)file.textContent=event.target.value==='standard'?buildOutputFileName(entry.date,entry.pub,entry.platform,getActiveProject()):p2OutputFileName(entry);const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].pdfTemplate=event.target.value;saveProjectList(projects);}});
  document.getElementById('captureQuality').addEventListener('change',event=>{const projects=getAllProjects(),idx=projects.findIndex(p=>p.id===_activeProj);if(idx>=0){projects[idx].pdfQuality=event.target.value;saveProjectList(projects);}});
  p2SyncSelection();
});
