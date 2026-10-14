begin;

create table if not exists public.homecare_resource_standard_trip_distances (
  tenant_id uuid not null,
  resource_id text not null,
  standard_trip_id text not null check (length(btrim(standard_trip_id)) > 0),
  distance_km numeric(12,3) check (distance_km > 0 and distance_km <= 999999.999),
  primary key (tenant_id,resource_id,standard_trip_id),
  foreign key (tenant_id,resource_id) references public.homecare_resources(tenant_id,id) on delete cascade
);
alter table public.homecare_resource_standard_trip_distances enable row level security;
revoke all on public.homecare_resource_standard_trip_distances from public,anon,authenticated;
grant select on public.homecare_resource_standard_trip_distances to authenticated;
grant all on public.homecare_resource_standard_trip_distances to service_role;
drop policy if exists standard_trip_distances_tenant_read on public.homecare_resource_standard_trip_distances;
create policy standard_trip_distances_tenant_read on public.homecare_resource_standard_trip_distances
  for select to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));

-- Keep old clients and existing backup/restore payloads compatible. The numeric
-- column is authoritative; JSON is only the transport/backup mirror.
create or replace function public.homecare_sync_standard_trip_distances()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare item jsonb; distance numeric; mirrored jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(new.standard_trips) is distinct from 'array' then raise exception 'INVALID_STANDARD_TRIPS'; end if;
  if current_setting('workcore.operations_restore',true)='1' then return new; end if;
  if tg_when='BEFORE' then
    for item in select value from jsonb_array_elements(new.standard_trips) loop
      if not (item ? 'distanceKm') then
        select d.distance_km into distance from public.homecare_resource_standard_trip_distances d
          where d.tenant_id=new.tenant_id and d.resource_id=new.id and d.standard_trip_id=item->>'id';
        if found then item:=item||jsonb_build_object('distanceKm',distance); end if;
      end if;
      if item ? 'distanceKm' and item->'distanceKm'<>'null'::jsonb then
        if jsonb_typeof(item->'distanceKm')<>'number' then raise exception 'INVALID_STANDARD_TRIP_DISTANCE'; end if;
        distance:=(item->>'distanceKm')::numeric;
        if distance<=0 or distance>999999.999 or distance<>round(distance,3) then raise exception 'INVALID_STANDARD_TRIP_DISTANCE'; end if;
      end if;
      mirrored:=mirrored||jsonb_build_array(item);
    end loop;
    new.standard_trips:=mirrored;
    return new;
  end if;
  delete from public.homecare_resource_standard_trip_distances d where d.tenant_id=new.tenant_id and d.resource_id=new.id
    and not exists(select 1 from jsonb_array_elements(new.standard_trips) t where t->>'id'=d.standard_trip_id);
  for item in select value from jsonb_array_elements(new.standard_trips) loop
    if item ? 'distanceKm' then
      insert into public.homecare_resource_standard_trip_distances(tenant_id,resource_id,standard_trip_id,distance_km)
        values(new.tenant_id,new.id,item->>'id',(item->>'distanceKm')::numeric)
        on conflict(tenant_id,resource_id,standard_trip_id) do update set distance_km=excluded.distance_km;
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.homecare_sync_standard_trip_distances() from public,anon,authenticated;
grant execute on function public.homecare_sync_standard_trip_distances() to service_role;
drop trigger if exists homecare_standard_trip_distances_before on public.homecare_resources;
create trigger homecare_standard_trip_distances_before before insert or update of standard_trips on public.homecare_resources
  for each row execute function public.homecare_sync_standard_trip_distances();
drop trigger if exists homecare_standard_trip_distances_after on public.homecare_resources;
create trigger homecare_standard_trip_distances_after after insert or update of standard_trips on public.homecare_resources
  for each row execute function public.homecare_sync_standard_trip_distances();

-- Preserve any explicitly supplied legacy values without overwriting an
-- already migrated authoritative value on a repeated application.
insert into public.homecare_resource_standard_trip_distances(tenant_id,resource_id,standard_trip_id,distance_km)
  select r.tenant_id,r.id,t->>'id',(t->>'distanceKm')::numeric from public.homecare_resources r
  cross join lateral jsonb_array_elements(r.standard_trips) t where t ? 'distanceKm'
  on conflict(tenant_id,resource_id,standard_trip_id) do nothing;
comment on column public.homecare_resource_standard_trip_distances.distance_km is
  'Authoritative optional route distance in km. Never a departure or arrival odometer reading.';

do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_distances()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_distances;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[]
language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_distances()||array['homecare_resource_standard_trip_distances']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
