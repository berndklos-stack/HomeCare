begin;
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; result jsonb; begin
  update public.homecare_materials set record_data='{"inventoryEntries":[{"id":"a","type":"Eingang","quantity":10,"location":"Warehouse","createdAt":"2026-10-01T10:00:00Z"},{"id":"b","type":"Ausgang","quantity":2,"location":"Warehouse","createdAt":"2026-10-02T10:00:00Z"},{"id":"c","type":"Inventur","quantity":-1,"countedQuantity":7,"location":"Warehouse","createdAt":"2026-10-03T10:00:00Z"},{"id":"d","type":"Inventur","quantity":0,"location":"Warehouse","createdAt":"2026-10-04T10:00:00Z"}]}' where tenant_id=tenant and id='material';
  -- Relational fallback is NOT double-counted when the active JSON reader exists.
  insert into public.homecare_inventory_movements(tenant_id,id,material_id,location_id,movement_type,quantity) values(tenant,'a','material','warehouse','Eingang',100);
  result:=public.homecare_import_legacy_stock(tenant);
  if result->>'imported'<>'4' then raise exception 'IMPORT_COUNT'; end if;
  if (select quantity from public.homecare_stock_balances(tenant,'material') where location_id='warehouse')<>7 then raise exception 'SIGNED_COUNT_LOST'; end if;
  if (select count(*) from public.homecare_legacy_stock_entries where tenant_id=tenant)<>4 then raise exception 'ZERO_HISTORY_LOST'; end if;
  if exists(select 1 from public.homecare_stock_movements where tenant_id=tenant and actor_user_id is not null) then raise exception 'ACTOR_INVENTED'; end if;
  perform public.homecare_import_legacy_stock(tenant);
  if (select count(*) from public.homecare_stock_movements where tenant_id=tenant)<>3 then raise exception 'IMPORT_DUPLICATED'; end if;
  begin
    update public.homecare_materials set record_data='{"inventoryEntries":[]}' where tenant_id=tenant and id='material';
    raise exception 'LEGACY_WRITE_ALLOWED';
  exception when check_violation then null; end;
end $$;
rollback;
begin;
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; begin
  update public.homecare_materials set record_data='{"inventoryEntries":[{"id":"a","type":"Eingang","quantity":1,"location":"Unknown","createdAt":"2026-10-01T10:00:00Z"}]}' where tenant_id=tenant;
  begin
    perform public.homecare_import_legacy_stock(tenant);
    raise exception 'UNKNOWN_LOCATION_GUESSED';
  exception when raise_exception then
    if sqlerrm not like 'LEGACY_LOCATION_RECONCILIATION_REQUIRED:%' then raise; end if;
  end;
  if exists(select 1 from public.homecare_stock_cutovers where tenant_id=tenant) or exists(select 1 from public.homecare_stock_movements where tenant_id=tenant) then raise exception 'PARTIAL_IMPORT'; end if;
end $$;
rollback;
