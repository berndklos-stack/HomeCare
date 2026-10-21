"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiClient";
import { objectImageSources, type ObjectImageReference } from "./objectMediaImage";

export function useObjectMediaImage(item: ObjectImageReference) {
  const key = JSON.stringify(objectImageSources(item));
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const urls = new Set<string>();
    void (async () => {
      for (const source of JSON.parse(key) as string[]) {
        try {
          let url = source;
          if (/^\/api\/(?:private-media|media)\?/.test(source)) {
            const response = await apiFetch(source, { signal: controller.signal, cache: "no-store" });
            if (!response.ok) throw new Error("Image unavailable");
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            url = URL.createObjectURL(blob); urls.add(url);
          }
          // onload works in Safari even where decode() rejects otherwise readable images.
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            const finish = (ok: boolean) => {
              image.onload = null; image.onerror = null;
              controller.signal.removeEventListener("abort", abort);
              if (ok) resolve(); else reject(new Error("Image unreadable"));
            };
            const abort = () => { finish(false); image.src = ""; };
            image.onload = () => finish(true); image.onerror = () => finish(false);
            controller.signal.addEventListener("abort", abort, { once: true });
            if (controller.signal.aborted) abort(); else image.src = url;
          });
          if (!controller.signal.aborted) setResolved({ key, url });
          return;
        } catch { if (controller.signal.aborted) return; }
      }
      setResolved({ key, url: "" });
    })();
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [key]);
  const current = resolved?.key === key ? resolved : null;
  return { url: current?.url ?? "", loading: current === null && key !== "[]" };
}
