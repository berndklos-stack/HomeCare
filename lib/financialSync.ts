import { createSyncMutation, type SyncMutation } from "./syncQueue";

export type RevisionedInvoiceLine = Record<string, unknown> & { id: string; revision?: number };
export type RevisionedInvoice = Record<string, unknown> & {
  id: string;
  lines?: RevisionedInvoiceLine[];
  revision?: number;
  paymentRevision?: number;
  exportRevision?: number;
  updatedAt?: string;
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => !["revision", "paymentRevision", "exportRevision", "updatedAt"].includes(key) && item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
}
function same(a: unknown, b: unknown) { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }

function invoicePayload(invoice: RevisionedInvoice) {
  return Object.fromEntries(Object.entries(invoice).filter(([key]) => ![
    "lines", "revision", "paymentRevision", "exportRevision", "updatedAt",
    "paidAt", "externalExportStatus", "externalExportSystem", "externalExportedAt",
  ].includes(key)));
}

export function prepareFinancialMutations(previous: RevisionedInvoice[], next: RevisionedInvoice[], now = new Date().toISOString()) {
  const mutations: SyncMutation[] = [];
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  const invoices = next.map((invoice) => {
    const old = oldById.get(invoice.id);
    const coreChanged = !old || !same(invoicePayload(old), invoicePayload(invoice));
    if (coreChanged) mutations.push(createSyncMutation({ entityId: invoice.id, entityType: "invoice", expectedRevision: old?.revision, operation: old ? "update" : "create", payload: invoicePayload(invoice), resourceId: invoice.id }, now));
    const oldLines = new Map((old?.lines ?? []).map((line) => [line.id, line]));
    const nextLines = new Map((invoice.lines ?? []).map((line) => [line.id, line]));
    const optimisticLines = (invoice.lines ?? []).map((line) => {
      const prior = oldLines.get(line.id);
      const changed = !prior || !same(prior, line);
      if (changed) mutations.push(createSyncMutation({ entityId: line.id, entityType: "invoice_line", expectedRevision: prior?.revision, operation: prior ? "update" : "create", payload: line, resourceId: invoice.id }, now));
      return { ...line, revision: changed ? (prior?.revision ?? 0) + 1 : line.revision };
    });
    oldLines.forEach((line, id) => { if (!nextLines.has(id)) mutations.push(createSyncMutation({ entityId: id, entityType: "invoice_line", expectedRevision: line.revision ?? 1, operation: "delete", resourceId: invoice.id }, now)); });
    if (!old?.paidAt && invoice.paidAt) mutations.push(createSyncMutation({ entityId: `PAY-${invoice.id}`, entityType: "payment", operation: "create", payload: { amount: invoice.amount, paidAt: invoice.paidAt }, resourceId: invoice.id }, now));
    if (old && (old.externalExportStatus !== invoice.externalExportStatus || old.externalExportedAt !== invoice.externalExportedAt)) {
      mutations.push(createSyncMutation({ entityId: `EXP-${invoice.id}-${now}`, entityType: "accounting_export", operation: "create", payload: { exportedAt: invoice.externalExportedAt ?? now, status: invoice.externalExportStatus ?? "nicht gesendet", system: invoice.externalExportSystem ?? "Spiris / Visma Buchhaltung" }, resourceId: invoice.id }, now));
    }
    return { ...invoice, lines: optimisticLines, revision: coreChanged ? (old?.revision ?? 0) + 1 : invoice.revision, updatedAt: coreChanged ? now : invoice.updatedAt };
  });
  previous.forEach((invoice) => { if (!nextById.has(invoice.id)) mutations.push(createSyncMutation({ entityId: invoice.id, entityType: "invoice", expectedRevision: invoice.revision ?? 1, operation: "delete", resourceId: invoice.id }, now)); });
  return { invoices, mutations };
}

export function overlayPendingFinancialMutations<T extends RevisionedInvoice>(invoices: T[], queue: SyncMutation[]) {
  const map = new Map(invoices.map((item) => [item.id, item]));
  queue.filter((item) => !["synced", "conflict"].includes(item.status)).forEach((mutation) => {
    if (mutation.entityType !== "invoice") return;
    if (mutation.operation === "delete") map.delete(mutation.entityId);
    else map.set(mutation.entityId, { ...(map.get(mutation.entityId) ?? { id: mutation.entityId }), ...mutation.payload, revision: (mutation.expectedRevision ?? 0) + 1, updatedAt: mutation.updatedAt } as T);
  });
  return Array.from(map.values());
}
