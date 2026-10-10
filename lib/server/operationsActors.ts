import type { SupabaseClient } from "@supabase/supabase-js";

export async function attachOperationsActors(client: SupabaseClient, tenantId: string, rows: Record<string, unknown>[]) {
  const ids = [...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  if (!ids.length) return;
  // Only resolve actors already present in the authenticated tenant's read page.
  const { data, error } = await client.from("homecare_user_profiles")
    .select("id,display_name,email").eq("tenant_id", tenantId).in("id", ids);
  if (error) throw error;
  const names = new Map((data ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email?.trim() || null]));
  for (const row of rows) row.actor_name = names.get(row.actor_user_id) ?? null;
}
