-- Run after 20260929090000_financial_relational_cutover.sql. Always rolls back.
begin;

insert into public.homecare_tenants(id,slug,name) values
  ('74000000-0000-0000-0000-000000000001','wave4-a','Wave 4 A'),
  ('74000000-0000-0000-0000-000000000002','wave4-b','Wave 4 B');
insert into public.homecare_customers(id,tenant_id,name) values
  ('W4-CUSTOMER-A','74000000-0000-0000-0000-000000000001','Customer A'),
  ('W4-CUSTOMER-B','74000000-0000-0000-0000-000000000002','Customer B');
insert into public.homecare_objects(id,tenant_id,owner_customer_id,name) values
  ('W4-OBJECT-A','74000000-0000-0000-0000-000000000001','W4-CUSTOMER-A','Object A'),
  ('W4-OBJECT-B','74000000-0000-0000-0000-000000000002','W4-CUSTOMER-B','Object B');
insert into public.homecare_jobs(id,tenant_id,customer_id,object_id,title,status) values
  ('W4-JOB-A','74000000-0000-0000-0000-000000000001','W4-CUSTOMER-A','W4-OBJECT-A','Job A','erledigt'),
  ('W4-JOB-B','74000000-0000-0000-0000-000000000002','W4-CUSTOMER-B','W4-OBJECT-B','Job B','erledigt');

do $$ begin
  if public.homecare_line_net(1,-10,'amount',10)<>-10 then raise exception 'W4_DISCOUNT_TOTAL_FAILED'; end if;
end $$;

do $$ declare result jsonb; invoice_revision bigint; begin
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000101','invoice','W4-INVOICE-A','create','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"customerId":"W4-CUSTOMER-A","objectId":"W4-OBJECT-A","jobId":"W4-JOB-A","label":"Arbeit","amount":"125","invoiceStatus":"entwurf","invoiceNumber":"INV-2026-1","invoiceDate":"2026-09-29"}',null);
  if result->>'status'<>'synced' or result#>>'{record,invoice_number}'<>'INV-2026-1' then raise exception 'W4_INVOICE_CREATE_FAILED: %',result; end if;
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000101','invoice','W4-INVOICE-A','create','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{}',null);
  if result->>'status'<>'synced' or (select count(*) from public.homecare_billing_items where tenant_id='74000000-0000-0000-0000-000000000001' and id='W4-INVOICE-A')<>1 then raise exception 'W4_REPLAY_FAILED'; end if;

  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000102','invoice_line','W4-LINE-A','create','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"name":"Leistung","quantity":"2","unitPrice":"50","taxRate":"25","accountingAccount":"3001"}',null);
  if result->>'status'<>'synced' or (select gross_total from public.homecare_billing_items where id='W4-INVOICE-A')<>125 then raise exception 'W4_TOTAL_FAILED: %',result; end if;

  select revision into invoice_revision from public.homecare_billing_items where tenant_id='74000000-0000-0000-0000-000000000001' and id='W4-INVOICE-A';
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000103','invoice','W4-INVOICE-A','update','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"invoiceStatus":"gebucht","invoicedAt":"2026-09-29T10:00:00Z"}',invoice_revision);
  if result->>'status'<>'synced' then raise exception 'W4_ISSUE_FAILED: %',result; end if;
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000104','invoice','W4-INVOICE-A','update','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"notes":"stale"}',invoice_revision);
  if result->>'status'<>'conflict' then raise exception 'W4_STALE_OVERWRITE_ALLOWED: %',result; end if;
end $$;

do $$ begin
  begin update public.homecare_invoice_lines set unit_price=1 where tenant_id='74000000-0000-0000-0000-000000000001' and id='W4-LINE-A'; raise exception 'W4_ISSUED_LINE_MUTABLE'; exception when check_violation then null; end;
  begin update public.homecare_billing_items set amount=1 where tenant_id='74000000-0000-0000-0000-000000000001' and id='W4-INVOICE-A'; raise exception 'W4_ISSUED_INVOICE_MUTABLE'; exception when check_violation then null; end;
end $$;

do $$ declare result jsonb; begin
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000105','payment','PAY-W4-INVOICE-A','create','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"amount":"125","paidAt":"2026-09-29T12:00:00Z"}',null);
  if result->>'status'<>'synced' or (select invoice_status from public.homecare_billing_items where id='W4-INVOICE-A')<>'bezahlt' then raise exception 'W4_PAYMENT_FAILED: %',result; end if;
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000106','accounting_export','EXP-W4-INVOICE-A-1','create','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"status":"gesendet","system":"Spiris","exportedAt":"2026-09-29T13:00:00Z"}',null);
  if result->>'status'<>'synced' or (select external_export_system from public.homecare_billing_items where id='W4-INVOICE-A')<>'Spiris' then raise exception 'W4_EXPORT_FAILED: %',result; end if;
  result:=public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000107','payment','PAY-W4-INVOICE-A','update','W4-INVOICE-A','74000000-0000-0000-0000-000000000001','{"amount":"1"}',1);
  if result->>'status'<>'conflict' then raise exception 'W4_PAYMENT_DESTRUCTIVE_UPDATE_ALLOWED'; end if;
end $$;

do $$ begin
  if (select count(*) from public.homecare_financial_audit where tenant_id='74000000-0000-0000-0000-000000000001' and invoice_id='W4-INVOICE-A')<5 then raise exception 'W4_AUDIT_MISSING'; end if;
  begin delete from public.homecare_payments where tenant_id='74000000-0000-0000-0000-000000000001' and id='PAY-W4-INVOICE-A'; raise exception 'W4_HARD_DELETE_ALLOWED'; exception when check_violation then null; end;
end $$;

insert into public.homecare_billing_items(id,tenant_id,customer_id,object_id,job_id,label,invoice_status,invoice_number)
values('W4-INVOICE-B','74000000-0000-0000-0000-000000000002','W4-CUSTOMER-B','W4-OBJECT-B','W4-JOB-B','Tenant B','entwurf','INV-2026-B');
insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values('74000000-0000-0000-0000-000000000201','authenticated','authenticated','wave4@example.invalid','',now(),now());
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values('74000000-0000-0000-0000-000000000202','74000000-0000-0000-0000-000000000001','wave4','Wave 4',array['data.read','invoices.manage']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values('74000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000201','74000000-0000-0000-0000-000000000202');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','74000000-0000-0000-0000-000000000201',true);
select set_config('request.headers','{"x-workcore-tenant":"74000000-0000-0000-0000-000000000001"}',true);
do $$ begin
  if exists(select 1 from public.homecare_billing_items where tenant_id='74000000-0000-0000-0000-000000000002') then raise exception 'W4_INVOICE_CROSS_TENANT_LEAK'; end if;
  if exists(select 1 from public.homecare_payments where tenant_id='74000000-0000-0000-0000-000000000002') then raise exception 'W4_PAYMENT_CROSS_TENANT_LEAK'; end if;
  begin
    perform public.homecare_apply_financial_mutation('74000000-0000-0000-0000-000000000299','invoice','W4-CROSS-TENANT','create','W4-CROSS-TENANT','74000000-0000-0000-0000-000000000002','{"label":"Forbidden"}',null);
    raise exception 'W4_RPC_CROSS_TENANT_ALLOWED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
