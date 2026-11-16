import assert from 'node:assert/strict';
import { demoName, demoModules, handwerkData, insertSql, quote } from './handwerk-data.mjs';

export function demoSql({tenant,actor,owner,email,today,commit=false}) {
  for(const id of [tenant,actor,owner])assert.match(id,/^[0-9a-f-]{36}$/i);
  assert.notEqual(tenant,'00000000-0000-0000-0000-000000000001');
  const company={name:demoName,country:'SE',locale:'de',timezone:'Europe/Stockholm',organizationNumber:'DEMO - nicht gueltig',vatNumber:'',accountType:'demo',pilotStartDate:'',pilotEndDate:'',contactPerson:'Alex Nord (Demo)',internalLabel:'Praesentationsfirma',notes:'Ausschliesslich fiktive Geschaeftsdaten. Keine produktiven Integrationen oder Kunden-Mails einrichten.',userLimit:10};
  const rows=handwerkData(tenant,owner,today);
  const tables=[...new Set(rows.map(({table})=>table))];
  // Snapshot all existing tenant rows, including identities/configuration. No payload is returned.
  const existingFingerprint=`do $fingerprint$ declare item record; value text; begin
    for item in select c.table_name from information_schema.columns c join pg_class p on p.oid=('public.'||c.table_name)::regclass
      where c.table_schema='public' and c.column_name='tenant_id' and p.relkind='r' and c.table_name like 'homecare_%' and c.table_name not in('homecare_relational_backups') loop
      execute format('with hashes as materialized (select md5(to_jsonb(t)::text) as h from public.%I t where tenant_id<>$1) select md5(coalesce(string_agg(h,'''' order by h),'''')) from hashes',item.table_name) into value using ${quote(tenant)}::uuid;
      insert into demo_before values(item.table_name,value);
    end loop;
    insert into demo_before values('homecare_tenants',(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.homecare_tenants t where id<>${quote(tenant)}::uuid));
  end $fingerprint$;`;
  const verifyFingerprint=`do $fingerprint$ declare item record; value text; begin
    for item in select * from demo_before loop
      if item.name='homecare_tenants' then select md5(jsonb_agg(to_jsonb(t) order by id)::text) into value from public.homecare_tenants t where id<>${quote(tenant)}::uuid;
      else execute format('with hashes as materialized (select md5(to_jsonb(t)::text) as h from public.%I t where tenant_id<>$1) select md5(coalesce(string_agg(h,'''' order by h),'''')) from hashes',item.name) into value using ${quote(tenant)}::uuid; end if;
      if value is distinct from item.digest then raise exception 'EXISTING_COMPANY_CHANGED: %',item.name; end if;
    end loop;
  end $fingerprint$;`;
  return `begin isolation level repeatable read;
    set local lock_timeout='10s'; set local statement_timeout='120s';
    select pg_advisory_xact_lock(hashtextextended(${quote(tenant)},0));
    do $$ begin if exists(select 1 from public.homecare_tenants where id=${quote(tenant)}::uuid) then raise exception 'DEMO_ALREADY_EXISTS'; end if; end $$;
    create temporary table demo_before(name text primary key,digest text) on commit drop;
    ${existingFingerprint}
    select public.homecare_onboard_company(${quote(tenant)}::uuid,${quote(actor)}::uuid,${quote(owner)}::uuid,${quote(email)},${quote(JSON.stringify(company))}::jsonb,array[${demoModules.map(quote).join(',')}]);
    ${rows.map(insertSql).join('\n')}
    update public.homecare_tenants set address='Demo-Werkstatt 1, 00000 Musterort',brand_color='#176b4c' where id=${quote(tenant)}::uuid and account_type='demo';
    update public.homecare_settings set value=value||'{"address":"Demo-Werkstatt 1, 00000 Musterort","vatRate":"25","brandColor":"#176b4c"}'::jsonb where tenant_id=${quote(tenant)}::uuid and key='companySettings';
    update public.homecare_tenant_memberships set employee_id='DEMO-MA1' where tenant_id=${quote(tenant)}::uuid and user_id=${quote(owner)}::uuid;
    do $$ begin
      if not exists(select 1 from public.homecare_tenants where id=${quote(tenant)}::uuid and account_type='demo') then raise exception 'DEMO_REQUIRED'; end if;
      if exists(select 1 from (select material_id,location_id,sum(amount) as quantity from (
        select material_id,destination_id as location_id,quantity as amount from public.homecare_stock_movements where tenant_id=${quote(tenant)}::uuid and destination_id is not null
        union all select material_id,source_id,-quantity from public.homecare_stock_movements where tenant_id=${quote(tenant)}::uuid and source_id is not null) q group by material_id,location_id) b where quantity<0) then raise exception 'NEGATIVE_DEMO_STOCK'; end if;
      if not exists(select 1 from public.homecare_resource_standard_trip_distances where tenant_id=${quote(tenant)}::uuid and distance_km=18) then raise exception 'STANDARD_DISTANCE_MISSING'; end if;
      ${tables.map(table=>`if not (select relrowsecurity from pg_class where oid='public.${table}'::regclass) then raise exception 'RLS_DISABLED: ${table}'; end if;`).join('\n')}
    end $$;
    savepoint demo_rls_probe;
    update public.homecare_tenant_memberships set status='active' where tenant_id=${quote(tenant)}::uuid and user_id=${quote(owner)}::uuid;
    select set_config('request.jwt.claims',${quote(JSON.stringify({sub:owner,role:'authenticated',email}))},true);
    select set_config('request.headers',${quote(JSON.stringify({'x-workcore-tenant':tenant}))},true);
    set local role authenticated;
    do $$ begin
      if (select count(*) from public.homecare_tenants)<>1 then raise exception 'DEMO_TENANT_ISOLATION_FAILED'; end if;
      if exists(select 1 from public.homecare_customers where tenant_id<>${quote(tenant)}::uuid) then raise exception 'DEMO_CUSTOMER_ISOLATION_FAILED'; end if;
      if (select count(*) from public.homecare_customers)<>5 or (select count(*) from public.homecare_staff_time_entries)<>45 or (select count(*) from public.homecare_stock_movements)<>20 then raise exception 'DEMO_READ_FAILED'; end if;
      if (select count(*) from public.homecare_tenant_modules where enabled)<>11 then raise exception 'DEMO_MODULES_MISSING'; end if;
    end $$;
    reset role;
    rollback to savepoint demo_rls_probe;
    ${verifyFingerprint}
    select jsonb_build_object('tenant',${quote(tenant)},'records',${rows.length},'existingCompaniesUnchanged',true,'rlsProbePassed',true,'pendingInvitation',exists(select 1 from public.homecare_tenant_memberships where tenant_id=${quote(tenant)}::uuid and status='suspended')) as verification;
    ${commit?'commit':'rollback'};`;
}
