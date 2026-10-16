import type { StorageLike } from "./syncQueue";

export const localCacheQuotaEvent = "workcore-local-cache-quota";
export const localCacheRecoveredEvent = "workcore-local-cache-recovered";
const largeCacheThreshold = 128 * 1024;
const memory = new Map<string, { value: string; previous: string | null }>();
const generations = new Map<string, number>();
const failedKeys = new Set<string>();
let database: Promise<IDBDatabase> | undefined;

function canUseDatabase(storage: StorageLike) {
  try { return typeof window !== "undefined" && storage === window.localStorage && typeof indexedDB !== "undefined"; }
  catch { return false; }
}

function openCache() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => { settled = true; database = undefined; reject(new Error("Read cache database timeout")); }, 8000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open("workcore-read-cache", 1); }
    catch (error) { clearTimeout(timeout); throw error; }
    request.onupgradeneeded = () => request.result.createObjectStore("sections");
    request.onerror = () => { clearTimeout(timeout); settled = true; database = undefined; reject(request.error); };
    request.onblocked = () => { clearTimeout(timeout); settled = true; database = undefined; reject(new Error("Read cache database blocked")); };
    request.onsuccess = () => {
      clearTimeout(timeout);
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  }).catch(error => { database = undefined; throw error; });
  return database;
}

function reportFailure(key: string) {
  failedKeys.add(key);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(localCacheQuotaEvent));
}

function reportRecovery(key: string) {
  failedKeys.delete(key);
  if (typeof window !== "undefined" && failedKeys.size === 0) window.dispatchEvent(new Event(localCacheRecoveredEvent));
}

async function storeLargeCache(storage: StorageLike, key: string, value: string) {
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation);
  const previous = storage.getItem(key);
  memory.set(key, { value, previous });
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("sections", "readwrite");
      const timeout = setTimeout(() => {
        try { transaction.abort(); } catch { /* Already closed. */ }
        reject(new Error("Read cache write timeout"));
      }, 8000);
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(); };
      transaction.onabort = () => { clearTimeout(timeout); reject(transaction.error); };
      transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error); };
      try { transaction.objectStore("sections").put(value, key); }
      catch (error) { clearTimeout(timeout); reject(error); }
    });
    if (generations.get(key) === generation) {
      // Never remove a newer draft or a key outside the explicit read-cache list.
      if (storage.getItem(key) === previous && "removeItem" in storage && typeof storage.removeItem === "function") storage.removeItem(key);
      memory.set(key, { value, previous: null });
      reportRecovery(key);
    }
    return true;
  } catch {
    if (generations.get(key) === generation) { memory.delete(key); reportFailure(key); }
    return false;
  }
}

export function readLocalCache(storage: StorageLike, key: string) {
  const local = storage.getItem(key);
  if (!canUseDatabase(storage)) return local;
  const cached = memory.get(key);
  return cached && (local === null || local === cached.previous) ? cached.value : local;
}

// Hydrate before constructing the application snapshot. Keys remain tenant-scoped.
export async function hydrateLocalReadCache(storage: StorageLike, keys: string[]) {
  if (!canUseDatabase(storage)) return;
  const deadline = Date.now() + 8000;
  try {
    const db = await openCache();
    const values = await new Promise<Array<[string, string]>>((resolve, reject) => {
      const transaction = db.transaction("sections", "readonly");
      const timeout = setTimeout(() => {
        try { transaction.abort(); } catch { /* Already closed. */ }
        reject(new Error("Read cache read timeout"));
      }, 8000);
      const rows: Array<[string, string]> = [];
      for (const key of keys) {
        const request = transaction.objectStore("sections").get(key);
        request.onsuccess = () => { if (typeof request.result === "string") rows.push([key, request.result]); };
      }
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(rows); };
      transaction.onabort = () => { clearTimeout(timeout); reject(transaction.error); };
      transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error); };
    });
    for (const [key, value] of values) if (!memory.has(key)) memory.set(key, { value, previous: null });
    for (const key of keys) {
      if (Date.now() >= deadline) break;
      const local = storage.getItem(key);
      if (local && local.length >= largeCacheThreshold) await storeLargeCache(storage, key, local);
    }
  } catch {
    // Keep every original local value if IndexedDB is unavailable.
  }
}

export function isStorageQuotaError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError");
}

// This is a read cache, not the durable mutation queue. A cache failure must
// not disable authenticated server synchronization or remove existing data.
export function writeLocalCache(storage: StorageLike, key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized && serialized.length >= largeCacheThreshold && canUseDatabase(storage)) {
    void storeLargeCache(storage, key, serialized);
    return false;
  }
  try {
    storage.setItem(key, serialized);
    if (canUseDatabase(storage)) {
      generations.set(key, (generations.get(key) ?? 0) + 1);
      memory.delete(key);
      // Retire stale larger copies only after the smaller local write succeeds.
      void openCache().then(db => { db.transaction("sections", "readwrite").objectStore("sections").delete(key); }).catch(() => undefined);
      reportRecovery(key);
    }
    return true;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    if (canUseDatabase(storage)) void storeLargeCache(storage, key, serialized);
    else reportFailure(key);
    return false;
  }
}
