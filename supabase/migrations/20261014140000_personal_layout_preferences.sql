begin;
create or replace function public.homecare_valid_layout_order(items text[],allowed text[]) returns boolean
language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select coalesce(array_ndims(items),1)=1 and items <@ allowed and array_position(items,null) is null
    and cardinality(items)=(select count(distinct item) from unnest(items) item)
$$;
revoke all on function public.homecare_valid_layout_order(text[],text[]) from public,anon;
grant execute on function public.homecare_valid_layout_order(text[],text[]) to authenticated,service_role;
create table if not exists public.homecare_user_layout_preferences (
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  navigation_order text[] not null default '{}',
  vehicle_block_order text[] not null default '{}',
  primary key(tenant_id,user_id),
  check(public.homecare_valid_layout_order(navigation_order,array['dashboard','objects','customers','jobs','planning','field','tracking','communication','billing','analytics','inventory','portal','masterData']::text[])),
  check(public.homecare_valid_layout_order(vehicle_block_order,array['standardTrips','documents','maintenance']::text[]))
);
create index if not exists user_layout_preferences_user_idx on public.homecare_user_layout_preferences(user_id);
alter table public.homecare_user_layout_preferences enable row level security;
revoke all on public.homecare_user_layout_preferences from public,anon,authenticated;
grant select,insert,update on public.homecare_user_layout_preferences to authenticated;
grant all on public.homecare_user_layout_preferences to service_role;
drop policy if exists personal_layout_self on public.homecare_user_layout_preferences;
create policy personal_layout_self on public.homecare_user_layout_preferences for all to authenticated
  using(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id))
  with check(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id));

-- Invoker rights keep both membership and ownership under RLS. Update just one
-- column atomically so changes from another device to the other order survive.
create or replace function public.homecare_update_layout_preference(p_tenant_id uuid,p_key text,p_value text[])
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare col text; saved jsonb;
begin
  if auth.uid() is null or p_tenant_id is distinct from public.homecare_request_tenant() or not public.homecare_is_tenant_member(p_tenant_id) then raise exception 'LAYOUT_FORBIDDEN' using errcode='42501'; end if;
  col:=case p_key when 'navigationOrder' then 'navigation_order' when 'vehicleBlockOrder' then 'vehicle_block_order' else null end;
  if col is null or p_value is null then raise exception 'INVALID_LAYOUT_ORDER' using errcode='23514'; end if;
  execute format('insert into public.homecare_user_layout_preferences(tenant_id,user_id,%1$I) values($1,$2,$3) on conflict(tenant_id,user_id) do update set %1$I=excluded.%1$I returning to_jsonb(homecare_user_layout_preferences.*)',col)
    into saved using p_tenant_id,auth.uid(),p_value;
  return saved;
end $$;
revoke all on function public.homecare_update_layout_preference(uuid,text,text[]) from public,anon;
grant execute on function public.homecare_update_layout_preference(uuid,text,text[]) to authenticated,service_role;

do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_layout()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_layout;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_layout()||array['homecare_user_layout_preferences']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
