"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const activeTenantStorageKey = "workcore-active-tenant-id";

export function getActiveTenantId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(activeTenantStorageKey) ?? "";
}

export function tenantScopedStorageKey(key: string) {
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") return key;
  const tenantId = getActiveTenantId();
  return tenantId ? `${key}:${tenantId}` : key;
}

export async function apiRequestHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
  const client = getSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const tenantId = getActiveTenantId();
  if (tenantId) headers.set("X-WorkCore-Tenant", tenantId);
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") headers.set("X-WorkCore-E2E-Bypass", "1");
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = await apiRequestHeaders(init.headers);
  return fetch(input, { ...init, headers });
}
