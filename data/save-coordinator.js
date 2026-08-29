(function (global) {
  'use strict';

  const db = global.ClipKitDB;
  const records = global.ClipKitRecords;

  if (!db) throw new Error('ClipKitDB must be loaded before ClipKitSave');
  if (!records) throw new Error('ClipKitRecords must be loaded before ClipKitSave');

  const transactionStores = [
    'meta',
    'entries',
    'media',
    'mediaAliases',
    'domainMappings',
    'usernameMappings',
    'mediaPlatformMappings',
    'provenance',
    'inspections',
    'auditEvents'
  ];
  const mappingStores = new Map([
    ['alias', 'mediaAliases'],
    ['mediaAlias', 'mediaAliases'],
    ['mediaAliases', 'mediaAliases'],
    ['domain', 'domainMappings'],
    ['domainMapping', 'domainMappings'],
    ['domainMappings', 'domainMappings'],
    ['username', 'usernameMappings'],
    ['usernameMapping', 'usernameMappings'],
    ['usernameMappings', 'usernameMappings'],
    ['mediaPlatform', 'mediaPlatformMappings'],
    ['mediaPlatformMapping', 'mediaPlatformMappings'],
    ['mediaPlatformMappings', 'mediaPlatformMappings']
  ]);
  const protectedPatchKeys = new Set(['id', 'createdAt', 'urlOriginal', 'recordVersion', 'updatedAt']);
  const entryPatchKeys = new Set([
    'projectId',
    'publicationId',
    'publicationDisplayOverride',
    'platformId',
    'publishedDate',
    'publishedAtRaw',
    'publishedTimezone',
    'urlCanonical',
    'urlDisplay',
    'urlFingerprint',
    'platformContentId',
    'prValueSnapshot',
    'prSource',
    'duration',
    'headline',
    'remark',
    'workflowStatus',
    'logoLockAssetId',
    'exportOrder',
    'deletedAt'
  ]);

  function codedError(code, message, properties) {
    const error = new Error(message);
    error.code = code;
    return Object.assign(error, properties || {});
  }

  function validationError(message) {
    return codedError('VALIDATION_FAILED', message);
  }

  function isPlainObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  function requireString(value, name) {
    if (value == null || String(value).trim() === '') throw validationError(`${name} is required`);
    return String(value);
  }

  function cloneRecord(record, name) {
    if (!isPlainObject(record)) throw validationError(`${name} must be an object`);
    if (record.id == null || String(record.id).trim() === '') throw validationError(`${name}.id is required`);
    return Object.assign({}, record, {id: String(record.id)});
  }

  function normalizeCollection(value, name) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw validationError(`${name} must be an array`);
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw validationError(`${name} must not be sparse`);
      }
    }
    return value.map((record) => cloneRecord(record, name));
  }

  function mappingStore(record) {
    const type = record.store || record.storeName || record.mappingType || record.type;
    const store = mappingStores.get(type);
    if (!store) throw validationError('mapping type is invalid');
    return store;
  }

  function normalizeMappings(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw validationError('mappings must be an array');
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw validationError('mappings must not be sparse');
      }
    }
    return value.map((mapping) => {
      const record = cloneRecord(mapping, 'mapping');
      return {store: mappingStore(record), record};
    });
  }

  function normalizeEntry(value) {
    try {
      const entry = records.entry(value);
      if (entry.recordVersion !== 1) throw validationError('entry.recordVersion must be 1 when creating an entry');
      return entry;
    } catch (error) {
      if (error && error.code === 'VALIDATION_FAILED') throw error;
      throw validationError(error && error.message ? error.message : 'entry is invalid');
    }
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (isPlainObject(value)) {
      return `{${Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    if (value === undefined) return 'undefined';
    return JSON.stringify(value);
  }

  function referenceList(records) {
    return records.map((record) => record.id).sort();
  }

  function requestIdentity(entry, inputEntry, media, aliases, mappings, provenance, inspection, source) {
    const entryIdentity = Object.assign({}, entry);
    delete entryIdentity.id;
    delete entryIdentity.createdAt;
    delete entryIdentity.updatedAt;
    delete entryIdentity.recordVersion;
    if (inputEntry && inputEntry.id != null && String(inputEntry.id).trim() !== '') {
      entryIdentity.id = entry.id;
    }
    return stableStringify({
      entry: entryIdentity,
      mediaId: media ? media.id : null,
      aliases: referenceList(aliases),
      mappings: mappings.map((mapping) => ({store: mapping.store, id: mapping.record.id}))
        .sort((first, second) => `${first.store}:${first.id}`.localeCompare(`${second.store}:${second.id}`)),
      provenance: referenceList(provenance),
      inspectionId: inspection ? inspection.id : null,
      source
    });
  }

  function prepareSave(command) {
    if (!isPlainObject(command)) throw validationError('command must be an object');
    const entry = normalizeEntry(command.entry);
    const media = command.media == null ? null : cloneRecord(command.media, 'media');
    const aliases = normalizeCollection(command.aliases, 'aliases');
    const mappings = normalizeMappings(command.mappings);
    const provenance = normalizeCollection(command.provenance, 'provenance');
    const inspection = command.inspection == null ? null : cloneRecord(command.inspection, 'inspection');
    const source = command.source == null ? '' : String(command.source);
    const requestId = requireString(command.requestId, 'requestId');
    const auditEvent = records.audit({
      entityType: 'entry',
      entityId: entry.id,
      action: 'created',
      source,
      before: null,
      after: entry,
      revision: 1
    });
    const identity = requestIdentity(
      entry,
      command.entry,
      media,
      aliases,
      mappings,
      provenance,
      inspection,
      source
    );

    return {requestId, entry, media, aliases, mappings, provenance, inspection, auditEvent, identity};
  }

  function putAll(transaction, prepared, receipt) {
    transaction.objectStore('entries').put(prepared.entry);
    if (prepared.media) transaction.objectStore('media').put(prepared.media);
    for (const alias of prepared.aliases) transaction.objectStore('mediaAliases').put(alias);
    for (const mapping of prepared.mappings) transaction.objectStore(mapping.store).put(mapping.record);
    for (const record of prepared.provenance) transaction.objectStore('provenance').put(record);
    if (prepared.inspection) transaction.objectStore('inspections').put(prepared.inspection);
    transaction.objectStore('auditEvents').add(prepared.auditEvent);
    transaction.objectStore('meta').put(receipt);
  }

  function abort(transaction) {
    try {
      transaction.abort();
    } catch (error) {
      // The transaction may already be aborting from a request error.
    }
  }

  function saveEntry(command) {
    let prepared;
    try {
      prepared = prepareSave(command);
    } catch (error) {
      return Promise.reject(error);
    }
    const receiptKey = `request:${prepared.requestId}`;
    let transactionError;

    return db.run(transactionStores, 'readwrite', (transaction) => {
      const fail = (error) => {
        if (!transactionError) transactionError = error;
        abort(transaction);
        return null;
      };
      const meta = transaction.objectStore('meta');
      return db.request(meta.get(receiptKey)).then((receipt) => {
        if (receipt) {
          if (receipt.identity !== prepared.identity) {
            return fail(codedError('IDEMPOTENCY_CONFLICT', 'request ID was reused with different records'));
          }
          if (!Array.isArray(receipt.mappings) || receipt.auditEventId == null) {
            return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt is incomplete'));
          }
          return db.request(transaction.objectStore('entries').get(receipt.entryId)).then((entry) => {
            if (!entry) {
              return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has no committed entry'));
            }
            if (receipt.mediaId != null && String(receipt.mediaId).trim() === '') {
              return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has an invalid media reference'));
            }
            if (receipt.mappings.some((mapping) =>
              !mapping || !mappingStores.has(mapping.store) || mapping.id == null || String(mapping.id).trim() === '')) {
              return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has invalid mapping references'));
            }
            const mediaRequest = receipt.mediaId == null
              ? Promise.resolve(null)
              : db.request(transaction.objectStore('media').get(receipt.mediaId));
            return mediaRequest.then((media) => {
              if (receipt.mediaId != null && !media) {
                return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has no committed media'));
              }
              const mappingRequests = receipt.mappings.map((mapping) =>
                db.request(transaction.objectStore(mapping.store).get(mapping.id)));
              return Promise.all(mappingRequests).then((mappings) => {
                if (mappings.some((mapping) => !mapping)) {
                  return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has no committed mapping'));
                }
                return db.request(transaction.objectStore('auditEvents').get(receipt.auditEventId)).then((auditEvent) => {
                  if (!auditEvent) {
                    return fail(codedError('IDEMPOTENCY_CONFLICT', 'idempotency receipt has no committed audit event'));
                  }
                  return {entry, media: media || undefined, mappings, auditEvent};
                });
              });
            });
          });
        }

        const committedAt = new Date().toISOString();
        const receiptRecord = {
          key: receiptKey,
          entryId: prepared.entry.id,
          mediaId: prepared.media ? prepared.media.id : null,
          mappings: prepared.mappings.map((mapping) => ({store: mapping.store, id: mapping.record.id})),
          auditEventId: prepared.auditEvent.id,
          identity: prepared.identity,
          committedAt
        };
        putAll(transaction, prepared, receiptRecord);
        return {
          entry: prepared.entry,
          media: prepared.media || undefined,
          mappings: prepared.mappings.map((mapping) => mapping.record),
          auditEvent: prepared.auditEvent
        };
      }).catch(fail);
    }).catch((error) => {
      throw transactionError || error;
    });
  }

  function validatePatch(patch) {
    if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
      throw validationError('patch must include at least one field');
    }
    for (const key of Object.keys(patch)) {
      if (protectedPatchKeys.has(key)) throw validationError(`${key} cannot be changed through a generic patch`);
      if (!entryPatchKeys.has(key)) throw validationError(`${key} is not an entry field`);
    }
  }

  function updateEntry(id, expectedRevision, patch, source) {
    try {
      requireString(id, 'id');
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        throw validationError('expectedRevision must be a positive integer');
      }
      validatePatch(patch);
    } catch (error) {
      return Promise.reject(error);
    }

    let transactionError;
    return db.run(['entries', 'auditEvents'], 'readwrite', (transaction) => {
      const fail = (error) => {
        if (!transactionError) transactionError = error;
        abort(transaction);
        return null;
      };
      const entries = transaction.objectStore('entries');
      const auditEvents = transaction.objectStore('auditEvents');
      return db.request(entries.get(id)).then((current) => {
        if (!current || current.recordVersion !== expectedRevision) {
          return fail(codedError('REVISION_CONFLICT', 'entry revision does not match the expected revision', {
            conflict: true,
            currentRecord: current || null
          }));
        }

        let next;
        try {
          next = records.entry(Object.assign({}, current, patch, {
            id: current.id,
            createdAt: current.createdAt,
            urlOriginal: current.urlOriginal,
            updatedAt: new Date().toISOString(),
            recordVersion: current.recordVersion + 1
          }));
        } catch (error) {
          return fail(validationError(error && error.message ? error.message : 'patch is invalid'));
        }
        const auditEvent = records.audit({
          entityType: 'entry',
          entityId: next.id,
          action: 'updated',
          source: source == null ? '' : String(source),
          before: current,
          after: next,
          revision: next.recordVersion
        });
        entries.put(next);
        auditEvents.add(auditEvent);
        return next;
      }).catch(fail);
    }).catch((error) => {
      throw transactionError || error;
    });
  }

  global.ClipKitSave = {saveEntry, updateEntry};
}(globalThis));
