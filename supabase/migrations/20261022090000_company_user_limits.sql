begin;

-- Module entitlements are administered through the trusted platform server only.
revoke insert,update,delete on public.homecare_tenant_modules from authenticated,anon;

create table public.homecare_company_user_limits (
  tenant_id uuid primary key references public.homecare_tenants(id) on delete cascade,
  max_users integer check(max_users between 1 and 100000)
);
alter table public.homecare_company_user_limits enable row level security;
revoke all on public.homecare_company_user_limits from public,anon,authenticated;
grant select on public.homecare_company_user_limits to authenticated;
grant all on public.homecare_company_user_limits to service_role;
create policy company_user_limits_read on public.homecare_company_user_limits for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'members.manage'));

-- Missing configuration means unlimited, preserving all existing company access.
create function public.homecare_enforce_user_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare allowed integer; used bigint;
begin
  perform 1 from public.homecare_tenants where id=new.tenant_id for update;
  if tg_table_name='homecare_company_user_limits' then
    select count(*) into used from public.homecare_tenant_memberships where tenant_id=new.tenant_id and status<>'revoked';
    if new.max_users is not null and used>new.max_users then raise exception 'USER_LIMIT_BELOW_USAGE' using errcode='23514'; end if;
  elsif new.status<>'revoked' then
    select max_users into allowed from public.homecare_company_user_limits where tenant_id=new.tenant_id;
    select count(*) into used from public.homecare_tenant_memberships where tenant_id=new.tenant_id and status<>'revoked' and id<>new.id;
    if allowed is not null and used>=allowed then raise exception 'USER_LIMIT_REACHED' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.homecare_enforce_user_limit() from public,anon,authenticated;
create trigger enforce_company_user_limit before insert or update on public.homecare_company_user_limits for each row execute function public.homecare_enforce_user_limit();
create trigger enforce_membership_user_limit before insert or update on public.homecare_tenant_memberships for each row execute function public.homecare_enforce_user_limit();

alter function public.homecare_platform_company_detail(uuid,uuid,uuid) rename to homecare_platform_company_detail_before_user_limits;
create function public.homecare_platform_company_detail(p_actor uuid,p_home uuid,p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; allowed integer;
begin
  result:=public.homecare_platform_company_detail_before_user_limits(p_actor,p_home,p_tenant);
  if result is null then return null; end if;
  select max_users into allowed from public.homecare_company_user_limits where tenant_id=p_tenant;
  return jsonb_set(result,'{company,userLimit}',coalesce(to_jsonb(allowed),'null'::jsonb));
end $$;
revoke all on function public.homecare_platform_company_detail(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.homecare_platform_company_detail(uuid,uuid,uuid) to service_role;

alter function public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[]) rename to homecare_platform_company_update_before_user_limits;
create function public.homecare_platform_company_update(p_actor uuid,p_home uuid,p_tenant uuid,p_revision bigint,p_settings_revision bigint,p_company jsonb,p_modules text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.homecare_platform_company_update_before_user_limits(p_actor,p_home,p_tenant,p_revision,p_settings_revision,p_company,p_modules);
  if p_company ? 'userLimit' then
    insert into public.homecare_company_user_limits(tenant_id,max_users) values(p_tenant,(p_company->>'userLimit')::integer)
      on conflict(tenant_id) do update set max_users=excluded.max_users;
  end if;
end $$;
revoke all on function public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[]) to service_role;

alter function public.homecare_onboard_company(uuid,uuid,uuid,text,jsonb,text[]) rename to homecare_onboard_company_before_user_limits;
create function public.homecare_onboard_company(p_id uuid,p_actor uuid,p_owner uuid,p_email text,p_company jsonb,p_modules text[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  result:=public.homecare_onboard_company_before_user_limits(p_id,p_actor,p_owner,p_email,p_company,p_modules);
  if p_company ? 'userLimit' then insert into public.homecare_company_user_limits(tenant_id,max_users) values(result,(p_company->>'userLimit')::integer); end if;
  return result;
end $$;
revoke all on function public.homecare_onboard_company(uuid,uuid,uuid,text,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.homecare_onboard_company(uuid,uuid,uuid,text,jsonb,text[]) to service_role;

create function public.homecare_request_member_password_reset(p_home uuid,p_tenant uuid,p_actor uuid,p_member uuid,p_platform boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_role text; member public.homecare_tenant_memberships%rowtype; email_value text;
begin
  if p_platform is null then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  if p_platform then
    if p_home<>'00000000-0000-0000-0000-000000000001'::uuid then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
    perform public.homecare_platform_company_detail(p_actor,p_home,p_tenant);
  else
    if p_home<>p_tenant then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
    select r.key into actor_role from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
      join public.homecare_tenants t on t.id=m.tenant_id where m.tenant_id=p_tenant and m.user_id=p_actor and m.status='active' and not t.archived and 'members.manage'=any(r.permissions);
    if actor_role is null then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  end if;
  perform 1 from public.homecare_tenants where id=p_tenant and not archived for update;
  if not found then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  select * into member from public.homecare_tenant_memberships where tenant_id=p_tenant and id=p_member for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode='P0002'; end if;
  if not p_platform and actor_role<>'owner' and exists(select 1 from public.homecare_roles where tenant_id=p_tenant and id=member.role_id and key='owner') then
    raise exception 'OWNER_CHANGE_FORBIDDEN' using errcode='42501'; end if;
  if member.status='revoked' or exists(select 1 from public.homecare_user_invitations where tenant_id=p_tenant and auth_user_id=member.user_id and delivery_status in ('pending','sent','failed')) then
    raise exception 'PASSWORD_RESET_NOT_ALLOWED' using errcode='23514'; end if;
  select email into email_value from auth.users where id=member.user_id and email_confirmed_at is not null;
  if email_value is null then raise exception 'PASSWORD_RESET_NOT_ALLOWED' using errcode='23514'; end if;
  if exists(select 1 from public.homecare_audit_log where tenant_id=p_tenant and entity_type='membership' and entity_id=p_member::text and action='password_reset_requested' and created_at>now()-interval '1 minute') then
    raise exception 'PASSWORD_RESET_COOLDOWN' using errcode='23514'; end if;
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action) values(p_tenant,p_actor,'membership',p_member::text,'password_reset_requested');
  return jsonb_build_object('userId',member.user_id,'email',email_value);
end $$;
revoke all on function public.homecare_request_member_password_reset(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.homecare_request_member_password_reset(uuid,uuid,uuid,uuid,boolean) to service_role;

alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_user_limits;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_user_limits()||array['homecare_company_user_limits']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
notify pgrst,'reload schema';
commit;
