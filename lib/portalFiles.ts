export function readablePortalFile(file: { owner_id: string; storage_path: string | null }, reportIds: ReadonlySet<string>, tenantId: string) {
  return reportIds.has(file.owner_id) && Boolean(file.storage_path?.startsWith(`${tenantId}/`)) && !file.storage_path?.includes("..");
}
