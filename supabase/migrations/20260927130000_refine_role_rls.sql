-- Refine operational table policies so scoped field permissions are effective
-- without granting the field-worker role generic tenant-wide write access.

do $$
declare
  table_name text;
  permission_name text;
begin
  for table_name, permission_name in
    select * from (values
      ('homecare_jobs', 'jobs.manage'),
      ('homecare_field_progress', 'jobs.manage'),
      ('homecare_reports', 'jobs.manage'),
      ('homecare_resources', 'resources.manage'),
      ('homecare_vehicle_trips', 'resources.manage'),
      ('homecare_vehicle_positions', 'resources.manage'),
      ('homecare_media', 'media.manage')
    ) as scoped(table_name, permission_name)
  loop
    execute format('drop policy if exists tenant_member_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_member_update on public.%I', table_name);
    execute format('drop policy if exists tenant_member_delete on public.%I', table_name);
    execute format(
      'create policy tenant_member_insert on public.%I for insert to authenticated with check (tenant_id = public.homecare_request_tenant() and (public.homecare_has_permission(tenant_id, %L) or public.homecare_has_permission(tenant_id, %L)))',
      table_name, permission_name, 'data.write'
    );
    execute format(
      'create policy tenant_member_update on public.%I for update to authenticated using (tenant_id = public.homecare_request_tenant() and (public.homecare_has_permission(tenant_id, %L) or public.homecare_has_permission(tenant_id, %L))) with check (tenant_id = public.homecare_request_tenant() and (public.homecare_has_permission(tenant_id, %L) or public.homecare_has_permission(tenant_id, %L)))',
      table_name, permission_name, 'data.write', permission_name, 'data.write'
    );
    execute format(
      'create policy tenant_member_delete on public.%I for delete to authenticated using (tenant_id = public.homecare_request_tenant() and (public.homecare_has_permission(tenant_id, %L) or public.homecare_has_permission(tenant_id, %L)))',
      table_name, permission_name, 'data.write'
    );
  end loop;
end
$$;

drop policy if exists portal_access_self_read on public.homecare_portal_access;
create policy portal_access_self_read
  on public.homecare_portal_access
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and tenant_id = public.homecare_request_tenant()
    and status = 'active'
  );
