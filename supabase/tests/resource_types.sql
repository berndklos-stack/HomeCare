begin;
do $$ begin
 if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
do $$ declare snapshot record; field record; migrated jsonb; begin
 for snapshot in select * from public.resource_types_test_snapshot loop
  select to_jsonb(resource) into migrated from public.homecare_resources resource where id=snapshot.id;
  for field in select * from jsonb_each(snapshot.original) loop
   if migrated->field.key is distinct from field.value then raise exception 'MIGRATION_CHANGED_EXISTING_VALUE: %/%',snapshot.id,field.key; end if;
  end loop;
  if snapshot.id='migration-unknown' then
   if migrated->>'resource_type_id' is not null then raise exception 'UNKNOWN_TYPE_GUESSED'; end if;
  elsif migrated->>'resource_type_id' is null then raise exception 'LEGACY_TYPE_NOT_LINKED'; end if;
 end loop;
end $$;
do $$ declare
 tenant uuid:='00000000-0000-0000-0000-000000000001';
 v_type_id uuid:='77777777-7777-4777-8777-777777777777'; mutation uuid:=gen_random_uuid();
 config jsonb; result jsonb; repeated jsonb; resource_payload jsonb;
begin
 if (select count(*) from public.homecare_resource_types where tenant_id=tenant)<>7 then raise exception 'DEFAULT_TYPES_MISSING'; end if;
 if (select count(*) from public.homecare_resource_type_fields where tenant_id=tenant)<>238 then raise exception 'FIELD_CATALOG_INCOMPLETE'; end if;
 select jsonb_build_object('name','Eigener Mäher','category','machine','archived',false,'fields',jsonb_agg(jsonb_build_object(
  'key',field_key,'enabled',field_key in('name','operatingHours','serialNumber'),'required',field_key in('name','operatingHours'),'order',display_order))) into config
 from public.homecare_resource_type_fields where tenant_id=tenant and type_id='00000000-0000-4000-8000-000000000003';
 result:=public.homecare_apply_resource_type_mutation(mutation,'resource_type',v_type_id::text,'create',v_type_id::text,tenant,config,null);
 repeated:=public.homecare_apply_resource_type_mutation(mutation,'resource_type',v_type_id::text,'create',v_type_id::text,tenant,config,null);
 if result->>'status'<>'synced' or result is distinct from repeated then raise exception 'TYPE_RETRY_DUPLICATED'; end if;
 begin
  perform public.homecare_apply_resource_type_mutation(mutation,'resource_type',v_type_id::text,'create',v_type_id::text,tenant,config||'{"name":"Different"}',null);
  raise exception 'REUSED_ID_ACCEPTED';
 exception when others then if sqlerrm<>'MUTATION_ID_REUSED' then raise; end if; end;
 result:=public.homecare_apply_resource_type_mutation(gen_random_uuid(),'resource_type',v_type_id::text,'update',v_type_id::text,tenant,config,99);
 if result->>'status'<>'conflict' then raise exception 'TYPE_REVISION_NOT_PROTECTED'; end if;
 resource_payload:=jsonb_build_object('name','Mower','type','Maschine','resourceTypeId',v_type_id,'serialNumber','SN-1','operatingHours',0,'operatingHoursDate','2026-10-08','licensePlate','HIDDEN','notes','Retain me');
 mutation:=gen_random_uuid();
 result:=public.homecare_apply_resource_mutation(mutation,'resource','type-test','create','type-test',tenant,resource_payload,null);
 repeated:=public.homecare_apply_resource_mutation(mutation,'resource','type-test','create','type-test',tenant,resource_payload,null);
 if result->>'status'<>'synced' or result is distinct from repeated then raise exception 'RESOURCE_RETRY_DUPLICATED'; end if;
 if not exists(select 1 from public.homecare_resources where tenant_id=tenant and id='type-test' and resource_type_id=v_type_id and serial_number='SN-1' and operating_hours=0 and license_plate='HIDDEN' and revision=1) then raise exception 'RESOURCE_FIELDS_NOT_SAVED'; end if;
 begin
  perform public.homecare_apply_resource_mutation(gen_random_uuid(),'resource','invalid-mower','create','invalid-mower',tenant,resource_payload-'operatingHours',null);
  raise exception 'MISSING_REQUIRED_ACCEPTED';
 exception when check_violation then null; end;
 if exists(select 1 from public.homecare_resources where id='invalid-mower') then raise exception 'FAILED_CREATE_NOT_ATOMIC'; end if;
 begin
  perform public.homecare_apply_resource_type_mutation(gen_random_uuid(),'resource_type',v_type_id::text,'update',v_type_id::text,tenant,config||'{"category":"vehicle"}',1);
  raise exception 'ASSIGNED_CATEGORY_CHANGED';
 exception when check_violation then null; end;
 -- Legacy patches preserve type-specific columns, even after a new field becomes required.
 update public.homecare_resource_type_fields set enabled=true,required=true where tenant_id=tenant and type_id=v_type_id and field_key='identifier';
 result:=public.homecare_apply_resource_mutation(gen_random_uuid(),'resource','type-test','update','type-test',tenant,'{"name":"Updated"}',1);
 if result->>'status'<>'synced' or not exists(select 1 from public.homecare_resources where id='type-test' and serial_number='SN-1' and operating_hours=0 and license_plate='HIDDEN') then raise exception 'LEGACY_PATCH_LOST_FIELDS'; end if;
 begin
  perform public.homecare_apply_resource_mutation(gen_random_uuid(),'resource','type-test','update','type-test',tenant,'{"type":"Fahrzeug"}',2);
  raise exception 'LEGACY_TYPE_CHANGE_SILENTLY_OVERRIDDEN';
 exception when check_violation then null; end;
 perform public.homecare_seed_resource_types(tenant);
 if (select count(*) from public.homecare_resource_types where tenant_id=tenant)<>8 then raise exception 'SEED_DUPLICATED_TYPES'; end if;
 update public.homecare_resource_type_fields set display_order=999 where tenant_id=tenant and type_id='00000000-0000-4000-8000-000000000003' and field_key='serialNumber';
 perform public.homecare_seed_resource_types(tenant);
 if not exists(select 1 from public.homecare_resource_type_fields where tenant_id=tenant and type_id='00000000-0000-4000-8000-000000000003' and field_key='serialNumber' and display_order=999) then raise exception 'SEED_OVERWROTE_CONFIGURATION'; end if;
end $$;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','types@example.invalid');
insert into public.homecare_tenants(id,slug,name) values('00000000-0000-0000-0000-000000000002','types-test-b','Types B');
select public.homecare_seed_resource_types('00000000-0000-0000-0000-000000000002');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000001','types-reader','Types reader',array['data.read']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values
 ('00000000-0000-0000-0000-000000000001','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.homecare_resource_types)<>8 then raise exception 'TYPE_RLS_LEAK'; end if;
 if exists(select 1 from public.homecare_resource_type_fields where tenant_id<>'00000000-0000-0000-0000-000000000001') then raise exception 'FIELDS_RLS_LEAK'; end if;
 begin
  update public.homecare_resource_types set name='Forbidden';
  raise exception 'DIRECT_TYPE_WRITE_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_apply_resource_type_mutation(gen_random_uuid(),'resource_type','77777777-7777-4777-8777-777777777777','update',null,'00000000-0000-0000-0000-000000000001','{}',1);
  raise exception 'DIRECT_RPC_ALLOWED';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
