export type SyncMutationStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type SyncMutationOperation = "create" | "update" | "delete" | "restore";

export type SyncMutation = {
  id: string;
  entityId: string;
  entityType: "resource_type" | "operations" | "accounting_account" | "accounting_export" | "communication_media" | "customer" | "customer_contact" | "field_progress" | "inventory_location" | "invoice" | "invoice_line" | "job" | "job_note" | "job_time_entry" | "material" | "object" | "object_media" | "payment" | "personnel" | "portal_message" | "portal_message_reply" | "report" | "report_media" | "resource" | "service" | "service_package" | "setting" | "tenant_settings" | "translation" | "vehicle_media" | "vehicle_position" | "vehicle_trip";
  operation: SyncMutationOperation;
  resourceId: string;
  payload: Record<string, unknown>;
  expectedRevision?: number;
  status: SyncMutationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  serverRecord?: Record<string, unknown>;
};

export type SyncQueueSummary = {
  conflict: number;
  failed: number;
  pending: number;
  synced: number;
  syncing: number;
};

export type SyncMutationResult = {
  mutationId: string;
  record?: Record<string, unknown>;
  status: "synced" | "conflict";
  error?: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const syncQueueStorageKey = "workcore-sync-mutations-v1";

function compactSyncedHistory(queue: SyncMutation[]) {
  const retained = new Set(queue.filter((mutation) => mutation.status === "synced").slice(-30).map((mutation) => mutation.id));
  return queue.filter((mutation) => mutation.status !== "synced" || retained.has(mutation.id)).map((mutation) => mutation.status === "synced"
    ? { ...mutation, payload: {}, serverRecord: undefined }
    : mutation);
}

function currentSyncQueueStorageKey() {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") return syncQueueStorageKey;
  const tenantId = window.localStorage.getItem("workcore-active-tenant-id");
  return tenantId ? `${syncQueueStorageKey}:${tenantId}` : syncQueueStorageKey;
}

export function createStableId(prefix?: string) {
  const id = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16);
        const value = character === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
  return prefix ? `${prefix}-${id}` : id;
}

export function createSyncMutation(input: {
  entityId: string;
  entityType: SyncMutation["entityType"];
  expectedRevision?: number;
  operation: SyncMutationOperation;
  payload?: Record<string, unknown>;
  resourceId: string;
}, now = new Date().toISOString()): SyncMutation {
  return {
    attempts: 0,
    createdAt: now,
    entityId: input.entityId,
    entityType: input.entityType,
    expectedRevision: input.expectedRevision,
    id: createStableId(),
    operation: input.operation,
    payload: input.payload ?? {},
    resourceId: input.resourceId,
    status: "pending",
    updatedAt: now,
  };
}

export function normalizeSyncQueue(value: unknown): SyncMutation[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.filter((item): item is SyncMutation => {
    if (!item || typeof item !== "object") return false;
    const mutation = item as Partial<SyncMutation>;
    return Boolean(
      mutation.id
      && mutation.entityId
      && mutation.resourceId
      && ["resource_type", "operations", "accounting_account", "accounting_export", "communication_media", "customer", "customer_contact", "field_progress", "inventory_location", "invoice", "invoice_line", "job", "job_note", "job_time_entry", "material", "object", "object_media", "payment", "personnel", "portal_message", "portal_message_reply", "report", "report_media", "resource", "service", "service_package", "setting", "tenant_settings", "translation", "vehicle_media", "vehicle_position", "vehicle_trip"].includes(String(mutation.entityType))
      && ["create", "update", "delete", "restore"].includes(String(mutation.operation))
      && ["pending", "syncing", "synced", "failed", "conflict"].includes(String(mutation.status)),
    );
  }).map((mutation) => (
    mutation.status === "syncing" ? { ...mutation, status: "pending" as const } : mutation
  ));
  return compactSyncedHistory(normalized);
}

export function readSyncQueue(storage: StorageLike): SyncMutation[] {
  try {
    const storageKey = currentSyncQueueStorageKey();
    let serialized = storage.getItem(storageKey);
    if (!serialized && storageKey !== syncQueueStorageKey) {
      serialized = storage.getItem(syncQueueStorageKey);
      if (serialized) {
        storage.setItem(storageKey, serialized);
        storage.setItem(syncQueueStorageKey, "[]");
      }
    }
    return normalizeSyncQueue(JSON.parse(serialized || "[]"));
  } catch {
    return [];
  }
}

export function writeSyncQueue(storage: StorageLike, queue: SyncMutation[]) {
  const completed = compactSyncedHistory(queue).filter((mutation) => mutation.status === "synced");
  const actionable = queue.filter((mutation) => mutation.status !== "synced");
  storage.setItem(currentSyncQueueStorageKey(), JSON.stringify([...completed, ...actionable]));
}

export function persistSyncMutationBatch(storage: StorageLike, queue: SyncMutation[], mutations: SyncMutation[]) {
  const next = mutations.reduce(enqueueSyncMutation, queue);
  writeSyncQueue(storage, next);
  return next;
}

export function enqueueSyncMutation(queue: SyncMutation[], mutation: SyncMutation) {
  if (queue.some((item) => item.id === mutation.id)) return queue;
  if (["report", "field_progress", "job_note"].includes(mutation.entityType) && mutation.operation === "update" && mutation.attempts === 0) {
    let index = queue.length - 1;
    while (index >= 0 && (queue[index].entityType !== mutation.entityType || queue[index].entityId !== mutation.entityId)) index--;
    const previous = queue[index];
    // Only unsent, consecutive edits may collapse. Keep the server precondition
    // and idempotency identity; never rewrite attempted or conflicting requests.
    if (previous?.status === "pending" && previous.attempts === 0
      && (previous.operation === "update" || (mutation.entityType !== "report" && previous.operation === "create"))
      && previous.resourceId === mutation.resourceId
      && mutation.expectedRevision === (previous.expectedRevision ?? 0) + 1) {
      return queue.map((item, i) => i === index ? {
        ...previous, payload: mutation.payload, updatedAt: mutation.updatedAt,
      } : item);
    }
  }
  return [...queue, mutation];
}

export function retrySyncMutation(queue: SyncMutation[], mutationId?: string, now = new Date().toISOString()) {
  return queue.map((mutation) => {
    if (mutationId && mutation.id !== mutationId) return mutation;
    if (!mutationId && mutation.status !== "failed") return mutation;
    if (mutationId && !["failed", "conflict"].includes(mutation.status)) return mutation;
    return { ...mutation, error: undefined, status: "pending" as const, updatedAt: now };
  });
}

export function discardConflictingMutations(queue: SyncMutation[], mutationId?: string | string[]) {
  const selected = mutationId === undefined ? null : new Set(Array.isArray(mutationId) ? mutationId : [mutationId]);
  return queue.filter((mutation) => (
    selected === null
      ? mutation.status !== "conflict"
      : !(["conflict", "failed"].includes(mutation.status) && selected.has(mutation.id))
  ));
}

export function summarizeSyncQueue(queue: SyncMutation[]): SyncQueueSummary {
  return queue.reduce<SyncQueueSummary>((summary, mutation) => {
    summary[mutation.status] += 1;
    return summary;
  }, { conflict: 0, failed: 0, pending: 0, synced: 0, syncing: 0 });
}

export function nextPendingMutation(queue: SyncMutation[]) {
  return queue.find((mutation, index) => {
    if (mutation.status !== "pending") return false;
    if (mutation.entityType === "resource_type" && queue.some((previous, position) => position < index && previous.entityType === "resource_type"
      && previous.entityId === mutation.entityId && previous.status !== "synced")) return false;
    if (mutation.entityType === "resource" && typeof mutation.payload.resourceTypeId === "string" && queue.some((previous, position) =>
      position < index && previous.entityType === "resource_type" && previous.entityId === mutation.payload.resourceTypeId && previous.status !== "synced")) return false;
    return true;
  });
}

export function markMutationSyncing(queue: SyncMutation[], mutationId: string, now = new Date().toISOString()) {
  return compactSyncedHistory(queue.map((mutation) => mutation.id === mutationId
    ? { ...mutation, attempts: mutation.attempts + 1, error: undefined, status: "syncing" as const, updatedAt: now }
    : mutation));
}

export function settleSyncMutation(
  queue: SyncMutation[],
  mutationId: string,
  result: SyncMutationResult,
  now = new Date().toISOString(),
) {
  return compactSyncedHistory(queue.map((mutation) => mutation.id === mutationId
    ? {
        ...mutation,
        error: result.error,
        serverRecord: result.record,
        status: result.status,
        updatedAt: now,
      }
    : mutation));
}

export function failSyncMutation(queue: SyncMutation[], mutationId: string, error: string, now = new Date().toISOString()) {
  return queue.map((mutation) => mutation.id === mutationId
    ? { ...mutation, error, status: "failed" as const, updatedAt: now }
    : mutation);
}
