begin;

-- Global schema definitions only. Tenant configuration stays in resource types
-- and resource_type_fields, protected by their existing tenant read policies.
alter table public.homecare_resource_field_catalog enable row level security;

revoke all on public.homecare_resource_field_catalog from public, anon, authenticated;
grant select on public.homecare_resource_field_catalog to authenticated;

drop policy if exists resource_field_catalog_authenticated_read on public.homecare_resource_field_catalog;
create policy resource_field_catalog_authenticated_read
  on public.homecare_resource_field_catalog
  for select to authenticated
  using (true);

-- Keep the existing service_role/admin write path; no client write policies.
comment on table public.homecare_resource_field_catalog is
  'Global read-only system field definitions for authenticated clients. Tenant-specific configuration belongs in homecare_resource_types and homecare_resource_type_fields. Writes require trusted server/admin access or migrations.';

commit;
