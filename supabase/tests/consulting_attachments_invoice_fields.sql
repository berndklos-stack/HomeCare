begin;
insert into public.homecare_tenants(id,slug,name) values
 ('86000000-0000-0000-0000-000000000001','attachments-a','Attachments A'),
 ('86000000-0000-0000-0000-000000000002','attachments-b','Attachments B');
insert into public.homecare_customers(id,tenant_id,name) values ('ATT-C','86000000-0000-0000-0000-000000000001','Customer');
insert into public.homecare_objects(id,tenant_id,name) values ('ATT-O','86000000-0000-0000-0000-000000000001','Object');
insert into public.homecare_jobs(id,tenant_id,title,object_id) values ('ATT-J','86000000-0000-0000-0000-000000000001','Ongoing','ATT-O');
insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,content_type,byte_size) values
 ('ATT-M','86000000-0000-0000-0000-000000000001','pending','ATT-M','attachment','Plan.pdf','86000000-0000-0000-0000-000000000001/consulting-entry-attachments/plan.pdf','application/pdf',100),
 ('ATT-OTHER','86000000-0000-0000-0000-000000000002','pending','ATT-OTHER','attachment','Private.pdf','86000000-0000-0000-0000-000000000002/consulting-entry-attachments/private.pdf','application/pdf',100);
do $$ declare result jsonb; rev bigint; begin
 result:=public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000101','job_time_entry','ATT-E','create','ATT-J','86000000-0000-0000-0000-000000000001','{"date":"2026-10-26","startTime":"10:00","endTime":"11:00","minutes":60,"description":"Work","attachments":[{"id":"ATT-M"}]}',null,null);
 if result->>'status'<>'synced' or not exists(select 1 from public.homecare_media where id='ATT-M' and job_time_entry_id='ATT-E' and owner_type='job_time_entry') then raise exception 'ATTACHMENT_NOT_LINKED: %',result; end if;
 result:=public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000101','job_time_entry','ATT-E','create','ATT-J','86000000-0000-0000-0000-000000000001','{}',null,null);
 if result->>'status'<>'synced' then raise exception 'REPLAY_FAILED'; end if;
 begin
  perform public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000102','job_time_entry','ATT-E','update','ATT-J','86000000-0000-0000-0000-000000000001','{"attachments":[{"id":"ATT-OTHER"}]}',1,null);
  raise exception 'CROSS_TENANT_MEDIA_ALLOWED';
 exception when raise_exception then if sqlerrm<>'ATTACHMENT_NOT_OWNED' then raise; end if; end;
 result:=public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000103','job_time_entry','ATT-E','update','ATT-J','86000000-0000-0000-0000-000000000001','{"attachments":[]}',99,null);
 if result->>'status'<>'conflict' or (select deleted_at from public.homecare_media where id='ATT-M') is not null then raise exception 'STALE_UPDATE_REMOVED_MEDIA'; end if;
 select revision into rev from public.homecare_job_time_entries where id='ATT-E';
 result:=public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000104','job_time_entry','ATT-E','update','ATT-J','86000000-0000-0000-0000-000000000001','{"billingStatus":"abgerechnet","attachments":[{"id":"ATT-M"}]}',rev,null);
 if result->>'status'<>'synced' then raise exception 'BILLING_WITH_ATTACHMENTS_FAILED'; end if;
 begin
  perform public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000105','job_time_entry','ATT-E','update','ATT-J','86000000-0000-0000-0000-000000000001','{"attachments":[]}',2,null);
  raise exception 'BILLED_ATTACHMENTS_MUTABLE';
 exception when raise_exception then if sqlerrm<>'BILLED_ENTRY_READ_ONLY' then raise; end if; end;
 update public.homecare_job_time_entries set billing_status='offen' where id='ATT-E';
 select revision into rev from public.homecare_job_time_entries where id='ATT-E';
 result:=public.homecare_apply_job_operation_mutation('86000000-0000-0000-0000-000000000106','job_time_entry','ATT-E','update','ATT-J','86000000-0000-0000-0000-000000000001','{"attachments":[]}',rev,null);
 if result->>'status'<>'synced' or (select deleted_at from public.homecare_media where id='ATT-M') is null then raise exception 'REMOVE_FAILED'; end if;
end $$;
do $$ declare result jsonb; rev bigint; begin
 result:=public.homecare_apply_financial_mutation('86000000-0000-0000-0000-000000000201','invoice','ATT-I','create','ATT-I','86000000-0000-0000-0000-000000000001','{"customerId":"ATT-C","label":"Manual","invoiceStatus":"entwurf","invoiceDate":"2026-10-26","customerReference":"Customer Ref","ourReference":"Our Ref","orderReference":"PO-123"}',null);
 if result->>'status'<>'synced' or not exists(select 1 from public.homecare_billing_items where id='ATT-I' and customer_reference='Customer Ref' and our_reference='Our Ref' and order_reference='PO-123' and not(record_data?'orderReference')) then raise exception 'NATIVE_REFERENCES_MISSING: %',result; end if;
 result:=public.homecare_apply_financial_mutation('86000000-0000-0000-0000-000000000202','invoice_line','ATT-L','create','ATT-I','86000000-0000-0000-0000-000000000001','{"kind":"Leistung","name":"Montage","articleNumber":"ART-1","comment":"Position comment","quantity":"2","unitPrice":"150","taxRate":"25","discountPercent":"10"}',null);
 if result->>'status'<>'synced' or not exists(select 1 from public.homecare_invoice_lines where id='ATT-L' and article_number='ART-1' and comment='Position comment' and line_discount_percent=10 and not(record_data?'comment')) then raise exception 'NATIVE_LINE_FIELDS_MISSING: %',result; end if;
 if (select gross_total from public.homecare_billing_items where id='ATT-I')<>337.50 then raise exception 'DISCOUNT_TOTAL_FAILED'; end if;
 select revision into rev from public.homecare_invoice_lines where id='ATT-L';
 result:=public.homecare_apply_financial_mutation('86000000-0000-0000-0000-000000000203','invoice_line','ATT-L','update','ATT-I','86000000-0000-0000-0000-000000000001','{"comment":""}',rev);
 if (select comment from public.homecare_invoice_lines where id='ATT-L')<>'' then raise exception 'COMMENT_CLEAR_FAILED'; end if;
 update public.homecare_billing_items set invoice_status='gebucht' where id='ATT-I';
 begin update public.homecare_billing_items set record_data=record_data||'{"ourReference":"Changed"}' where id='ATT-I'; raise exception 'ISSUED_REFERENCE_MUTABLE'; exception when check_violation then null; end;
 begin update public.homecare_invoice_lines set comment='Changed' where id='ATT-L'; raise exception 'ISSUED_COMMENT_MUTABLE'; exception when check_violation then null; end;
end $$;

do $$ begin
 if has_function_privilege('anon','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','EXECUTE') then raise exception 'CLIENT_RPC_EXPOSED'; end if;
 if not (select relrowsecurity from pg_class where oid='public.homecare_media'::regclass) then raise exception 'MEDIA_RLS_DISABLED'; end if;
end $$;
insert into auth.users(id,email) values ('86000000-0000-0000-0000-000000000301','test@example.invalid');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values ('86000000-0000-0000-0000-000000000302','86000000-0000-0000-0000-000000000001','attachments-test','Test',array['data.read','jobs.manage','media.manage','invoices.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values ('86000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000301','86000000-0000-0000-0000-000000000302');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','86000000-0000-0000-0000-000000000301',true);
select set_config('request.headers','{"x-workcore-tenant":"86000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 if exists(select 1 from public.homecare_media where id='ATT-OTHER') then raise exception 'CROSS_TENANT_READ'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.role','anon',true);
do $$ begin
 begin
  if exists(select 1 from public.homecare_media where id in('ATT-M','ATT-OTHER')) then raise exception 'ANON_MEDIA_READ'; end if;
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Destructive restore rehearsal is restricted to the disposable local database.
do $$ declare backup jsonb; table_name text; before_rows jsonb; after_rows jsonb; begin
 if current_database()='workcore_operations_test' then
  perform set_config('request.jwt.claim.role','service_role',true);
  backup:=public.homecare_create_relational_backup('86000000-0000-0000-0000-000000000001','consulting-invoice-local-restore-test');
  select payload into before_rows from public.homecare_relational_backups where id=(backup->>'id')::uuid;
  perform set_config('session_replication_role','replica',true);
  foreach table_name in array public.homecare_relational_backup_tables() loop
   execute format('delete from public.%I where tenant_id=$1',table_name) using '86000000-0000-0000-0000-000000000001'::uuid;
  end loop;
  perform public.homecare_restore_relational_backup((backup->>'id')::uuid,'86000000-0000-0000-0000-000000000001');
  foreach table_name in array public.homecare_relational_backup_tables() loop
   execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where tenant_id=$1',table_name)
    into after_rows using '86000000-0000-0000-0000-000000000001'::uuid;
   if exists(select value from jsonb_array_elements(after_rows) except select value from jsonb_array_elements(before_rows->table_name))
      or exists(select value from jsonb_array_elements(before_rows->table_name) except select value from jsonb_array_elements(after_rows)) then
     raise exception 'BACKUP_RESTORE_CONTENT_MISMATCH: %',table_name;
   end if;
  end loop;
  perform set_config('session_replication_role','origin',true);
 end if;
end $$;
rollback;
