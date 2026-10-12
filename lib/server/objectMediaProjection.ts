import { legacyObjectMediaReferencePath } from "@/lib/server/legacyObjectMediaPath";

export const objectMediaSignedUrlTtlSeconds = 15 * 60;
export const objectMediaReadColumns = "id, owner_id, kind, name, description, source, storage_path, preview_url, metadata, is_primary, revision, deleted_at, updated_at";

export type ObjectMediaProjectionRow = {
  deleted_at: string | null;
  preview_url: string | null;
  storage_path: string | null;
  metadata?: unknown;
};

function safeFallbackPreview(previewUrl: string | null) {
  if (!previewUrl) return null;
  return /^(data:image\/|https?:\/\/)/i.test(previewUrl) ? previewUrl : null;
}

function safeInlinePreview(previewUrl: string | null) {
  return previewUrl?.startsWith("data:image/") ? previewUrl : null;
}

export function objectMediaStoragePath(row: ObjectMediaProjectionRow, tenantId: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (row.storage_path?.startsWith(`${tenantId}/`) && !row.storage_path.includes("..")) {
    return row.storage_path;
  }
  return row.storage_path ? null : legacyObjectMediaReferencePath(row, supabaseUrl);
}

export function objectMediaPathsToSign<T extends ObjectMediaProjectionRow>(rows: T[], tenantId: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  return Array.from(new Set(rows.flatMap((row) => (
    !row.deleted_at && objectMediaStoragePath(row, tenantId, supabaseUrl)
      ? [objectMediaStoragePath(row, tenantId, supabaseUrl) as string]
      : []
  ))));
}

export function applyObjectMediaSignedUrls<T extends ObjectMediaProjectionRow>(
  rows: T[],
  tenantId: string,
  signedUrls: ReadonlyMap<string, string>,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
) {
  return rows
    .filter((row) => !row.deleted_at)
    .map((row) => {
      const storagePath = objectMediaStoragePath(row, tenantId, supabaseUrl);
      if (!row.storage_path && !storagePath) {
        return { ...row, preview_url: safeFallbackPreview(row.preview_url) };
      }
      if (!storagePath) {
        return { ...row, preview_url: safeInlinePreview(row.preview_url), storage_path: null };
      }
      return {
        ...row,
        storage_path: storagePath,
        preview_url: signedUrls.get(storagePath) ?? safeInlinePreview(row.preview_url),
      };
    });
}
