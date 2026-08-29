import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

class FakeChannel {
  static channels = new Set();
  constructor() { this.onmessage = null; FakeChannel.channels.add(this); }
  postMessage(data) { for (const peer of FakeChannel.channels) if (peer !== this && peer.onmessage) peer.onmessage({data}); }
  close() { FakeChannel.channels.delete(this); }
}

async function setup(tag) {
  const database = await freshDatabase(tag);
  loadDataScript(database.context, 'data/clipkit-db.js');
  loadDataScript(database.context, 'data/concurrency.js');
  await database.context.ClipKitDB.open();
  return database;
}

test('foreign change invalidates and refetches without forwarding payload', async () => {
  FakeChannel.channels.clear();
  const database = await setup('concurrency-message');
  const seen = await new Promise((resolve) => {
    const first = database.context.ClipKitConcurrency.start({tabId: 'one', BroadcastChannel: FakeChannel, refetch: async () => ({recordVersion: 3}) , onChange: resolve});
    const second = database.context.ClipKitConcurrency.start({tabId: 'two', BroadcastChannel: FakeChannel});
    second.publish({entityType: 'entries', entityId: 'e1', revision: 3, payload: 'must-not-cross'});
    setTimeout(() => { first.stop(); second.stop(); }, 20);
  });
  assert.equal(seen.currentRecord.recordVersion, 3);
  assert.equal(Object.hasOwn(seen, 'record'), true);
  assert.equal(seen.record, undefined);
  await database.cleanup();
});

test('revision guard rejects stale records and accepts the current revision', async () => {
  const database = await setup('concurrency-revision');
  const api = database.context.ClipKitConcurrency;
  assert.equal(api.checkRevision({id: 'e1', recordVersion: 2}, 2), true);
  assert.throws(() => api.checkRevision({id: 'e1', recordVersion: 2}, 1), (error) => error.conflict === true && error.currentRecord.recordVersion === 2);
  await database.cleanup();
});

test('expired locks are reclaimed while a live foreign lock blocks', async () => {
  const database = await setup('concurrency-locks');
  const clockState = {value: 100000};
  const clock = {now: () => clockState.value};
  const first = database.context.ClipKitConcurrency.start({tabId: 'one', clock});
  const lock = await first.acquireLock('entry', 'e1', 50);
  await assert.rejects(() => database.context.ClipKitConcurrency.acquireLock('entry', 'e1', 50, {tabId: 'two', clock}), (error) => error.code === 'LOCKED');
  clockState.value = 200000;
  const reclaimed = await database.context.ClipKitConcurrency.acquireLock('entry', 'e1', 50, {tabId: 'two', clock});
  assert.notEqual(reclaimed.id, lock.id);
  await database.cleanup();
});
