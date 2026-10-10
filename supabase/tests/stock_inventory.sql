begin;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0) on conflict do nothing;
do $$ declare
  tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:=gen_random_uuid(); inventory uuid:=gen_random_uuid(); items jsonb; before_count bigint;
begin
  if has_function_privilege('authenticated','public.homecare_post_inventory(uuid,uuid,text,uuid,text,jsonb)','execute') then raise exception 'UNTRUSTED_RPC_ACCESS'; end if;
  perform public.homecare_stock_post(tenant,gen_random_uuid(),'material',null,'warehouse',10,actor,'Initial');
  items:='[{"material_id":"material","expected":10,"counted":7}]';
  perform public.homecare_post_inventory(tenant,inventory,'warehouse',actor,'Count',items);
  if (select quantity from public.homecare_stock_balances(tenant,'material') where location_id='warehouse')<>7 then raise exception 'WRONG_COUNT_BALANCE'; end if;
  if (select counted_quantity from public.homecare_stock_inventory_items where tenant_id=tenant and inventory_id=inventory)<>7 then raise exception 'MISSING_COUNT_AUDIT'; end if;
  select count(*) into before_count from public.homecare_stock_movements;
  perform public.homecare_post_inventory(tenant,inventory,'warehouse',actor,'Count',items);
  if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'RETRY_DUPLICATED'; end if;
  begin
    perform public.homecare_post_inventory(tenant,inventory,'warehouse',actor,'Other',items);
    raise exception 'ID_REUSE_ACCEPTED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_post_inventory(tenant,gen_random_uuid(),'warehouse',actor,'Stale',items);
    raise exception 'STALE_STOCK_ACCEPTED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_post_inventory(tenant,gen_random_uuid(),'foreign',actor,'Foreign',items);
    raise exception 'FOREIGN_LOCATION_ACCEPTED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_post_inventory(tenant,gen_random_uuid(),'warehouse',actor,'Duplicate',items||items);
    raise exception 'DUPLICATE_ACCEPTED';
  exception when invalid_parameter_value then null; end;
  perform public.homecare_post_inventory(tenant,gen_random_uuid(),'warehouse',actor,'Unchanged','[{"material_id":"material","expected":7,"counted":7}]');
  if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'ZERO_MOVEMENT'; end if;
  perform public.homecare_post_inventory(tenant,gen_random_uuid(),'warehouse',actor,'More','[{"material_id":"material","expected":7,"counted":12}]');
  if (select quantity from public.homecare_stock_balances(tenant,'material') where location_id='warehouse')<>12 then raise exception 'WRONG_INCREASE'; end if;
end $$;
rollback;
