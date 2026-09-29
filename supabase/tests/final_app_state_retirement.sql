-- Run after 20260929130000_final_app_state_retirement.sql. Always rolls back.
begin;

insert into public.homecare_tenants(id,slug,name) values
  ('75000000-0000-0000-0000-000000000001','wave5-source','Wave 5 Source'),
  ('75000000-0000-0000-0000-000000000002','wave5-target','Wave 5 Target');

do $$ declare result jsonb; current_revision bigint; begin
  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000101','service','W5-SERVICE','create','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{"name":"Winterdienst","price":"100","archived":false}',null
  );
  if result->>'status'<>'synced' then raise exception 'W5_MASTER_CREATE_FAILED: %',result; end if;

  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000101','service','W5-SERVICE','create','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{}',null
  );
  if result->>'status'<>'synced' or (select count(*) from public.homecare_services where id='W5-SERVICE')<>1 then
    raise exception 'W5_MASTER_REPLAY_FAILED';
  end if;

  select service_row.revision into current_revision from public.homecare_services service_row where id='W5-SERVICE';
  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000102','service','W5-SERVICE','update','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{"name":"Winterdienst neu"}',current_revision
  );
  if result->>'status'<>'synced' then raise exception 'W5_MASTER_UPDATE_FAILED: %',result; end if;

  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000103','service','W5-SERVICE','update','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{"name":"Stale"}',current_revision
  );
  if result->>'status'<>'conflict' then raise exception 'W5_STALE_REVISION_ACCEPTED: %',result; end if;

  select service_row.revision into current_revision from public.homecare_services service_row where id='W5-SERVICE';
  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000104','service','W5-SERVICE','delete','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{}',current_revision
  );
  if result->>'status'<>'conflict' then raise exception 'W5_UNARCHIVED_DELETE_ALLOWED'; end if;

  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000105','service','W5-SERVICE','update','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{"archived":true}',current_revision
  );
  if result->>'status'<>'synced' then raise exception 'W5_MASTER_ARCHIVE_FAILED'; end if;
  select service_row.revision into current_revision from public.homecare_services service_row where id='W5-SERVICE';
  result:=public.homecare_apply_master_data_mutation(
    '75000000-0000-0000-0000-000000000106','service','W5-SERVICE','delete','W5-SERVICE',
    '75000000-0000-0000-0000-000000000001','{}',current_revision
  );
  if result->>'status'<>'synced' or not exists(select 1 from public.homecare_services where id='W5-SERVICE' and deleted_at is not null) then
    raise exception 'W5_MASTER_TOMBSTONE_FAILED';
  end if;
end $$;

insert into public.homecare_customers(id,tenant_id,name,revision) values
  ('W5-CUSTOMER','75000000-0000-0000-0000-000000000001','Restore customer',4);
insert into public.homecare_objects(id,tenant_id,owner_customer_id,name,revision) values
  ('W5-OBJECT','75000000-0000-0000-0000-000000000001','W5-CUSTOMER','Restore object',3);
insert into public.homecare_jobs(id,tenant_id,customer_id,object_id,title,status,revision) values
  ('W5-JOB','75000000-0000-0000-0000-000000000001','W5-CUSTOMER','W5-OBJECT','Restore job','erledigt',7);
insert into public.homecare_reports(id,tenant_id,job_id,object_id,title,revision) values
  ('W5-REPORT','75000000-0000-0000-0000-000000000001','W5-JOB','W5-OBJECT','Restore report',5);

do $$ declare result jsonb; stored_checksum text; calculated_checksum text; begin
  result:=public.homecare_create_relational_backup('75000000-0000-0000-0000-000000000001','coverage-test');
  select checksum,encode(extensions.digest(payload::text,'sha256'),'hex')
    into stored_checksum,calculated_checksum
    from public.homecare_relational_backups
    where id=(result->>'id')::uuid;
  if result->>'checksum' is null
    or stored_checksum is distinct from calculated_checksum
    or (result#>>'{manifest,homecare_customers,count}')::integer<>1
    or (result#>>'{manifest,homecare_sync_mutations,count}')::integer<1
    or (select count(*) from jsonb_object_keys(result->'manifest'))<>cardinality(public.homecare_relational_backup_tables()) then
    raise exception 'W5_RELATIONAL_BACKUP_COVERAGE_FAILED: %',result;
  end if;
end $$;

insert into public.homecare_relational_backups(id,tenant_id,reason,checksum,payload,manifest)
select
  '75000000-0000-0000-0000-000000000201',
  '75000000-0000-0000-0000-000000000001',
  'restore-rehearsal',
  'test-checksum',
  jsonb_build_object(
    'homecare_customers',(select jsonb_agg(to_jsonb(row)) from public.homecare_customers row where id='W5-CUSTOMER'),
    'homecare_objects',(select jsonb_agg(to_jsonb(row)) from public.homecare_objects row where id='W5-OBJECT'),
    'homecare_jobs',(select jsonb_agg(to_jsonb(row)) from public.homecare_jobs row where id='W5-JOB'),
    'homecare_reports',(select jsonb_agg(to_jsonb(row)) from public.homecare_reports row where id='W5-REPORT'),
    'homecare_services',(select jsonb_agg(to_jsonb(row)) from public.homecare_services row where id='W5-SERVICE')
  ),
  jsonb_build_object(
    'homecare_customers',jsonb_build_object('count',1),
    'homecare_objects',jsonb_build_object('count',1),
    'homecare_jobs',jsonb_build_object('count',1),
    'homecare_reports',jsonb_build_object('count',1),
    'homecare_services',jsonb_build_object('count',1)
  );

set local session_replication_role=replica;
delete from public.homecare_reports where id='W5-REPORT';
delete from public.homecare_jobs where id='W5-JOB';
delete from public.homecare_objects where id='W5-OBJECT';
delete from public.homecare_customers where id='W5-CUSTOMER';
delete from public.homecare_services where id='W5-SERVICE';
set local session_replication_role=origin;

do $$ declare result jsonb; begin
  result:=public.homecare_restore_relational_backup(
    '75000000-0000-0000-0000-000000000201','75000000-0000-0000-0000-000000000002'
  );
  if result->>'ok'<>'true' or (result->>'restoredRecords')::integer<>5 then raise exception 'W5_RESTORE_FAILED: %',result; end if;
  if not exists(select 1 from public.homecare_customers where id='W5-CUSTOMER' and tenant_id='75000000-0000-0000-0000-000000000002' and revision=4)
    or not exists(select 1 from public.homecare_objects where id='W5-OBJECT' and tenant_id='75000000-0000-0000-0000-000000000002' and owner_customer_id='W5-CUSTOMER' and revision=3)
    or not exists(select 1 from public.homecare_jobs where id='W5-JOB' and tenant_id='75000000-0000-0000-0000-000000000002' and customer_id='W5-CUSTOMER' and object_id='W5-OBJECT' and revision=7)
    or not exists(select 1 from public.homecare_reports where id='W5-REPORT' and tenant_id='75000000-0000-0000-0000-000000000002' and job_id='W5-JOB' and object_id='W5-OBJECT' and revision=5)
    or not exists(select 1 from public.homecare_services where id='W5-SERVICE' and tenant_id='75000000-0000-0000-0000-000000000002' and deleted_at is not null) then
    raise exception 'W5_RESTORE_ID_RELATION_REVISION_OR_TOMBSTONE_FAILED';
  end if;
  begin
    perform public.homecare_restore_relational_backup('75000000-0000-0000-0000-000000000201','75000000-0000-0000-0000-000000000002');
    raise exception 'W5_NONEMPTY_TARGET_ALLOWED';
  exception when check_violation then null; end;
end $$;

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values
  ('75000000-0000-0000-0000-000000000301','authenticated','authenticated','wave5@example.invalid','',now(),now());
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
  ('75000000-0000-0000-0000-000000000302','75000000-0000-0000-0000-000000000001','wave5','Wave 5',array['data.read','data.write','backups.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values
  ('75000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000301','75000000-0000-0000-0000-000000000302');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','75000000-0000-0000-0000-000000000301',true);
select set_config('request.headers','{"x-workcore-tenant":"75000000-0000-0000-0000-000000000001"}',true);
do $$ begin
  if has_table_privilege('app_state','select') then raise exception 'W5_APP_STATE_STILL_READABLE'; end if;
  if exists(select 1 from public.homecare_customers where tenant_id='75000000-0000-0000-0000-000000000002') then raise exception 'W5_RESTORE_CROSS_TENANT_LEAK'; end if;
  begin
    perform public.homecare_apply_master_data_mutation(
      '75000000-0000-0000-0000-000000000399','personnel','W5-CROSS','create','W5-CROSS',
      '75000000-0000-0000-0000-000000000002','{"firstName":"Forbidden"}',null
    );
    raise exception 'W5_CROSS_TENANT_MUTATION_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  if has_table_privilege('service_role','app_state','select') then raise exception 'W5_SERVICE_ROLE_APP_STATE_STILL_READABLE'; end if;
end $$;

rollback;
