-- Accelerated Decommission Wave 1: relational authority for objects and object media.

alter table public.homecare_objects
  add column if not exists object_type text not null default 'Objekt',
  add column if not exists custom_fields jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

drop trigger if exists bump_revision on public.homecare_objects;
create trigger bump_revision before update on public.homecare_objects
for each row execute function public.homecare_bump_revision();

create index if not exists homecare_objects_tenant_live_idx
  on public.homecare_objects(tenant_id, updated_at desc) where deleted_at is null;
create index if not exists homecare_media_object_live_idx
  on public.homecare_media(tenant_id, owner_id, updated_at desc)
  where owner_type = 'object' and deleted_at is null;

-- Recover JSON-only rows. Existing relational rows, including tombstones, win.
with section_objects as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end
  ) item
  where state.id='sync-section:objects'
), snapshot_objects as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'objects')='array' then state.data->'objects' else '[]'::jsonb end
  ) item
  where state.id='kolaretorp-service-app'
), candidates as (
  select distinct on (tenant_id,item->>'id') tenant_id,item,updated_at
  from (select * from section_objects union all select * from snapshot_objects) source
  where nullif(item->>'id','') is not null
  order by tenant_id,item->>'id',updated_at desc
)
insert into public.homecare_objects (
  id,tenant_id,owner_customer_id,name,owner_name,owner_email,owner_phone,owner_address,
  address,billing_address_mode,billing_address,region,size_sqm,plot_sqm,rooms,beds,bathrooms,
  build_year,care_package,status,key_safe,alarm,parking,access_notes,heating,water,septic,internet,
  equipment,risks,next_visit,last_visit,archived,object_type,custom_fields,updated_at
)
select
  item->>'id',tenant_id,
  case when exists (select 1 from public.homecare_customers c where c.tenant_id=candidates.tenant_id and c.id=item->>'ownerCustomerId') then nullif(item->>'ownerCustomerId','') else null end,
  coalesce(nullif(item->>'name',''),'Unbenanntes Objekt'),nullif(item->>'owner',''),nullif(item->>'ownerEmail',''),
  nullif(item->>'ownerPhone',''),nullif(item->>'ownerAddress',''),nullif(item->>'address',''),
  coalesce(nullif(item->>'billingAddressMode',''),'Objektadresse'),nullif(item->>'billingAddress',''),nullif(item->>'region',''),
  public.homecare_text_to_numeric(item->>'sizeSqm')::integer,public.homecare_text_to_numeric(item->>'plotSqm')::integer,
  public.homecare_text_to_numeric(item->>'rooms')::integer,public.homecare_text_to_numeric(item->>'beds')::integer,
  public.homecare_text_to_numeric(item->>'bathrooms')::integer,public.homecare_text_to_numeric(item->>'buildYear')::integer,
  nullif(item->>'carePackage',''),nullif(item->>'status',''),nullif(item#>>'{access,keySafe}',''),
  nullif(item#>>'{access,alarm}',''),nullif(item#>>'{access,parking}',''),nullif(item#>>'{access,notes}',''),
  nullif(item#>>'{utilities,heating}',''),nullif(item#>>'{utilities,water}',''),nullif(item#>>'{utilities,septic}',''),
  nullif(item#>>'{utilities,internet}',''),case when jsonb_typeof(item->'equipment')='array' then item->'equipment' else '[]'::jsonb end,
  case when jsonb_typeof(item->'risks')='array' then item->'risks' else '[]'::jsonb end,
  case when item->>'nextVisit' ~ '^\d{4}-\d{2}-\d{2}$' then (item->>'nextVisit')::date end,
  case when item->>'lastVisit' ~ '^\d{4}-\d{2}-\d{2}$' then (item->>'lastVisit')::date end,
  coalesce((item->>'archived')::boolean,false),coalesce(nullif(item->>'type',''),'Objekt'),
  case when jsonb_typeof(item->'customFields')='object' then item->'customFields' else '{}'::jsonb end,
  coalesce(updated_at,now())
from candidates
on conflict (id) do nothing;

with section_objects as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
  where state.id='sync-section:objects'
), snapshot_objects as (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when jsonb_typeof(state.data->'objects')='array' then state.data->'objects' else '[]'::jsonb end) item
  where state.id='kolaretorp-service-app'
), candidates as (
  select distinct on (tenant_id,item->>'id') tenant_id,item,updated_at
  from (select * from section_objects union all select * from snapshot_objects) source
  where nullif(item->>'id','') is not null order by tenant_id,item->>'id',updated_at desc
), media_candidates as (
  select candidate.tenant_id,candidate.item->>'id' owner_id,media.item,candidate.updated_at
  from candidates candidate
  cross join lateral jsonb_array_elements(case when jsonb_typeof(candidate.item#>'{media,items}')='array' then candidate.item#>'{media,items}' else '[]'::jsonb end) media(item)
)
insert into public.homecare_media (
  id,tenant_id,owner_type,owner_id,kind,name,description,source,storage_path,preview_url,is_primary,updated_at
)
select item->>'id',tenant_id,'object',owner_id,coalesce(nullif(item->>'type',''),'Dokument'),
  coalesce(nullif(item->>'name',''),'Unbenannte Datei'),nullif(item->>'description',''),nullif(item->>'source',''),
  nullif(item->>'storagePath',''),nullif(item->>'previewUrl',''),coalesce((item->>'isPrimary')::boolean,false),coalesce(updated_at,now())
from media_candidates candidate
where nullif(item->>'id','') is not null
  and exists (select 1 from public.homecare_objects object where object.tenant_id=candidate.tenant_id and object.id=candidate.owner_id)
on conflict (id) do nothing;

-- Domain-specific RLS replaces generic data.write policies.
drop policy if exists tenant_member_insert on public.homecare_objects;
drop policy if exists tenant_member_update on public.homecare_objects;
drop policy if exists tenant_member_delete on public.homecare_objects;
create policy tenant_member_insert on public.homecare_objects for insert to authenticated
  with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'objects.manage'));
create policy tenant_member_update on public.homecare_objects for update to authenticated
  using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'objects.manage'))
  with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'objects.manage'));
create policy tenant_member_delete on public.homecare_objects for delete to authenticated
  using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'objects.manage'));

drop policy if exists tenant_member_insert on public.homecare_media;
drop policy if exists tenant_member_update on public.homecare_media;
drop policy if exists tenant_member_delete on public.homecare_media;
create policy tenant_member_insert on public.homecare_media for insert to authenticated
  with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'media.manage'));
create policy tenant_member_update on public.homecare_media for update to authenticated
  using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'media.manage'))
  with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'media.manage'));
create policy tenant_member_delete on public.homecare_media for delete to authenticated
  using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'media.manage'));

create or replace function public.homecare_prevent_object_hard_delete()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'Objekte und Objektmedien werden archiviert oder per Tombstone gelöscht.' using errcode='23514';
end;
$$;
drop trigger if exists prevent_object_hard_delete on public.homecare_objects;
create trigger prevent_object_hard_delete before delete on public.homecare_objects
for each row execute function public.homecare_prevent_object_hard_delete();

create or replace function public.homecare_prevent_object_media_hard_delete()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.owner_type='object' then
    raise exception 'Objektmedien werden per Tombstone gelöscht.' using errcode='23514';
  end if;
  return old;
end;
$$;
drop trigger if exists prevent_object_media_hard_delete on public.homecare_media;
create trigger prevent_object_media_hard_delete before delete on public.homecare_media
for each row execute function public.homecare_prevent_object_media_hard_delete();

create or replace function public.homecare_apply_object_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,
  p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  existing_mutation public.homecare_sync_mutations%rowtype;
  object_row public.homecare_objects%rowtype;
  media_row public.homecare_media%rowtype;
  response jsonb;
  tenant uuid:=p_tenant_id;
begin
  if tenant is null then raise exception 'Mandant fehlt.' using errcode='22023'; end if;
  if p_entity_type not in ('object','object_media') then raise exception 'Nicht unterstützte Objektmutation.' using errcode='22023'; end if;
  if p_operation not in ('create','update','delete','restore') then raise exception 'Unbekannte Objektoperation.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext(tenant::text||':'||p_mutation_id::text));
  select * into existing_mutation from public.homecare_sync_mutations where tenant_id=tenant and mutation_id=p_mutation_id;
  if found and existing_mutation.status in ('synced','conflict') then return existing_mutation.response_payload; end if;
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload)
  values(p_mutation_id,tenant,p_entity_type,p_entity_id,p_operation,'syncing',p_expected_revision,coalesce(p_payload,'{}'::jsonb))
  on conflict(tenant_id,mutation_id) do update set status='syncing',updated_at=now();

  if p_entity_type='object' then
    select * into object_row from public.homecare_objects where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' then
      if found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(object_row),'error','Das Objekt existiert bereits.');
      elsif nullif(p_payload->>'ownerCustomerId','') is not null and not exists(select 1 from public.homecare_customers where tenant_id=tenant and id=p_payload->>'ownerCustomerId' and deleted_at is null) then
        response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der zugehörige Kunde existiert nicht oder wurde gelöscht.');
      else
        insert into public.homecare_objects(id,tenant_id,owner_customer_id,name,owner_name,owner_email,owner_phone,owner_address,address,billing_address_mode,billing_address,region,size_sqm,plot_sqm,rooms,beds,bathrooms,build_year,care_package,status,key_safe,alarm,parking,access_notes,heating,water,septic,internet,equipment,risks,next_visit,last_visit,archived,object_type,custom_fields,revision,deleted_at)
        values(p_entity_id,tenant,nullif(p_payload->>'ownerCustomerId',''),coalesce(nullif(p_payload->>'name',''),'Unbenanntes Objekt'),nullif(p_payload->>'owner',''),nullif(p_payload->>'ownerEmail',''),nullif(p_payload->>'ownerPhone',''),nullif(p_payload->>'ownerAddress',''),nullif(p_payload->>'address',''),coalesce(nullif(p_payload->>'billingAddressMode',''),'Objektadresse'),nullif(p_payload->>'billingAddress',''),nullif(p_payload->>'region',''),public.homecare_text_to_numeric(p_payload->>'sizeSqm')::integer,public.homecare_text_to_numeric(p_payload->>'plotSqm')::integer,public.homecare_text_to_numeric(p_payload->>'rooms')::integer,public.homecare_text_to_numeric(p_payload->>'beds')::integer,public.homecare_text_to_numeric(p_payload->>'bathrooms')::integer,public.homecare_text_to_numeric(p_payload->>'buildYear')::integer,nullif(p_payload->>'carePackage',''),nullif(p_payload->>'status',''),nullif(p_payload#>>'{access,keySafe}',''),nullif(p_payload#>>'{access,alarm}',''),nullif(p_payload#>>'{access,parking}',''),nullif(p_payload#>>'{access,notes}',''),nullif(p_payload#>>'{utilities,heating}',''),nullif(p_payload#>>'{utilities,water}',''),nullif(p_payload#>>'{utilities,septic}',''),nullif(p_payload#>>'{utilities,internet}',''),coalesce(p_payload->'equipment','[]'::jsonb),coalesce(p_payload->'risks','[]'::jsonb),nullif(p_payload->>'nextVisit','')::date,nullif(p_payload->>'lastVisit','')::date,coalesce((p_payload->>'archived')::boolean,false),coalesce(nullif(p_payload->>'type',''),'Objekt'),coalesce(p_payload->'customFields','{}'::jsonb),1,null)
        returning * into object_row;
      end if;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Das Objekt existiert auf dem Server nicht mehr.');
    elsif p_expected_revision is not null and object_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(object_row),'error','Das Objekt wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then
      if not object_row.archived then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(object_row),'error','Das Objekt muss vor dem Löschen archiviert werden.');
      elsif exists(select 1 from public.homecare_jobs where tenant_id=tenant and object_id=p_entity_id and status not in ('erledigt','abgerechnet','storniert'))
        or exists(select 1 from public.homecare_billing_items where tenant_id=tenant and object_id=p_entity_id and paid_at is null and cancelled_at is null) then
        response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(object_row),'error','Aktive Aufträge oder offene Abrechnungsposten verhindern das Löschen.');
      else
        update public.homecare_objects set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into object_row;
        update public.homecare_media set deleted_at=coalesce(deleted_at,now()),revision=revision+1 where tenant_id=tenant and owner_type='object' and owner_id=p_entity_id and deleted_at is null;
      end if;
    elsif p_operation='restore' then
      update public.homecare_objects set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into object_row;
    else
      if p_payload?'ownerCustomerId' and nullif(p_payload->>'ownerCustomerId','') is not null and not exists(select 1 from public.homecare_customers where tenant_id=tenant and id=p_payload->>'ownerCustomerId' and deleted_at is null) then
        response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(object_row),'error','Der zugehörige Kunde existiert nicht oder wurde gelöscht.');
      else
        update public.homecare_objects object set
          owner_customer_id=case when p_payload?'ownerCustomerId' then nullif(p_payload->>'ownerCustomerId','') else object.owner_customer_id end,
          name=case when p_payload?'name' then coalesce(nullif(p_payload->>'name',''),object.name) else object.name end,
          owner_name=case when p_payload?'owner' then nullif(p_payload->>'owner','') else object.owner_name end,
          owner_email=case when p_payload?'ownerEmail' then nullif(p_payload->>'ownerEmail','') else object.owner_email end,
          owner_phone=case when p_payload?'ownerPhone' then nullif(p_payload->>'ownerPhone','') else object.owner_phone end,
          owner_address=case when p_payload?'ownerAddress' then nullif(p_payload->>'ownerAddress','') else object.owner_address end,
          address=case when p_payload?'address' then nullif(p_payload->>'address','') else object.address end,
          billing_address_mode=case when p_payload?'billingAddressMode' then coalesce(nullif(p_payload->>'billingAddressMode',''),'Objektadresse') else object.billing_address_mode end,
          billing_address=case when p_payload?'billingAddress' then nullif(p_payload->>'billingAddress','') else object.billing_address end,
          region=case when p_payload?'region' then nullif(p_payload->>'region','') else object.region end,
          size_sqm=case when p_payload?'sizeSqm' then public.homecare_text_to_numeric(p_payload->>'sizeSqm')::integer else object.size_sqm end,
          plot_sqm=case when p_payload?'plotSqm' then public.homecare_text_to_numeric(p_payload->>'plotSqm')::integer else object.plot_sqm end,
          rooms=case when p_payload?'rooms' then public.homecare_text_to_numeric(p_payload->>'rooms')::integer else object.rooms end,
          beds=case when p_payload?'beds' then public.homecare_text_to_numeric(p_payload->>'beds')::integer else object.beds end,
          bathrooms=case when p_payload?'bathrooms' then public.homecare_text_to_numeric(p_payload->>'bathrooms')::integer else object.bathrooms end,
          build_year=case when p_payload?'buildYear' then public.homecare_text_to_numeric(p_payload->>'buildYear')::integer else object.build_year end,
          care_package=case when p_payload?'carePackage' then nullif(p_payload->>'carePackage','') else object.care_package end,
          status=case when p_payload?'status' then nullif(p_payload->>'status','') else object.status end,
          key_safe=case when p_payload#>'{access,keySafe}' is not null then nullif(p_payload#>>'{access,keySafe}','') else object.key_safe end,
          alarm=case when p_payload#>'{access,alarm}' is not null then nullif(p_payload#>>'{access,alarm}','') else object.alarm end,
          parking=case when p_payload#>'{access,parking}' is not null then nullif(p_payload#>>'{access,parking}','') else object.parking end,
          access_notes=case when p_payload#>'{access,notes}' is not null then nullif(p_payload#>>'{access,notes}','') else object.access_notes end,
          heating=case when p_payload#>'{utilities,heating}' is not null then nullif(p_payload#>>'{utilities,heating}','') else object.heating end,
          water=case when p_payload#>'{utilities,water}' is not null then nullif(p_payload#>>'{utilities,water}','') else object.water end,
          septic=case when p_payload#>'{utilities,septic}' is not null then nullif(p_payload#>>'{utilities,septic}','') else object.septic end,
          internet=case when p_payload#>'{utilities,internet}' is not null then nullif(p_payload#>>'{utilities,internet}','') else object.internet end,
          equipment=case when p_payload?'equipment' then p_payload->'equipment' else object.equipment end,
          risks=case when p_payload?'risks' then p_payload->'risks' else object.risks end,
          next_visit=case when p_payload?'nextVisit' then nullif(p_payload->>'nextVisit','')::date else object.next_visit end,
          last_visit=case when p_payload?'lastVisit' then nullif(p_payload->>'lastVisit','')::date else object.last_visit end,
          archived=case when p_payload?'archived' then (p_payload->>'archived')::boolean else object.archived end,
          object_type=case when p_payload?'type' then coalesce(nullif(p_payload->>'type',''),'Objekt') else object.object_type end,
          custom_fields=case when p_payload?'customFields' then p_payload->'customFields' else object.custom_fields end,
          deleted_at=null,revision=revision+1
        where tenant_id=tenant and id=p_entity_id returning * into object_row;
      end if;
    end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(object_row)); end if;
  else
    select * into media_row from public.homecare_media where tenant_id=tenant and id=p_entity_id and owner_type='object' for update;
    if p_operation='create' then
      if found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(media_row),'error','Das Medium existiert bereits.');
      elsif not exists(select 1 from public.homecare_objects where tenant_id=tenant and id=p_resource_id and deleted_at is null) then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Das zugehörige Objekt existiert nicht oder wurde gelöscht.');
      elsif nullif(p_payload->>'storagePath','') is not null and p_payload->>'storagePath' not like tenant::text||'/%' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Speicherpfad gehört nicht zu diesem Mandanten.');
      else
        insert into public.homecare_media(id,tenant_id,owner_type,owner_id,kind,name,description,source,storage_path,preview_url,is_primary,revision,deleted_at)
        values(p_entity_id,tenant,'object',p_resource_id,coalesce(nullif(p_payload->>'type',''),'Dokument'),coalesce(nullif(p_payload->>'name',''),'Unbenannte Datei'),nullif(p_payload->>'description',''),nullif(p_payload->>'source',''),nullif(p_payload->>'storagePath',''),nullif(p_payload->>'previewUrl',''),coalesce((p_payload->>'isPrimary')::boolean,false),1,null) returning * into media_row;
      end if;
    elsif not found or media_row.owner_id<>p_resource_id then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Das Medium existiert im Objektkontext nicht mehr.');
    elsif p_expected_revision is not null and media_row.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(media_row),'error','Das Medium wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then update public.homecare_media set deleted_at=now(),revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into media_row;
    elsif p_operation='restore' then update public.homecare_media set deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into media_row;
    elsif nullif(p_payload->>'storagePath','') is not null and p_payload->>'storagePath' not like tenant::text||'/%' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(media_row),'error','Der Speicherpfad gehört nicht zu diesem Mandanten.');
    else
      update public.homecare_media media set kind=case when p_payload?'type' then coalesce(nullif(p_payload->>'type',''),'Dokument') else media.kind end,name=case when p_payload?'name' then coalesce(nullif(p_payload->>'name',''),'Unbenannte Datei') else media.name end,description=case when p_payload?'description' then nullif(p_payload->>'description','') else media.description end,source=case when p_payload?'source' then nullif(p_payload->>'source','') else media.source end,storage_path=case when p_payload?'storagePath' then nullif(p_payload->>'storagePath','') else media.storage_path end,preview_url=case when p_payload?'previewUrl' then nullif(p_payload->>'previewUrl','') else media.preview_url end,is_primary=case when p_payload?'isPrimary' then (p_payload->>'isPrimary')::boolean else media.is_primary end,deleted_at=null,revision=revision+1 where tenant_id=tenant and id=p_entity_id returning * into media_row;
    end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(media_row)); end if;
  end if;
  update public.homecare_sync_mutations set applied_at=case when response->>'status'='synced' then now() else null end,error=response->>'error',response_payload=response,status=response->>'status',updated_at=now() where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
end;
$$;

revoke all on function public.homecare_apply_object_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_object_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;
revoke all on function public.homecare_prevent_object_hard_delete() from public,anon,authenticated;
revoke all on function public.homecare_prevent_object_media_hard_delete() from public,anon,authenticated;
