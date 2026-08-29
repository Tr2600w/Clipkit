(function (global) {
  'use strict';

  const repository = global.ClipKitRepository;
  const db = global.ClipKitDB;

  if (!repository) throw new Error('ClipKitRepository must be loaded before ClipKitLegacyAdapter');
  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitLegacyAdapter');

  const DEFAULT_FILE_PATTERN = '{YYMMDD}_{Publication}{PlatformSuffix}.pdf';
  let cache = frozenCache('', [], [], [], [], []);
  let recordCache = frozenRecordCache({});

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const copy = {};
      for (const [key, item] of Object.entries(value)) copy[key] = clone(item);
      return copy;
    }
    return value;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const item of Object.values(value)) deepFreeze(item);
    return Object.freeze(value);
  }

  function freezeRows(rows) {
    return Object.freeze((rows || []).map(deepFreeze));
  }

  function frozenCache(activeProjectId, projects, entries, media, platforms, usernameMappings) {
    return Object.freeze({
      activeProjectId,
      projects: freezeRows(projects),
      entries: freezeRows(entries),
      media: freezeRows(media),
      platforms: freezeRows(platforms),
      usernameMappings: freezeRows(usernameMappings)
    });
  }

  function frozenRecordCache(stores) {
    const result = {};
    for (const [storeName, rows] of Object.entries(stores || {})) {
      result[storeName] = freezeRows(rows);
    }
    return Object.freeze(result);
  }

  function readStore(storeName) {
    const storeRepository = repository[storeName];
    if (storeRepository && typeof storeRepository.getAll === 'function') return storeRepository.getAll();
    return db.run(storeName, 'readonly', (transaction) =>
      db.request(transaction.objectStore(storeName).getAll()));
  }

  function projectView(record) {
    const settings = clone(record.settings || {});
    return Object.assign(settings, {
      id: record.id,
      name: record.name || 'Untitled',
      clientName: record.clientName || record.name || 'Untitled',
      filePattern: settings.filePattern || DEFAULT_FILE_PATTERN,
      created: settings.created || String(record.createdAt || '').slice(0, 10),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      clientLogoAssetId: record.clientLogoAssetId || null,
      agencyLogoAssetId: record.agencyLogoAssetId || null
    });
  }

  function filePart(value) {
    return String(value || '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .replace(/^[.\-_]+|[.\-_]+$/g, '') || 'Untitled';
  }

  function outputFileName(entry, publication, platform, project) {
    if (!entry.publishedDate || !publication) return '';
    const compact = String(entry.publishedDate).replace(/-/g, '');
    const yymmdd = compact.length === 8 ? compact.slice(2) : compact;
    const platformName = platform ? platform.name : entry.platformId;
    const platformCode = platform ? platform.fileCode : platformName;
    const duration = String(entry.duration || '').trim();
    const suffix = !platformName || platformName === 'Website' || platformName === 'Web'
      ? ''
      : ` - ${platformCode || platformName}${platformName === 'TV' && duration ? ` - ${duration}` : ''}`;
    const pattern = project.filePattern || DEFAULT_FILE_PATTERN;
    let output = pattern
      .replaceAll('{YYMMDD}', yymmdd)
      .replaceAll('{Publication}', filePart(publication))
      .replaceAll('{PlatformSuffix}', suffix)
      .replaceAll('{Platform}', filePart(platformCode || platformName || ''))
      .replaceAll('{Project}', filePart(project.clientName || project.name || 'ClipKit'));
    output = output.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    return /\.pdf$/i.test(output) ? output : `${output}.pdf`;
  }

  function entryView(record) {
    const media = cache.media.find((row) => row.id === record.publicationId);
    const platform = cache.platforms.find((row) => row.id === record.platformId);
    const projectRecord = cache.projects.find((row) => row.id === record.projectId) || {};
    const project = projectView(projectRecord);
    const publication = record.publicationDisplayOverride || (media && (media.publication || media.name)) || '';
    const view = {
      id: record.id,
      date: record.publishedDate,
      pub: publication,
      platform: (platform && platform.name) || record.platformId || 'Website',
      prValue: record.prValueSnapshot,
      status: record.workflowStatus || 'draft',
      duration: record.duration || '',
      logoFile: record.logoFile || '',
      type: record.type || '',
      captureCount: Math.max(0, Number(record.captureCount) || 0),
      fileName: outputFileName(record, publication, platform, project),
      logoLockedAssetId: record.logoLockAssetId || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
    const url = record.urlDisplay || record.urlOriginal || '';
    if (url) view.url = url;
    if (record.headline) view.headline = record.headline;
    if (record.remark) view.remark = record.remark;
    return view;
  }

  function mediaView(record) {
    return {
      id: record.id,
      key: record.sourceKey || record.publication || record.name || '',
      pub: record.publication || record.name || '',
      platform: record.platform || 'Website',
      value: record.prValue,
      _src: record.source || 'custom',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  function platformView(record) {
    return {
      id: record.id,
      name: record.name,
      dbCode: record.dbCode || '',
      fileCode: record.fileCode || '',
      builtin: record.builtin === true,
      active: record.active !== false,
      aliases: clone(record.aliases || [])
    };
  }

  function getProjects() {
    return cache.projects.map(projectView);
  }

  function getEntries(projectId) {
    if (String(projectId) !== String(cache.activeProjectId)) return [];
    return cache.entries.map(entryView);
  }

  function getMediaRows() {
    return cache.media.filter((record) => record.deletedAt == null && !record.redirectToMediaId).map(mediaView);
  }

  function getPlatforms() {
    return cache.platforms.filter((record) => record.deletedAt == null).map(platformView);
  }

  function getUsernameMap() {
    const platforms = new Map(cache.platforms.map((row) => [row.id, row]));
    const media = new Map(cache.media.map((row) => [row.id, row]));
    const result = {};
    for (const record of cache.usernameMappings.filter((row) => row.deletedAt == null)) {
      const platform = platforms.get(record.platformId);
      const publication = media.get(record.mediaId);
      const platformName = (platform && platform.name) || record.platformId || '';
      const pub = record.publication || (publication && (publication.publication || publication.name)) || '';
      result[`${platformName.toLowerCase()}:${String(record.username || '').toLowerCase()}`] = {
        username: record.username || '', platform: platformName, pub
      };
    }
    return result;
  }

  function getRecords(storeName) {
    return (recordCache[storeName] || []).map(clone);
  }

  function getRecord(storeName, id) {
    const record = (recordCache[storeName] || []).find((row) => String(row.id) === String(id));
    return record ? clone(record) : null;
  }

  async function hydrate(activeProjectId) {
    const [projects, entries, media, platforms, usernameMappings, mediaAliases, domainMappings,
      mediaPlatformMappings, logoMappings] = await Promise.all([
      repository.projects.getAll(),
      repository.entries.listByProject(activeProjectId, {includeDeleted: false}),
      repository.media.getAll(),
      readStore('platforms'),
      readStore('usernameMappings'),
      readStore('mediaAliases'),
      readStore('domainMappings'),
      readStore('mediaPlatformMappings'),
      readStore('logoMappings')
    ]);
    cache = frozenCache(String(activeProjectId), projects, entries, media, platforms, usernameMappings);
    recordCache = frozenRecordCache({
      projects,
      entries,
      media,
      platforms,
      usernameMappings,
      mediaAliases,
      domainMappings,
      mediaPlatformMappings,
      logoMappings
    });
    return {
      activeProjectId: cache.activeProjectId,
      projects: getProjects(),
      entries: getEntries(cache.activeProjectId),
      mediaRows: getMediaRows(),
      platforms: getPlatforms(),
      usernameMap: getUsernameMap()
    };
  }

  async function refreshAfter(write, activeProjectId = cache.activeProjectId) {
    if (typeof write !== 'function') throw new TypeError('refreshAfter requires a write function');
    await write();
    return hydrate(activeProjectId);
  }

  global.ClipKitLegacyAdapter = {
    hydrate,
    refreshAfter,
    getProjects,
    getEntries,
    getMediaRows,
    getPlatforms,
    getUsernameMap,
    getRecord,
    getRecords
  };
}(globalThis));
