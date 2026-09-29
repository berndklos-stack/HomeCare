import { createStableId, createSyncMutation, type SyncMutation } from "./syncQueue";

export type RevisionedAttachment = {
  createdAt?: string;
  dataUrl?: string;
  id: string;
  name: string;
  revision?: number;
  size?: number;
  storagePath?: string;
  storageUrl?: string;
  type?: string;
};

export type RevisionedReport = {
  attachments?: RevisionedAttachment[];
  checklistResults?: Array<Record<string, unknown> & { id: string; photos?: Array<Record<string, unknown> & { id?: string; name?: string; revision?: number }> }>;
  deletedAt?: string;
  id: string;
  revision?: number;
  updatedAt?: string;
  [key: string]: unknown;
};

export type RevisionedReply = Record<string, unknown> & { id: string; revision?: number };
export type RevisionedPortalMessage = Record<string, unknown> & {
  attachments?: RevisionedAttachment[];
  deletedAt?: string;
  id: string;
  replies?: RevisionedReply[];
  revision?: number;
  updatedAt?: string;
};

function normalizedComparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedComparable);
  if (!value || typeof value !== "object") return value;
  const ignored = new Set(["revision", "updatedAt", "deletedAt"]);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !ignored.has(key) && item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, normalizedComparable(item)]));
}

function comparable(value: unknown): string {
  return JSON.stringify(normalizedComparable(value));
}

function mediaId(ownerId: string, kind: string, item: Record<string, unknown>, index: number) {
  const existing = typeof item.id === "string" && item.id ? item.id : "";
  return existing || `${ownerId}:${kind}:${index}`;
}

function reportMedia(report: RevisionedReport) {
  const rows: Array<{ id: string; payload: Record<string, unknown>; revision?: number }> = [];
  (report.attachments ?? []).forEach((attachment, index) => rows.push({
    id: mediaId(report.id, "attachment", attachment, index),
    payload: { ...attachment, mediaRole: "attachment", ownerId: report.id },
    revision: attachment.revision,
  }));
  (report.checklistResults ?? []).forEach((task) => (task.photos ?? []).forEach((photo, index) => rows.push({
    id: mediaId(report.id, `task:${task.id}`, photo, index),
    payload: { ...photo, mediaRole: "checklist_photo", ownerId: report.id, taskId: task.id },
    revision: photo.revision,
  })));
  return rows;
}

function messageMedia(message: RevisionedPortalMessage) {
  return (message.attachments ?? []).map((attachment, index) => ({
    id: mediaId(message.id, "attachment", attachment, index),
    payload: { ...attachment, mediaRole: "attachment", ownerId: message.id },
    revision: attachment.revision,
  }));
}

function parentPayload(record: Record<string, unknown>, childKeys: string[]) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => ![...childKeys, "revision", "deletedAt"].includes(key)));
}

function reportPayload(report: RevisionedReport) {
  const payload = parentPayload(report, ["attachments"]);
  payload.checklistResults = (report.checklistResults ?? []).map((task) => ({ ...task, photos: [] }));
  return payload;
}

function diffChildren(
  previous: Array<{ id: string; payload: Record<string, unknown>; revision?: number }>,
  next: Array<{ id: string; payload: Record<string, unknown>; revision?: number }>,
  entityType: "communication_media" | "portal_message_reply" | "report_media",
  resourceId: string,
  now: string,
) {
  const mutations: SyncMutation[] = [];
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  next.forEach((item) => {
    const old = oldById.get(item.id);
    if (!old || comparable(old.payload) !== comparable(item.payload)) mutations.push(createSyncMutation({
      entityId: item.id, entityType, expectedRevision: old?.revision,
      operation: old ? "update" : "create", payload: item.payload, resourceId,
    }, now));
  });
  previous.forEach((item) => {
    if (!nextById.has(item.id)) mutations.push(createSyncMutation({ entityId: item.id, entityType, expectedRevision: item.revision ?? 1, operation: "delete", resourceId }, now));
  });
  return mutations;
}

export function prepareReportMutations(previous: RevisionedReport[], next: RevisionedReport[], now = new Date().toISOString()) {
  const mutations: SyncMutation[] = [];
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  const reports = next.map((report) => {
    const old = oldById.get(report.id);
    const coreChanged = !old || comparable(reportPayload(old)) !== comparable(reportPayload(report));
    if (coreChanged) mutations.push(createSyncMutation({ entityId: report.id, entityType: "report", expectedRevision: old?.revision, operation: old ? "update" : "create", payload: reportPayload(report), resourceId: report.id }, now));
    mutations.push(...diffChildren(old ? reportMedia(old) : [], reportMedia(report), "report_media", report.id, now));
    return { ...report, revision: coreChanged ? (old?.revision ?? 0) + 1 : report.revision, updatedAt: coreChanged ? now : report.updatedAt };
  });
  previous.forEach((report) => {
    if (!nextById.has(report.id)) mutations.push(createSyncMutation({ entityId: report.id, entityType: "report", expectedRevision: report.revision ?? 1, operation: "delete", resourceId: report.id }, now));
  });
  return { mutations, reports };
}

export function preparePortalMessageMutations(previous: RevisionedPortalMessage[], next: RevisionedPortalMessage[], now = new Date().toISOString()) {
  const mutations: SyncMutation[] = [];
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  const messages = next.map((message) => {
    const old = oldById.get(message.id);
    const coreChanged = !old || comparable(parentPayload(old, ["attachments", "replies"])) !== comparable(parentPayload(message, ["attachments", "replies"]));
    if (coreChanged) mutations.push(createSyncMutation({ entityId: message.id, entityType: "portal_message", expectedRevision: old?.revision, operation: old ? "update" : "create", payload: parentPayload(message, ["attachments", "replies"]), resourceId: message.id }, now));
    const oldReplies = (old?.replies ?? []).map((reply) => ({ id: reply.id, payload: reply, revision: reply.revision }));
    const replies = (message.replies ?? []).map((reply) => ({ id: reply.id, payload: reply, revision: reply.revision }));
    mutations.push(...diffChildren(oldReplies, replies, "portal_message_reply", message.id, now));
    mutations.push(...diffChildren(old ? messageMedia(old) : [], messageMedia(message), "communication_media", message.id, now));
    return { ...message, revision: coreChanged ? (old?.revision ?? 0) + 1 : message.revision, updatedAt: coreChanged ? now : message.updatedAt };
  });
  previous.forEach((message) => {
    if (!nextById.has(message.id)) mutations.push(createSyncMutation({ entityId: message.id, entityType: "portal_message", expectedRevision: message.revision ?? 1, operation: "delete", resourceId: message.id }, now));
  });
  return { messages, mutations };
}

export function overlayPendingReportCommunication<T extends RevisionedReport, M extends RevisionedPortalMessage>(reports: T[], messages: M[], queue: SyncMutation[]) {
  const reportMap = new Map(reports.map((item) => [item.id, item]));
  const messageMap = new Map(messages.map((item) => [item.id, item]));
  queue.filter((item) => !["synced", "conflict"].includes(item.status)).forEach((mutation) => {
    if (mutation.entityType === "report") {
      if (mutation.operation === "delete") reportMap.delete(mutation.entityId);
      else reportMap.set(mutation.entityId, { ...(reportMap.get(mutation.entityId) ?? { id: mutation.entityId }), ...mutation.payload, revision: (mutation.expectedRevision ?? 0) + 1, updatedAt: mutation.updatedAt } as T);
    }
    if (mutation.entityType === "portal_message") {
      if (mutation.operation === "delete") messageMap.delete(mutation.entityId);
      else messageMap.set(mutation.entityId, { ...(messageMap.get(mutation.entityId) ?? { id: mutation.entityId }), ...mutation.payload, revision: (mutation.expectedRevision ?? 0) + 1, updatedAt: mutation.updatedAt } as M);
    }
  });
  return { messages: Array.from(messageMap.values()), reports: Array.from(reportMap.values()) };
}
