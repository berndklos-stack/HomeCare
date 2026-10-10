begin;
create table if not exists public.homecare_inventory_plans (
  tenant_id uuid not null references public.homecare_tenants(id), id uuid not null,
  note text not null, actor_user_id uuid not null, created_at timestamptz not null default now(),
  revision integer not null default 1, completed_at timestamptz,
  primary key(tenant_id,id)
);
create table if not exists public.homecare_inventory_plan_items (
  tenant_id uuid not null, plan_id uuid not null, location_id text not null, material_id text not null,
  expected_quantity numeric not null, counted_quantity numeric check(counted_quantity >= 0),
  posting_id uuid not null default gen_random_uuid(),
  primary key(tenant_id,plan_id,location_id,material_id),
  foreign key(tenant_id,plan_id) references public.homecare_inventory_plans(tenant_id,id),
  foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id)
);
alter table public.homecare_inventory_plans enable row level security;
alter table public.homecare_inventory_plan_items enable row level security;
drop policy if exists plan_read on public.homecare_inventory_plans;
create policy plan_read on public.homecare_inventory_plans for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
drop policy if exists plan_read on public.homecare_inventory_plan_items;
create policy plan_read on public.homecare_inventory_plan_items for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_inventory_plans,public.homecare_inventory_plan_items from anon,authenticated;
grant select on public.homecare_inventory_plans,public.homecare_inventory_plan_items to authenticated;
grant all on public.homecare_inventory_plans,public.homecare_inventory_plan_items to service_role;

create or replace function public.homecare_save_inventory_plan(p_tenant uuid,p_id uuid,p_actor uuid,p_note text,p_revision integer,p_items jsonb,p_complete boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare old public.homecare_inventory_plans%rowtype; item jsonb; loc text; next_revision integer;
begin
  if nullif(trim(p_note),'') is null or length(p_note)>9000 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'INVALID_PLAN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':plan:'||p_id::text,0));
  select * into old from public.homecare_inventory_plans where tenant_id=p_tenant and id=p_id for update;
  if found then
    if old.completed_at is not null then
      if p_complete and old.note=trim(p_note)
        and (select jsonb_agg(jsonb_build_object('location_id',location_id,'material_id',material_id,'expected',expected_quantity,'counted',counted_quantity) order by location_id,material_id)
          from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id)
        = (select jsonb_agg(jsonb_build_object('location_id',value->>'location_id','material_id',value->>'material_id','expected',(value->>'expected')::numeric,'counted',(value->>'counted')::numeric) order by value->>'location_id',value->>'material_id') from jsonb_array_elements(p_items)) then return old.revision; end if;
      raise exception 'PLAN_COMPLETED';
    end if;
    if old.revision<>p_revision then
      -- A lost response may repeat the exact last save, but never overwrite newer values.
      if not p_complete and old.revision=p_revision+1 and old.note=trim(p_note)
        and (select jsonb_agg(jsonb_build_object('location_id',location_id,'material_id',material_id,'expected',expected_quantity,'counted',counted_quantity) order by location_id,material_id)
          from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id)
        = (select jsonb_agg(jsonb_build_object('location_id',value->>'location_id','material_id',value->>'material_id','expected',(value->>'expected')::numeric,'counted',(value->>'counted')::numeric) order by value->>'location_id',value->>'material_id') from jsonb_array_elements(p_items)) then return old.revision; end if;
      raise exception 'PLAN_CHANGED';
    end if;
    if (select count(*) from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id)<>jsonb_array_length(p_items) then raise exception 'PLAN_ITEMS_CHANGED'; end if;
    next_revision:=old.revision+1;
  else
    if p_revision<>0 or p_complete then raise exception 'PLAN_CHANGED'; end if;
    insert into public.homecare_inventory_plans(tenant_id,id,note,actor_user_id) values(p_tenant,p_id,trim(p_note),p_actor);
    next_revision:=1;
  end if;
  if (select count(distinct (value->>'location_id',value->>'material_id')) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'DUPLICATE_PLAN_ITEM'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if (item->>'expected')::numeric is null or (item->>'expected')::numeric::text in ('NaN','Infinity','-Infinity')
      or ((item->>'counted') is not null and ((item->>'counted')::numeric<0 or (item->>'counted')::numeric::text in ('NaN','Infinity','-Infinity') or (item->>'counted')::numeric<>round((item->>'counted')::numeric,3))) then raise exception 'INVALID_COUNT'; end if;
    if old.id is null then
      perform 1 from public.homecare_inventory_locations where tenant_id=p_tenant and id=item->>'location_id' and deleted_at is null and not archived;
      if not found then raise exception 'LOCATION_NOT_ACTIVE'; end if;
      perform 1 from public.homecare_materials where tenant_id=p_tenant and id=item->>'material_id' and deleted_at is null and not archived;
      if not found then raise exception 'MATERIAL_NOT_ACTIVE'; end if;
      insert into public.homecare_inventory_plan_items(tenant_id,plan_id,location_id,material_id,expected_quantity,counted_quantity)
        values(p_tenant,p_id,item->>'location_id',item->>'material_id',(item->>'expected')::numeric,(item->>'counted')::numeric);
    else
      update public.homecare_inventory_plan_items set counted_quantity=(item->>'counted')::numeric
        where tenant_id=p_tenant and plan_id=p_id and location_id=item->>'location_id' and material_id=item->>'material_id' and expected_quantity=(item->>'expected')::numeric;
      if not found then raise exception 'PLAN_ITEMS_CHANGED'; end if;
    end if;
  end loop;
  if p_complete then
    if exists(select 1 from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id and counted_quantity is null) then raise exception 'COUNT_INCOMPLETE'; end if;
    -- Lock every material in a common order before posting all locations atomically.
    perform 1 from public.homecare_materials where tenant_id=p_tenant and id in(select material_id from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id) order by id for update;
    for loc in select distinct location_id from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id order by location_id loop
      perform public.homecare_post_inventory(p_tenant,
        (select posting_id from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id and location_id=loc order by material_id limit 1),
        loc,p_actor,'Inventur '||p_id::text||': '||trim(p_note),
        (select jsonb_agg(jsonb_build_object('material_id',material_id,'expected',expected_quantity,'counted',counted_quantity) order by material_id) from public.homecare_inventory_plan_items where tenant_id=p_tenant and plan_id=p_id and location_id=loc));
    end loop;
  end if;
  update public.homecare_inventory_plans set note=trim(p_note),revision=next_revision,completed_at=case when p_complete then now() else null end where tenant_id=p_tenant and id=p_id;
  return next_revision;
end $$;
revoke all on function public.homecare_save_inventory_plan(uuid,uuid,uuid,text,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.homecare_save_inventory_plan(uuid,uuid,uuid,text,integer,jsonb,boolean) to service_role;
do $$ begin
 if to_regprocedure('public.homecare_relational_backup_tables_before_plans()') is null then
  alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_plans;
 end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_plans()||array['homecare_inventory_plans','homecare_inventory_plan_items']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
