-- Run after 20260928233000_reports_media_communication_relational_cutover.sql. Always rolls back.
begin;

insert into public.homecare_tenants(id,slug,name) values
  ('73000000-0000-0000-0000-000000000001','wave3-a','Wave 3 A'),
  ('73000000-0000-0000-0000-000000000002','wave3-b','Wave 3 B');
insert into public.homecare_customers(id,tenant_id,name) values
  ('W3-CUSTOMER','73000000-0000-0000-0000-000000000001','Customer A'),
  ('W3-CUSTOMER-B','73000000-0000-0000-0000-000000000002','Customer B');
insert into public.homecare_objects(id,tenant_id,owner_customer_id,name) values
  ('W3-OBJECT','73000000-0000-0000-0000-000000000001','W3-CUSTOMER','Object A'),
  ('W3-OBJECT-B','73000000-0000-0000-0000-000000000002','W3-CUSTOMER-B','Object B');
insert into public.homecare_jobs(id,tenant_id,customer_id,object_id,title,status) values
  ('W3-JOB','73000000-0000-0000-0000-000000000001','W3-CUSTOMER','W3-OBJECT','Job A','erledigt'),
  ('W3-JOB-B','73000000-0000-0000-0000-000000000002','W3-CUSTOMER-B','W3-OBJECT-B','Job B','erledigt');

do $$ declare result jsonb; begin
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000101','report','W3-REPORT','create','W3-REPORT','73000000-0000-0000-0000-000000000001','{"jobId":"W3-JOB","objectId":"W3-OBJECT","title":"Vor Ort","date":"2026-09-28","summary":"Alles fertig"}',null);
  if result->>'status'<>'synced' or (result#>>'{record,revision}')::bigint<>1 then raise exception 'W3_REPORT_CREATE_FAILED: %',result; end if;
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000101','report','W3-REPORT','create','W3-REPORT','73000000-0000-0000-0000-000000000001','{}',null);
  if result->>'status'<>'synced' or (select count(*) from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000001' and id='W3-REPORT')<>1 then raise exception 'W3_REPLAY_FAILED'; end if;
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000102','report','W3-REPORT','update','W3-REPORT','73000000-0000-0000-0000-000000000001','{"summary":"Gerät B"}',1);
  if result->>'status'<>'synced' then raise exception 'W3_UPDATE_FAILED: %',result; end if;
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000103','report','W3-REPORT','update','W3-REPORT','73000000-0000-0000-0000-000000000001','{"summary":"Veraltet"}',1);
  if result->>'status'<>'conflict' or (select summary from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000001' and id='W3-REPORT')<>'Gerät B' then raise exception 'W3_STALE_CONFLICT_FAILED'; end if;
end $$;

insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,revision)
values('W3-MEDIA','73000000-0000-0000-0000-000000000001','pending','W3-MEDIA','image','photo.jpg','73000000-0000-0000-0000-000000000001/report/photo.jpg',0);
do $$ declare result jsonb; begin
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000110','report_media','W3-MEDIA','create','W3-REPORT','73000000-0000-0000-0000-000000000001','{"name":"photo.jpg","storagePath":"73000000-0000-0000-0000-000000000001/report/photo.jpg","mediaRole":"checklist_photo","taskId":"TASK-1"}',null);
  if result->>'status'<>'synced' or (select owner_type from public.homecare_media where id='W3-MEDIA')<>'report' or (result#>>'{record,revision}')::bigint<>1 then raise exception 'W3_MEDIA_CLAIM_FAILED: %',result; end if;
end $$;

do $$ declare result jsonb; begin
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000120','portal_message','W3-MESSAGE','create','W3-MESSAGE','73000000-0000-0000-0000-000000000001','{"customerId":"W3-CUSTOMER","objectId":"W3-OBJECT","reportId":"W3-REPORT","subject":"Frage","message":"Hallo","status":"neu"}',null);
  if result->>'status'<>'synced' then raise exception 'W3_MESSAGE_CREATE_FAILED: %',result; end if;
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000121','portal_message_reply','W3-REPLY','create','W3-MESSAGE','73000000-0000-0000-0000-000000000001','{"body":"Antwort","subject":"Re: Frage","to":"test@example.invalid","deliveryStatus":"gesendet"}',null);
  if result->>'status'<>'synced' then raise exception 'W3_REPLY_CREATE_FAILED: %',result; end if;
end $$;

-- Active billing blocks report deletion. After cancellation, report and media are tombstoned.
insert into public.homecare_billing_items(id,tenant_id,customer_id,object_id,job_id,report_id,label,status,invoice_status)
values('W3-BILL','73000000-0000-0000-0000-000000000001','W3-CUSTOMER','W3-OBJECT','W3-JOB','W3-REPORT','Bill','abrechenbar','gesendet');
do $$ declare result jsonb; rev bigint; begin
  select revision into rev from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000001' and id='W3-REPORT';
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000130','report','W3-REPORT','delete','W3-REPORT','73000000-0000-0000-0000-000000000001','{}',rev);
  if result->>'status'<>'conflict' or (select deleted_at is not null from public.homecare_reports where id='W3-REPORT') then raise exception 'W3_ACTIVE_DEPENDENCY_DELETE_ALLOWED: %',result; end if;
  update public.homecare_billing_items set invoice_status='storniert' where id='W3-BILL';
  select revision into rev from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000001' and id='W3-REPORT';
  result:=public.homecare_apply_report_communication_mutation('73000000-0000-0000-0000-000000000131','report','W3-REPORT','delete','W3-REPORT','73000000-0000-0000-0000-000000000001','{}',rev);
  if result->>'status'<>'synced' or (select deleted_at is null from public.homecare_media where id='W3-MEDIA') then raise exception 'W3_TOMBSTONE_FAILED: %',result; end if;
  begin delete from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000001' and id='W3-REPORT'; raise exception 'W3_HARD_DELETE_ALLOWED'; exception when check_violation then null; end;
end $$;

-- A second tenant's records are never exposed through RLS.
insert into public.homecare_reports(id,tenant_id,job_id,object_id,customer_id,title) values('W3-REPORT-B','73000000-0000-0000-0000-000000000002','W3-JOB-B','W3-OBJECT-B','W3-CUSTOMER-B','Tenant B');
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values('73000000-0000-0000-0000-000000000201','authenticated','authenticated','wave3@example.invalid','',now(),now());
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values('73000000-0000-0000-0000-000000000202','73000000-0000-0000-0000-000000000001','wave3','Wave 3',array['data.read','jobs.manage','media.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values('73000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000201','73000000-0000-0000-0000-000000000202');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','73000000-0000-0000-0000-000000000201',true);
select set_config('request.headers','{"x-workcore-tenant":"73000000-0000-0000-0000-000000000001"}',true);
do $$ begin
  if exists(select 1 from public.homecare_reports where tenant_id='73000000-0000-0000-0000-000000000002') then raise exception 'W3_REPORT_CROSS_TENANT_LEAK'; end if;
  if exists(select 1 from public.homecare_portal_messages where tenant_id='73000000-0000-0000-0000-000000000002') then raise exception 'W3_MESSAGE_CROSS_TENANT_LEAK'; end if;
end $$;
reset role;

rollback;
