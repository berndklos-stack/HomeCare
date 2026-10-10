begin;
insert into public.homecare_tenants(id,slug,name) values('00000000-0000-0000-0000-000000000002','code-test-other','Other tenant');
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','code@example.invalid');
insert into public.homecare_jobs(tenant_id,id,title,status) values
 ('00000000-0000-0000-0000-000000000001','code-job','Code test','in Arbeit'),
 ('00000000-0000-0000-0000-000000000002','code-job-other','Other tenant','in Arbeit');
do $$ declare first_code text; next_code text; test_id uuid:=gen_random_uuid(); begin
  insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id,created_at)
  values('00000000-0000-0000-0000-000000000001',test_id,'code-job',1,'Code test','11111111-1111-4111-8111-111111111111','2099-10-10 22:30:00+00') returning picking_code into first_code;
  if first_code<>'2099-10-11-00001' then raise exception 'STOCKHOLM_DAY_FAILED: %',first_code; end if;
  insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id,created_at)
  values('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'code-job',1,'Code test','11111111-1111-4111-8111-111111111111','2099-10-11 10:00:00+00') returning picking_code into next_code;
  if next_code<>'2099-10-11-00002' then raise exception 'SEQUENCE_FAILED: %',next_code; end if;
  insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id,created_at)
  values('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'code-job',1,'Code test','11111111-1111-4111-8111-111111111111','2099-10-12 10:00:00+00') returning picking_code into next_code;
  if next_code<>'2099-10-12-00001' then raise exception 'DAILY_RESET_FAILED'; end if;
  insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id,created_at)
  values('00000000-0000-0000-0000-000000000002',gen_random_uuid(),'code-job-other',1,'Code test','11111111-1111-4111-8111-111111111111','2099-10-11 10:00:00+00') returning picking_code into next_code;
  if next_code<>first_code then raise exception 'TENANT_SEQUENCE_FAILED'; end if;
  begin
    perform public.homecare_cancel_picking_order('00000000-0000-0000-0000-000000000001',test_id,1,'11111111-1111-4111-8111-111111111111',' ');
    raise exception 'EMPTY_REASON_ACCEPTED';
  exception when others then if sqlerrm<>'PICKING_REASON_REQUIRED' then raise; end if; end;
  perform public.homecare_cancel_picking_order('00000000-0000-0000-0000-000000000001',test_id,1,'11111111-1111-4111-8111-111111111111','Nicht mehr benötigt');
  perform public.homecare_cancel_picking_order('00000000-0000-0000-0000-000000000001',test_id,1,'11111111-1111-4111-8111-111111111111','Nicht mehr benötigt');
  if (select count(*) from public.homecare_picking_events where order_id=test_id)<>2 then raise exception 'CANCEL_AUDIT_DUPLICATED'; end if;
  if not exists(select 1 from public.homecare_picking_events where order_id=test_id and action='cancelled' and note='Nicht mehr benötigt' and actor_user_id='11111111-1111-4111-8111-111111111111') then raise exception 'CANCEL_AUDIT_MISSING'; end if;
  if (select picking_code from public.homecare_picking_orders where id=test_id)<>first_code then raise exception 'CODE_CHANGED'; end if;
  begin
    update public.homecare_picking_orders set picking_code='2099-10-11-99999' where id=test_id;
    raise exception 'CODE_CHANGE_ACCEPTED';
  exception when others then if sqlerrm<>'PICKING_CODE_IMMUTABLE' then raise; end if; end;
end $$;
rollback;
