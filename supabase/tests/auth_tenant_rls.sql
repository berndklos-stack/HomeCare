-- Run after 20260927100000_auth_tenant_rls_roles.sql in a disposable database.
-- The transaction always rolls back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-owner-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-admin-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-manager-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-office-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-field-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'rls-portal-a@example.invalid', '', now(), now()),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'rls-portal-invite@example.invalid', '', now(), now());

insert into public.homecare_tenants (id, slug, name)
values
  ('20000000-0000-0000-0000-000000000001', 'rls-a', 'RLS A'),
  ('20000000-0000-0000-0000-000000000002', 'rls-b', 'RLS B'),
  ('20000000-0000-0000-0000-000000000003', 'rls-c', 'RLS C');

insert into public.homecare_roles (id, tenant_id, key, name, permissions, system_role)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner', 'Owner', array['data.read','data.write','customers.manage','objects.manage','media.manage','members.manage','roles.manage'], false),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'admin', 'Admin', array['data.read','data.write','customers.manage','objects.manage','media.manage','members.manage','roles.manage'], false),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'manager', 'Manager', array['data.read','data.write','customers.manage','objects.manage','media.manage'], false),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'office', 'Office', array['data.read','data.write','customers.manage'], false),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'field_worker', 'Field worker', array['data.read','jobs.manage'], false),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'owner', 'Owner', array['data.read','data.write','members.manage','roles.manage'], false);

insert into public.homecare_tenant_memberships (tenant_id, user_id, role_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005');

insert into public.homecare_customers (id, tenant_id, name)
values
  ('RLS-CUSTOMER-A', '20000000-0000-0000-0000-000000000001', 'Customer A'),
  ('RLS-CUSTOMER-B', '20000000-0000-0000-0000-000000000002', 'Customer B'),
  ('RLS-CUSTOMER-C', '20000000-0000-0000-0000-000000000003', 'Customer C');

insert into public.homecare_portal_access (tenant_id, user_id, customer_id)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'RLS-CUSTOMER-A');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000001"}', true);

do $$
begin
  if (select count(*) from public.homecare_customers) <> 1 then
    raise exception 'RLS_READ_SCOPE_FAILED';
  end if;
  if exists (select 1 from public.homecare_customers where id = 'RLS-CUSTOMER-B') then
    raise exception 'RLS_CROSS_TENANT_READ_FAILED';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.homecare_customers (id, tenant_id, name)
    values ('RLS-CROSS-WRITE', '20000000-0000-0000-0000-000000000002', 'Forbidden');
    raise exception 'RLS_CROSS_TENANT_WRITE_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
do $$
begin
  begin
    update public.homecare_roles set name = 'Forbidden' where tenant_id = '20000000-0000-0000-0000-000000000001';
    if found then raise exception 'RLS_RESTRICTED_ROLE_WAS_ALLOWED'; end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
update public.homecare_roles
set name = 'Admin allowed'
where tenant_id = '20000000-0000-0000-0000-000000000001' and key = 'admin';

-- Manager and office may write tenant data but may not administer roles.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
insert into public.homecare_customers (id, tenant_id, name)
values ('RLS-MANAGER-WRITE', '20000000-0000-0000-0000-000000000001', 'Manager write');
insert into public.homecare_customer_contacts (id, tenant_id, customer_id, name, is_primary)
values ('RLS-MANAGER-CONTACT', '20000000-0000-0000-0000-000000000001', 'RLS-MANAGER-WRITE', 'Manager contact', true);
insert into public.homecare_objects(id,tenant_id,owner_customer_id,name)
values('RLS-MANAGER-OBJECT','20000000-0000-0000-0000-000000000001','RLS-MANAGER-WRITE','Manager object');
insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name)
values('RLS-MANAGER-MEDIA','20000000-0000-0000-0000-000000000001','object','RLS-MANAGER-OBJECT','Bild','manager.jpg');
do $$
begin
  if public.homecare_has_permission('20000000-0000-0000-0000-000000000001', 'roles.manage') then
    raise exception 'RLS_MANAGER_ADMIN_PERMISSION_WAS_ALLOWED';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
insert into public.homecare_customers (id, tenant_id, name)
values ('RLS-OFFICE-WRITE', '20000000-0000-0000-0000-000000000001', 'Office write');
do $$
begin
  if public.homecare_has_permission('20000000-0000-0000-0000-000000000001', 'roles.manage') then
    raise exception 'RLS_OFFICE_ADMIN_PERMISSION_WAS_ALLOWED';
  end if;
end;
$$;

-- A field worker can read but cannot use the generic data-write policy.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
do $$
begin
  if not public.homecare_has_permission('20000000-0000-0000-0000-000000000001', 'jobs.manage') then
    raise exception 'RLS_FIELD_JOB_PERMISSION_MISSING';
  end if;
  begin
    insert into public.homecare_customers (id, tenant_id, name)
    values ('RLS-FIELD-WRITE', '20000000-0000-0000-0000-000000000001', 'Forbidden');
    raise exception 'RLS_FIELD_GENERIC_WRITE_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.homecare_objects(id,tenant_id,name)
    values('RLS-FIELD-OBJECT','20000000-0000-0000-0000-000000000001','Forbidden object');
    raise exception 'RLS_FIELD_OBJECT_WRITE_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
insert into public.homecare_jobs (id, tenant_id, title, status)
values (
  'RLS-FIELD-JOB-WRITE',
  '20000000-0000-0000-0000-000000000001',
  'Field worker may manage jobs',
  'geplant'
);

-- A multi-company owner may switch to B, but an unassigned tenant C stays hidden.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000002"}', true);
do $$
begin
  if (select count(*) from public.homecare_customers) <> 1
    or not exists (select 1 from public.homecare_customers where id = 'RLS-CUSTOMER-B') then
    raise exception 'RLS_MULTI_COMPANY_ASSIGNED_ACCESS_FAILED';
  end if;
  if exists (select 1 from public.homecare_customer_contacts where id = 'RLS-MANAGER-CONTACT') then
    raise exception 'RLS_CUSTOMER_CONTACT_CROSS_TENANT_READ_ALLOWED';
  end if;
end;
$$;
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000003"}', true);
do $$
begin
  if exists (select 1 from public.homecare_customers) then
    raise exception 'RLS_MULTI_COMPANY_UNASSIGNED_ACCESS_ALLOWED';
  end if;
end;
$$;

-- Portal identities only see their own scope row and no staff-only business rows.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000001"}', true);
do $$
begin
  if (select count(*) from public.homecare_portal_access) <> 1 then
    raise exception 'RLS_PORTAL_SCOPE_READ_FAILED';
  end if;
  if exists (select 1 from public.homecare_customers) then
    raise exception 'RLS_PORTAL_ESCAPED_TO_BUSINESS_DATA';
  end if;
  if exists (select 1 from public.homecare_customer_contacts) then
    raise exception 'RLS_PORTAL_ESCAPED_TO_CUSTOMER_CONTACTS';
  end if;
end;
$$;
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000002"}', true);
do $$
begin
  if exists (select 1 from public.homecare_portal_access) then
    raise exception 'RLS_PORTAL_SCOPE_IGNORED_REQUEST_TENANT';
  end if;
end;
$$;
select set_config('request.headers', '{"x-workcore-tenant":"20000000-0000-0000-0000-000000000001"}', true);

-- The anonymous role has no table grant, independently of RLS.
reset role;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.homecare_customers;
    raise exception 'RLS_ANON_TABLE_ACCESS_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
do $$
declare
  exposed_table text;
begin
  select format('%I.%I', table_schema, table_name)
    into exposed_table
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and (left(table_name, 9) = 'homecare_' or table_name = 'app_state')
  limit 1;

  if exposed_table is not null then
    raise exception 'RLS_ANON_TABLE_GRANT_REMAINS: %', exposed_table;
  end if;
end;
$$;

-- Portal scope assignment is a service-only operation and remains idempotent.
reset role;
set local role authenticated;
do $$
begin
  begin
    perform public.homecare_grant_portal_access(
      '20000000-0000-0000-0000-000000000001',
      'RLS-CUSTOMER-A',
      'rls-portal-invite@example.invalid'
    );
    raise exception 'RLS_AUTHENTICATED_PORTAL_GRANT_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'public.homecare_resources_snapshot()'::regprocedure,
    'public.homecare_apply_sync_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure,
    'public.homecare_apply_resource_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure,
    'public.homecare_grant_portal_access(uuid,text,text)'::regprocedure
  ] loop
    if has_function_privilege('anon', function_signature, 'EXECUTE')
      or has_function_privilege('authenticated', function_signature, 'EXECUTE') then
      raise exception 'RLS_SERVICE_FUNCTION_EXPOSED: %', function_signature;
    end if;
    if not has_function_privilege('service_role', function_signature, 'EXECUTE') then
      raise exception 'RLS_SERVICE_FUNCTION_UNAVAILABLE: %', function_signature;
    end if;
  end loop;

  function_signature := 'public.homecare_save_resources_snapshot(jsonb)'::regprocedure;
  if has_function_privilege('anon', function_signature, 'EXECUTE')
    or has_function_privilege('authenticated', function_signature, 'EXECUTE')
    or has_function_privilege('service_role', function_signature, 'EXECUTE') then
    raise exception 'RLS_LEGACY_RESOURCE_WRITER_EXPOSED: %', function_signature;
  end if;
end;
$$;

reset role;
set local role service_role;
select public.homecare_grant_portal_access(
  '20000000-0000-0000-0000-000000000001',
  'RLS-CUSTOMER-A',
  'rls-portal-invite@example.invalid'
);
reset role;
do $$
begin
  if (select count(*) from public.homecare_portal_access
      where tenant_id = '20000000-0000-0000-0000-000000000001'
        and customer_id = 'RLS-CUSTOMER-A'
        and user_id = '10000000-0000-0000-0000-000000000007'
        and status = 'active') <> 1 then
    raise exception 'RLS_SERVICE_PORTAL_GRANT_FAILED';
  end if;
end;
$$;

rollback;
