begin;

alter table public.homecare_billing_items
  add column if not exists customer_reference text,
  add column if not exists our_reference text,
  add column if not exists order_reference text;
alter table public.homecare_invoice_lines
  add column if not exists article_number text,
  add column if not exists comment text,
  add column if not exists line_discount_percent numeric(7,4) not null default 0
    check (line_discount_percent between 0 and 100);
alter table public.homecare_media
  add column if not exists job_time_entry_id text,
  add column if not exists content_type text,
  add column if not exists byte_size bigint check (byte_size >= 0),
  add constraint homecare_media_time_entry_fk foreign key (tenant_id,job_time_entry_id)
    references public.homecare_job_time_entries(tenant_id,id) on delete restrict;
create index if not exists homecare_media_time_entry_idx on public.homecare_media(tenant_id,job_time_entry_id)
  where job_time_entry_id is not null;

-- Preserve any pre-existing values; never replace a populated native column.
do $$ begin
  if exists(select 1 from public.homecare_billing_items where
    (customer_reference is not null and record_data?'customerReference' and customer_reference is distinct from record_data->>'customerReference') or
    (our_reference is not null and record_data?'ourReference' and our_reference is distinct from record_data->>'ourReference') or
    (order_reference is not null and record_data?'orderReference' and order_reference is distinct from record_data->>'orderReference'))
    or exists(select 1 from public.homecare_invoice_lines where
    (article_number is not null and record_data?'articleNumber' and article_number is distinct from record_data->>'articleNumber') or
    (comment is not null and record_data?'comment' and comment is distinct from record_data->>'comment'))
    then raise exception 'LEGACY_INVOICE_FIELDS_REQUIRE_REVIEW'; end if;
  if exists(select 1 from public.homecare_invoice_lines where nullif(record_data->>'discountPercent','') is not null
    and record_data->>'discountPercent' !~ '^0([.,]0+)?$') then raise exception 'LEGACY_LINE_DISCOUNT_REQUIRES_REVIEW'; end if;
end $$;
update public.homecare_billing_items set
  customer_reference=coalesce(customer_reference,record_data->>'customerReference'),
  our_reference=coalesce(our_reference,record_data->>'ourReference'),
  order_reference=coalesce(order_reference,record_data->>'orderReference'),
  record_data=record_data-'customerReference'-'ourReference'-'orderReference'
where record_data ?| array['customerReference','ourReference','orderReference'];
alter table public.homecare_invoice_lines disable trigger protect_invoice_line;
update public.homecare_invoice_lines set article_number=coalesce(article_number,record_data->>'articleNumber'),
  comment=coalesce(comment,record_data->>'comment'),record_data=record_data-'articleNumber'-'comment'
  where record_data ?| array['articleNumber','comment'];
alter table public.homecare_invoice_lines enable trigger protect_invoice_line;

-- The existing versioned mutation payloads are projected into authoritative columns.
-- Unrelated legacy record_data remains untouched.
create or replace function public.homecare_project_invoice_references() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.record_data ? 'customerReference' then new.customer_reference:=new.record_data->>'customerReference'; end if;
  if new.record_data ? 'ourReference' then new.our_reference:=new.record_data->>'ourReference'; end if;
  if new.record_data ? 'orderReference' then new.order_reference:=new.record_data->>'orderReference'; end if;
  new.record_data:=new.record_data-'customerReference'-'ourReference'-'orderReference';
  if tg_op='UPDATE' and old.invoice_status<>'entwurf' and
    (new.customer_reference is distinct from old.customer_reference or new.our_reference is distinct from old.our_reference or new.order_reference is distinct from old.order_reference) then
    raise exception 'Ausgestellte Rechnungen sind unveraenderlich.' using errcode='23514';
  end if;
  if greatest(length(new.customer_reference),length(new.our_reference),length(new.order_reference))>250 then raise exception 'INVOICE_REFERENCE_TOO_LONG'; end if;
  return new;
end $$;
create trigger project_invoice_references before insert or update on public.homecare_billing_items
  for each row execute function public.homecare_project_invoice_references();
create or replace function public.homecare_project_invoice_line_fields() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.record_data ? 'articleNumber' then new.article_number:=new.record_data->>'articleNumber'; end if;
  if new.record_data ? 'comment' then new.comment:=new.record_data->>'comment'; end if;
  if new.record_data ? 'discountPercent' then new.line_discount_percent:=coalesce(public.homecare_text_to_numeric(new.record_data->>'discountPercent'),0); end if;
  new.record_data:=new.record_data-'articleNumber'-'comment'-'discountPercent';
  if length(new.article_number)>100 or length(new.comment)>10000 then raise exception 'INVOICE_LINE_TEXT_TOO_LONG'; end if;
  if new.kind='Rabatt' and new.line_discount_percent<>0 then raise exception 'DISCOUNT_LINE_CANNOT_HAVE_PERCENTAGE'; end if;
  return new;
end $$;
create trigger project_invoice_line_fields before insert or update on public.homecare_invoice_lines
  for each row execute function public.homecare_project_invoice_line_fields();

create or replace function public.homecare_refresh_invoice_totals(p_tenant uuid,p_invoice text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform set_config('workcore.skip_financial_revision','1',true);
  update public.homecare_billing_items invoice set net_total=t.net,tax_total=t.tax,gross_total=t.net+t.tax
  from (select coalesce(sum(round(quantity*unit_price*(1-line_discount_percent/100),2)),0) net,
    coalesce(sum(round(round(quantity*unit_price*(1-line_discount_percent/100),2)*tax_rate/100,2)),0) tax
    from public.homecare_invoice_lines where tenant_id=p_tenant and invoice_id=p_invoice and deleted_at is null) t
  where invoice.tenant_id=p_tenant and invoice.id=p_invoice;
  perform set_config('workcore.skip_financial_revision','0',true);
end $$;

alter function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)
  rename to homecare_apply_job_operation_before_attachments;
create function public.homecare_apply_job_operation_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null,p_actor_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; attachment jsonb; media public.homecare_media%rowtype; prior jsonb;
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text||':'||p_mutation_id::text));
  select response_payload into prior from public.homecare_sync_mutations
    where tenant_id=p_tenant_id and mutation_id=p_mutation_id and status in('synced','conflict');
  if found then return prior; end if;
  if p_entity_type='job_time_entry' then
    perform 1 from public.homecare_job_time_entries where tenant_id=p_tenant_id and id=p_entity_id for update;
  end if;
  if p_entity_type='job_time_entry' and p_payload?'attachments' and p_operation in('create','update') then
    if jsonb_typeof(p_payload->'attachments')<>'array' or jsonb_array_length(p_payload->'attachments')>20 then raise exception 'INVALID_ATTACHMENTS'; end if;
    if exists(select 1 from public.homecare_job_time_entries where tenant_id=p_tenant_id and id=p_entity_id and billing_status<>'offen')
      and (select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from public.homecare_media where tenant_id=p_tenant_id and job_time_entry_id=p_entity_id and deleted_at is null)
        is distinct from (select coalesce(jsonb_agg(value->>'id' order by value->>'id'),'[]'::jsonb) from jsonb_array_elements(p_payload->'attachments'))
      then raise exception 'BILLED_ENTRY_READ_ONLY'; end if;
    if (select count(*) from jsonb_array_elements(p_payload->'attachments')) <>
       (select count(distinct value->>'id') from jsonb_array_elements(p_payload->'attachments')) then raise exception 'DUPLICATE_ATTACHMENT'; end if;
    for attachment in select value from jsonb_array_elements(p_payload->'attachments') loop
      select * into media from public.homecare_media where tenant_id=p_tenant_id and id=attachment->>'id' for update;
      if not found or media.deleted_at is not null or
        not (media.owner_type='pending' or (media.owner_type='job_time_entry' and media.job_time_entry_id=p_entity_id)) or
        media.storage_path is null or media.storage_path not like p_tenant_id::text||'/consulting-entry-attachments/%' then raise exception 'ATTACHMENT_NOT_OWNED'; end if;
    end loop;
  end if;
  result:=public.homecare_apply_job_operation_before_attachments(p_mutation_id,p_entity_type,p_entity_id,p_operation,p_resource_id,p_tenant_id,p_payload-'attachments',p_expected_revision,p_actor_id);
  if result->>'status'='synced' then
    if p_entity_type='job_time_entry' and p_payload?'attachments' and p_operation in('create','update') then
      update public.homecare_media set deleted_at=now() where tenant_id=p_tenant_id and job_time_entry_id=p_entity_id and deleted_at is null
        and id not in(select value->>'id' from jsonb_array_elements(p_payload->'attachments'));
      update public.homecare_media set owner_type='job_time_entry',owner_id=p_entity_id,job_time_entry_id=p_entity_id,
        content_type=coalesce(content_type,metadata->>'contentType'),byte_size=coalesce(byte_size,(metadata->>'size')::bigint)
        where tenant_id=p_tenant_id and id in(select value->>'id' from jsonb_array_elements(p_payload->'attachments'));
    elsif p_entity_type='job_time_entry' and p_operation='delete' then
      update public.homecare_media set deleted_at=coalesce(deleted_at,now()) where tenant_id=p_tenant_id and job_time_entry_id=p_entity_id;
    elsif p_entity_type='job' and p_operation='delete' then
      update public.homecare_media m set deleted_at=coalesce(m.deleted_at,now()) where m.tenant_id=p_tenant_id
        and m.job_time_entry_id in(select id from public.homecare_job_time_entries where tenant_id=p_tenant_id and job_id=p_entity_id);
    end if;
  end if;
  return result;
end $$;

revoke all on function public.homecare_project_invoice_references(),public.homecare_project_invoice_line_fields() from public,anon,authenticated;
revoke all on function public.homecare_apply_job_operation_before_attachments(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
revoke all on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) to service_role;
revoke all on function public.homecare_refresh_invoice_totals(uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_refresh_invoice_totals(uuid,text) to service_role;
commit;
