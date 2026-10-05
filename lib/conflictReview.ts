import type { SyncMutation } from "./syncQueue";

export type ConflictReview = { id: string; redundant: boolean; reason: string };

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
