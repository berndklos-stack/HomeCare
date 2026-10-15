begin;

alter table public.homecare_tenants
  add column if not exists country_code text check (country_code ~ '^[A-Z]{2}$'),
  add column if not exists locale text check (locale in ('de','sv','en')),
  add column if not exists timezone text,
  add column if not exists account_type text not null default 'production' check (account_type in ('production','pilot','demo')),
  add column if not exists pilot_start_date date,
  add column if not exists pilot_end_date date,
  add column if not exists contact_person text,
  add column if not exists internal_label text,
  add column if not exists administration_notes text,
  add column if not exists onboarded_by uuid references auth.users(id) on delete set null;
alter table public.homecare_tenants add constraint company_pilot_dates_ck
  check (pilot_end_date is null or (pilot_start_date is not null and pilot_end_date >= pilot_start_date));
alter table public.homecare_tenants add constraint company_pilot_start_ck check(account_type<>'pilot' or pilot_start_date is not null);
create index if not exists company_onboarded_by_idx on public.homecare_tenants(onboarded_by);

alter table public.homecare_tenant_memberships add column if not exists employee_id text;
create unique index if not exists roles_tenant_id_id_unique on public.homecare_roles(tenant_id,id);
alter table public.homecare_tenant_memberships add constraint membership_employee_tenant_fk
  foreign key(tenant_id,employee_id) references public.homecare_personnel(tenant_id,id);
alter table public.homecare_tenant_memberships add constraint membership_role_tenant_fk
  foreign key(tenant_id,role_id) references public.homecare_roles(tenant_id,id) not valid;
-- Preserve legacy profile links. Ambiguous links fail the unique constraint instead of choosing a user.
update public.homecare_tenant_memberships m set employee_id=p.personnel_id
from public.homecare_user_profiles p
where m.user_id=p.id and m.tenant_id=p.tenant_id and m.employee_id is null
  and p.personnel_id is not null
  and exists(select 1 from public.homecare_personnel e where e.tenant_id=m.tenant_id and e.id=p.personnel_id);
create unique index membership_employee_unique on public.homecare_tenant_memberships(tenant_id,employee_id) where employee_id is not null;
create index membership_role_tenant_idx on public.homecare_tenant_memberships(tenant_id,role_id);
alter table public.homecare_tenant_memberships validate constraint membership_role_tenant_fk;

alter table public.homecare_user_invitations
  alter column token_hash drop not null,
  add column if not exists role_id uuid,
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists delivery_status text not null default 'legacy' check(delivery_status in ('legacy','pending','sent','failed','accepted','revoked')),
  add column if not exists last_sent_at timestamptz,
  add column if not exists delivery_error text;
alter table public.homecare_user_invitations add constraint invitation_role_tenant_fk
  foreign key(tenant_id,role_id) references public.homecare_roles(tenant_id,id);
create unique index invitation_pending_email_unique on public.homecare_user_invitations(tenant_id,lower(email))
  where delivery_status in ('pending','sent','failed');
create index invitation_auth_user_idx on public.homecare_user_invitations(auth_user_id);
create index invitation_role_idx on public.homecare_user_invitations(tenant_id,role_id);

create table public.homecare_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id),
  user_id uuid not null references auth.users(id),
  category text not null check(category in ('problem','improvement','feature')),
  message text not null check(length(trim(message)) between 1 and 5000),
  app_version text not null check(length(app_version)<=40),
  page_path text not null check(length(page_path)<=240 and page_path ~ '^/[^?#]*$'),
  user_agent text not null check(length(user_agent)<=512),
  created_at timestamptz not null default now()
);
create index feedback_tenant_created_idx on public.homecare_feedback(tenant_id,created_at desc);
create index feedback_user_idx on public.homecare_feedback(user_id);
alter table public.homecare_feedback enable row level security;
revoke all on public.homecare_feedback from public,anon,authenticated;
grant select,insert on public.homecare_feedback to authenticated;
grant all on public.homecare_feedback to service_role;
create policy feedback_read on public.homecare_feedback for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and public.homecare_is_tenant_member(tenant_id)
    and (user_id=(select auth.uid()) or public.homecare_has_permission(tenant_id,'tenant.admin')));
create policy feedback_insert on public.homecare_feedback for insert to authenticated
  with check(tenant_id=public.homecare_request_tenant() and user_id=(select auth.uid()) and public.homecare_is_tenant_member(tenant_id));

-- Membership writes go through the protected administration service, never browser DML.
revoke insert,update,delete on public.homecare_tenant_memberships,public.homecare_roles,public.homecare_user_invitations from authenticated;
revoke all on public.homecare_tenant_memberships,public.homecare_roles,public.homecare_user_invitations from public,anon;
grant select on public.homecare_user_invitations to authenticated;
grant all on public.homecare_tenant_memberships,public.homecare_roles,public.homecare_user_invitations to service_role;
drop policy if exists memberships_admin_write on public.homecare_tenant_memberships;
drop policy if exists memberships_self_read on public.homecare_tenant_memberships;
create policy memberships_self_read on public.homecare_tenant_memberships for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and (user_id=(select auth.uid()) or public.homecare_has_permission(tenant_id,'members.manage')));
drop policy if exists roles_admin_write on public.homecare_roles;
create policy invitations_admin_read on public.homecare_user_invitations for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'members.manage'));

create or replace function public.homecare_protect_last_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and (new.tenant_id<>old.tenant_id or new.user_id<>old.user_id) then
    raise exception 'MEMBERSHIP_IDENTITY_IMMUTABLE' using errcode='23514';
  end if;
  if old.status='active' and exists(select 1 from public.homecare_roles where id=old.role_id and tenant_id=old.tenant_id and key='owner')
    and (tg_op='DELETE' or new.status<>'active' or new.role_id<>old.role_id) then
    perform 1 from public.homecare_tenants where id=old.tenant_id for update;
    if not exists(select 1 from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
      where m.tenant_id=old.tenant_id and m.id<>old.id and m.status='active' and r.key='owner') then
      raise exception 'LAST_OWNER_PROTECTED' using errcode='23514';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.homecare_protect_last_owner() from public,anon,authenticated;
create trigger protect_last_owner before update or delete on public.homecare_tenant_memberships
  for each row execute function public.homecare_protect_last_owner();

-- Only returns an ID to the trusted service. Never exposes the global Auth directory to clients.
create function public.homecare_find_auth_user(p_email text) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
  select id from auth.users where lower(email)=lower(trim(p_email)) limit 1
$$;
revoke all on function public.homecare_find_auth_user(text) from public,anon,authenticated;
grant execute on function public.homecare_find_auth_user(text) to service_role;

create function public.homecare_admin_member(p_tenant uuid,p_actor uuid,p_action text,p_target uuid default null,
  p_role uuid default null,p_employee text default null,p_email text default null,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_role text; target public.homecare_tenant_memberships%rowtype; invitation public.homecare_user_invitations%rowtype; selected_role public.homecare_roles%rowtype;
begin
  perform 1 from public.homecare_tenants where id=p_tenant for update;
  select r.key into actor_role from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
    where m.tenant_id=p_tenant and m.user_id=p_actor and m.status='active' and 'members.manage'=any(r.permissions);
  if actor_role is null then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  if p_action in ('invite','role') then
    select * into selected_role from public.homecare_roles where tenant_id=p_tenant and id=p_role;
    if not found or (selected_role.key='owner' and actor_role<>'owner') then raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action='invite' then
    if p_user is null or not exists(select 1 from auth.users where id=p_user and lower(email)=lower(trim(p_email))) then
      raise exception 'INVITATION_IDENTITY_MISMATCH' using errcode='23514'; end if;
    if exists(select 1 from public.homecare_tenant_memberships where tenant_id=p_tenant and user_id=p_user and status<>'revoked') then
      raise exception 'MEMBER_ALREADY_EXISTS' using errcode='23505'; end if;
    if exists(select 1 from public.homecare_user_invitations where tenant_id=p_tenant and lower(email)=lower(trim(p_email)) and delivery_status in ('pending','sent','failed')) then
      raise exception 'INVITATION_ALREADY_EXISTS' using errcode='23505'; end if;
    if p_employee is not null and not exists(select 1 from public.homecare_personnel where tenant_id=p_tenant and id=p_employee and deleted_at is null and not archived) then
      raise exception 'EMPLOYEE_NOT_FOUND' using errcode='23514'; end if;
    insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status,employee_id)
      values(p_tenant,p_user,p_role,'suspended',p_employee)
      on conflict(tenant_id,user_id) do update set role_id=excluded.role_id,status='suspended',employee_id=excluded.employee_id,updated_at=now();
    insert into public.homecare_user_invitations(tenant_id,email,role,role_id,personnel_id,auth_user_id,invited_by,expires_at,delivery_status)
      values(p_tenant,lower(trim(p_email)),case selected_role.key when 'field_worker' then 'field_staff'::public.homecare_user_role
        when 'owner' then 'owner'::public.homecare_user_role when 'admin' then 'admin'::public.homecare_user_role else 'office'::public.homecare_user_role end,
        p_role,p_employee,p_user,p_actor,now()+interval '7 days','pending') returning * into invitation;
    insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action)
      values(p_tenant,p_actor,'invitation',invitation.id::text,'invite');
    return jsonb_build_object('invitationId',invitation.id,'userId',p_user);
  end if;
  select * into target from public.homecare_tenant_memberships where tenant_id=p_tenant and id=p_target for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode='P0002'; end if;
  if exists(select 1 from public.homecare_roles where id=target.role_id and key='owner') and actor_role<>'owner' then
    raise exception 'OWNER_CHANGE_FORBIDDEN' using errcode='42501'; end if;
  if p_action='role' then
    update public.homecare_tenant_memberships set role_id=p_role,updated_at=now() where id=target.id;
    update public.homecare_user_invitations set role_id=p_role where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed');
  elsif p_action='employee' then
    if p_employee is not null and not exists(select 1 from public.homecare_personnel where tenant_id=p_tenant and id=p_employee and deleted_at is null and not archived) then
      raise exception 'EMPLOYEE_NOT_FOUND' using errcode='23514'; end if;
    update public.homecare_tenant_memberships set employee_id=p_employee,updated_at=now() where id=target.id;
  elsif p_action in ('suspend','reactivate','remove') then
    if p_action='reactivate' and exists(select 1 from public.homecare_user_invitations where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed')) then
      raise exception 'INVITATION_ACCEPTANCE_REQUIRED' using errcode='23514'; end if;
    if p_action='reactivate' and (not exists(select 1 from auth.users where id=target.user_id and email_confirmed_at is not null)
      or coalesce((select accepted_at is null from public.homecare_user_invitations where tenant_id=p_tenant and auth_user_id=target.user_id order by created_at desc limit 1),false)) then
      raise exception 'INVITATION_ACCEPTANCE_REQUIRED' using errcode='23514'; end if;
    update public.homecare_tenant_memberships set status=case p_action when 'suspend' then 'suspended' when 'remove' then 'revoked' else 'active' end,
      employee_id=case when p_action='remove' then null else employee_id end,updated_at=now() where id=target.id;
    if p_action in ('suspend','remove') then
      update public.homecare_user_invitations set delivery_status='revoked' where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed');
    end if;
  else raise exception 'INVALID_ADMIN_ACTION' using errcode='23514'; end if;
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action)
    values(p_tenant,p_actor,'membership',target.id::text,p_action);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.homecare_admin_member(uuid,uuid,text,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.homecare_admin_member(uuid,uuid,text,uuid,uuid,text,text,uuid) to service_role;

create function public.homecare_accept_invitations() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare invitation record; accepted integer:=0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  for invitation in select i.* from public.homecare_user_invitations i join auth.users u on u.id=i.auth_user_id
    where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=lower(i.email)
      and i.delivery_status in ('pending','sent','failed') and i.expires_at>now() for update of i loop
    update public.homecare_tenant_memberships set status='active',updated_at=now()
      where tenant_id=invitation.tenant_id and user_id=auth.uid() and status='suspended';
    if found then
      update public.homecare_user_invitations set delivery_status='accepted',accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
      accepted:=accepted+1;
    end if;
  end loop;
  return accepted;
end $$;
revoke all on function public.homecare_accept_invitations() from public,anon;
grant execute on function public.homecare_accept_invitations() to authenticated;

create function public.homecare_onboard_company(p_id uuid,p_actor uuid,p_owner uuid,p_email text,p_company jsonb,p_modules text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_role uuid; role_row record; country text:=p_company->>'country'; locale_value text:=p_company->>'locale';
begin
  if not exists(select 1 from auth.users where id=p_owner and lower(email)=lower(trim(p_email))) then raise exception 'OWNER_NOT_FOUND'; end if;
  if nullif(trim(p_company->>'name'),'') is null or length(trim(p_company->>'name'))>200
    or country is null or country not in ('SE','DE','AT','CH','GB','US') or locale_value is null or locale_value not in ('de','sv','en')
    or not exists(select 1 from pg_timezone_names where name=p_company->>'timezone') then raise exception 'INVALID_COMPANY' using errcode='23514'; end if;
  if exists(select 1 from public.homecare_tenants where id=p_id) then raise exception 'COMPANY_ALREADY_CREATED' using errcode='23505'; end if;
  insert into public.homecare_tenants(id,slug,name,legal_name,country_code,locale,timezone,default_language,default_currency,
    organization_number,vat_number,email,account_type,pilot_start_date,pilot_end_date,contact_person,internal_label,administration_notes,onboarded_by)
  values(p_id,'company-'||p_id::text,trim(p_company->>'name'),trim(p_company->>'name'),country,locale_value,p_company->>'timezone',
    case locale_value when 'sv' then 'Svenska' when 'en' then 'English' else 'Deutsch' end,case country when 'SE' then 'SEK' when 'GB' then 'GBP' when 'US' then 'USD' when 'CH' then 'CHF' else 'EUR' end,
    nullif(p_company->>'organizationNumber',''),nullif(p_company->>'vatNumber',''),lower(trim(p_email)),p_company->>'accountType',
    nullif(p_company->>'pilotStartDate','')::date,nullif(p_company->>'pilotEndDate','')::date,p_company->>'contactPerson',p_company->>'internalLabel',p_company->>'notes',p_actor);
  for role_row in select * from (values
    ('owner','Owner',array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write','backups.manage','tenant.admin','members.manage','roles.manage']::text[]),
    ('admin','Admin',array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write','backups.manage','tenant.admin','members.manage','roles.manage']::text[]),
    ('manager','Manager',array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write']::text[]),
    ('office','Office',array['data.read','data.write','customers.manage','objects.manage','jobs.manage','invoices.manage','resources.manage','media.manage','communication.send','sync.write']::text[]),
    ('field_worker','Field worker',array['data.read','jobs.manage','resources.manage','media.manage','sync.write']::text[])
  ) r(key,name,permissions) loop
    insert into public.homecare_roles(tenant_id,key,name,permissions,system_role) values(p_id,role_row.key,role_row.name,role_row.permissions,true);
  end loop;
  select id into owner_role from public.homecare_roles where tenant_id=p_id and key='owner';
  insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status) values(p_id,p_owner,owner_role,'suspended');
  insert into public.homecare_user_invitations(tenant_id,email,role,role_id,auth_user_id,invited_by,expires_at,delivery_status)
    values(p_id,lower(trim(p_email)),'owner',owner_role,p_owner,p_actor,now()+interval '7 days','pending');
  insert into public.homecare_tenant_modules(tenant_id,module,enabled,source)
    select p_id,value::public.homecare_feature_module,true,'manual' from unnest(p_modules) value;
  perform public.homecare_seed_resource_types(p_id);
  -- Compatibility projection for the existing settings reader. Company identity
  -- and the new onboarding fields remain relational on homecare_tenants.
  insert into public.homecare_settings(tenant_id,key,value) values(p_id,'companySettings',jsonb_build_object(
    'name',trim(p_company->>'name'),'address','','email',lower(trim(p_email)),'phone','','bank','',
    'countryCode',country,'currency',case country when 'SE' then 'SEK' when 'GB' then 'GBP' when 'US' then 'USD' when 'CH' then 'CHF' else 'EUR' end,
    'organizationNumber',coalesce(p_company->>'organizationNumber',''),'vatNumber',coalesce(p_company->>'vatNumber',''),
    'brandColor','#007aff','brandNameInternational','WorkCore','brandNameSweden','WorkCore',
    'claimEnglish','','claimGerman','','claimSweden','','logoStoragePath','','logoUrl','','vatRate','',
    'fSkattApproved',false,'objectTypes','[]'::jsonb));
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action)
    values(p_id,p_actor,'company',p_id::text,'onboard');
  return p_id;
end $$;
revoke all on function public.homecare_onboard_company(uuid,uuid,uuid,text,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.homecare_onboard_company(uuid,uuid,uuid,text,jsonb,text[]) to service_role;

alter function public.homecare_apply_settings_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) rename to homecare_apply_settings_mutation_before_administration;
create function public.homecare_apply_settings_mutation(p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,
  p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; settings jsonb; already_applied boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||p_mutation_id::text,0));
  select exists(select 1 from public.homecare_sync_mutations where tenant_id=p_tenant_id and mutation_id=p_mutation_id and status='synced') into already_applied;
  result:=public.homecare_apply_settings_mutation_before_administration(p_mutation_id,p_entity_type,p_entity_id,p_operation,p_resource_id,p_tenant_id,p_payload,p_expected_revision);
  if not already_applied and result->>'status'='synced' and p_entity_type='setting' and p_entity_id='companySettings' and p_operation in ('create','update') then
    select value into settings from public.homecare_settings where tenant_id=p_tenant_id and key='companySettings';
    update public.homecare_tenants set name=coalesce(nullif(settings->>'name',''),name),legal_name=coalesce(nullif(settings->>'name',''),legal_name),
      country_code=coalesce(nullif(settings->>'countryCode',''),country_code),default_currency=coalesce(nullif(settings->>'currency',''),default_currency),
      organization_number=settings->>'organizationNumber',vat_number=settings->>'vatNumber',settings_revision=settings_revision+1
    where id=p_tenant_id and onboarded_by is not null;
  end if;
  return result;
end $$;
revoke all on function public.homecare_apply_settings_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_settings_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;

create function public.homecare_admin_module(p_tenant uuid,p_actor uuid,p_module public.homecare_feature_module,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.homecare_tenants where id=p_tenant for update;
  if not exists(select 1 from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
    where m.tenant_id=p_tenant and m.user_id=p_actor and m.status='active' and 'tenant.admin'=any(r.permissions)) then
    raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  insert into public.homecare_tenant_modules(tenant_id,module,enabled,source) values(p_tenant,p_module,p_enabled,'manual')
    on conflict(tenant_id,module) do update set enabled=excluded.enabled,source='manual',updated_at=now();
  update public.homecare_tenants set settings_revision=settings_revision+1 where id=p_tenant;
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action) values(p_tenant,p_actor,'module',p_module::text,'update');
end $$;
revoke all on function public.homecare_admin_module(uuid,uuid,public.homecare_feature_module,boolean) from public,anon,authenticated;
grant execute on function public.homecare_admin_module(uuid,uuid,public.homecare_feature_module,boolean) to service_role;

alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_administration;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_administration()||array['homecare_feedback']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
