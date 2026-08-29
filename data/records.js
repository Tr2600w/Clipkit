(function (global) {
  'use strict';

  function defaultDependencies() {
    return {
      uuid: () => global.crypto.randomUUID(),
      now: () => new Date().toISOString()
    };
  }

  function dependencies(overrides) {
    return Object.assign(defaultDependencies(), overrides || {});
  }

  function optionalString(value) {
    return value == null ? '' : String(value);
  }

  function nullableId(value) {
    return value == null || value === '' ? null : String(value);
  }

  function finiteNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function requiredString(input, field) {
    if (input[field] == null || String(input[field]).trim() === '') {
      throw new Error(`${field} is required`);
    }
    return String(input[field]);
  }

  function project(input, injectedDependencies) {
    const source = input || {};
    const deps = dependencies(injectedDependencies);
    const now = source.createdAt || deps.now();
    return {
      id: source.id || deps.uuid(),
      name: optionalString(source.name),
      clientName: optionalString(source.clientName),
      settings: source.settings == null ? {} : source.settings,
      resolverConfigRef: nullableId(source.resolverConfigRef),
      createdAt: now,
      updatedAt: source.updatedAt || now,
      deletedAt: source.deletedAt || null,
      recordVersion: Number.isFinite(source.recordVersion) ? source.recordVersion : 1
    };
  }

  function entry(input, injectedDependencies) {
    const source = input || {};
    const deps = dependencies(injectedDependencies);
    const now = source.createdAt || deps.now();
    return {
      id: source.id || deps.uuid(),
      projectId: requiredString(source, 'projectId'),
      publicationId: requiredString(source, 'publicationId'),
      publicationDisplayOverride: optionalString(source.publicationDisplayOverride),
      platformId: requiredString(source, 'platformId'),
      publishedDate: requiredString(source, 'publishedDate'),
      publishedAtRaw: optionalString(source.publishedAtRaw),
      publishedTimezone: optionalString(source.publishedTimezone),
      urlOriginal: optionalString(source.urlOriginal),
      urlCanonical: optionalString(source.urlCanonical),
      urlDisplay: optionalString(source.urlDisplay),
      urlFingerprint: optionalString(source.urlFingerprint),
      platformContentId: optionalString(source.platformContentId),
      prValueSnapshot: finiteNumber(source.prValueSnapshot),
      prSource: optionalString(source.prSource),
      duration: optionalString(source.duration),
      headline: optionalString(source.headline),
      remark: optionalString(source.remark),
      workflowStatus: optionalString(source.workflowStatus) || 'draft',
      logoLockAssetId: nullableId(source.logoLockAssetId),
      exportOrder: finiteNumber(source.exportOrder),
      createdAt: now,
      updatedAt: source.updatedAt || now,
      deletedAt: source.deletedAt || null,
      recordVersion: Number.isFinite(source.recordVersion) ? source.recordVersion : 1
    };
  }

  function audit(input, injectedDependencies) {
    const source = input || {};
    const deps = dependencies(injectedDependencies);
    const now = source.createdAt || deps.now();
    return {
      id: source.id || deps.uuid(),
      entityType: optionalString(source.entityType),
      entityId: nullableId(source.entityId),
      action: optionalString(source.action),
      source: optionalString(source.source),
      before: source.before == null ? null : source.before,
      after: source.after == null ? null : source.after,
      revision: finiteNumber(source.revision),
      createdAt: now
    };
  }

  function hasReference(references, booleanName, collectionName) {
    if (typeof references[booleanName] === 'boolean') return references[booleanName];
    const collection = references[collectionName];
    return Array.isArray(collection) ? collection.length > 0 : Boolean(collection);
  }

  function hasUnresolvedCandidates(references, type) {
    const direct = references[`unresolved${type}Candidates`];
    if (typeof direct === 'boolean') return direct;
    if (Array.isArray(direct)) return direct.length > 0;
    const inspection = references.inspection || {};
    const candidates = inspection[`${type.charAt(0).toLowerCase()}${type.slice(1)}Candidates`]
      || references[`${type.charAt(0).toLowerCase()}${type.slice(1)}Candidates`];
    return Array.isArray(candidates) && candidates.some((candidate) => !candidate.confirmedByUser && !candidate.confirmed);
  }

  function evaluateReadiness(entryRecord, inputReferences) {
    const entry = entryRecord || {};
    const references = inputReferences || {};
    const blockers = [];
    const warnings = [];

    if (!Number.isFinite(entry.prValueSnapshot)) blockers.push('pr-value');
    if (!hasReference(references, 'hasLogo', 'logos')) blockers.push('logo');
    if (!hasReference(references, 'hasCapture', 'captures')) blockers.push('capture');
    if (hasUnresolvedCandidates(references, 'Url')) blockers.push('url-candidates');
    if (hasUnresolvedCandidates(references, 'Date')) blockers.push('date-candidates');

    const lowDpiUnconfirmed = references.lowDpiUnconfirmed === true
      || references.unconfirmedLowDpi === true
      || (references.lowDpi && references.lowDpi.confirmed !== true);
    if (lowDpiUnconfirmed) warnings.push('low-dpi-unconfirmed');

    if (references.requiresTemplateAsset && !hasReference(references, 'hasTemplateAsset', 'templateAssets')) {
      blockers.push('template-assets');
    }
    if (references.requiresProjectAsset && !hasReference(references, 'hasProjectAsset', 'projectAssets')) {
      blockers.push('project-assets');
    }

    const state = blockers.length === 0
      ? 'ready'
      : references.priorReadinessState === 'ready' ? 'needs-review' : 'blocked';
    return {state, blockers, warnings};
  }

  global.ClipKitRecords = {project, entry, audit, evaluateReadiness};
}(globalThis));
