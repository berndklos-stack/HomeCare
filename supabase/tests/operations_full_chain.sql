begin;
do $$ begin
  if current_database() <> 'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','test@example.invalid');
insert into public.homecare_tenants(id,slug,name) values('00000000-0000-0000-0000-000000000002','test-b','Test B');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
  ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000001','operations-test','Operations test',array['data.read','data.write','backups.manage','resources.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values
  ('00000000-0000-0000-0000-000000000001','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
insert into public.homecare_inventory_locations(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','warehouse','Warehouse');
insert into public.homecare_materials(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','material','Material');
insert into public.homecare_resources(tenant_id,id,name,type) values('00000000-0000-0000-0000-000000000001','resource','Vehicle','Fahrzeug');
update public.homecare_resources set resource_type_id='00000000-0000-4000-8000-000000000001',serial_number='BACKUP-SN',operating_hours=123,
 operating_hours_date='2026-10-08',maintenance_interval_value=200,maintenance_interval_unit='hours' where id='resource';
update public.homecare_inventory_locations set resource_id='resource' where id='warehouse';
insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values
  ('00000000-0000-0000-0000-000000000001','33333333-3333-4333-8333-333333333333','S-1','Supplier A'),
  ('00000000-0000-0000-0000-000000000002','44444444-4444-4444-8444-444444444444','S-2','Supplier B');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.homecare_suppliers) <> 1 then raise exception 'RLS_TENANT_LEAK'; end if;
  begin
    perform public.homecare_create_relational_backup('00000000-0000-0000-0000-000000000002','denied');
    raise exception 'FOREIGN_BACKUP_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare
  mutation uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; result jsonb; repeated jsonb;
  command jsonb:='{"kind":"save","entity":"suppliers","values":{"company":"Updated supplier"}}';
begin
  result:=public.homecare_apply_operations_mutation(mutation,'operations','33333333-3333-4333-8333-333333333333','update','33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000001',command,1,'11111111-1111-4111-8111-111111111111');
  repeated:=public.homecare_apply_operations_mutation(mutation,'operations','33333333-3333-4333-8333-333333333333','update','33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000001',command,1,'11111111-1111-4111-8111-111111111111');
  if result->>'status'<>'synced' or result is distinct from repeated or (result#>>'{record,revision}')::bigint<>2 then raise exception 'CANONICAL_QUEUE_IDEMPOTENCY_FAILED'; end if;
  result:=public.homecare_apply_operations_mutation(gen_random_uuid(),'operations','33333333-3333-4333-8333-333333333333','update','33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000001',command,1,'11111111-1111-4111-8111-111111111111');
  if result->>'status'<>'conflict' then raise exception 'CANONICAL_REVISION_NOT_PROTECTED'; end if;
end $$;
select public.homecare_import_legacy_stock('00000000-0000-0000-0000-000000000001');
insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,location_id) values
  ('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555555','PO-1','33333333-3333-4333-8333-333333333333','warehouse');
insert into public.homecare_purchase_order_items(tenant_id,id,order_id,material_id,quantity,unit_price) values
  ('00000000-0000-0000-0000-000000000001','66666666-6666-4666-8666-666666666666','55555555-5555-4555-8555-555555555555','material',5,10);
update public.homecare_purchase_orders set status='ordered' where id='55555555-5555-4555-8555-555555555555';
select public.homecare_purchase_receive('00000000-0000-0000-0000-000000000001','77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666',5,
  (select revision from public.homecare_purchase_orders where id='55555555-5555-4555-8555-555555555555'),'11111111-1111-4111-8111-111111111111','Receipt');
insert into public.homecare_maintenance_plans(tenant_id,id,resource_id,name,maintenance_type,due_date) values
  ('00000000-0000-0000-0000-000000000001','88888888-8888-4888-8888-888888888888','resource','Inspection','inspection','2026-10-08');
select public.homecare_maintenance_complete('00000000-0000-0000-0000-000000000001','99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',1,'2026-10-08',100,10,50,'SEK',null,null,'11111111-1111-4111-8111-111111111111','Complete');
do $$ declare
  tenant uuid:='00000000-0000-0000-0000-000000000001'; backup_id uuid; table_name text; names text; original jsonb; restored jsonb;
begin
  backup_id:=(public.homecare_create_relational_backup(tenant,'roundtrip')->>'id')::uuid;
  select payload into original from public.homecare_relational_backups where id=backup_id;
  set constraints all immediate;
  select string_agg(format('public.%I',tbl),',') into names from unnest(public.homecare_relational_backup_tables()) tbl;
  -- Only this disposable test cluster. TRUNCATE bypasses immutable DELETE guards
  -- to simulate restoring a backup into a genuinely empty disaster-recovery target.
  execute 'truncate table '||names||' cascade';
  set constraints all deferred;
  perform public.homecare_restore_relational_backup(backup_id,tenant);
  foreach table_name in array public.homecare_relational_backup_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb) from public.%I row where tenant_id=$1',table_name) into restored using tenant;
    if restored is distinct from original->table_name then raise exception 'RESTORE_CONTENT_CHANGED: %',table_name; end if;
  end loop;
  if (select sum(quantity) from public.homecare_stock_movements where tenant_id=tenant)<>5 then raise exception 'RESTORE_STOCK_MISMATCH'; end if;
  begin
    update public.homecare_purchase_order_items set quantity=6 where tenant_id=tenant;
    raise exception 'RESTORE_RELAXED_PROTECTION';
  exception when check_violation then null; end;
end $$;
rollback;
