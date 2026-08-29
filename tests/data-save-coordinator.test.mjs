import assert from 'node:assert/strict';
import test from 'node:test';
import {freshDatabase, loadDataScript} from './data-helpers.mjs';

async function saveContext(tag) {
  const database = await freshDatabase(tag);
  loadDataScript(database.context, 'data/clipkit-db.js');
  loadDataScript(database.context, 'data/records.js');
  loadDataScript(database.context, 'data/repository.js');
  loadDataScript(database.context, 'data/save-coordinator.js');
  return database;
}

function command() {
  return {
    requestId: 'request-1',
    entry: {projectId: 'p1', publicationId: 'm1', platformId: 'website', publishedDate: '2026-08-18'},
    media: null,
    aliases: [],
    mappings: [],
    provenance: [{id: 'prov-1', field: 'publicationId', value: 'm1', source: 'user', confirmedByUser: true}],
    inspection: null,
    source: 'user'
  };
}

async function storeRows(context, storeName) {
  return context.ClipKitDB.run(storeName, 'readonly', (transaction) =>
    context.ClipKitDB.request(transaction.objectStore(storeName).getAll()));
}

test('invalid mappings roll back an entry save before any store is written', async () => {
  const {context, cleanup} = await saveContext('save-rollback');
  try {
    const invalid = command();
    invalid.mappings = [{id: 'mapping-1', type: 'unknown'}];

    await assert.rejects(
      context.ClipKitSave.saveEntry(invalid),
      (error) => error.code === 'VALIDATION_FAILED'
    );

    for (const storeName of ['entries', 'provenance', 'auditEvents', 'meta']) {
      assert.deepEqual(await storeRows(context, storeName), [], `${storeName} was not rolled back`);
    }
  } finally {
    await cleanup();
  }
});

test('reusing a request ID returns the committed entry without duplicate writes', async () => {
  const {context, cleanup} = await saveContext('save-idempotency');
  try {
    const first = await context.ClipKitSave.saveEntry(command());
    const second = await context.ClipKitSave.saveEntry(command());

    assert.equal(second.entry.id, first.entry.id);
    assert.equal((await storeRows(context, 'entries')).length, 1);
    assert.equal((await storeRows(context, 'auditEvents')).length, 1);
    assert.equal((await storeRows(context, 'provenance')).length, 1);
    assert.equal((await storeRows(context, 'meta')).length, 1);
  } finally {
    await cleanup();
  }
});

test('entry updates increment the persisted revision and reject stale revisions', async () => {
  const {context, cleanup} = await saveContext('save-revisions');
  try {
    const saved = await context.ClipKitSave.saveEntry(command());
    const updated = await context.ClipKitSave.updateEntry(
      saved.entry.id,
      1,
      {headline: 'Updated headline'},
      'user'
    );

    assert.equal(updated.recordVersion, 2);
    assert.equal(updated.headline, 'Updated headline');
    await assert.rejects(
      context.ClipKitSave.updateEntry(saved.entry.id, 1, {headline: 'Stale update'}, 'user'),
      (error) => error.code === 'REVISION_CONFLICT'
    );
    assert.equal((await context.ClipKitRepository.audit.listForEntity('entry', saved.entry.id)).length, 2);
  } finally {
    await cleanup();
  }
});

test('generic entry patches reject protected and unknown fields', async () => {
  const {context, cleanup} = await saveContext('save-patch-validation');
  try {
    const saved = await context.ClipKitSave.saveEntry(command());
    for (const patch of [{id: 'different-id'}, {createdAt: '2020-01-01'}, {urlOriginal: 'https://changed.test'}, {madeUp: true}]) {
      await assert.rejects(
        context.ClipKitSave.updateEntry(saved.entry.id, 1, patch, 'user'),
        (error) => error.code === 'VALIDATION_FAILED'
      );
    }
    assert.equal((await context.ClipKitRepository.entries.get(saved.entry.id)).recordVersion, 1);
  } finally {
    await cleanup();
  }
});
