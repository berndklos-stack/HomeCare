-- Accelerated Decommission Wave 5: remaining master data, relational backups and app_state retirement.
begin;

do $$ declare table_name text; begin
  foreach table_name in array array['homecare_personnel','homecare_services','homecare_service_packages','homecare_accounting_accounts','homecare_inventory_locations','homecare_materials'] loop
    execute format('alter table public.%I add column if not exists record_data jsonb not null default ''{}''::jsonb',table_name);
    execute format('alter table public.%I add column if not exists revision bigint not null default 1',table_name);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz',table_name);
    execute format('drop trigger if exists bump_revision on public.%I',table_name);
    execute format('create trigger bump_revision before update on public.%I for each row execute function public.homecare_bump_revision()',table_name);
  end loop;
end $$;

create table if not exists public.homecare_relational_backups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  format_version integer not null default 1,
  reason text not null,
  payload jsonb not null,
  manifest jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  restore_tenant_id uuid
);
create index if not exists homecare_relational_backups_tenant_created_idx on public.homecare_relational_backups(tenant_id,created_at desc);
alter table public.homecare_relational_backups enable row level security;
drop policy if exists tenant_backup_read on public.homecare_relational_backups;
create policy tenant_backup_read on public.homecare_relational_backups for select to authenticated
  using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'backups.manage'));
drop policy if exists tenant_backup_insert on public.homecare_relational_backups;
create policy tenant_backup_insert on public.homecare_relational_backups for insert to authenticated
  with check(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'backups.manage'));
revoke all on public.homecare_relational_backups from public,anon;
grant select,insert on public.homecare_relational_backups to authenticated;
grant all on public.homecare_relational_backups to service_role;

create or replace function public.homecare_relational_backup_tables() returns text[]
language sql immutable set search_path=public as $$ select array[
  'homecare_roles','homecare_user_profiles','homecare_user_invitations','homecare_subscriptions','homecare_tenant_modules',
  'homecare_settings','homecare_translations','homecare_customers','homecare_customer_contacts','homecare_personnel',
  'homecare_accounting_accounts','homecare_inventory_locations','homecare_services','homecare_service_packages',
  'homecare_objects','homecare_resources','homecare_jobs','homecare_field_progress','homecare_job_time_entries',
  'homecare_job_notes','homecare_reports','homecare_portal_messages','homecare_portal_message_replies','homecare_media',
  'homecare_materials','homecare_inventory_movements','homecare_billing_items','homecare_invoice_lines','homecare_payments',
  'homecare_accounting_exports','homecare_vehicle_trips','homecare_vehicle_positions','homecare_daily_mail_state',
  'homecare_portal_access','homecare_odometer_history','homecare_trip_audit_log','homecare_driving_log_regulations',
  'homecare_field_progress_archive','homecare_financial_audit','homecare_sync_mutations','homecare_audit_log','homecare_tenant_memberships'
]::text[] $$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;

create or replace function public.homecare_create_relational_backup(p_tenant_id uuid,p_reason text default 'manual') returns jsonb
language plpgsql security definer set search_path=public as $$
declare table_name text; table_payload jsonb; payload jsonb:='{}'::jsonb; manifest jsonb:='{}'::jsonb; backup_row public.homecare_relational_backups%rowtype;
begin
  if auth.role()='authenticated' and (public.homecare_request_tenant() is distinct from p_tenant_id or not public.homecare_has_permission(p_tenant_id,'backups.manage')) then raise exception 'WORKCORE_BACKUP_PERMISSION_DENIED' using errcode='42501'; end if;
  foreach table_name in array public.homecare_relational_backup_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),''[]''::jsonb) from public.%I row where tenant_id=$1',table_name) into table_payload using p_tenant_id;
    payload:=payload||jsonb_build_object(table_name,table_payload);
    manifest:=manifest||jsonb_build_object(table_name,jsonb_build_object('count',jsonb_array_length(table_payload)));
  end loop;
  insert into public.homecare_relational_backups(tenant_id,format_version,reason,payload,manifest,checksum,created_by)
  values(p_tenant_id,1,coalesce(nullif(trim(p_reason),''),'manual'),payload,manifest,encode(digest(payload::text,'sha256'),'hex'),auth.uid())
  returning * into backup_row;
  return to_jsonb(backup_row)-'payload';
end $$;
revoke all on function public.homecare_create_relational_backup(uuid,text) from public,anon;
grant execute on function public.homecare_create_relational_backup(uuid,text) to authenticated,service_role;

create or replace function public.homecare_apply_master_data_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.homecare_sync_mutations%rowtype; table_name text; key_name text:='id'; existing jsonb; current_revision bigint; response jsonb; tenant uuid:=p_tenant_id; required_name text;
begin
  table_name:=case p_entity_type when 'personnel' then 'homecare_personnel' when 'service' then 'homecare_services' when 'service_package' then 'homecare_service_packages' when 'accounting_account' then 'homecare_accounting_accounts' when 'inventory_location' then 'homecare_inventory_locations' when 'material' then 'homecare_materials' end;
  if table_name is null or tenant is null or p_operation not in('create','update','delete','restore') then raise exception 'Ungültige Stammdatenmutation.' using errcode='22023'; end if;
  if p_entity_type='accounting_account' then key_name:='account'; end if;
  if auth.role()='authenticated' and (public.homecare_request_tenant() is distinct from tenant or not public.homecare_has_permission(tenant,'data.write')) then raise exception 'WORKCORE_MASTER_DATA_PERMISSION_DENIED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(tenant::text||':'||p_mutation_id::text));
  select * into prior from public.homecare_sync_mutations where tenant_id=tenant and mutation_id=p_mutation_id;
  if found and prior.status in('synced','conflict') then return prior.response_payload; end if;
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload)
  values(p_mutation_id,tenant,p_entity_type,p_entity_id,p_operation,'syncing',p_expected_revision,p_payload) on conflict(tenant_id,mutation_id) do update set status='syncing',updated_at=now();
  execute format('select to_jsonb(row),revision from public.%I row where tenant_id=$1 and %I=$2 for update',table_name,key_name) into existing,current_revision using tenant,p_entity_id;
  if p_operation='create' and existing is null then
    required_name:=coalesce(nullif(p_payload->>'name',''),nullif(trim(coalesce(p_payload->>'firstName','')||' '||coalesce(p_payload->>'lastName','')),''),nullif(p_payload->>'label',''),p_entity_id);
    if p_entity_type='personnel' then execute 'insert into public.homecare_personnel(id,tenant_id,first_name,last_name,record_data) values($1,$2,$3,$4,$5)' using p_entity_id,tenant,coalesce(p_payload->>'firstName',''),coalesce(p_payload->>'lastName',''),p_payload;
    elsif p_entity_type='service' then execute 'insert into public.homecare_services(id,tenant_id,name,record_data) values($1,$2,$3,$4)' using p_entity_id,tenant,required_name,p_payload;
    elsif p_entity_type='service_package' then execute 'insert into public.homecare_service_packages(id,tenant_id,name,record_data) values($1,$2,$3,$4)' using p_entity_id,tenant,required_name,p_payload;
    elsif p_entity_type='accounting_account' then execute 'insert into public.homecare_accounting_accounts(account,tenant_id,category,label,record_data) values($1,$2,$3,$4,$5)' using p_entity_id,tenant,coalesce(nullif(p_payload->>'category',''),'Sonstige'),required_name,p_payload;
    elsif p_entity_type='inventory_location' then execute 'insert into public.homecare_inventory_locations(id,tenant_id,name,record_data) values($1,$2,$3,$4)' using p_entity_id,tenant,required_name,p_payload;
    else execute 'insert into public.homecare_materials(id,tenant_id,name,record_data) values($1,$2,$3,$4)' using p_entity_id,tenant,required_name,p_payload; end if;
    execute format('select to_jsonb(row) from public.%I row where tenant_id=$1 and %I=$2',table_name,key_name) into existing using tenant,p_entity_id;
  elsif existing is null then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Stammdatensatz existiert nicht mehr.');
  elsif p_expected_revision is not null and current_revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',existing,'error','Der Stammdatensatz wurde auf einem anderen Gerät geändert.');
  elsif p_operation='delete' then
    if not coalesce((existing->>'archived')::boolean,(existing#>>'{record_data,archived}')::boolean,false) then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',existing,'error','Der Stammdatensatz muss vor dem Löschen archiviert werden.');
    else execute format('update public.%I row set deleted_at=now() where tenant_id=$1 and %I=$2 returning to_jsonb(row)',table_name,key_name) into existing using tenant,p_entity_id; end if;
  elsif p_operation='restore' then execute format('update public.%I row set deleted_at=null where tenant_id=$1 and %I=$2 returning to_jsonb(row)',table_name,key_name) into existing using tenant,p_entity_id;
  else
    execute format('update public.%I row set record_data=row.record_data||$3,archived=case when $3?''archived'' then ($3->>''archived'')::boolean else row.archived end,deleted_at=null where tenant_id=$1 and %I=$2 returning to_jsonb(row)',table_name,key_name) into existing using tenant,p_entity_id,p_payload;
  end if;
  if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',existing); end if;
  update public.homecare_sync_mutations set status=response->>'status',response_payload=response,error=response->>'error',applied_at=case when response->>'status'='synced' then now() else applied_at end,updated_at=now() where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
end $$;
revoke all on function public.homecare_apply_master_data_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon;
grant execute on function public.homecare_apply_master_data_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to authenticated,service_role;

create or replace function public.homecare_restore_relational_backup(p_backup_id uuid,p_target_tenant_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare backup public.homecare_relational_backups%rowtype; table_name text; item jsonb; restored integer:=0; table_count integer; target_has_rows boolean; tables text[]:=public.homecare_relational_backup_tables();
begin
  if auth.role()='authenticated' and (public.homecare_request_tenant() is distinct from p_target_tenant_id or not public.homecare_has_permission(p_target_tenant_id,'backups.manage')) then raise exception 'WORKCORE_BACKUP_PERMISSION_DENIED' using errcode='42501'; end if;
  select * into backup from public.homecare_relational_backups where id=p_backup_id for update;
  if not found then raise exception 'Backup nicht gefunden.' using errcode='P0002'; end if;
  foreach table_name in array tables loop
    execute format('select exists(select 1 from public.%I where tenant_id=$1)',table_name) into target_has_rows using p_target_tenant_id;
    if target_has_rows then raise exception 'Der Zielmandant ist nicht leer (%).',table_name using errcode='23514'; end if;
  end loop;
  foreach table_name in array tables loop
    table_count:=0;
    for item in select value from jsonb_array_elements(coalesce(backup.payload->table_name,'[]'::jsonb)) loop
      execute format('insert into public.%I select populated.* from jsonb_populate_record(null::public.%I,$1||jsonb_build_object(''tenant_id'',$2)) populated',table_name,table_name) using item,p_target_tenant_id;
      table_count:=table_count+1; restored:=restored+1;
    end loop;
    if table_count<>coalesce((backup.manifest#>>array[table_name,'count'])::integer,0) then raise exception 'Restore-Anzahl für % stimmt nicht.',table_name; end if;
  end loop;
  update public.homecare_relational_backups set restored_at=now(),restore_tenant_id=p_target_tenant_id where id=p_backup_id;
  return jsonb_build_object('ok',true,'restoredRecords',restored,'targetTenantId',p_target_tenant_id);
end $$;
revoke all on function public.homecare_restore_relational_backup(uuid,uuid) from public,anon;
grant execute on function public.homecare_restore_relational_backup(uuid,uuid) to authenticated,service_role;

-- Runtime access is retired. Historical migrations remain the only approved readers.
revoke all on table public.app_state from public,anon,authenticated,service_role;
comment on table public.app_state is 'Retired legacy archive. No operational application reads or writes after Wave 5.';

commit;
