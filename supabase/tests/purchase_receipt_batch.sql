begin;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0) on conflict do nothing;
do $$ declare
  tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:=gen_random_uuid();
  supplier uuid:=gen_random_uuid(); purchase uuid:=gen_random_uuid(); a uuid:='11111111-1111-4111-8111-111111111111'; b uuid:='22222222-2222-4222-8222-222222222222';
  mutation uuid:=gen_random_uuid(); payload jsonb; response jsonb; repeated jsonb; rev bigint;
begin
  if has_function_privilege('authenticated','public.homecare_apply_purchase_receipt_batch(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','execute') then raise exception 'UNTRUSTED_RPC_ACCESS'; end if;
  insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values(tenant,supplier,'BATCH','Supplier');
  insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,location_id,currency)
    values(tenant,purchase,'BATCH',supplier,'warehouse','SEK');
  insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price)
    values(tenant,a,purchase,'material',10,5),(tenant,b,purchase,'material',20,6);
  update public.homecare_purchase_orders set status='ordered' where tenant_id=tenant and id=purchase returning revision into rev;
  insert into public.homecare_media(tenant_id,id,name,storage_path,metadata)
    values(tenant,'receipt-pdf','delivery.pdf',tenant::text||'/purchase-documents/delivery.pdf','{"contentType":"application/pdf"}');
  insert into public.homecare_media(tenant_id,id,name,storage_path,metadata)
    values('00000000-0000-0000-0000-000000000002','foreign-pdf','foreign.pdf','00000000-0000-0000-0000-000000000002/purchase-documents/foreign.pdf','{"contentType":"application/pdf"}');
  payload:=jsonb_build_object('kind','receive_batch','location_id','vehicle','note','Delivery','document_id','receipt-pdf',
    'items',jsonb_build_array(jsonb_build_object('item_id',a,'quantity',4),jsonb_build_object('item_id',b,'quantity',21)));
  begin
    perform public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,payload,rev,actor);
    raise exception 'OVERDELIVERY_ACCEPTED';
  exception when check_violation then null; end;
  if exists(select 1 from public.homecare_purchase_receipts where tenant_id=tenant and item_id in(a,b)) then raise exception 'PARTIAL_BATCH'; end if;
  if exists(select 1 from public.homecare_sync_mutations where tenant_id=tenant and mutation_id=mutation) then raise exception 'FAILED_BATCH_JOURNALED'; end if;
  payload:=jsonb_set(payload,'{items,1,quantity}','20');
  begin
    perform public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,jsonb_set(payload,'{document_id}','"foreign-pdf"'),rev,actor);
    raise exception 'FOREIGN_DOCUMENT_ACCEPTED';
  exception when check_violation then null; end;
  begin
    perform public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,jsonb_set(payload,'{location_id}','"foreign"'),rev,actor);
    raise exception 'FOREIGN_LOCATION_ACCEPTED';
  exception when check_violation then null; end;
  response:=public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,payload,rev,actor);
  if response->>'status'<>'synced' or response#>>'{record,status}'<>'partially_received' then raise exception 'BATCH_STATUS'; end if;
  if (select count(*) from public.homecare_purchase_receipts where tenant_id=tenant and item_id in(a,b) and document_id='receipt-pdf')<>2 then raise exception 'DOCUMENT_RELATION'; end if;
  if (select sum(quantity) from public.homecare_stock_movements where tenant_id=tenant and destination_id='vehicle')<>24 then raise exception 'DESTINATION_BALANCE'; end if;
  if (select location_id from public.homecare_purchase_orders where tenant_id=tenant and id=purchase)<>'warehouse' then raise exception 'HEADER_CHANGED'; end if;
  repeated:=public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,payload,rev,actor);
  if response<>repeated or (select count(*) from public.homecare_purchase_receipts where tenant_id=tenant and item_id in(a,b))<>2 then raise exception 'DUPLICATE_RETRY'; end if;
  begin
    perform public.homecare_apply_purchase_receipt_batch(mutation,'operations',purchase::text,'update',purchase::text,tenant,jsonb_set(payload,'{note}','"changed"'),rev,actor);
    raise exception 'REUSED_MUTATION_ACCEPTED';
  exception when check_violation then null; end;
  response:=public.homecare_apply_purchase_receipt_batch(gen_random_uuid(),'operations',purchase::text,'update',purchase::text,tenant,payload,rev,actor);
  if response->>'status'<>'conflict' then raise exception 'REVISION_PROTECTION'; end if;
  select revision into rev from public.homecare_purchase_orders where tenant_id=tenant and id=purchase;
  payload:=jsonb_set(payload,'{items}',jsonb_build_array(jsonb_build_object('item_id',a,'quantity',6)));
  response:=public.homecare_apply_purchase_receipt_batch(gen_random_uuid(),'operations',purchase::text,'update',purchase::text,tenant,payload,rev,actor);
  if response#>>'{record,status}'<>'received' then raise exception 'FINAL_RECEIPT_STATUS'; end if;
  response:=public.homecare_apply_purchase_receipt_batch(gen_random_uuid(),'operations',purchase::text,'update',purchase::text,'00000000-0000-0000-0000-000000000002',payload,rev,actor);
  if response->>'status'<>'conflict' then raise exception 'TENANT_ISOLATION'; end if;
end $$;
rollback;
