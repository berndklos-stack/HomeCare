-- Wave 5 hotfix: pgcrypto is installed in the extensions schema on Supabase.
begin;

create or replace function public.homecare_create_relational_backup(p_tenant_id uuid,p_reason text default 'manual') returns jsonb
language plpgsql security definer set search_path=public as $$
declare table_name text; table_payload jsonb; payload jsonb:='{}'::jsonb; manifest jsonb:='{}'::jsonb; backup_row public.homecare_relational_backups%rowtype;
begin
  if auth.role()='authenticated' and (public.homecare_request_tenant() is distinct from p_tenant_id or not public.homecare_has_permission(p_tenant_id,'backups.manage')) then raise exception 'WORKCORE_BACKUP_PERMISSION_DENIED' using errcode='42501'; end if;
  foreach table_name in array public.homecare_relational_backup_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb) from public.%I row where tenant_id=$1',table_name) into table_payload using p_tenant_id;
    payload:=payload||jsonb_build_object(table_name,table_payload);
    manifest:=manifest||jsonb_build_object(table_name,jsonb_build_object('count',jsonb_array_length(table_payload)));
  end loop;
  insert into public.homecare_relational_backups(tenant_id,format_version,reason,payload,manifest,checksum,created_by)
  values(p_tenant_id,1,coalesce(nullif(trim(p_reason),''),'manual'),payload,manifest,encode(extensions.digest(payload::text,'sha256'),'hex'),auth.uid())
  returning * into backup_row;
  return to_jsonb(backup_row)-'payload';
end $$;
revoke all on function public.homecare_create_relational_backup(uuid,text) from public,anon;
grant execute on function public.homecare_create_relational_backup(uuid,text) to authenticated,service_role;

commit;
