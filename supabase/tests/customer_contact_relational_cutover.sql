-- Run after 20260928160000_customer_contact_relational_cutover.sql.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants (id, slug, name)
values
  ('70000000-0000-0000-0000-000000000001', 'customer-cutover-a', 'Customer cutover A'),
  ('70000000-0000-0000-0000-000000000002', 'customer-cutover-b', 'Customer cutover B')
on conflict (id) do update set slug=excluded.slug,name=excluded.name;

create temporary table customer_results (key text primary key, result jsonb not null);

insert into customer_results values (
  'create', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000001','customer','CUSTOMER-A','create','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001',
    '{"name":"Customer A","company":"A AB","archived":false,"portalLoginHistory":[]}'::jsonb,null
  )
), (
  'retry', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000001','customer','CUSTOMER-A','create','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{}'::jsonb,null
  )
), (
  'other-tenant', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000001','customer','CUSTOMER-B','create','CUSTOMER-B',
    '70000000-0000-0000-0000-000000000002','{"name":"Customer B"}'::jsonb,null
  )
);

insert into customer_results values (
  'update', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000002','customer','CUSTOMER-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{"name":"Customer A updated","notes":"Revision two"}'::jsonb,1
  )
), (
  'stale', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000003','customer','CUSTOMER-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{"name":"Must not win"}'::jsonb,1
  )
), (
  'cross-tenant', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000004','customer','CUSTOMER-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000002','{"name":"Cross tenant"}'::jsonb,2
  )
);

do $$
begin
  if (select result->>'status' from customer_results where key='create') <> 'synced'
    or (select result from customer_results where key='create') <> (select result from customer_results where key='retry')
    or (select result->>'status' from customer_results where key='update') <> 'synced'
    or (select result->>'status' from customer_results where key='stale') <> 'conflict'
    or (select result->>'status' from customer_results where key='cross-tenant') <> 'conflict'
    or (select revision from public.homecare_customers where tenant_id='70000000-0000-0000-0000-000000000001' and id='CUSTOMER-A') <> 2
    or (select name from public.homecare_customers where tenant_id='70000000-0000-0000-0000-000000000001' and id='CUSTOMER-A') <> 'Customer A updated'
    or (select count(*) from public.homecare_sync_mutations where mutation_id='71000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'CUSTOMER_IDEMPOTENCY_REVISION_OR_TENANT_SCOPE_FAILED';
  end if;
end;
$$;

insert into customer_results values (
  'contact-create', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000005','customer_contact','CONTACT-A','create','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001',
    '{"name":"Anna Contact","email":"anna@example.test","phone":"+46 1","isPrimary":true}'::jsonb,null
  )
), (
  'contact-update', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000006','customer_contact','CONTACT-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001',
    '{"email":"anna.updated@example.test","isPrimary":true}'::jsonb,1
  )
), (
  'contact-stale', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000007','customer_contact','CONTACT-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{"phone":"must-not-win"}'::jsonb,1
  )
), (
  'contact-delete', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000008','customer_contact','CONTACT-A','delete','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{}'::jsonb,2
  )
);

do $$
begin
  if (select result->>'status' from customer_results where key='contact-create') <> 'synced'
    or (select result->>'status' from customer_results where key='contact-update') <> 'synced'
    or (select result->>'status' from customer_results where key='contact-stale') <> 'conflict'
    or (select result->>'status' from customer_results where key='contact-delete') <> 'synced'
    or not exists (
      select 1 from public.homecare_customer_contacts
      where tenant_id='70000000-0000-0000-0000-000000000001' and id='CONTACT-A'
        and revision=3 and deleted_at is not null
    ) then
    raise exception 'CONTACT_CRUD_REVISION_OR_TOMBSTONE_FAILED';
  end if;
end;
$$;

insert into public.homecare_objects (tenant_id,id,owner_customer_id,name,archived)
values ('70000000-0000-0000-0000-000000000001','OBJECT-A','CUSTOMER-A','Object A',false);
insert into public.homecare_jobs (tenant_id,id,object_id,customer_id,title,status,priority)
values ('70000000-0000-0000-0000-000000000001','JOB-A','OBJECT-A','CUSTOMER-A','Closed job','erledigt','normal');

insert into customer_results values (
  'archive', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000009','customer','CUSTOMER-A','update','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{"archived":true}'::jsonb,2
  )
), (
  'delete-blocked', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000010','customer','CUSTOMER-A','delete','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{}'::jsonb,3
  )
);

update public.homecare_objects set archived=true where tenant_id='70000000-0000-0000-0000-000000000001' and id='OBJECT-A';

insert into customer_results values (
  'delete', public.homecare_apply_customer_mutation(
    '71000000-0000-0000-0000-000000000011','customer','CUSTOMER-A','delete','CUSTOMER-A',
    '70000000-0000-0000-0000-000000000001','{}'::jsonb,3
  )
);

insert into public.app_state (tenant_id,id,data)
values (
  '70000000-0000-0000-0000-000000000001','sync-section:customers',
  '{"value":[{"id":"CUSTOMER-A","name":"Legacy resurrection"}]}'::jsonb
)
on conflict (tenant_id,id) do update set data=excluded.data;

do $$
begin
  if (select result->>'status' from customer_results where key='archive') <> 'synced'
    or (select result->>'status' from customer_results where key='delete-blocked') <> 'conflict'
    or (select result->>'status' from customer_results where key='delete') <> 'synced'
    or not exists (
      select 1 from public.homecare_customers
      where tenant_id='70000000-0000-0000-0000-000000000001' and id='CUSTOMER-A'
        and deleted_at is not null and revision=4
    )
    or not exists (
      select 1 from public.homecare_objects
      where tenant_id='70000000-0000-0000-0000-000000000001' and id='OBJECT-A' and owner_customer_id='CUSTOMER-A'
    )
    or not exists (
      select 1 from public.homecare_jobs
      where tenant_id='70000000-0000-0000-0000-000000000001' and id='JOB-A' and customer_id='CUSTOMER-A'
    )
    or (select name from public.homecare_customers where tenant_id='70000000-0000-0000-0000-000000000001' and id='CUSTOMER-A') = 'Legacy resurrection' then
    raise exception 'CUSTOMER_DELETE_GUARD_REFERENCE_OR_NO_RESURRECTION_FAILED';
  end if;
end;
$$;

do $$
begin
  begin
    delete from public.homecare_customers
    where tenant_id='70000000-0000-0000-0000-000000000002' and id='CUSTOMER-B';
    raise exception 'CUSTOMER_HARD_DELETE_WAS_NOT_BLOCKED';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
