begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('a1514000-0000-4000-8000-000000000001','admin-wave-a@example.invalid',now()),
 ('a1514000-0000-4000-8000-000000000002','admin-wave-b@example.invalid',now()),
 ('a1514000-0000-4000-8000-000000000003','admin-wave-worker@example.invalid',now()),
 ('a1514000-0000-4000-8000-000000000004','admin-wave-other@example.invalid',now());
select public.homecare_onboard_company('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','admin-wave-a@example.invalid',
 '{"name":"Pilot A","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"pilot","pilotStartDate":"2026-10-15"}',array['jobs','reports']);
select public.homecare_onboard_company('b1514000-0000-4000-8000-000000000002','a1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000002','admin-wave-b@example.invalid',
 '{"name":"Pilot B","country":"DE","locale":"de","timezone":"Europe/Berlin","accountType":"pilot","pilotStartDate":"2026-10-15"}',array['jobs']);
do $$ begin
 if (select count(*) from public.homecare_roles where tenant_id='b1514000-0000-4000-8000-000000000001')<>5
   or (select count(*) from public.homecare_resource_types where tenant_id='b1514000-0000-4000-8000-000000000001')<>7
   or (select count(*) from public.homecare_tenant_modules where tenant_id='b1514000-0000-4000-8000-000000000001')<>2
   or (select account_type from public.homecare_tenants where id='b1514000-0000-4000-8000-000000000001')<>'pilot'
   or (select value->>'name' from public.homecare_settings where tenant_id='b1514000-0000-4000-8000-000000000001' and key='companySettings')<>'Pilot A' then raise exception 'ONBOARDING_DEFAULTS_MISSING'; end if;
 begin
   perform public.homecare_onboard_company('b1514000-0000-4000-8000-000000000003','a1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','admin-wave-a@example.invalid',
     '{"name":"Rollback","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"pilot","pilotStartDate":"2026-10-15"}',array['INVALID_MODULE']);
   raise exception 'INVALID_MODULE_ACCEPTED';
 exception when invalid_text_representation then null; end;
 if exists(select 1 from public.homecare_tenants where id='b1514000-0000-4000-8000-000000000003') then raise exception 'PARTIAL_COMPANY_REMAINS'; end if;
end $$;
do $$ declare result jsonb; revision_value bigint; begin
 result:=public.homecare_apply_settings_mutation('d1514000-0000-4000-8000-000000000001','setting','companySettings','update','companySettings','b1514000-0000-4000-8000-000000000001',
  '{"value":{"name":"Pilot A","countryCode":"DE","currency":"EUR","organizationNumber":"TEST-123","vatNumber":""}}',1);
 if result->>'status'<>'synced' or (select country_code from public.homecare_tenants where id='b1514000-0000-4000-8000-000000000001')<>'DE' then raise exception 'TYPED_COMPANY_MAPPING_FAILED'; end if;
 select settings_revision into revision_value from public.homecare_tenants where id='b1514000-0000-4000-8000-000000000001';
 perform public.homecare_apply_settings_mutation('d1514000-0000-4000-8000-000000000001','setting','companySettings','update','companySettings','b1514000-0000-4000-8000-000000000001',
  '{"value":{"name":"Pilot A","countryCode":"DE","currency":"EUR","organizationNumber":"TEST-123","vatNumber":""}}',1);
 if (select settings_revision from public.homecare_tenants where id='b1514000-0000-4000-8000-000000000001')<>revision_value then raise exception 'COMPANY_REPLAY_NOT_IDEMPOTENT'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1514000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"b1514000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if public.homecare_accept_invitations()<>1 or public.homecare_accept_invitations()<>0 then raise exception 'ACCEPT_NOT_IDEMPOTENT'; end if;
 if (select count(*) from public.homecare_tenants)<>1 then raise exception 'CROSS_TENANT_COMPANY_READ'; end if;
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','remove');
   raise exception 'CLIENT_ADMIN_RPC_ALLOWED'; exception when insufficient_privilege then null; end;
 begin
   update public.homecare_roles set permissions=array['tenant.admin']; raise exception 'CLIENT_ROLE_WRITE_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin perform public.homecare_admin_directory('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001'); raise exception 'CLIENT_DIRECTORY_ALLOWED'; exception when insufficient_privilege then null; end;
 begin
   update public.homecare_tenant_memberships set status='active'; raise exception 'CLIENT_MEMBER_WRITE_ALLOWED';
 exception when insufficient_privilege then null; end;
 insert into public.homecare_feedback(tenant_id,user_id,category,message,app_version,page_path,user_agent)
 values('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','problem','Explicit test message','test','/','test-browser');
 begin
   insert into public.homecare_feedback(tenant_id,user_id,category,message,app_version,page_path,user_agent)
   values('b1514000-0000-4000-8000-000000000002','a1514000-0000-4000-8000-000000000001','problem','cross-tenant','test','/','test');
   raise exception 'CROSS_TENANT_FEEDBACK_INSERT'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare directory jsonb; begin
 directory:=public.homecare_admin_directory('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','admin-wave-a@example.invalid');
 if (directory->>'total')::integer<>1 or directory->'members'->0->>'email'<>'admin-wave-a@example.invalid' then raise exception 'DIRECTORY_SEARCH_FAILED'; end if;
 directory:=public.homecare_admin_directory('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','','',null,1);
 if directory->'members'<>'[]'::jsonb then raise exception 'DIRECTORY_PAGINATION_FAILED'; end if;
 begin
   perform public.homecare_admin_directory('b1514000-0000-4000-8000-000000000002','a1514000-0000-4000-8000-000000000001');
   raise exception 'CROSS_TENANT_DIRECTORY'; exception when insufficient_privilege then null; end;
end $$;
insert into public.homecare_personnel(id,tenant_id,first_name,last_name) values('ADMIN-WAVE-EMPLOYEE','b1514000-0000-4000-8000-000000000001','Example','Employee');
do $$ declare owner_member uuid; worker_member uuid; worker_role uuid; office_role uuid; result jsonb; begin
 select id into owner_member from public.homecare_tenant_memberships where tenant_id='b1514000-0000-4000-8000-000000000001' and user_id='a1514000-0000-4000-8000-000000000001';
 select id into worker_role from public.homecare_roles where tenant_id='b1514000-0000-4000-8000-000000000001' and key='field_worker';
 select id into office_role from public.homecare_roles where tenant_id='b1514000-0000-4000-8000-000000000001' and key='office';
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','remove',owner_member);
   raise exception 'LAST_OWNER_REMOVED'; exception when check_violation then null; end;
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','role',owner_member,worker_role);
   raise exception 'LAST_OWNER_DEMOTED'; exception when check_violation then null; end;
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000002','remove',owner_member);
   raise exception 'CROSS_TENANT_ADMIN_ALLOWED'; exception when insufficient_privilege then null; end;
 result:=public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','invite',null,worker_role,'ADMIN-WAVE-EMPLOYEE','admin-wave-worker@example.invalid','a1514000-0000-4000-8000-000000000003');
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','invite',null,worker_role,'ADMIN-WAVE-EMPLOYEE','admin-wave-other@example.invalid','a1514000-0000-4000-8000-000000000004');
   raise exception 'EMPLOYEE_LINK_DUPLICATED'; exception when unique_violation then null; end;
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','invite',null,worker_role,null,'admin-wave-worker@example.invalid','a1514000-0000-4000-8000-000000000003');
   raise exception 'DUPLICATE_INVITE_ALLOWED'; exception when unique_violation then null; end;
 select id into worker_member from public.homecare_tenant_memberships where tenant_id='b1514000-0000-4000-8000-000000000001' and user_id='a1514000-0000-4000-8000-000000000003';
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','reactivate',worker_member);
   raise exception 'PENDING_USER_REACTIVATED'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1514000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.homecare_accept_invitations();
do $$ begin
 if (select count(*) from public.homecare_tenant_memberships)<>1 then raise exception 'OTHER_USER_ENUMERATION'; end if;
 if exists(select 1 from public.homecare_feedback) then raise exception 'WORKER_READS_ADMIN_FEEDBACK'; end if;
 begin
   insert into public.homecare_feedback(tenant_id,user_id,category,message,app_version,page_path,user_agent)
   values('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','problem','spoof','test','/','test');
   raise exception 'FEEDBACK_AUTHOR_SPOOFED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare worker_member uuid; office_role uuid; begin
 select id into worker_member from public.homecare_tenant_memberships where tenant_id='b1514000-0000-4000-8000-000000000001' and user_id='a1514000-0000-4000-8000-000000000003';
 select id into office_role from public.homecare_roles where tenant_id='b1514000-0000-4000-8000-000000000001' and key='office';
 begin
   perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000003','role',worker_member,office_role);
   raise exception 'UNAUTHORIZED_ROLE_CHANGE'; exception when insufficient_privilege then null; end;
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','role',worker_member,office_role);
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','suspend',worker_member);
 if exists(select 1 from public.homecare_tenant_memberships where id=worker_member and status='active') then raise exception 'SUSPEND_FAILED'; end if;
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','reactivate',worker_member);
 if not exists(select 1 from public.homecare_tenant_memberships where id=worker_member and status='active') then raise exception 'REACTIVATE_FAILED'; end if;
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','employee',worker_member,null,null);
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','employee',worker_member,null,'ADMIN-WAVE-EMPLOYEE');
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','remove',worker_member);
 if not exists(select 1 from public.homecare_personnel where id='ADMIN-WAVE-EMPLOYEE') or not exists(select 1 from public.homecare_tenant_memberships where id=worker_member and status='revoked' and employee_id is null) then raise exception 'EMPLOYEE_DELETED_OR_LINK_RETAINED'; end if;
 -- A single Auth user can join two companies, with independent memberships.
 perform public.homecare_admin_member('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001','invite',null,office_role,null,'admin-wave-b@example.invalid','a1514000-0000-4000-8000-000000000002');
end $$;
select set_config('request.jwt.claim.sub','a1514000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin if public.homecare_accept_invitations()<>2 then raise exception 'MULTI_COMPANY_ACCEPT_FAILED'; end if; end $$;
select set_config('request.headers','{"x-workcore-tenant":"b1514000-0000-4000-8000-000000000002"}',true);
do $$ begin if (select name from public.homecare_tenants)<>'Pilot B' then raise exception 'TENANT_SWITCH_FAILED'; end if; end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.homecare_feedback; raise exception 'ANON_FEEDBACK_READ'; exception when insufficient_privilege then null; end;
 begin perform public.homecare_accept_invitations(); raise exception 'ANON_ACCEPT'; exception when insufficient_privilege then null; end;
 begin perform public.homecare_find_auth_user('admin-wave-a@example.invalid'); raise exception 'ANON_ENUMERATION'; exception when insufficient_privilege then null; end;
 begin perform public.homecare_admin_directory('b1514000-0000-4000-8000-000000000001','a1514000-0000-4000-8000-000000000001'); raise exception 'ANON_DIRECTORY'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not ('homecare_feedback'=any(public.homecare_relational_backup_tables())) then raise exception 'FEEDBACK_BACKUP_MISSING'; end if;
 if has_table_privilege('authenticated','public.homecare_roles','UPDATE') or has_table_privilege('authenticated','public.homecare_tenant_memberships','UPDATE') then raise exception 'CLIENT_PRIVILEGES_TOO_BROAD'; end if;
end $$;
rollback;
