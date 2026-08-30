(function (global) {
  'use strict';

  const db = global.ClipKitDB;

  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitRepository');

  function genericRepository(storeName, keyName, options) {
    const key = keyName || 'id';
    const repository = {
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
      getAll() {
        return db.run(storeName, 'readonly', (transaction) =>
          db.request(transaction.objectStore(storeName).getAll()));
      }
    };
    if (!options || options.allowDelete !== false) {
      repository.delete = (id) => db.run(storeName, 'readwrite', (transaction) =>
        db.request(transaction.objectStore(storeName).delete(id)));
    }
    return repository;
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

  function sheetPlatformCode(platformId) {
    const value = String(platformId || '').trim();
    const id = value.toLowerCase();
    const builtins = {
      web: 'WEB',
      website: 'WEB',
      facebook: 'FB',
      fb: 'FB',
      instagram: 'IG',
      ig: 'IG',
      x: 'X',
      twitter: 'X',
      youtube: 'YT',
      yt: 'YT',
      tiktok: 'TK',
      tv: 'TV',
      line: 'LINE',
      'line-today': 'LINE',
      lemon8: 'L8',
      threads: 'Threads',
      msn: 'MSN'
    };
    return builtins[id] || value || 'WEB';
  }

  function sheetFullKey(publication, platformId) {
    const pub = String(publication || '').trim();
    const code = sheetPlatformCode(platformId);
    return pub ? `${pub} - ${code}` : '';
  }

  function dependencies(options) {
    const source = options || {};
    return {
      uuid: source.uuid || (() => global.crypto.randomUUID()),
      now: source.now || (() => new Date().toISOString())
    };
  }

  function clonePlain(value) {
    if (value == null) return value;
    if (typeof global.structuredClone === 'function') return global.structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isBlob(value) {
    return value && typeof value.arrayBuffer === 'function' && Number.isFinite(value.size);
  }

  function decodeBase64(value) {
    if (typeof global.atob !== 'function') {
      throw new Error('Base64 data URLs require atob support');
    }
    const raw = global.atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }

  function dataUrlToBlob(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]*)(;base64)?,(.*)$/);
    if (!match) throw new Error('dataUrl must be a valid data URL');
    const mime = match[1] || '';
    const bytes = match[2]
      ? decodeBase64(match[3])
      : new TextEncoder().encode(decodeURIComponent(match[3] || ''));
    return new global.Blob([bytes], {type: mime});
  }

  async function blobFromInput(input) {
    const source = input || {};
    if (isBlob(source.blob)) return source.blob;
    if (isBlob(source.originalBlob)) return source.originalBlob;
    if (source.originalDataUrl) return dataUrlToBlob(source.originalDataUrl);
    if (source.dataUrl) return dataUrlToBlob(source.dataUrl);
    throw new Error('blob or dataUrl is required');
  }

  function normalizedMime(source, blob) {
    return String(source.mime || source.type || (blob && blob.type) || '').trim().toLowerCase();
  }

  async function sha256Hex(blob) {
    const buffer = await blob.arrayBuffer();
    const digest = await global.crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function assetRecord(input, injectedDependencies, fallbackKind) {
    const source = input || {};
    const deps = dependencies(injectedDependencies);
    const blob = await blobFromInput(source);
    const now = source.createdAt || deps.now();
    const mime = normalizedMime(source, blob);
    const record = Object.assign({}, source, {
      id: source.id || `asset-${deps.uuid()}`,
      assetKind: source.assetKind || fallbackKind || source.kind || 'asset',
      mime,
      type: source.type || mime,
      blob,
      byteLength: blob.size,
      sha256: await sha256Hex(blob),
      createdAt: now,
      updatedAt: source.updatedAt || now,
      recordVersion: Number.isFinite(source.recordVersion) ? source.recordVersion : 1
    });
    delete record.originalBlob;
    return record;
  }

  function sameAssetIdentity(first, second) {
    return first && second
      && first.sha256 === second.sha256
      && Number(first.byteLength) === Number(second.byteLength)
      && normalizedMime(first, first.blob) === normalizedMime(second, second.blob);
  }

  async function commitAssetRecord(transaction, record) {
    const store = transaction.objectStore('assets');
    const rows = await db.request(store.getAll());
    const duplicate = rows.find((row) => sameAssetIdentity(row, record));
    if (duplicate) return duplicate;

    const existing = await db.request(store.get(record.id));
    if (existing) {
      if (sameAssetIdentity(existing, record)) return existing;
      throw new Error(`asset ${record.id} already exists with different bytes`);
    }

    await db.request(store.put(record));
    return record;
  }

  async function promoteAsset(transaction, assetId, now) {
    if (!assetId) return null;
    const assetsStore = transaction.objectStore('assets');
    const stagingStore = transaction.objectStore('stagingAssets');
    const existing = await db.request(assetsStore.get(assetId));
    if (existing) return existing;

    const staged = await db.request(stagingStore.get(assetId));
    if (!staged) return null;
    const committed = await commitAssetRecord(transaction, Object.assign({}, staged, {
      stagedAt: staged.stagedAt || staged.createdAt || now,
      updatedAt: now
    }));
    await db.request(stagingStore.delete(assetId));
    return committed;
  }

  function assetFields(record) {
    const fields = [];
    for (const field of ['assetId', 'logoLockAssetId', 'templateAssetId', 'projectAssetId', 'clientLogoAssetId', 'agencyLogoAssetId']) {
      if (record && record[field]) fields.push({field, assetId: record[field]});
    }
    return fields;
  }

  function directoryKey(projectId) {
    const id = String(projectId || 'default');
    if (id.startsWith('directory:')) return id;
    return `directory:${id === 'default' || id === 'global' ? 'global' : id}`;
  }

  const entries = Object.assign(genericRepository('entries', 'id', {allowDelete: false}), {
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

  const projects = genericRepository('projects', 'id', {allowDelete: false});
  const media = genericRepository('media');
  let assets;
  let captures;
  let exportsRepository;

  assets = Object.assign(genericRepository('assets'), {
    async get(id) {
      return (await genericRepository('assets').get(id)) || null;
    },
    async putOriginal(input, options) {
      const record = await assetRecord(input, options);
      return db.run(['assets'], 'readwrite', (transaction) =>
        commitAssetRecord(transaction, record));
    },
    async stageOriginal(input, options) {
      const deps = dependencies(options);
      const record = await assetRecord(input, options);
      const staged = Object.assign({}, record, {
        stagedAt: record.stagedAt || record.createdAt || deps.now(),
        expiresAt: input && input.expiresAt || options && options.expiresAt || null
      });
      return db.run(['assets', 'stagingAssets'], 'readwrite', async (transaction) => {
        const assetsStore = transaction.objectStore('assets');
        const stagingStore = transaction.objectStore('stagingAssets');
        const committed = await db.request(assetsStore.get(staged.id));
        if (committed) throw new Error(`asset ${staged.id} already exists`);
        const existing = await db.request(stagingStore.get(staged.id));
        if (existing) {
          if (sameAssetIdentity(existing, staged)) return existing;
          throw new Error(`staged asset ${staged.id} already exists with different bytes`);
        }
        await db.request(stagingStore.put(staged));
        return staged;
      });
    },
    async promote(id, options) {
      const deps = dependencies(options);
      const now = options && options.now ? options.now() : deps.now();
      return db.run(['assets', 'stagingAssets'], 'readwrite', (transaction) =>
        promoteAsset(transaction, id, now));
    },
    async getBlob(id) {
      const asset = await this.get(id);
      if (!asset) return null;
      if (isBlob(asset.blob)) return asset.blob;
      if (isBlob(asset.originalBlob)) return asset.originalBlob;
      if (asset.originalDataUrl) return dataUrlToBlob(asset.originalDataUrl);
      if (asset.dataUrl) return dataUrlToBlob(asset.dataUrl);
      return null;
    },
    async listReferences(assetId) {
      const [logoRows, captureRows, entryRows, projectRows, exportRows] = await Promise.all([
        getAllFromIndex('logoMappings', 'byAssetId', assetId),
        captures.getAll(),
        entries.getAll(),
        projects.getAll(),
        exportsRepository.getAll()
      ]);
      const references = logoRows.map((record) => ({
        store: 'logoMappings',
        id: record.id,
        field: 'assetId'
      }));
      for (const record of captureRows) {
        for (const reference of assetFields(record)) {
          if (reference.assetId === assetId) references.push({store: 'captures', id: record.id, field: reference.field});
        }
        (record.images || []).forEach((image, index) => {
          if (image && image.assetId === assetId) {
            references.push({store: 'captures', id: record.id, field: `images.${index}.assetId`});
          }
        });
      }
      for (const record of entryRows) {
        for (const reference of assetFields(record)) {
          if (reference.assetId === assetId) references.push({store: 'entries', id: record.id, field: reference.field});
        }
      }
      for (const record of projectRows) {
        for (const reference of assetFields(record)) {
          if (reference.assetId === assetId) references.push({store: 'projects', id: record.id, field: reference.field});
        }
      }
      for (const record of exportRows) {
        for (const reference of assetFields(record)) {
          if (reference.assetId === assetId) references.push({store: 'exportJobs', id: record.id, field: reference.field});
        }
        ((record.snapshot && record.snapshot.assetIds) || record.assetIds || []).forEach((id, index) => {
          if (id === assetId) references.push({store: 'exportJobs', id: record.id, field: `snapshot.assetIds.${index}`});
        });
      }
      return references;
    },
    async countReferences(assetId) {
      return (await this.listReferences(assetId)).length;
    }
  });

  async function requestPersistenceOnce(now) {
    const storage = global.ClipKitStorage;
    if (!storage || typeof storage.requestPersistence !== 'function') return;
    let shouldRequest = false;
    await db.run('meta', 'readwrite', async (transaction) => {
      const store = transaction.objectStore('meta');
      const existing = await db.request(store.get('storage:persistence-requested'));
      if (existing) return;
      shouldRequest = true;
      await db.request(store.put({
        key: 'storage:persistence-requested',
        requestedAt: now
      }));
    });
    if (!shouldRequest) return;
    try {
      await storage.requestPersistence();
    } catch (error) {
      // Persistent storage is best-effort; unsupported browsers must not block a capture save.
    }
  }

  async function preparedCaptureImages(inputImages, options) {
    const deps = dependencies(options);
    const pendingAssets = [];
    const images = [];
    for (const image of inputImages || []) {
      const next = Object.assign({}, image);
      if (!next.assetId && (image.blob || image.originalBlob || image.originalDataUrl || image.dataUrl)) {
        const asset = await assetRecord(Object.assign({}, image, {
          id: image.assetId || `asset-${image.id || deps.uuid()}`,
          assetKind: 'capture',
          kind: image.kind || 'capture',
          blob: image.originalBlob || image.blob,
          dataUrl: image.originalDataUrl || image.dataUrl,
          mime: image.mime || image.type
        }), options, 'capture');
        next.assetId = asset.id;
        pendingAssets.push(asset);
      }
      delete next.blob;
      delete next.originalBlob;
      delete next.originalDataUrl;
      images.push(next);
    }
    return {images, pendingAssets};
  }

  captures = Object.assign(genericRepository('captures'), {
    async saveTransform(input, options) {
      const deps = dependencies(options);
      const now = input && input.updatedAt || deps.now();
      const prepared = await preparedCaptureImages(input && input.images, options);
      const record = Object.assign({}, input, {
        id: input.id || `capture-${deps.uuid()}`,
        key: input.key || (input.projectId && input.entryId ? `${input.projectId}:${input.entryId}` : input.id),
        images: prepared.images,
        updatedAt: now,
        recordVersion: Number.isFinite(input && input.recordVersion) ? input.recordVersion : 1
      });
      const saved = await db.run(['captures', 'assets', 'stagingAssets'], 'readwrite', async (transaction) => {
        const captureStore = transaction.objectStore('captures');
        const existing = await db.request(captureStore.get(record.id));
        const committedAssets = new Map();
        for (const pending of prepared.pendingAssets) {
          const committed = await commitAssetRecord(transaction, pending);
          committedAssets.set(pending.id, committed.id);
        }
        for (const image of record.images) {
          if (!image.assetId) continue;
          if (committedAssets.has(image.assetId)) {
            image.assetId = committedAssets.get(image.assetId);
            continue;
          }
          const promoted = await promoteAsset(transaction, image.assetId, now);
          if (!promoted) throw new Error(`asset ${image.assetId} is not available`);
          image.assetId = promoted.id;
        }
        record.createdAt = record.createdAt || existing && existing.createdAt || now;
        await db.request(captureStore.put(record));
        return record;
      });
      await requestPersistenceOnce(now);
      return saved;
    },
    async listByEntry(entryId) {
      const rows = await this.getAll();
      return rows
        .filter((record) => record.entryId === entryId)
        .sort(compareCreatedAt);
    }
  });

  const directories = Object.assign(genericRepository('directories', 'key'), {
    saveProjectConfig(projectId, config, options) {
      const deps = dependencies(options);
      const now = config && config.updatedAt || deps.now();
      const key = directoryKey(projectId);
      return db.run('directories', 'readwrite', async (transaction) => {
        const store = transaction.objectStore('directories');
        const existing = await db.request(store.get(key));
        const record = Object.assign({}, config || {}, {
          key,
          projectId: String(projectId || 'default'),
          name: config && config.name || existing && existing.name || '',
          createdAt: config && config.createdAt || existing && existing.createdAt || now,
          updatedAt: now,
          recordVersion: Number.isFinite(config && config.recordVersion) ? config.recordVersion : 1
        });
        await db.request(store.put(record));
        return record;
      });
    },
    getProjectConfig(projectId) {
      return this.get(directoryKey(projectId));
    },
    async serializeForBackup() {
      const rows = await this.getAll();
      return rows
        .sort((first, second) => String(first.key || '').localeCompare(String(second.key || '')))
        .map((record) => {
          const backup = Object.assign({}, record);
          delete backup.handle;
          return backup;
        });
    }
  });

  function orderedEntrySnapshot(input) {
    const source = input && (input.entrySnapshot || input.entries || input.entryIds) || [];
    return source.map((item, index) => {
      if (typeof item === 'string') return {entryId: item, order: index};
      return Object.assign({}, clonePlain(item), {
        entryId: item.entryId || item.id,
        order: Number.isFinite(item.order)
          ? item.order
          : Number.isFinite(item.exportOrder) ? item.exportOrder : index
      });
    });
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  exportsRepository = Object.assign(genericRepository('exportJobs'), {
    create(input, options) {
      const deps = dependencies(options);
      const now = input && input.createdAt || deps.now();
      const record = Object.assign({}, input || {}, {
        id: input && input.id || `export-${deps.uuid()}`,
        status: input && input.status || 'pending',
        createdAt: now,
        updatedAt: input && input.updatedAt || now,
        recordVersion: Number.isFinite(input && input.recordVersion) ? input.recordVersion : 1
      });
      if (input && (input.entrySnapshot || input.entries || input.entryIds)) {
        record.entrySnapshot = orderedEntrySnapshot(input);
      }
      if (input && input.snapshot) record.snapshot = clonePlain(input.snapshot);
      return db.run('exportJobs', 'readwrite', (transaction) =>
        db.request(transaction.objectStore('exportJobs').put(record)).then(() => record));
    },
    async finish(id, result, options) {
      const deps = dependencies(options);
      const now = result && result.finishedAt || deps.now();
      const job = await this.get(id);
      if (!job) throw new Error(`export job ${id} was not found`);
      const record = Object.assign({}, job, result || {}, {
        id,
        status: result && result.status || 'succeeded',
        finishedAt: now,
        updatedAt: now
      });
      await this.put(record);
      return record;
    },
    async fail(id, error, options) {
      const deps = dependencies(options);
      const now = options && options.failedAt || deps.now();
      const job = await this.get(id);
      if (!job) throw new Error(`export job ${id} was not found`);
      const message = error && error.message || String(error || 'Export failed');
      const record = Object.assign({}, job, {
        id,
        status: 'failed',
        errorMessage: message,
        failedAt: now,
        updatedAt: now
      });
      await this.put(record);
      return record;
    },
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
      const orderedIds = orderedEntrySnapshot(exportJob)
        .sort((first, second) => first.order - second.order)
        .map((item) => item.entryId);
      const entryRows = await Promise.all(orderedIds.map((id) => entries.get(id)));
      return entryRows.filter(Boolean);
    },
    async summaryCsv(exportBatchId) {
      const parent = await this.get(exportBatchId);
      const order = new Map(orderedEntrySnapshot(parent).map((entry) => [entry.entryId, entry.order]));
      const children = await this.listByExportBatchId(exportBatchId);
      children.sort((first, second) => {
        const firstOrder = order.has(first.entryId) ? order.get(first.entryId) : Number.MAX_SAFE_INTEGER;
        const secondOrder = order.has(second.entryId) ? order.get(second.entryId) : Number.MAX_SAFE_INTEGER;
        return firstOrder - secondOrder || compareCreatedAt(first, second);
      });
      const rows = [['File Name', 'Publication', 'Platform', 'Date', 'Pages', 'Status']];
      for (const job of children) {
        const entry = job.snapshot && job.snapshot.entry || {};
        const status = job.status === 'failed'
          ? `failed: ${job.errorMessage || 'Export failed'}`
          : job.status || '';
        rows.push([
          job.fileName || `${entry.id || job.entryId || job.id}.pdf`,
          entry.pub || entry.publication || '',
          entry.platform || '',
          entry.date || entry.publishedDate || '',
          Number.isFinite(job.pages) ? job.pages : 0,
          status
        ]);
      }
      return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    },
    async materializeSnapshot(id, render) {
      const job = await this.get(id);
      if (!job) throw new Error(`export job ${id} was not found`);
      if (!job.snapshot) throw new Error(`export job ${id} does not have a snapshot`);
      const assetIds = [...new Set(job.snapshot.assetIds || [])];
      const assetRows = [];
      for (const assetId of assetIds) {
        const asset = await assets.get(assetId);
        if (!asset) throw new Error(`asset ${assetId} is not available`);
        const blob = await assets.getBlob(assetId);
        if (!blob) throw new Error(`asset ${assetId} has no Blob`);
        assetRows.push(Object.assign({}, asset, {blob}));
      }
      return render({job: clonePlain(job), assets: assetRows});
    }
  });

  const logoMappings = Object.assign(genericRepository('logoMappings'), {
    save(input, options) {
      const deps = dependencies(options);
      const now = input && input.updatedAt || deps.now();
      const record = Object.assign({}, input || {}, {
        id: input && input.id || `logo-mapping-${deps.uuid()}`,
        platformId: input && input.platformId || '',
        confirmed: !(input && input.confirmed === false),
        createdAt: input && input.createdAt || now,
        updatedAt: now,
        recordVersion: Number.isFinite(input && input.recordVersion) ? input.recordVersion : 1
      });
      return db.run(['logoMappings', 'assets', 'stagingAssets'], 'readwrite', async (transaction) => {
        const promoted = await promoteAsset(transaction, record.assetId, now);
        if (!promoted) throw new Error(`asset ${record.assetId} is not available`);
        record.assetId = promoted.id;
        await db.request(transaction.objectStore('logoMappings').put(record));
        return record;
      });
    },
    async resolve(mediaId, platformId) {
      const specific = platformId
        ? await getAllFromIndex('logoMappings', 'byMediaPlatform', [mediaId, platformId])
        : [];
      const generic = await getAllFromIndex('logoMappings', 'byMediaPlatform', [mediaId, '']);
      for (const mapping of [...specific, ...generic]) {
        if (mapping.assetId && await assets.get(mapping.assetId)) return mapping;
      }
      return null;
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

  // Google Sheets is an explicit boundary: rows are inspected first and only
  // accepted resolutions are written back to IndexedDB.
  function sheetValue(row, names) {
    for (const name of names) if (row && row[name] !== undefined) return row[name];
    return '';
  }
  function sheetEntry(row) {
    const legacy = row && row.pub !== undefined && row.publicationId === undefined && row.clipkit_entry_id === undefined && row.entryId === undefined;
    return {
      id: String(sheetValue(row, ['clipkit_entry_id','entryId','id']) || (legacy ? `legacy-${sheetValue(row,['pub'])}-${sheetValue(row,['platform'])}` : '')),
      revision: Number(sheetValue(row, ['clipkit_entry_revision','revision','recordVersion'])) || 0,
      projectId: String(sheetValue(row, ['clipkit_project_id','projectId']) || (legacy ? 'default' : '')),
      publicationId: String(sheetValue(row, ['publicationId','publication','Publication','pub']) || ''),
      platformId: String(sheetValue(row, ['platformId','platform','Platform']) || ''),
      publishedDate: String(sheetValue(row, ['publishedDate','date','Date']) || (legacy ? new Date().toISOString().slice(0,10) : '')),
      urlOriginal: String(sheetValue(row, ['urlOriginal','url','Link']) || ''),
      prValueSnapshot: sheetValue(row, ['prValueSnapshot','prValue','PR Value','value']) === '' ? null : Number(sheetValue(row, ['prValueSnapshot','prValue','PR Value','value'])),
      duration: String(sheetValue(row, ['duration','Duration']) || ''),
      headline: String(sheetValue(row, ['headline','Headline']) || '')
    };
  }
  async function buildSheetsExport(projectId, options) {
    const mode = options && options.mode || 'append';
    const rows = await entries.listByProject(projectId, {includeDeleted:false});
    const prior = new Map();
    for (const job of await exportsRepository.getAll()) {
      if (job.sheetProjectId === projectId && job.status === 'succeeded') {
        for (const item of job.entries || []) prior.set(item.id, item.revision);
      }
    }
    const selected = mode === 'append' ? rows.filter((e) => prior.get(e.id) !== e.recordVersion) : rows;
    const exportedAt = new Date().toISOString();
    return {exportedAt, projectRevision: rows.reduce((n,e)=>Math.max(n,e.recordVersion||0),0), mode,
      entries: selected.map((e) => ({...e, revision:e.recordVersion||1, lastExportedAt:e.lastExportedAt||null,
        clipkit_entry_id:e.id, clipkit_entry_revision:e.recordVersion||1, clipkit_project_id:e.projectId,
        clipkit_last_exported_at:e.lastExportedAt||null, Full_Key: sheetFullKey(e.publicationDisplayOverride || e.publicationId, e.platformId)}))};
  }
  async function inspectSheetsImport(rows) {
    const seen = new Set(), result = {rows:[], counts:{new:0,unchanged:0,changed:0,missing:0,invalid:0,conflict:0}, conflicts:[]};
    for (const raw of rows || []) {
      const incoming = sheetEntry(raw); let kind='new', local=null;
      if (!incoming.id || !incoming.projectId || !incoming.publicationId || !incoming.platformId || !incoming.publishedDate || seen.has(incoming.id)) {
        result.counts.invalid++; result.rows.push({raw, kind:'invalid', reason:seen.has(incoming.id)?'duplicate-id':'required-fields'}); continue;
      }
      seen.add(incoming.id); local = await entries.get(incoming.id);
      if (!local) result.counts.new++;
      else {
        const changed = ['publicationId','platformId','publishedDate','urlOriginal','prValueSnapshot','duration','headline'].some(k=>String(local[k]??'')!==String(incoming[k]??''));
        kind = changed ? (incoming.revision < (local.recordVersion||1) ? 'conflict' : 'changed') : 'unchanged';
        result.counts[kind]++; if (kind==='conflict') result.conflicts.push(incoming.id);
      }
      result.rows.push({raw, incoming, local, kind});
    }
    return result;
  }
  async function applySheetsImport(inspection, resolutions, options) {
    const deps = dependencies(options), idempotencyKey = options&&options.idempotencyKey || `sheets-${deps.uuid()}`;
    const report = {id:`import-${deps.uuid()}`, source:'sheets', idempotencyKey, status:'applied', written:[], skipped:[], createdAt:deps.now()};
    const choices = resolutions || {};
    await db.run(['entries','provenance','auditEvents','importReports'], 'readwrite', async (transaction) => {
      for (const item of (inspection&&inspection.rows)||[]) {
        if (item.kind==='invalid' || item.kind==='unchanged') { report.skipped.push({id:item.incoming&&item.incoming.id, reason:item.kind}); continue; }
        const choice = choices[item.incoming.id] || (item.kind==='new' ? 'use-import' : null);
        if (!choice) throw new Error(`resolution required for ${item.incoming.id}`);
        if (choice==='keep-existing') { report.skipped.push({id:item.incoming.id,reason:choice}); continue; }
        const now=deps.now(), before=item.local||null, source=item.incoming;
        const next=Object.assign({}, before||{}, source, {id:source.id, recordVersion:Math.max((before&&before.recordVersion)||0,source.revision||0)+1, createdAt:before&&before.createdAt||now, updatedAt:now, deletedAt:null});
        transaction.objectStore('entries').put(next);
        transaction.objectStore('provenance').put({id:`prov-${deps.uuid()}`,entityType:'entry',entityId:next.id,field:'sheets-import',value:source,source:'import',confirmedByUser:true,createdAt:now});
        transaction.objectStore('auditEvents').add({id:`audit-${deps.uuid()}`,entityType:'entry',entityId:next.id,action:'import',source:'import',before,after:next,revision:next.recordVersion,createdAt:now});
        report.written.push(next.id);
      }
      transaction.objectStore('importReports').put(report);
    });
    return report;
  }

  global.ClipKitRepository = {
    projects,
    entries,
    media,
    assets,
    captures,
    directories,
    audit,
    exports: exportsRepository,
    meta: genericRepository('meta', 'key'),
    logoMappings
  };
  global.buildSheetsExport = buildSheetsExport;
  global.inspectSheetsImport = inspectSheetsImport;
  global.applySheetsImport = applySheetsImport;
  global.ClipKitRepository.sheets = {buildSheetsExport, inspectSheetsImport, applySheetsImport};
  // Stable domain names used by the Phase 2 UI and import/export adapters.
  global.AssetRepository = assets;
  global.CaptureRepository = captures;
  global.DirectoryRepository = directories;
  global.ExportJobRepository = exportsRepository;
}(globalThis));
