begin;
create table if not exists public.homecare_resource_field_catalog (
  field_key text primary key, column_name text not null, kind text not null
);
insert into public.homecare_resource_field_catalog(field_key,column_name,kind) values
 ('name','name','text'),('identifier','identifier','text'),('serialNumber','serial_number','text'),('licensePlate','license_plate','text'),
 ('brand','brand','text'),('model','model','text'),('buildYear','build_year','number'),('purchaseDate','purchase_date','date'),('purchasePrice','purchase_price','number'),
 ('currentOdometer','current_odometer','number'),('operatingHours','operating_hours','number'),('currentOdometerDate','current_odometer_date','date'),('operatingHoursDate','operating_hours_date','date'),
 ('registrationCountry','registration_country','text'),('taxCountry','tax_country','country'),('ownerCompany','owner_company','text'),
 ('defaultDriverId','default_driver_id','employee'),('responsiblePersonId','responsible_person_id','employee'),('location','location','text'),('status','status','text'),
 ('warrantyUntil','warranty_until','date'),('warrantyNotes','warranty_notes','text'),('logbookActive','logbook_active','boolean'),('logbookLanguage','tracking','language'),
 ('privateUseAllowed','private_use_allowed','boolean'),('maintenanceIntervalValue','maintenance_interval_value','number'),('maintenanceIntervalUnit','maintenance_interval_unit','intervalUnit'),('notes','notes','text'),
 ('logbookYear','logbook_year','number'),('odometerYearStart','odometer_year_start','number'),('odometerYearEnd','odometer_year_end','number'),
 ('trackingMode','tracking','text'),('trackerProvider','tracking','text'),('trackerDeviceId','tracking','text')
on conflict(field_key) do nothing;
revoke all on public.homecare_resource_field_catalog from public,anon,authenticated;
grant select on public.homecare_resource_field_catalog to authenticated;
grant all on public.homecare_resource_field_catalog to service_role;

create table if not exists public.homecare_resource_types (
 tenant_id uuid not null references public.homecare_tenants(id), id uuid not null, name text not null check(length(trim(name)) between 1 and 200),
 category text not null check(category in('vehicle','machine','equipment')), archived boolean not null default false,
 revision bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(tenant_id,id)
);
create unique index if not exists resource_type_unique_live_name on public.homecare_resource_types(tenant_id,lower(trim(name))) where not archived;
create table if not exists public.homecare_resource_type_fields (
 tenant_id uuid not null, type_id uuid not null, field_key text not null references public.homecare_resource_field_catalog(field_key),
 enabled boolean not null, required boolean not null, display_order integer not null check(display_order between 0 and 1000),
 primary key(tenant_id,type_id,field_key), foreign key(tenant_id,type_id) references public.homecare_resource_types(tenant_id,id) deferrable initially deferred,
 check(not required or enabled), check(field_key<>'name' or (required and enabled))
);
do $$ declare tbl text; begin
 foreach tbl in array array['homecare_resource_types','homecare_resource_type_fields'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
  execute format('drop policy if exists resource_types_tenant_read on public.%I',tbl);
  execute format('create policy resource_types_tenant_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
 end loop;
end $$;
drop trigger if exists bump_revision on public.homecare_resource_types;
create trigger bump_revision before update on public.homecare_resource_types for each row execute function public.homecare_bump_revision();

alter table public.homecare_resources add column if not exists resource_type_id uuid,
 add column if not exists serial_number text, add column if not exists operating_hours_date date,
 add column if not exists maintenance_interval_value numeric(14,3), add column if not exists maintenance_interval_unit text;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.homecare_resources'::regclass and conname='resource_type_tenant_fk') then
  alter table public.homecare_resources add constraint resource_type_tenant_fk foreign key(tenant_id,resource_type_id) references public.homecare_resource_types(tenant_id,id) deferrable initially deferred;
  alter table public.homecare_resources add constraint resource_interval_ck check(maintenance_interval_value is null or (maintenance_interval_value>0 and maintenance_interval_value::text not in('NaN','Infinity','-Infinity')));
  alter table public.homecare_resources add constraint resource_interval_unit_ck check(maintenance_interval_unit is null or maintenance_interval_unit in('days','hours','km'));
 end if;
end $$;

create or replace function public.homecare_seed_resource_types(p_tenant uuid) returns void
language plpgsql security definer set search_path=public as $$
declare item record; common text[]:=array['name','identifier','brand','model','buildYear','status','responsiblePersonId','location','notes']; keys text[];
begin
 for item in select * from (values
  ('00000000-0000-4000-8000-000000000001'::uuid,'Fahrzeug','vehicle'),('00000000-0000-4000-8000-000000000002'::uuid,'Anhänger','equipment'),
  ('00000000-0000-4000-8000-000000000003'::uuid,'Rasenmäher','machine'),('00000000-0000-4000-8000-000000000004'::uuid,'Maschine','machine'),
  ('00000000-0000-4000-8000-000000000005'::uuid,'Werkzeug','equipment'),('00000000-0000-4000-8000-000000000006'::uuid,'Gerät','equipment'),('00000000-0000-4000-8000-000000000007'::uuid,'Sonstiges','equipment')) v(id,name,category) loop
  insert into public.homecare_resource_types(tenant_id,id,name,category) values(p_tenant,item.id,item.name,item.category) on conflict do nothing;
  keys:=common;
  if item.category='vehicle' then keys:=keys||array['licensePlate','currentOdometer','currentOdometerDate','registrationCountry','taxCountry','ownerCompany','defaultDriverId','logbookActive','logbookLanguage','privateUseAllowed','logbookYear','odometerYearStart','odometerYearEnd','trackingMode','trackerProvider','trackerDeviceId'];
  elsif item.category='machine' then keys:=keys||array['serialNumber','operatingHours','operatingHoursDate','maintenanceIntervalValue','maintenanceIntervalUnit'];
  elsif item.name='Anhänger' then keys:=keys||array['licensePlate','serialNumber'];
  elsif item.name<>'Sonstiges' then keys:=keys||array['serialNumber']; end if;
  insert into public.homecare_resource_type_fields(tenant_id,type_id,field_key,enabled,required,display_order)
   select p_tenant,item.id,field_key,field_key=any(keys),field_key='name',array_position(array['name','identifier','serialNumber','licensePlate','brand','model','buildYear','purchaseDate','purchasePrice','currentOdometer','operatingHours','currentOdometerDate','operatingHoursDate','registrationCountry','taxCountry','ownerCompany','defaultDriverId','responsiblePersonId','location','status','warrantyUntil','warrantyNotes','logbookActive','logbookLanguage','privateUseAllowed','maintenanceIntervalValue','maintenanceIntervalUnit','notes','logbookYear','odometerYearStart','odometerYearEnd','trackingMode','trackerProvider','trackerDeviceId'],field_key)-1 from public.homecare_resource_field_catalog
   on conflict do nothing;
 end loop;
end $$;
revoke all on function public.homecare_seed_resource_types(uuid) from public,anon,authenticated;
grant execute on function public.homecare_seed_resource_types(uuid) to service_role;
do $$ declare tenant record; begin for tenant in select id from public.homecare_tenants loop perform public.homecare_seed_resource_types(tenant.id); end loop; end $$;
-- Backfill only the new link. No names, readings, media or trips are changed.
-- Preserve pending revisions and timestamps under this migration's table lock.
do $$ declare triggers jsonb; item jsonb; begin
 select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'mode',tgenabled)),'[]') into triggers from pg_trigger
  where tgrelid='public.homecare_resources'::regclass and tgname in('bump_revision','set_updated_at') and tgenabled<>'D';
 for item in select value from jsonb_array_elements(triggers) loop
  execute format('alter table public.homecare_resources disable trigger %I',item->>'name');
 end loop;
 update public.homecare_resources set resource_type_id=case type
  when 'Fahrzeug' then '00000000-0000-4000-8000-000000000001'::uuid
  when 'Maschine' then '00000000-0000-4000-8000-000000000004'::uuid
  when 'Gerät' then '00000000-0000-4000-8000-000000000006'::uuid else null end
 where resource_type_id is null and type in('Fahrzeug','Maschine','Gerät');
 set constraints resource_type_tenant_fk immediate;
 for item in select value from jsonb_array_elements(triggers) loop
  execute format('alter table public.homecare_resources enable %s trigger %I',
   case item->>'mode' when 'A' then 'always' when 'R' then 'replica' else '' end,item->>'name');
 end loop;
 set constraints resource_type_tenant_fk deferred;
end $$;

create or replace function public.homecare_apply_resource_type_mutation(
 p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.homecare_resource_types%rowtype; saved public.homecare_resource_types%rowtype; journal public.homecare_sync_mutations%rowtype; result jsonb; field jsonb;
begin
 if p_tenant_id is null or p_entity_type<>'resource_type' or p_operation not in('create','update') then raise exception 'INVALID_RESOURCE_TYPE_MUTATION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':mutation:'||p_mutation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':resource-type:'||p_entity_id,0));
 select * into journal from public.homecare_sync_mutations where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
 if found then
  if journal.entity_type is distinct from p_entity_type or journal.entity_id is distinct from p_entity_id or journal.operation is distinct from p_operation
   or journal.expected_revision is distinct from p_expected_revision or journal.request_payload is distinct from p_payload then raise exception 'MUTATION_ID_REUSED'; end if;
  return journal.response_payload;
 end if;
 select * into existing from public.homecare_resource_types where tenant_id=p_tenant_id and id=p_entity_id::uuid for update;
 if (p_operation='create' and found) or (p_operation='update' and (not found or p_expected_revision is null or existing.revision<>p_expected_revision)) then
  result:=jsonb_build_object('mutationId',p_mutation_id,'status','conflict','error','Der Ressourcentyp wurde inzwischen geändert.','record',to_jsonb(existing));
 else
  if jsonb_typeof(p_payload->'fields') is distinct from 'array' or jsonb_array_length(p_payload->'fields')<>(select count(*) from public.homecare_resource_field_catalog)
    or (select count(distinct f->>'key') from jsonb_array_elements(p_payload->'fields') f)<>(select count(*) from public.homecare_resource_field_catalog) then raise exception 'INVALID_RESOURCE_TYPE_FIELDS'; end if;
  if p_operation='update' and existing.category<>p_payload->>'category' and exists(select 1 from public.homecare_resources where tenant_id=p_tenant_id and resource_type_id=existing.id) then
   raise exception 'RESOURCE_TYPE_CATEGORY_IN_USE' using errcode='23514';
  end if;
  if p_operation='create' then
   insert into public.homecare_resource_types(tenant_id,id,name,category,archived) values(p_tenant_id,p_entity_id::uuid,p_payload->>'name',p_payload->>'category',(p_payload->>'archived')::boolean) returning * into saved;
  else
   update public.homecare_resource_types set name=p_payload->>'name',category=p_payload->>'category',archived=(p_payload->>'archived')::boolean where tenant_id=p_tenant_id and id=p_entity_id::uuid returning * into saved;
  end if;
  for field in select value from jsonb_array_elements(p_payload->'fields') loop
   if jsonb_typeof(field->'enabled') is distinct from 'boolean' or jsonb_typeof(field->'required') is distinct from 'boolean' or coalesce(field->>'order','') !~ '^\d+$' then raise exception 'INVALID_RESOURCE_TYPE_FIELDS'; end if;
   insert into public.homecare_resource_type_fields(tenant_id,type_id,field_key,enabled,required,display_order)
    values(p_tenant_id,saved.id,field->>'key',(field->>'enabled')::boolean,(field->>'required')::boolean,(field->>'order')::integer)
    on conflict(tenant_id,type_id,field_key) do update set enabled=excluded.enabled,required=excluded.required,display_order=excluded.display_order;
  end loop;
  result:=jsonb_build_object('mutationId',p_mutation_id,'status','synced','record',to_jsonb(saved));
 end if;
 insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,expected_revision,request_payload,response_payload,applied_at)
  values(p_tenant_id,p_mutation_id,p_entity_type,p_entity_id,p_operation,result->>'status',p_expected_revision,p_payload,result,now());
 return result;
end $$;
revoke all on function public.homecare_apply_resource_type_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_resource_type_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;

-- Extend the existing mutation transaction before its INSERT/UPDATE, retaining
-- one revision bump, original trip protections and original idempotency journal.
create or replace function public.homecare_resource_type_fields_guard() returns trigger language plpgsql set search_path=public as $$
declare context jsonb; payload jsonb; selected public.homecare_resource_types%rowtype; field record; value jsonb;
begin
 context:=nullif(current_setting('workcore.resource_type_payload',true),'')::jsonb;
 if context is null or context->>'tenant'<>new.tenant_id::text or context->>'id'<>new.id or context->>'operation' not in('create','update') then return new; end if;
 payload:=context->'payload';
 if payload ? 'resourceTypeId' then
  new.resource_type_id:=nullif(payload->>'resourceTypeId','')::uuid;
  if new.resource_type_id is null then raise exception 'RESOURCE_TYPE_REQUIRED' using errcode='23514'; end if;
 end if;
 if payload ? 'serialNumber' then new.serial_number:=nullif(payload->>'serialNumber',''); end if;
 if payload ? 'operatingHoursDate' then new.operating_hours_date:=nullif(payload->>'operatingHoursDate','')::date; end if;
 if payload ? 'operatingHours' then new.operating_hours:=nullif(payload->>'operatingHours','')::numeric; end if;
 if payload ? 'purchaseDate' then new.purchase_date:=nullif(payload->>'purchaseDate','')::date; end if;
 if payload ? 'purchasePrice' then new.purchase_price:=nullif(payload->>'purchasePrice','')::numeric; end if;
 if payload ? 'warrantyUntil' then new.warranty_until:=nullif(payload->>'warrantyUntil','')::date; end if;
 if payload ? 'warrantyNotes' then new.warranty_notes:=nullif(payload->>'warrantyNotes',''); end if;
 if payload ? 'maintenanceIntervalValue' then new.maintenance_interval_value:=nullif(payload->>'maintenanceIntervalValue','')::numeric; end if;
 if payload ? 'maintenanceIntervalUnit' then new.maintenance_interval_unit:=nullif(payload->>'maintenanceIntervalUnit',''); end if;
 if new.resource_type_id is null then return new; end if;
 if not (payload ? 'resourceTypeId') and tg_op='UPDATE' and new.type is distinct from old.type then
  raise exception 'RESOURCE_TYPE_CHANGE_REQUIRES_SELECTION' using errcode='23514';
 end if;
 select * into selected from public.homecare_resource_types where tenant_id=new.tenant_id and id=new.resource_type_id for share;
 if not found then raise exception 'RESOURCE_TYPE_NOT_FOUND'; end if;
 if selected.archived and (tg_op='INSERT' or old.resource_type_id is distinct from new.resource_type_id) then raise exception 'RESOURCE_TYPE_ARCHIVED'; end if;
 if tg_op='UPDATE' and old.type='Fahrzeug' and selected.category<>'vehicle' and exists(select 1 from public.homecare_vehicle_trips where tenant_id=new.tenant_id and resource_id=new.id and deleted_at is null) then raise exception 'VEHICLE_HISTORY_TYPE_PROTECTED'; end if;
 new.type:=case selected.category when 'vehicle' then 'Fahrzeug' when 'machine' then 'Maschine' else 'Gerät' end;
 -- Legacy queued updates must not be invalidated by newly required fields.
 if not (payload ? 'resourceTypeId') then return new; end if;
 for field in select c.* from public.homecare_resource_type_fields f join public.homecare_resource_field_catalog c using(field_key)
  where f.tenant_id=new.tenant_id and f.type_id=new.resource_type_id and f.enabled and f.required loop
  value:=to_jsonb(new)->field.column_name;
  if field.column_name='tracking' then value:=new.tracking->(case field.field_key when 'trackingMode' then 'mode' when 'trackerProvider' then 'provider' when 'trackerDeviceId' then 'deviceId' else 'logbookLanguage' end); end if;
  if value is null or value='null'::jsonb or trim(value#>>'{}')='' then raise exception 'RESOURCE_FIELD_REQUIRED: %',field.field_key using errcode='23514'; end if;
 end loop;
 return new;
end $$;
drop trigger if exists resource_type_fields_guard on public.homecare_resources;
create trigger resource_type_fields_guard before insert or update on public.homecare_resources for each row execute function public.homecare_resource_type_fields_guard();
do $$ begin
 if to_regprocedure('public.homecare_apply_resource_mutation_before_types(uuid,text,text,text,text,uuid,jsonb,bigint)') is null then
  alter function public.homecare_apply_resource_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) rename to homecare_apply_resource_mutation_before_types;
 end if;
end $$;
create or replace function public.homecare_apply_resource_mutation(
 p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; previous text:=current_setting('workcore.resource_type_payload',true);
begin
 perform set_config('workcore.resource_type_payload',jsonb_build_object('tenant',p_tenant_id,'id',p_entity_id,'operation',p_operation,'payload',p_payload)::text,true);
 result:=public.homecare_apply_resource_mutation_before_types(p_mutation_id,p_entity_type,p_entity_id,p_operation,p_resource_id,p_tenant_id,p_payload,p_expected_revision);
 perform set_config('workcore.resource_type_payload',coalesce(previous,''),true);
 return result;
end $$;
revoke all on function public.homecare_apply_resource_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_resource_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;

do $$ begin
 if to_regprocedure('public.homecare_relational_backup_tables_before_types()') is null then
  alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_types;
 end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select array['homecare_resource_types','homecare_resource_type_fields']::text[]||public.homecare_relational_backup_tables_before_types()
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
