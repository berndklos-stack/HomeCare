begin;
do $$ begin
  if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','stock@example.invalid');
insert into public.homecare_inventory_locations(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','stock-root','Warehouse');
insert into public.homecare_materials(tenant_id,id,name,unit,sales_price,tax_rate,accounting_account) values('00000000-0000-0000-0000-000000000001','stock-material','Material','Meter',40,25,'3058');
insert into public.homecare_objects(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','stock-object','Object');
insert into public.homecare_jobs(tenant_id,id,title,object_id,status,billable) values('00000000-0000-0000-0000-000000000001','stock-job','Job','stock-object','in Arbeit',true);
select public.homecare_stock_post('00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','stock-material',null,'stock-root',20,'11111111-1111-4111-8111-111111111111','Receipt');
do $$ declare movement public.homecare_stock_movements%rowtype; status_value text;
begin
  movement:=public.homecare_stock_post('00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','stock-material','stock-root',null,2.5,'11111111-1111-4111-8111-111111111111','Job stock','stock-job');
  if movement.billing_data->>'price'<>'40.00' or movement.billing_data->>'materialId'<>'stock-material' then raise exception 'BILLING_SNAPSHOT_MISSING: %',movement.billing_data; end if;
  perform public.homecare_stock_post('00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','stock-material','stock-root',null,2.5,'11111111-1111-4111-8111-111111111111','Job stock','stock-job');
  if (select count(*) from public.homecare_stock_movements where job_id='stock-job')<>1 then raise exception 'RETRY_DUPLICATED_BILLING'; end if;
  update public.homecare_materials set sales_price=90 where id='stock-material';
  movement:=public.homecare_stock_post('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'stock-material',null,'stock-root',0.5,'11111111-1111-4111-8111-111111111111','Correction [bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb]: return','stock-job');
  if movement.billing_data->>'price'<>'40.00' or movement.billing_source_id is null then raise exception 'RETURN_PRICE_CHANGED'; end if;
  begin
    perform public.homecare_stock_post('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'stock-material',null,'stock-root',2.1,'11111111-1111-4111-8111-111111111111','Correction [bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb]: too much','stock-job');
    raise exception 'EXCESS_RETURN_ACCEPTED';
  exception when check_violation then if sqlerrm<>'JOB_RETURN_EXCEEDS_CONSUMPTION' then raise; end if; end;
  foreach status_value in array array['erledigt','abgerechnet','storniert','offerte'] loop
    update public.homecare_jobs set status=status_value where id='stock-job';
    begin
      perform public.homecare_stock_post('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'stock-material','stock-root',null,1,'11111111-1111-4111-8111-111111111111','Denied','stock-job');
      raise exception 'CLOSED_JOB_ACCEPTED';
    exception when check_violation then if sqlerrm<>'JOB_NOT_OPEN' then raise; end if; end;
  end loop;
  begin
    perform public.homecare_stock_post('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'stock-material','stock-root',null,1,'11111111-1111-4111-8111-111111111111','Object',null,'stock-object');
    raise exception 'OBJECT_BOOKING_ACCEPTED';
  exception when check_violation then if sqlerrm<>'OBJECT_NOT_BOOKABLE' then raise; end if; end;
  begin
    perform public.homecare_stock_post('00000000-0000-0000-0000-000000000002',gen_random_uuid(),'stock-material','stock-root',null,1,'11111111-1111-4111-8111-111111111111','Foreign','stock-job');
    raise exception 'FOREIGN_BOOKING_ACCEPTED';
  exception when check_violation then null; end;
end $$;
insert into public.homecare_inventory_locations(tenant_id,id,name,location_kind) values
 ('00000000-0000-0000-0000-000000000001','pick-place','Picking place','warehouse'),
 ('00000000-0000-0000-0000-000000000001','pick-vehicle','Vehicle','vehicle');
update public.homecare_jobs set status='in Arbeit',material_items='[{"materialId":"stock-material","quantity":"5"}]' where id='stock-job';
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:='11111111-1111-4111-8111-111111111111';
  picking uuid:=gen_random_uuid(); posting uuid:=gen_random_uuid(); dispatch uuid:=gen_random_uuid(); pickup uuid; rev integer; before_count integer;
begin
  perform public.homecare_create_picking_order(tenant,picking,'stock-job',(select revision from public.homecare_jobs where id='stock-job'),actor);
  if (select quantity from public.homecare_picking_items where order_id=picking)<>3 then raise exception 'PICKING_REMAINDER_WRONG'; end if;
  rev:=public.homecare_pick_material(tenant,posting,picking,1,'stock-material','stock-root','pick-place',3,actor);
  if (select count(*) from public.homecare_stock_movements where job_id='stock-job' and billing_data is not null)<>2 then raise exception 'STAGING_BILLED_EARLY'; end if;
  select pickup_code into pickup from public.homecare_picking_orders where id=picking;
  if pickup is null then raise exception 'PICKUP_CODE_MISSING'; end if;
  perform public.homecare_pick_material(tenant,posting,picking,1,'stock-material','stock-root','pick-place',3,actor);
  begin
    perform public.homecare_stock_post(tenant,gen_random_uuid(),'stock-material','pick-place',null,1,actor,'Steal reserved');
    raise exception 'RESERVED_STOCK_REMOVED';
  exception when others then if sqlerrm<>'PICKING_STOCK_RESERVED' then raise; end if; end;
  begin
    perform public.homecare_dispatch_picking(tenant,gen_random_uuid(),picking,rev,null,actor,gen_random_uuid());
    raise exception 'INVALID_PICKUP_ACCEPTED';
  exception when others then if sqlerrm<>'PICKING_INVALID_PICKUP' then raise; end if; end;
  rev:=public.homecare_dispatch_picking(tenant,dispatch,picking,rev,'pick-vehicle',actor,pickup);
  if (select status from public.homecare_picking_orders where id=picking)<>'loaded' then raise exception 'VEHICLE_LOADING_FAILED'; end if;
  select count(*) into before_count from public.homecare_stock_movements;
  perform public.homecare_dispatch_picking(tenant,dispatch,picking,rev-1,'pick-vehicle',actor,pickup);
  if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'DISPATCH_RETRY_DUPLICATED'; end if;
  update public.homecare_jobs set status='erledigt' where id='stock-job';
  begin
    perform public.homecare_dispatch_picking(tenant,gen_random_uuid(),picking,rev,null,actor,pickup);
    raise exception 'CLOSED_PICKUP_ACCEPTED';
  exception when others then if sqlerrm<>'JOB_NOT_OPEN' then raise; end if; end;
  update public.homecare_jobs set status='in Arbeit' where id='stock-job';
  perform public.homecare_dispatch_picking(tenant,gen_random_uuid(),picking,rev,null,actor,pickup);
  if (select status from public.homecare_picking_orders where id=picking)<>'dispatched' then raise exception 'PICKUP_NOT_COMPLETED'; end if;
  if (select sum(case when source_id is not null then quantity else -quantity end) from public.homecare_stock_movements where job_id='stock-job' and billing_data is not null)<>5 then raise exception 'PICKUP_BILLING_WRONG'; end if;
end $$;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0) on conflict do nothing;
insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values('00000000-0000-0000-0000-000000000001','22222222-2222-4222-8222-222222222222','TEST-SCAN','Supplier');
insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,order_date,status,currency,location_id) values('00000000-0000-0000-0000-000000000001','33333333-3333-4333-8333-333333333333','TEST-SCAN-ORDER','22222222-2222-4222-8222-222222222222',current_date,'draft','SEK','stock-root');
insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price) values('00000000-0000-0000-0000-000000000001','44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','stock-material',7,10);
update public.homecare_purchase_orders set status='ordered' where id='33333333-3333-4333-8333-333333333333';
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:='11111111-1111-4111-8111-111111111111'; receipt uuid:=gen_random_uuid(); payload jsonb; before_count integer;
begin
 payload:=jsonb_build_object('supplier_id','22222222-2222-4222-8222-222222222222','delivery_number','LS-001','location_id','stock-root','order_id',null,'revision',null,'items',jsonb_build_array(jsonb_build_object('material_id','stock-material','quantity',2)));
 perform public.homecare_scan_goods_receipt(tenant,receipt,actor,payload);
 select count(*) into before_count from public.homecare_stock_movements;
 perform public.homecare_scan_goods_receipt(tenant,receipt,actor,payload);
 if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'GOODS_RETRY_DUPLICATED'; end if;
 begin
  perform public.homecare_scan_goods_receipt(tenant,gen_random_uuid(),actor,payload);
  raise exception 'DUPLICATE_DELIVERY_ACCEPTED';
 exception when unique_violation then null; end;
 if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'DUPLICATE_LEFT_STOCK'; end if;
 payload:=jsonb_set(payload,'{delivery_number}','"LS-INVALID"');
 payload:=jsonb_set(payload,'{items}','[{"material_id":"stock-material","quantity":1},{"material_id":"unknown-material","quantity":1}]');
 begin
  perform public.homecare_scan_goods_receipt(tenant,gen_random_uuid(),actor,payload);
  raise exception 'INVALID_BATCH_ACCEPTED';
 exception when check_violation then if sqlerrm<>'MATERIAL_NOT_ACTIVE' then raise; end if; end;
 if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'PARTIAL_GOODS_COMMIT'; end if;
 payload:=jsonb_build_object('supplier_id','22222222-2222-4222-8222-222222222222','delivery_number','LS-ORDER','location_id','stock-root','order_id','33333333-3333-4333-8333-333333333333','revision',(select revision from public.homecare_purchase_orders where order_number='TEST-SCAN-ORDER'),'items',jsonb_build_array(jsonb_build_object('material_id','stock-material','item_id','44444444-4444-4444-8444-444444444444','quantity',7)));
 perform public.homecare_scan_goods_receipt(tenant,gen_random_uuid(),actor,payload);
 if (select status from public.homecare_purchase_orders where order_number='TEST-SCAN-ORDER')<>'received' then raise exception 'ORDER_NOT_RECEIVED'; end if;
 if (select sum(quantity) from public.homecare_purchase_receipts where item_id='44444444-4444-4444-8444-444444444444')<>7 then raise exception 'ORDER_RECEIPT_QUANTITY_WRONG'; end if;
end $$;
rollback;
