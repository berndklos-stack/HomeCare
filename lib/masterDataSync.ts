import { createSyncMutation, type SyncMutation } from "./syncQueue";

export type RevisionedMasterRecord = Record<string, unknown> & { id?: string; account?: string; revision?: number; updatedAt?: string };

function recordId(record: RevisionedMasterRecord) {
  return String(record.id ?? record.account ?? "");
}

function normalized(record: RevisionedMasterRecord) {
  return Object.fromEntries(Object.entries(record)
    .filter(([key, value]) => !["revision", "updatedAt", "stockTotal", "stockByLocation"].includes(key) && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
}

export function prepareMasterDataMutations(
  entityType: SyncMutation["entityType"], previous: RevisionedMasterRecord[], next: RevisionedMasterRecord[], now = new Date().toISOString(),
) {
  const mutations: SyncMutation[] = [];
  const previousById = new Map(previous.map((record) => [recordId(record), record]));
  const nextIds = new Set(next.map(recordId));
  const records = next.map((record) => {
    const id = recordId(record);
    const old = previousById.get(id);
    const changed = !old || JSON.stringify(normalized(old)) !== JSON.stringify(normalized(record));
    if (changed) mutations.push(createSyncMutation({ entityId: id, entityType, expectedRevision: old?.revision, operation: old ? "update" : "create", payload: normalized(record), resourceId: id }, now));
    return { ...record, revision: changed ? (old?.revision ?? 0) + 1 : record.revision, updatedAt: changed ? now : record.updatedAt };
  });
  previous.forEach((record) => {
    const id = recordId(record);
    if (!nextIds.has(id)) mutations.push(createSyncMutation({ entityId: id, entityType, expectedRevision: record.revision ?? 1, operation: "delete", resourceId: id }, now));
  });
  return { mutations, records };
}

export function overlayPendingMasterData<T extends RevisionedMasterRecord>(records: T[], entityType: SyncMutation["entityType"], queue: SyncMutation[]) {
  const map = new Map(records.map((record) => [recordId(record), record]));
  queue.filter((mutation) => mutation.entityType === entityType && !["synced", "conflict"].includes(mutation.status)).forEach((mutation) => {
    if (mutation.operation === "delete") map.delete(mutation.entityId);
    else map.set(mutation.entityId, { ...(map.get(mutation.entityId) ?? {}), ...mutation.payload, revision: (mutation.expectedRevision ?? 0) + 1, updatedAt: mutation.updatedAt } as T);
  });
  return Array.from(map.values());
}
