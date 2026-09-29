-- Accelerated Decommission Wave 2: jobs and operational records become relational authoritative.

alter table public.homecare_jobs
  add column if not exists record_data jsonb not null default '{}'::jsonb,
  add column if not exists consulting jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;
alter table public.homecare_field_progress
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

drop trigger if exists bump_revision on public.homecare_jobs;
create trigger bump_revision before update on public.homecare_jobs for each row execute function public.homecare_bump_revision();
drop trigger if exists bump_revision on public.homecare_field_progress;
create trigger bump_revision before update on public.homecare_field_progress for each row execute function public.homecare_bump_revision();

create table if not exists public.homecare_job_time_entries (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  job_id text not null,
  entry_date date not null,
  start_time text,
  end_time text,
  minutes integer not null default 0,
  description text,
  billing_status text not null default 'offen',
  billed_at timestamptz,
  billing_record_id text,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id) on delete restrict
);
create table if not exists public.homecare_job_notes (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  job_id text not null,
  work_date date,
  note text not null default '',
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id) on delete restrict
);
drop trigger if exists set_updated_at on public.homecare_job_time_entries;
create trigger set_updated_at before update on public.homecare_job_time_entries for each row execute function public.set_homecare_updated_at();
drop trigger if exists bump_revision on public.homecare_job_time_entries;
create trigger bump_revision before update on public.homecare_job_time_entries for each row execute function public.homecare_bump_revision();
drop trigger if exists set_updated_at on public.homecare_job_notes;
create trigger set_updated_at before update on public.homecare_job_notes for each row execute function public.set_homecare_updated_at();
drop trigger if exists bump_revision on public.homecare_job_notes;
create trigger bump_revision before update on public.homecare_job_notes for each row execute function public.homecare_bump_revision();

create index if not exists homecare_jobs_tenant_live_idx on public.homecare_jobs(tenant_id,updated_at desc) where deleted_at is null;
create unique index if not exists homecare_jobs_series_occurrence_live_uidx
  on public.homecare_jobs(tenant_id,series_master_id,series_occurrence_date)
  where series_master_id is not null and series_occurrence_date is not null and deleted_at is null;
create index if not exists homecare_field_progress_job_live_idx on public.homecare_field_progress(tenant_id,job_id,work_date) where deleted_at is null;
create index if not exists homecare_job_time_entries_job_live_idx on public.homecare_job_time_entries(tenant_id,job_id,entry_date) where deleted_at is null;
create index if not exists homecare_job_notes_job_live_idx on public.homecare_job_notes(tenant_id,job_id,work_date) where deleted_at is null;

-- Newest JSON candidate supplies lossless record_data and JSON-only jobs.
with section_jobs as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
  where state.id='sync-section:jobs'
), snapshot_jobs as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when jsonb_typeof(state.data->'jobs')='array' then state.data->'jobs' else '[]'::jsonb end) item
  where state.id='kolaretorp-service-app'
), candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item,updated_at
  from(select * from section_jobs union all select * from snapshot_jobs) source
  where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
)
insert into public.homecare_jobs(
  id,tenant_id,series_master_id,series_occurrence_date,title,object_id,customer_id,type,status,status_updated_at,
  priority,due_date,start_date,end_date,execution_date,assigned_to,description,internal_notes,billable,material,
  work_minutes,resource_ids,material_items,checklist,service_ids,service_quantities,service_discounts,custom_service,
  discount,schedule,execution_log,offer_number,offer_sent_at,order_confirmation_number,order_confirmation_sent_at,
  series_excluded_dates,record_data,consulting,updated_at
)
select item->>'id',tenant_id,nullif(item->>'seriesMasterId',''),public.homecare_text_to_date(item->>'seriesOccurrenceDate'),
  coalesce(nullif(item->>'title',''),'Auftrag'),case when exists(select 1 from public.homecare_objects o where o.tenant_id=candidates.tenant_id and o.id=item->>'objectId') then nullif(item->>'objectId','') end,
  case when exists(select 1 from public.homecare_customers c where c.tenant_id=candidates.tenant_id and c.id=item->>'customerId') then nullif(item->>'customerId','') end,
  nullif(item->>'type',''),coalesce(nullif(item->>'status',''),'geplant'),nullif(item->>'statusUpdatedAt','')::timestamptz,
  coalesce(nullif(item->>'priority',''),'normal'),public.homecare_text_to_date(item->>'dueDate'),public.homecare_text_to_date(item->>'startDate'),
  public.homecare_text_to_date(item->>'endDate'),public.homecare_text_to_date(item->>'executionDate'),nullif(item->>'assignedTo',''),
  nullif(item->>'description',''),nullif(item->>'internalNotes',''),coalesce((item->>'billable')::boolean,true),nullif(item->>'material',''),
  coalesce(public.homecare_text_to_numeric(item->>'workMinutes'),0)::integer,coalesce(item->'resourceIds','[]'),coalesce(item->'materialItems','[]'),
  coalesce(item->'checklist','[]'),coalesce(item->'serviceIds','[]'),coalesce(item->'serviceQuantities','{}'),coalesce(item->'serviceDiscounts','{}'),
  item->'customService',coalesce(item->'discount',jsonb_build_object('type',item->>'discountType','value',item->>'discountValue','reason',item->>'discountReason')),
  coalesce(item->'schedule','{}'),coalesce(item->'executionLog','[]'),nullif(item->>'offerNumber',''),nullif(item->>'offerSentAt','')::timestamptz,
  nullif(item->>'orderConfirmationNumber',''),nullif(item->>'orderConfirmationSentAt','')::timestamptz,coalesce(item->'seriesExcludedDates','[]'),
  item #- '{consulting,entries}',coalesce(item->'consulting','{}')-'entries',coalesce(updated_at,now())
from candidates on conflict(id) do nothing;

-- Existing relational rows gain fields that were previously JSON-only without replacing relational columns.
with all_candidates as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when state.id='sync-section:jobs' and jsonb_typeof(state.data->'value')='array' then state.data->'value' when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'jobs')='array' then state.data->'jobs' else '[]'::jsonb end) item
  where state.id in('sync-section:jobs','kolaretorp-service-app')
), candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item from all_candidates where nullif(item->>'id','') is not null
  order by tenant_id,item->>'id',updated_at desc
)
update public.homecare_jobs job set
  record_data=case when job.record_data='{}' then candidates.item - 'consulting' else job.record_data end,
  consulting=case when job.consulting='{}' then coalesce(candidates.item->'consulting','{}')-'entries' else job.consulting end
from candidates where job.tenant_id=candidates.tenant_id and job.id=candidates.item->>'id';

with all_candidates as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when state.id='sync-section:jobs' and jsonb_typeof(state.data->'value')='array' then state.data->'value' when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'jobs')='array' then state.data->'jobs' else '[]'::jsonb end) item
  where state.id in('sync-section:jobs','kolaretorp-service-app')
), candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item from all_candidates where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
), entries as (
  select candidate.tenant_id,candidate.item->>'id' job_id,entry.item
  from candidates candidate cross join lateral jsonb_array_elements(case when jsonb_typeof(candidate.item#>'{consulting,entries}')='array' then candidate.item#>'{consulting,entries}' else '[]' end) entry(item)
)
insert into public.homecare_job_time_entries(id,tenant_id,job_id,entry_date,start_time,end_time,minutes,description,billing_status,billed_at,billing_record_id)
select item->>'id',tenant_id,job_id,coalesce(public.homecare_text_to_date(item->>'date'),current_date),nullif(item->>'startTime',''),nullif(item->>'endTime',''),
  coalesce(public.homecare_text_to_numeric(item->>'minutes'),0)::integer,nullif(item->>'description',''),coalesce(nullif(item->>'billingStatus',''),'offen'),
  nullif(item->>'billedAt','')::timestamptz,nullif(item->>'billingRecordId','') from entries where nullif(item->>'id','') is not null
on conflict(tenant_id,id) do nothing;

with states as (
  select tenant_id,data->'value' value from public.app_state where id='sync-section:fieldNotes'
  union all select tenant_id,data->'fieldNotes' from public.app_state where id='kolaretorp-service-app'
), notes as (
  select distinct on(states.tenant_id,entry.key) states.tenant_id,entry.key,entry.note_value
  from states
  cross join lateral jsonb_each_text(case when jsonb_typeof(states.value)='object' then states.value else '{}'::jsonb end) entry(key,note_value)
)
insert into public.homecare_job_notes(id,tenant_id,job_id,work_date,note)
select key||':note',tenant_id,split_part(key,'::',1),case when position('::' in key)>0 then public.homecare_text_to_date(split_part(key,'::',2)) end,note_value
from notes where note_value<>'' and exists(select 1 from public.homecare_jobs job where job.tenant_id=notes.tenant_id and job.id=split_part(key,'::',1))
on conflict(tenant_id,id) do nothing;

alter table public.homecare_job_time_entries enable row level security;
alter table public.homecare_job_notes enable row level security;
do $$ declare table_name text; begin
  foreach table_name in array array['homecare_jobs','homecare_field_progress','homecare_job_time_entries','homecare_job_notes'] loop
    execute format('drop policy if exists tenant_member_read on public.%I',table_name);
    execute format('drop policy if exists tenant_member_insert on public.%I',table_name);
    execute format('drop policy if exists tenant_member_update on public.%I',table_name);
    execute format('drop policy if exists tenant_member_delete on public.%I',table_name);
    execute format('create policy tenant_member_read on public.%I for select to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',table_name);
    execute format('create policy tenant_member_insert on public.%I for insert to authenticated with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''jobs.manage''))',table_name);
    execute format('create policy tenant_member_update on public.%I for update to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''jobs.manage'')) with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''jobs.manage''))',table_name);
    execute format('create policy tenant_member_delete on public.%I for delete to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''jobs.manage''))',table_name);
    execute format('drop trigger if exists assign_request_tenant on public.%I',table_name);
    execute format('create trigger assign_request_tenant before insert on public.%I for each row execute function public.homecare_assign_request_tenant()',table_name);
    execute format('revoke all on table public.%I from public,anon',table_name);
    execute format('grant select,insert,update,delete on table public.%I to authenticated,service_role',table_name);
  end loop;
end $$;

create or replace function public.homecare_prevent_job_operation_hard_delete() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'Auftrags- und Einsatzdaten werden per Tombstone gelöscht.' using errcode='23514'; end $$;
drop trigger if exists prevent_job_hard_delete on public.homecare_jobs;
create trigger prevent_job_hard_delete before delete on public.homecare_jobs for each row execute function public.homecare_prevent_job_operation_hard_delete();
drop trigger if exists prevent_field_progress_hard_delete on public.homecare_field_progress;
create trigger prevent_field_progress_hard_delete before delete on public.homecare_field_progress for each row execute function public.homecare_prevent_job_operation_hard_delete();
drop trigger if exists prevent_job_time_hard_delete on public.homecare_job_time_entries;
create trigger prevent_job_time_hard_delete before delete on public.homecare_job_time_entries for each row execute function public.homecare_prevent_job_operation_hard_delete();
drop trigger if exists prevent_job_note_hard_delete on public.homecare_job_notes;
create trigger prevent_job_note_hard_delete before delete on public.homecare_job_notes for each row execute function public.homecare_prevent_job_operation_hard_delete();

create or replace function public.homecare_apply_job_operation_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare existing_mutation public.homecare_sync_mutations%rowtype; job_row public.homecare_jobs%rowtype; progress_row public.homecare_field_progress%rowtype;
  time_row public.homecare_job_time_entries%rowtype; note_row public.homecare_job_notes%rowtype; response jsonb; tenant uuid:=p_tenant_id;
begin
  if tenant is null or p_entity_type not in('job','field_progress','job_time_entry','job_note') or p_operation not in('create','update','delete','restore') then raise exception 'Ungültige Auftragsmutation.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext(tenant::text||':'||p_mutation_id::text));
  select * into existing_mutation from public.homecare_sync_mutations where tenant_id=tenant and mutation_id=p_mutation_id;
  if found and existing_mutation.status in('synced','conflict') then return existing_mutation.response_payload; end if;
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload)
  values(p_mutation_id,tenant,p_entity_type,p_entity_id,p_operation,'syncing',p_expected_revision,coalesce(p_payload,'{}'))
  on conflict(tenant_id,mutation_id) do update set status='syncing',updated_at=now();

  if p_entity_type='job' then
    select * into job_row from public.homecare_jobs where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' then
      if found and job_row.series_master_id= nullif(p_payload->>'seriesMasterId','') and job_row.series_occurrence_date=public.homecare_text_to_date(p_payload->>'seriesOccurrenceDate') then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(job_row));
      elsif found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(job_row),'error','Der Auftrag existiert bereits.');
      elsif not exists(select 1 from public.homecare_objects where tenant_id=tenant and id=p_payload->>'objectId' and deleted_at is null) then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Das zugehörige Objekt fehlt.');
      elsif nullif(p_payload->>'customerId','') is not null and not exists(select 1 from public.homecare_customers where tenant_id=tenant and id=p_payload->>'customerId' and deleted_at is null) then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der zugehörige Kunde fehlt.');
      else
        insert into public.homecare_jobs(id,tenant_id,series_master_id,series_occurrence_date,title,object_id,customer_id,type,status,status_updated_at,priority,due_date,start_date,end_date,execution_date,assigned_to,description,internal_notes,billable,material,work_minutes,resource_ids,material_items,checklist,service_ids,service_quantities,service_discounts,custom_service,discount,schedule,execution_log,offer_number,offer_sent_at,order_confirmation_number,order_confirmation_sent_at,series_excluded_dates,record_data,consulting,revision,deleted_at)
        values(p_entity_id,tenant,nullif(p_payload->>'seriesMasterId',''),public.homecare_text_to_date(p_payload->>'seriesOccurrenceDate'),coalesce(nullif(p_payload->>'title',''),'Auftrag'),nullif(p_payload->>'objectId',''),nullif(p_payload->>'customerId',''),nullif(p_payload->>'type',''),coalesce(nullif(p_payload->>'status',''),'geplant'),nullif(p_payload->>'statusUpdatedAt','')::timestamptz,coalesce(nullif(p_payload->>'priority',''),'normal'),public.homecare_text_to_date(p_payload->>'dueDate'),public.homecare_text_to_date(p_payload->>'startDate'),public.homecare_text_to_date(p_payload->>'endDate'),public.homecare_text_to_date(p_payload->>'executionDate'),nullif(p_payload->>'assignedTo',''),nullif(p_payload->>'description',''),nullif(p_payload->>'internalNotes',''),coalesce((p_payload->>'billable')::boolean,true),nullif(p_payload->>'material',''),coalesce(public.homecare_text_to_numeric(p_payload->>'workMinutes'),0)::integer,coalesce(p_payload->'resourceIds','[]'),coalesce(p_payload->'materialItems','[]'),coalesce(p_payload->'checklist','[]'),coalesce(p_payload->'serviceIds','[]'),coalesce(p_payload->'serviceQuantities','{}'),coalesce(p_payload->'serviceDiscounts','{}'),p_payload->'customService',jsonb_build_object('type',p_payload->>'discountType','value',p_payload->>'discountValue','reason',p_payload->>'discountReason'),coalesce(p_payload->'schedule','{}'),coalesce(p_payload->'executionLog','[]'),nullif(p_payload->>'offerNumber',''),nullif(p_payload->>'offerSentAt','')::timestamptz,nullif(p_payload->>'orderConfirmationNumber',''),nullif(p_payload->>'orderConfirmationSentAt','')::timestamptz,coalesce(p_payload->'seriesExcludedDates','[]'),p_payload #- '{consulting,entries}',coalesce(p_payload->'consulting','{}')-'entries',1,null) returning * into job_row;
      end if;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Auftrag existiert nicht mehr.');
    elsif p_expected_revision is not null and job_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(job_row),'error','Der Auftrag wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then
      if job_row.status<>'storniert' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(job_row),'error','Der Auftrag muss vor dem Löschen storniert werden.');
      elsif exists(select 1 from public.homecare_reports where tenant_id=tenant and job_id=p_entity_id) or exists(select 1 from public.homecare_billing_items where tenant_id=tenant and job_id=p_entity_id and cancelled_at is null) then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(job_row),'error','Berichte oder Abrechnungen verhindern das Löschen.');
      else update public.homecare_jobs set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into job_row;
        update public.homecare_field_progress set deleted_at=coalesce(deleted_at,now()),revision=revision+1 where tenant_id=tenant and job_id=p_entity_id and deleted_at is null;
        update public.homecare_job_notes set deleted_at=coalesce(deleted_at,now()),revision=revision+1 where tenant_id=tenant and job_id=p_entity_id and deleted_at is null;
        update public.homecare_job_time_entries set deleted_at=coalesce(deleted_at,now()),revision=revision+1 where tenant_id=tenant and job_id=p_entity_id and deleted_at is null;
      end if;
    elsif p_operation='restore' then update public.homecare_jobs set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into job_row;
    else
      update public.homecare_jobs job set record_data=job.record_data||p_payload,consulting=case when p_payload?'consulting' then p_payload->'consulting' else job.consulting end,
        series_master_id=case when p_payload?'seriesMasterId' then nullif(p_payload->>'seriesMasterId','') else job.series_master_id end,series_occurrence_date=case when p_payload?'seriesOccurrenceDate' then public.homecare_text_to_date(p_payload->>'seriesOccurrenceDate') else job.series_occurrence_date end,
        title=coalesce(nullif(p_payload->>'title',''),job.title),object_id=case when p_payload?'objectId' then nullif(p_payload->>'objectId','') else job.object_id end,customer_id=case when p_payload?'customerId' then nullif(p_payload->>'customerId','') else job.customer_id end,type=case when p_payload?'type' then nullif(p_payload->>'type','') else job.type end,status=case when p_payload?'status' then p_payload->>'status' else job.status end,status_updated_at=case when p_payload?'statusUpdatedAt' then nullif(p_payload->>'statusUpdatedAt','')::timestamptz else job.status_updated_at end,priority=case when p_payload?'priority' then p_payload->>'priority' else job.priority end,due_date=case when p_payload?'dueDate' then public.homecare_text_to_date(p_payload->>'dueDate') else job.due_date end,start_date=case when p_payload?'startDate' then public.homecare_text_to_date(p_payload->>'startDate') else job.start_date end,end_date=case when p_payload?'endDate' then public.homecare_text_to_date(p_payload->>'endDate') else job.end_date end,execution_date=case when p_payload?'executionDate' then public.homecare_text_to_date(p_payload->>'executionDate') else job.execution_date end,assigned_to=case when p_payload?'assignedTo' then nullif(p_payload->>'assignedTo','') else job.assigned_to end,description=case when p_payload?'description' then p_payload->>'description' else job.description end,internal_notes=case when p_payload?'internalNotes' then p_payload->>'internalNotes' else job.internal_notes end,billable=case when p_payload?'billable' then (p_payload->>'billable')::boolean else job.billable end,material=case when p_payload?'material' then p_payload->>'material' else job.material end,work_minutes=case when p_payload?'workMinutes' then coalesce(public.homecare_text_to_numeric(p_payload->>'workMinutes'),0)::integer else job.work_minutes end,resource_ids=coalesce(p_payload->'resourceIds',job.resource_ids),material_items=coalesce(p_payload->'materialItems',job.material_items),checklist=coalesce(p_payload->'checklist',job.checklist),service_ids=coalesce(p_payload->'serviceIds',job.service_ids),service_quantities=coalesce(p_payload->'serviceQuantities',job.service_quantities),service_discounts=coalesce(p_payload->'serviceDiscounts',job.service_discounts),custom_service=case when p_payload?'customService' then p_payload->'customService' else job.custom_service end,discount=case when p_payload?'discountType' or p_payload?'discountValue' or p_payload?'discountReason' then jsonb_build_object('type',p_payload->>'discountType','value',p_payload->>'discountValue','reason',p_payload->>'discountReason') else job.discount end,schedule=coalesce(p_payload->'schedule',job.schedule),execution_log=coalesce(p_payload->'executionLog',job.execution_log),offer_number=case when p_payload?'offerNumber' then nullif(p_payload->>'offerNumber','') else job.offer_number end,offer_sent_at=case when p_payload?'offerSentAt' then nullif(p_payload->>'offerSentAt','')::timestamptz else job.offer_sent_at end,order_confirmation_number=case when p_payload?'orderConfirmationNumber' then nullif(p_payload->>'orderConfirmationNumber','') else job.order_confirmation_number end,order_confirmation_sent_at=case when p_payload?'orderConfirmationSentAt' then nullif(p_payload->>'orderConfirmationSentAt','')::timestamptz else job.order_confirmation_sent_at end,series_excluded_dates=coalesce(p_payload->'seriesExcludedDates',job.series_excluded_dates),deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into job_row;
    end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(job_row)); end if;
  elsif p_entity_type='field_progress' then
    select * into progress_row from public.homecare_field_progress where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' and not found then insert into public.homecare_field_progress(id,tenant_id,job_id,work_date,task_id,completed,minutes,show_work_time_in_report,note,photos,revision,deleted_at) values(p_entity_id,tenant,p_resource_id,public.homecare_text_to_date(p_payload->>'workDate'),p_payload->>'taskId',coalesce((p_payload->>'completed')::boolean,false),public.homecare_text_to_numeric(p_payload->>'minutes')::integer,coalesce((p_payload->>'showWorkTimeInReport')::boolean,true),nullif(p_payload->>'note',''),coalesce(p_payload->'photos','[]'),1,null) returning * into progress_row;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Fortschritt existiert nicht mehr.');
    elsif p_expected_revision is not null and progress_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(progress_row),'error','Der Fortschritt wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then update public.homecare_field_progress set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into progress_row;
    elsif p_operation='restore' then update public.homecare_field_progress set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into progress_row;
    else update public.homecare_field_progress set completed=coalesce((p_payload->>'completed')::boolean,completed),minutes=case when p_payload?'minutes' then public.homecare_text_to_numeric(p_payload->>'minutes')::integer else minutes end,show_work_time_in_report=coalesce((p_payload->>'showWorkTimeInReport')::boolean,show_work_time_in_report),note=case when p_payload?'note' then p_payload->>'note' else note end,photos=coalesce(p_payload->'photos',photos),deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into progress_row; end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(progress_row)); end if;
  elsif p_entity_type='job_time_entry' then
    select * into time_row from public.homecare_job_time_entries where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' and not found then insert into public.homecare_job_time_entries(id,tenant_id,job_id,entry_date,start_time,end_time,minutes,description,billing_status,billed_at,billing_record_id) values(p_entity_id,tenant,p_resource_id,coalesce(public.homecare_text_to_date(p_payload->>'date'),current_date),nullif(p_payload->>'startTime',''),nullif(p_payload->>'endTime',''),coalesce(public.homecare_text_to_numeric(p_payload->>'minutes'),0)::integer,nullif(p_payload->>'description',''),coalesce(nullif(p_payload->>'billingStatus',''),'offen'),nullif(p_payload->>'billedAt','')::timestamptz,nullif(p_payload->>'billingRecordId','')) returning * into time_row;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Zeiteintrag existiert nicht mehr.');
    elsif p_expected_revision is not null and time_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(time_row),'error','Der Zeiteintrag wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then update public.homecare_job_time_entries set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into time_row;
    elsif p_operation='restore' then update public.homecare_job_time_entries set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into time_row;
    else update public.homecare_job_time_entries set entry_date=coalesce(public.homecare_text_to_date(p_payload->>'date'),entry_date),start_time=coalesce(p_payload->>'startTime',start_time),end_time=coalesce(p_payload->>'endTime',end_time),minutes=coalesce(public.homecare_text_to_numeric(p_payload->>'minutes')::integer,minutes),description=coalesce(p_payload->>'description',description),billing_status=coalesce(p_payload->>'billingStatus',billing_status),billed_at=case when p_payload?'billedAt' then nullif(p_payload->>'billedAt','')::timestamptz else billed_at end,billing_record_id=case when p_payload?'billingRecordId' then nullif(p_payload->>'billingRecordId','') else billing_record_id end,deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into time_row; end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(time_row)); end if;
  else
    select * into note_row from public.homecare_job_notes where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' and not found then insert into public.homecare_job_notes(id,tenant_id,job_id,work_date,note) values(p_entity_id,tenant,p_resource_id,public.homecare_text_to_date(p_payload->>'workDate'),coalesce(p_payload->>'note','')) returning * into note_row;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Einsatznotiz existiert nicht mehr.');
    elsif p_expected_revision is not null and note_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(note_row),'error','Die Einsatznotiz wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then update public.homecare_job_notes set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into note_row;
    elsif p_operation='restore' then update public.homecare_job_notes set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into note_row;
    else update public.homecare_job_notes set note=coalesce(p_payload->>'note',note),work_date=coalesce(public.homecare_text_to_date(p_payload->>'workDate'),work_date),deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into note_row; end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(note_row)); end if;
  end if;
  update public.homecare_sync_mutations set applied_at=case when response->>'status'='synced' then now() else null end,error=response->>'error',response_payload=response,status=response->>'status',updated_at=now() where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
exception when unique_violation then
  response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Ein Serienvorkommen für dieses Datum existiert bereits.');
  update public.homecare_sync_mutations set error=response->>'error',response_payload=response,status='conflict',updated_at=now() where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
end $$;

revoke all on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;
revoke all on function public.homecare_prevent_job_operation_hard_delete() from public,anon,authenticated;
