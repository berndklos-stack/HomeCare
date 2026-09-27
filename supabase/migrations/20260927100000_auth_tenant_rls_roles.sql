-- V1 security foundation: Supabase Auth identity, multi-company membership,
-- extensible roles and tenant-enforcing RLS.

create table if not exists public.homecare_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  key text not null,
  name text not null,
  permissions text[] not null default '{}'::text[],
  system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table if not exists public.homecare_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.homecare_roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create unique index if not exists homecare_customers_tenant_id_id_uidx
  on public.homecare_customers(tenant_id, id);

create table if not exists public.homecare_portal_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, customer_id),
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) on delete cascade
);

create index if not exists homecare_tenant_memberships_user_idx
  on public.homecare_tenant_memberships(user_id, status, tenant_id);
create index if not exists homecare_portal_access_user_idx
  on public.homecare_portal_access(user_id, status, tenant_id);
alter table public.homecare_vehicle_positions drop constraint if exists homecare_vehicle_positions_pkey;
alter table public.homecare_vehicle_positions add primary key (tenant_id, resource_id);

alter table public.homecare_driving_log_regulations
  add column if not exists tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.homecare_tenants(id) on delete restrict;
alter table public.homecare_trip_audit_log
  add column if not exists tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.homecare_tenants(id) on delete restrict;
alter table public.homecare_odometer_history
  add column if not exists tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.homecare_tenants(id) on delete restrict;
alter table public.homecare_sync_mutations alter column tenant_id drop default;

insert into public.homecare_roles (tenant_id, key, name, permissions, system_role)
select tenant.id, role.key, role.name, role.permissions, true
from public.homecare_tenants tenant
cross join (values
  ('owner', 'Owner', array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write','backups.manage','tenant.admin','members.manage','roles.manage']::text[]),
  ('admin', 'Admin', array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write','backups.manage','tenant.admin','members.manage','roles.manage']::text[]),
  ('manager', 'Manager', array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write']::text[]),
  ('office', 'Office', array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write']::text[]),
  ('field_worker', 'Field worker', array['data.read','jobs.manage','resources.manage','media.manage','sync.write']::text[])
) as role(key, name, permissions)
on conflict (tenant_id, key) do update set
  name = excluded.name,
  permissions = excluded.permissions,
  system_role = true;

insert into public.homecare_tenant_memberships (tenant_id, user_id, role_id, status)
select profile.tenant_id, profile.id, role.id, 'active'
from public.homecare_user_profiles profile
join public.homecare_roles role
  on role.tenant_id = profile.tenant_id
 and role.key = case profile.role::text
   when 'owner' then 'owner'
   when 'admin' then 'admin'
   when 'office' then 'office'
   when 'field_staff' then 'field_worker'
   else 'field_worker'
 end
where profile.role::text <> 'customer'
on conflict (tenant_id, user_id) do nothing;

insert into public.homecare_portal_access (tenant_id, user_id, customer_id, status)
select profile.tenant_id, profile.id, profile.customer_id, 'active'
from public.homecare_user_profiles profile
where profile.role::text = 'customer'
  and nullif(profile.customer_id, '') is not null
on conflict (tenant_id, user_id, customer_id) do nothing;

update public.homecare_customers
set portal_password = null
where portal_password is not null;

-- Remove plaintext portal credentials from legacy JSON snapshots as well.
update public.app_state state
set data = jsonb_set(
  state.data,
  '{customers}',
  coalesce((select jsonb_agg(customer - 'portalPassword') from jsonb_array_elements(state.data->'customers') customer), '[]'::jsonb)
)
where jsonb_typeof(state.data->'customers') = 'array';

update public.app_state state
set data = jsonb_set(
  state.data,
  '{value}',
  coalesce((select jsonb_agg(customer - 'portalPassword') from jsonb_array_elements(state.data->'value') customer), '[]'::jsonb)
)
where state.id = 'sync-section:customers'
  and jsonb_typeof(state.data->'value') = 'array';

-- Composite keys prevent cross-tenant foreign-key relationships.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'homecare_customers','homecare_objects','homecare_media','homecare_personnel',
    'homecare_services','homecare_service_packages','homecare_jobs','homecare_field_progress',
    'homecare_reports','homecare_billing_items',
    'homecare_inventory_locations','homecare_materials','homecare_inventory_movements',
    'homecare_resources','homecare_vehicle_trips',
    'homecare_portal_messages'
  ] loop
    execute format('create unique index if not exists %I on public.%I(tenant_id, id)', table_name || '_tenant_id_id_uidx', table_name);
  end loop;
end $$;

-- Natural keys must be tenant-scoped or a second company could not use the same
-- account number, translation key or settings key.
alter table public.homecare_accounting_accounts drop constraint if exists homecare_accounting_accounts_pkey;
alter table public.homecare_accounting_accounts add primary key (tenant_id, account);
alter table public.homecare_translations drop constraint if exists homecare_translations_pkey;
alter table public.homecare_translations add primary key (tenant_id, key);
alter table public.homecare_settings drop constraint if exists homecare_settings_pkey;
alter table public.homecare_settings add primary key (tenant_id, key);

-- Existing single-column foreign keys retain their delete behaviour. These
-- additional constraints ensure that new relationships cannot cross tenants.
alter table public.homecare_objects
  add constraint homecare_objects_customer_tenant_fk
  foreign key (tenant_id, owner_customer_id) references public.homecare_customers(tenant_id, id) not valid;
alter table public.homecare_jobs
  add constraint homecare_jobs_object_tenant_fk
  foreign key (tenant_id, object_id) references public.homecare_objects(tenant_id, id) not valid,
  add constraint homecare_jobs_customer_tenant_fk
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) not valid;
alter table public.homecare_field_progress
  add constraint homecare_field_progress_job_tenant_fk
  foreign key (tenant_id, job_id) references public.homecare_jobs(tenant_id, id) not valid;
alter table public.homecare_reports
  add constraint homecare_reports_job_tenant_fk
  foreign key (tenant_id, job_id) references public.homecare_jobs(tenant_id, id) not valid,
  add constraint homecare_reports_object_tenant_fk
  foreign key (tenant_id, object_id) references public.homecare_objects(tenant_id, id) not valid;
alter table public.homecare_billing_items
  add constraint homecare_billing_items_object_tenant_fk
  foreign key (tenant_id, object_id) references public.homecare_objects(tenant_id, id) not valid,
  add constraint homecare_billing_items_customer_tenant_fk
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) not valid,
  add constraint homecare_billing_items_job_tenant_fk
  foreign key (tenant_id, job_id) references public.homecare_jobs(tenant_id, id) not valid,
  add constraint homecare_billing_items_report_tenant_fk
  foreign key (tenant_id, report_id) references public.homecare_reports(tenant_id, id) not valid;
alter table public.homecare_materials
  add constraint homecare_materials_location_tenant_fk
  foreign key (tenant_id, primary_location_id) references public.homecare_inventory_locations(tenant_id, id) not valid;
alter table public.homecare_inventory_movements
  add constraint homecare_inventory_movements_material_tenant_fk
  foreign key (tenant_id, material_id) references public.homecare_materials(tenant_id, id) not valid,
  add constraint homecare_inventory_movements_location_tenant_fk
  foreign key (tenant_id, location_id) references public.homecare_inventory_locations(tenant_id, id) not valid,
  add constraint homecare_inventory_movements_customer_tenant_fk
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) not valid,
  add constraint homecare_inventory_movements_service_tenant_fk
  foreign key (tenant_id, service_id) references public.homecare_services(tenant_id, id) not valid;
alter table public.homecare_resources
  add constraint homecare_resources_person_tenant_fk
  foreign key (tenant_id, responsible_person_id) references public.homecare_personnel(tenant_id, id) not valid;
alter table public.homecare_vehicle_trips
  add constraint homecare_vehicle_trips_resource_tenant_fk
  foreign key (tenant_id, resource_id) references public.homecare_resources(tenant_id, id) not valid,
  add constraint homecare_vehicle_trips_driver_tenant_fk
  foreign key (tenant_id, driver_id) references public.homecare_personnel(tenant_id, id) not valid;
alter table public.homecare_vehicle_positions
  add constraint homecare_vehicle_positions_resource_tenant_fk
  foreign key (tenant_id, resource_id) references public.homecare_resources(tenant_id, id) not valid,
  add constraint homecare_vehicle_positions_driver_tenant_fk
  foreign key (tenant_id, driver_id) references public.homecare_personnel(tenant_id, id) not valid;
alter table public.homecare_portal_messages
  add constraint homecare_portal_messages_customer_tenant_fk
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) not valid,
  add constraint homecare_portal_messages_object_tenant_fk
  foreign key (tenant_id, object_id) references public.homecare_objects(tenant_id, id) not valid;

create or replace function public.homecare_is_tenant_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.homecare_tenant_memberships membership
    where membership.tenant_id = target_tenant
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.homecare_has_permission(target_tenant uuid, required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.homecare_tenant_memberships membership
    join public.homecare_roles role on role.id = membership.role_id and role.tenant_id = membership.tenant_id
    where membership.tenant_id = target_tenant
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and required_permission = any(role.permissions)
  );
$$;

create or replace function public.homecare_request_tenant()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::jsonb ->> 'x-workcore-tenant', '')::uuid;
$$;

create or replace function public.homecare_assign_request_tenant()
returns trigger
language plpgsql
security invoker
as $$
declare
  requested_tenant uuid := public.homecare_request_tenant();
begin
  if auth.role() = 'authenticated' then
    if requested_tenant is null then
      raise exception 'WORKCORE_TENANT_REQUIRED' using errcode = '42501';
    end if;

    -- Existing tables still use the bootstrap tenant as their column default.
    -- Treat that value like an omitted tenant for non-bootstrap requests, but
    -- reject every other explicit mismatch instead of silently rewriting it.
    if new.tenant_id is not null
      and new.tenant_id <> requested_tenant
      and new.tenant_id <> '00000000-0000-0000-0000-000000000001'::uuid then
      raise exception 'WORKCORE_TENANT_MISMATCH' using errcode = '42501';
    end if;

    new.tenant_id := requested_tenant;
  end if;
  return new;
end;
$$;

revoke all on function public.homecare_is_tenant_member(uuid) from public;
revoke all on function public.homecare_has_permission(uuid, text) from public;
revoke all on function public.homecare_request_tenant() from public;
grant execute on function public.homecare_is_tenant_member(uuid) to authenticated;
grant execute on function public.homecare_has_permission(uuid, text) to authenticated;
grant execute on function public.homecare_request_tenant() to authenticated;

create or replace function public.homecare_grant_portal_access(
  p_tenant_id uuid,
  p_customer_id text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then return null; end if;

  insert into public.homecare_portal_access (tenant_id, user_id, customer_id, status)
  values (p_tenant_id, target_user_id, p_customer_id, 'active')
  on conflict (tenant_id, user_id, customer_id) do update set
    status = 'active',
    updated_at = now();
  return target_user_id;
end;
$$;

revoke all on function public.homecare_grant_portal_access(uuid, text, text) from public, anon, authenticated;
grant execute on function public.homecare_grant_portal_access(uuid, text, text) to service_role;

alter table public.homecare_roles enable row level security;
alter table public.homecare_tenant_memberships enable row level security;
alter table public.homecare_portal_access enable row level security;

create policy roles_member_read on public.homecare_roles for select to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_is_tenant_member(tenant_id));
create policy roles_admin_write on public.homecare_roles for all to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'roles.manage'))
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'roles.manage'));
create policy memberships_self_read on public.homecare_tenant_memberships for select to authenticated
  using (user_id = auth.uid() or public.homecare_has_permission(tenant_id, 'members.manage'));
create policy memberships_admin_write on public.homecare_tenant_memberships for all to authenticated
  using (public.homecare_has_permission(tenant_id, 'members.manage'))
  with check (public.homecare_has_permission(tenant_id, 'members.manage'));
create policy portal_access_self_read on public.homecare_portal_access for select to authenticated
  using (user_id = auth.uid());
create policy portal_access_admin_write on public.homecare_portal_access for all to authenticated
  using (public.homecare_has_permission(tenant_id, 'members.manage'))
  with check (public.homecare_has_permission(tenant_id, 'members.manage'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'homecare_customers','homecare_objects','homecare_media','homecare_personnel',
    'homecare_services','homecare_service_packages','homecare_jobs','homecare_field_progress',
    'homecare_reports','homecare_billing_items','homecare_accounting_accounts',
    'homecare_inventory_locations','homecare_materials','homecare_inventory_movements',
    'homecare_resources','homecare_vehicle_trips','homecare_vehicle_positions',
    'homecare_portal_messages','homecare_translations','homecare_settings',
    'homecare_driving_log_regulations','homecare_trip_audit_log','homecare_odometer_history',
    'homecare_sync_mutations','homecare_subscriptions','homecare_tenant_modules'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_member_read on public.%I', table_name);
    execute format('drop policy if exists tenant_member_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_member_update on public.%I', table_name);
    execute format('drop policy if exists tenant_member_delete on public.%I', table_name);
    execute format('create policy tenant_member_read on public.%I for select to authenticated using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, %L))', table_name, 'data.read');
    execute format('create policy tenant_member_insert on public.%I for insert to authenticated with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, %L))', table_name, 'data.write');
    execute format('create policy tenant_member_update on public.%I for update to authenticated using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, %L)) with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, %L))', table_name, 'data.write', 'data.write');
    execute format('create policy tenant_member_delete on public.%I for delete to authenticated using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, %L))', table_name, 'data.write');
    execute format('drop trigger if exists assign_request_tenant on public.%I', table_name);
    execute format('create trigger assign_request_tenant before insert on public.%I for each row execute function public.homecare_assign_request_tenant()', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

-- Remove the original anonymous/demo access paths.
drop policy if exists "public read app demo state" on public.app_state;
drop policy if exists "public insert app demo state" on public.app_state;
drop policy if exists "public update app demo state" on public.app_state;
drop policy if exists "public read homecare vehicle positions" on public.homecare_vehicle_positions;
drop policy if exists "public insert homecare vehicle positions" on public.homecare_vehicle_positions;
drop policy if exists "public update homecare vehicle positions" on public.homecare_vehicle_positions;

alter table public.app_state add column if not exists tenant_id uuid
  references public.homecare_tenants(id) on delete cascade;
update public.app_state set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
alter table public.app_state alter column tenant_id set not null;
alter table public.app_state drop constraint if exists app_state_pkey;
alter table public.app_state add primary key (tenant_id, id);
alter table public.app_state enable row level security;
drop trigger if exists assign_request_tenant on public.app_state;
create trigger assign_request_tenant before insert on public.app_state
  for each row execute function public.homecare_assign_request_tenant();
create policy app_state_member_read on public.app_state for select to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'data.read'));
create policy app_state_member_write on public.app_state for all to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'data.write'))
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'data.write'));
revoke all on table public.app_state from anon;
grant select, insert, update, delete on table public.app_state to authenticated;

-- Supabase grants table privileges to API roles by default. Anonymous callers
-- must not retain table-level access even when RLS would currently deny rows.
do $$
declare
  table_record record;
begin
  for table_record in
    select format('%I.%I', schemaname, tablename) as qualified_name
    from pg_tables
    where schemaname = 'public'
      and (left(tablename, 9) = 'homecare_' or tablename = 'app_state')
  loop
    execute format('revoke all on table %s from anon', table_record.qualified_name);
  end loop;
end;
$$;

alter table public.homecare_tenants enable row level security;
drop policy if exists tenant_member_read on public.homecare_tenants;
create policy tenant_member_read on public.homecare_tenants for select to authenticated
  using (id = public.homecare_request_tenant() and public.homecare_is_tenant_member(id));
revoke all on table public.homecare_tenants from anon;
grant select on table public.homecare_tenants to authenticated;

alter table public.homecare_user_profiles enable row level security;
drop policy if exists profile_self_or_admin_read on public.homecare_user_profiles;
drop policy if exists profile_self_or_admin_write on public.homecare_user_profiles;
create policy profile_self_or_admin_read on public.homecare_user_profiles for select to authenticated
  using (tenant_id = public.homecare_request_tenant() and (id = auth.uid() or public.homecare_has_permission(tenant_id, 'members.manage')));
create policy profile_self_or_admin_write on public.homecare_user_profiles for all to authenticated
  using (tenant_id = public.homecare_request_tenant() and (id = auth.uid() or public.homecare_has_permission(tenant_id, 'members.manage')))
  with check (tenant_id = public.homecare_request_tenant() and (id = auth.uid() or public.homecare_has_permission(tenant_id, 'members.manage')));
revoke all on table public.homecare_user_profiles from anon;
grant select, insert, update, delete on table public.homecare_user_profiles to authenticated;

grant select, insert, update, delete on public.homecare_roles to authenticated;
grant select, insert, update, delete on public.homecare_tenant_memberships to authenticated;
grant select, insert, update, delete on public.homecare_portal_access to authenticated;
revoke all on table public.homecare_roles, public.homecare_tenant_memberships, public.homecare_portal_access from anon;

comment on table public.homecare_tenant_memberships is 'Authoritative staff-to-company assignment. One auth user may belong to multiple tenants.';
comment on table public.homecare_portal_access is 'Customer-scoped portal access backed by Supabase Auth; never grants staff tenant membership.';
