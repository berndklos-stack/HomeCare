begin;
alter table public.homecare_goods_receipts add column document_id text;
alter table public.homecare_goods_receipts add constraint goods_document_fk foreign key(tenant_id,document_id) references public.homecare_media(tenant_id,id);
create table public.homecare_supplier_damage_cases (
 tenant_id uuid not null, id uuid not null, receipt_id uuid not null, supplier_id uuid not null,
 description text not null check(length(trim(description)) between 1 and 4000),
 status text not null default 'open' check(status in ('open','in_progress','completed')),
 revision integer not null default 1, created_at timestamptz not null default now(), created_by uuid not null,
 updated_at timestamptz not null default now(), updated_by uuid not null,
 primary key(tenant_id,id), unique(tenant_id,receipt_id),
 foreign key(tenant_id,receipt_id) references public.homecare_goods_receipts(tenant_id,id),
 foreign key(tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id)
);
create table public.homecare_supplier_damage_photos (
 tenant_id uuid not null, case_id uuid not null, document_id text not null,
 primary key(tenant_id,case_id,document_id),
 foreign key(tenant_id,case_id) references public.homecare_supplier_damage_cases(tenant_id,id),
 foreign key(tenant_id,document_id) references public.homecare_media(tenant_id,id)
);
create table public.homecare_supplier_damage_events (
 tenant_id uuid not null, id uuid not null default gen_random_uuid(), case_id uuid not null,
 status text not null check(status in ('open','in_progress','completed')), note text not null default '',
 actor_user_id uuid not null, created_at timestamptz not null default now(),
 primary key(tenant_id,id), foreign key(tenant_id,case_id) references public.homecare_supplier_damage_cases(tenant_id,id)
);
create index supplier_damage_status on public.homecare_supplier_damage_cases(tenant_id,status,supplier_id);
do $$ declare tbl text; begin
 foreach tbl in array array['homecare_supplier_damage_cases','homecare_supplier_damage_photos','homecare_supplier_damage_events'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy damage_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
 end loop;
end $$;
-- Attach the document when the immutable purchase receipt is created.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb)'::regprocedure);
 if position('''document_id'',null' in definition)=0 then raise exception 'RECEIPT_BASE_DEFINITION_UNEXPECTED'; end if;
 execute replace(definition,'''document_id'',null','''document_id'',p_payload->>''document_id''');
end $$;
alter function public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb) rename to homecare_scan_goods_receipt_before_damage;
create function public.homecare_scan_goods_receipt(p_tenant uuid,p_id uuid,p_actor uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved public.homecare_goods_receipts%rowtype; photo text; document text:=nullif(p_payload->>'document_id',''); damage jsonb:=p_payload->'damage';
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':goods:'||p_id::text,0));
 select * into saved from public.homecare_goods_receipts where tenant_id=p_tenant and id=p_id;
 if found then
  if saved.actor_user_id<>p_actor or saved.request_payload is distinct from p_payload then raise exception 'RECEIPT_ID_REUSED'; end if;
  return p_id;
 end if;
 if document is not null and not exists(select 1 from public.homecare_media where tenant_id=p_tenant and id=document and deleted_at is null and storage_path like p_tenant::text||'/purchase-documents/%' and metadata->>'contentType'='application/pdf') then raise exception 'RECEIPT_DOCUMENT_INVALID'; end if;
 if damage is not null and damage<>'null'::jsonb then
  if jsonb_typeof(damage) is distinct from 'object' or length(trim(coalesce(damage->>'description',''))) not between 1 and 4000
   or jsonb_typeof(damage->'photos') is distinct from 'array' or jsonb_array_length(damage->'photos') not between 1 and 20 then raise exception 'DAMAGE_DOCUMENTATION_REQUIRED'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(damage->'photos'))<>jsonb_array_length(damage->'photos') then raise exception 'DAMAGE_PHOTO_INVALID'; end if;
  for photo in select value from jsonb_array_elements_text(damage->'photos') loop
   if not exists(select 1 from public.homecare_media where tenant_id=p_tenant and id=photo and deleted_at is null and storage_path like p_tenant::text||'/purchase-documents/%' and metadata->>'contentType' like 'image/%') then raise exception 'DAMAGE_PHOTO_INVALID'; end if;
  end loop;
 end if;
 perform public.homecare_scan_goods_receipt_before_damage(p_tenant,p_id,p_actor,p_payload);
 if document is not null then
  update public.homecare_goods_receipts set document_id=document where tenant_id=p_tenant and id=p_id;
  update public.homecare_media set owner_type='goods_receipt',owner_id=p_id::text where tenant_id=p_tenant and id=document;
 end if;
 if damage is not null and damage<>'null'::jsonb then
  insert into public.homecare_supplier_damage_cases(tenant_id,id,receipt_id,supplier_id,description,created_by,updated_by)
   values(p_tenant,p_id,p_id,(p_payload->>'supplier_id')::uuid,trim(damage->>'description'),p_actor,p_actor);
  for photo in select value from jsonb_array_elements_text(damage->'photos') loop
   insert into public.homecare_supplier_damage_photos values(p_tenant,p_id,photo);
   update public.homecare_media set owner_type='supplier_damage',owner_id=p_id::text where tenant_id=p_tenant and id=photo;
  end loop;
  insert into public.homecare_supplier_damage_events(tenant_id,case_id,status,actor_user_id) values(p_tenant,p_id,'open',p_actor);
 end if;
 return p_id;
end $$;
revoke all on function public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb) to service_role;
create function public.homecare_update_damage_case(p_tenant uuid,p_id uuid,p_revision integer,p_status text,p_note text,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare item public.homecare_supplier_damage_cases%rowtype;
begin
 if p_actor is null or p_status not in ('open','in_progress','completed') or p_status is null or length(coalesce(p_note,''))>4000 then raise exception 'INVALID_OPERATIONS_COMMAND'; end if;
 select * into item from public.homecare_supplier_damage_cases where tenant_id=p_tenant and id=p_id for update;
 if not found then raise exception 'DAMAGE_CASE_NOT_FOUND'; end if;
 if item.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if item.status=p_status and coalesce(trim(p_note),'')='' then return item.revision; end if;
 update public.homecare_supplier_damage_cases set status=p_status,revision=revision+1,updated_at=now(),updated_by=p_actor where tenant_id=p_tenant and id=p_id;
 insert into public.homecare_supplier_damage_events(tenant_id,case_id,status,note,actor_user_id) values(p_tenant,p_id,p_status,coalesce(trim(p_note),''),p_actor);
 return item.revision+1;
end $$;
revoke all on function public.homecare_update_damage_case(uuid,uuid,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.homecare_update_damage_case(uuid,uuid,integer,text,text,uuid) to service_role;
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_damage;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_damage()||array['homecare_supplier_damage_cases','homecare_supplier_damage_photos','homecare_supplier_damage_events']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
