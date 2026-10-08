begin;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0);
do $$ declare
  tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:='00000000-0000-0000-0000-000000000009';
  supplier uuid:='11111111-1111-4111-8111-111111111111'; mutation uuid:='22222222-2222-4222-8222-222222222222';
  response jsonb; repeated jsonb;
begin
  response:=public.homecare_apply_operations_mutation(mutation,'operations',supplier::text,'create','supplier',tenant,
    jsonb_build_object('kind','save','entity','suppliers','values',jsonb_build_object('supplier_number','S-1','company','Supplier')),null,actor);
  if response->>'status'<>'synced' or response#>>'{record,company}'<>'Supplier' then raise exception 'SUPPLIER_CREATE'; end if;
  repeated:=public.homecare_apply_operations_mutation(mutation,'operations',supplier::text,'create','supplier',tenant,
    jsonb_build_object('kind','save','entity','suppliers','values',jsonb_build_object('supplier_number','S-1','company','Supplier')),null,actor);
  if repeated<>response then raise exception 'IDEMPOTENCY'; end if;
  begin
    perform public.homecare_apply_operations_mutation(mutation,'operations',supplier::text,'create','supplier',tenant,
      jsonb_build_object('kind','save','entity','suppliers','values',jsonb_build_object('supplier_number','S-1','company','Changed')),null,actor);
    raise exception 'MUTATED_ID_ACCEPTED';
  exception when check_violation then null; end;
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',supplier::text,'update','supplier',tenant,
    '{"kind":"save","entity":"suppliers","values":{"phone":"123"}}',1,actor);
  if response#>>'{record,revision}'<>'2' then raise exception 'SUPPLIER_REVISION'; end if;
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',supplier::text,'update','supplier',tenant,
    '{"kind":"save","entity":"suppliers","values":{"company":"Lost update"}}',1,actor);
  if response->>'status'<>'conflict' then raise exception 'REVISION_PROTECTION'; end if;
  if (select company from public.homecare_suppliers where tenant_id=tenant and id=supplier)<>'Supplier' then raise exception 'OVERWRITE'; end if;
  begin
    perform public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',supplier::text,'update','supplier',tenant,
      '{"kind":"save","entity":"suppliers","values":{"tenant_id":"00000000-0000-0000-0000-000000000002"}}',2,actor);
    raise exception 'UNSAFE_COLUMN_ACCEPTED';
  exception when invalid_parameter_value then null; end;
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',supplier::text,'delete','supplier',tenant,
    '{"kind":"archive","entity":"suppliers"}',2,actor);
  if response#>>'{record,deleted_at}' is null then raise exception 'ARCHIVE'; end if;
end $$;

-- A failed maintenance consumption rolls back the completion and next due date.
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; plan uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); response jsonb;
begin
  insert into public.homecare_maintenance_plans(tenant_id,id,resource_id,name,maintenance_type,due_date,interval_days)
    values(tenant,plan,'resource','Service','service','2026-10-07',30);
  begin
    perform public.homecare_apply_operations_mutation(m,'operations',plan::text,'update','resource',tenant,
      '{"kind":"complete","completed_date":"2026-10-07","mileage":null,"operating_hours":null,"cost":20,"currency":"SEK","supplier_id":null,"document_id":null,"notes":"Service","materials":[{"material_id":"material","location_id":"warehouse","quantity":1}]}',1,actor);
    raise exception 'INSUFFICIENT_STOCK_ACCEPTED';
  exception when check_violation then null; end;
  if exists(select 1 from public.homecare_maintenance_events where tenant_id=tenant and plan_id=plan) then raise exception 'PARTIAL_COMPLETION'; end if;
  if (select revision from public.homecare_maintenance_plans where tenant_id=tenant and id=plan)<>1 then raise exception 'PARTIAL_PLAN_CHANGE'; end if;
  perform public.homecare_stock_post(tenant,gen_random_uuid(),'material',null,'warehouse',2,actor,'Receipt');
  response:=public.homecare_apply_operations_mutation(m,'operations',plan::text,'update','resource',tenant,
    '{"kind":"complete","completed_date":"2026-10-07","mileage":null,"operating_hours":null,"cost":20,"currency":"SEK","supplier_id":null,"document_id":null,"notes":"Service","materials":[{"material_id":"material","location_id":"warehouse","quantity":1}]}',1,actor);
  if response->>'status'<>'synced' then raise exception 'COMPLETION_FAILED'; end if;
  if (response#>>'{record,material_records,0,stockTotal}')::numeric<>1
    or (response#>>'{record,material_records,0,stockByLocation,Warehouse}')::numeric<>1 then raise exception 'CONSUMPTION_BALANCE_NOT_RETURNED'; end if;
  if (select count(*) from public.homecare_stock_movements where tenant_id=tenant and maintenance_event_id=m)<>1 then raise exception 'CONSUMPTION_NOT_LINKED'; end if;
  perform public.homecare_apply_operations_mutation(m,'operations',plan::text,'update','resource',tenant,
    '{"kind":"complete","completed_date":"2026-10-07","mileage":null,"operating_hours":null,"cost":20,"currency":"SEK","supplier_id":null,"document_id":null,"notes":"Service","materials":[{"material_id":"material","location_id":"warehouse","quantity":1}]}',1,actor);
  if (select count(*) from public.homecare_stock_movements where tenant_id=tenant and maintenance_event_id=m)<>1 then raise exception 'DUPLICATE_CONSUMPTION'; end if;
end $$;
rollback;
begin;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0);
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:=gen_random_uuid(); response jsonb; begin
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations','receipt-event','create','material',tenant,
    '{"kind":"stock","material_id":"material","source_id":null,"destination_id":"warehouse","quantity":2,"note":"Receipt"}',null,actor);
  if (response#>>'{record,material_record,stockTotal}')::numeric<>2 or (response#>>'{record,material_record,stockByLocation,Warehouse}')::numeric<>2 then raise exception 'RECEIPT_BALANCE_NOT_RETURNED'; end if;
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations','transfer-event','create','material',tenant,
    '{"kind":"stock","material_id":"material","source_id":"warehouse","destination_id":"vehicle","quantity":1,"note":"Transfer"}',null,actor);
  if (response#>>'{record,material_record,stockTotal}')::numeric<>2
    or (response#>>'{record,material_record,stockByLocation,Warehouse}')::numeric<>1
    or (response#>>'{record,material_record,stockByLocation,Vehicle}')::numeric<>1 then raise exception 'TRANSFER_BALANCE_NOT_RETURNED'; end if;
end $$;
rollback;
begin;
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:=gen_random_uuid(); plan uuid:=gen_random_uuid(); response jsonb; rev bigint;
begin
  insert into public.homecare_maintenance_plans(tenant_id,id,resource_id,name,maintenance_type,due_date)
    values(tenant,plan,'resource','Inspection','inspection','2026-10-08');
  insert into public.homecare_vehicle_trips(tenant_id,id,resource_id,status) values(tenant,'active-trip','resource','laufend');
  begin
    perform public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',plan::text,'update','resource',tenant,'{"kind":"start","resource_revision":1}',1,actor);
    raise exception 'ACTIVE_TRIP_INTERRUPTED';
  exception when check_violation then null; end;
  if (select in_progress from public.homecare_maintenance_plans where tenant_id=tenant and id=plan) then raise exception 'PARTIAL_START'; end if;
  update public.homecare_vehicle_trips set status='abgeschlossen' where tenant_id=tenant and id='active-trip';
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',plan::text,'update','resource',tenant,'{"kind":"start","resource_revision":1}',1,actor);
  if response->>'status'<>'synced' or (select availability from public.homecare_resources where tenant_id=tenant and id='resource')<>'maintenance' then raise exception 'START_AVAILABILITY'; end if;
  select revision into rev from public.homecare_maintenance_plans where tenant_id=tenant and id=plan;
  response:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',plan::text,'update','resource',tenant,
    '{"kind":"complete","completed_date":"2026-10-08","mileage":null,"operating_hours":120,"cost":20,"currency":"SEK","supplier_id":null,"document_id":null,"notes":"Complete","materials":[]}',rev,actor);
  if response->>'status'<>'synced' or (select availability from public.homecare_resources where tenant_id=tenant and id='resource')<>'available'
    or (select operating_hours from public.homecare_resources where tenant_id=tenant and id='resource')<>120 then raise exception 'COMPLETE_AVAILABILITY'; end if;
end $$;
rollback;
