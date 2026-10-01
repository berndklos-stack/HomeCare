"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export function useAuthenticatedMedia(source: string) {
  const [resolved, setResolved] = useState<{ source: string; url: string; failed: boolean } | null>(null);
  const requiresAuth = /^\/api\/(?:private-media|media)\?/.test(source);

  useEffect(() => {
    if (!requiresAuth) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await apiFetch(source, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Media HTTP ${response.status}`);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved({ source, url: objectUrl, failed: false });
      } catch {
        if (!controller.signal.aborted) setResolved({ source, url: "", failed: true });
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requiresAuth, source]);

  if (!requiresAuth) return { url: source, failed: false, loading: false };
  const current = resolved?.source === source ? resolved : null;
  return { url: current?.url ?? "", failed: current?.failed ?? false, loading: current === null };
}
