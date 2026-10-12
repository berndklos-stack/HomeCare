export function legacyObjectMediaPath(previewUrl: string | null, supabaseUrl?: string) {
  if (!previewUrl) return null;
  try {
    let path: string | null = null;
    if (previewUrl.startsWith("/api/private-media?")) {
      path = new URL(previewUrl, "https://workcore.local").searchParams.get("path");
    } else if (supabaseUrl) {
      const url = new URL(previewUrl);
      const origin = new URL(supabaseUrl);
      const prefix = "/storage/v1/object/sign/homecare-private-media/";
      if (url.origin !== origin.origin || url.username || url.password || !url.pathname.startsWith(prefix)) return null;
      path = decodeURIComponent(url.pathname.slice(prefix.length));
    }
    return path?.startsWith("migrated-app-state/") && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

export function legacyObjectMediaReferencePath(row: { preview_url: string | null; metadata?: unknown }, supabaseUrl?: string) {
  const path = legacyObjectMediaPath(row.preview_url, supabaseUrl);
  if (!path || row.preview_url?.startsWith("/api/private-media?")) return path;
  // Refresh a persisted signed URL only if the original migration reference agrees.
  const original = row.metadata && typeof row.metadata === "object" && "previewUrl" in row.metadata
    ? row.metadata.previewUrl : null;
  return legacyObjectMediaPath(typeof original === "string" ? original : null) === path ? path : null;
}
