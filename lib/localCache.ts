import type { StorageLike } from "./syncQueue";

export const localCacheQuotaEvent = "workcore-local-cache-quota";

export function isStorageQuotaError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError");
}

// This is a read cache, not the durable mutation queue. A cache failure must
// not disable authenticated server synchronization or remove existing data.
export function writeLocalCache(storage: StorageLike, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    console.warn("Lokaler Lesecache konnte wegen vollem Browserspeicher nicht aktualisiert werden.", key);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(localCacheQuotaEvent));
    return false;
  }
}
