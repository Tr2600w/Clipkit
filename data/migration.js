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
    phase2: ['clipkit-phase2-assets', 'clipkit-phase2']
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
  const BINARY_FIELDS = new Set(['blob', 'originalBlob', 'data', 'dataUrl', 'originalDataUrl', 'src']);

  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitMigration');
  if (!records) throw new Error('ClipKitRecords must be loaded before ClipKitMigration');

  function codedError(code, message, properties) {
    const error = new Error(message);
    error.code = code;
    return Object.assign(error, properties || {});
  }

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

  function parseJSON(storage, key, fallback, parseErrors) {
    if (!storage || typeof storage.getItem !== 'function') return fallback;
    const raw = storage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      if (parseErrors) parseErrors.push({key, message: error.message, rawLength: raw.length});
      return fallback;
    }
  }

  function rawStorage(storage) {
    const rows = [];
    for (let index = 0; index < Number(storage.length || 0); index += 1) {
      const key = storage.key(index);
      if (key != null) rows.push({key, value: storage.getItem(key)});
    }
    return rows.sort((first, second) => first.key.localeCompare(second.key));
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

  function projectSources(storage, parseErrors) {
    const stored = arrayValue(parseJSON(storage, 'ck_projects', [], parseErrors));
    const byId = new Map();
    for (const project of stored) {
      const id = text(project && project.id).trim();
      if (id) byId.set(id, Object.assign({}, project));
    }
    const hasDefaultEntries = arrayValue(parseJSON(storage, 'ck_proj_default', [], parseErrors)).length > 0
      || arrayValue(parseJSON(storage, 'ck_entries', [], parseErrors)).length > 0;
    if (hasDefaultEntries && !byId.has('default')) {
      byId.set('default', {id: 'default', name: 'Default', clientName: 'Default'});
    }
    return [...byId.values()];
  }

  function entrySources(storage, projects, parseErrors) {
    const entries = [];
    for (const project of projects) {
      const projectId = text(project.id);
      const key = `ck_proj_${projectId}`;
      arrayValue(parseJSON(storage, key, [], parseErrors)).forEach((record, index) => {
        entries.push(sourceEntry(projectId, record, key, index));
      });
    }
    arrayValue(parseJSON(storage, 'ck_entries', [], parseErrors)).forEach((record, index) => {
      entries.push(sourceEntry('default', record, 'ck_entries', index));
    });
    return entries;
  }

  function mediaSources(storage, entries, parseErrors) {
    const result = [];
    arrayValue(parseJSON(storage, 'ck_custom', [], parseErrors)).forEach((record, index) => {
      result.push({source: 'custom', sourceIndex: index, record: Object.assign({}, record)});
    });
    arrayValue(parseJSON(storage, 'ck_imported', [], parseErrors)).forEach((record, index) => {
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

  function platformSources(storage, entries, media, usernameMappings, parseErrors) {
    const result = arrayValue(parseJSON(storage, 'ck_platform_registry', [], parseErrors))
      .map((record) => Object.assign({}, record));
    const known = new Set(result.flatMap((record) => [record.id, record.name, ...(record.aliases || [])].map(identity)));
    const names = [
      ...entries.map((item) => item.record.platform),
      ...media.map((item) => item.record.platform),
      ...usernameMappings.map((item) => item.platform)
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

  async function databaseExists(indexedDB, name) {
    if (!indexedDB) return false;
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      return databases.some((database) => database.name === name);
    }
    return new Promise((resolve, reject) => {
      let created = false;
      const openRequest = indexedDB.open(name);
      openRequest.onupgradeneeded = () => {
        created = openRequest.oldVersion === 0 || !openRequest.oldVersion;
        if (created && openRequest.transaction) openRequest.transaction.abort();
      };
      openRequest.onsuccess = () => {
        openRequest.result.close();
        resolve(true);
      };
      openRequest.onerror = (event) => {
        if (created && openRequest.error && openRequest.error.name === 'AbortError') {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          resolve(false);
        } else {
          reject(openRequest.error);
        }
      };
    });
  }

  function request(indexedDBRequest) {
    return new Promise((resolve, reject) => {
      indexedDBRequest.onsuccess = () => resolve(indexedDBRequest.result);
      indexedDBRequest.onerror = () => reject(indexedDBRequest.error);
    });
  }

  async function readLegacyDatabase(indexedDB, name, storeNames) {
    if (!await databaseExists(indexedDB, name)) {
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

  function legacyRowKey(storeName, row, index) {
    const keyField = storeName === 'mappings' || storeName === 'directories' ? 'key' : 'id';
    return text(row && row[keyField] != null ? row[keyField] : `${storeName}-${index}`);
  }

  async function mergeLegacyStores(databases, storeName) {
    const byKey = new Map();
    for (const database of databases) {
      const rows = database.stores[storeName] || [];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const key = legacyRowKey(storeName, row, index);
        const rowFingerprint = await fingerprint(row);
        const existing = byKey.get(key);
        if (existing && existing.fingerprint !== rowFingerprint) {
          throw codedError('LEGACY_SOURCE_CONFLICT', `Conflicting ${storeName} row ${key}`, {
            store: storeName,
            legacyId: key,
            databases: [existing.databaseName, database.name]
          });
        }
        if (!existing) byKey.set(key, {row, fingerprint: rowFingerprint, databaseName: database.name});
      }
    }
    return [...byKey.values()].map((item) => item.row);
  }

  async function collectLegacy(input) {
    const deps = dependencies(input);
    if (!deps.safeLS) throw new Error('Legacy localStorage is required');
    if (!deps.indexedDB) throw new Error('Legacy IndexedDB is required');
    const parseErrors = [];
    const projects = projectSources(deps.safeLS, parseErrors);
    const entries = entrySources(deps.safeLS, projects, parseErrors);
    const media = mediaSources(deps.safeLS, entries, parseErrors);
    const usernameMappings = Object.values(objectValue(parseJSON(deps.safeLS, 'ck_umap', {}, parseErrors))).map((record) => Object.assign({}, record));
    const phase2Global = objectValue(parseJSON(deps.safeLS, 'ck_phase2_global', {}, parseErrors));
    const [capturesDatabase, ...phase2Databases] = await Promise.all([
      readLegacyDatabase(deps.indexedDB, LEGACY_DATABASES.captures, ['captures']),
      ...LEGACY_DATABASES.phase2.map((name) => readLegacyDatabase(deps.indexedDB, name, ['assets', 'mappings', 'history', 'directories']))
    ]);
    const assets = await mergeLegacyStores(phase2Databases, 'assets');
    const logoMappings = await mergeLegacyStores(phase2Databases, 'mappings');
    const logoHistory = await mergeLegacyStores(phase2Databases, 'history');
    const directories = await mergeLegacyStores(phase2Databases, 'directories');
    const platforms = platformSources(
      deps.safeLS,
      entries,
      media,
      [...usernameMappings, ...logoMappings.map((mapping) => ({platform: mapping.platform}))],
      parseErrors
    );
    const schemaVersions = {localStorage: Number(deps.safeLS.getItem('ck_schema_version') || 0)};
    if (capturesDatabase.version) schemaVersions[LEGACY_DATABASES.captures] = capturesDatabase.version;
    for (const database of phase2Databases) {
      if (database.version) schemaVersions[database.name] = database.version;
    }
    return {
      deps,
      rawStorage: rawStorage(deps.safeLS),
      parseErrors,
      projects,
      entries,
      media,
      platforms,
      usernameMappings,
      phase2Global,
      captures: capturesDatabase.stores.captures,
      assets,
      logoMappings,
      logoHistory,
      directories,
      schemaVersions
    };
  }

  async function bytes(value) {
    if (value == null) return null;
    if (typeof value.arrayBuffer === 'function') return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof value === 'string' && /^data:/i.test(value)) {
      const comma = value.indexOf(',');
      if (comma < 0) return new TextEncoder().encode(value);
      const metadata = value.slice(0, comma);
      const payload = value.slice(comma + 1);
      if (/;base64(?:;|$)/i.test(metadata)) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const clean = payload.replace(/\s+/g, '').replace(/=+$/, '');
        const output = [];
        let buffer = 0;
        let bits = 0;
        for (const character of clean) {
          const index = alphabet.indexOf(character);
          if (index < 0) continue;
          buffer = (buffer << 6) | index;
          bits += 6;
          if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 255);
          }
        }
        return new Uint8Array(output);
      }
      const output = [];
      for (let index = 0; index < payload.length;) {
        if (payload[index] === '%' && /^[0-9a-f]{2}$/i.test(payload.slice(index + 1, index + 3))) {
          output.push(Number.parseInt(payload.slice(index + 1, index + 3), 16));
          index += 3;
          continue;
        }
        const codePoint = payload.codePointAt(index);
        output.push(...new TextEncoder().encode(String.fromCodePoint(codePoint)));
        index += codePoint > 0xffff ? 2 : 1;
      }
      return new Uint8Array(output);
    }
    return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  }

  async function sha256(value) {
    const input = await bytes(value);
    if (input == null) return null;
    const digest = await global.crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
  }

  function binaryFields(record) {
    return [...BINARY_FIELDS].filter((field) => record && record[field] != null);
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
      if (typeof value[key] === 'function') continue;
      result[key] = BINARY_FIELDS.has(key)
        ? {binarySha256: await sha256(value[key])}
        : await canonical(value[key], visited);
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
      phase2Globals: Object.keys(source.phase2Global).length ? 1 : 0,
      legacySchemaVersions: Object.keys(source.schemaVersions).length
    };
  }

  async function sourceBinaryManifest(source) {
    const manifest = [];
    for (let index = 0; index < source.assets.length; index += 1) {
      const asset = source.assets[index];
      const legacyId = text(asset.id || `asset-${index}`);
      for (const field of binaryFields(asset)) {
        manifest.push({store: 'assets', legacyId, field, sha256: await sha256(asset[field])});
      }
    }
    for (let captureIndex = 0; captureIndex < source.captures.length; captureIndex += 1) {
      const capture = source.captures[captureIndex];
      const legacyId = text(capture.key || `${capture.projectId || 'default'}:${capture.entryId}` || `capture-${captureIndex}`);
      const images = arrayValue(capture.images);
      for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        for (const field of binaryFields(images[imageIndex])) {
          manifest.push({store: 'captures', legacyId, imageIndex, field, sha256: await sha256(images[imageIndex][field])});
        }
      }
    }
    return manifest.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
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
      phase2Global: source.phase2Global,
      parseErrors: source.parseErrors,
      legacySchemaVersions: source.schemaVersions
    };
    const fingerprints = {};
    for (const [name, value] of Object.entries(categories)) fingerprints[name] = await fingerprint(value);
    const binaryManifest = await sourceBinaryManifest(source);
    return {
      version: VERSION,
      counts: countsFor(source),
      schemaVersions: Object.assign({}, source.schemaVersions),
      parseErrors: source.parseErrors.map((error) => Object.assign({}, error)),
      binaryManifest,
      fingerprints,
      fingerprint: await fingerprint({counts: countsFor(source), schemaVersions: source.schemaVersions, fingerprints, binaryManifest})
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
      localStorage: source.rawStorage.map((row) => Object.assign({}, row)),
      parseErrors: source.parseErrors.map((error) => Object.assign({}, error)),
      binaryManifest: migrationInventory.binaryManifest.map((item) => Object.assign({}, item)),
      legacyDatabases: {
        names: [LEGACY_DATABASES.captures, ...LEGACY_DATABASES.phase2],
        counts: {
          captures: source.captures.length,
          assets: source.assets.length,
          mappings: source.logoMappings.length,
          history: source.logoHistory.length,
          directories: source.directories.length
        }
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
    if (existing) {
      throw codedError('MIGRATION_DESTINATION_COLLISION', `Destination meta key ${key} is already in use`, {
        store: 'meta',
        key
      });
    }
    const id = deps.uuid();
    await db.run('meta', 'readwrite', (transaction) => {
      transaction.objectStore('meta').add({key, id, legacyKey, createdAt: deps.now()});
    });
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
      || null;
  }

  function referenceEvidence(references, kind, owner, field, legacyValue, resolvedId) {
    if (legacyValue == null || legacyValue === '') return resolvedId;
    references.push({kind, owner, field, legacyValue, resolvedId: resolvedId || null, required: true});
    return resolvedId || null;
  }

  function projectRecord(source, reportId, now, assetIds, sourceReferences) {
    const legacy = sanitize(source, {keepBinary: false, keepHandles: false});
    const settings = Object.assign({}, legacy);
    for (const key of ['id', 'name', 'clientName', 'created', 'createdAt', 'updatedAt', 'clientLogoAssetId', 'agencyLogoAssetId']) delete settings[key];
    const clientLogoAssetId = referenceEvidence(
      sourceReferences,
      'project-asset',
      text(source.id),
      'clientLogoAssetId',
      source.clientLogoAssetId,
      assetIds.get(text(source.clientLogoAssetId))
    );
    const agencyLogoAssetId = referenceEvidence(
      sourceReferences,
      'project-asset',
      text(source.id),
      'agencyLogoAssetId',
      source.agencyLogoAssetId,
      assetIds.get(text(source.agencyLogoAssetId))
    );
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
      clientLogoAssetId,
      agencyLogoAssetId,
      migrationReportId: reportId
    });
  }

  async function buildRows(source, report, deps) {
    const reportId = report.reportId;
    const now = report.startedAt;
    const sourceReferences = [];
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
      const fields = binaryFields(legacy);
      const row = Object.assign({}, legacy, {
        id,
        legacyId,
        assetKind: legacy.assetKind || (legacy.kind === 'media' ? 'logo' : legacy.kind || 'logo'),
        mimeType: legacy.mimeType || legacy.mime || (fields[0] && legacy[fields[0]] && legacy[fields[0]].type) || '',
        createdAt: legacy.createdAt || now,
        updatedAt: legacy.updatedAt || legacy.createdAt || now,
        recordVersion: Number.isFinite(legacy.recordVersion) ? legacy.recordVersion : 1,
        migrationReportId: reportId
      });
      delete row.legacySnapshot;
      assets.push(row);
      for (const field of fields) {
        assetManifest.push({store: 'assets', id, legacyId, field, sha256: await sha256(legacy[field])});
      }
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
        publicationId: publication && publication.id,
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
        logoLockAssetId: referenceEvidence(
          sourceReferences,
          'entry-logo',
          composite,
          'logoLockAssetId',
          legacy.logoLockAssetId || legacy.logoLockedAssetId,
          assetIds.get(text(legacy.logoLockAssetId || legacy.logoLockedAssetId))
        ),
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
    const sourceProjectIds = new Set(source.projects.map((project) => text(project.id)));
    for (let index = 0; index < source.captures.length; index += 1) {
      const legacy = source.captures[index];
      const composite = `${text(legacy.projectId || 'default')}:${text(legacy.entryId)}`;
      const entryId = entryIds.get(composite);
      referenceEvidence(sourceReferences, 'capture-entry', legacy.key || composite, 'entryId', legacy.entryId, entryId);
      referenceEvidence(
        sourceReferences,
        'capture-project',
        legacy.key || composite,
        'projectId',
        legacy.projectId || 'default',
        sourceProjectIds.has(text(legacy.projectId || 'default')) ? text(legacy.projectId || 'default') : null
      );
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
        for (const field of binaryFields(images[imageIndex])) {
          captureManifest.push({store: 'captures', id, legacyId: legacyKey, imageIndex, field, sha256: await sha256(images[imageIndex][field])});
        }
      }
    }

    const usernameMappings = [];
    for (let index = 0; index < source.usernameMappings.length; index += 1) {
      const legacy = source.usernameMappings[index];
      const legacyKey = `${identity(legacy.platform)}:${identity(legacy.username)}`;
      const publication = mediaForEntry(media, {pub: legacy.pub, platform: legacy.platform});
      const platform = platformForName(platforms, legacy.platform);
      referenceEvidence(sourceReferences, 'username-media', legacyKey, 'mediaId', legacy.pub, publication && publication.id);
      referenceEvidence(sourceReferences, 'username-platform', legacyKey, 'platformId', legacy.platform, platform && platform.id);
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
      const mappedAssetId = assetIds.get(text(legacy.assetId));
      referenceEvidence(sourceReferences, 'logo-media', legacyKey, 'mediaId', legacy.publication || legacy.pub, publication && publication.id);
      referenceEvidence(sourceReferences, 'logo-platform', legacyKey, 'platformId', legacy.platform || 'Website', platform && platform.id);
      referenceEvidence(sourceReferences, 'logo-asset', legacyKey, 'assetId', legacy.assetId, mappedAssetId);
      logoMappings.push({
        id: await mappedId(`legacy-logo-mapping-id:${legacyKey}`, deps, legacyKey),
        legacyId: legacyKey,
        mediaId: publication && publication.id,
        platformId: platform && platform.id,
        assetId: mappedAssetId,
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
      const currentAssetId = assetIds.get(text(legacy.assetId)) || null;
      const previousAssetId = assetIds.get(text(legacy.previousAssetId)) || null;
      referenceEvidence(sourceReferences, 'audit-entry', legacyId, 'entityId', legacy.entryId, entryId);
      referenceEvidence(sourceReferences, 'audit-asset', legacyId, 'after.assetId', legacy.assetId, currentAssetId);
      referenceEvidence(sourceReferences, 'audit-asset', legacyId, 'before.assetId', legacy.previousAssetId, previousAssetId);
      auditEvents.push(Object.assign(records.audit({
        id: await mappedId(`legacy-logo-history-id:${legacyId}`, deps, legacyId),
        entityType: entryId ? 'entry' : 'asset',
        entityId: entryId || currentAssetId,
        action: 'legacy-logo-change',
        source: 'migration',
        before: legacy.previousAssetId ? {assetId: previousAssetId} : null,
        after: legacy.assetId ? {assetId: currentAssetId, scope: legacy.scope || ''} : null,
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

    const globalLegacyAssetId = source.phase2Global.agencyLogoAssetId;
    const phase2Global = Object.assign({}, source.phase2Global, {
      key: 'phase2:global',
      agencyLogoAssetId: referenceEvidence(
        sourceReferences,
        'global-asset',
        'ck_phase2_global',
        'agencyLogoAssetId',
        globalLegacyAssetId,
        assetIds.get(text(globalLegacyAssetId))
      ),
      migrationReportId: reportId
    });

    return {
      rows: {
        projects: source.projects.map((project) => projectRecord(project, reportId, now, assetIds, sourceReferences)),
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
      binaryManifest: [...assetManifest, ...captureManifest],
      sourceReferences,
      phase2Global: Object.keys(source.phase2Global).length ? phase2Global : null
    };
  }

  function destinationKey(storeName, row) {
    return storeName === 'directories' || storeName === 'meta' ? row.key : row.id;
  }

  async function preflightStore(storeName, rows, reportId) {
    const existingRows = await db.run(storeName, 'readonly', (transaction) => db.request(transaction.objectStore(storeName).getAll()));
    const existingByKey = new Map(existingRows.map((row) => [destinationKey(storeName, row), row]));
    const pending = [];
    for (const row of rows) {
      const key = destinationKey(storeName, row);
      const existing = existingByKey.get(key);
      if (!existing) {
        pending.push(row);
        continue;
      }
      const exactResume = existing.migrationReportId === reportId
        && await fingerprint(existing) === await fingerprint(row);
      if (!exactResume) {
        throw codedError('MIGRATION_DESTINATION_COLLISION', `Destination ${storeName} row ${key} already exists`, {
          store: storeName,
          key,
          existingMigrationReportId: existing.migrationReportId || null
        });
      }
    }
    return pending;
  }

  async function preflightDestination(built, reportId) {
    const pending = {};
    for (const storeName of MIGRATED_STORES) {
      pending[storeName] = await preflightStore(storeName, built.rows[storeName], reportId);
    }
    pending.phase2Global = built.phase2Global
      ? await preflightStore('meta', [built.phase2Global], reportId)
      : [];
    return pending;
  }

  async function preflightNaturalKeys(source, reportId) {
    const checks = {
      projects: source.projects.map((project) => text(project.id)),
      platforms: source.platforms.map((platform, index) => text(platform.id || slug(platform.name, `platform-${index + 1}`))),
      directories: source.directories.map((directory) => text(directory.key))
    };
    for (const [storeName, keys] of Object.entries(checks)) {
      const rows = await db.run(storeName, 'readonly', (transaction) => db.request(transaction.objectStore(storeName).getAll()));
      const relevant = new Set(keys);
      const collision = rows.find((row) => relevant.has(destinationKey(storeName, row)) && row.migrationReportId !== reportId);
      if (collision) {
        throw codedError('MIGRATION_DESTINATION_COLLISION', `Destination ${storeName} row ${destinationKey(storeName, collision)} already exists`, {
          store: storeName,
          key: destinationKey(storeName, collision),
          existingMigrationReportId: collision.migrationReportId || null
        });
      }
    }
    if (Object.keys(source.phase2Global).length) {
      const existing = await getMeta('phase2:global');
      if (existing && existing.migrationReportId !== reportId) {
        throw codedError('MIGRATION_DESTINATION_COLLISION', 'Destination meta row phase2:global already exists', {
          store: 'meta',
          key: 'phase2:global',
          existingMigrationReportId: existing.migrationReportId || null
        });
      }
    }
  }

  async function writeBatches(storeName, rows, batchSize) {
    let inserted = 0;
    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      await db.run(storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        for (const row of batch) store.add(row);
      });
      inserted += batch.length;
    }
    return inserted;
  }

  async function migrate(options) {
    const deps = dependencies(options || {});
    const source = await collectLegacy(options && options.legacy ? options.legacy : options || {});
    const migrationInventory = await inventoryFromSource(source);
    const completed = await getMeta(COMPLETE_KEY);
    if (completed && completed.reportId) {
      const stored = reportFromRecord(await getMeta(`${REPORT_PREFIX}${completed.reportId}`));
      if (stored) {
        if (stored.inventory.fingerprint !== migrationInventory.fingerprint
          || JSON.stringify(stored.inventory.binaryManifest || []) !== JSON.stringify(migrationInventory.binaryManifest || [])) {
          stored.state = 'source-changed';
          stored.error = {code: 'MIGRATION_SOURCE_CHANGED', message: 'Legacy source changed after migration'};
          await putMeta(reportRecord(stored));
          await deleteMeta(COMPLETE_KEY);
          throw codedError('MIGRATION_SOURCE_CHANGED', 'Legacy source changed after migration', {
            reportId: stored.reportId,
            expectedFingerprint: stored.inventory.fingerprint,
            actualFingerprint: migrationInventory.fingerprint
          });
        }
        return Object.assign({}, stored, {rerun: true, addedRows: 0});
      }
    }

    const active = await getMeta(ACTIVE_KEY);
    let report = active && active.reportId
      ? reportFromRecord(await getMeta(`${REPORT_PREFIX}${active.reportId}`))
      : null;
    if (report && (report.inventory.fingerprint !== migrationInventory.fingerprint
      || JSON.stringify(report.inventory.binaryManifest || []) !== JSON.stringify(migrationInventory.binaryManifest || []))) {
      report.state = 'source-changed';
      report.error = {code: 'MIGRATION_SOURCE_CHANGED', message: 'Legacy source changed while migration was incomplete'};
      await putMeta(reportRecord(report));
      throw codedError('MIGRATION_SOURCE_CHANGED', 'Legacy source changed while migration was incomplete', {
        reportId: report.reportId,
        expectedFingerprint: report.inventory.fingerprint,
        actualFingerprint: migrationInventory.fingerprint
      });
    }
    if (!report) {
      const reportId = deps.uuid();
      const startedAt = deps.now();
      report = {
        reportId,
        version: VERSION,
        state: 'inventory-complete',
        startedAt,
        inventory: migrationInventory,
        sourceManifest: {
          fingerprint: migrationInventory.fingerprint,
          binaryManifest: migrationInventory.binaryManifest
        },
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

    if (migrationInventory.parseErrors.length) {
      report.state = 'source-parse-error';
      report.error = {code: 'MIGRATION_SOURCE_PARSE_ERROR', parseErrors: migrationInventory.parseErrors};
      await putMeta(reportRecord(report));
      throw codedError('MIGRATION_SOURCE_PARSE_ERROR', 'Legacy localStorage contains invalid JSON', {
        reportId: report.reportId,
        parseErrors: migrationInventory.parseErrors
      });
    }

    try {
      await preflightNaturalKeys(source, report.reportId);
      const built = await buildRows(source, report, deps);
      const pending = await preflightDestination(built, report.reportId);
      let addedRows = 0;
      for (const storeName of MIGRATED_STORES) {
        addedRows += await writeBatches(storeName, pending[storeName], deps.batchSize);
      }
      addedRows += await writeBatches('meta', pending.phase2Global, deps.batchSize);
      report = Object.assign({}, report, {
        state: 'migration-complete',
        migratedAt: deps.now(),
        mappings: built.mappings,
        binaryManifest: built.binaryManifest,
        sourceReferences: built.sourceReferences,
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
          phase2Globals: built.phase2Global ? 1 : 0,
          legacySchemaVersions: Object.keys(source.schemaVersions).length
        },
        addedRows
      });
      await putMeta(reportRecord(report));
      if (options && options.autoVerify === false) return report;
      const verification = await verify(report);
      report.verification = verification;
      report.state = verification.ok ? 'verified' : 'verification-failed';
      return report;
    } catch (error) {
      report.state = 'failed';
      report.error = {code: error.code || 'MIGRATION_FAILED', name: error.name || 'Error', message: error.message || String(error)};
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
      phase2Globals: rowsByStore.phase2Globals.length,
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
    const phase2Global = await getMeta('phase2:global');
    rowsByStore.phase2Globals = phase2Global && phase2Global.migrationReportId === report.reportId ? [phase2Global] : [];
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
    for (const reference of report.sourceReferences || []) {
      if (reference.required && !reference.resolvedId) {
        errors.push({
          code: 'SOURCE_REFERENCE_UNRESOLVED',
          kind: reference.kind,
          owner: reference.owner,
          field: reference.field,
          legacyValue: reference.legacyValue
        });
      }
    }
    for (const project of rowsByStore.projects) {
      for (const field of ['clientLogoAssetId', 'agencyLogoAssetId']) {
        if (project[field] && !assetIds.has(project[field])) pushMissing(errors, 'FOREIGN_KEY_MISSING', 'projects', project.id, field, project[field]);
      }
    }
    for (const globalSettings of rowsByStore.phase2Globals) {
      if (globalSettings.agencyLogoAssetId && !assetIds.has(globalSettings.agencyLogoAssetId)) {
        pushMissing(errors, 'FOREIGN_KEY_MISSING', 'meta', globalSettings.key, 'agencyLogoAssetId', globalSettings.agencyLogoAssetId);
      }
    }
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
          field: manifest.field,
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
        + rowsByStore.auditEvents.length * 3
        + rowsByStore.projects.length * 2
        + rowsByStore.phase2Globals.length,
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
      const rows = await migratedRows(storeName, reportId);
      await db.run(storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        for (const row of rows) store.delete(destinationKey(storeName, row));
      });
    }
    const globalSettings = await getMeta('phase2:global');
    if (globalSettings && globalSettings.migrationReportId === reportId) await deleteMeta('phase2:global');
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
