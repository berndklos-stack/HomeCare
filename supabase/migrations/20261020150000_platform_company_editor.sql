begin;

-- Only trusted server paths may cross company boundaries. No client RLS is widened.
create function public.homecare_platform_company_detail(p_actor uuid,p_home uuid,p_tenant uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id
    join public.homecare_tenants h on h.id=m.tenant_id where m.tenant_id=p_home and m.user_id=p_actor and m.status='active' and not h.archived and 'tenant.admin'=any(r.permissions)) then
    raise exception 'ADMIN_FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object('id',t.id,'revision',t.settings_revision,'settingsRevision',coalesce(s.revision,0),'archived',t.archived,
    'company',jsonb_build_object('name',t.name,'country',coalesce(t.country_code,nullif(s.value->>'countryCode',''),'SE'),'locale',coalesce(t.locale,case t.default_language when 'Svenska' then 'sv' when 'English' then 'en' else 'de' end),'timezone',coalesce(t.timezone,'Europe/Stockholm'),
      'organizationNumber',coalesce(t.organization_number,s.value->>'organizationNumber',''),'vatNumber',coalesce(t.vat_number,s.value->>'vatNumber',''),'ownerEmail',coalesce(t.email,''),
      'accountType',t.account_type,'pilotStartDate',coalesce(t.pilot_start_date::text,''),'pilotEndDate',coalesce(t.pilot_end_date::text,''),
      'contactPerson',coalesce(t.contact_person,''),'internalLabel',coalesce(t.internal_label,''),'notes',coalesce(t.administration_notes,''),
      'modules',coalesce((select jsonb_agg(module::text order by module::text) from public.homecare_tenant_modules where tenant_id=t.id and enabled),'[]'::jsonb))) into result
    from public.homecare_tenants t left join public.homecare_settings s on s.tenant_id=t.id and s.key='companySettings' where t.id=p_tenant;
  return result;
end $$;
revoke all on function public.homecare_platform_company_detail(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.homecare_platform_company_detail(uuid,uuid,uuid) to service_role;

create function public.homecare_platform_company_update(p_actor uuid,p_home uuid,p_tenant uuid,p_revision bigint,p_settings_revision bigint,p_company jsonb,p_modules text[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant_row public.homecare_tenants%rowtype; setting_row public.homecare_settings%rowtype; item text; projection jsonb:='{}'::jsonb;
begin
  perform public.homecare_platform_company_detail(p_actor,p_home,p_tenant);
  -- Match the settings mutation lock order and check both editing surfaces.
  select * into setting_row from public.homecare_settings where tenant_id=p_tenant and key='companySettings' for update;
  select * into tenant_row from public.homecare_tenants where id=p_tenant for update;
  if tenant_row.id is null then raise exception 'COMPANY_NOT_FOUND' using errcode='P0002'; end if;
  if p_revision is null or p_settings_revision is null or tenant_row.settings_revision<>p_revision or coalesce(setting_row.revision,0)<>p_settings_revision then
    raise exception 'COMPANY_REVISION_CONFLICT' using errcode='40001'; end if;
  if lower(coalesce(p_company->>'ownerEmail',''))<>lower(coalesce(tenant_row.email,'')) then
    raise exception 'OWNER_IDENTITY_IMMUTABLE' using errcode='23514'; end if;
  if nullif(trim(p_company->>'name'),'') is null or length(p_company->>'name')>200
    or coalesce(p_company->>'country','') not in ('SE','DE','AT','CH','GB','US')
    or coalesce(p_company->>'locale','') not in ('de','sv','en')
    or coalesce(p_company->>'accountType','') not in ('production','pilot','demo')
    or not exists(select 1 from pg_timezone_names where name=p_company->>'timezone') or p_modules is null then
    raise exception 'INVALID_COMPANY' using errcode='23514'; end if;
  -- Mirror deliberate edits only. A notes/module edit must not resolve conflicting legacy values implicitly.
  if trim(p_company->>'name') is distinct from tenant_row.name then projection:=projection||jsonb_build_object('name',trim(p_company->>'name')); end if;
  if p_company->>'country' is distinct from coalesce(tenant_row.country_code,nullif(setting_row.value->>'countryCode',''),'SE') then projection:=projection||jsonb_build_object('countryCode',p_company->>'country'); end if;
  if p_company->>'organizationNumber' is distinct from coalesce(tenant_row.organization_number,setting_row.value->>'organizationNumber','') then projection:=projection||jsonb_build_object('organizationNumber',p_company->>'organizationNumber'); end if;
  if p_company->>'vatNumber' is distinct from coalesce(tenant_row.vat_number,setting_row.value->>'vatNumber','') then projection:=projection||jsonb_build_object('vatNumber',p_company->>'vatNumber'); end if;
  if projection<>'{}'::jsonb then
    insert into public.homecare_settings(tenant_id,key,value) values(p_tenant,'companySettings',coalesce(setting_row.value,'{}'::jsonb)||projection)
      on conflict(tenant_id,key) do update set value=excluded.value,revision=homecare_settings.revision+1,updated_at=clock_timestamp();
  end if;
  update public.homecare_tenants set name=trim(p_company->>'name'),
    legal_name=case when tenant_row.legal_name is null or tenant_row.legal_name=tenant_row.name then trim(p_company->>'name') else tenant_row.legal_name end,
    country_code=p_company->>'country',locale=p_company->>'locale',timezone=p_company->>'timezone',
    default_language=case when p_company->>'locale' is distinct from coalesce(tenant_row.locale,case tenant_row.default_language when 'Svenska' then 'sv' when 'English' then 'en' else 'de' end)
      then case p_company->>'locale' when 'sv' then 'Svenska' when 'en' then 'English' else 'Deutsch' end else tenant_row.default_language end,
    organization_number=nullif(p_company->>'organizationNumber',''),vat_number=nullif(p_company->>'vatNumber',''),account_type=p_company->>'accountType',
    pilot_start_date=nullif(p_company->>'pilotStartDate','')::date,pilot_end_date=nullif(p_company->>'pilotEndDate','')::date,
    contact_person=p_company->>'contactPerson',internal_label=p_company->>'internalLabel',administration_notes=p_company->>'notes',settings_revision=settings_revision+1 where id=p_tenant;
  update public.homecare_tenant_modules set enabled=false,source='manual',updated_at=now() where tenant_id=p_tenant and enabled and not(module::text=any(p_modules));
  foreach item in array p_modules loop
    insert into public.homecare_tenant_modules(tenant_id,module,enabled,source) values(p_tenant,item::public.homecare_feature_module,true,'manual')
      on conflict(tenant_id,module) do update set enabled=true,source='manual',updated_at=now();
  end loop;
  insert into public.homecare_audit_log(tenant_id,actor_user_id,entity_type,entity_id,action) values(p_tenant,p_actor,'company',p_tenant::text,'settings_update');
end $$;
revoke all on function public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[]) from public,anon,authenticated;
grant execute on function public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[]) to service_role;
commit;
