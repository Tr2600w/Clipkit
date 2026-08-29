(function (global) {
  'use strict';
  const db = global.ClipKitDB;
  const stores = ['projects','entries','media','platforms','domainMappings','usernameMappings','mediaAliases','logoMappings','assets','captures','exportJobs','directories','stagingAssets','auditEvents'];
  const all = (store) => db.run(store, 'readonly', t => db.request(t.objectStore(store).getAll()));
  async function snapshot() { const out={}; for (const s of stores) out[s]=await all(s); return out; }
  function issue(code, message, record) { return {code, message, store:record && record.store || null, id:record && (record.id || record.key) || null}; }
  async function sha256(blob) {
    if (!blob || !global.crypto || !global.crypto.subtle) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return [...new Uint8Array(await global.crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
  }
  async function quickCheck() {
    const warnings=[]; const meta=await all('meta');
    const active=meta.find(r=>r.key==='migration:v1:active'); if (active) warnings.push(issue('MIGRATION_ACTIVE','Migration is still active',active));
    const now=Date.now(); for (const r of await all('stagingAssets')) if (r.expiresAt && new Date(r.expiresAt).getTime() < now) warnings.push(issue('STAGING_EXPIRED','Expired staged asset',r));
    const storage=global.ClipKitStorage ? await global.ClipKitStorage.getStatus() : null;
    if (storage && storage.level==='critical') warnings.push(issue('STORAGE_CRITICAL','Storage quota is critical'));
    return {status:warnings.some(x=>x.code==='MIGRATION_ACTIVE')?'blocked':warnings.length?'warning':'healthy', issues:warnings, storage};
  }
  async function deepAudit() {
    const data=await snapshot(), issues=[]; const assets=new Set(data.assets.map(r=>r.id));
    for (const store of ['entries','projects','captures','exportJobs','logoMappings']) for (const r of data[store]) for (const key of ['assetId','logoLockAssetId','templateAssetId','projectAssetId','clientLogoAssetId','agencyLogoAssetId']) if (r[key] && !assets.has(r[key])) issues.push(issue('MISSING_ASSET_REFERENCE',`${key} references missing asset`,{store,id:r.id}));
    const staged=new Set(data.stagingAssets.map(r=>r.id)); for (const r of data.logoMappings) if (r.assetId && staged.has(r.assetId)) issues.push(issue('STAGED_ASSET_REFERENCE','Mapping references unpromoted staged asset',{store:'logoMappings',id:r.id}));
    const groups=new Map(); for (const r of data.logoMappings) { const k=`${r.mediaId}|${r.platformId||''}`; if(groups.has(k)) issues.push(issue('DUPLICATE_MAPPING','Multiple current mappings for same scope',{store:'logoMappings',id:r.id})); else groups.set(k,r); }
    for (const store of ['entries']) for (const field of ['urlFingerprint','platformContentId']) { const seen=new Map(); for (const r of data[store]) if(r[field]) { if(seen.has(r[field])) issues.push(issue('DUPLICATE_'+field.toUpperCase(),`Duplicate ${field}`,{store,id:r.id})); else seen.set(r[field],r.id); } }
    for (const r of data.assets) if (r.blob) { const actual=await sha256(r.blob); if (!r.sha256 || r.sha256 !== actual || Number(r.byteLength)!==Number(r.blob.size)) issues.push(issue('BAD_CHECKSUM_METADATA','Asset checksum metadata does not match Blob',{store:'assets',id:r.id})); }
    const referenced = new Set(); for (const store of ['entries','projects','captures','exportJobs','logoMappings']) for (const r of data[store]) for (const key of ['assetId','logoLockAssetId','templateAssetId','clientLogoAssetId','agencyLogoAssetId']) if(r[key]) referenced.add(r[key]);
    for (const r of data.assets) if (!referenced.has(r.id) && !r.deletedAt) issues.push(issue('ORPHAN_ASSET','Asset is not referenced by a current record',{store:'assets',id:r.id}));
    for (const r of data.exportJobs) if (r.assetId && !assets.has(r.assetId)) issues.push(issue('EXPORT_ASSET_MISSING','Export job references missing asset',{store:'exportJobs',id:r.id}));
    for (const r of data.auditEvents) if (r.revision != null && r.revision < 1) issues.push(issue('AUDIT_REVISION_CHAIN','Audit revision is invalid',{store:'auditEvents',id:r.id}));
    return {status:issues.length?'warning':'healthy', issues, checkedStores:stores, repairSuggestions:issues.map(i=>({code:i.code,action:'review-and-repair-explicitly'}))};
  }
  global.ClipKitIntegrity={quickCheck,deepAudit};
}(globalThis));
