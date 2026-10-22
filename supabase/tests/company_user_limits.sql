begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('a2209000-0000-4000-8000-000000000001','quota-owner@example.invalid',now()),
 ('a2209000-0000-4000-8000-000000000002','quota-worker@example.invalid',now()),
 ('a2209000-0000-4000-8000-000000000003','quota-pending@example.invalid',null);
select public.homecare_onboard_company('b2209000-0000-4000-8000-000000000001','a2209000-0000-4000-8000-000000000001','a2209000-0000-4000-8000-000000000001','quota-owner@example.invalid',
 '{"name":"Quota Test","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true,"userLimit":2}',array['jobs']);
select public.homecare_onboard_company('b2209000-0000-4000-8000-000000000002','a2209000-0000-4000-8000-000000000002','a2209000-0000-4000-8000-000000000002','quota-worker@example.invalid',
 '{"name":"Other Test","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs']);
update public.homecare_tenant_memberships set status='active' where tenant_id in ('b2209000-0000-4000-8000-000000000001','b2209000-0000-4000-8000-000000000002');
update public.homecare_user_invitations set delivery_status='accepted',accepted_at=now(),accepted_by=auth_user_id where tenant_id in ('b2209000-0000-4000-8000-000000000001','b2209000-0000-4000-8000-000000000002');
do $$ declare
 tenant uuid:='b2209000-0000-4000-8000-000000000001'; other uuid:='b2209000-0000-4000-8000-000000000002';
 owner_id uuid:='a2209000-0000-4000-8000-000000000001'; worker uuid:='a2209000-0000-4000-8000-000000000002'; pending uuid:='a2209000-0000-4000-8000-000000000003';
 role_id uuid; member_id uuid; owner_member uuid; result jsonb; original jsonb;
begin
 if not (select relrowsecurity from pg_class where oid='public.homecare_company_user_limits'::regclass) then raise exception 'RLS_DISABLED'; end if;
 if has_table_privilege('anon','public.homecare_company_user_limits','select') or has_table_privilege('authenticated','public.homecare_company_user_limits','insert,update,delete') then raise exception 'CLIENT_QUOTA_ACCESS'; end if;
 if has_table_privilege('authenticated','public.homecare_tenant_modules','insert,update,delete') then raise exception 'CLIENT_MODULE_WRITES'; end if;
 if has_function_privilege('anon','public.homecare_request_member_password_reset(uuid,uuid,uuid,uuid,boolean)','execute') or has_function_privilege('authenticated','public.homecare_request_member_password_reset(uuid,uuid,uuid,uuid,boolean)','execute') then raise exception 'CLIENT_RESET_RPC'; end if;
 if not 'homecare_company_user_limits'=any(public.homecare_relational_backup_tables()) then raise exception 'BACKUP_TABLE_MISSING'; end if;
 if (select max_users from public.homecare_company_user_limits where tenant_id=tenant)<>2 then raise exception 'ONBOARD_LIMIT_MISSING'; end if;
 if exists(select 1 from public.homecare_company_user_limits where tenant_id=other) then raise exception 'EXISTING_COMPANY_LIMIT_CHANGED'; end if;
 select id into role_id from public.homecare_roles where tenant_id=tenant and key='field_worker';
 select id into owner_member from public.homecare_tenant_memberships where tenant_id=tenant and user_id=owner_id;
 perform public.homecare_admin_member(tenant,owner_id,'invite',p_role=>role_id,p_email=>'quota-worker@example.invalid',p_user=>worker);
 select id into member_id from public.homecare_tenant_memberships where tenant_id=tenant and user_id=worker;
 begin
  perform public.homecare_admin_member(tenant,owner_id,'invite',p_role=>role_id,p_email=>'quota-pending@example.invalid',p_user=>pending);
  raise exception 'LIMIT_BYPASSED'; exception when check_violation then if sqlerrm<>'USER_LIMIT_REACHED' then raise; end if; end;
 begin
  update public.homecare_company_user_limits set max_users=1 where tenant_id=tenant;
  raise exception 'LIMIT_BELOW_USAGE'; exception when check_violation then if sqlerrm<>'USER_LIMIT_BELOW_USAGE' then raise; end if; end;
 -- Even a suspended or pending user occupies a seat. Revocation releases it.
 update public.homecare_tenant_memberships set status='revoked' where id=member_id;
 perform public.homecare_admin_member(tenant,owner_id,'invite',p_role=>role_id,p_email=>'quota-pending@example.invalid',p_user=>pending);
 begin
  update public.homecare_tenant_memberships set status='active' where id=member_id;
  raise exception 'REACTIVATION_BYPASSED_LIMIT'; exception when check_violation then if sqlerrm<>'USER_LIMIT_REACHED' then raise; end if; end;
 original:=public.homecare_platform_company_detail(owner_id,tenant,tenant);
 if original#>>'{company,userLimit}'<>'2' then raise exception 'NATIVE_LIMIT_NOT_READ'; end if;
 begin
  perform public.homecare_platform_company_update(owner_id,tenant,tenant,(original->>'revision')::bigint,(original->>'settingsRevision')::bigint,original->'company'||'{"userLimit":1,"notes":"must roll back"}'::jsonb,array['jobs']);
  raise exception 'INVALID_LIMIT_UPDATE_COMMITTED'; exception when check_violation then if sqlerrm<>'USER_LIMIT_BELOW_USAGE' then raise; end if; end;
 if public.homecare_platform_company_detail(owner_id,tenant,tenant) is distinct from original then raise exception 'FAILED_LIMIT_UPDATE_NOT_ATOMIC'; end if;
 perform public.homecare_platform_company_update(owner_id,tenant,tenant,(original->>'revision')::bigint,(original->>'settingsRevision')::bigint,original->'company'||'{"userLimit":3}'::jsonb,array['jobs']);
 if (select max_users from public.homecare_company_user_limits where tenant_id=tenant)<>3 then raise exception 'LIMIT_NOT_UPDATED'; end if;
 begin
  perform public.homecare_request_member_password_reset(tenant,other,owner_id,owner_member,false);
  raise exception 'FOREIGN_RESET'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_request_member_password_reset(tenant,tenant,owner_id,owner_member,true);
  raise exception 'NON_PLATFORM_HOME_RESET'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_request_member_password_reset(tenant,tenant,owner_id,owner_member,null);
  raise exception 'NULL_PLATFORM_RESET'; exception when insufficient_privilege then null; end;
 begin
  perform public.homecare_request_member_password_reset(tenant,tenant,owner_id,member_id,false);
  raise exception 'REVOKED_RESET'; exception when check_violation then if sqlerrm<>'PASSWORD_RESET_NOT_ALLOWED' then raise; end if; end;
 result:=public.homecare_request_member_password_reset(tenant,tenant,owner_id,owner_member,false);
 if result->>'email'<>'quota-owner@example.invalid' or result->>'userId'<>owner_id::text then raise exception 'WRONG_RESET_IDENTITY'; end if;
 if not exists(select 1 from public.homecare_audit_log where tenant_id=tenant and actor_user_id=owner_id and action='password_reset_requested') then raise exception 'RESET_AUDIT_MISSING'; end if;
 begin
  perform public.homecare_request_member_password_reset(tenant,tenant,owner_id,owner_member,false);
  raise exception 'RESET_COOLDOWN_BYPASSED'; exception when check_violation then if sqlerrm<>'PASSWORD_RESET_COOLDOWN' then raise; end if; end;
end $$;
insert into public.homecare_company_user_limits(tenant_id,max_users) values('b2209000-0000-4000-8000-000000000002',9);
-- Actual authenticated RLS: company admins can read only their own quota.
select set_config('request.jwt.claims','{"sub":"a2209000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','a2209000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"b2209000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.homecare_company_user_limits)<>1 then raise exception 'OWN_QUOTA_RLS'; end if;
 if exists(select 1 from public.homecare_company_user_limits where tenant_id='b2209000-0000-4000-8000-000000000002') then raise exception 'FOREIGN_QUOTA_RLS'; end if;
end $$;
reset role;
rollback;
