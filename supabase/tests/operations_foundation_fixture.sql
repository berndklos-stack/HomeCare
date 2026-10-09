-- Only the disposable cluster created by scripts/test-operations-database.mjs.
do $$ begin
  if current_database() <> 'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.homecare_tenants(id uuid primary key);
create function public.homecare_request_tenant() returns uuid language sql stable as $$
  select nullif(current_setting('test.tenant',true),'')::uuid
$$;
create function public.homecare_has_permission(target uuid,permission text) returns boolean language sql stable as $$
  select target=public.homecare_request_tenant() and current_setting('test.permission',true)='allowed'
$$;
create function public.homecare_bump_revision() returns trigger language plpgsql as $$ begin
  new.revision=old.revision+1; new.updated_at=now(); return new;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['homecare_materials','homecare_inventory_locations','homecare_resources','homecare_objects','homecare_jobs','homecare_personnel','homecare_media'] loop
    execute format('create table public.%I(tenant_id uuid not null references public.homecare_tenants(id),id text not null,name text,revision bigint not null default 1,archived boolean not null default false,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(tenant_id,id))',tbl);
  end loop;
end $$;
alter table public.homecare_materials add column purchase_price numeric(12,2);
alter table public.homecare_materials add column currency text default 'SEK';
alter table public.homecare_materials add column record_data jsonb not null default '{}';
alter table public.homecare_media add column storage_path text, add column metadata jsonb not null default '{}';
create table public.homecare_inventory_movements(tenant_id uuid not null,id text not null,material_id text not null,location_id text,
  movement_type text,quantity numeric,created_at timestamptz default now(),primary key(tenant_id,id));
create table public.homecare_vehicle_trips(tenant_id uuid not null,id text not null,resource_id text not null,status text,deleted_at timestamptz,primary key(tenant_id,id));
create trigger bump_revision before update on public.homecare_resources for each row execute function public.homecare_bump_revision();
create table public.homecare_sync_mutations(
  tenant_id uuid not null,mutation_id uuid not null,entity_type text,entity_id text,operation text,status text,
  expected_revision bigint,request_payload jsonb,response_payload jsonb,applied_at timestamptz,
  primary key(tenant_id,mutation_id)
);
create trigger bump_revision before update on public.homecare_materials for each row execute function public.homecare_bump_revision();
insert into public.homecare_tenants values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.homecare_materials(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','material','Material');
insert into public.homecare_inventory_locations(tenant_id,id,name) values
  ('00000000-0000-0000-0000-000000000001','warehouse','Warehouse'),
  ('00000000-0000-0000-0000-000000000001','vehicle','Vehicle'),
  ('00000000-0000-0000-0000-000000000002','foreign','Foreign');
insert into public.homecare_resources(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','resource','Vehicle');
insert into public.homecare_jobs(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','job','Job');
