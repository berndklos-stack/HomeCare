"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { CustomerFile } from "@/lib/customerFiles";
import { CustomerFileOverview } from "./CustomerFileOverview";

export function PortalFileOverview({ name }: { name: string }) {
  const [files, setFiles] = useState<CustomerFile[] | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/portal/files", { signal: controller.signal, cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error || "Dateien konnten nicht geladen werden.");
      setFiles(payload.files);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Dateien konnten nicht geladen werden."); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!files) return <p role="status">Dateien werden geladen …</p>;
  return <CustomerFileOverview files={files} name={name} />;
}
