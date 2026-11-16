"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { CustomerFile } from "@/lib/customerFiles";
import { CustomerFileOverview } from "./CustomerFileOverview";

export function CustomerFilesPanel({ customerId, name, language = "de", portalPreview = false }: { customerId: string; name: string; language?: "de" | "sv" | "en"; portalPreview?: boolean }) {
  const [state, setState] = useState<{ customerId: string; files?: CustomerFile[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`/api/customer-files?customerId=${encodeURIComponent(customerId)}${portalPreview ? "&view=portal" : ""}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Dateien konnten nicht geladen werden.");
      if (!controller.signal.aborted) setState({ customerId, files: data.files });
    }).catch(error => { if (!controller.signal.aborted) setState({ customerId, error: error instanceof Error ? error.message : "Dateien konnten nicht geladen werden." }); });
    return () => controller.abort();
  }, [customerId, retry, portalPreview]);
  const current = state?.customerId === customerId ? state : null;
  if (current?.error) return <div><p role="alert">{current.error}</p><button type="button" className="ghost-button" onClick={() => setRetry(value => value + 1)}>{language === "sv" ? "Försök igen" : language === "en" ? "Try again" : "Erneut versuchen"}</button></div>;
  if (!current?.files) return <p role="status">{language === "sv" ? "Filer kontrolleras ..." : language === "en" ? "Checking files ..." : "Dateien werden auf Verfügbarkeit und Duplikate geprüft ..."}</p>;
  return <CustomerFileOverview files={current.files} name={name} language={language} />;
}
