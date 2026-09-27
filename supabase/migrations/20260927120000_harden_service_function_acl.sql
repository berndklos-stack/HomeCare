-- Supabase may grant EXECUTE on newly created functions explicitly to API
-- roles through default privileges. Revoking only from PUBLIC is therefore not
-- sufficient for SECURITY DEFINER functions that are service-only.

revoke all on function public.homecare_resources_snapshot()
  from public, anon, authenticated;
revoke all on function public.homecare_save_resources_snapshot(jsonb)
  from public, anon, authenticated;
revoke all on function public.homecare_apply_sync_mutation(
  uuid, text, text, text, text, uuid, jsonb, bigint
) from public, anon, authenticated;
revoke all on function public.homecare_grant_portal_access(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.homecare_resources_snapshot()
  to service_role;
grant execute on function public.homecare_save_resources_snapshot(jsonb)
  to service_role;
grant execute on function public.homecare_apply_sync_mutation(
  uuid, text, text, text, text, uuid, jsonb, bigint
) to service_role;
grant execute on function public.homecare_grant_portal_access(uuid, text, text)
  to service_role;
