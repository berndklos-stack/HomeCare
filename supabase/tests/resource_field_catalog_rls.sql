begin;
do $$ begin
  if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;

-- Check both row security and SQL grants: neither should be the sole protection.
do $$ declare tbl text; privilege text; begin
  foreach tbl in array array['homecare_resource_field_catalog','homecare_resource_types','homecare_resource_type_fields'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||tbl)::regclass) then
      raise exception 'RLS_DISABLED: %',tbl;
    end if;
    if not has_table_privilege('authenticated','public.'||tbl,'SELECT') then raise exception 'AUTH_READ_GRANT_MISSING: %',tbl; end if;
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon','public.'||tbl,privilege) then raise exception 'ANON_GRANT: %/%',tbl,privilege; end if;
      if privilege<>'SELECT' and has_table_privilege('authenticated','public.'||tbl,privilege) then raise exception 'CLIENT_WRITE_GRANT: %/%',tbl,privilege; end if;
    end loop;
    if exists(select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd<>'SELECT') then
      raise exception 'UNEXPECTED_WRITE_POLICY: %',tbl;
    end if;
  end loop;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='homecare_resource_field_catalog' and column_name='tenant_id') then
    raise exception 'CATALOG_BECAME_TENANT_SPECIFIC_REVIEW_GLOBAL_POLICY';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='homecare_resource_field_catalog')<>1 then raise exception 'UNEXPECTED_CATALOG_POLICIES'; end if;
end $$;

insert into auth.users(id,email) values
  ('a1410000-0000-4000-8000-000000000001','catalog-a@example.invalid'),
  ('a1410000-0000-4000-8000-000000000002','catalog-b@example.invalid'),
  ('a1410000-0000-4000-8000-000000000003','catalog-no-read@example.invalid');
insert into public.homecare_tenants(id,slug,name) values
  ('b1410000-0000-4000-8000-000000000001','catalog-rls-a','Catalog test A'),
  ('b1410000-0000-4000-8000-000000000002','catalog-rls-b','Catalog test B');
select public.homecare_seed_resource_types('b1410000-0000-4000-8000-000000000001');
select public.homecare_seed_resource_types('b1410000-0000-4000-8000-000000000002');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
  ('c1410000-0000-4000-8000-000000000001','b1410000-0000-4000-8000-000000000001','catalog-reader','Reader',array['data.read']),
  ('c1410000-0000-4000-8000-000000000002','b1410000-0000-4000-8000-000000000002','catalog-reader','Reader',array['data.read']),
  ('c1410000-0000-4000-8000-000000000003','b1410000-0000-4000-8000-000000000001','catalog-no-read','No read',array[]::text[]);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values
  ('b1410000-0000-4000-8000-000000000001','a1410000-0000-4000-8000-000000000001','c1410000-0000-4000-8000-000000000001'),
  ('b1410000-0000-4000-8000-000000000002','a1410000-0000-4000-8000-000000000002','c1410000-0000-4000-8000-000000000002'),
  ('b1410000-0000-4000-8000-000000000001','a1410000-0000-4000-8000-000000000003','c1410000-0000-4000-8000-000000000003');

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a1410000-0000-4000-8000-000000000001',true);
select set_config('request.headers','{"x-workcore-tenant":"b1410000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ declare statement text; begin
  if (select count(*) from public.homecare_resource_field_catalog)<>34 then raise exception 'GLOBAL_CATALOG_NOT_READABLE'; end if;
  if (select count(*) from public.homecare_resource_types)<>7 then raise exception 'TENANT_A_TYPES'; end if;
  if (select count(*) from public.homecare_resource_type_fields)<>238 then raise exception 'TENANT_A_FIELDS'; end if;
  if exists(select 1 from public.homecare_resource_types where tenant_id<>public.homecare_request_tenant())
    or exists(select 1 from public.homecare_resource_type_fields where tenant_id<>public.homecare_request_tenant()) then raise exception 'CROSS_TENANT_READ'; end if;
  foreach statement in array array[
    $q$insert into public.homecare_resource_field_catalog values('_client_probe','notes','text')$q$,
    $q$update public.homecare_resource_field_catalog set kind='number' where field_key='name'$q$,
    $q$delete from public.homecare_resource_field_catalog where field_key='name'$q$,
    $q$insert into public.homecare_resource_types(tenant_id,id,name,category) values('b1410000-0000-4000-8000-000000000001',gen_random_uuid(),'Client','equipment')$q$,
    $q$update public.homecare_resource_types set name='Forbidden'$q$,
    $q$delete from public.homecare_resource_types$q$,
    $q$insert into public.homecare_resource_type_fields values('b1410000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','_client_probe',true,false,0)$q$,
    $q$update public.homecare_resource_type_fields set display_order=900$q$,
    $q$delete from public.homecare_resource_type_fields$q$
  ] loop
    begin execute statement; raise exception 'CLIENT_WRITE_SUCCEEDED: %',statement;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;

-- A forged tenant header must not expose another tenant's configuration.
select set_config('request.headers','{"x-workcore-tenant":"b1410000-0000-4000-8000-000000000002"}',true);
do $$ begin
  if exists(select 1 from public.homecare_resource_types) or exists(select 1 from public.homecare_resource_type_fields) then raise exception 'FORGED_TENANT_READ'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1410000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.homecare_resource_types)<>7 or (select count(*) from public.homecare_resource_type_fields)<>238 then raise exception 'TENANT_B_NOT_READABLE'; end if;
  if (select count(*) from public.homecare_resource_field_catalog)<>34 then raise exception 'CATALOG_DIFFERS_BY_TENANT'; end if;
end $$;
select set_config('request.jwt.claim.sub','a1410000-0000-4000-8000-000000000003',true);
select set_config('request.headers','{"x-workcore-tenant":"b1410000-0000-4000-8000-000000000001"}',true);
do $$ begin
  if exists(select 1 from public.homecare_resource_types) or exists(select 1 from public.homecare_resource_type_fields) then raise exception 'DATA_READ_PERMISSION_BYPASSED'; end if;
  if (select count(*) from public.homecare_resource_field_catalog)<>34 then raise exception 'GLOBAL_CATALOG_REQUIRES_TENANT_PERMISSION'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.headers','{}',true);
do $$ begin
  if (select count(*) from public.homecare_resource_field_catalog)<>34 then raise exception 'AUTHENTICATED_GLOBAL_READ_REQUIRES_MEMBERSHIP'; end if;
  if exists(select 1 from public.homecare_resource_types) or exists(select 1 from public.homecare_resource_type_fields) then raise exception 'MISSING_CONTEXT_EXPOSES_TENANT_ROWS'; end if;
end $$;
reset role;

-- Even accidentally re-granted DML must not bypass the catalog's RLS.
grant insert,update,delete on public.homecare_resource_field_catalog to authenticated;
set local role authenticated;
do $$ declare affected bigint; begin
  begin
    insert into public.homecare_resource_field_catalog values('_rls_probe','notes','text');
    raise exception 'RLS_INSERT_ALLOWED';
  exception when insufficient_privilege then null; end;
  update public.homecare_resource_field_catalog set kind='number' where field_key='name';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'RLS_UPDATE_ALLOWED'; end if;
  delete from public.homecare_resource_field_catalog where field_key='name';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'RLS_DELETE_ALLOWED'; end if;
end $$;
reset role;
revoke insert,update,delete on public.homecare_resource_field_catalog from authenticated;

select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $$ declare tbl text; begin
  foreach tbl in array array['homecare_resource_field_catalog','homecare_resource_types','homecare_resource_type_fields'] loop
    begin execute format('select * from public.%I',tbl); raise exception 'ANON_READ_ALLOWED: %',tbl;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;

-- The SELECT policy itself must exclude anon, independently of table grants.
grant select on public.homecare_resource_field_catalog to anon;
set local role anon;
do $$ begin
  if exists(select 1 from public.homecare_resource_field_catalog) then raise exception 'RLS_ANON_READ_ALLOWED'; end if;
end $$;
reset role;
revoke select on public.homecare_resource_field_catalog from anon;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
insert into public.homecare_resource_field_catalog values('_admin_probe','notes','text');
update public.homecare_resource_field_catalog set kind='number' where field_key='_admin_probe';
do $$ begin
  if not exists(select 1 from public.homecare_resource_field_catalog where field_key='_admin_probe' and kind='number') then raise exception 'TRUSTED_WRITE_BLOCKED'; end if;
end $$;
delete from public.homecare_resource_field_catalog where field_key='_admin_probe';
reset role;
rollback;
