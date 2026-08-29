(function (global) {
  'use strict';

  const db = global.ClipKitDB;
  const records = global.ClipKitRecords;
  const VERSION = 1;
  const COMPLETE_KEY = 'migration:v1:complete';
  const ACTIVE_KEY = 'migration:v1:active';
  const REPORT_PREFIX = 'migration:report:';
  const BATCH_SIZE = 100;
  const LEGACY_DATABASES = {
    captures: 'clipkit-captures',
    phase2: 'clipkit-phase2'
  };
  const MIGRATED_STORES = [
    'projects',
    'entries',
    'media',
    'usernameMappings',
    'platforms',
    'logoMappings',
    'assets',
    'captures',
    'auditEvents',
    'directories'
  ];
  const SECRET_KEY = /(secret|token|password|credential|cookie|authorization|api.?key)/i;

  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitMigration');
  if (!records) throw new Error('ClipKitRecords must be loaded before ClipKitMigration');

  function dependencies(options) {
    const source = options || {};
    const legacy = source.legacy || source;
    return {
      safeLS: legacy.safeLS || legacy.localStorage || global.safeLS || global.localStorage,
      indexedDB: legacy.indexedDB || global.indexedDB,
      databaseNames: legacy.databaseNames || source.databaseNames || null,
      uuid: source.uuid || (() => global.crypto.randomUUID()),
      now: source.now || (() => new Date().toISOString()),
      batchSize: source.batchSize || BATCH_SIZE
    };
  }

  function parseJSON(storage, key, fallback) {
    if (!storage || typeof storage.getItem !== 'function') return fallback;
    const raw = storage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }

  function arrayValue(value) {
    return Array.isArray(value) ? value : [];
  }

  function objectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value) {
    return value == null ? '' : String(value);
  }

  function slug(value, fallback) {
    const normalized = text(value).trim().toLowerCase()
      .normalize('NFKC')
      .replace(/[^a-z0-9ก-๙]+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  }

  function identity(value) {
    return text(value).trim().toLowerCase().normalize('NFKC').replace(/[^a-z0-9ก-๙]+/g, '');
  }

  function sourceEntry(projectId, record, sourceKey, sourceIndex) {
    return {
      projectId: text(projectId || 'default'),
      legacyId: record && record.id != null ? record.id : sourceIndex,
      sourceKey,
      sourceIndex,
      record: Object.assign({}, record || {})
    };
  }

  function projectSources(storage) {
    const stored = arrayValue(parseJSON(storage, 'ck_projects', []));
    const byId = new Map();
    for (const project of stored) {
      const id = text(project && project.id).trim();
      if (id) byId.set(id, Object.assign({}, project));
    }
    const hasDefaultEntries = arrayValue(parseJSON(storage, 'ck_proj_default', [])).length > 0
      || arrayValue(parseJSON(storage, 'ck_entries', [])).length > 0;
    if (hasDefaultEntries && !byId.has('default')) {
      byId.set('default', {id: 'default', name: 'Default', clientName: 'Default'});
    }
    return [...byId.values()];
  }

  function entrySources(storage, projects) {
    const entries = [];
    for (const project of projects) {
      const projectId = text(project.id);
      const key = `ck_proj_${projectId}`;
      arrayValue(parseJSON(storage, key, [])).forEach((record, index) => {
        entries.push(sourceEntry(projectId, record, key, index));
      });
    }
    arrayValue(parseJSON(storage, 'ck_entries', [])).forEach((record, index) => {
      entries.push(sourceEntry('default', record, 'ck_entries', index));
    });
    return entries;
  }

  function mediaSources(storage, entries) {
    const result = [];
    arrayValue(parseJSON(storage, 'ck_custom', [])).forEach((record, index) => {
      result.push({source: 'custom', sourceIndex: index, record: Object.assign({}, record)});
    });
    arrayValue(parseJSON(storage, 'ck_imported', [])).forEach((record, index) => {
      result.push({source: 'imported', sourceIndex: index, record: Object.assign({}, record)});
    });

    const known = new Set(result.map((item) => `${identity(item.record.pub || item.record.name)}|${identity(item.record.platform)}`));
    for (const item of entries) {
      const publication = item.record.pub || item.record.publication || item.record.publicationName;
      const platform = item.record.platform || 'Website';
      const key = `${identity(publication)}|${identity(platform)}`;
      if (!identity(publication) || known.has(key)) continue;
      known.add(key);
      result.push({
        source: 'entry-derived',
        sourceIndex: result.length,
        record: {key, pub: publication, platform, value: item.record.prValue}
      });
    }
    return result;
  }

  function platformSources(storage, entries, media) {
    const result = arrayValue(parseJSON(storage, 'ck_platform_registry', []))
      .map((record) => Object.assign({}, record));
    const known = new Set(result.flatMap((record) => [record.id, record.name, ...(record.aliases || [])].map(identity)));
    const names = [
      ...entries.map((item) => item.record.platform),
      ...media.map((item) => item.record.platform)
    ];
    for (const name of names) {
      if (!identity(name) || known.has(identity(name))) continue;
      const id = slug(name, `platform-${result.length + 1}`);
      result.push({id, name: text(name), dbCode: text(name), fileCode: text(name), builtin: false, active: true, aliases: []});
      known.add(identity(name));
      known.add(identity(id));
    }
    return result;
  }

  async function databaseExists(indexedDB, name, declaredNames) {
    if (declaredNames) return declaredNames.includes(name);
    if (!indexedDB) return false;
    if (typeof indexedDB.databases !== 'function') {
      throw new Error(`Cannot safely inspect legacy database ${name} without indexedDB.databases()`);
    }
    const databases = await indexedDB.databases();
    return databases.some((database) => database.name === name);
  }

  function request(indexedDBRequest) {
    return new Promise((resolve, reject) => {
      indexedDBRequest.onsuccess = () => resolve(indexedDBRequest.result);
      indexedDBRequest.onerror = () => reject(indexedDBRequest.error);
    });
  }

  async function readLegacyDatabase(indexedDB, name, storeNames, declaredNames) {
    if (!await databaseExists(indexedDB, name, declaredNames)) {
      return {name, version: 0, stores: Object.fromEntries(storeNames.map((storeName) => [storeName, []]))};
    }
    const database = await request(indexedDB.open(name));
    try {
      const stores = {};
      for (const storeName of storeNames) {
        stores[storeName] = database.objectStoreNames.contains(storeName)
          ? await request(database.transaction(storeName, 'readonly').objectStore(storeName).getAll())
          : [];
      }
      return {name, version: database.version, stores};
    } finally {
      database.close();
    }
  }

  async function collectLegacy(input) {
    const deps = dependencies(input);
    if (!deps.safeLS) throw new Error('Legacy localStorage is required');
    if (!deps.indexedDB) throw new Error('Legacy IndexedDB is required');
    const projects = projectSources(deps.safeLS);
    const entries = entrySources(deps.safeLS, projects);
    const media = mediaSources(deps.safeLS, entries);
    const platforms = platformSources(deps.safeLS, entries, media);
    const usernameMappings = Object.values(objectValue(parseJSON(deps.safeLS, 'ck_umap', {}))).map((record) => Object.assign({}, record));
    const [capturesDatabase, phase2Database] = await Promise.all([
      readLegacyDatabase(deps.indexedDB, LEGACY_DATABASES.captures, ['captures'], deps.databaseNames),
      readLegacyDatabase(deps.indexedDB, LEGACY_DATABASES.phase2, ['assets', 'mappings', 'history', 'directories'], deps.databaseNames)
    ]);
    return {
      deps,
      projects,
      entries,
      media,
      platforms,
      usernameMappings,
      captures: capturesDatabase.stores.captures,
      assets: phase2Database.stores.assets,
      logoMappings: phase2Database.stores.mappings,
      logoHistory: phase2Database.stores.history,
      directories: phase2Database.stores.directories,
      schemaVersions: {
        localStorage: Number(deps.safeLS.getItem('ck_schema_version') || 0),
        [LEGACY_DATABASES.captures]: capturesDatabase.version,
        [LEGACY_DATABASES.phase2]: phase2Database.version
      }
    };
  }

  async function bytes(value) {
    if (value == null) return null;
    if (typeof value.arrayBuffer === 'function') return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  }

  async function sha256(value) {
    const input = await bytes(value);
    if (input == null) return null;
    const digest = await global.crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
  }

  function binaryField(record) {
    for (const field of ['blob', 'originalBlob', 'data', 'dataUrl', 'originalDataUrl', 'src']) {
      if (record && record[field] != null) return field;
    }
    return null;
  }

  async function canonical(value, seen) {
    if (value == null || typeof value !== 'object') return value;
    if (typeof value.arrayBuffer === 'function' || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return {binarySha256: await sha256(value)};
    }
    const visited = seen || new WeakSet();
    if (visited.has(value)) return '[Circular]';
    visited.add(value);
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) result.push(await canonical(item, visited));
      return result;
    }
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (typeof value[key] !== 'function') result[key] = await canonical(value[key], visited);
    }
    return result;
  }

  async function fingerprint(value) {
    return sha256(JSON.stringify(await canonical(value)));
  }

  function countsFor(source) {
    return {
      projects: source.projects.length,
      entries: source.entries.length,
      media: source.media.length,
      mappings: source.usernameMappings.length + source.logoMappings.length,
      usernameMappings: source.usernameMappings.length,
      logoMappings: source.logoMappings.length,
      platforms: source.platforms.length,
      captures: source.captures.length,
      assets: source.assets.length,
      directories: source.directories.length,
      logoHistory: source.logoHistory.length,
      legacySchemaVersions: Object.keys(source.schemaVersions).length
    };
  }

  async function inventoryFromSource(source) {
    const categories = {
      projects: source.projects,
      entries: source.entries,
      media: source.media,
      mappings: [...source.usernameMappings, ...source.logoMappings],
      platforms: source.platforms,
      captures: source.captures,
      assets: source.assets,
      directories: source.directories,
      legacySchemaVersions: source.schemaVersions
    };
    const fingerprints = {};
    for (const [name, value] of Object.entries(categories)) fingerprints[name] = await fingerprint(value);
    return {
      version: VERSION,
      counts: countsFor(source),
      schemaVersions: Object.assign({}, source.schemaVersions),
      fingerprints,
      fingerprint: await fingerprint({counts: countsFor(source), schemaVersions: source.schemaVersions, fingerprints})
    };
  }

  async function inventory(legacy) {
    return inventoryFromSource(await collectLegacy(legacy || {}));
  }

  function sanitize(value, options, seen) {
    const config = options || {};
    if (value == null || typeof value !== 'object') return value;
    if (typeof value.arrayBuffer === 'function') {
      return config.keepBinary ? value : {binary: true, type: value.type || '', size: Number(value.size) || 0};
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return config.keepBinary ? value : {binary: true, size: value.byteLength};
    }
    const visited = seen || new WeakSet();
    if (visited.has(value)) return '[Circular]';
    visited.add(value);
    if (Array.isArray(value)) return value.map((item) => sanitize(item, config, visited));
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) continue;
      if (!config.keepHandles && key === 'handle') {
        result.handle = item && typeof item === 'object' ? {kind: item.kind || '', name: item.name || ''} : null;
      } else if (typeof item !== 'function') {
        result[key] = sanitize(item, config, visited);
      }
    }
    return result;
  }

  function safetySnapshot(source, reportId, createdAt, migrationInventory) {
    return {
      version: VERSION,
      reportId,
      createdAt,
      inventory: migrationInventory,
      localStorage: {
        ck_schema_version: source.deps.safeLS.getItem('ck_schema_version'),
        ck_projects: sanitize(source.projects),
        entries: sanitize(source.entries),
        ck_custom: sanitize(source.media.filter((item) => item.source === 'custom')),
        ck_imported: sanitize(source.media.filter((item) => item.source === 'imported')),
        ck_platform_registry: sanitize(source.platforms),
        ck_umap: sanitize(source.usernameMappings)
      },
      indexedDB: {
        [LEGACY_DATABASES.captures]: sanitize(source.captures),
        [LEGACY_DATABASES.phase2]: sanitize({
          assets: source.assets,
          mappings: source.logoMappings,
          history: source.logoHistory,
          directories: source.directories
        })
      }
    };
  }

  function getMeta(key) {
    return db.run('meta', 'readonly', (transaction) => db.request(transaction.objectStore('meta').get(key)));
  }

  function putMeta(record) {
    return db.run('meta', 'readwrite', (transaction) => {
      transaction.objectStore('meta').put(record);
      return record;
    });
  }

  function deleteMeta(key) {
    return db.run('meta', 'readwrite', (transaction) => {
      transaction.objectStore('meta').delete(key);
    });
  }

  async function mappedId(key, deps, legacyKey) {
    const existing = await getMeta(key);
    if (existing && existing.id) return existing.id;
    const id = deps.uuid();
    await putMeta({key, id, legacyKey, createdAt: deps.now()});
    return id;
  }

  function reportRecord(report) {
    return Object.assign({key: `${REPORT_PREFIX}${report.reportId}`}, report);
  }

  function reportFromRecord(record) {
    if (!record) return null;
    const report = Object.assign({}, record);
    delete report.key;
    return report;
  }

  function compositeEntryKey(item) {
    return `${item.projectId}:${text(item.legacyId)}`;
  }

  function mediaLegacyKey(item) {
    const record = item.record;
    return `${item.source}:${record.id || record.key || `${identity(record.pub || record.name)}|${identity(record.platform)}`}:${item.sourceIndex}`;
  }

  function platformForName(platforms, name) {
    const needle = identity(name || 'Website');
    return platforms.find((platform) => {
      const candidates = [platform.id, platform.name, ...(platform.aliases || [])];
      return candidates.some((candidate) => identity(candidate) === needle);
    }) || platforms[0];
  }

  function mediaForEntry(media, entry) {
    const publication = identity(entry.pub || entry.publication || entry.publicationName);
    const platform = identity(entry.platform || 'Website');
    return media.find((item) => identity(item.publication || item.name) === publication && identity(item.platform) === platform)
      || media.find((item) => identity(item.publication || item.name) === publication)
      || media[0];
  }

  function projectRecord(source, reportId, now) {
    const legacy = sanitize(source, {keepBinary: false, keepHandles: false});
    const settings = Object.assign({}, legacy);
    for (const key of ['id', 'name', 'clientName', 'created', 'createdAt', 'updatedAt']) delete settings[key];
    return Object.assign(records.project({
      id: text(source.id),
      name: source.name,
      clientName: source.clientName || source.name,
      settings,
      resolverConfigRef: null,
      createdAt: source.createdAt || source.created || now,
      updatedAt: source.updatedAt || source.createdAt || source.created || now
    }, {now: () => now}), {
      legacyId: source.id,
      migrationReportId: reportId
    });
  }

  async function buildRows(source, report, deps) {
    const reportId = report.reportId;
    const now = deps.now();
    const platforms = source.platforms.map((legacy) => ({
      id: text(legacy.id || slug(legacy.name, `platform-${source.platforms.indexOf(legacy) + 1}`)),
      name: text(legacy.name),
      dbCode: text(legacy.dbCode != null ? legacy.dbCode : legacy.code),
      fileCode: text(legacy.fileCode != null ? legacy.fileCode : legacy.dbCode != null ? legacy.dbCode : legacy.code),
      builtin: legacy.builtin === true,
      active: legacy.active !== false,
      aliases: arrayValue(legacy.aliases).map(text),
      legacyId: legacy.id || legacy.name,
      migrationReportId: reportId,
      createdAt: legacy.createdAt || now,
      updatedAt: legacy.updatedAt || now,
      recordVersion: 1
    }));

    const media = [];
    for (const item of source.media) {
      const legacy = item.record;
      const legacyKey = mediaLegacyKey(item);
      media.push({
        id: await mappedId(`legacy-media-id:${legacyKey}`, deps, legacyKey),
        legacyId: legacy.id || legacy.key || legacyKey,
        publication: text(legacy.pub || legacy.publication || legacy.name),
        name: text(legacy.pub || legacy.publication || legacy.name),
        platform: text(legacy.platform || 'Website'),
        prValue: Number.isFinite(Number(legacy.value)) ? Number(legacy.value) : null,
        source: item.source,
        sourceKey: legacy.key || '',
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: 1,
        migrationReportId: reportId
      });
    }

    const assets = [];
    const assetIds = new Map();
    const assetManifest = [];
    for (let index = 0; index < source.assets.length; index += 1) {
      const legacy = source.assets[index];
      const legacyId = text(legacy.id || `asset-${index}`);
      const id = await mappedId(`legacy-asset-id:${legacyId}`, deps, legacyId);
      assetIds.set(legacyId, id);
      const field = binaryField(legacy);
      const row = Object.assign({}, legacy, {
        id,
        legacyId,
        assetKind: legacy.assetKind || (legacy.kind === 'media' ? 'logo' : legacy.kind || 'logo'),
        mimeType: legacy.mimeType || legacy.mime || (field && legacy[field] && legacy[field].type) || '',
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: Number.isFinite(legacy.recordVersion) ? legacy.recordVersion : 1,
        migrationReportId: reportId
      });
      delete row.legacySnapshot;
      assets.push(row);
      if (field) assetManifest.push({store: 'assets', id, legacyId, field, sha256: await sha256(legacy[field])});
    }

    const entryIds = new Map();
    for (const item of source.entries) {
      const composite = compositeEntryKey(item);
      entryIds.set(composite, await mappedId(`legacy-id:${composite}`, deps, composite));
    }

    const entries = source.entries.map((item) => {
      const legacy = item.record;
      const composite = compositeEntryKey(item);
      const publication = mediaForEntry(media, legacy);
      const platform = platformForName(platforms, legacy.platform || 'Website');
      const createdAt = legacy.createdAt || legacy.created || now;
      const entry = records.entry({
        id: entryIds.get(composite),
        projectId: item.projectId,
        publicationId: publication.id,
        publicationDisplayOverride: legacy.publicationDisplayOverride || legacy.pub || '',
        platformId: platform.id,
        publishedDate: legacy.publishedDate || legacy.date || '0000-00-00',
        publishedAtRaw: legacy.publishedAtRaw || legacy.date || '',
        publishedTimezone: legacy.publishedTimezone || '',
        urlOriginal: legacy.urlOriginal != null ? legacy.urlOriginal : legacy.url,
        urlCanonical: legacy.urlCanonical != null ? legacy.urlCanonical : legacy.url,
        urlDisplay: legacy.urlDisplay != null ? legacy.urlDisplay : legacy.url,
        urlFingerprint: legacy.urlFingerprint || '',
        platformContentId: legacy.platformContentId || '',
        prValueSnapshot: legacy.prValueSnapshot != null ? legacy.prValueSnapshot : legacy.prValue,
        prSource: legacy.prSource || 'legacy',
        duration: legacy.duration,
        headline: legacy.headline,
        remark: legacy.remark,
        workflowStatus: legacy.workflowStatus || legacy.status || 'draft',
        logoLockAssetId: legacy.logoLockAssetId || assetIds.get(text(legacy.logoLockedAssetId)) || null,
        exportOrder: legacy.exportOrder,
        createdAt,
        updatedAt: legacy.updatedAt || createdAt,
        deletedAt: legacy.deletedAt || null,
        recordVersion: Number.isFinite(legacy.recordVersion) ? legacy.recordVersion : 1
      }, {now: () => now});
      return Object.assign(entry, {
        legacyId: item.legacyId,
        legacyCompositeId: composite,
        migrationReportId: reportId
      });
    });

    const captures = [];
    const captureManifest = [];
    for (let index = 0; index < source.captures.length; index += 1) {
      const legacy = source.captures[index];
      const composite = `${text(legacy.projectId || 'default')}:${text(legacy.entryId)}`;
      const entryId = entryIds.get(composite);
      const legacyKey = text(legacy.key || composite);
      const id = await mappedId(`legacy-capture-id:${legacyKey}`, deps, legacyKey);
      const images = arrayValue(legacy.images).map((image) => Object.assign({}, image));
      captures.push(Object.assign({}, legacy, {
        id,
        legacyId: legacyKey,
        entryId,
        projectId: text(legacy.projectId || 'default'),
        images,
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: Number.isFinite(legacy.recordVersion) ? legacy.recordVersion : 1,
        migrationReportId: reportId
      }));
      for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        const field = binaryField(images[imageIndex]);
        if (field) captureManifest.push({store: 'captures', id, legacyId: legacyKey, imageIndex, field, sha256: await sha256(images[imageIndex][field])});
      }
    }

    const usernameMappings = [];
    for (let index = 0; index < source.usernameMappings.length; index += 1) {
      const legacy = source.usernameMappings[index];
      const legacyKey = `${identity(legacy.platform)}:${identity(legacy.username)}`;
      const publication = mediaForEntry(media, {pub: legacy.pub, platform: legacy.platform});
      const platform = platformForName(platforms, legacy.platform);
      usernameMappings.push({
        id: await mappedId(`legacy-username-mapping-id:${legacyKey}`, deps, legacyKey),
        legacyId: legacyKey,
        username: text(legacy.username),
        platformId: platform && platform.id,
        mediaId: publication && publication.id,
        publication: text(legacy.pub),
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: 1,
        migrationReportId: reportId
      });
    }

    const logoMappings = [];
    for (let index = 0; index < source.logoMappings.length; index += 1) {
      const legacy = source.logoMappings[index];
      const legacyKey = text(legacy.key || `logo-mapping-${index}`);
      const publication = mediaForEntry(media, {pub: legacy.publication || legacy.pub, platform: legacy.platform});
      const platform = platformForName(platforms, legacy.platform || 'Website');
      logoMappings.push({
        id: await mappedId(`legacy-logo-mapping-id:${legacyKey}`, deps, legacyKey),
        legacyId: legacyKey,
        mediaId: publication && publication.id,
        platformId: platform && platform.id,
        assetId: assetIds.get(text(legacy.assetId)),
        confirmed: legacy.confirmed !== false,
        scope: legacy.scope || (legacy.platform ? 'platform' : 'main'),
        createdAt: legacy.createdAt || legacy.updatedAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: 1,
        migrationReportId: reportId
      });
    }

    const auditEvents = [];
    for (let index = 0; index < source.logoHistory.length; index += 1) {
      const legacy = source.logoHistory[index];
      const legacyId = text(legacy.id || `logo-history-${index}`);
      const composite = `${text(legacy.projectId || 'default')}:${text(legacy.entryId)}`;
      const entryId = entryIds.get(composite) || null;
      auditEvents.push(Object.assign(records.audit({
        id: await mappedId(`legacy-logo-history-id:${legacyId}`, deps, legacyId),
        entityType: entryId ? 'entry' : 'asset',
        entityId: entryId || assetIds.get(text(legacy.assetId)) || null,
        action: 'legacy-logo-change',
        source: 'migration',
        before: legacy.previousAssetId ? {assetId: assetIds.get(text(legacy.previousAssetId)) || null} : null,
        after: legacy.assetId ? {assetId: assetIds.get(text(legacy.assetId)) || null, scope: legacy.scope || ''} : null,
        createdAt: legacy.changedAt || legacy.createdAt || now
      }, {now: () => now}), {
        legacyId,
        migrationReportId: reportId
      }));
    }

    const directories = source.directories.map((legacy) => Object.assign({}, legacy, {
      key: text(legacy.key),
      legacyId: legacy.key,
      migrationReportId: reportId
    }));

    return {
      rows: {
        projects: source.projects.map((project) => projectRecord(project, reportId, now)),
        entries,
        media,
        usernameMappings,
        platforms,
        logoMappings,
        assets,
        captures,
        auditEvents,
        directories
      },
      mappings: {
        entries: Object.fromEntries(entryIds),
        assets: Object.fromEntries(assetIds)
      },
      binaryManifest: [...assetManifest, ...captureManifest]
    };
  }

  async function writeBatches(storeName, rows, batchSize) {
    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      await db.run(storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        for (const row of batch) store.put(row);
      });
    }
  }

  async function migrate(options) {
    const deps = dependencies(options || {});
    const completed = await getMeta(COMPLETE_KEY);
    if (completed && completed.reportId) {
      const stored = reportFromRecord(await getMeta(`${REPORT_PREFIX}${completed.reportId}`));
      if (stored) return Object.assign({}, stored, {rerun: true, addedRows: 0});
    }

    const source = await collectLegacy(options && options.legacy ? options.legacy : options || {});
    const migrationInventory = await inventoryFromSource(source);
    const active = await getMeta(ACTIVE_KEY);
    let report = active && active.reportId
      ? reportFromRecord(await getMeta(`${REPORT_PREFIX}${active.reportId}`))
      : null;
    if (!report) {
      const reportId = deps.uuid();
      const startedAt = deps.now();
      report = {
        reportId,
        version: VERSION,
        state: 'inventory-complete',
        startedAt,
        inventory: migrationInventory,
        legacySnapshot: {
          entries: source.entries.map((item) => ({
            compositeId: compositeEntryKey(item),
            sourceKey: item.sourceKey,
            record: sanitize(item.record)
          }))
        },
        addedRows: 0
      };
      const snapshot = safetySnapshot(source, reportId, startedAt, migrationInventory);
      deps.safeLS.setItem(`ck_idb_safety_${reportId}`, JSON.stringify(snapshot));
      await putMeta(reportRecord(report));
      await putMeta({key: ACTIVE_KEY, reportId, startedAt});
    }

    try {
      const built = await buildRows(source, report, deps);
      for (const storeName of MIGRATED_STORES) {
        await writeBatches(storeName, built.rows[storeName], deps.batchSize);
      }
      report = Object.assign({}, report, {
        state: 'migration-complete',
        migratedAt: deps.now(),
        mappings: built.mappings,
        binaryManifest: built.binaryManifest,
        destinationCounts: {
          projects: built.rows.projects.length,
          entries: built.rows.entries.length,
          media: built.rows.media.length,
          mappings: built.rows.usernameMappings.length + built.rows.logoMappings.length,
          usernameMappings: built.rows.usernameMappings.length,
          logoMappings: built.rows.logoMappings.length,
          platforms: built.rows.platforms.length,
          captures: built.rows.captures.length,
          assets: built.rows.assets.length,
          directories: built.rows.directories.length,
          logoHistory: built.rows.auditEvents.length,
          legacySchemaVersions: Object.keys(source.schemaVersions).length
        },
        addedRows: Object.values(built.rows).reduce((sum, rows) => sum + rows.length, 0)
      });
      await putMeta(reportRecord(report));
      if (options && options.autoVerify === false) return report;
      const verification = await verify(report);
      report.verification = verification;
      report.state = verification.ok ? 'verified' : 'verification-failed';
      return report;
    } catch (error) {
      report.state = 'failed';
      report.error = {name: error.name || 'Error', message: error.message || String(error)};
      await putMeta(reportRecord(report));
      throw error;
    }
  }

  async function migratedRows(storeName, reportId) {
    const rows = await db.run(storeName, 'readonly', (transaction) => db.request(transaction.objectStore(storeName).getAll()));
    return rows.filter((row) => row.migrationReportId === reportId);
  }

  function countShape(rowsByStore, schemaVersionCount) {
    return {
      projects: rowsByStore.projects.length,
      entries: rowsByStore.entries.length,
      media: rowsByStore.media.length,
      mappings: rowsByStore.usernameMappings.length + rowsByStore.logoMappings.length,
      usernameMappings: rowsByStore.usernameMappings.length,
      logoMappings: rowsByStore.logoMappings.length,
      platforms: rowsByStore.platforms.length,
      captures: rowsByStore.captures.length,
      assets: rowsByStore.assets.length,
      directories: rowsByStore.directories.length,
      logoHistory: rowsByStore.auditEvents.length,
      legacySchemaVersions: schemaVersionCount
    };
  }

  function pushMissing(errors, code, store, id, field, reference) {
    errors.push({code, store, id, field, reference});
  }

  async function verify(inputReport) {
    const report = inputReport && inputReport.reportId
      ? inputReport
      : reportFromRecord(await getMeta(`${REPORT_PREFIX}${inputReport}`));
    if (!report) throw new Error('Migration report is required');

    const rowsByStore = {};
    for (const storeName of MIGRATED_STORES) rowsByStore[storeName] = await migratedRows(storeName, report.reportId);
    const actualCounts = countShape(rowsByStore, report.inventory.counts.legacySchemaVersions);
    const errors = [];
    for (const [name, expected] of Object.entries(report.inventory.counts)) {
      if (actualCounts[name] !== expected) {
        errors.push({code: 'COUNT_MISMATCH', category: name, expected, actual: actualCounts[name]});
      }
    }

    const projectIds = new Set(rowsByStore.projects.map((row) => row.id));
    const entryIds = new Set(rowsByStore.entries.map((row) => row.id));
    const mediaIds = new Set(rowsByStore.media.map((row) => row.id));
    const platformIds = new Set(rowsByStore.platforms.map((row) => row.id));
    const assetIds = new Set(rowsByStore.assets.map((row) => row.id));
    for (const entry of rowsByStore.entries) {
      if (!projectIds.has(entry.projectId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'entries', entry.id, 'projectId', entry.projectId);
      if (!mediaIds.has(entry.publicationId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'entries', entry.id, 'publicationId', entry.publicationId);
      if (!platformIds.has(entry.platformId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'entries', entry.id, 'platformId', entry.platformId);
      if (entry.logoLockAssetId && !assetIds.has(entry.logoLockAssetId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'entries', entry.id, 'logoLockAssetId', entry.logoLockAssetId);
    }
    for (const capture of rowsByStore.captures) {
      if (!entryIds.has(capture.entryId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'captures', capture.id, 'entryId', capture.entryId);
      if (!projectIds.has(capture.projectId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'captures', capture.id, 'projectId', capture.projectId);
    }
    for (const mapping of [...rowsByStore.usernameMappings, ...rowsByStore.logoMappings]) {
      if (mapping.mediaId && !mediaIds.has(mapping.mediaId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'mappings', mapping.id, 'mediaId', mapping.mediaId);
      if (mapping.platformId && !platformIds.has(mapping.platformId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'mappings', mapping.id, 'platformId', mapping.platformId);
      if (mapping.assetId && !assetIds.has(mapping.assetId)) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'mappings', mapping.id, 'assetId', mapping.assetId);
    }
    for (const auditEvent of rowsByStore.auditEvents) {
      if (auditEvent.entityType === 'entry' && auditEvent.entityId && !entryIds.has(auditEvent.entityId)) {
        pushMissing(errors, 'FOREIGN_KEY_MISSING', 'auditEvents', auditEvent.id, 'entityId', auditEvent.entityId);
      }
      if (auditEvent.entityType === 'asset' && auditEvent.entityId && !assetIds.has(auditEvent.entityId)) {
        pushMissing(errors, 'FOREIGN_KEY_MISSING', 'auditEvents', auditEvent.id, 'entityId', auditEvent.entityId);
      }
      for (const field of ['before', 'after']) {
        const assetId = auditEvent[field] && auditEvent[field].assetId;
        if (assetId && !assetIds.has(assetId)) {
          pushMissing(errors, 'FOREIGN_KEY_MISSING', 'auditEvents', auditEvent.id, `${field}.assetId`, assetId);
        }
      }
    }

    const rowIndex = new Map();
    for (const storeName of ['assets', 'captures']) {
      for (const row of rowsByStore[storeName]) rowIndex.set(`${storeName}:${row.id}`, row);
    }
    for (const manifest of report.binaryManifest || []) {
      const row = rowIndex.get(`${manifest.store}:${manifest.id}`);
      const value = manifest.store === 'captures'
        ? row && row.images && row.images[manifest.imageIndex] && row.images[manifest.imageIndex][manifest.field]
        : row && row[manifest.field];
      const actual = value == null ? null : await sha256(value);
      if (actual !== manifest.sha256) {
        errors.push({
          code: 'CHECKSUM_MISMATCH',
          store: manifest.store,
          id: manifest.id,
          expected: manifest.sha256,
          actual
        });
      }
    }

    const verification = {
      reportId: report.reportId,
      ok: errors.length === 0,
      verifiedAt: new Date().toISOString(),
      sourceCounts: Object.assign({}, report.inventory.counts),
      destinationCounts: actualCounts,
      checkedForeignKeys: rowsByStore.entries.length * 4
        + rowsByStore.captures.length * 2
        + (rowsByStore.usernameMappings.length + rowsByStore.logoMappings.length) * 3
        + rowsByStore.auditEvents.length * 3,
      checkedChecksums: (report.binaryManifest || []).length,
      errors
    };
    report.state = verification.ok ? 'verified' : 'verification-failed';
    report.verification = verification;
    if (verification.ok) report.completedAt = verification.verifiedAt;
    await putMeta(reportRecord(report));
    if (verification.ok) {
      await putMeta({key: COMPLETE_KEY, reportId: report.reportId, completedAt: verification.verifiedAt, inventoryFingerprint: report.inventory.fingerprint});
      const active = await getMeta(ACTIVE_KEY);
      if (active && active.reportId === report.reportId) await deleteMeta(ACTIVE_KEY);
    } else {
      const complete = await getMeta(COMPLETE_KEY);
      if (complete && complete.reportId === report.reportId) await deleteMeta(COMPLETE_KEY);
    }
    return verification;
  }

  async function rollback(reportId) {
    if (!reportId) throw new Error('reportId is required');
    for (const storeName of MIGRATED_STORES) {
      await db.run(storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        return db.request(store.getAll()).then((rows) => {
          for (const row of rows) {
            if (row.migrationReportId === reportId) store.delete(storeName === 'directories' ? row.key : row.id);
          }
        });
      });
    }
    const stored = reportFromRecord(await getMeta(`${REPORT_PREFIX}${reportId}`));
    if (stored) {
      stored.state = 'rolled-back';
      stored.rolledBackAt = new Date().toISOString();
      await putMeta(reportRecord(stored));
    }
    const active = await getMeta(ACTIVE_KEY);
    if (active && active.reportId === reportId) await deleteMeta(ACTIVE_KEY);
    const complete = await getMeta(COMPLETE_KEY);
    if (complete && complete.reportId === reportId) await deleteMeta(COMPLETE_KEY);
  }

  global.ClipKitMigration = {inventory, migrate, verify, rollback};
}(globalThis));
