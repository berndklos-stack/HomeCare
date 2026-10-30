import type { SyncMutation, SyncMutationOperation } from "@/lib/syncQueue";

export type RevisionedResource = Record<string, unknown> & {
  id: string;
  deletedAt?: string;
  logbook?: unknown[];
  revision?: number;
  updatedAt?: string;
};

export type RevisionedVehiclePosition = Record<string, unknown> & {
  deletedAt?: string;
  resourceId: string;
  revision?: number;
  updatedAt?: string;
};

export type PlannedResourceMutation = {
  entityId: string;
  entityType: "resource";
  expectedRevision?: number;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
  resourceId: string;
};

const resourceTransientFields = new Set(["deletedAt", "logbook", "revision", "updatedAt"]);

export function resourceMutationPayload(resource: RevisionedResource) {
  return Object.fromEntries(
    Object.entries(resource).filter(([key]) => !resourceTransientFields.has(key)),
  );
}

function fingerprint(resource: RevisionedResource) {
  return JSON.stringify(resourceMutationPayload(resource));
}

export function prepareResourceMutations<T extends RevisionedResource>(
  currentResources: T[],
  nextResources: T[],
  now = new Date().toISOString(),
) {
  const currentById = new Map(currentResources.map((resource) => [resource.id, resource]));
  const nextIds = new Set(nextResources.map((resource) => resource.id));
  const mutations: PlannedResourceMutation[] = [];

  const resources = nextResources.map((resource) => {
    const current = currentById.get(resource.id);
    if (!current) {
      const created = { ...resource, revision: 1, updatedAt: now } as T;
      mutations.push({
        entityId: resource.id,
        entityType: "resource",
        operation: "create",
        payload: resourceMutationPayload(created),
        resourceId: resource.id,
      });
      return created;
    }

    if (fingerprint(current) === fingerprint(resource)) {
      return {
        ...resource,
        revision: current.revision,
        updatedAt: current.updatedAt,
      } as T;
    }

    const expectedRevision = current.revision ?? 1;
    const updated = { ...resource, revision: expectedRevision + 1, updatedAt: now } as T;
    mutations.push({
      entityId: resource.id,
      entityType: "resource",
      expectedRevision,
      operation: "update",
      payload: resourceMutationPayload(updated),
      resourceId: resource.id,
    });
    return updated;
  });

  currentResources.forEach((resource) => {
    if (nextIds.has(resource.id)) return;
    mutations.push({
      entityId: resource.id,
      entityType: "resource",
      expectedRevision: resource.revision ?? 1,
      operation: "delete",
      payload: {},
      resourceId: resource.id,
    });
  });

  return { mutations, resources };
}

export function overlayPendingResourceMutations<T extends RevisionedResource>(
  resources: T[],
  queue: SyncMutation[],
  latestResources: T[] = [],
) {
  const latestById = new Map(latestResources.map((resource) => [resource.id, resource]));
  const confirmedRevisions = new Map<string, number>();
  queue.forEach((mutation) => {
    if (mutation.entityType !== "resource" || mutation.status !== "synced" || mutation.operation === "delete") return;
    const revision = typeof mutation.serverRecord?.revision === "number"
      ? mutation.serverRecord.revision : (mutation.expectedRevision ?? 0) + 1;
    confirmedRevisions.set(mutation.entityId, Math.max(confirmedRevisions.get(mutation.entityId) ?? 0, revision));
  });
  // A GET may have read revision 83 before our write confirmed revision 84.
  // Only a durable acknowledgement, never a cached/optimistic revision alone,
  // may protect the current record from that delayed response.
  const resourcesById = new Map(resources.map((resource) => {
    const latest = latestById.get(resource.id);
    const confirmed = confirmedRevisions.get(resource.id);
    const conflicted = queue.some((mutation) => mutation.entityType === "resource"
      && mutation.entityId === resource.id && mutation.status === "conflict");
    return [resource.id, latest && confirmed !== undefined && !conflicted
      && latest.revision === confirmed && (resource.revision ?? 0) < confirmed
      ? latest : resource];
  }));
  queue
    .filter((mutation) => mutation.entityType === "resource" && mutation.status !== "synced" && mutation.status !== "conflict")
    .forEach((mutation) => {
      if (mutation.operation === "delete") {
        resourcesById.delete(mutation.entityId);
        return;
      }
      const current = resourcesById.get(mutation.entityId);
      resourcesById.set(mutation.entityId, {
        ...(current ?? { id: mutation.entityId }),
        ...mutation.payload,
        id: mutation.entityId,
        revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
        updatedAt: mutation.updatedAt,
      } as T);
    });
  return Array.from(resourcesById.values());
}

export function overlayPendingVehiclePositionMutations<T extends RevisionedVehiclePosition>(
  positions: T[],
  queue: SyncMutation[],
) {
  const positionsByResource = new Map(positions.map((position) => [position.resourceId, position]));
  queue
    .filter((mutation) => mutation.entityType === "vehicle_position" && mutation.status !== "synced" && mutation.status !== "conflict")
    .forEach((mutation) => {
      if (mutation.operation === "delete") {
        positionsByResource.delete(mutation.resourceId);
        return;
      }
      const current = positionsByResource.get(mutation.resourceId);
      positionsByResource.set(mutation.resourceId, {
        ...(current ?? { resourceId: mutation.resourceId }),
        ...mutation.payload,
        resourceId: mutation.resourceId,
        revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
        updatedAt: mutation.updatedAt,
      } as T);
    });
  return Array.from(positionsByResource.values());
}
