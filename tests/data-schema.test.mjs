import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

test('schema creates stores and compound indexes', async () => {
  const {context, cleanup} = await freshDatabase('schema');
  loadDataScript(context, 'data/clipkit-db.js');
  const db = await context.ClipKitDB.open();
  for (const name of ['meta','projects','entries','media','assets','captures','auditEvents','exportJobs','locks']) {
    assert.equal(db.objectStoreNames.contains(name), true, name);
  }
  const tx = db.transaction('entries', 'readonly');
  const indexes = tx.objectStore('entries').indexNames;
  assert.equal(indexes.contains('byProjectDate'), true);
  assert.equal(indexes.contains('byUrlFingerprint'), true);
  assert.equal(indexes.contains('byPlatformContentId'), true);
  await cleanup();
});
