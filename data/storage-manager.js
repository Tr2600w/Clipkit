(function (global) {
  'use strict';
  const db = global.ClipKitDB;
  const all = (store) => db.run(store, 'readonly', t => db.request(t.objectStore(store).getAll()));
  async function getStatus() {
    const estimate = global.navigator && global.navigator.storage && global.navigator.storage.estimate;
    if (typeof estimate !== 'function') return {supported:false, usage:null, quota:null, ratio:null, level:'unknown', persistence:'unsupported'};
    const value = await estimate.call(global.navigator.storage) || {};
    const usage = Number(value.usage) || 0, quota = Number(value.quota) || 0, ratio = quota ? usage / quota : 0;
    return {supported:true, usage, quota, ratio, level:ratio >= .85 ? 'critical' : ratio >= .70 ? 'warning' : 'healthy', persistence: await persistenceState()};
  }
  async function persistenceState() {
    const storage = global.navigator && global.navigator.storage;
    if (!storage || typeof storage.persisted !== 'function') return 'unsupported';
    try { return (await storage.persisted()) ? 'granted' : 'denied'; } catch (_) { return 'denied'; }
  }
  async function requestPersistence() {
    const storage = global.navigator && global.navigator.storage;
    if (!storage || typeof storage.persist !== 'function') return 'unsupported';
    try { return (await storage.persist()) ? 'granted' : 'denied'; } catch (_) { return 'denied'; }
  }
  async function listCleanupCandidates() {
    const result = [];
    for (const row of await all('stagingAssets')) if (row.expiresAt && new Date(row.expiresAt) <= new Date()) result.push({store:'stagingAssets', id:row.id, reason:'expired-staging'});
    for (const row of await all('drafts')) if (row.expiresAt && new Date(row.expiresAt) <= new Date()) result.push({store:'drafts', id:row.id, reason:'expired-draft'});
    const referenced = new Set();
    const collect = (value, key = '') => { if (!value || typeof value !== 'object') return; for (const [k,v] of Object.entries(value)) { if (v && /assetid$/i.test(k)) referenced.add(v); if (v && typeof v === 'object') collect(v,k); } };
    for (const store of ['logoMappings','entries','projects','captures','exportJobs','exportJobs','provenance','auditEvents']) for (const row of await all(store).catch(()=>[])) collect(row);
    for (const row of await all('assets')) if (row.deletedAt && !referenced.has(row.id)) result.push({store:'assets', id:row.id, reason:'deleted-unreferenced'});
    return result;
  }
  global.ClipKitStorage = {getStatus, requestPersistence, listCleanupCandidates};
}(globalThis));
