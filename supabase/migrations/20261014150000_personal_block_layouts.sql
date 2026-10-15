begin;

-- Ausschliesslich generische UI-IDs speichern, keine Businessdaten.
create or replace function public.homecare_valid_block_layout(p_scope_key text,p_block_order text[])
returns boolean language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select coalesce(
    p_scope_key collate "C" ~ '^[a-z][a-zA-Z0-9.-]{0,79}$'
    and p_block_order is not null
    and coalesce(array_ndims(p_block_order),1)=1
    and cardinality(p_block_order)<=64
    and not exists(select 1 from unnest(p_block_order) item
      where item is null or item collate "C" !~ '^[a-z][a-zA-Z0-9.-]{0,79}$')
    and cardinality(p_block_order)=(select count(distinct item) from unnest(p_block_order) item),false)
$$;
revoke all on function public.homecare_valid_block_layout(text,text[]) from public,anon,authenticated;
grant execute on function public.homecare_valid_block_layout(text,text[]) to authenticated,service_role;

create table if not exists public.homecare_user_block_layouts (
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  block_order text[] not null default '{}',
  primary key(tenant_id,user_id,scope_key),
  constraint personal_block_layout_valid check(public.homecare_valid_block_layout(scope_key,block_order))
);
create index if not exists user_block_layouts_user_idx on public.homecare_user_block_layouts(user_id);
alter table public.homecare_user_block_layouts enable row level security;
revoke all on public.homecare_user_block_layouts from public,anon,authenticated;
grant select,insert,update on public.homecare_user_block_layouts to authenticated;
grant all on public.homecare_user_block_layouts to service_role;
drop policy if exists personal_block_layout_select on public.homecare_user_block_layouts;
drop policy if exists personal_block_layout_insert on public.homecare_user_block_layouts;
drop policy if exists personal_block_layout_update on public.homecare_user_block_layouts;
create policy personal_block_layout_select on public.homecare_user_block_layouts for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id));
create policy personal_block_layout_insert on public.homecare_user_block_layouts for insert to authenticated
  with check(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id));
create policy personal_block_layout_update on public.homecare_user_block_layouts for update to authenticated
  using(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id))
  with check(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id));

create or replace function public.homecare_update_block_layout(p_tenant_id uuid,p_scope_key text,p_block_order text[])
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare saved jsonb;
begin
  if auth.uid() is null or p_tenant_id is distinct from public.homecare_request_tenant()
    or not public.homecare_is_tenant_member(p_tenant_id) then
    raise exception 'BLOCK_LAYOUT_FORBIDDEN' using errcode='42501';
  end if;
  if not public.homecare_valid_block_layout(p_scope_key,p_block_order) then
    raise exception 'INVALID_BLOCK_LAYOUT' using errcode='23514';
  end if;
  insert into public.homecare_user_block_layouts(tenant_id,user_id,scope_key,block_order)
    values(p_tenant_id,auth.uid(),p_scope_key,p_block_order)
    on conflict(tenant_id,user_id,scope_key) do update set block_order=excluded.block_order
    returning to_jsonb(homecare_user_block_layouts.*) into saved;
  return saved;
end $$;
revoke all on function public.homecare_update_block_layout(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.homecare_update_block_layout(uuid,text,text[]) to authenticated,service_role;

do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_block_layouts()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_block_layouts;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[]
language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_block_layouts()||array['homecare_user_block_layouts']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
