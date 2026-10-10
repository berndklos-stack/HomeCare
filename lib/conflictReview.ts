import type { SyncMutation } from "./syncQueue";

export type ConflictReview = { id: string; redundant: boolean; reason: string; approvedResolution?: boolean };

export function reviewApprovedResolution(mutation: SyncMutation, journal: Record<string, unknown> | null, tenantId: string): ConflictReview | null {
  if (!journal || journal.tenant_id !== tenantId || journal.mutation_id !== mutation.id
    || journal.entity_type !== mutation.entityType || journal.entity_id !== mutation.entityId
    || journal.operation !== mutation.operation || !sameValue(journal.request_payload, mutation.payload)) return null;
  const response = journal.response_payload as Record<string, unknown> | null;
  const resolution = response?.resolution as Record<string, unknown> | undefined;
  if (!resolution || resolution.kind !== "user_approved_merge" || resolution.resourceId !== mutation.resourceId
    || typeof resolution.backupId !== "string" || !/^[a-f0-9-]{36}$/i.test(resolution.backupId)
    || typeof resolution.approvedAt !== "string" || !Number.isFinite(Date.parse(resolution.approvedAt))) return null;
  return { id: mutation.id, redundant: true, approvedResolution: true, reason: "Lokaler und Serverstand wurden mit deiner Zustimmung gesichert und zusammengefuehrt." };
}

const progressColumns: Record<string, string> = {
  taskId: "task_id", workDate: "work_date", completed: "completed", minutes: "minutes",
  showWorkTimeInReport: "show_work_time_in_report", note: "note", photos: "photos",
};

export function reviewProgressConflict(mutation: SyncMutation, row: Record<string, unknown> | null, tenantId: string): ConflictReview {
  const result = (redundant: boolean, reason: string) => ({ id: mutation.id, redundant, reason });
  if (mutation.entityType !== "field_progress" || mutation.status !== "conflict"
    || !row || row.tenant_id !== tenantId || row.id !== mutation.entityId || row.job_id !== mutation.resourceId) {
    return result(false, "Kein eindeutig zugeordneter Fortschritt. Lokale Aenderung bleibt erhalten.");
  }
  if (mutation.operation === "delete" && row.deleted_at) return result(true, "Fortschritt ist bereits geloescht.");
  if (!["create", "update"].includes(mutation.operation) || row.deleted_at || typeof row.revision !== "number") {
    return result(false, "Manuelle Pruefung erforderlich.");
  }
  const entries = Object.entries(mutation.payload);
  if (!entries.length || !entries.every(([key, value]) => {
    const column = progressColumns[key];
    if (!column || !Object.hasOwn(row, column)) return false;
    if (key === "minutes") {
      if (value === "" || value == null) return row[column] == null;
      const minutes = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
      return typeof minutes === "number" && Number.isSafeInteger(minutes) && minutes === row[column];
    }
    if (key === "note" || key === "workDate") return (value ?? "") === (row[column] ?? "");
    return sameValue(value, row[column]);
  })) return result(false, "Zeiten, Text oder Fotos weichen vom Serverstand ab. Lokale Aenderung bleibt erhalten.");
  return result(true, "Alle lokalen Fortschrittswerte sind bereits auf dem Server gespeichert.");
}

// Progress edits are absolute snapshots. An explicitly later local snapshot
// may supersede older ones only if it covers their fields and is server-proven.
export function reviewConflictSequence(snapshot: SyncMutation[], current: SyncMutation[], reviews: ConflictReview[]): ConflictReview[] {
  return snapshot.map((mutation) => {
    const group = snapshot.filter((item) => item.entityType === mutation.entityType && item.entityId === mutation.entityId);
    const own = reviews.find((review) => review.id === mutation.id);
    if (own?.approvedResolution && own.redundant && current.find((item) => item.id === mutation.id) === mutation) return own;
    const unchanged = group.every((item) => current.find((candidate) => candidate.id === item.id) === item);
    const dependent = current.some((item) => item.entityType === mutation.entityType && item.entityId === mutation.entityId
      && item.status !== "synced" && !group.some((candidate) => candidate.id === item.id));
    if (!unchanged || dependent) return { id: mutation.id, redundant: false, reason: "Weitere oder inzwischen geaenderte lokale Mutation. Manuell pruefen." };
    if (group.length === 1) return own ?? { id: mutation.id, redundant: false, reason: "Serververgleich unvollstaendig." };
    const latest = group.at(-1)!;
    if (mutation.entityType === "field_progress" && group.every((item) => ["create", "update"].includes(item.operation)
      && item.resourceId === latest.resourceId && Object.keys(item.payload).every((key) => Object.hasOwn(latest.payload, key)))
      && reviews.find((review) => review.id === latest.id)?.redundant) {
      return { id: mutation.id, redundant: true, reason: "Der letzte lokale Fortschrittsstand ist vollstaendig auf dem Server gespeichert." };
    }
    return { id: mutation.id, redundant: false, reason: "Mehrere lokale Aenderungen. Letzten Stand gemeinsam pruefen." };
  });
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a);
  return left.length === Object.keys(b).length && left.every(([key, value]) =>
    Object.hasOwn(b, key) && sameValue(value, (b as Record<string, unknown>)[key]));
}

// Deliberately fail closed: missing rows, different values and unsupported
// domains are not evidence that a local change can be discarded.
export function reviewMediaConflict(mutation: SyncMutation, row: Record<string, unknown> | null, tenantId: string): ConflictReview {
  const result = (redundant: boolean, reason: string) => ({ id: mutation.id, redundant, reason });
  const ownerType = mutation.entityType === "report_media" ? "report"
    : mutation.entityType === "communication_media" ? "portal_message" : null;
  if (!ownerType || mutation.status !== "conflict") return result(false, "Manuelle Pruefung erforderlich.");
  if (!row || row.tenant_id !== tenantId || row.id !== mutation.entityId || row.owner_type !== ownerType || row.owner_id !== mutation.resourceId) {
    return result(false, "Kein eindeutig zugeordneter Serverdatensatz. Lokale Aenderung bleibt erhalten.");
  }
  if (mutation.operation === "delete" && row.deleted_at) return result(true, "Serverdatensatz ist bereits geloescht.");
  if (mutation.operation !== "update" || row.deleted_at || typeof row.revision !== "number") return result(false, "Manuelle Pruefung erforderlich.");
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return result(false, "Serververgleich unvollstaendig.");
  const payload = mutation.payload;
  if (["name", "storagePath", "storageUrl", "previewUrl"].some((key) =>
    Object.hasOwn(payload, key) && payload[key] !== null && typeof payload[key] !== "string")) {
    return result(false, "Medienwerte haben ein unerwartetes Format.");
  }
  if (!Object.keys(payload).length || !Object.entries(payload).every(([key, value]) =>
    Object.hasOwn(metadata, key) && sameValue(value, (metadata as Record<string, unknown>)[key]))) {
    return result(false, "Lokale Werte weichen ab oder sind nicht bestaetigt.");
  }
  // Metadata alone is insufficient: check columns changed by the update RPC.
  if ((payload.name && payload.name !== row.name)
    || (Object.hasOwn(payload, "storagePath") && (payload.storagePath || null) !== row.storage_path)
    || (Object.hasOwn(payload, "storageUrl") && (payload.storageUrl || null) !== row.preview_url)
    || (!Object.hasOwn(payload, "storageUrl") && Object.hasOwn(payload, "previewUrl") && (payload.previewUrl || null) !== row.preview_url)) {
    return result(false, "Relationale Medienwerte weichen ab.");
  }
  return result(true, "Alle lokalen Werte sind bereits im Serverstand enthalten.");
}
