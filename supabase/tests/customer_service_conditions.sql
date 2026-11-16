begin;
insert into public.homecare_tenants values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.homecare_customers(id,tenant_id) values('C1','00000000-0000-0000-0000-000000000001'),('C2','00000000-0000-0000-0000-000000000002');
insert into public.homecare_services(id,tenant_id) values('S1','00000000-0000-0000-0000-000000000001'),('S2','00000000-0000-0000-0000-000000000002');
do $$
declare result jsonb; replay jsonb; tenant uuid:='00000000-0000-0000-0000-000000000001';
begin
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000001','customer_service_condition','CSC1','create','C1',tenant,'{"serviceId":"S1","unitPrice":"","currency":""}');
  if result->>'status'<>'synced' or (result->'record'->>'unit_price') is not null then raise exception 'DEFAULT_PRICE_CREATE';end if;
  replay:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000001','customer_service_condition','CSC1','create','C1',tenant,'{"serviceId":"S1","unitPrice":"999","currency":"EUR"}');
  if result<>replay then raise exception 'IDEMPOTENCY_FAILED';end if;
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000002','customer_service_condition','CSC1','update','C1',tenant,'{"serviceId":"S1","unitPrice":"396,1250","currency":"SEK"}',1);
  if (result->'record'->>'unit_price')::numeric<>396.125 or (result->'record'->>'revision')::int<>2 then raise exception 'NATIVE_CUSTOMER_PRICE';end if;
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000003','customer_service_condition','CSC1','update','C1',tenant,'{"serviceId":"S1","unitPrice":"999","currency":"SEK"}',1);
  if result->>'status'<>'conflict' then raise exception 'REVISION_CHECK';end if;
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000004','customer_service_condition','CSC2','create','C1',tenant,'{"serviceId":"S1","unitPrice":"0","currency":"SEK"}');
  if result->>'status'<>'conflict' then raise exception 'DUPLICATE_ASSIGNMENT';end if;
  begin
    perform public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000005','customer_service_condition','BAD','create','C1',tenant,'{"serviceId":"S2","unitPrice":"1","currency":"SEK"}');
    raise exception 'CROSS_TENANT_ACCEPTED';
  exception when foreign_key_violation then null;end;
  begin
    perform public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000006','customer_service_condition','CSC1','update','C1',tenant,'{"serviceId":"S1","unitPrice":"-1","currency":"SEK"}',2);
    raise exception 'NEGATIVE_PRICE_ACCEPTED';
  exception when invalid_parameter_value then null;end;
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000007','customer_service_condition','CSC1','update','C1',tenant,'{"serviceId":"S1","unitPrice":"0","currency":"SEK"}',2);
  if (result->'record'->>'unit_price')::numeric<>0 then raise exception 'FREE_PRICE_LOST';end if;
  result:=public.homecare_apply_customer_service_condition('10000000-0000-4000-8000-000000000008','customer_service_condition','CSC1','delete','C1',tenant,'{}',3);
  if result->'record'->>'deleted_at' is null then raise exception 'TOMBSTONE_MISSING';end if;
  if has_function_privilege('authenticated','public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint)','execute') then raise exception 'RPC_PUBLIC';end if;
  if has_table_privilege('authenticated','public.homecare_customer_service_conditions','insert') then raise exception 'DIRECT_WRITE_ALLOWED';end if;
  if not 'homecare_customer_service_conditions'=any(public.homecare_relational_backup_tables()) then raise exception 'BACKUP_MISSING';end if;
end$$;
set local test.tenant='00000000-0000-0000-0000-000000000002';
set local test.permission='yes';
set local role authenticated;
do $$begin if exists(select 1 from public.homecare_customer_service_conditions) then raise exception 'CROSS_TENANT_READ';end if;end$$;
reset role;
rollback;
