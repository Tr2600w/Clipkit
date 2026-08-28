import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Blob} from 'node:buffer';
import {TextDecoder, TextEncoder} from 'node:util';
import vm from 'node:vm';
import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function freshDatabase(tag) {
  const indexedDB = new IDBFactory();
  const context = {
    Blob,
    TextDecoder,
    TextEncoder,
    crypto: webcrypto,
    indexedDB,
    IDBKeyRange,
    structuredClone
  };
  context.globalThis = context;
  vm.createContext(context, {name: `clipkit-data-${tag}`});

  return {
    context,
    cleanup: async () => {
      if (context.ClipKitDB) {
        await context.ClipKitDB.deleteDatabase();
      }
    }
  };
}

export function loadDataScript(context, relativePath) {
  const scriptPath = path.resolve(repositoryRoot, relativePath);
  const source = fs.readFileSync(scriptPath, 'utf8');
  vm.runInContext(source, context, {filename: scriptPath});
}
