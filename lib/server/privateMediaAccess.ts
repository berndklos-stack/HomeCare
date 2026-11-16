import { legacyObjectMediaReferencePath } from "@/lib/server/legacyObjectMediaPath";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function removeUnreferencedPrivateMedia(client: SupabaseClient, tenantId: string, storagePath: string) {
  if (!storagePath.startsWith(`${tenantId}/`) || storagePath.includes("..")) throw new Error("Dateipfad gehört nicht zum Mandanten.");
  const references = await client.from("homecare_media").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("storage_path", storagePath).is("deleted_at", null);
  if (references.error || references.count === null) throw new Error("Dateiverweise konnten nicht geprüft werden.");
  if (references.count > 0) return;
  const removed = await client.storage.from("homecare-private-media").remove([storagePath]);
  if (removed.error) throw new Error("Private Datei konnte nicht gelöscht werden.");
}

type MediaReference = { owner_type: string; deleted_at: string | null };

export function hasReadablePrivateMediaReference(rows: MediaReference[] | null) {
  if (!rows?.length) return false;
  const attached = rows.filter((row) => row.owner_type !== "pending");
  // Pending upload metadata must not resurrect a tombstoned attachment.
  return (attached.length ? attached : rows).some((row) => !row.deleted_at);
}

export function legacyObjectMediaOwners(rows: Array<MediaReference & {
  owner_id: string; storage_path: string | null; preview_url: string | null;
  metadata?: unknown;
}>, path: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!path.startsWith("migrated-app-state/") || path.includes("..")) return [];
  return [...new Set(rows.filter((row) => row.owner_type === "object" && !row.deleted_at
    && !row.storage_path && legacyObjectMediaReferencePath(row, supabaseUrl) === path).map((row) => row.owner_id))];
}
