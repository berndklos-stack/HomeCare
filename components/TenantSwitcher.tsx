"use client";

import { useEffect, useState } from "react";
import type { AuthContextPayload, TenantMembership } from "@/lib/authModel";
import { activeTenantStorageKey, apiFetch } from "@/lib/apiClient";

export function TenantSwitcher() {
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") return;
    void apiFetch("/api/auth/context").then(async (response) => {
      if (!response.ok) return;
      const context = await response.json() as AuthContextPayload;
      setMemberships(context.memberships);
      setTenantId(window.localStorage.getItem(activeTenantStorageKey) ?? context.memberships[0]?.tenantId ?? "");
    });
  }, []);

  if (memberships.length < 2) return null;
  return (
    <label className="select-field tenant-switcher">
      <span className="sr-only">Firma</span>
      <select value={tenantId} onChange={(event) => {
        window.localStorage.setItem(activeTenantStorageKey, event.target.value);
        window.location.reload();
      }}>
        {memberships.map((membership) => <option key={membership.tenantId} value={membership.tenantId}>{membership.tenantName}</option>)}
      </select>
    </label>
  );
}
