begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email) values
 ('a2110000-0000-4000-8000-000000000001','staff-admin@example.invalid'),
 ('a2110000-0000-4000-8000-000000000002','staff-worker@example.invalid'),
 ('a2110000-0000-4000-8000-000000000003','staff-other@example.invalid');
select public.homecare_onboard_company('b2110000-0000-4000-8000-000000000001','a2110000-0000-4000-8000-000000000001','a2110000-0000-4000-8000-000000000001','staff-admin@example.invalid',
 '{"name":"Staff A","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production"}',array['time_tracking']);
select public.homecare_onboard_company('b2110000-0000-4000-8000-000000000002','a2110000-0000-4000-8000-000000000003','a2110000-0000-4000-8000-000000000003','staff-other@example.invalid',
 '{"name":"Staff B","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production"}',array['time_tracking']);
update public.homecare_tenant_memberships set status='active' where tenant_id in ('b2110000-0000-4000-8000-000000000001','b2110000-0000-4000-8000-000000000002');
insert into public.homecare_personnel(tenant_id,id,first_name,last_name) values
 ('b2110000-0000-4000-8000-000000000001','STAFF-1','Worker','One'),
 ('b2110000-0000-4000-8000-000000000001','STAFF-2','Worker','Two'),
 ('b2110000-0000-4000-8000-000000000002','STAFF-B','Other','Company');
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status,employee_id)
 select 'b2110000-0000-4000-8000-000000000001','a2110000-0000-4000-8000-000000000002',id,'active','STAFF-1'
 from public.homecare_roles where tenant_id='b2110000-0000-4000-8000-000000000001' and key='field_worker';
do $$ declare tenant uuid:='b2110000-0000-4000-8000-000000000001'; admin uuid:='a2110000-0000-4000-8000-000000000001'; worker uuid:='a2110000-0000-4000-8000-000000000002';
  entry public.homecare_staff_time_entries%rowtype; active public.homecare_staff_time_entries%rowtype; leave_row public.homecare_staff_leave_requests%rowtype; command jsonb; mutation uuid;
begin
  command:='{"action":"time_save","kind":"work","startedAt":"2020-01-02T08:00:00Z","endedAt":"2020-01-02T10:00:00Z","note":"Native time"}';
  mutation:=gen_random_uuid();
  perform public.homecare_staff_command(tenant,worker,mutation,command);
  perform public.homecare_staff_command(tenant,worker,mutation,command);
  if (select count(*) from public.homecare_staff_time_entries where tenant_id=tenant and employee_id='STAFF-1')<>1 then raise exception 'TIME_REPLAY_DUPLICATED'; end if;
  select * into entry from public.homecare_staff_time_entries where tenant_id=tenant and employee_id='STAFF-1';
  if entry.minutes<>120 then raise exception 'WRONG_MINUTES'; end if;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),command||'{"employeeId":"STAFF-2"}'); raise exception 'OTHER_EMPLOYEE_WRITE'; exception when insufficient_privilege then null; end;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),command); raise exception 'TIME_OVERLAP_ALLOWED'; exception when check_violation then if sqlerrm not like '%STAFF_TIME_OVERLAP%' then raise; end if; end;
  perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),command||'{"employeeId":"STAFF-2"}');
  perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),jsonb_build_object('action','time_lock','employeeId','STAFF-1','id',entry.id,'revision',entry.revision));
  select * into entry from public.homecare_staff_time_entries where id=entry.id;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),command||jsonb_build_object('id',entry.id,'revision',entry.revision)); raise exception 'LOCK_IGNORED'; exception when check_violation then if sqlerrm not like '%STAFF_LOCKED%' then raise; end if; end;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),jsonb_build_object('action','time_unlock','id',entry.id,'revision',entry.revision)); raise exception 'WORKER_UNLOCK'; exception when insufficient_privilege then null; end;
  begin perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),jsonb_build_object('action','time_unlock','employeeId','STAFF-1','id',entry.id,'revision',entry.revision-1)); raise exception 'STALE_ACCEPTED'; exception when serialization_failure then null; end;
  command:='{"action":"clock","kind":"work","activeId":null}'; mutation:=gen_random_uuid();
  perform public.homecare_staff_command(tenant,worker,mutation,command);
  perform public.homecare_staff_command(tenant,worker,mutation,command);
  select * into active from public.homecare_staff_time_entries where tenant_id=tenant and employee_id='STAFF-1' and ended_at is null;
  if active.id is null then raise exception 'CLOCK_NOT_RUNNING'; end if;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),'{"action":"clock","kind":null}'); raise exception 'STALE_CLOCK_ACCEPTED'; exception when serialization_failure then null; end;
  perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),jsonb_build_object('action','clock','kind','pause','activeId',active.id,'revision',active.revision));
  select * into active from public.homecare_staff_time_entries where tenant_id=tenant and employee_id='STAFF-1' and ended_at is null;
  if active.kind<>'pause' then raise exception 'CLOCK_SWITCH_FAILED'; end if;
  perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),jsonb_build_object('action','clock','kind',null,'activeId',active.id,'revision',active.revision));
  if exists(select 1 from public.homecare_staff_time_entries where tenant_id=tenant and employee_id='STAFF-1' and ended_at is null) then raise exception 'CLOCK_STOP_FAILED'; end if;
  perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),'{"action":"leave_request","from":"2026-11-02","to":"2026-11-04","days":3,"note":"Family"}');
  select * into leave_row from public.homecare_staff_leave_requests where tenant_id=tenant and employee_id='STAFF-1';
  command:=jsonb_build_object('action','leave_approve','employeeId','STAFF-1','id',leave_row.id,'revision',leave_row.revision,'reason','Agreed');
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),command); raise exception 'SELF_APPROVAL_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),command); raise exception 'MISSING_BALANCE_APPROVED'; exception when check_violation then if sqlerrm not like '%STAFF_BALANCE_MISSING%' then raise; end if; end;
  perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),'{"action":"balance_save","employeeId":"STAFF-1","year":2026,"revision":0,"entitlementDays":25,"carryoverDays":2,"usedDays":4}');
  mutation:=gen_random_uuid(); perform public.homecare_staff_command(tenant,admin,mutation,command); perform public.homecare_staff_command(tenant,admin,mutation,command);
  if (select count(*) from public.homecare_staff_leave_events where request_id=leave_row.id)<>2 then raise exception 'LEAVE_REPLAY_DUPLICATED'; end if;
  begin perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),'{"action":"leave_request","from":"2026-11-03","to":"2026-11-05","days":3}'); raise exception 'LEAVE_OVERLAP_ALLOWED'; exception when check_violation then if sqlerrm not like '%STAFF_LEAVE_OVERLAP%' then raise; end if; end;
  perform public.homecare_staff_command(tenant,worker,gen_random_uuid(),'{"action":"leave_request","from":"2026-12-01","to":"2026-12-31","days":25}');
  select * into leave_row from public.homecare_staff_leave_requests where tenant_id=tenant and employee_id='STAFF-1' and status='requested';
  begin perform public.homecare_staff_command(tenant,admin,gen_random_uuid(),jsonb_build_object('action','leave_approve','employeeId','STAFF-1','id',leave_row.id,'revision',leave_row.revision)); raise exception 'OVERDRAW_ALLOWED'; exception when check_violation then if sqlerrm not like '%STAFF_BALANCE_EXCEEDED%' then raise; end if; end;
  begin perform public.homecare_staff_command('b2110000-0000-4000-8000-000000000002',worker,gen_random_uuid(),'{"action":"clock","kind":"work"}'); raise exception 'CROSS_TENANT_WRITE'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a2110000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"b2110000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.homecare_staff_time_entries where employee_id<>'STAFF-1')<>0 then raise exception 'COWORKER_TIME_LEAK'; end if;
 if (select count(*) from public.homecare_staff_time_entries)<>3 then raise exception 'OWN_TIMES_MISSING'; end if;
 if (select count(*) from public.homecare_staff_leave_requests)<>2 or (select count(*) from public.homecare_staff_leave_events)<>3 then raise exception 'OWN_LEAVE_MISSING'; end if;
 begin update public.homecare_staff_time_entries set kind='work'; raise exception 'DIRECT_CLIENT_WRITE'; exception when insufficient_privilege then null; end;
 begin perform public.homecare_staff_command('b2110000-0000-4000-8000-000000000001','a2110000-0000-4000-8000-000000000002',gen_random_uuid(),'{"action":"clock","kind":"work"}'); raise exception 'CLIENT_RPC_ACCESS'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.headers','{"x-workcore-tenant":"b2110000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.homecare_staff_time_entries) or exists(select 1 from public.homecare_staff_leave_requests) or exists(select 1 from public.homecare_staff_leave_balances) or exists(select 1 from public.homecare_staff_leave_events) then raise exception 'CROSS_TENANT_READ'; end if; end $$;
reset role;
do $$ declare tab text; saved jsonb; identifier uuid; begin
 select to_jsonb(e),e.id into saved,identifier from public.homecare_staff_time_entries e where employee_id='STAFF-1' and minutes=120;
 delete from public.homecare_staff_time_entries where id=identifier;
 insert into public.homecare_staff_time_entries select populated.* from jsonb_populate_record(null::public.homecare_staff_time_entries,saved) populated;
 if (select minutes from public.homecare_staff_time_entries where id=identifier)<>120 then raise exception 'TIME_RESTORE_FAILED'; end if;
 foreach tab in array array['homecare_staff_time_entries','homecare_staff_leave_requests','homecare_staff_leave_balances','homecare_staff_leave_events','homecare_staff_mutations'] loop
  if not tab=any(public.homecare_relational_backup_tables()) then raise exception 'STAFF_BACKUP_MISSING %',tab; end if;
  if has_table_privilege('anon','public.'||tab,'select') or has_table_privilege('authenticated','public.'||tab,'insert,update,delete') then raise exception 'STAFF_GRANTS_TOO_BROAD %',tab; end if;
  if not (select relrowsecurity from pg_class where oid=('public.'||tab)::regclass) then raise exception 'RLS_DISABLED %',tab; end if;
 end loop;
 update public.homecare_tenant_modules set enabled=false where tenant_id='b2110000-0000-4000-8000-000000000001' and module='time_tracking';
 begin perform public.homecare_staff_command('b2110000-0000-4000-8000-000000000001','a2110000-0000-4000-8000-000000000002',gen_random_uuid(),'{"action":"clock","kind":"work"}'); raise exception 'DISABLED_MODULE_WRITE'; exception when insufficient_privilege then null; end;
end $$;
rollback;
