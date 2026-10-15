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
      const membership = context.memberships.find(m => m.tenantId === context.activeTenantId);
      if (!cancelled) setAllowed(Boolean(membership?.permissions.some(p => ["tenant.admin", "members.manage", "roles.manage"].includes(p))));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <div className="administration-links">
    {allowed && <a href="/administration"><Settings size={17} />Administration</a>}
    <a href={`/feedback?from=${encodeURIComponent(section)}`}><MessageSquare size={17} />Feedback senden</a>
  </div>;
}
