import type { SyncMutation } from "@/lib/syncQueue";

export type RevisionedSetting = Record<string, unknown> & {
  deletedAt?: string;
  revision?: number;
  updatedAt?: string;
};

export type RevisionedTranslation = RevisionedSetting & {
  de: string;
  en: string;
  key: string;
  sv: string;
};

const transientFields = new Set(["deletedAt", "revision", "updatedAt"]);

export function settingPayload(value: RevisionedSetting) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !transientFields.has(key)));
}

export function prepareSettingMutation(
  entityType: "setting" | "tenant_settings",
  entityId: string,
  current: RevisionedSetting | undefined,
  next: RevisionedSetting,
) {
  const expectedRevision = current?.revision;
  const operation = expectedRevision === undefined && entityType === "setting" ? "create" as const : "update" as const;
  const revision = expectedRevision === undefined ? 1 : expectedRevision + 1;
  const updatedAt = new Date().toISOString();
  return {
    mutation: {
      entityId,
      entityType,
      expectedRevision,
      operation,
      payload: entityType === "setting" ? { value: settingPayload(next) } : settingPayload(next),
      resourceId: entityId,
    },
    value: { ...next, revision, updatedAt },
  };
}

function translationFingerprint(value: RevisionedTranslation) {
  return JSON.stringify({ de: value.de, en: value.en, key: value.key, sv: value.sv });
}

export function prepareTranslationMutations(
  currentRows: RevisionedTranslation[],
  nextRows: RevisionedTranslation[],
) {
  const now = new Date().toISOString();
  const currentByKey = new Map(currentRows.map((row) => [row.key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.key));
  const mutations: Array<{
    entityId: string;
    entityType: "translation";
    expectedRevision?: number;
    operation: "create" | "update" | "delete";
    payload: Record<string, unknown>;
    resourceId: string;
  }> = [];

  const rows = nextRows.map((row) => {
    const current = currentByKey.get(row.key);
    if (!current) {
      mutations.push({ entityId: row.key, entityType: "translation", operation: "create", payload: settingPayload(row), resourceId: row.key });
      return { ...row, revision: 1, updatedAt: now };
    }
    if (translationFingerprint(current) === translationFingerprint(row)) return { ...row, revision: current.revision, updatedAt: current.updatedAt };
    const expectedRevision = current.revision ?? 1;
    mutations.push({ entityId: row.key, entityType: "translation", expectedRevision, operation: "update", payload: settingPayload(row), resourceId: row.key });
    return { ...row, revision: expectedRevision + 1, updatedAt: now };
  });

  currentRows.forEach((row) => {
    if (!nextKeys.has(row.key)) {
      mutations.push({ entityId: row.key, entityType: "translation", expectedRevision: row.revision ?? 1, operation: "delete", payload: {}, resourceId: row.key });
    }
  });
  return { mutations, rows };
}

function pending(queue: SyncMutation[], entityType: SyncMutation["entityType"]) {
  return queue.filter((mutation) => mutation.entityType === entityType && mutation.status !== "synced" && mutation.status !== "conflict");
}

export function overlayPendingSetting<T extends RevisionedSetting>(
  value: T,
  entityType: "setting" | "tenant_settings",
  entityId: string,
  queue: SyncMutation[],
) {
  return pending(queue, entityType)
    .filter((mutation) => mutation.entityId === entityId)
    .reduce((current, mutation) => {
      if (mutation.operation === "delete") return current;
      const payload = entityType === "setting" && mutation.payload.value && typeof mutation.payload.value === "object"
        ? mutation.payload.value as Record<string, unknown>
        : mutation.payload;
      return {
        ...current,
        ...payload,
        revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
        updatedAt: mutation.updatedAt,
      } as T;
    }, value);
}

export function overlayPendingTranslations<T extends RevisionedTranslation>(rows: T[], queue: SyncMutation[]) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  pending(queue, "translation").forEach((mutation) => {
    if (mutation.operation === "delete") {
      byKey.delete(mutation.entityId);
      return;
    }
    byKey.set(mutation.entityId, {
      ...(byKey.get(mutation.entityId) ?? { key: mutation.entityId }),
      ...mutation.payload,
      key: mutation.entityId,
      revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
      updatedAt: mutation.updatedAt,
    } as T);
  });
  return Array.from(byKey.values());
}
