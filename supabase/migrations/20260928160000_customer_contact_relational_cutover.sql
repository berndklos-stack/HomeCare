-- Phase 3C: relational authority for customers and customer contacts.

alter table public.homecare_customers
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

drop trigger if exists bump_revision on public.homecare_customers;
create trigger bump_revision before update on public.homecare_customers
for each row execute function public.homecare_bump_revision();

create table if not exists public.homecare_customer_contacts (
  id text primary key,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  customer_id text not null,
  name text not null default '',
  role text,
  email text,
  phone text,
  phone2 text,
  notes text,
  is_primary boolean not null default false,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id)
    references public.homecare_customers(tenant_id, id) on delete restrict
);

drop trigger if exists set_updated_at on public.homecare_customer_contacts;
create trigger set_updated_at before update on public.homecare_customer_contacts
for each row execute function public.set_homecare_updated_at();
drop trigger if exists bump_revision on public.homecare_customer_contacts;
create trigger bump_revision before update on public.homecare_customer_contacts
for each row execute function public.homecare_bump_revision();

create index if not exists homecare_customers_tenant_live_idx
  on public.homecare_customers(tenant_id, updated_at desc)
  where deleted_at is null;
create index if not exists homecare_customer_contacts_customer_live_idx
  on public.homecare_customer_contacts(tenant_id, customer_id, updated_at desc)
  where deleted_at is null;
create unique index if not exists homecare_customer_contacts_one_primary_idx
  on public.homecare_customer_contacts(tenant_id, customer_id)
  where is_primary and deleted_at is null;

-- Recover JSON-only customers before the read cutover. Existing relational rows,
-- including tombstones, always win.
with section_customers as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value') = 'array' then state.data->'value' else '[]'::jsonb end
  ) item
  where state.id = 'sync-section:customers'
), snapshot_customers as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'customers') = 'array' then state.data->'customers' else '[]'::jsonb end
  ) item
  where state.id = 'kolaretorp-service-app'
), customer_candidates as (
  select distinct on (tenant_id, item->>'id') tenant_id, item, updated_at
  from (
    select * from section_customers
    union all
    select * from snapshot_customers
  ) candidates
  where nullif(item->>'id', '') is not null
  order by tenant_id, item->>'id', updated_at desc
)
insert into public.homecare_customers (
  id, tenant_id, personal_number, company_name, name, contact, email, phone, phone2,
  address, billing_address, billing_address_mode, language, portal_login_email,
  portal_password, portal_status, balance, notes, report_mail_body,
  weekly_report_mail_body, offer_mail_body, order_confirmation_mail_body,
  work_time_visibility, billable, archived, portal_login_history, created_at, updated_at
)
select
  item->>'id', tenant_id, nullif(item->>'personalNumber', ''), nullif(item->>'company', ''),
  coalesce(nullif(item->>'name', ''), 'Unbenannter Kunde'), nullif(item->>'contact', ''),
  nullif(item->>'email', ''), nullif(item->>'phone', ''), nullif(item->>'phone2', ''),
  nullif(item->>'address', ''), nullif(item->>'billingAddress', ''),
  coalesce(nullif(item->>'billingAddressMode', ''), 'Kundenadresse'),
  coalesce(nullif(item->>'language', ''), 'Deutsch'), nullif(item->>'portalLoginEmail', ''),
  null, coalesce(nullif(item->>'portalStatus', ''), 'einladen'),
  coalesce(public.homecare_text_to_numeric(item->>'balance'), 0), nullif(item->>'notes', ''),
  nullif(item->>'reportMailBody', ''), nullif(item->>'weeklyReportMailBody', ''),
  nullif(item->>'offerMailBody', ''), nullif(item->>'orderConfirmationMailBody', ''),
  coalesce(nullif(item->>'workTimeVisibility', ''), 'service'),
  case when item->>'billable' in ('true','false') then (item->>'billable')::boolean else true end,
  case when item->>'archived' in ('true','false') then (item->>'archived')::boolean else false end,
  case when jsonb_typeof(item->'portalLoginHistory') = 'array' then item->'portalLoginHistory' else '[]'::jsonb end,
  coalesce(nullif(item->>'createdAt', '')::timestamptz, updated_at, now()), coalesce(updated_at, now())
from customer_candidates
on conflict (id) do nothing;

-- Every existing customer receives a deterministic primary-contact identity.
insert into public.homecare_customer_contacts (
  id, tenant_id, customer_id, name, email, phone, phone2, is_primary, created_at, updated_at
)
select
  concat('CONTACT-', md5(customer.tenant_id::text || ':' || customer.id || ':primary')),
  customer.tenant_id, customer.id, coalesce(customer.contact, ''), customer.email,
  customer.phone, customer.phone2, true, customer.created_at, customer.updated_at
from public.homecare_customers customer
where not exists (
  select 1 from public.homecare_customer_contacts contact
  where contact.tenant_id = customer.tenant_id and contact.customer_id = customer.id
)
on conflict (id) do nothing;

-- Preserve any historic additional contacts that may already exist in JSON.
with section_customers as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value') = 'array' then state.data->'value' else '[]'::jsonb end
  ) item
  where state.id = 'sync-section:customers'
), snapshot_customers as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'customers') = 'array' then state.data->'customers' else '[]'::jsonb end
  ) item
  where state.id = 'kolaretorp-service-app'
), customer_candidates as (
  select distinct on (tenant_id, item->>'id') tenant_id, item, updated_at
  from (select * from section_customers union all select * from snapshot_customers) candidates
  where nullif(item->>'id', '') is not null
  order by tenant_id, item->>'id', updated_at desc
), legacy_contacts as (
  select candidate.tenant_id, candidate.item->>'id' customer_id, contact.item, contact.ordinality, candidate.updated_at
  from customer_candidates candidate
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(candidate.item->'contacts') = 'array' then candidate.item->'contacts' else '[]'::jsonb end
  ) with ordinality contact(item, ordinality)
)
insert into public.homecare_customer_contacts (
  id, tenant_id, customer_id, name, role, email, phone, phone2, notes, is_primary, updated_at
)
select
  coalesce(nullif(item->>'id', ''), concat('CONTACT-', md5(tenant_id::text || ':' || customer_id || ':' || ordinality::text))),
  tenant_id, customer_id, coalesce(nullif(item->>'name', ''), ''), nullif(item->>'role', ''),
  nullif(item->>'email', ''), nullif(item->>'phone', ''), nullif(item->>'phone2', ''),
  nullif(item->>'notes', ''), false, coalesce(updated_at, now())
from legacy_contacts contact
where exists (
  select 1 from public.homecare_customers customer
  where customer.tenant_id = contact.tenant_id and customer.id = contact.customer_id
)
on conflict (id) do nothing;

alter table public.homecare_customer_contacts enable row level security;
drop policy if exists tenant_member_read on public.homecare_customer_contacts;
drop policy if exists tenant_member_insert on public.homecare_customer_contacts;
drop policy if exists tenant_member_update on public.homecare_customer_contacts;
drop policy if exists tenant_member_delete on public.homecare_customer_contacts;
create policy tenant_member_read on public.homecare_customer_contacts for select to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'data.read'));
create policy tenant_member_insert on public.homecare_customer_contacts for insert to authenticated
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));
create policy tenant_member_update on public.homecare_customer_contacts for update to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'))
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));
create policy tenant_member_delete on public.homecare_customer_contacts for delete to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));
drop trigger if exists assign_request_tenant on public.homecare_customer_contacts;
create trigger assign_request_tenant before insert on public.homecare_customer_contacts
for each row execute function public.homecare_assign_request_tenant();
revoke all on table public.homecare_customer_contacts from public, anon;
grant select, insert, update, delete on table public.homecare_customer_contacts to authenticated, service_role;

-- Customer writes require customer-specific permission when using PostgREST.
drop policy if exists tenant_member_insert on public.homecare_customers;
drop policy if exists tenant_member_update on public.homecare_customers;
drop policy if exists tenant_member_delete on public.homecare_customers;
create policy tenant_member_insert on public.homecare_customers for insert to authenticated
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));
create policy tenant_member_update on public.homecare_customers for update to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'))
  with check (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));
create policy tenant_member_delete on public.homecare_customers for delete to authenticated
  using (tenant_id = public.homecare_request_tenant() and public.homecare_has_permission(tenant_id, 'customers.manage'));

create or replace function public.homecare_prevent_customer_hard_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Kunden und Ansprechpartner werden archiviert oder per Tombstone gelöscht.' using errcode = '23514';
end;
$$;
drop trigger if exists prevent_customer_hard_delete on public.homecare_customers;
create trigger prevent_customer_hard_delete before delete on public.homecare_customers
for each row execute function public.homecare_prevent_customer_hard_delete();
drop trigger if exists prevent_customer_contact_hard_delete on public.homecare_customer_contacts;
create trigger prevent_customer_contact_hard_delete before delete on public.homecare_customer_contacts
for each row execute function public.homecare_prevent_customer_hard_delete();

create or replace function public.homecare_apply_customer_mutation(
  p_mutation_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_resource_id text,
  p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_mutation public.homecare_sync_mutations%rowtype;
  customer_row public.homecare_customers%rowtype;
  contact_row public.homecare_customer_contacts%rowtype;
  response jsonb;
  tenant uuid := p_tenant_id;
  requested_primary boolean;
begin
  if tenant is null then raise exception 'Mandant fehlt.' using errcode = '22023'; end if;
  if p_entity_type not in ('customer','customer_contact') then
    raise exception 'Nicht unterstützte Kundenmutation: %', p_entity_type using errcode = '22023';
  end if;
  if p_operation not in ('create','update','delete','restore') then
    raise exception 'Unbekannte Kundenoperation: %', p_operation using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(tenant::text || ':' || p_mutation_id::text));
  select * into existing_mutation from public.homecare_sync_mutations
  where tenant_id = tenant and mutation_id = p_mutation_id;
  if found and existing_mutation.status in ('synced','conflict') then
    return existing_mutation.response_payload;
  end if;
  insert into public.homecare_sync_mutations (
    mutation_id, tenant_id, entity_type, entity_id, operation, status,
    expected_revision, request_payload
  ) values (
    p_mutation_id, tenant, p_entity_type, p_entity_id, p_operation, 'syncing',
    p_expected_revision, coalesce(p_payload, '{}'::jsonb)
  ) on conflict (tenant_id, mutation_id) do update set status='syncing',updated_at=now();

  if p_entity_type = 'customer' then
    select * into customer_row from public.homecare_customers
    where tenant_id=tenant and id=p_entity_id for update;
    if p_operation = 'create' then
      if found then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(customer_row),'error','Der Kunde existiert bereits.');
      else
        insert into public.homecare_customers (
          id, tenant_id, personal_number, company_name, name, address, billing_address,
          billing_address_mode, language, portal_login_email, portal_password,
          portal_status, balance, notes, report_mail_body, weekly_report_mail_body,
          offer_mail_body, order_confirmation_mail_body, work_time_visibility,
          billable, archived, portal_login_history, revision, deleted_at
        ) values (
          p_entity_id, tenant, nullif(p_payload->>'personalNumber',''), nullif(p_payload->>'company',''),
          coalesce(nullif(p_payload->>'name',''),'Unbenannter Kunde'), nullif(p_payload->>'address',''),
          nullif(p_payload->>'billingAddress',''), coalesce(nullif(p_payload->>'billingAddressMode',''),'Kundenadresse'),
          coalesce(nullif(p_payload->>'language',''),'Deutsch'), nullif(p_payload->>'portalLoginEmail',''), null,
          coalesce(nullif(p_payload->>'portalStatus',''),'einladen'), coalesce(public.homecare_text_to_numeric(p_payload->>'balance'),0),
          nullif(p_payload->>'notes',''), nullif(p_payload->>'reportMailBody',''),
          nullif(p_payload->>'weeklyReportMailBody',''), nullif(p_payload->>'offerMailBody',''),
          nullif(p_payload->>'orderConfirmationMailBody',''), coalesce(nullif(p_payload->>'workTimeVisibility',''),'service'),
          coalesce((p_payload->>'billable')::boolean,true), coalesce((p_payload->>'archived')::boolean,false),
          case when jsonb_typeof(p_payload->'portalLoginHistory')='array' then p_payload->'portalLoginHistory' else '[]'::jsonb end,
          1, null
        ) returning * into customer_row;
      end if;
    elsif not found then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Kunde existiert auf dem Server nicht mehr.');
    elsif p_expected_revision is not null and customer_row.revision <> p_expected_revision then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(customer_row),'error','Der Kunde wurde auf einem anderen Gerät geändert.');
    elsif p_operation = 'delete' then
      if not customer_row.archived then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(customer_row),'error','Der Kunde muss vor dem Löschen archiviert werden.');
      elsif exists (select 1 from public.homecare_objects where tenant_id=tenant and owner_customer_id=p_entity_id and not archived)
        or exists (select 1 from public.homecare_jobs where tenant_id=tenant and customer_id=p_entity_id and status not in ('erledigt','abgerechnet','storniert'))
        or exists (select 1 from public.homecare_billing_items where tenant_id=tenant and customer_id=p_entity_id and paid_at is null and cancelled_at is null)
        or exists (select 1 from public.homecare_portal_access where tenant_id=tenant and customer_id=p_entity_id and status='active') then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(customer_row),'error','Aktive abhängige Datensätze verhindern das Löschen dieses Kunden.');
      else
        update public.homecare_customers set deleted_at=now(),revision=revision+1
        where tenant_id=tenant and id=p_entity_id returning * into customer_row;
        update public.homecare_customer_contacts set deleted_at=coalesce(deleted_at,now()),revision=revision+1
        where tenant_id=tenant and customer_id=p_entity_id and deleted_at is null;
      end if;
    elsif p_operation = 'restore' then
      update public.homecare_customers set deleted_at=null,revision=revision+1
      where tenant_id=tenant and id=p_entity_id returning * into customer_row;
    else
      update public.homecare_customers customer set
        personal_number=case when p_payload?'personalNumber' then nullif(p_payload->>'personalNumber','') else customer.personal_number end,
        company_name=case when p_payload?'company' then nullif(p_payload->>'company','') else customer.company_name end,
        name=case when p_payload?'name' then coalesce(nullif(p_payload->>'name',''),customer.name) else customer.name end,
        address=case when p_payload?'address' then nullif(p_payload->>'address','') else customer.address end,
        billing_address=case when p_payload?'billingAddress' then nullif(p_payload->>'billingAddress','') else customer.billing_address end,
        billing_address_mode=case when p_payload?'billingAddressMode' then coalesce(nullif(p_payload->>'billingAddressMode',''),'Kundenadresse') else customer.billing_address_mode end,
        language=case when p_payload?'language' then coalesce(nullif(p_payload->>'language',''),'Deutsch') else customer.language end,
        portal_login_email=case when p_payload?'portalLoginEmail' then nullif(p_payload->>'portalLoginEmail','') else customer.portal_login_email end,
        portal_status=case when p_payload?'portalStatus' then coalesce(nullif(p_payload->>'portalStatus',''),'einladen') else customer.portal_status end,
        balance=case when p_payload?'balance' then coalesce(public.homecare_text_to_numeric(p_payload->>'balance'),0) else customer.balance end,
        notes=case when p_payload?'notes' then nullif(p_payload->>'notes','') else customer.notes end,
        report_mail_body=case when p_payload?'reportMailBody' then nullif(p_payload->>'reportMailBody','') else customer.report_mail_body end,
        weekly_report_mail_body=case when p_payload?'weeklyReportMailBody' then nullif(p_payload->>'weeklyReportMailBody','') else customer.weekly_report_mail_body end,
        offer_mail_body=case when p_payload?'offerMailBody' then nullif(p_payload->>'offerMailBody','') else customer.offer_mail_body end,
        order_confirmation_mail_body=case when p_payload?'orderConfirmationMailBody' then nullif(p_payload->>'orderConfirmationMailBody','') else customer.order_confirmation_mail_body end,
        work_time_visibility=case when p_payload?'workTimeVisibility' then coalesce(nullif(p_payload->>'workTimeVisibility',''),'service') else customer.work_time_visibility end,
        billable=case when p_payload?'billable' then (p_payload->>'billable')::boolean else customer.billable end,
        archived=case when p_payload?'archived' then (p_payload->>'archived')::boolean else customer.archived end,
        portal_login_history=case when jsonb_typeof(p_payload->'portalLoginHistory')='array' then p_payload->'portalLoginHistory' else customer.portal_login_history end,
        deleted_at=null,revision=revision+1
      where tenant_id=tenant and id=p_entity_id returning * into customer_row;
    end if;
    if response is null then response := jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(customer_row)); end if;
  else
    select * into contact_row from public.homecare_customer_contacts
    where tenant_id=tenant and id=p_entity_id for update;
    requested_primary := coalesce((p_payload->>'isPrimary')::boolean, contact_row.is_primary, false);
    if p_operation = 'create' then
      if found then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(contact_row),'error','Der Ansprechpartner existiert bereits.');
      elsif not exists (select 1 from public.homecare_customers where tenant_id=tenant and id=p_resource_id and deleted_at is null) then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der zugehörige Kunde existiert nicht oder wurde gelöscht.');
      else
        if requested_primary then
          update public.homecare_customer_contacts set is_primary=false,revision=revision+1
          where tenant_id=tenant and customer_id=p_resource_id and is_primary and deleted_at is null;
        end if;
        insert into public.homecare_customer_contacts (
          id,tenant_id,customer_id,name,role,email,phone,phone2,notes,is_primary,revision,deleted_at
        ) values (
          p_entity_id,tenant,p_resource_id,coalesce(p_payload->>'name',''),nullif(p_payload->>'role',''),
          nullif(p_payload->>'email',''),nullif(p_payload->>'phone',''),nullif(p_payload->>'phone2',''),
          nullif(p_payload->>'notes',''),requested_primary,1,null
        ) returning * into contact_row;
      end if;
    elsif not found or contact_row.customer_id <> p_resource_id then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Ansprechpartner existiert im Kundenkontext nicht mehr.');
    elsif p_expected_revision is not null and contact_row.revision <> p_expected_revision then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(contact_row),'error','Der Ansprechpartner wurde auf einem anderen Gerät geändert.');
    elsif p_operation = 'delete' then
      update public.homecare_customer_contacts set deleted_at=now(),is_primary=false,revision=revision+1
      where tenant_id=tenant and id=p_entity_id returning * into contact_row;
    elsif p_operation = 'restore' then
      if requested_primary then
        update public.homecare_customer_contacts set is_primary=false,revision=revision+1
        where tenant_id=tenant and customer_id=p_resource_id and id<>p_entity_id and is_primary and deleted_at is null;
      end if;
      update public.homecare_customer_contacts set deleted_at=null,is_primary=requested_primary,revision=revision+1
      where tenant_id=tenant and id=p_entity_id returning * into contact_row;
    else
      if requested_primary and not contact_row.is_primary then
        update public.homecare_customer_contacts set is_primary=false,revision=revision+1
        where tenant_id=tenant and customer_id=p_resource_id and id<>p_entity_id and is_primary and deleted_at is null;
      end if;
      update public.homecare_customer_contacts contact set
        name=case when p_payload?'name' then coalesce(p_payload->>'name','') else contact.name end,
        role=case when p_payload?'role' then nullif(p_payload->>'role','') else contact.role end,
        email=case when p_payload?'email' then nullif(p_payload->>'email','') else contact.email end,
        phone=case when p_payload?'phone' then nullif(p_payload->>'phone','') else contact.phone end,
        phone2=case when p_payload?'phone2' then nullif(p_payload->>'phone2','') else contact.phone2 end,
        notes=case when p_payload?'notes' then nullif(p_payload->>'notes','') else contact.notes end,
        is_primary=requested_primary,deleted_at=null,revision=revision+1
      where tenant_id=tenant and id=p_entity_id returning * into contact_row;
    end if;
    if response is null then response := jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(contact_row)); end if;
  end if;

  update public.homecare_sync_mutations set
    applied_at=case when response->>'status'='synced' then now() else null end,
    error=response->>'error',response_payload=response,status=response->>'status',updated_at=now()
  where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
end;
$$;

revoke all on function public.homecare_apply_customer_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.homecare_apply_customer_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;
