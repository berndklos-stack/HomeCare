"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Settings } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { AuthContextPayload } from "@/lib/authModel";

export function AdministrationLinks({ section = "", active, onNavigate }: { section?: string; active?: string; onNavigate?: (href: string) => void }) {
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
    {allowed && <Link href="/administration" prefetch={false} aria-current={active === "administration" ? "page" : undefined} onClick={event => { if (onNavigate && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate("/administration"); } }}><Settings size={17} />Administration</Link>}
    <Link href={`/feedback?from=${encodeURIComponent(section)}`} prefetch={false} aria-current={active === "feedback" ? "page" : undefined} onClick={event => { if (onNavigate && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(`/feedback?from=${encodeURIComponent(section)}`); } }}><MessageSquare size={17} />Feedback senden</Link>
  </div>;
}
