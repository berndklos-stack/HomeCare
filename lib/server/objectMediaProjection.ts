export const objectMediaSignedUrlTtlSeconds = 15 * 60;

export type ObjectMediaProjectionRow = {
  deleted_at: string | null;
  preview_url: string | null;
  storage_path: string | null;
};

function safeFallbackPreview(previewUrl: string | null) {
  if (!previewUrl) return null;
  return /^(data:image\/|https?:\/\/)/i.test(previewUrl) ? previewUrl : null;
}

function safeInlinePreview(previewUrl: string | null) {
  return previewUrl?.startsWith("data:image/") ? previewUrl : null;
}

function legacyPrivateMediaPath(previewUrl: string | null) {
  if (!previewUrl?.startsWith("/api/private-media?")) return null;
  try {
    const path = new URL(previewUrl, "https://workcore.local").searchParams.get("path");
    return path?.startsWith("migrated-app-state/") && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

export function objectMediaStoragePath(row: ObjectMediaProjectionRow, tenantId: string) {
  if (row.storage_path?.startsWith(`${tenantId}/`) && !row.storage_path.includes("..")) {
    return row.storage_path;
  }
  return row.storage_path ? null : legacyPrivateMediaPath(row.preview_url);
}

export function objectMediaPathsToSign<T extends ObjectMediaProjectionRow>(rows: T[], tenantId: string) {
  return Array.from(new Set(rows.flatMap((row) => (
    !row.deleted_at && objectMediaStoragePath(row, tenantId)
      ? [objectMediaStoragePath(row, tenantId) as string]
      : []
  ))));
}

export function applyObjectMediaSignedUrls<T extends ObjectMediaProjectionRow>(
  rows: T[],
  tenantId: string,
  signedUrls: ReadonlyMap<string, string>,
) {
  return rows
    .filter((row) => !row.deleted_at)
    .map((row) => {
      const storagePath = objectMediaStoragePath(row, tenantId);
      if (!row.storage_path && !storagePath) {
        return { ...row, preview_url: safeFallbackPreview(row.preview_url) };
      }
      if (!storagePath) {
        return { ...row, preview_url: safeInlinePreview(row.preview_url), storage_path: null };
      }
      return {
        ...row,
        preview_url: signedUrls.get(storagePath) ?? safeInlinePreview(row.preview_url),
      };
    });
}
