import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultAppBranding } from "@/lib/branding";

export type CompanyBranding = Record<keyof typeof defaultAppBranding, string>;
export const brandingKeys = Object.keys(defaultAppBranding) as (keyof CompanyBranding)[];

export function readBranding(value: Record<string, unknown>): CompanyBranding {
  return Object.fromEntries(brandingKeys.map(key => [key, typeof value[key] === "string" ? value[key] : ""])) as CompanyBranding;
}

export function validateBranding(input: unknown): CompanyBranding {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Branding-Angaben fehlen.");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !brandingKeys.includes(key as keyof CompanyBranding))
    || brandingKeys.some(key => typeof value[key] !== "string" || (value[key] as string).length > 300)) {
    throw new Error("Bitte Markennamen und Claims prüfen (maximal 300 Zeichen).");
  }
  return Object.fromEntries(brandingKeys.map(key => [key, (value[key] as string).trim()])) as CompanyBranding;
}

export async function loadCompanyBranding(client: SupabaseClient, tenantId: string) {
  return client.from("homecare_settings").select("value,revision").eq("tenant_id", tenantId).eq("key", "companySettings").maybeSingle();
}

export async function saveCompanyBranding(client: SupabaseClient, tenantId: string, revision: number, branding: CompanyBranding) {
  const current = await loadCompanyBranding(client, tenantId);
  if (current.error) return { error: current.error, conflict: false };
  const row = current.data;
  if (!row || row.revision !== revision) return { error: null, conflict: true };
  if (!row.value || typeof row.value !== "object" || Array.isArray(row.value)) throw new Error("Firmenstammdaten müssen zuerst gespeichert werden.");
  // Only replace the five existing branding keys. CAS protects unrelated concurrent edits.
  const result = await client.from("homecare_settings").update({ value: { ...row.value, ...branding } })
    .eq("tenant_id", tenantId).eq("key", "companySettings").eq("revision", revision).select("revision").maybeSingle();
  return { error: result.error, conflict: !result.error && !result.data, revision: result.data?.revision };
}
