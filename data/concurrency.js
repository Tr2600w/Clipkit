(function (global) {
  'use strict';

  const db = global.ClipKitDB;
  const channels = new Set();
  const instances = new Set();

  function nowIso(clock) { return new Date((clock || Date).now()).toISOString(); }
  function makeId(tabId) { return `lock-${tabId}-${Math.random().toString(36).slice(2)}`; }
  function conflict(currentRecord) {
    const error = new Error('record revision conflict');
    error.code = 'REVISION_CONFLICT'; error.conflict = true; error.currentRecord = currentRecord || null;
    return error;
  }
  function checkRevision(currentRecord, expectedRevision) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('expectedRevision must be a positive integer');
    if (!currentRecord || currentRecord.recordVersion !== expectedRevision) throw conflict(currentRecord);
    return true;
  }
  function start(options) {
    const config = options || {};
    const tabId = String(config.tabId || `tab-${Math.random().toString(36).slice(2)}`);
    const clock = config.clock || Date;
    const Channel = config.BroadcastChannel || global.BroadcastChannel;
    const channel = Channel ? new Channel(config.channelName || 'clipkit-data') : null;
    const instance = {tabId, channel, onChange: config.onChange || (() => {}), onConflict: config.onConflict || (() => {})};
    if (channel) {
      channel.onmessage = async (event) => {
        const message = event && event.data;
        if (!message || message.sourceTabId === tabId || message.type !== 'change') return;
        let record;
        if (typeof config.refetch === 'function') {
          try { record = await config.refetch(message.entityType, message.entityId); }
          catch (error) { instance.onConflict(Object.assign({}, message, {error})); return; }
        }
        instance.onChange(Object.assign({}, message, {record: undefined, currentRecord: record}));
      };
      channels.add(channel);
    }
    instances.add(instance);
    return Object.assign(instance, {
      stop() { if (channel && channel.close) channel.close(); channels.delete(channel); instances.delete(instance); },
      publish(change) {
        const message = Object.assign({type: 'change', sourceTabId: tabId, committedAt: nowIso(clock)}, change || {});
        if (!message.entityType || !message.entityId) throw new Error('entityType and entityId are required');
        if (channel && channel.postMessage) channel.postMessage(message);
        return message;
      },
      acquireLock(resourceType, resourceId, ttlMs) {
        return acquireLock(resourceType, resourceId, ttlMs, {tabId, clock});
      },
      releaseLock
    });
  }
  function publish(change) {
    const message = Object.assign({type: 'change', sourceTabId: 'system', committedAt: nowIso(Date)}, change || {});
    for (const instance of instances) if (instance.channel && instance.channel.postMessage) instance.channel.postMessage(message);
    return message;
  }
  async function acquireLock(resourceType, resourceId, ttlMs, options) {
    if (!db) throw new Error('ClipKitDB is required');
    const config = options || {}; const tabId = String(config.tabId || 'default');
    const clock = config.clock || Date; const now = clock.now(); const ttl = Math.max(1, Number(ttlMs) || 30000);
    const lock = {id: config.lockId || makeId(tabId), resourceType: String(resourceType), resourceId: String(resourceId), tabId, acquiredAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl).toISOString()};
    return db.run('locks', 'readwrite', async (transaction) => {
      const store = transaction.objectStore('locks'); const rows = await db.request(store.getAll());
      const active = rows.find((row) => row.resourceType === lock.resourceType && row.resourceId === lock.resourceId && Date.parse(String(row.expiresAt)) > now && row.tabId !== tabId);
      if (active) return {error: Object.assign(new Error('resource is locked'), {code: 'LOCKED', lock: active})};
      for (const row of rows) if (!(Date.parse(String(row.expiresAt)) > now)) store.delete(row.id);
      await db.request(store.put(lock)); return {lock};
    }).then((result) => {
      if (result && result.error) throw result.error;
      return result && result.lock;
    });
  }
  function releaseLock(lockId) { return db.run('locks', 'readwrite', (transaction) => db.request(transaction.objectStore('locks').delete(lockId))); }
  global.ClipKitConcurrency = {start, publish, acquireLock, releaseLock, conflict, checkRevision, guard: checkRevision};
}(globalThis));
