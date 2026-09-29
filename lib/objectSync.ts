import type { SyncMutation, SyncMutationOperation } from "@/lib/syncQueue";

export type RevisionedObjectMedia = Record<string, unknown> & {
  id: string;
  revision?: number;
  updatedAt?: string;
};

export type RevisionedObject = Record<string, unknown> & {
  id: string;
  media: {
    documents: number;
    floorPlans: number;
    images: number;
    items: RevisionedObjectMedia[];
  };
  revision?: number;
  updatedAt?: string;
};

export type PlannedObjectMutation = {
  entityId: string;
  entityType: "object" | "object_media";
  expectedRevision?: number;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
  resourceId: string;
};

const objectTransientFields = new Set(["deletedAt", "id", "media", "revision", "updatedAt"]);
const mediaTransientFields = new Set(["deletedAt", "id", "revision", "updatedAt"]);

export function objectMutationPayload(object: RevisionedObject) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !objectTransientFields.has(key)));
}

export function objectMediaMutationPayload(item: RevisionedObjectMedia) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !mediaTransientFields.has(key)));
}

function fingerprint(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

export function prepareObjectMutations<T extends RevisionedObject>(
  currentObjects: T[],
  nextObjects: T[],
  now = new Date().toISOString(),
) {
  const currentById = new Map(currentObjects.map((object) => [object.id, object]));
  const nextIds = new Set(nextObjects.map((object) => object.id));
  const mutations: PlannedObjectMutation[] = [];

  const objects = nextObjects.map((object) => {
    const current = currentById.get(object.id);
    let revision = current?.revision;
    let updatedAt = current?.updatedAt;

    if (!current) {
      revision = 1;
      updatedAt = now;
      mutations.push({
        entityId: object.id,
        entityType: "object",
        operation: "create",
        payload: objectMutationPayload(object),
        resourceId: object.id,
      });
    } else if (fingerprint(objectMutationPayload(current)) !== fingerprint(objectMutationPayload(object))) {
      const expectedRevision = current.revision ?? 1;
      revision = expectedRevision + 1;
      updatedAt = now;
      mutations.push({
        entityId: object.id,
        entityType: "object",
        expectedRevision,
        operation: "update",
        payload: objectMutationPayload(object),
        resourceId: object.id,
      });
    }

    const currentItems = new Map((current?.media.items ?? []).map((item) => [item.id, item]));
    const nextItemIds = new Set(object.media.items.map((item) => item.id));
    const items = object.media.items.map((item) => {
      const previous = currentItems.get(item.id);
      if (!previous) {
        mutations.push({
          entityId: item.id,
          entityType: "object_media",
          operation: "create",
          payload: objectMediaMutationPayload(item),
          resourceId: object.id,
        });
        return { ...item, revision: 1, updatedAt: now };
      }
      if (fingerprint(objectMediaMutationPayload(previous)) === fingerprint(objectMediaMutationPayload(item))) {
        return { ...item, revision: previous.revision, updatedAt: previous.updatedAt };
      }
      const expectedRevision = previous.revision ?? 1;
      mutations.push({
        entityId: item.id,
        entityType: "object_media",
        expectedRevision,
        operation: "update",
        payload: objectMediaMutationPayload(item),
        resourceId: object.id,
      });
      return { ...item, revision: expectedRevision + 1, updatedAt: now };
    });

    currentItems.forEach((item) => {
      if (nextItemIds.has(item.id)) return;
      mutations.push({
        entityId: item.id,
        entityType: "object_media",
        expectedRevision: item.revision ?? 1,
        operation: "delete",
        payload: {},
        resourceId: object.id,
      });
    });

    return { ...object, media: { ...object.media, items }, revision, updatedAt } as T;
  });

  currentObjects.forEach((object) => {
    if (nextIds.has(object.id)) return;
    mutations.push({
      entityId: object.id,
      entityType: "object",
      expectedRevision: object.revision ?? 1,
      operation: "delete",
      payload: {},
      resourceId: object.id,
    });
  });

  return { mutations, objects };
}

function pending(queue: SyncMutation[], type: SyncMutation["entityType"]) {
  return queue.filter((mutation) => mutation.entityType === type && !["synced", "conflict"].includes(mutation.status));
}

export function overlayPendingObjectMutations<T extends RevisionedObject>(objects: T[], queue: SyncMutation[]) {
  const byId = new Map(objects.map((object) => [object.id, object]));
  pending(queue, "object").forEach((mutation) => {
    if (mutation.operation === "delete") {
      byId.delete(mutation.entityId);
      return;
    }
    const current = byId.get(mutation.entityId);
    byId.set(mutation.entityId, {
      ...(current ?? { id: mutation.entityId, media: { documents: 0, floorPlans: 0, images: 0, items: [] } }),
      ...mutation.payload,
      id: mutation.entityId,
      revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
      updatedAt: mutation.updatedAt,
    } as T);
  });
  pending(queue, "object_media").forEach((mutation) => {
    const object = byId.get(mutation.resourceId);
    if (!object) return;
    const items = new Map(object.media.items.map((item) => [item.id, item]));
    if (mutation.operation === "delete") items.delete(mutation.entityId);
    else items.set(mutation.entityId, {
      ...(items.get(mutation.entityId) ?? { id: mutation.entityId }),
      ...mutation.payload,
      id: mutation.entityId,
      revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
      updatedAt: mutation.updatedAt,
    });
    const values = Array.from(items.values());
    byId.set(object.id, {
      ...object,
      media: {
        documents: values.filter((item) => item.type === "Dokument").length,
        floorPlans: values.filter((item) => item.type === "Grundriss").length,
        images: values.filter((item) => item.type === "Bild").length,
        items: values,
      },
    });
  });
  return Array.from(byId.values());
}
