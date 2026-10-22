"use client";
import { useEffect, useState } from "react";
import { MessageSquare, Settings } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { AuthContextPayload } from "@/lib/authModel";

export function AdministrationLinks({ section = "" }: { section?: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/auth/context").then(async response => {
      if (!response.ok) return;
      const context = await response.json() as AuthContextPayload;
      if (!cancelled) setAllowed(context.platformAdmin === true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <div className="administration-links">
    {allowed && <a href="/administration"><Settings size={17} />Administration</a>}
    <a href={`/feedback?from=${encodeURIComponent(section)}`}><MessageSquare size={17} />Feedback senden</a>
  </div>;
}
