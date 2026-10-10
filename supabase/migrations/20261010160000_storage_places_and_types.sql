begin;
create table if not exists public.homecare_storage_location_types (
  tenant_id uuid not null references public.homecare_tenants(id), id uuid not null default gen_random_uuid(),
  name text not null check(nullif(trim(name),'') is not null), notes text,
  revision bigint not null default 1, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(tenant_id,id)
);
create unique index if not exists storage_location_type_name on public.homecare_storage_location_types(tenant_id,lower(trim(name))) where deleted_at is null;
alter table public.homecare_storage_location_types enable row level security;
drop policy if exists storage_location_type_read on public.homecare_storage_location_types;
create policy storage_location_type_read on public.homecare_storage_location_types for select to authenticated
using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_storage_location_types from anon,authenticated;
grant select on public.homecare_storage_location_types to authenticated;
grant all on public.homecare_storage_location_types to service_role;
drop trigger if exists bump_revision on public.homecare_storage_location_types;
create trigger bump_revision before update on public.homecare_storage_location_types for each row execute function public.homecare_bump_revision();

insert into public.homecare_storage_location_types(tenant_id,name)
select t.id,example.name from public.homecare_tenants t cross join (values('Lager'),('Wareneingang'),('Kommissionierwagen'),('Auftragsbereitstellung'),('Sonderplatz')) example(name)
where not exists(select 1 from public.homecare_storage_location_types existing where existing.tenant_id=t.id and lower(trim(existing.name))=lower(example.name) and existing.deleted_at is null);

alter table public.homecare_inventory_locations add column if not exists parent_location_id text,
  add column if not exists location_type_id uuid, add column if not exists job_id text;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_inventory_locations'::regclass and conname='storage_place_parent_fk') then
    alter table public.homecare_inventory_locations add constraint storage_place_parent_fk foreign key(tenant_id,parent_location_id)
      references public.homecare_inventory_locations(tenant_id,id) deferrable initially deferred;
    alter table public.homecare_inventory_locations add constraint storage_place_type_fk foreign key(tenant_id,location_type_id)
      references public.homecare_storage_location_types(tenant_id,id);
    alter table public.homecare_inventory_locations add constraint storage_place_job_fk foreign key(tenant_id,job_id)
      references public.homecare_jobs(tenant_id,id);
    alter table public.homecare_inventory_locations add constraint storage_place_no_self check(parent_location_id is distinct from id);
  end if;
end $$;
create index if not exists storage_place_parent_idx on public.homecare_inventory_locations(tenant_id,parent_location_id);

create or replace function public.homecare_storage_place_lock()
returns trigger language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':storage-structure',0));
  return new;
end $$;
drop trigger if exists storage_place_lock on public.homecare_inventory_locations;
create trigger storage_place_lock before insert or update on public.homecare_inventory_locations
for each row execute function public.homecare_storage_place_lock();

create or replace function public.homecare_storage_place_check()
returns trigger language plpgsql set search_path=public as $$
begin
  -- Checked at transaction end so relational backups can restore parent/child rows in any order.
  if exists(select 1 from public.homecare_inventory_locations child
    join public.homecare_inventory_locations parent on parent.tenant_id=child.tenant_id and parent.id=child.parent_location_id
    where child.tenant_id=new.tenant_id and child.deleted_at is null and not child.archived
      and (parent.parent_location_id is not null or parent.deleted_at is not null or parent.archived)) then
    raise exception 'Lagerplaetze benoetigen einen aktiven uebergeordneten Lagerort.' using errcode='23514';
  end if;
  return null;
end $$;
drop trigger if exists storage_place_check on public.homecare_inventory_locations;
create constraint trigger storage_place_check after insert or update on public.homecare_inventory_locations
deferrable initially deferred for each row execute function public.homecare_storage_place_check();

do $$
declare definition text;
begin
  select pg_get_functiondef('public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)'::regprocedure) into definition;
  if position('when ''location_types''' in definition)=0 then
    if position('allowed:=array[''name'',''location_code'',''location_kind'',''resource_id'',''project_id'',''note'']' in definition)=0 then raise exception 'Location command contract not found.'; end if;
    definition:=replace(definition,'when ''location_details'' then','when ''location_types'' then tbl:=''homecare_storage_location_types''; allowed:=array[''name'',''notes'']; when ''location_details'' then');
    definition:=replace(definition,'allowed:=array[''name'',''location_code'',''location_kind'',''resource_id'',''project_id'',''note'']','allowed:=array[''name'',''location_code'',''location_kind'',''location_type_id'',''parent_location_id'',''job_id'',''resource_id'',''project_id'',''note'']');
    execute definition;
  end if;
end $$;

do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_storage_places()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_storage_places;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
  select array['homecare_storage_location_types']::text[]||public.homecare_relational_backup_tables_before_storage_places()
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
