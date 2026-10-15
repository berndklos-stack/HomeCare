begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into public.homecare_tenants(id,slug,name) values
 ('b1520000-0000-4000-8000-000000000001','logo-a','Logo A'),
 ('b1520000-0000-4000-8000-000000000002','logo-b','Logo B');
insert into auth.users(id,email) values('a1520000-0000-4000-8000-000000000001','logo@example.invalid');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
 ('c1520000-0000-4000-8000-000000000001','b1520000-0000-4000-8000-000000000001','logo-reader','Reader',array['data.read']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status) values
 ('b1520000-0000-4000-8000-000000000001','a1520000-0000-4000-8000-000000000001','c1520000-0000-4000-8000-000000000001','active');
insert into public.homecare_settings(tenant_id,key,value) values
 ('b1520000-0000-4000-8000-000000000001','companySettings','{"name":"Logo A","logoUrl":"data:image/png;base64,AAAA"}'),
 ('b1520000-0000-4000-8000-000000000002','companySettings','{"name":"Logo B","logoUrl":"https://example.invalid/b.png"}');
do $$ declare result jsonb; rev bigint; begin
 if (select logo_url from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>'data:image/png;base64,AAAA' then raise exception 'LOGO_COLUMN_NOT_WRITTEN'; end if;
 result:=public.homecare_apply_settings_mutation('d1520000-0000-4000-8000-000000000001','setting','companySettings','update','companySettings','b1520000-0000-4000-8000-000000000001',
   '{"value":{"name":"Logo A","logoUrl":"https://example.invalid/a.png"}}',1);
 if result->>'status'<>'synced' or result#>>'{record,logo_url}'<>'https://example.invalid/a.png' then raise exception 'LOGO_SYNC_FAILED'; end if;
 select revision into rev from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001';
 perform public.homecare_apply_settings_mutation('d1520000-0000-4000-8000-000000000001','setting','companySettings','update','companySettings','b1520000-0000-4000-8000-000000000001',
   '{"value":{"logoUrl":""}}',1);
 if (select revision from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>rev then raise exception 'LOGO_REPLAY_CHANGED_REVISION'; end if;
 result:=public.homecare_apply_settings_mutation('d1520000-0000-4000-8000-000000000002','setting','companySettings','update','companySettings','b1520000-0000-4000-8000-000000000001','{"value":{"logoUrl":""}}',1);
 if result->>'status'<>'conflict' then raise exception 'STALE_LOGO_ACCEPTED'; end if;
 update public.homecare_settings set value='{"name":"New name"}' where tenant_id='b1520000-0000-4000-8000-000000000001';
 if (select logo_url from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>'https://example.invalid/a.png' then raise exception 'OLD_CLIENT_REMOVED_LOGO'; end if;
 update public.homecare_settings set logo_url='https://example.invalid/canonical.png',value='{"logoUrl":"https://example.invalid/stale.png"}' where tenant_id='b1520000-0000-4000-8000-000000000001';
 if (select value->>'logoUrl' from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>'https://example.invalid/canonical.png' then raise exception 'COLUMN_NOT_AUTHORITATIVE'; end if;
 begin
   update public.homecare_settings set value=jsonb_set(value,'{logoUrl}','"javascript:alert(1)"') where tenant_id='b1520000-0000-4000-8000-000000000001';
   raise exception 'UNSAFE_LOGO_ACCEPTED'; exception when check_violation then null;
 end;
 begin
   update public.homecare_settings set value=jsonb_set(value,'{logoUrl}','42') where tenant_id='b1520000-0000-4000-8000-000000000001';
   raise exception 'NUMERIC_LOGO_ACCEPTED'; exception when check_violation then null;
 end;
 begin
   insert into public.homecare_settings(tenant_id,key,value,logo_url) values('b1520000-0000-4000-8000-000000000001','dailyMailSettings','{}','https://example.invalid/logo.png');
   raise exception 'NON_COMPANY_LOGO_ACCEPTED'; exception when check_violation then null;
 end;
 update public.homecare_settings set value=jsonb_set(value,'{logoUrl}','null') where tenant_id='b1520000-0000-4000-8000-000000000001';
 if not exists(select 1 from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001'
   and logo_url is null and value->'logoUrl'='null'::jsonb) then raise exception 'LEGACY_NULL_LOGO_CHANGED'; end if;
 update public.homecare_settings set value=jsonb_set(value,'{logoUrl}','""') where tenant_id='b1520000-0000-4000-8000-000000000001';
 if (select logo_url from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>'' then raise exception 'LOGO_REMOVAL_FAILED'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1520000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"b1520000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.homecare_settings)<>1 then raise exception 'LOGO_TENANT_ISOLATION_FAILED'; end if;
 if exists(select 1 from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000002') then raise exception 'FOREIGN_LOGO_READ'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform logo_url from public.homecare_settings; raise exception 'ANON_LOGO_ACCESS'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare backup jsonb; names text; begin
 backup:=public.homecare_create_relational_backup('b1520000-0000-4000-8000-000000000001','logo-test');
 if not exists(select 1 from public.homecare_relational_backups b,
   lateral jsonb_array_elements(b.payload->'homecare_settings') s where b.id=(backup->>'id')::uuid and s->>'logo_url'='') then raise exception 'LOGO_BACKUP_MISSING'; end if;
 update public.homecare_settings set logo_url='https://example.invalid/changed.png' where tenant_id='b1520000-0000-4000-8000-000000000001';
 set constraints all immediate;
 select string_agg(format('public.%I',tbl),',') into names from unnest(public.homecare_relational_backup_tables()) tbl;
 -- Only the guarded disposable local cluster; rollback restores all test fixtures.
 execute 'truncate table '||names||' cascade';
 set constraints all deferred;
 perform public.homecare_restore_relational_backup((backup->>'id')::uuid,'b1520000-0000-4000-8000-000000000001');
 if (select logo_url from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000001')<>'' then raise exception 'LOGO_RESTORE_FAILED'; end if;
end $$;
rollback;
