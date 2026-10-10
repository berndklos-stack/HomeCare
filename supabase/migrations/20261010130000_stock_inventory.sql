begin;
create table if not exists public.homecare_stock_inventories (
  tenant_id uuid not null references public.homecare_tenants(id), id uuid not null,
  location_id text not null, actor_user_id uuid not null, note text not null,
  created_at timestamptz not null default now(), primary key(tenant_id,id),
  foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id)
);
create table if not exists public.homecare_stock_inventory_items (
  tenant_id uuid not null, inventory_id uuid not null, material_id text not null,
  expected_quantity numeric not null, counted_quantity numeric not null check(counted_quantity>=0),
  movement_id uuid, primary key(tenant_id,inventory_id,material_id),
  foreign key(tenant_id,inventory_id) references public.homecare_stock_inventories(tenant_id,id),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id),
  foreign key(tenant_id,movement_id) references public.homecare_stock_movements(tenant_id,id)
);
alter table public.homecare_stock_inventories enable row level security;
alter table public.homecare_stock_inventory_items enable row level security;
drop policy if exists inventory_read on public.homecare_stock_inventories;
create policy inventory_read on public.homecare_stock_inventories for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
drop policy if exists inventory_read on public.homecare_stock_inventory_items;
create policy inventory_read on public.homecare_stock_inventory_items for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_stock_inventories,public.homecare_stock_inventory_items from anon,authenticated;
grant select on public.homecare_stock_inventories,public.homecare_stock_inventory_items to authenticated;
grant all on public.homecare_stock_inventories,public.homecare_stock_inventory_items to service_role;

create or replace function public.homecare_post_inventory(p_tenant uuid,p_id uuid,p_location text,p_actor uuid,p_note text,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare item jsonb; balance numeric; expected numeric; counted numeric; delta numeric; movement uuid; old public.homecare_stock_inventories%rowtype;
begin
  if p_tenant is null or p_id is null or p_actor is null or nullif(trim(p_note),'') is null
    or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then
    raise exception 'INVALID_INVENTORY' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':inventory:'||p_id::text,0));
  select * into old from public.homecare_stock_inventories where tenant_id=p_tenant and id=p_id;
  if found then
    if (old.location_id,old.actor_user_id,old.note) is distinct from (p_location,p_actor,p_note)
      or (select jsonb_agg(jsonb_build_object('material_id',material_id,'expected',expected_quantity,'counted',counted_quantity) order by material_id)
        from public.homecare_stock_inventory_items where tenant_id=p_tenant and inventory_id=p_id)
        is distinct from (select jsonb_agg(value order by value->>'material_id') from jsonb_array_elements(p_items)) then
      raise exception 'INVENTORY_ID_REUSED' using errcode='23514';
    end if;
    return p_id;
  end if;
  if not exists(select 1 from public.homecare_stock_cutovers where tenant_id=p_tenant) then raise exception 'STOCK_NOT_ACTIVE'; end if;
  perform 1 from public.homecare_inventory_locations where tenant_id=p_tenant and id=p_location and deleted_at is null and not archived for share;
  if not found then raise exception 'LOCATION_NOT_ACTIVE' using errcode='23514'; end if;
  if (select count(distinct value->>'material_id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then
    raise exception 'DUPLICATE_MATERIAL' using errcode='22023';
  end if;
  -- Same material locks and ordering as normal stock postings; the full count is atomic.
  for item in select value from jsonb_array_elements(p_items) order by value->>'material_id' loop
    perform 1 from public.homecare_materials where tenant_id=p_tenant and id=item->>'material_id' and deleted_at is null and not archived for update;
    if not found then raise exception 'MATERIAL_NOT_ACTIVE' using errcode='23514'; end if;
  end loop;
  insert into public.homecare_stock_inventories(tenant_id,id,location_id,actor_user_id,note) values(p_tenant,p_id,p_location,p_actor,p_note);
  for item in select value from jsonb_array_elements(p_items) order by value->>'material_id' loop
    expected:=(item->>'expected')::numeric; counted:=(item->>'counted')::numeric;
    if expected is null or counted is null or counted<0 or counted::text in('NaN','Infinity','-Infinity')
      or expected::text in('NaN','Infinity','-Infinity') or counted<>round(counted,3) then raise exception 'INVALID_COUNT' using errcode='22023'; end if;
    select coalesce(sum(case when destination_id=p_location then quantity else 0 end)-sum(case when source_id=p_location then quantity else 0 end),0)
      into balance from public.homecare_stock_movements where tenant_id=p_tenant and material_id=item->>'material_id';
    if balance<>expected then raise exception 'INVENTORY_STOCK_CHANGED' using errcode='23514'; end if;
    delta:=counted-balance; movement:=null;
    if delta<>0 then
      movement:=gen_random_uuid();
      perform public.homecare_stock_post(p_tenant,movement,item->>'material_id',case when delta<0 then p_location else null end,
        case when delta>0 then p_location else null end,abs(delta),p_actor,'Inventur ['||p_id::text||']: '||p_note);
    end if;
    insert into public.homecare_stock_inventory_items(tenant_id,inventory_id,material_id,expected_quantity,counted_quantity,movement_id)
      values(p_tenant,p_id,item->>'material_id',expected,counted,movement);
  end loop;
  return p_id;
end $$;
revoke all on function public.homecare_post_inventory(uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.homecare_post_inventory(uuid,uuid,text,uuid,text,jsonb) to service_role;
do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_inventory()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_inventory;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
  select public.homecare_relational_backup_tables_before_inventory()||array['homecare_stock_inventories','homecare_stock_inventory_items']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
