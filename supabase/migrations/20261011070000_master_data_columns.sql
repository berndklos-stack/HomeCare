begin;

alter table public.homecare_materials add column if not exists scan_code text;
alter table public.homecare_jobs add column if not exists scan_code text;
alter table public.homecare_objects add column if not exists scan_code text;

create or replace function public.homecare_master_column_map(table_name text) returns jsonb
language sql immutable set search_path=public as $$
select case table_name
  when 'homecare_materials' then '{"name":"name","sku":"sku","scanCode":"scan_code","unit":"unit","category":"category","description":"description","currency":"currency","price":"sales_price","purchasePrice":"purchase_price","taxRate":"tax_rate","accountingAccount":"accounting_account","minStock":"min_stock","maxStock":"max_stock","primaryLocation":"primary_location_id","supplier":"supplier","archived":"archived"}'::jsonb
  when 'homecare_personnel' then '{"firstName":"first_name","lastName":"last_name","personnelNumber":"personnel_number","email":"email","phone":"phone","role":"role","language":"language","status":"status","notes":"notes","archived":"archived"}'::jsonb
  when 'homecare_services' then '{"name":"name","unit":"unit","category":"category","description":"description","currency":"currency","price":"price","taxRate":"tax_rate","accountingAccount":"accounting_account","checklist":"checklist","showWorkTimeInReports":"show_work_time_in_reports","archived":"archived"}'::jsonb
  when 'homecare_service_packages' then '{"name":"name","description":"description","price":"price","serviceIds":"service_ids","archived":"archived"}'::jsonb
  when 'homecare_accounting_accounts' then '{"category":"category","label":"label","archived":"archived"}'::jsonb
  when 'homecare_inventory_locations' then '{"name":"name","note":"note","site":"site","locationCode":"location_code","archived":"archived"}'::jsonb
  else '{}'::jsonb end;
$$;

-- JSON remains a compatibility mirror. Changed payload fields populate typed columns;
-- direct column writes are mirrored, not overwritten by stale JSON.
create or replace function public.homecare_master_columns() returns trigger
language plpgsql set search_path=public as $$
declare mapping jsonb:=public.homecare_master_column_map(tg_table_name); field text; col text;
  patch jsonb:='{}'; prior jsonb:='{}'; value jsonb; row_data jsonb;
begin
  if tg_op='UPDATE' then prior:=old.record_data; end if;
  for field,col in select key,value_text from jsonb_each_text(mapping) as m(key,value_text) loop
    if new.record_data ? field and (tg_op='INSERT' or new.record_data->field is distinct from prior->field) then
      value:=new.record_data->field;
      if col='scan_code' and jsonb_typeof(value) not in ('string','null') then raise exception 'INVALID_SCAN_CODE' using errcode='22023'; end if;
      if col in ('sales_price','purchase_price','price','tax_rate','min_stock','max_stock') and jsonb_typeof(value)='string' then
        value:=coalesce(to_jsonb(nullif(trim(replace(new.record_data->>field,',','.')),'')::numeric),'null'::jsonb);
      end if;
      if col in ('sales_price','purchase_price','price','tax_rate','min_stock','max_stock','primary_location_id','scan_code') and value='""'::jsonb then value:='null'; end if;
      patch:=patch||jsonb_build_object(col,value);
    end if;
  end loop;
  new:=jsonb_populate_record(new,patch);
  row_data:=to_jsonb(new);
  for field,col in select key,value_text from jsonb_each_text(mapping) as m(key,value_text) loop
    value:=row_data->col;
    if jsonb_typeof(new.record_data->field)='string' and jsonb_typeof(value)='number' then value:=to_jsonb(row_data->>col); end if;
    new.record_data:=jsonb_set(new.record_data,array[field],coalesce(value,'null'::jsonb));
  end loop;
  return new;
end $$;

create or replace function public.homecare_scan_column() returns trigger
language plpgsql set search_path=public as $$
declare source jsonb; prior jsonb:='{}';
begin
  if tg_table_name='homecare_objects' then
    source:=new.custom_fields; if tg_op='UPDATE' then prior:=old.custom_fields; end if;
  else source:=new.record_data; if tg_op='UPDATE' then prior:=old.record_data; end if;
  end if;
  if source ? 'scanCode' and (tg_op='INSERT' or source->'scanCode' is distinct from prior->'scanCode') then
    if jsonb_typeof(source->'scanCode') not in ('string','null') then raise exception 'INVALID_SCAN_CODE' using errcode='22023'; end if;
    new.scan_code:=nullif(source->>'scanCode','');
  end if;
  source:=jsonb_set(source,'{scanCode}',coalesce(to_jsonb(new.scan_code),'null'::jsonb));
  if tg_table_name='homecare_objects' then new.custom_fields:=source; else new.record_data:=source; end if;
  return new;
end $$;

-- Keep the existing mutation's permission, locking and idempotency behavior.
-- Pass the top-level object code into the compatibility mirror in the same write.
do $$ declare definition text; anchor text:=E'begin\n  if tenant is null'; begin
  definition:=pg_get_functiondef('public.homecare_apply_object_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Object mutation signature changed'; end if;
  definition:=replace(definition,anchor,E'begin\n  if p_entity_type=''object'' and p_payload ? ''scanCode'' then\n    p_payload:=jsonb_set(p_payload,''{customFields}'',coalesce((select custom_fields from public.homecare_objects where tenant_id=tenant and id=p_entity_id),''{}''::jsonb)||coalesce(p_payload->''customFields'',''{}''::jsonb)||jsonb_build_object(''scanCode'',p_payload->''scanCode''));\n  end if;\n  if tenant is null');
  execute definition;
end $$;

-- Back up before conversion, keep conflicting non-empty values for manual review,
-- and preserve revisions/timestamps so deployment cannot invalidate pending edits.
do $$ declare tenant uuid; table_name text; mapping jsonb; field text; col text; trigger_states jsonb; begin
  for tenant in select id from public.homecare_tenants loop
    perform public.homecare_create_relational_backup(tenant,'before-master-data-column-conversion');
  end loop;
  foreach table_name in array array['homecare_materials','homecare_personnel','homecare_services','homecare_service_packages','homecare_accounting_accounts','homecare_inventory_locations','homecare_jobs','homecare_objects'] loop
    select coalesce(jsonb_object_agg(tgname,tgenabled::text),'{}'::jsonb) into trigger_states
      from pg_trigger where tgrelid=format('public.%I',table_name)::regclass and not tgisinternal;
    execute format('alter table public.%I disable trigger user',table_name);
    mapping:=public.homecare_master_column_map(table_name);
    if table_name in ('homecare_jobs','homecare_objects') then mapping:='{"scanCode":"scan_code"}'; end if;
    for field,col in select key,value_text from jsonb_each_text(mapping) as m(key,value_text) loop
      execute format('update public.%I set %I=(jsonb_populate_record(null::public.%I,jsonb_build_object(%L,%I->%L))).%I where %I ? %L and nullif(%I->>%L,'''') is not null and (%I is null or %I::text='''')',table_name,col,table_name,col,case when table_name='homecare_objects' then 'custom_fields' else 'record_data' end,field,col,case when table_name='homecare_objects' then 'custom_fields' else 'record_data' end,field,case when table_name='homecare_objects' then 'custom_fields' else 'record_data' end,field,col,col);
    end loop;
    if table_name='homecare_objects' then
      -- A successful object mutation previously ignored its top-level code.
      -- Recover only its latest explicit value, never a conflict or failed request.
      with latest as (
        select distinct on (tenant_id,entity_id) tenant_id,entity_id,request_payload->>'scanCode' code
        from public.homecare_sync_mutations
        where entity_type='object' and status='synced' and request_payload ? 'scanCode'
        order by tenant_id,entity_id,applied_at desc nulls last,updated_at desc,mutation_id
      )
      update public.homecare_objects o set scan_code=latest.code,custom_fields=o.custom_fields||jsonb_build_object('scanCode',latest.code)
      from latest where o.tenant_id=latest.tenant_id and o.id=latest.entity_id and o.scan_code is null
        and nullif(o.custom_fields->>'scanCode','') is null and nullif(latest.code,'') is not null;
    end if;
    for field,col in select key,value_text from jsonb_each_text(trigger_states) as m(key,value_text) loop
      execute format('alter table public.%I %s trigger %I',table_name,case col when 'D' then 'disable' when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,field);
    end loop;
    if table_name in ('homecare_jobs','homecare_objects') then
      execute format('create trigger z_scan_column before insert or update on public.%I for each row execute function public.homecare_scan_column()',table_name);
    else
      execute format('create trigger z_master_columns before insert or update on public.%I for each row execute function public.homecare_master_columns()',table_name);
    end if;
  end loop;
end $$;

alter table public.homecare_materials add constraint materials_scan_code_length check (scan_code is null or length(scan_code)<=128);
alter table public.homecare_jobs add constraint jobs_scan_code_length check (scan_code is null or length(scan_code)<=128);
alter table public.homecare_objects add constraint objects_scan_code_length check (scan_code is null or length(scan_code)<=128);
create index homecare_material_scan_column_idx on public.homecare_materials(tenant_id,scan_code) where deleted_at is null;
create index homecare_job_scan_column_idx on public.homecare_jobs(tenant_id,scan_code) where deleted_at is null;
create index homecare_object_scan_column_idx on public.homecare_objects(tenant_id,scan_code) where deleted_at is null;
notify pgrst,'reload schema';
commit;
