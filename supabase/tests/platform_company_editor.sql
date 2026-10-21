begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email) values('a2015000-0000-4000-8000-000000000001','platform@example.invalid'),('a2015000-0000-4000-8000-000000000002','owner-b@example.invalid');
select public.homecare_onboard_company('b2015000-0000-4000-8000-000000000001','a2015000-0000-4000-8000-000000000001','a2015000-0000-4000-8000-000000000001','platform@example.invalid',
 '{"name":"Home","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs']);
select public.homecare_onboard_company('b2015000-0000-4000-8000-000000000002','a2015000-0000-4000-8000-000000000002','a2015000-0000-4000-8000-000000000002','owner-b@example.invalid',
 '{"name":"Other creator company","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs','reports']);
update public.homecare_tenant_memberships set status='active' where tenant_id in ('b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002');
update public.homecare_settings set value=value||'{"logoUrl":"data:image/png;base64,AAAA","brandNameInternational":"Keep","address":"Keep address"}'::jsonb
 where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings';
do $$ declare original jsonb; next_profile jsonb; result jsonb; old_home jsonb; begin
 select to_jsonb(t) into old_home from public.homecare_tenants t where id='b2015000-0000-4000-8000-000000000001';
 original:=public.homecare_platform_company_detail('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002');
 next_profile:=(original->'company')||'{"name":"Edited target","country":"DE","locale":"en","timezone":"Europe/Berlin","contactPerson":"Target contact","notes":"Only target"}'::jsonb;
 perform public.homecare_platform_company_update('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002',
  (original->>'revision')::bigint,(original->>'settingsRevision')::bigint,next_profile,array['jobs','inventory']);
 result:=public.homecare_platform_company_detail('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002');
 if result#>>'{company,name}'<>'Edited target' or result#>>'{company,country}'<>'DE' or result#>>'{company,notes}'<>'Only target' then raise exception 'TARGET_NOT_UPDATED'; end if;
 if (select to_jsonb(t) from public.homecare_tenants t where id='b2015000-0000-4000-8000-000000000001') is distinct from old_home then raise exception 'WRONG_COMPANY_UPDATED'; end if;
 if (select value->>'name' from public.homecare_settings where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings')<>'Edited target'
 or (select logo_url from public.homecare_settings where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings')<>'data:image/png;base64,AAAA'
 or (select value->>'brandNameInternational' from public.homecare_settings where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings')<>'Keep' then raise exception 'PROJECTION_OR_LOGO_LOST'; end if;
 if result#>'{company,modules}'<>'["inventory","jobs"]'::jsonb then raise exception 'MODULES_NOT_UPDATED'; end if;
 begin
  perform public.homecare_platform_company_update('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002',
   (original->>'revision')::bigint,(original->>'settingsRevision')::bigint,next_profile,array['jobs']);
  raise exception 'STALE_REVISION_ACCEPTED'; exception when serialization_failure then null; end;
 begin
  perform public.homecare_platform_company_update('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002',
   (result->>'revision')::bigint,(result->>'settingsRevision')::bigint,next_profile||'{"ownerEmail":"hijack@example.invalid"}'::jsonb,array['jobs']);
  raise exception 'OWNER_CHANGED'; exception when check_violation then null; end;
 begin
  perform public.homecare_platform_company_detail('a2015000-0000-4000-8000-000000000002','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002');
  raise exception 'HOME_PERMISSION_BYPASSED'; exception when insufficient_privilege then null; end;
 -- A change in the ordinary company editor invalidates the central editor, even if tenant revision did not change.
 update public.homecare_settings set value=value||'{"bank":"Concurrent bank"}'::jsonb where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings';
 begin
  perform public.homecare_platform_company_update('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002',
   (result->>'revision')::bigint,(result->>'settingsRevision')::bigint,next_profile,array['jobs']);
  raise exception 'CONCURRENT_SETTINGS_OVERWRITTEN'; exception when serialization_failure then null; end;
end $$;
do $$ declare detail jsonb; before_value jsonb; begin
 update public.homecare_tenants set organization_number=null,legal_name='Distinct legal name',default_language='Svenska' where id='b2015000-0000-4000-8000-000000000002';
 update public.homecare_settings set value=value||'{"name":"Conflicting old name","organizationNumber":"LEGACY-ORG"}'::jsonb
  where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings';
 select value into before_value from public.homecare_settings where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings';
 detail:=public.homecare_platform_company_detail('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002');
 if detail#>>'{company,organizationNumber}'<>'LEGACY-ORG' then raise exception 'LEGACY_ORG_NOT_PRESERVED'; end if;
 perform public.homecare_platform_company_update('a2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000001','b2015000-0000-4000-8000-000000000002',
  (detail->>'revision')::bigint,(detail->>'settingsRevision')::bigint,(detail->'company')||'{"notes":"Notes only"}'::jsonb,array['jobs','inventory']);
 if (select value from public.homecare_settings where tenant_id='b2015000-0000-4000-8000-000000000002' and key='companySettings') is distinct from before_value
  or (select organization_number from public.homecare_tenants where id='b2015000-0000-4000-8000-000000000002')<>'LEGACY-ORG'
  or (select legal_name from public.homecare_tenants where id='b2015000-0000-4000-8000-000000000002')<>'Distinct legal name'
  or (select default_language from public.homecare_tenants where id='b2015000-0000-4000-8000-000000000002')<>'Svenska' then raise exception 'LEGACY_VALUES_OVERWRITTEN'; end if;
end $$;
do $$ begin
 if has_function_privilege('anon','public.homecare_platform_company_detail(uuid,uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.homecare_platform_company_detail(uuid,uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])','execute')
 or has_function_privilege('anon','public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])','execute') then raise exception 'CLIENT_PLATFORM_RPC_ACCESS'; end if;
end $$;
rollback;
