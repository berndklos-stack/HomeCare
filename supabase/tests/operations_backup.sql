begin;
do $$ declare tables text[]:=public.homecare_relational_backup_tables(); begin
  if not array['homecare_suppliers','homecare_purchase_orders','homecare_purchase_order_items','homecare_purchase_receipts',
    'homecare_resource_assignments','homecare_maintenance_plans','homecare_maintenance_events','homecare_legacy_stock_entries','homecare_stock_movements','homecare_stock_cutovers'] <@ tables then
    raise exception 'BACKUP_TABLES_MISSING'; end if;
  if array_position(tables,'homecare_suppliers')>array_position(tables,'homecare_materials') or
    array_position(tables,'homecare_purchase_receipts')>array_position(tables,'homecare_stock_movements') then raise exception 'BACKUP_FK_ORDER'; end if;
end $$;
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; supplier uuid:=gen_random_uuid(); purchase uuid:=gen_random_uuid(); begin
  insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values(tenant,supplier,'restore','Restored supplier');
  insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,status,location_id) values(tenant,purchase,'restored-order',supplier,'received','warehouse');
  begin
    insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price) values(tenant,gen_random_uuid(),purchase,'material',1,10);
    raise exception 'ORDERED_ITEM_WRITE_ALLOWED';
  exception when check_violation then null; end;
  perform set_config('workcore.operations_restore','1',true);
  insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price) values(tenant,gen_random_uuid(),purchase,'material',1,10);
  perform set_config('workcore.operations_restore','',true);
  begin
    update public.homecare_purchase_order_items set quantity=2 where tenant_id=tenant and order_id=purchase;
    raise exception 'RESTORE_DISABLED_ITEM_PROTECTION';
  exception when check_violation then null; end;
end $$;
rollback;
