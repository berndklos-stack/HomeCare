-- Accelerated Decommission Wave 3: reports, media and communication become relational authoritative.

alter table public.homecare_reports
  add column if not exists customer_id text,
  add column if not exists record_data jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;
alter table public.homecare_portal_messages
  add column if not exists report_id text,
  add column if not exists record_data jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

update public.homecare_reports report set customer_id=coalesce(
  (select job.customer_id from public.homecare_jobs job where job.tenant_id=report.tenant_id and job.id=report.job_id),
  (select object.owner_customer_id from public.homecare_objects object where object.tenant_id=report.tenant_id and object.id=report.object_id)
) where report.customer_id is null;

create table if not exists public.homecare_portal_message_replies (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  message_id text not null,
  body text not null default '',
  subject text,
  recipient text,
  delivery_status text,
  delivery_error text,
  sent_at timestamptz,
  record_data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,message_id) references public.homecare_portal_messages(tenant_id,id) on delete restrict
);

do $$ begin
  alter table public.homecare_reports add constraint homecare_reports_customer_tenant_fk
    foreign key(tenant_id,customer_id) references public.homecare_customers(tenant_id,id) on delete restrict not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.homecare_portal_messages add constraint homecare_portal_messages_report_tenant_fk
    foreign key(tenant_id,report_id) references public.homecare_reports(tenant_id,id) on delete restrict not valid;
exception when duplicate_object then null; end $$;

drop trigger if exists bump_revision on public.homecare_reports;
create trigger bump_revision before update on public.homecare_reports for each row execute function public.homecare_bump_revision();
drop trigger if exists bump_revision on public.homecare_portal_messages;
create trigger bump_revision before update on public.homecare_portal_messages for each row execute function public.homecare_bump_revision();
drop trigger if exists set_updated_at on public.homecare_portal_message_replies;
create trigger set_updated_at before update on public.homecare_portal_message_replies for each row execute function public.set_homecare_updated_at();
drop trigger if exists bump_revision on public.homecare_portal_message_replies;
create trigger bump_revision before update on public.homecare_portal_message_replies for each row execute function public.homecare_bump_revision();

create index if not exists homecare_reports_tenant_live_idx on public.homecare_reports(tenant_id,report_date desc) where deleted_at is null;
create index if not exists homecare_reports_customer_live_idx on public.homecare_reports(tenant_id,customer_id) where deleted_at is null;
create index if not exists homecare_portal_messages_tenant_live_idx on public.homecare_portal_messages(tenant_id,created_at desc) where deleted_at is null;
create index if not exists homecare_portal_message_replies_message_live_idx on public.homecare_portal_message_replies(tenant_id,message_id,sent_at) where deleted_at is null;
create index if not exists homecare_media_report_live_idx on public.homecare_media(tenant_id,owner_type,owner_id) where deleted_at is null;

-- Import JSON-only reports and messages once. Relational rows always win.
with candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item,updated_at from (
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='sync-section:reports' and jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
    union all
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'reports')='array' then state.data->'reports' else '[]'::jsonb end) item
  ) source where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
)
insert into public.homecare_reports(id,tenant_id,job_id,object_id,customer_id,title,report_date,visible_to_customer,summary,internal_notes,customer_comment,checklist_results,media_ids,attachments,sent_at,record_data,updated_at)
select item->>'id',tenant_id,
  case when exists(select 1 from public.homecare_jobs j where j.tenant_id=candidates.tenant_id and j.id=item->>'jobId') then nullif(item->>'jobId','') end,
  case when exists(select 1 from public.homecare_objects o where o.tenant_id=candidates.tenant_id and o.id=item->>'objectId') then nullif(item->>'objectId','') end,
  coalesce((select j.customer_id from public.homecare_jobs j where j.tenant_id=candidates.tenant_id and j.id=item->>'jobId'),(select o.owner_customer_id from public.homecare_objects o where o.tenant_id=candidates.tenant_id and o.id=item->>'objectId')),
  coalesce(nullif(item->>'title',''),'Bericht'),public.homecare_text_to_date(item->>'date'),coalesce((item->>'visibleToCustomer')::boolean,true),
  nullif(item->>'summary',''),nullif(item->>'internalNotes',''),nullif(item->>'customerComment',''),coalesce(item->'checklistResults','[]'),coalesce(item->'media','[]'),coalesce(item->'attachments','[]'),nullif(item->>'sentAt','')::timestamptz,item - array['attachments','checklistResults'],coalesce(updated_at,now())
from candidates on conflict(id) do nothing;

with candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item,updated_at from (
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='sync-section:portalMessages' and jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
    union all
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'portalMessages')='array' then state.data->'portalMessages' else '[]'::jsonb end) item
  ) source where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
)
insert into public.homecare_portal_messages(id,tenant_id,customer_id,object_id,report_id,subject,message,status,delivery_status,delivery_error,origin,replies,sent_at,record_data,created_at,updated_at)
select item->>'id',tenant_id,
  case when exists(select 1 from public.homecare_customers c where c.tenant_id=candidates.tenant_id and c.id=item->>'customerId') then nullif(item->>'customerId','') end,
  case when exists(select 1 from public.homecare_objects o where o.tenant_id=candidates.tenant_id and o.id=item->>'objectId') then nullif(item->>'objectId','') end,
  case when exists(select 1 from public.homecare_reports r where r.tenant_id=candidates.tenant_id and r.id=item->>'reportId') then nullif(item->>'reportId','') end,
  coalesce(nullif(item->>'subject',''),'Nachricht'),coalesce(item->>'message',''),coalesce(nullif(item->>'status',''),'neu'),nullif(item->>'deliveryStatus',''),nullif(item->>'deliveryError',''),nullif(item->>'origin',''),coalesce(item->'replies','[]'),nullif(item->>'sentAt','')::timestamptz,item - array['attachments','replies'],coalesce(nullif(item->>'createdAt','')::timestamptz,updated_at,now()),coalesce(updated_at,now())
from candidates on conflict(id) do nothing;

-- Normalize embedded replies and every persisted report/message file into child records.
insert into public.homecare_portal_message_replies(id,tenant_id,message_id,body,subject,recipient,delivery_status,delivery_error,sent_at,record_data)
select coalesce(nullif(reply->>'id',''),message.id||':reply:'||ordinality),message.tenant_id,message.id,coalesce(reply->>'body',''),nullif(reply->>'subject',''),nullif(reply->>'to',''),nullif(reply->>'deliveryStatus',''),nullif(reply->>'deliveryError',''),nullif(reply->>'sentAt','')::timestamptz,reply
from public.homecare_portal_messages message cross join lateral jsonb_array_elements(case when jsonb_typeof(message.replies)='array' then message.replies else '[]' end) with ordinality child(reply,ordinality)
on conflict(tenant_id,id) do nothing;

insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,preview_url,metadata,created_at)
select coalesce(nullif(attachment->>'id',''),report.id||':attachment:'||ordinality),report.tenant_id,'report',report.id,'attachment',coalesce(nullif(attachment->>'name',''),'Anhang'),nullif(attachment->>'storagePath',''),nullif(attachment->>'storageUrl',''),attachment||jsonb_build_object('mediaRole','attachment'),coalesce(nullif(attachment->>'createdAt','')::timestamptz,now())
from public.homecare_reports report cross join lateral jsonb_array_elements(case when jsonb_typeof(report.attachments)='array' then report.attachments else '[]' end) with ordinality child(attachment,ordinality)
on conflict(id) do nothing;

insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,preview_url,metadata,created_at)
select coalesce(nullif(photo->>'id',''),report.id||':task:'||(task->>'id')||':'||photo_ordinality),report.tenant_id,'report',report.id,'checklist_photo',coalesce(nullif(photo->>'name',''),'Foto'),nullif(photo->>'storagePath',''),nullif(photo->>'previewUrl',''),photo||jsonb_build_object('mediaRole','checklist_photo','taskId',task->>'id'),coalesce(nullif(photo->>'createdAt','')::timestamptz,now())
from public.homecare_reports report
cross join lateral jsonb_array_elements(case when jsonb_typeof(report.checklist_results)='array' then report.checklist_results else '[]' end) task
cross join lateral jsonb_array_elements(case when jsonb_typeof(task->'photos')='array' then task->'photos' else '[]' end) with ordinality photos(photo,photo_ordinality)
on conflict(id) do nothing;

with message_candidates as (
  select distinct on(tenant_id,item->>'id') tenant_id,item,updated_at from (
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='sync-section:portalMessages' and jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
    union all
    select state.tenant_id,item,state.updated_at from public.app_state state cross join lateral jsonb_array_elements(case when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'portalMessages')='array' then state.data->'portalMessages' else '[]'::jsonb end) item
    union all
    select tenant_id,record_data,updated_at from public.homecare_portal_messages
  ) source where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
)
insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,preview_url,metadata,created_at)
select coalesce(nullif(attachment->>'id',''),(candidate.item->>'id')||':attachment:'||ordinality),candidate.tenant_id,'portal_message',candidate.item->>'id','attachment',coalesce(nullif(attachment->>'name',''),'Anhang'),nullif(attachment->>'storagePath',''),nullif(attachment->>'storageUrl',''),attachment||jsonb_build_object('mediaRole','attachment'),coalesce(nullif(attachment->>'createdAt','')::timestamptz,now())
from message_candidates candidate cross join lateral jsonb_array_elements(case when jsonb_typeof(candidate.item->'attachments')='array' then candidate.item->'attachments' else '[]' end) with ordinality child(attachment,ordinality)
where exists(select 1 from public.homecare_portal_messages message where message.tenant_id=candidate.tenant_id and message.id=candidate.item->>'id')
on conflict(id) do nothing;

alter table public.homecare_portal_message_replies enable row level security;
do $$ declare table_name text; permission text; begin
  foreach table_name in array array['homecare_reports','homecare_portal_messages','homecare_portal_message_replies'] loop
    permission := 'jobs.manage';
    execute format('drop policy if exists tenant_member_read on public.%I',table_name);
    execute format('drop policy if exists tenant_member_insert on public.%I',table_name);
    execute format('drop policy if exists tenant_member_update on public.%I',table_name);
    execute format('drop policy if exists tenant_member_delete on public.%I',table_name);
    execute format('create policy tenant_member_read on public.%I for select to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',table_name);
    execute format('create policy tenant_member_insert on public.%I for insert to authenticated with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,%L))',table_name,permission);
    execute format('create policy tenant_member_update on public.%I for update to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,%L)) with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,%L))',table_name,permission,permission);
    execute format('drop trigger if exists assign_request_tenant on public.%I',table_name);
    execute format('create trigger assign_request_tenant before insert on public.%I for each row execute function public.homecare_assign_request_tenant()',table_name);
    execute format('revoke all on table public.%I from public,anon',table_name);
    execute format('grant select,insert,update on table public.%I to authenticated,service_role',table_name);
  end loop;
end $$;

-- The bucket and delivery API remain private. A metadata row is mandatory after this cutover.
update storage.buckets set public=false where id='homecare-private-media';

create or replace function public.homecare_prevent_report_communication_hard_delete() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'Berichte, Kommunikation und Medien werden per Tombstone gelöscht.' using errcode='23514'; end $$;
drop trigger if exists prevent_report_hard_delete on public.homecare_reports;
create trigger prevent_report_hard_delete before delete on public.homecare_reports for each row execute function public.homecare_prevent_report_communication_hard_delete();
drop trigger if exists prevent_portal_message_hard_delete on public.homecare_portal_messages;
create trigger prevent_portal_message_hard_delete before delete on public.homecare_portal_messages for each row execute function public.homecare_prevent_report_communication_hard_delete();
drop trigger if exists prevent_portal_reply_hard_delete on public.homecare_portal_message_replies;
create trigger prevent_portal_reply_hard_delete before delete on public.homecare_portal_message_replies for each row execute function public.homecare_prevent_report_communication_hard_delete();
create or replace function public.homecare_prevent_report_media_hard_delete() returns trigger language plpgsql set search_path=public as $$
begin if old.owner_type in('report','portal_message') then raise exception 'Berichts- und Kommunikationsmedien werden per Tombstone gelöscht.' using errcode='23514'; end if; return old; end $$;
drop trigger if exists prevent_report_media_hard_delete on public.homecare_media;
create trigger prevent_report_media_hard_delete before delete on public.homecare_media for each row execute function public.homecare_prevent_report_media_hard_delete();

create or replace function public.homecare_apply_report_communication_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.homecare_sync_mutations%rowtype; current_revision bigint; current_deleted timestamptz; current_owner_type text; response jsonb; result_record jsonb;
begin
  if p_tenant_id is null or p_entity_type not in('report','report_media','portal_message','portal_message_reply','communication_media') or p_operation not in('create','update','delete','restore') then raise exception 'Ungültige Mutation.' using errcode='22023'; end if;
  select * into previous from public.homecare_sync_mutations where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
  if found then return previous.response_payload; end if;
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload) values(p_mutation_id,p_tenant_id,p_entity_type,p_entity_id,p_operation,'syncing',p_expected_revision,p_payload);

  if p_entity_type in('report_media','communication_media') then
    select revision,deleted_at,owner_type into current_revision,current_deleted,current_owner_type from public.homecare_media where tenant_id=p_tenant_id and id=p_entity_id for update;
  elsif p_entity_type='report' then
    select revision,deleted_at into current_revision,current_deleted from public.homecare_reports where tenant_id=p_tenant_id and id=p_entity_id for update;
  elsif p_entity_type='portal_message' then
    select revision,deleted_at into current_revision,current_deleted from public.homecare_portal_messages where tenant_id=p_tenant_id and id=p_entity_id for update;
  else
    select revision,deleted_at into current_revision,current_deleted from public.homecare_portal_message_replies where tenant_id=p_tenant_id and id=p_entity_id for update;
  end if;
  if p_operation='create' and current_revision is not null and not (p_entity_type in('report_media','communication_media') and current_owner_type='pending') or p_operation<>'create' and (current_revision is null or p_expected_revision is distinct from current_revision) or current_deleted is not null and p_operation not in('delete','restore') then
    response=jsonb_build_object('mutationId',p_mutation_id,'status','conflict','error','Der Datensatz wurde auf einem anderen Gerät geändert oder gelöscht.');
    update public.homecare_sync_mutations set status='conflict',response_payload=response,error=response->>'error',updated_at=now() where tenant_id=p_tenant_id and mutation_id=p_mutation_id; return response;
  end if;

  if p_entity_type='report' then
    if p_operation='create' then
      insert into public.homecare_reports(id,tenant_id,job_id,object_id,customer_id,title,report_date,visible_to_customer,summary,internal_notes,customer_comment,checklist_results,media_ids,attachments,sent_at,record_data)
      values(p_entity_id,p_tenant_id,nullif(p_payload->>'jobId',''),nullif(p_payload->>'objectId',''),coalesce((select customer_id from public.homecare_jobs where tenant_id=p_tenant_id and id=p_payload->>'jobId'),(select owner_customer_id from public.homecare_objects where tenant_id=p_tenant_id and id=p_payload->>'objectId')),coalesce(nullif(p_payload->>'title',''),'Bericht'),public.homecare_text_to_date(p_payload->>'date'),coalesce((p_payload->>'visibleToCustomer')::boolean,true),p_payload->>'summary',p_payload->>'internalNotes',p_payload->>'customerComment',coalesce(p_payload->'checklistResults','[]'),'[]','[]',nullif(p_payload->>'sentAt','')::timestamptz,p_payload);
    elsif p_operation='delete' then
      if exists(select 1 from public.homecare_billing_items where tenant_id=p_tenant_id and report_id=p_entity_id and coalesce(invoice_status,'') not in('storniert','')) then raise exception 'Bericht hat aktive Abhängigkeiten.' using errcode='23503'; end if;
      update public.homecare_reports set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and id=p_entity_id;
      update public.homecare_media set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and owner_type='report' and owner_id=p_entity_id and deleted_at is null;
    elsif p_operation='restore' then update public.homecare_reports set deleted_at=null where tenant_id=p_tenant_id and id=p_entity_id;
    else
      update public.homecare_reports set job_id=coalesce(nullif(p_payload->>'jobId',''),job_id),object_id=coalesce(nullif(p_payload->>'objectId',''),object_id),title=coalesce(nullif(p_payload->>'title',''),title),report_date=coalesce(public.homecare_text_to_date(p_payload->>'date'),report_date),visible_to_customer=coalesce((p_payload->>'visibleToCustomer')::boolean,visible_to_customer),summary=case when p_payload?'summary' then p_payload->>'summary' else summary end,internal_notes=case when p_payload?'internalNotes' then p_payload->>'internalNotes' else internal_notes end,customer_comment=case when p_payload?'customerComment' then p_payload->>'customerComment' else customer_comment end,checklist_results=case when p_payload?'checklistResults' then p_payload->'checklistResults' else checklist_results end,sent_at=case when p_payload?'sentAt' then nullif(p_payload->>'sentAt','')::timestamptz else sent_at end,record_data=record_data||p_payload where tenant_id=p_tenant_id and id=p_entity_id;
    end if;
    select to_jsonb(row) into result_record from public.homecare_reports row where tenant_id=p_tenant_id and id=p_entity_id;
  elsif p_entity_type='portal_message' then
    if p_operation='create' then
      insert into public.homecare_portal_messages(id,tenant_id,customer_id,object_id,report_id,subject,message,status,delivery_status,delivery_error,origin,sent_at,record_data,created_at)
      values(p_entity_id,p_tenant_id,nullif(p_payload->>'customerId',''),nullif(p_payload->>'objectId',''),nullif(p_payload->>'reportId',''),coalesce(nullif(p_payload->>'subject',''),'Nachricht'),coalesce(p_payload->>'message',''),coalesce(nullif(p_payload->>'status',''),'neu'),nullif(p_payload->>'deliveryStatus',''),nullif(p_payload->>'deliveryError',''),nullif(p_payload->>'origin',''),nullif(p_payload->>'sentAt','')::timestamptz,p_payload,coalesce(nullif(p_payload->>'createdAt','')::timestamptz,now()));
    elsif p_operation='delete' then
      update public.homecare_portal_messages set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and id=p_entity_id;
      update public.homecare_portal_message_replies set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and message_id=p_entity_id and deleted_at is null;
      update public.homecare_media set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and owner_type='portal_message' and owner_id=p_entity_id and deleted_at is null;
    elsif p_operation='restore' then update public.homecare_portal_messages set deleted_at=null where tenant_id=p_tenant_id and id=p_entity_id;
    else
      update public.homecare_portal_messages set subject=coalesce(nullif(p_payload->>'subject',''),subject),message=case when p_payload?'message' then p_payload->>'message' else message end,status=coalesce(nullif(p_payload->>'status',''),status),delivery_status=case when p_payload?'deliveryStatus' then nullif(p_payload->>'deliveryStatus','') else delivery_status end,delivery_error=case when p_payload?'deliveryError' then nullif(p_payload->>'deliveryError','') else delivery_error end,sent_at=case when p_payload?'sentAt' then nullif(p_payload->>'sentAt','')::timestamptz else sent_at end,record_data=record_data||p_payload where tenant_id=p_tenant_id and id=p_entity_id;
    end if;
    select to_jsonb(row) into result_record from public.homecare_portal_messages row where tenant_id=p_tenant_id and id=p_entity_id;
  elsif p_entity_type='portal_message_reply' then
    if p_operation='create' then insert into public.homecare_portal_message_replies(id,tenant_id,message_id,body,subject,recipient,delivery_status,delivery_error,sent_at,record_data) values(p_entity_id,p_tenant_id,p_resource_id,coalesce(p_payload->>'body',''),p_payload->>'subject',p_payload->>'to',p_payload->>'deliveryStatus',p_payload->>'deliveryError',nullif(p_payload->>'sentAt','')::timestamptz,p_payload);
    elsif p_operation='delete' then update public.homecare_portal_message_replies set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and id=p_entity_id;
    elsif p_operation='restore' then update public.homecare_portal_message_replies set deleted_at=null where tenant_id=p_tenant_id and id=p_entity_id;
    else update public.homecare_portal_message_replies set body=coalesce(p_payload->>'body',body),subject=coalesce(p_payload->>'subject',subject),recipient=coalesce(p_payload->>'to',recipient),delivery_status=coalesce(p_payload->>'deliveryStatus',delivery_status),delivery_error=case when p_payload?'deliveryError' then p_payload->>'deliveryError' else delivery_error end,sent_at=coalesce(nullif(p_payload->>'sentAt','')::timestamptz,sent_at),record_data=record_data||p_payload where tenant_id=p_tenant_id and id=p_entity_id;
    end if;
    select to_jsonb(row) into result_record from public.homecare_portal_message_replies row where tenant_id=p_tenant_id and id=p_entity_id;
  else
    if p_operation='create' then
      insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,storage_path,preview_url,metadata,created_at) values(p_entity_id,p_tenant_id,case when p_entity_type='report_media' then 'report' else 'portal_message' end,p_resource_id,coalesce(nullif(p_payload->>'mediaRole',''),'attachment'),coalesce(nullif(p_payload->>'name',''),'Datei'),nullif(p_payload->>'storagePath',''),coalesce(nullif(p_payload->>'storageUrl',''),nullif(p_payload->>'previewUrl','')),p_payload,coalesce(nullif(p_payload->>'createdAt','')::timestamptz,now()))
      on conflict(id) do update set owner_type=excluded.owner_type,owner_id=excluded.owner_id,kind=excluded.kind,name=excluded.name,storage_path=excluded.storage_path,preview_url=excluded.preview_url,metadata=public.homecare_media.metadata||excluded.metadata where public.homecare_media.tenant_id=excluded.tenant_id and public.homecare_media.owner_type='pending';
    elsif p_operation='delete' then update public.homecare_media set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and id=p_entity_id;
    elsif p_operation='restore' then update public.homecare_media set deleted_at=null where tenant_id=p_tenant_id and id=p_entity_id;
    else update public.homecare_media set name=coalesce(nullif(p_payload->>'name',''),name),storage_path=case when p_payload?'storagePath' then nullif(p_payload->>'storagePath','') else storage_path end,preview_url=case when p_payload?'storageUrl' then nullif(p_payload->>'storageUrl','') when p_payload?'previewUrl' then nullif(p_payload->>'previewUrl','') else preview_url end,metadata=metadata||p_payload where tenant_id=p_tenant_id and id=p_entity_id;
    end if;
    select to_jsonb(row) into result_record from public.homecare_media row where tenant_id=p_tenant_id and id=p_entity_id;
  end if;
  response=jsonb_build_object('mutationId',p_mutation_id,'status','synced','record',result_record);
  update public.homecare_sync_mutations set status='synced',response_payload=response,applied_at=now(),updated_at=now() where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
  return response;
exception when unique_violation or foreign_key_violation then
  response=jsonb_build_object('mutationId',p_mutation_id,'status','conflict','error','Beziehung oder ID ist nicht mehr aktuell.');
  update public.homecare_sync_mutations set status='conflict',response_payload=response,error=response->>'error',updated_at=now() where tenant_id=p_tenant_id and mutation_id=p_mutation_id; return response;
end $$;
revoke all on function public.homecare_apply_report_communication_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_report_communication_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;
