do $$ begin
  if current_database() <> 'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
begin;
insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','001','Test supplier'),
  ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','001','Foreign supplier');
insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,location_id,status,job_id) values
  ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PO-001','10000000-0000-0000-0000-000000000001','warehouse','draft','job');
insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price) values
  ('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','material',10,12.50);
update public.homecare_purchase_orders set status='ordered' where id='20000000-0000-0000-0000-000000000001';
-- A draft transition increments revision; receipt expectations start at its actual revision.

do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:='00000000-0000-0000-0000-000000000099'; amount numeric; rev bigint;
begin
  select revision into rev from public.homecare_purchase_orders where tenant_id=tenant;
  begin
    update public.homecare_purchase_order_items set quantity=20 where tenant_id=tenant;
    raise exception 'ORDERED_ITEM_CHANGE_ALLOWED';
  exception when check_violation then null; end;
  perform public.homecare_purchase_receive(tenant,'40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',4,rev,actor,'Partial delivery');
  if (select status from public.homecare_purchase_orders where tenant_id=tenant) <> 'partially_received' then raise exception 'PARTIAL_STATUS'; end if;
  perform public.homecare_purchase_receive(tenant,'40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',4,1,actor,'Partial delivery');
  if (select count(*) from public.homecare_stock_movements where tenant_id=tenant) <> 1 then raise exception 'DUPLICATE_RECEIPT'; end if;
  begin
    perform public.homecare_purchase_receive(tenant,'40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',5,1,actor,'Partial delivery');
    raise exception 'REUSED_ID_NOT_BLOCKED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_purchase_receive(tenant,'40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',6,1,actor,'Final delivery');
    raise exception 'REVISION_NOT_PROTECTED';
  exception when serialization_failure then null; end;
  select revision into rev from public.homecare_purchase_orders where tenant_id=tenant;
  perform public.homecare_purchase_receive(tenant,'40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',6,rev,actor,'Final delivery');
  if (select status from public.homecare_purchase_orders where tenant_id=tenant) <> 'received' then raise exception 'FINAL_STATUS'; end if;
  if (select purchase_price from public.homecare_materials where tenant_id=tenant and id='material') <> 12.50 then raise exception 'LAST_PRICE'; end if;
  perform public.homecare_stock_post(tenant,'50000000-0000-0000-0000-000000000001','material','warehouse','vehicle',3,actor,'Transfer');
  perform public.homecare_stock_post(tenant,'50000000-0000-0000-0000-000000000002','material','vehicle',null,2,actor,'Job issue','job');
  perform public.homecare_stock_post(tenant,'50000000-0000-0000-0000-000000000003','material',null,'vehicle',1,actor,'Return from job','job');
  select sum(case when destination_id is not null then quantity else 0 end)-sum(case when source_id is not null then quantity else 0 end) into amount from public.homecare_stock_movements where tenant_id=tenant;
  if amount <> 9 then raise exception 'INCORRECT_GLOBAL_STOCK: %',amount; end if;
  select sum(case when destination_id='vehicle' then quantity else 0 end)-sum(case when source_id='vehicle' then quantity else 0 end) into amount from public.homecare_stock_movements where tenant_id=tenant;
  if amount <> 2 then raise exception 'INCORRECT_LOCATION_STOCK'; end if;
  begin
    perform public.homecare_stock_post(tenant,gen_random_uuid(),'material','vehicle',null,3,actor,'Too much');
    raise exception 'NEGATIVE_STOCK_ALLOWED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_stock_post(tenant,gen_random_uuid(),'material',null,'foreign',1,actor,'Foreign location');
    raise exception 'CROSS_TENANT_LOCATION_ALLOWED';
  exception when foreign_key_violation then null; end;
  begin
    update public.homecare_stock_movements set quantity=99 where tenant_id=tenant;
    raise exception 'HISTORY_MUTABLE';
  exception when check_violation then null; end;
  begin
    insert into public.homecare_maintenance_plans(tenant_id,resource_id,name,maintenance_type,due_hours)
      values(tenant,'resource','Invalid hours','service','NaN'::numeric);
    raise exception 'NAN_MAINTENANCE_ALLOWED';
  exception when check_violation then null; end;
  begin
    insert into public.homecare_purchase_orders(tenant_id,order_number,supplier_id,location_id) values(tenant,'FOREIGN','10000000-0000-0000-0000-000000000002','warehouse');
    raise exception 'CROSS_TENANT_SUPPLIER_ALLOWED';
  exception when foreign_key_violation then null; end;
  update public.homecare_suppliers set notes='Edited',archived=true where tenant_id=tenant;
  if (select revision from public.homecare_suppliers where tenant_id=tenant) <> 2 then raise exception 'SUPPLIER_REVISION'; end if;
  insert into public.homecare_resource_assignments(tenant_id,resource_id,job_id) values(tenant,'resource','job');
  begin
    insert into public.homecare_resource_assignments(tenant_id,resource_id,job_id) values(tenant,'resource','job');
    raise exception 'RESOURCE_DOUBLE_ASSIGNMENT';
  exception when unique_violation then null; end;
  insert into public.homecare_maintenance_plans(tenant_id,id,resource_id,name,maintenance_type,due_date,due_mileage,interval_days,interval_mileage)
    values(tenant,'60000000-0000-0000-0000-000000000001','resource','Service','service','2026-10-07',10000,30,5000);
  begin
    perform public.homecare_maintenance_complete(tenant,gen_random_uuid(),'60000000-0000-0000-0000-000000000001',1,'2026-10-07',null,null,100,'SEK',null,null,actor,'Service');
    raise exception 'MISSING_READING_ALLOWED';
  exception when check_violation then null; end;
  insert into public.homecare_media(tenant_id,id,name) values
    ('00000000-0000-0000-0000-000000000002','foreign-document','Foreign'),
    (tenant,'deleted-document','Deleted');
  update public.homecare_media set deleted_at=now() where tenant_id=tenant and id='deleted-document';
  begin
    perform public.homecare_maintenance_complete(tenant,gen_random_uuid(),'60000000-0000-0000-0000-000000000001',1,'2026-10-07',10100,null,100,'SEK',null,'foreign-document',actor,'Service');
    raise exception 'FOREIGN_DOCUMENT_ALLOWED';
  exception when foreign_key_violation then null; end;
  begin
    perform public.homecare_maintenance_complete(tenant,gen_random_uuid(),'60000000-0000-0000-0000-000000000001',1,'2026-10-07',10100,null,100,'SEK',null,'deleted-document',actor,'Service');
    raise exception 'DELETED_DOCUMENT_ALLOWED';
  exception when foreign_key_violation then null; end;
  perform public.homecare_maintenance_complete(tenant,'70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',1,'2026-10-07',10100,null,100,'SEK',null,null,actor,'Service');
  perform public.homecare_maintenance_complete(tenant,'70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',1,'2026-10-07',10100,null,100,'SEK',null,null,actor,'Service');
  if (select count(*) from public.homecare_maintenance_events where tenant_id=tenant) <> 1 then raise exception 'DUPLICATE_MAINTENANCE'; end if;
  if not exists(select 1 from public.homecare_maintenance_plans where tenant_id=tenant and due_date='2026-11-06' and due_mileage=15100 and revision=2 and not completed) then raise exception 'NEXT_MAINTENANCE'; end if;
  if has_function_privilege('authenticated','public.homecare_stock_post(uuid,uuid,text,text,text,numeric,uuid,text,text,text,uuid,uuid,numeric)','execute') then raise exception 'UNAUTHORIZED_FUNCTION_EXECUTION'; end if;
end $$;

set local test.tenant='00000000-0000-0000-0000-000000000001';
set local test.permission='allowed';
set local role authenticated;
do $$ begin
  if (select count(*) from public.homecare_suppliers) <> 1 then raise exception 'TENANT_READ_ISOLATION'; end if;
  begin
    insert into public.homecare_suppliers(tenant_id,supplier_number,company) values('00000000-0000-0000-0000-000000000001','ILLEGAL','Unauthorized');
    raise exception 'DIRECT_WRITE_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local test.permission='denied';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.homecare_suppliers) then raise exception 'UNAUTHORIZED_READ_ALLOWED'; end if;
end $$;
reset role;
rollback;
