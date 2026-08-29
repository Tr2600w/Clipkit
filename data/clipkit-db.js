(function (global) {
  'use strict';

  const DATABASE_NAME = 'clipkit-data';
  const DATABASE_VERSION = 1;
  const entityStores = [
    'projects',
    'entries',
    'media',
    'mediaAliases',
    'domainMappings',
    'usernameMappings',
    'platforms',
    'mediaPlatformMappings',
    'logoMappings',
    'assets',
    'captures',
    'inspections',
    'provenance',
    'auditEvents',
    'exportJobs',
    'drafts',
    'stagingAssets',
    'locks',
    'importReports'
  ];
  const keyedStores = ['meta', 'resolverCache', 'directories'];
  const openDatabases = new Set();

  function createStore(database, name, keyPath) {
    return database.objectStoreNames.contains(name)
      ? null
      : database.createObjectStore(name, {keyPath});
  }

  function createSchema(database) {
    for (const name of keyedStores) {
      createStore(database, name, 'key');
    }

    for (const name of entityStores) {
      createStore(database, name, 'id');
    }
  }

  function createIndexes(database, transaction) {
    const entries = transaction.objectStore('entries');
    entries.createIndex('byProjectDate', ['projectId', 'publishedDate']);
    entries.createIndex('byProjectStatus', ['projectId', 'workflowStatus']);
    entries.createIndex('byProjectPlatform', ['projectId', 'platformId']);
    entries.createIndex('byProjectPublication', ['projectId', 'publicationId']);
    entries.createIndex('byUrlFingerprint', 'urlFingerprint', {unique: false});
    entries.createIndex('byPlatformContentId', 'platformContentId', {unique: false});
    entries.createIndex('byUpdatedAt', 'updatedAt');
    entries.createIndex('byDeletedAt', 'deletedAt');

    const exportJobs = transaction.objectStore('exportJobs');
    exportJobs.createIndex('byExportBatchId', 'exportBatchId');
    exportJobs.createIndex('byEntryId', 'entryId');
    exportJobs.createIndex('byCreatedAt', 'createdAt');

    const logoMappings = transaction.objectStore('logoMappings');
    logoMappings.createIndex('byMediaPlatform', ['mediaId', 'platformId']);
    logoMappings.createIndex('byAssetId', 'assetId');
  }

  function open(options) {
    const config = options || {};
    const name = config.name || DATABASE_NAME;
    const version = config.version || DATABASE_VERSION;

    return new Promise((resolve, reject) => {
      const openRequest = global.indexedDB.open(name, version);
      openRequest.onupgradeneeded = () => {
        createSchema(openRequest.result);
        createIndexes(openRequest.result, openRequest.transaction);
      };
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        openDatabases.add(database);
        database.onversionchange = () => {
          database.close();
          openDatabases.delete(database);
        };
        resolve(database);
      };
      openRequest.onerror = () => reject(openRequest.error);
    });
  }

  function request(indexedDBRequest) {
    return new Promise((resolve, reject) => {
      indexedDBRequest.onsuccess = () => resolve(indexedDBRequest.result);
      indexedDBRequest.onerror = () => reject(indexedDBRequest.error);
    });
  }

  async function run(storeNames, mode, work) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, mode);
      let result;
      let callbackError;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || callbackError);

      try {
        result = work(transaction);
      } catch (error) {
        callbackError = error;
        transaction.abort();
      }
    });
  }

  async function deleteDatabase() {
    for (const database of openDatabases) {
      database.close();
    }
    openDatabases.clear();
    await request(global.indexedDB.deleteDatabase(DATABASE_NAME));
  }

  global.ClipKitDB = {open, run, request, deleteDatabase};
}(globalThis));
