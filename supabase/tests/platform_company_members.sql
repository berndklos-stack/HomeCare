begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('a2112000-0000-4000-8000-000000000001','platform@example.invalid',now()),
 ('a2112000-0000-4000-8000-000000000002','owner@example.invalid',now()),
 ('a2112000-0000-4000-8000-000000000003','worker@example.invalid',null);
select public.homecare_onboard_company('b2112000-0000-4000-8000-000000000001','a2112000-0000-4000-8000-000000000001','a2112000-0000-4000-8000-000000000001','platform@example.invalid',
 '{"name":"Home","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs']);
select public.homecare_onboard_company('b2112000-0000-4000-8000-000000000002','a2112000-0000-4000-8000-000000000002','a2112000-0000-4000-8000-000000000002','owner@example.invalid',
 '{"name":"Target","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs']);
update public.homecare_tenant_memberships set status='active' where tenant_id in ('b2112000-0000-4000-8000-000000000001','b2112000-0000-4000-8000-000000000002');
do $$ declare
 home uuid:='b2112000-0000-4000-8000-000000000001'; tenant uuid:='b2112000-0000-4000-8000-000000000002'; actor uuid:='a2112000-0000-4000-8000-000000000001';
 worker uuid:='a2112000-0000-4000-8000-000000000003'; owner_member uuid; home_member uuid; worker_member uuid; worker_role uuid; home_role uuid; result jsonb;
begin
 if has_function_privilege('anon','public.homecare_platform_member_directory(uuid,uuid,uuid,text,text,uuid,integer)','execute')
 or has_function_privilege('authenticated','public.homecare_platform_member_directory(uuid,uuid,uuid,text,text,uuid,integer)','execute')
 or has_function_privilege('anon','public.homecare_platform_member_command(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid)','execute')
 or has_function_privilege('authenticated','public.homecare_platform_member_command(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid)','execute') then raise exception 'CLIENT_PLATFORM_RPC_ACCESS'; end if;
 select id into home_member from public.homecare_tenant_memberships where tenant_id=home and user_id=actor;
 select id into owner_member from public.homecare_tenant_memberships where tenant_id=tenant;
 select id into worker_role from public.homecare_roles where tenant_id=tenant and key='field_worker';
 select role_id into home_role from public.homecare_tenant_memberships where id=home_member;
 result:=public.homecare_platform_member_directory(home,tenant,actor);
 if result->>'total'<>'1' or result#>>'{members,0,email}'<>'owner@example.invalid' then raise exception 'DIRECTORY_NOT_TARGET_SCOPED'; end if;
 if exists(select 1 from public.homecare_tenant_memberships where tenant_id=tenant and user_id=actor) then raise exception 'SYNTHETIC_MEMBERSHIP_CREATED'; end if;
 begin
  perform public.homecare_admin_member(tenant,actor,'suspend',owner_member);
  raise exception 'ORDINARY_CROSS_TENANT_ACCESS'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_platform_member_directory(home,tenant,worker);
  raise exception 'UNAUTHORIZED_HOME_ACTOR'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'invite',p_role=>home_role,p_email=>'worker@example.invalid',p_user=>worker);
  raise exception 'FOREIGN_ROLE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'invite',p_role=>worker_role,p_email=>'wrong@example.invalid',p_user=>worker);
  raise exception 'WRONG_AUTH_IDENTITY_ACCEPTED'; exception when check_violation then null; end;
 perform public.homecare_platform_member_command(home,tenant,actor,'invite',p_role=>worker_role,p_email=>'worker@example.invalid',p_user=>worker);
 select id into worker_member from public.homecare_tenant_memberships where tenant_id=tenant and user_id=worker;
 if not exists(select 1 from public.homecare_tenant_memberships where id=worker_member and status='suspended') then raise exception 'UNACCEPTED_INVITATION_ACTIVE'; end if;
 if not exists(select 1 from public.homecare_audit_log where tenant_id=tenant and actor_user_id=actor and action='invite') then raise exception 'ACTOR_AUDIT_MISSING'; end if;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'reactivate',worker_member);
  raise exception 'ACCEPTANCE_BYPASSED'; exception when check_violation then null; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'remove',home_member);
  raise exception 'FOREIGN_MEMBERSHIP_ACCEPTED'; exception when no_data_found then null; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'employee',worker_member,p_employee=>'OTHER-TENANT-EMPLOYEE');
  raise exception 'FOREIGN_EMPLOYEE_ACCEPTED'; exception when check_violation then null; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'suspend',owner_member);
  raise exception 'LAST_OWNER_SUSPENDED'; exception when check_violation then
    if sqlerrm<>'LAST_OWNER_PROTECTED' then raise; end if; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'remove',owner_member);
  raise exception 'LAST_OWNER_REMOVED'; exception when check_violation then
    if sqlerrm<>'LAST_OWNER_PROTECTED' then raise; end if; end;
 begin
  perform public.homecare_platform_member_command(home,tenant,actor,'role',owner_member,p_role=>worker_role);
  raise exception 'LAST_OWNER_DEMOTED'; exception when check_violation then
    if sqlerrm<>'LAST_OWNER_PROTECTED' then raise; end if; end;
 perform public.homecare_platform_member_command(home,tenant,actor,'remove',worker_member);
 if not exists(select 1 from public.homecare_tenant_memberships where id=worker_member and status='revoked') then raise exception 'TARGET_NOT_REVOKED'; end if;
 if not exists(select 1 from public.homecare_tenant_memberships where id=home_member and status='active' and role_id=home_role) then raise exception 'HOME_MEMBERSHIP_CHANGED'; end if;
 update public.homecare_tenants set archived=true where id=tenant;
 begin
  perform public.homecare_platform_member_directory(home,tenant,actor);
  raise exception 'ARCHIVED_TARGET_ACCESS'; exception when insufficient_privilege then null; end;
 update public.homecare_tenants set archived=false where id=tenant;
 update public.homecare_tenants set archived=true where id=home;
 begin
  perform public.homecare_platform_member_directory(home,tenant,actor);
  raise exception 'ARCHIVED_HOME_ACCESS'; exception when insufficient_privilege then null; end;
end $$;
rollback;
