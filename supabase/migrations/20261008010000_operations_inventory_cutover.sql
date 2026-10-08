begin;
create table if not exists public.homecare_stock_cutovers(
  tenant_id uuid primary key references public.homecare_tenants(id), completed_at timestamptz not null default now(), imported_entries integer not null
);
create table if not exists public.homecare_legacy_stock_entries(
  tenant_id uuid not null, material_id text not null, legacy_id text not null, original jsonb not null,
  signed_quantity numeric not null, location_id text not null, imported_at timestamptz not null default now(),
  primary key(tenant_id,material_id,legacy_id),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id),
  foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id)
);
alter table public.homecare_stock_movements add column if not exists legacy_entry_id text;
alter table public.homecare_stock_movements alter column actor_user_id drop not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_stock_movements'::regclass and conname='stock_actor_provenance') then
    alter table public.homecare_stock_movements add constraint stock_actor_provenance check(actor_user_id is not null or legacy_entry_id is not null);
    alter table public.homecare_stock_movements add constraint stock_legacy_entry_fk foreign key(tenant_id,material_id,legacy_entry_id)
      references public.homecare_legacy_stock_entries(tenant_id,material_id,legacy_id);
  end if;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['homecare_stock_cutovers','homecare_legacy_stock_entries'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant select,insert on public.%I to service_role',tbl);
    execute format('drop policy if exists operations_tenant_read on public.%I',tbl);
    execute format('create policy operations_tenant_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
    execute format('drop trigger if exists operations_immutable on public.%I',tbl);
    execute format('create trigger operations_immutable before update or delete on public.%I for each row execute function public.homecare_operations_immutable()',tbl);
  end loop;
end $$;

-- Explicit administrative activation, NOT executed by this migration. Unknown or
-- ambiguous locations abort the entire transaction, rather than guessing links.
create or replace function public.homecare_import_legacy_stock(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare material record; entry jsonb; entries jsonb; legacy_id text; location_name text; location_id text;
  matches integer; signed numeric; imported integer:=0; entry_date timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':stock-cutover',0));
  if exists(select 1 from public.homecare_stock_cutovers where tenant_id=p_tenant) then
    return jsonb_build_object('alreadyImported',true);
  end if;
  if exists(select 1 from public.homecare_stock_movements where tenant_id=p_tenant) then
    raise exception 'STOCK_JOURNAL_NOT_EMPTY' using errcode='23514';
  end if;
  -- Freeze both possible historical sources while reconciling the active reader.
  lock table public.homecare_inventory_movements in share mode;
  for material in select * from public.homecare_materials where tenant_id=p_tenant order by id for update loop
    if material.record_data ? 'inventoryEntries' then
      entries:=material.record_data->'inventoryEntries';
      if jsonb_typeof(entries)<>'array' then raise exception 'INVALID_LEGACY_ENTRIES: %',material.id; end if;
    else
      select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('id',m.id,'type',m.movement_type,'location',m.location_id,'createdAt',m.created_at)),'[]')
        into entries from public.homecare_inventory_movements m where m.tenant_id=p_tenant and m.material_id=material.id;
    end if;
    for entry in select value from jsonb_array_elements(entries) loop
      legacy_id:=entry->>'id'; location_name:=coalesce(nullif(entry->>'location',''),'Hauptlager');
      if nullif(legacy_id,'') is null then raise exception 'LEGACY_ID_MISSING: %',material.id; end if;
      select count(*),min(l.id) into matches,location_id from public.homecare_inventory_locations l
        where l.tenant_id=p_tenant and (l.id=location_name or l.name=location_name);
      if matches<>1 then raise exception 'LEGACY_LOCATION_RECONCILIATION_REQUIRED: % (% matches)',location_name,matches; end if;
      signed:=(entry->>'quantity')::numeric;
      if signed is null or signed::text in('NaN','Infinity','-Infinity') or signed<>round(signed,3) then raise exception 'INVALID_LEGACY_QUANTITY'; end if;
      if entry->>'type'='Ausgang' then signed:=-abs(signed);
      elsif entry->>'type'='Eingang' then signed:=abs(signed);
      elsif entry->>'type' not in('Korrektur','Inventur') then raise exception 'INVALID_LEGACY_TYPE'; end if;
      entry_date:=nullif(entry->>'createdAt','')::timestamptz;
      if entry_date is null then raise exception 'LEGACY_TIMESTAMP_MISSING'; end if;
      insert into public.homecare_legacy_stock_entries(tenant_id,material_id,legacy_id,original,signed_quantity,location_id)
        values(p_tenant,material.id,legacy_id,entry,signed,location_id);
      -- Zero-delta counts remain in the documentary archive, not fake movements.
      if signed<>0 then
        insert into public.homecare_stock_movements(tenant_id,id,material_id,source_id,destination_id,quantity,note,actor_user_id,legacy_entry_id,occurred_at)
          values(p_tenant,md5(p_tenant::text||':'||material.id||':'||legacy_id)::uuid,material.id,
            case when signed<0 then location_id end,case when signed>0 then location_id end,abs(signed),
            coalesce(nullif(entry->>'note',''),'Legacy import: '||legacy_id),null,legacy_id,entry_date);
      end if;
      imported:=imported+1;
    end loop;
  end loop;
  if exists(
    select 1 from (select e.material_id,e.location_id,sum(e.signed_quantity) qty from public.homecare_legacy_stock_entries e where e.tenant_id=p_tenant group by e.material_id,e.location_id) legacy
    full join (select movements.material_id,movements.location_id,sum(movements.delta) qty from (
      select material_id,destination_id location_id,quantity delta from public.homecare_stock_movements where tenant_id=p_tenant and destination_id is not null
      union all select material_id,source_id,-quantity from public.homecare_stock_movements where tenant_id=p_tenant and source_id is not null
    ) movements group by movements.material_id,movements.location_id) journal using(material_id,location_id)
    where coalesce(legacy.qty,0)<>coalesce(journal.qty,0)
  ) then raise exception 'LEGACY_STOCK_TOTAL_MISMATCH'; end if;
  insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values(p_tenant,imported);
  return jsonb_build_object('imported',imported,'verified',true);
end $$;
revoke all on function public.homecare_import_legacy_stock(uuid) from public,anon,authenticated;
grant execute on function public.homecare_import_legacy_stock(uuid) to service_role;

create or replace function public.homecare_guard_legacy_stock_edit()
returns trigger language plpgsql set search_path=public as $$ begin
  if exists(select 1 from public.homecare_stock_cutovers where tenant_id=new.tenant_id) then
    if tg_op='INSERT' then
      if coalesce(new.record_data->'inventoryEntries','[]')<>'[]'::jsonb then raise exception 'LEGACY_STOCK_WRITES_RETIRED' using errcode='23514'; end if;
    elsif coalesce(new.record_data->'inventoryEntries','[]') is distinct from coalesce(old.record_data->'inventoryEntries','[]') then
      raise exception 'LEGACY_STOCK_WRITES_RETIRED' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_legacy_stock_edit on public.homecare_materials;
create trigger guard_legacy_stock_edit before insert or update on public.homecare_materials for each row execute function public.homecare_guard_legacy_stock_edit();
create or replace function public.homecare_guard_legacy_movement_write()
returns trigger language plpgsql set search_path=public as $$
declare tenant uuid;
begin
  tenant:=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
  if exists(select 1 from public.homecare_stock_cutovers where tenant_id=tenant) then raise exception 'LEGACY_STOCK_WRITES_RETIRED' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists guard_legacy_movement_write on public.homecare_inventory_movements;
create trigger guard_legacy_movement_write before insert or update or delete on public.homecare_inventory_movements for each row execute function public.homecare_guard_legacy_movement_write();

create or replace function public.homecare_stock_balances(p_tenant uuid,p_material text)
returns table(location_id text,quantity numeric) language sql stable security invoker set search_path=public as $$
  select location_id,sum(delta) from (
    select destination_id location_id,quantity delta from public.homecare_stock_movements where tenant_id=p_tenant and material_id=p_material and destination_id is not null
    union all select source_id,-quantity from public.homecare_stock_movements where tenant_id=p_tenant and material_id=p_material and source_id is not null
  ) movements group by location_id order by location_id
$$;
revoke all on function public.homecare_stock_balances(uuid,text) from public,anon;
grant execute on function public.homecare_stock_balances(uuid,text) to authenticated,service_role;
create or replace function public.homecare_stock_summary()
returns table(material_id text,location_id text,quantity numeric) language sql stable security invoker set search_path=public as $$
  select entries.material_id,entries.location_id,sum(entries.delta) from (
    select m.material_id,m.destination_id location_id,m.quantity delta from public.homecare_stock_movements m
      join public.homecare_stock_cutovers c on c.tenant_id=m.tenant_id where m.destination_id is not null
    union all select m.material_id,m.source_id,-m.quantity from public.homecare_stock_movements m
      join public.homecare_stock_cutovers c on c.tenant_id=m.tenant_id where m.source_id is not null
  ) entries group by entries.material_id,entries.location_id order by entries.material_id,entries.location_id
$$;
revoke all on function public.homecare_stock_summary() from public,anon;
grant execute on function public.homecare_stock_summary() to authenticated,service_role;
commit;
