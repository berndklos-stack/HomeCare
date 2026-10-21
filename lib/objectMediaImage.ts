export type ObjectImageReference = { previewUrl?: string; storagePath?: string };

export function objectImageSources(item: ObjectImageReference) {
  const path = item.storagePath?.trim() ?? "";
  const stored = !path || path.includes("..") ? "" : /^(data:|https?:|blob:|\/)/i.test(path) ? path
    : `/api/${path.startsWith("migrated-app-state/") ? "private-media" : "media"}?path=${encodeURIComponent(path)}`;
  return [item.previewUrl || "", stored].filter((source, index, all) => source && all.indexOf(source) === index);
}
