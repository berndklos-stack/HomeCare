begin;
create function public.homecare_admin_directory(p_tenant uuid,p_actor uuid,p_search text default '',p_status text default '',p_role uuid default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
    where m.tenant_id=p_tenant and m.user_id=p_actor and m.status='active' and 'members.manage'=any(r.permissions)) then
    raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  if p_page<0 or p_page>100000 or length(p_search)>120 or p_status not in ('','active','suspended','revoked') then
    raise exception 'INVALID_DIRECTORY_FILTER' using errcode='23514'; end if;
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
revoke all on function public.homecare_admin_directory(uuid,uuid,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.homecare_admin_directory(uuid,uuid,text,text,uuid,integer) to service_role;
commit;
