(function (global) {
  'use strict';
  const db = global.ClipKitDB;
  const stores = ['meta','projects','entries','media','mediaAliases','domainMappings','usernameMappings','platforms','mediaPlatformMappings','logoMappings','assets','captures','inspections','provenance','auditEvents','exportJobs','drafts','stagingAssets','importReports'];
  const excluded = new Set(['handle','directoryHandle','credentials','resolverCredentials','googleCredentials','cookies','token','password','secret']);
  const textEncoder = () => new global.TextEncoder();
  const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
  const hex = value => [...bytes(value)].map(x => x.toString(16).padStart(2,'0')).join('');
  async function digest(value) { return hex(await global.crypto.subtle.digest('SHA-256', bytes(value))); }
  function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== 'object' || value instanceof global.Blob) return value;
    const out = {};
    Object.keys(value).sort().forEach(k => { if (!excluded.has(k.toLowerCase())) out[k] = clean(value[k]); });
    return out;
  }
  function json(value) { return textEncoder().encode(JSON.stringify(value)); }
  function defaultCodec() { throw new Error('ClipKitBackup requires an encodeZip/decodeZip adapter'); }
  function deps(options) { return Object.assign({encodeZip: defaultCodec, decodeZip: defaultCodec, now: () => new Date().toISOString(), uuid: () => global.crypto.randomUUID()}, options || {}); }
  function normalizeScope(scope) {
    if (scope && typeof scope === 'object' && Array.isArray(scope.stores)) return scope;
    const value = String(scope || 'all').toLowerCase();
    if (value === 'projects') return {stores:['projects','entries','media','mediaAliases','domainMappings','usernameMappings','platforms','mediaPlatformMappings','logoMappings','directories']};
    if (value === 'assets') return {stores:['assets','captures','stagingAssets']};
    if (value === 'settings') return {stores:['meta','directories','platforms']};
    return {stores};
  }
  async function readStores(scope) {
    const wanted = normalizeScope(scope).stores;
    const result = {};
    for (const name of wanted.filter(n => stores.includes(n)).sort()) result[name] = await db.run(name, 'readonly', t => db.request(t.objectStore(name).getAll()));
    return result;
  }
  async function encrypt(data, password, salt) {
    const key = await global.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'}, await global.crypto.subtle.importKey('raw',textEncoder().encode(password),{name:'PBKDF2'},false,['deriveKey']), {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    return {iv: hex(iv), data: bytes(await global.crypto.subtle.encrypt({name:'AES-GCM',iv},key,data))};
  }
  async function decrypt(data, password, salt, iv) {
    if (!password) throw new Error('password is required');
    const key = await global.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'}, await global.crypto.subtle.importKey('raw',textEncoder().encode(password),{name:'PBKDF2'},false,['deriveKey']), {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
    const raw = new Uint8Array(String(iv).match(/../g).map(x => parseInt(x,16)));
    return bytes(await global.crypto.subtle.decrypt({name:'AES-GCM',iv:raw},key,data));
  }
  function fileMap(files) { const map = {}; for (const file of files || []) map[file.name] = bytes(file.data || file); return map; }
  async function create(options) {
    const d = deps(options), normalizedScope = normalizeScope(options && options.scope), data = await readStores(normalizedScope), files = [], checksums = {};
    const assetRecords = (data.assets || []).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    delete data.assets;
    for (const name of Object.keys(data).sort()) { const payload = json((data[name] || []).slice().sort((a,b)=>String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)))); files.push({name:`database/${name}.json`,data:payload}); }
    for (const asset of assetRecords) { if (!asset.blob) continue; const ext = String(asset.mime || 'application/octet-stream').split('/')[1] || 'bin'; files.push({name:`assets/${asset.assetKind === 'logo' ? 'logos' : 'captures'}/${asset.id}.${ext}`,data:bytes(await asset.blob.arrayBuffer())}); const meta = Object.assign({}, asset); delete meta.blob; data.assets = data.assets || []; data.assets.push(meta); }
    if (normalizedScope.stores.includes('assets')) files.push({name:'database/assets.json',data:json((data.assets || []).sort((a,b)=>String(a.id).localeCompare(String(b.id))))});
    const password = options && options.password; let salt = null;
    if (password) { salt = global.crypto.getRandomValues(new Uint8Array(16)); for (const f of files) { const enc = await encrypt(f.data,password,salt); f.data = enc.data; f.iv = enc.iv; } }
    for (const f of files) checksums[f.name] = await digest(f.data);
    const manifest = {format:'ClipKit ZIP Backup',version:1,appSchema:1,createdAt:d.now(),scope:normalizedScope,sourceInstallationId:options && options.sourceInstallationId || null,encrypted:Boolean(password),encryption:password ? {algorithm:'AES-GCM',kdf:'PBKDF2-SHA-256',iterations:120000,salt:hex(salt),files:Object.fromEntries(files.filter(f=>f.iv).map(f=>[f.name,f.iv]))} : null,recordCounts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),assetCount:assetRecords.length,exclusions:[...excluded].sort()};
    const manifestFile = {name:'manifest.json',data:json(manifest)}, checksumFile = {name:'checksums.json',data:json(Object.fromEntries(Object.entries(checksums).sort()))};
    return d.encodeZip([manifestFile,...files,checksumFile]);
  }
  async function inspect(file, options) {
    const d=deps(options), map=fileMap(await d.decodeZip(file)), manifest=JSON.parse(new global.TextDecoder().decode(map['manifest.json']||[]));
    if (manifest.format !== 'ClipKit ZIP Backup' || manifest.version !== 1) throw Object.assign(new Error('unsupported backup schema'),{code:'UNSUPPORTED_SCHEMA'});
    const checks=JSON.parse(new global.TextDecoder().decode(map['checksums.json']||[]));
    for (const [name, expected] of Object.entries(checks).sort()) { let payload=map[name]; if (!payload) throw Object.assign(new Error(`missing backup file: ${name}`),{code:'CORRUPT_BACKUP'}); if (manifest.encrypted) payload=await decrypt(payload,options && options.password,new Uint8Array(manifest.encryption.salt.match(/../g).map(x=>parseInt(x,16))),manifest.encryption.files[name]); if (await digest(map[name])) { /* ciphertext checksum */ } if (await digest(map[name]) !== expected) throw Object.assign(new Error(`checksum mismatch: ${name}`),{code:'CORRUPT_BACKUP'}); }
    return {valid:true,manifest,files:Object.keys(map).filter(k=>!['manifest.json','checksums.json'].includes(k)).sort(),recordCounts:manifest.recordCounts};
  }
  async function restore(file, options) {
    const d=deps(options), inspection=await inspect(file,options), map=fileMap(await d.decodeZip(file));
    const writes=[]; for (const name of inspection.files.filter(n=>n.startsWith('database/') && n.endsWith('.json')).sort()) { let payload=map[name]; if (inspection.manifest.encrypted) payload=await decrypt(payload,options && options.password,new Uint8Array(inspection.manifest.encryption.salt.match(/../g).map(x=>parseInt(x,16))),inspection.manifest.encryption.files[name]); const store=name.slice(9,-5); if (stores.includes(store)) writes.push([store,JSON.parse(new global.TextDecoder().decode(payload))]); }
    const assetRows = (writes.find(x=>x[0] === 'assets') || [null, []])[1];
    for (const asset of assetRows) {
      const prefix = `assets/${asset.assetKind === 'logo' ? 'logos' : 'captures'}/${asset.id}.`;
      const assetName = Object.keys(map).find(name => name.startsWith(prefix));
      if (assetName) { let payload=map[assetName]; if (inspection.manifest.encrypted) payload=await decrypt(payload,options && options.password,new Uint8Array(inspection.manifest.encryption.salt.match(/../g).map(x=>parseInt(x,16))),inspection.manifest.encryption.files[assetName]); asset.blob=new global.Blob([payload],{type:asset.mime || asset.type || 'application/octet-stream'}); }
    }
    const mode=options && options.mode || 'merge';
    if (mode === 'replace' && options && typeof options.createSafetyBackup === 'function') {
      const safety = await options.createSafetyBackup();
      if (!safety) throw Object.assign(new Error('safety backup failed; restore cancelled'), {code:'SAFETY_BACKUP_FAILED'});
    }
    const conflicts=[];
    for (const [store,rows] of writes) for (const row of rows) {
      const existing=await db.run(store,'readonly',t=>db.request(t.objectStore(store).get(row.id ?? row.key)));
      if (!existing) conflicts.push({store,id:row.id ?? row.key,type:'new',resolution:'use-backup'});
      else if (JSON.stringify(clean(existing))===JSON.stringify(clean(row))) conflicts.push({store,id:row.id ?? row.key,type:'same',resolution:'keep-existing'});
      else if (String(row.updatedAt||'')>String(existing.updatedAt||'')) conflicts.push({store,id:row.id ?? row.key,type:'newer',resolution:'keep-existing'});
      else if (String(row.updatedAt||'')<String(existing.updatedAt||'')) conflicts.push({store,id:row.id ?? row.key,type:'older',resolution:'keep-existing'});
      else conflicts.push({store,id:row.id ?? row.key,type:'diverged',resolution:'keep-existing'});
    }
    if (options && options.inspectOnly) return {valid:true,mode,conflicts,written:0};
    const resolutions=(options&&options.resolutions)||{};
    const unresolved=conflicts.filter(c=>c.type!=='new' && !resolutions[`${c.store}:${c.id}`] && !resolutions[c.store]);
    if (unresolved.length) return {valid:false,mode,written:0,conflicts,unresolved};
    const projectIds=new Set(options&&options.scope&&options.scope.projectIds||[]);
    const inScope=row=>!projectIds.size || !row.projectId || projectIds.has(row.projectId);
    return db.run(stores,'readwrite',async t=>{ let written=0;
      if (mode==='replace') for (const [store] of writes) { const object=t.objectStore(store), rows=await db.request(object.getAll()); for(const row of rows) if(inScope(row)) await db.request(object.delete(row.id ?? row.key)); }
      for (const [store,rows] of writes) for (const row of rows) { if(!inScope(row)) continue; const key=row.id ?? row.key, existing=await db.request(t.objectStore(store).get(key)); const conflict=conflicts.find(c=>c.store===store&&c.id===key); const choice=resolutions[`${store}:${key}`]||resolutions[store]||(mode==='replace'?'use-backup':null); if (!existing || choice==='use-backup') { await db.request(t.objectStore(store).put(row)); written+=1; } else if (choice==='duplicate') { const copy=Object.assign({},row,{id:`${key}-import-${d.uuid()}`}); await db.request(t.objectStore(store).put(copy)); written+=1; } }
      const report={id:`import-${d.uuid()}`,source:'import',mode,conflicts,unresolved:[],written,createdAt:d.now()}; await db.request(t.objectStore('importReports').put(report)); await db.request(t.objectStore('auditEvents').put({id:`audit-${d.uuid()}`,entityType:'backup',entityId:report.id,action:'restore',source:'import',after:report,createdAt:report.createdAt})); return {valid:true,mode,written,conflicts,unresolved:[]}; });
  }
  global.ClipKitBackup={create,inspect,restore};
}(globalThis));
