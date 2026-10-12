type MediaReference = { owner_type: string; deleted_at: string | null };

export function hasReadablePrivateMediaReference(rows: MediaReference[] | null) {
  if (!rows?.length) return false;
  const attached = rows.filter((row) => row.owner_type !== "pending");
  // Pending upload metadata must not resurrect a tombstoned attachment.
  return (attached.length ? attached : rows).some((row) => !row.deleted_at);
}

export function legacyObjectMediaOwners(rows: Array<MediaReference & {
  owner_id: string; storage_path: string | null; preview_url: string | null;
}>, path: string) {
  if (!path.startsWith("migrated-app-state/") || path.includes("..")) return [];
  const reference = `/api/private-media?path=${encodeURIComponent(path)}`;
  return [...new Set(rows.filter((row) => row.owner_type === "object" && !row.deleted_at
    && !row.storage_path && row.preview_url === reference).map((row) => row.owner_id))];
}
