(function (global) {
  'use strict';

  const db = global.ClipKitDB;
  const DAY = 24 * 60 * 60 * 1000;
  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitLifecycle');

  const deps = (options) => ({
    now: options && options.now ? options.now : () => new Date().toISOString(),
    uuid: options && options.uuid ? options.uuid : () => global.crypto.randomUUID()
  });
  const stores = ['projects', 'entries', 'media', 'platforms', 'domainMappings', 'usernameMappings', 'mediaAliases', 'logoMappings', 'assets', 'captures', 'exportJobs', 'directories', 'stagingAssets'];
  const entity = (type) => ({
    projects: 'projects', project: 'projects', entries: 'entries', entry: 'entries', media: 'media', platforms: 'platforms', platform: 'platforms', assets: 'assets', asset: 'assets', captures: 'captures', capture: 'captures', exportJobs: 'exportJobs'
  }[type] || type);
  function keyOf(record, store) { return store === 'directories' ? record.key : record.id; }
  async function all(store) { return db.run(store, 'readonly', t => db.request(t.objectStore(store).getAll())); }
  function retentionDate(now, days) { return new Date(new Date(now).getTime() + (Number.isFinite(days) ? days : 30) * DAY).toISOString(); }

  async function refs(assetId) {
    if (global.ClipKitRepository && global.ClipKitRepository.assets && global.ClipKitRepository.assets.listReferences) return global.ClipKitRepository.assets.listReferences(assetId);
    const result = [];
    for (const store of ['logoMappings', 'entries', 'projects', 'captures', 'exportJobs']) for (const row of await all(store)) {
      if (JSON.stringify(row).includes(String(assetId))) result.push({store, id: row.id});
    }
    return result;
  }
  async function softDelete(type, id, options) {
    const store = entity(type), d = deps(options), now = d.now(), until = retentionDate(now, options && options.retentionDays), deletedBy = options && options.deletedBy || 'user';
    return db.run(store === 'projects' ? ['projects','entries','directories','auditEvents'] : [store,'auditEvents'], 'readwrite', async t => {
      const object = t.objectStore(store), row = await db.request(object.get(id));
      if (!row) throw new Error(`${store} ${id} was not found`);
      const next = Object.assign({}, row, {deletedAt: now, trashedAt: now, purgeAfter: until, deletedBy, updatedAt: now, recordVersion: (row.recordVersion || 0) + 1});
      await db.request(object.put(next));
      if (store === 'projects') {
        const entriesStore = t.objectStore('entries');
        for (const entry of await db.request(entriesStore.getAll())) if (entry.projectId === id && !entry.deletedAt) await db.request(entriesStore.put(Object.assign({}, entry, {deletedAt: now, trashedAt: now, purgeAfter: until, deletedBy, updatedAt: now, recordVersion: (entry.recordVersion || 0) + 1})));
        const dirs = t.objectStore('directories'), directory = await db.request(dirs.get(`directory:${id}`));
        if (directory) await db.request(dirs.put(Object.assign({}, directory, {handle: null, needsPermission: true, updatedAt: now})));
      }
      await db.request(t.objectStore('auditEvents').add({id:`lifecycle-${d.uuid()}`,entityType:store,entityId:id,action:'soft-delete',source:'lifecycle',before:row,after:next,createdAt:now}));
      return next;
    });
  }
  async function restore(type, id, options) {
    const store = entity(type), d = deps(options), now = d.now(), deletedBy = options && options.deletedBy || null;
    return db.run(store === 'projects' ? ['projects','entries','auditEvents'] : [store,'auditEvents'], 'readwrite', async t => {
      const object = t.objectStore(store), row = await db.request(object.get(id));
      if (!row) throw new Error(`${store} ${id} was not found`);
      const next = Object.assign({}, row, {deletedAt: null, trashedAt: null, purgeAfter: null, deletedBy, restoredAt: now, updatedAt: now, recordVersion: (row.recordVersion || 0) + 1});
      await db.request(object.put(next));
      if (store === 'projects') { const es=t.objectStore('entries'); for (const e of await db.request(es.getAll())) if (e.projectId===id && e.deletedAt) await db.request(es.put(Object.assign({},e,{deletedAt:null,trashedAt:null,purgeAfter:null,deletedBy,updatedAt:now,recordVersion:(e.recordVersion||0)+1}))); }
      await db.request(t.objectStore('auditEvents').add({id:`lifecycle-${d.uuid()}`,entityType:store,entityId:id,action:'restore',source:'lifecycle',before:row,after:next,createdAt:now})); return next;
    });
  }
  async function listTrash(options) {
    const type = options && options.type ? entity(options.type) : null;
    const rows = [];
    for (const store of (type ? [type] : stores)) if (['projects','entries','media','platforms','assets','captures','exportJobs'].includes(store)) {
      for (const row of await all(store)) if (row.deletedAt) rows.push(Object.assign({}, row, {store, id: row.id}));
    }
    return rows.filter(row => !(options && options.projectId) || row.projectId === options.projectId)
      .filter(row => !(options && options.id) || String(row.id) === String(options.id))
      .sort((a,b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  }
  async function dryRun(options) {
    const now = new Date((options && options.now ? options.now() : new Date().toISOString())).getTime();
    const candidates = (await listTrash(options)).filter(r => !r.purgeAfter || new Date(r.purgeAfter).getTime() <= now);
    const blocked = [];
    for (const row of candidates) if (row.store === 'assets') { const references = await refs(row.id); if (references.length) blocked.push({record: row, references}); }
    return {candidates, blocked, deletable: candidates.filter(row => !blocked.some(item => item.record.store === row.store && item.record.id === row.id))};
  }
  async function purge(options) {
    const plan = await dryRun(options), removed = [], blocked = plan.blocked;
    const names = [...new Set(plan.deletable.map(row => row.store))];
    if (names.length) await db.run([...names,'auditEvents'], 'readwrite', async t => { for (const row of plan.deletable) { await db.request(t.objectStore(row.store).delete(row.id)); await db.request(t.objectStore('auditEvents').add({id:`lifecycle-${(deps(options).uuid)()}`,entityType:row.store,entityId:row.id,action:'permanent-delete',source:'lifecycle',before:row,after:null,createdAt:deps(options).now()})); removed.push(row); } });
    return {removed, blocked, candidates: plan.candidates};
  }
  async function deleteAsset(id, options) {
    const references = await refs(id);
    if (references.length) return {deleted: false, blocked: true, references};
    await db.run(['assets','auditEvents'], 'readwrite', async t => { await db.request(t.objectStore('assets').delete(id)); await db.request(t.objectStore('auditEvents').add({id:`lifecycle-${(deps(options).uuid)()}`,entityType:'assets',entityId:id,action:'permanent-delete',source:'lifecycle',before:null,after:null,createdAt:deps(options).now()})); });
    return {deleted: true, blocked: false, references};
  }
  async function directoryHandleRemoved(projectId, options) {
    const row = await global.ClipKitRepository.directories.getProjectConfig(projectId); if (!row) return null;
    return global.ClipKitRepository.directories.saveProjectConfig(projectId, Object.assign({}, row, {handle: null, needsPermission: true, directoryHandleRemovedAt: deps(options).now()}), options);
  }
  async function directoryHandleRestored(projectId, handle, options) {
    const row = await global.ClipKitRepository.directories.getProjectConfig(projectId); return global.ClipKitRepository.directories.saveProjectConfig(projectId, Object.assign({}, row || {}, {handle, needsPermission: false, directoryHandleRestoredAt: deps(options).now()}), options);
  }
  const moveEntryToTrash = (id, options) => softDelete('entry', id, options);
  const moveProjectToTrash = (id, options) => softDelete('project', id, options);
  async function emptyExpired(options) { if (options && options.dryRun) return dryRun(options); return purge(options); }
  global.ClipKitLifecycle = {softDelete, restore, listTrash, dryRun, purge, emptyExpired, moveEntryToTrash, moveProjectToTrash, deleteAsset, getAssetReferences: refs, directoryHandleRemoved, directoryHandleRestored};
}(globalThis));
