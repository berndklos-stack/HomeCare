begin;

-- The HTTP server checks the platform allowlist. These service-only functions also
-- verify the actor's active home-company administration before crossing tenants.
create function public.homecare_platform_member_directory(p_home uuid,p_tenant uuid,p_actor uuid,p_search text default '',p_status text default '',p_role uuid default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare detail jsonb; result jsonb;
begin
  detail:=public.homecare_platform_company_detail(p_actor,p_home,p_tenant);
  if detail is null or coalesce((detail->>'archived')::boolean,true) then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  if p_page<0 or p_page>100000 or length(p_search)>120 or p_status not in ('','active','suspended','revoked') then raise exception 'INVALID_DIRECTORY_FILTER' using errcode='23514'; end if;
  with filtered as (
    select m.id,m.user_id,m.status,m.role_id,m.employee_id,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(trim(concat(e.first_name,' ',e.last_name)),''),'') as name,
      coalesce(u.email,'') as email,u.last_sign_in_at as "lastLogin",m.created_at,
      (select jsonb_build_object('id',i.id,'delivery_status',i.delivery_status,'expires_at',i.expires_at)
        from public.homecare_user_invitations i where i.tenant_id=m.tenant_id and i.auth_user_id=m.user_id order by i.created_at desc,i.id limit 1) as invitation
    from public.homecare_tenant_memberships m join auth.users u on u.id=m.user_id
    left join public.homecare_personnel e on e.tenant_id=m.tenant_id and e.id=m.employee_id
    where m.tenant_id=p_tenant and (p_status='' or m.status=p_status) and (p_role is null or m.role_id=p_role)
      and (p_search='' or strpos(lower(concat(u.email,' ',u.raw_user_meta_data->>'full_name',' ',e.first_name,' ',e.last_name)),lower(p_search))>0)
  ), page as (select * from filtered order by created_at,id limit 50 offset p_page*50)
  select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)-'created_at' order by p.created_at,p.id) from page p),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
  return result;
end $$;

create function public.homecare_platform_member_command(p_home uuid,p_tenant uuid,p_actor uuid,p_action text,p_target uuid default null,
  p_role uuid default null,p_employee text default null,p_email text default null,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare detail jsonb; target public.homecare_tenant_memberships%rowtype; invitation public.homecare_user_invitations%rowtype; selected_role public.homecare_roles%rowtype;
begin
  detail:=public.homecare_platform_company_detail(p_actor,p_home,p_tenant);
  if detail is null or coalesce((detail->>'archived')::boolean,true) then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.homecare_tenants where id=p_tenant and not archived for update;
  if not found then raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  if p_action in ('invite','role') then
    select * into selected_role from public.homecare_roles where tenant_id=p_tenant and id=p_role;
    if not found then raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end if;
  end if;
  if p_action='invite' then
    if p_user is null or not exists(select 1 from auth.users where id=p_user and lower(email)=lower(trim(p_email))) then raise exception 'INVITATION_IDENTITY_MISMATCH' using errcode='23514'; end if;
    if exists(select 1 from public.homecare_tenant_memberships where tenant_id=p_tenant and user_id=p_user and status<>'revoked') then raise exception 'MEMBER_ALREADY_EXISTS' using errcode='23505'; end if;
    if exists(select 1 from public.homecare_user_invitations where tenant_id=p_tenant and lower(email)=lower(trim(p_email)) and delivery_status in ('pending','sent','failed')) then raise exception 'INVITATION_ALREADY_EXISTS' using errcode='23505'; end if;
    if p_employee is not null and not exists(select 1 from public.homecare_personnel where tenant_id=p_tenant and id=p_employee and deleted_at is null and not archived) then raise exception 'EMPLOYEE_NOT_FOUND' using errcode='23514'; end if;
    insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status,employee_id) values(p_tenant,p_user,p_role,'suspended',p_employee)
      on conflict(tenant_id,user_id) do update set role_id=excluded.role_id,status='suspended',employee_id=excluded.employee_id,updated_at=now();
    insert into public.homecare_user_invitations(tenant_id,email,role,role_id,personnel_id,auth_user_id,invited_by,expires_at,delivery_status)
      values(p_tenant,lower(trim(p_email)),case selected_role.key when 'field_worker' then 'field_staff'::public.homecare_user_role when 'owner' then 'owner'::public.homecare_user_role when 'admin' then 'admin'::public.homecare_user_role else 'office'::public.homecare_user_role end,p_role,p_employee,p_user,p_actor,now()+interval '7 days','pending') returning * into invitation;
    insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action) values(p_tenant,p_actor,'invitation',invitation.id::text,'invite');
    return jsonb_build_object('invitationId',invitation.id,'userId',p_user);
  end if;
  select * into target from public.homecare_tenant_memberships where tenant_id=p_tenant and id=p_target for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode='P0002'; end if;
  if p_action='role' then
    update public.homecare_tenant_memberships set role_id=p_role,updated_at=now() where id=target.id;
    update public.homecare_user_invitations set role_id=p_role where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed');
  elsif p_action='employee' then
    if p_employee is not null and not exists(select 1 from public.homecare_personnel where tenant_id=p_tenant and id=p_employee and deleted_at is null and not archived) then raise exception 'EMPLOYEE_NOT_FOUND' using errcode='23514'; end if;
    update public.homecare_tenant_memberships set employee_id=p_employee,updated_at=now() where id=target.id;
  elsif p_action in ('suspend','reactivate','remove') then
    if p_action='reactivate' and (exists(select 1 from public.homecare_user_invitations where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed'))
      or not exists(select 1 from auth.users where id=target.user_id and email_confirmed_at is not null)
      or coalesce((select accepted_at is null from public.homecare_user_invitations where tenant_id=p_tenant and auth_user_id=target.user_id order by created_at desc limit 1),false)) then raise exception 'INVITATION_ACCEPTANCE_REQUIRED' using errcode='23514'; end if;
    update public.homecare_tenant_memberships set status=case p_action when 'suspend' then 'suspended' when 'remove' then 'revoked' else 'active' end,
      employee_id=case when p_action='remove' then null else employee_id end,updated_at=now() where id=target.id;
    if p_action in ('suspend','remove') then update public.homecare_user_invitations set delivery_status='revoked' where tenant_id=p_tenant and auth_user_id=target.user_id and delivery_status in ('pending','sent','failed'); end if;
  else raise exception 'INVALID_ADMIN_ACTION' using errcode='23514'; end if;
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action) values(p_tenant,p_actor,'membership',target.id::text,p_action);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.homecare_platform_member_directory(uuid,uuid,uuid,text,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.homecare_platform_member_command(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.homecare_platform_member_directory(uuid,uuid,uuid,text,text,uuid,integer) to service_role;
grant execute on function public.homecare_platform_member_command(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
