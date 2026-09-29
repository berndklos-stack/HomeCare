-- Run after 20260928220000_jobs_operations_relational_cutover.sql.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants(id,slug,name) values
  ('72000000-0000-0000-0000-000000000001','wave2-a','Wave 2 A'),
  ('72000000-0000-0000-0000-000000000002','wave2-b','Wave 2 B');
insert into public.homecare_customers(id,tenant_id,name) values
  ('W2-CUSTOMER-A','72000000-0000-0000-0000-000000000001','Customer A'),
  ('W2-CUSTOMER-B','72000000-0000-0000-0000-000000000002','Customer B');
insert into public.homecare_objects(id,tenant_id,owner_customer_id,name) values
  ('W2-OBJECT-A','72000000-0000-0000-0000-000000000001','W2-CUSTOMER-A','Object A'),
  ('W2-OBJECT-B','72000000-0000-0000-0000-000000000002','W2-CUSTOMER-B','Object B');

do $$
declare result jsonb;
begin
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000101','job','W2-JOB-A','create','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001',
    '{"title":"Offline Auftrag","objectId":"W2-OBJECT-A","customerId":"W2-CUSTOMER-A","status":"geplant","dueDate":"2026-10-01","schedule":{"type":"einmalig"}}',null
  );
  if result->>'status'<>'synced' or (result#>>'{record,revision}')::bigint<>1 then raise exception 'W2_JOB_CREATE_FAILED: %',result; end if;

  -- Replaying the same queued mutation is idempotent.
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000101','job','W2-JOB-A','create','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{}',null
  );
  if result->>'status'<>'synced' or (select count(*) from public.homecare_jobs where tenant_id='72000000-0000-0000-0000-000000000001' and id='W2-JOB-A')<>1 then raise exception 'W2_REPLAY_FAILED'; end if;

  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000102','job','W2-JOB-A','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"title":"Auf Gerät B geändert","status":"in Arbeit"}',1
  );
  if result->>'status'<>'synced' or (result#>>'{record,revision}')::bigint<>2 then raise exception 'W2_JOB_UPDATE_FAILED: %',result; end if;

  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000103','job','W2-JOB-A','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"title":"Veraltetes Gerät"}',1
  );
  if result->>'status'<>'conflict' or (select title from public.homecare_jobs where id='W2-JOB-A')<>'Auf Gerät B geändert' then raise exception 'W2_STALE_JOB_CONFLICT_FAILED: %',result; end if;
end $$;

do $$
declare result jsonb;
begin
  perform public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000110','job','W2-SERIES','create','W2-SERIES',
    '72000000-0000-0000-0000-000000000001',
    '{"title":"Serie","objectId":"W2-OBJECT-A","customerId":"W2-CUSTOMER-A","status":"geplant","dueDate":"2026-10-02","schedule":{"type":"serie","frequency":"wöchentlich"}}',null
  );
  perform public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000111','job','W2-OCC-1','create','W2-OCC-1',
    '72000000-0000-0000-0000-000000000001',
    '{"title":"Serie","objectId":"W2-OBJECT-A","customerId":"W2-CUSTOMER-A","seriesMasterId":"W2-SERIES","seriesOccurrenceDate":"2026-10-02","status":"geplant"}',null
  );
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000112','job','W2-OCC-DUP','create','W2-OCC-DUP',
    '72000000-0000-0000-0000-000000000001',
    '{"title":"Duplikat","objectId":"W2-OBJECT-A","customerId":"W2-CUSTOMER-A","seriesMasterId":"W2-SERIES","seriesOccurrenceDate":"2026-10-02","status":"geplant"}',null
  );
  if result->>'status'<>'conflict' then raise exception 'W2_RECURRENCE_DUPLICATE_ALLOWED: %',result; end if;
  if (select count(*) from public.homecare_jobs where tenant_id='72000000-0000-0000-0000-000000000001' and series_master_id='W2-SERIES' and series_occurrence_date='2026-10-02')<>1 then raise exception 'W2_RECURRENCE_COUNT_FAILED'; end if;
end $$;

do $$
declare result jsonb;
begin
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000120','field_progress','W2-JOB-A::2026-10-01:TASK-1','create','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001',
    '{"workDate":"2026-10-01","taskId":"TASK-1","completed":true,"minutes":"45","note":"vor Ort","photos":[{"id":"PHOTO-1","storagePath":"field/a.jpg"}]}',null
  );
  if result->>'status'<>'synced' then raise exception 'W2_PROGRESS_CREATE_FAILED: %',result; end if;
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000121','field_progress','W2-JOB-A::2026-10-01:TASK-1','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"minutes":"60"}',1
  );
  if result->>'status'<>'synced' or (select jsonb_array_length(photos) from public.homecare_field_progress where id='W2-JOB-A::2026-10-01:TASK-1')<>1 then raise exception 'W2_PROGRESS_UPDATE_LOST_DATA: %',result; end if;
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000122','field_progress','W2-JOB-A::2026-10-01:TASK-1','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"minutes":"5"}',1
  );
  if result->>'status'<>'conflict' then raise exception 'W2_PROGRESS_STALE_CONFLICT_FAILED'; end if;

  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000123','job_time_entry','W2-TIME-1','create','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"date":"2026-10-01","minutes":30,"description":"Anfahrt","billingStatus":"offen"}',null
  );
  if result->>'status'<>'synced' then raise exception 'W2_TIME_CREATE_FAILED: %',result; end if;
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000124','job_time_entry','W2-TIME-1','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"minutes":50,"description":"Arbeit"}',1
  );
  if result->>'status'<>'synced' or (select minutes from public.homecare_job_time_entries where tenant_id='72000000-0000-0000-0000-000000000001' and id='W2-TIME-1')<>50 then raise exception 'W2_TIME_UPDATE_FAILED: %',result; end if;

  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000125','job_note','W2-JOB-A::2026-10-01:note','create','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"workDate":"2026-10-01","note":"Material fehlt"}',null
  );
  if result->>'status'<>'synced' then raise exception 'W2_NOTE_CREATE_FAILED: %',result; end if;
end $$;

-- IDs of child records are tenant scoped.
insert into public.homecare_jobs(id,tenant_id,title,object_id,customer_id,status)
values('W2-JOB-B','72000000-0000-0000-0000-000000000002','Job B','W2-OBJECT-B','W2-CUSTOMER-B','geplant');
insert into public.homecare_job_time_entries(id,tenant_id,job_id,entry_date,minutes)
values('W2-TIME-1','72000000-0000-0000-0000-000000000002','W2-JOB-B','2026-10-01',10);

-- Tombstones win over stale clients and physical deletion is forbidden.
do $$
declare result jsonb; current_revision bigint;
begin
  select revision into current_revision from public.homecare_jobs where id='W2-JOB-A';
  perform public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000130','job','W2-JOB-A','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"status":"storniert"}',current_revision
  );
  select revision into current_revision from public.homecare_jobs where id='W2-JOB-A';
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000131','job','W2-JOB-A','delete','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{}',current_revision
  );
  if result->>'status'<>'synced' or (select deleted_at is null from public.homecare_jobs where id='W2-JOB-A') then raise exception 'W2_TOMBSTONE_FAILED: %',result; end if;
  if exists(select 1 from public.homecare_field_progress where job_id='W2-JOB-A' and deleted_at is null) then raise exception 'W2_PROGRESS_TOMBSTONE_FAILED'; end if;
  result := public.homecare_apply_job_operation_mutation(
    '72000000-0000-0000-0000-000000000132','job','W2-JOB-A','update','W2-JOB-A',
    '72000000-0000-0000-0000-000000000001','{"status":"in Arbeit"}',current_revision
  );
  if result->>'status'<>'conflict' or (select deleted_at is null from public.homecare_jobs where id='W2-JOB-A') then raise exception 'W2_STALE_RESURRECTION_ALLOWED'; end if;
  begin
    delete from public.homecare_jobs where id='W2-JOB-A';
    raise exception 'W2_HARD_DELETE_ALLOWED';
  exception when check_violation then null;
  end;
end $$;

-- Authenticated reads and writes stay inside the selected tenant.
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
values('72000000-0000-0000-0000-000000000201','authenticated','authenticated','wave2@example.invalid','',now(),now());
insert into public.homecare_roles(id,tenant_id,key,name,permissions)
values('72000000-0000-0000-0000-000000000202','72000000-0000-0000-0000-000000000001','wave2','Wave 2',array['data.read','jobs.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id)
values('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000201','72000000-0000-0000-0000-000000000202');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000201',true);
select set_config('request.headers','{"x-workcore-tenant":"72000000-0000-0000-0000-000000000001"}',true);
do $$
begin
  if exists(select 1 from public.homecare_jobs where tenant_id='72000000-0000-0000-0000-000000000002') then raise exception 'W2_CROSS_TENANT_READ_ALLOWED'; end if;
  if exists(select 1 from public.homecare_job_time_entries where tenant_id='72000000-0000-0000-0000-000000000002') then raise exception 'W2_CHILD_CROSS_TENANT_READ_ALLOWED'; end if;
  begin
    insert into public.homecare_job_notes(id,tenant_id,job_id,note)
    values('W2-CROSS','72000000-0000-0000-0000-000000000002','W2-JOB-B','forbidden');
    raise exception 'W2_CROSS_TENANT_WRITE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
