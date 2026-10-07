type MediaReference = { owner_type: string; deleted_at: string | null };

export function hasReadablePrivateMediaReference(rows: MediaReference[] | null) {
  if (!rows?.length) return false;
  const attached = rows.filter((row) => row.owner_type !== "pending");
  // Pending upload metadata must not resurrect a tombstoned attachment.
  return (attached.length ? attached : rows).some((row) => !row.deleted_at);
}
