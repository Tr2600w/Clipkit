(function (global) {
  'use strict';

  const db = global.ClipKitDB;

  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitRepository');

  function genericRepository(storeName, keyName) {
    const key = keyName || 'id';
    return {
      get(id) {
        return db.run(storeName, 'readonly', (transaction) =>
          db.request(transaction.objectStore(storeName).get(id)));
      },
      put(record) {
        if (!record || record[key] == null) throw new Error(`${key} is required`);
        return db.run(storeName, 'readwrite', (transaction) => {
          const store = transaction.objectStore(storeName);
          return db.request(store.put(record)).then(() => record);
        });
      },
      delete(id) {
        return db.run(storeName, 'readwrite', (transaction) =>
          db.request(transaction.objectStore(storeName).delete(id)));
      },
      getAll() {
        return db.run(storeName, 'readonly', (transaction) =>
          db.request(transaction.objectStore(storeName).getAll()));
      }
    };
  }

  function getAllFromIndex(storeName, indexName, key) {
    return db.run(storeName, 'readonly', (transaction) =>
      db.request(transaction.objectStore(storeName).index(indexName).getAll(key)));
  }

  function compareCreatedAt(first, second) {
    return String(first.createdAt || '').localeCompare(String(second.createdAt || ''));
  }

  function queueOrder(first, second) {
    const dateComparison = String(second.publishedDate || '').localeCompare(String(first.publishedDate || ''));
    return dateComparison || compareCreatedAt(first, second);
  }

  const entries = Object.assign(genericRepository('entries'), {
    async listByProject(projectId, options) {
      const filters = Object.assign({includeDeleted: false, status: '', platformId: '', publicationId: ''}, options || {});
      let rows;
      if (filters.status) {
        rows = await getAllFromIndex('entries', 'byProjectStatus', [projectId, filters.status]);
      } else if (filters.platformId) {
        rows = await getAllFromIndex('entries', 'byProjectPlatform', [projectId, filters.platformId]);
      } else if (filters.publicationId) {
        rows = await getAllFromIndex('entries', 'byProjectPublication', [projectId, filters.publicationId]);
      } else {
        const range = global.IDBKeyRange.bound([projectId, ''], [projectId, '\uffff']);
        rows = await getAllFromIndex('entries', 'byProjectDate', range);
      }
      return rows
        .filter((record) => filters.includeDeleted || record.deletedAt == null)
        .filter((record) => !filters.status || record.workflowStatus === filters.status)
        .filter((record) => !filters.platformId || record.platformId === filters.platformId)
        .filter((record) => !filters.publicationId || record.publicationId === filters.publicationId)
        .sort(queueOrder);
    },
    findByUrlFingerprint(fingerprint) {
      return getAllFromIndex('entries', 'byUrlFingerprint', fingerprint);
    },
    findByPlatformContentId(contentId) {
      return getAllFromIndex('entries', 'byPlatformContentId', contentId);
    }
  });

  const projects = genericRepository('projects');
  const media = genericRepository('media');
  const captures = genericRepository('captures');
  const exportsRepository = Object.assign(genericRepository('exportJobs'), {
    async listByEntry(entryId) {
      const rows = await getAllFromIndex('exportJobs', 'byEntryId', entryId);
      return rows.sort(compareCreatedAt);
    },
    async listByExportBatchId(exportBatchId) {
      const rows = await getAllFromIndex('exportJobs', 'byExportBatchId', exportBatchId);
      return rows.sort(compareCreatedAt);
    },
    async listBatchEntries(exportJobId) {
      const exportJob = await this.get(exportJobId);
      if (!exportJob) return [];
      const snapshot = exportJob.entrySnapshot || exportJob.entries || exportJob.entryIds || [];
      const orderedIds = snapshot
        .map((item, index) => ({
          id: typeof item === 'string' ? item : item.entryId || item.id,
          order: typeof item === 'object' && Number.isFinite(item.order)
            ? item.order
            : typeof item === 'object' && Number.isFinite(item.exportOrder)
              ? item.exportOrder
              : index
        }))
        .sort((first, second) => first.order - second.order)
        .map((item) => item.id);
      const entryRows = await Promise.all(orderedIds.map((id) => entries.get(id)));
      return entryRows.filter(Boolean);
    }
  });

  const logoMappings = genericRepository('logoMappings');
  const assets = Object.assign(genericRepository('assets'), {
    async countReferences(assetId) {
      const logoReferences = await getAllFromIndex('logoMappings', 'byAssetId', assetId);
      const [captureRows, entryRows, projectRows, exportRows] = await Promise.all([
        captures.getAll(),
        entries.getAll(),
        projects.getAll(),
        exportsRepository.getAll()
      ]);
      const nonIndexedReferences = [captureRows, entryRows, projectRows, exportRows]
        .flat()
        .filter((record) => record.assetId === assetId || record.logoLockAssetId === assetId || record.templateAssetId === assetId || record.projectAssetId === assetId);
      return logoReferences.length + nonIndexedReferences.length;
    }
  });

  const audit = {
    append(record) {
      if (!record || record.id == null) throw new Error('id is required');
      return db.run('auditEvents', 'readwrite', (transaction) => {
        const store = transaction.objectStore('auditEvents');
        return db.request(store.add(record)).then(() => record);
      });
    },
    async listForEntity(entityType, entityId) {
      const rows = await db.run('auditEvents', 'readonly', (transaction) =>
        db.request(transaction.objectStore('auditEvents').getAll()));
      return rows
        .filter((record) => record.entityType === entityType && record.entityId === entityId)
        .sort(compareCreatedAt);
    },
    get(id) {
      return db.run('auditEvents', 'readonly', (transaction) =>
        db.request(transaction.objectStore('auditEvents').get(id)));
    },
    getAll() {
      return db.run('auditEvents', 'readonly', (transaction) =>
        db.request(transaction.objectStore('auditEvents').getAll()));
    }
  };

  global.ClipKitRepository = {
    projects,
    entries,
    media,
    assets,
    captures,
    audit,
    exports: exportsRepository,
    meta: genericRepository('meta', 'key'),
    logoMappings
  };
}(globalThis));
