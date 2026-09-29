-- Accelerated Decommission Wave 4: financial records become relational authoritative.

begin;

alter table public.homecare_billing_items
  add column if not exists record_data jsonb not null default '{}'::jsonb,
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists outgoing_book_number text,
  add column if not exists invoiced_at timestamptz,
  add column if not exists net_total numeric(14,2) not null default 0,
  add column if not exists tax_total numeric(14,2) not null default 0,
  add column if not exists gross_total numeric(14,2) not null default 0,
  add column if not exists currency text not null default 'SEK';

create table if not exists public.homecare_invoice_lines (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  invoice_id text not null,
  accounting_account text,
  kind text,
  name text not null,
  quantity numeric(14,4) not null default 0,
  unit text,
  unit_price numeric(14,4) not null default 0,
  currency text not null default 'SEK',
  tax_rate numeric(7,4) not null default 0,
  discount_type text,
  discount_value numeric(14,4),
  position integer not null default 0,
  record_data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,invoice_id) references public.homecare_billing_items(tenant_id,id) on delete restrict
);

create table if not exists public.homecare_payments (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  invoice_id text not null,
  amount numeric(14,2) not null,
  currency text not null default 'SEK',
  paid_at timestamptz not null,
  reference text,
  method text,
  record_data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,invoice_id) references public.homecare_billing_items(tenant_id,id) on delete restrict
);

create table if not exists public.homecare_accounting_exports (
  id text not null,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  invoice_id text not null,
  system text not null,
  status text not null,
  exported_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  checksum text,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,invoice_id) references public.homecare_billing_items(tenant_id,id) on delete restrict
);

create table if not exists public.homecare_financial_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  invoice_id text,
  operation text not null,
  before_data jsonb,
  after_data jsonb,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists homecare_billing_invoice_number_uidx on public.homecare_billing_items(tenant_id,invoice_number) where invoice_number is not null and invoice_number<>'' and deleted_at is null;
create unique index if not exists homecare_billing_outgoing_book_uidx on public.homecare_billing_items(tenant_id,outgoing_book_number) where outgoing_book_number is not null and outgoing_book_number<>'' and deleted_at is null;
create index if not exists homecare_invoice_lines_invoice_live_idx on public.homecare_invoice_lines(tenant_id,invoice_id,position) where deleted_at is null;
create index if not exists homecare_payments_invoice_live_idx on public.homecare_payments(tenant_id,invoice_id,paid_at) where deleted_at is null;
create index if not exists homecare_exports_invoice_live_idx on public.homecare_accounting_exports(tenant_id,invoice_id,exported_at desc) where deleted_at is null;

-- Relational rows win. JSON is imported only where a record is still absent.
create temporary table wave4_financial_source as
select distinct on(tenant_id,item->>'id') tenant_id,item,updated_at
from (
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when state.id='sync-section:billing' and jsonb_typeof(state.data->'value')='array' then state.data->'value' else '[]'::jsonb end) item
  union all
  select state.tenant_id,item,state.updated_at from public.app_state state
  cross join lateral jsonb_array_elements(case when state.id='kolaretorp-service-app' and jsonb_typeof(state.data->'billing')='array' then state.data->'billing' else '[]'::jsonb end) item
) source where nullif(item->>'id','') is not null
order by tenant_id,item->>'id',updated_at desc;

insert into public.homecare_billing_items(
  id,tenant_id,object_id,customer_id,job_id,report_id,source,label,amount,status,invoice_status,invoice_number,invoice_date,due_date,service_date,
  lines,notes,external_export_status,external_export_system,external_exported_at,sent_at,paid_at,cancelled_at,outgoing_book_number,invoiced_at,record_data,created_at,updated_at
)
select item->>'id',tenant_id,
  case when exists(select 1 from public.homecare_objects o where o.tenant_id=s.tenant_id and o.id=item->>'objectId') then nullif(item->>'objectId','') end,
  case when exists(select 1 from public.homecare_customers c where c.tenant_id=s.tenant_id and c.id=item->>'customerId') then nullif(item->>'customerId','') end,
  case when exists(select 1 from public.homecare_jobs j where j.tenant_id=s.tenant_id and j.id=item->>'jobId') then nullif(item->>'jobId','') end,
  case when exists(select 1 from public.homecare_reports r where r.tenant_id=s.tenant_id and r.id=item->>'reportId') then nullif(item->>'reportId','') end,
  nullif(item->>'source',''),coalesce(nullif(item->>'label',''),'Abrechnung'),public.homecare_text_to_numeric(item->>'amount'),coalesce(nullif(item->>'status',''),'abrechenbar'),
  nullif(item->>'invoiceStatus',''),nullif(item->>'invoiceNumber',''),public.homecare_text_to_date(item->>'invoiceDate'),public.homecare_text_to_date(item->>'dueDate'),public.homecare_text_to_date(item->>'serviceDate'),
  coalesce(item->'lines','[]'),nullif(item->>'notes',''),nullif(item->>'externalExportStatus',''),nullif(item->>'externalExportSystem',''),nullif(item->>'externalExportedAt','')::timestamptz,
  nullif(item->>'sentAt','')::timestamptz,nullif(item->>'paidAt','')::timestamptz,nullif(item->>'cancelledAt','')::timestamptz,nullif(item->>'outgoingBookNumber',''),nullif(item->>'invoicedAt','')::timestamptz,
  item-array['lines'],coalesce(nullif(item->>'createdAt','')::timestamptz,updated_at,now()),coalesce(updated_at,now())
from wave4_financial_source s on conflict(id) do nothing;

update public.homecare_billing_items invoice set
  record_data=case when invoice.record_data='{}' then source.item-array['lines'] else invoice.record_data end,
  outgoing_book_number=coalesce(invoice.outgoing_book_number,nullif(source.item->>'outgoingBookNumber','')),
  invoiced_at=coalesce(invoice.invoiced_at,nullif(source.item->>'invoicedAt','')::timestamptz)
from wave4_financial_source source where invoice.tenant_id=source.tenant_id and invoice.id=source.item->>'id';

insert into public.homecare_invoice_lines(id,tenant_id,invoice_id,accounting_account,kind,name,quantity,unit,unit_price,currency,tax_rate,discount_type,discount_value,position,record_data)
select coalesce(nullif(line->>'id',''),invoice.id||':line:'||ordinality),invoice.tenant_id,invoice.id,nullif(line->>'accountingAccount',''),nullif(line->>'kind',''),
  coalesce(nullif(line->>'name',''),'Position'),coalesce(public.homecare_text_to_numeric(line->>'quantity'),0),nullif(line->>'unit',''),coalesce(public.homecare_text_to_numeric(line->>'unitPrice'),0),
  coalesce(nullif(line->>'currency',''),'SEK'),coalesce(public.homecare_text_to_numeric(line->>'taxRate'),0),nullif(line->>'discountType',''),public.homecare_text_to_numeric(line->>'discountValue'),ordinality::integer,line
from public.homecare_billing_items invoice cross join lateral jsonb_array_elements(case when jsonb_typeof(invoice.lines)='array' then invoice.lines else '[]' end) with ordinality child(line,ordinality)
on conflict(tenant_id,id) do nothing;

insert into public.homecare_payments(id,tenant_id,invoice_id,amount,currency,paid_at,record_data)
select 'PAY-'||id,tenant_id,id,coalesce(amount,0),currency,paid_at,jsonb_build_object('source','legacy-paid-at') from public.homecare_billing_items where paid_at is not null
on conflict(tenant_id,id) do nothing;

insert into public.homecare_accounting_exports(id,tenant_id,invoice_id,system,status,exported_at,payload)
select 'EXP-'||id||'-legacy',tenant_id,id,coalesce(nullif(external_export_system,''),'Spiris / Visma Buchhaltung'),coalesce(nullif(external_export_status,''),'gesendet'),external_exported_at,jsonb_build_object('source','legacy-export')
from public.homecare_billing_items where external_exported_at is not null on conflict(tenant_id,id) do nothing;

create or replace function public.homecare_line_net(p_quantity numeric,p_unit_price numeric,p_discount_type text,p_discount_value numeric) returns numeric language sql immutable as $$
  select round(coalesce(p_quantity,0)*coalesce(p_unit_price,0),2)
$$;

create or replace function public.homecare_refresh_invoice_totals(p_tenant uuid,p_invoice text) returns void language plpgsql security definer set search_path=public as $$
begin
  perform set_config('workcore.skip_financial_revision','1',true);
  update public.homecare_billing_items invoice set
    net_total=totals.net_total,tax_total=totals.tax_total,gross_total=totals.net_total+totals.tax_total
  from (select coalesce(sum(public.homecare_line_net(quantity,unit_price,discount_type,discount_value)),0) net_total,
    coalesce(sum(round(public.homecare_line_net(quantity,unit_price,discount_type,discount_value)*tax_rate/100,2)),0) tax_total
    from public.homecare_invoice_lines where tenant_id=p_tenant and invoice_id=p_invoice and deleted_at is null) totals
  where invoice.tenant_id=p_tenant and invoice.id=p_invoice;
  perform set_config('workcore.skip_financial_revision','0',true);
end $$;

do $$ declare item record; begin for item in select tenant_id,id from public.homecare_billing_items loop perform public.homecare_refresh_invoice_totals(item.tenant_id,item.id); end loop; end $$;

create or replace function public.homecare_financial_audit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare tenant uuid:=coalesce(new.tenant_id,old.tenant_id); entity text:=tg_table_name; entity_id text:=coalesce(new.id,old.id); invoice text;
begin invoice:=case when tg_table_name='homecare_billing_items' then entity_id else coalesce(to_jsonb(new)->>'invoice_id',to_jsonb(old)->>'invoice_id') end;
  insert into public.homecare_financial_audit(tenant_id,entity_type,entity_id,invoice_id,operation,before_data,after_data,actor_user_id)
  values(tenant,entity,entity_id,invoice,tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,auth.uid());
  return coalesce(new,old);
end $$;

create or replace function public.homecare_protect_issued_invoice() returns trigger language plpgsql set search_path=public as $$
begin
  if old.invoice_status in('gebucht','gesendet','bezahlt','storniert') and (
    new.invoice_number is distinct from old.invoice_number or new.customer_id is distinct from old.customer_id or new.job_id is distinct from old.job_id or
    new.object_id is distinct from old.object_id or new.report_id is distinct from old.report_id or new.invoice_date is distinct from old.invoice_date or
    new.amount is distinct from old.amount or new.currency is distinct from old.currency or new.deleted_at is distinct from old.deleted_at
  ) then raise exception 'Ausgestellte Rechnungen sind unveränderlich; verwenden Sie eine Korrektur oder Stornierung.' using errcode='23514'; end if;
  if old.invoice_status in('gesendet','bezahlt','storniert') and new.invoice_status not in(old.invoice_status,'bezahlt','storniert') then
    raise exception 'Ungültiger rückwärts gerichteter Rechnungsstatus.' using errcode='23514';
  end if;
  return new;
end $$;

create or replace function public.homecare_protect_invoice_line() returns trigger language plpgsql set search_path=public as $$
declare invoice_status text; begin
  select i.invoice_status into invoice_status from public.homecare_billing_items i where i.tenant_id=coalesce(new.tenant_id,old.tenant_id) and i.id=coalesce(new.invoice_id,old.invoice_id);
  if coalesce(invoice_status,'entwurf')<>'entwurf' then raise exception 'Positionen ausgestellter Rechnungen sind unveränderlich.' using errcode='23514'; end if;
  return coalesce(new,old);
end $$;

create or replace function public.homecare_prevent_financial_hard_delete() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Finanzdaten dürfen nicht hart gelöscht werden.' using errcode='23514'; end $$;

drop trigger if exists protect_issued_invoice on public.homecare_billing_items;
create trigger protect_issued_invoice before update on public.homecare_billing_items for each row execute function public.homecare_protect_issued_invoice();
drop trigger if exists protect_invoice_line on public.homecare_invoice_lines;
create trigger protect_invoice_line before insert or update or delete on public.homecare_invoice_lines for each row execute function public.homecare_protect_invoice_line();
create or replace function public.homecare_bump_financial_revision() returns trigger language plpgsql set search_path=public as $$
begin
  if coalesce(current_setting('workcore.skip_financial_revision',true),'0')<>'1' and new.revision=old.revision then new.revision:=old.revision+1; end if;
  return new;
end $$;
drop trigger if exists bump_revision on public.homecare_billing_items;
create trigger bump_revision before update on public.homecare_billing_items for each row execute function public.homecare_bump_financial_revision();

do $$ declare table_name text; begin
  foreach table_name in array array['homecare_invoice_lines','homecare_payments','homecare_accounting_exports'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_homecare_updated_at()',table_name);
    execute format('drop trigger if exists bump_revision on public.%I',table_name);
    execute format('create trigger bump_revision before update on public.%I for each row execute function public.homecare_bump_revision()',table_name);
  end loop;
  foreach table_name in array array['homecare_billing_items','homecare_invoice_lines','homecare_payments','homecare_accounting_exports'] loop
    execute format('drop trigger if exists financial_audit on public.%I',table_name);
    execute format('create trigger financial_audit after insert or update or delete on public.%I for each row execute function public.homecare_financial_audit_trigger()',table_name);
    execute format('drop trigger if exists prevent_financial_hard_delete on public.%I',table_name);
    execute format('create trigger prevent_financial_hard_delete before delete on public.%I for each row execute function public.homecare_prevent_financial_hard_delete()',table_name);
  end loop;
end $$;

create or replace function public.homecare_allocate_invoice_number(p_tenant uuid,p_requested text,p_date date) returns text language plpgsql security definer set search_path=public as $$
declare year_text text:=extract(year from coalesce(p_date,current_date))::integer::text; candidate text; next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant::text||':invoice:'||year_text));
  if nullif(p_requested,'') is not null and not exists(select 1 from public.homecare_billing_items where tenant_id=p_tenant and invoice_number=p_requested and deleted_at is null) then return p_requested; end if;
  select coalesce(max(case when invoice_number~('^INV-'||year_text||'-[0-9]+$') then split_part(invoice_number,'-',3)::integer end),0)+1 into next_number from public.homecare_billing_items where tenant_id=p_tenant;
  loop candidate:='INV-'||year_text||'-'||next_number; exit when not exists(select 1 from public.homecare_billing_items where tenant_id=p_tenant and invoice_number=candidate and deleted_at is null); next_number:=next_number+1; end loop;
  return candidate;
end $$;

create or replace function public.homecare_apply_financial_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.homecare_sync_mutations%rowtype; invoice public.homecare_billing_items%rowtype; line public.homecare_invoice_lines%rowtype; payment public.homecare_payments%rowtype; export public.homecare_accounting_exports%rowtype; response jsonb; tenant uuid:=p_tenant_id;
begin
  if tenant is null or p_entity_type not in('invoice','invoice_line','payment','accounting_export') or p_operation not in('create','update','delete','restore') then raise exception 'Ungültige Finanzmutation.' using errcode='22023'; end if;
  if auth.role()='authenticated' and (public.homecare_request_tenant() is distinct from tenant or not public.homecare_has_permission(tenant,'invoices.manage')) then
    raise exception 'WORKCORE_FINANCIAL_PERMISSION_DENIED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(tenant::text||':'||p_mutation_id::text));
  select * into prior from public.homecare_sync_mutations where tenant_id=tenant and mutation_id=p_mutation_id;
  if found and prior.status in('synced','conflict') then return prior.response_payload; end if;
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload)
  values(p_mutation_id,tenant,p_entity_type,p_entity_id,p_operation,'syncing',p_expected_revision,p_payload) on conflict(tenant_id,mutation_id) do update set status='syncing',updated_at=now();

  if p_entity_type='invoice' then
    select * into invoice from public.homecare_billing_items where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' and not found then
      insert into public.homecare_billing_items(id,tenant_id,object_id,customer_id,job_id,report_id,source,label,amount,status,invoice_status,invoice_number,invoice_date,due_date,service_date,notes,sent_at,cancelled_at,outgoing_book_number,invoiced_at,record_data,revision)
      values(p_entity_id,tenant,nullif(p_payload->>'objectId',''),nullif(p_payload->>'customerId',''),nullif(p_payload->>'jobId',''),nullif(p_payload->>'reportId',''),nullif(p_payload->>'source',''),coalesce(nullif(p_payload->>'label',''),'Abrechnung'),public.homecare_text_to_numeric(p_payload->>'amount'),coalesce(nullif(p_payload->>'status',''),'abrechenbar'),coalesce(nullif(p_payload->>'invoiceStatus',''),'entwurf'),public.homecare_allocate_invoice_number(tenant,p_payload->>'invoiceNumber',public.homecare_text_to_date(p_payload->>'invoiceDate')),public.homecare_text_to_date(p_payload->>'invoiceDate'),public.homecare_text_to_date(p_payload->>'dueDate'),public.homecare_text_to_date(p_payload->>'serviceDate'),nullif(p_payload->>'notes',''),nullif(p_payload->>'sentAt','')::timestamptz,nullif(p_payload->>'cancelledAt','')::timestamptz,nullif(p_payload->>'outgoingBookNumber',''),nullif(p_payload->>'invoicedAt','')::timestamptz,p_payload,1) returning * into invoice;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Rechnung existiert nicht mehr.');
    elsif p_expected_revision is not null and invoice.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(invoice),'error','Die Rechnung wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then
      if coalesce(invoice.invoice_status,'entwurf')<>'entwurf' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(invoice),'error','Nur Entwürfe können gelöscht werden.');
      else update public.homecare_billing_items set deleted_at=now() where tenant_id=tenant and id=p_entity_id returning * into invoice; update public.homecare_invoice_lines set deleted_at=now() where tenant_id=tenant and invoice_id=p_entity_id and deleted_at is null; end if;
    elsif p_operation='restore' then update public.homecare_billing_items set deleted_at=null where tenant_id=tenant and id=p_entity_id returning * into invoice;
    else
      update public.homecare_billing_items i set record_data=i.record_data||p_payload,
        object_id=case when p_payload?'objectId' then nullif(p_payload->>'objectId','') else i.object_id end,customer_id=case when p_payload?'customerId' then nullif(p_payload->>'customerId','') else i.customer_id end,
        job_id=case when p_payload?'jobId' then nullif(p_payload->>'jobId','') else i.job_id end,report_id=case when p_payload?'reportId' then nullif(p_payload->>'reportId','') else i.report_id end,
        source=case when p_payload?'source' then nullif(p_payload->>'source','') else i.source end,label=coalesce(nullif(p_payload->>'label',''),i.label),amount=case when p_payload?'amount' then public.homecare_text_to_numeric(p_payload->>'amount') else i.amount end,
        status=coalesce(nullif(p_payload->>'status',''),i.status),invoice_status=coalesce(nullif(p_payload->>'invoiceStatus',''),i.invoice_status),
        invoice_number=case when p_payload?'invoiceNumber' then coalesce(nullif(p_payload->>'invoiceNumber',''),i.invoice_number) else i.invoice_number end,
        invoice_date=case when p_payload?'invoiceDate' then public.homecare_text_to_date(p_payload->>'invoiceDate') else i.invoice_date end,due_date=case when p_payload?'dueDate' then public.homecare_text_to_date(p_payload->>'dueDate') else i.due_date end,
        service_date=case when p_payload?'serviceDate' then public.homecare_text_to_date(p_payload->>'serviceDate') else i.service_date end,notes=case when p_payload?'notes' then p_payload->>'notes' else i.notes end,
        sent_at=case when p_payload?'sentAt' then nullif(p_payload->>'sentAt','')::timestamptz else i.sent_at end,cancelled_at=case when p_payload?'cancelledAt' then nullif(p_payload->>'cancelledAt','')::timestamptz else i.cancelled_at end,
        outgoing_book_number=case when p_payload?'outgoingBookNumber' then nullif(p_payload->>'outgoingBookNumber','') else i.outgoing_book_number end,invoiced_at=case when p_payload?'invoicedAt' then nullif(p_payload->>'invoicedAt','')::timestamptz else i.invoiced_at end,deleted_at=null
      where tenant_id=tenant and id=p_entity_id returning * into invoice;
    end if;
    if response is null then response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(invoice)); end if;
  elsif p_entity_type='invoice_line' then
    select * into line from public.homecare_invoice_lines where tenant_id=tenant and id=p_entity_id for update;
    if p_operation='create' and not found then insert into public.homecare_invoice_lines(id,tenant_id,invoice_id,accounting_account,kind,name,quantity,unit,unit_price,currency,tax_rate,discount_type,discount_value,position,record_data) values(p_entity_id,tenant,p_resource_id,nullif(p_payload->>'accountingAccount',''),nullif(p_payload->>'kind',''),coalesce(nullif(p_payload->>'name',''),'Position'),coalesce(public.homecare_text_to_numeric(p_payload->>'quantity'),0),nullif(p_payload->>'unit',''),coalesce(public.homecare_text_to_numeric(p_payload->>'unitPrice'),0),coalesce(nullif(p_payload->>'currency',''),'SEK'),coalesce(public.homecare_text_to_numeric(p_payload->>'taxRate'),0),nullif(p_payload->>'discountType',''),public.homecare_text_to_numeric(p_payload->>'discountValue'),coalesce((p_payload->>'position')::integer,0),p_payload) returning * into line;
    elsif not found then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Rechnungsposition existiert nicht mehr.');
    elsif p_expected_revision is not null and line.revision<>p_expected_revision then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(line),'error','Die Rechnungsposition wurde auf einem anderen Gerät geändert.');
    elsif p_operation='delete' then update public.homecare_invoice_lines set deleted_at=now() where tenant_id=tenant and id=p_entity_id returning * into line;
    else update public.homecare_invoice_lines l set accounting_account=coalesce(nullif(p_payload->>'accountingAccount',''),l.accounting_account),kind=coalesce(nullif(p_payload->>'kind',''),l.kind),name=coalesce(nullif(p_payload->>'name',''),l.name),quantity=coalesce(public.homecare_text_to_numeric(p_payload->>'quantity'),l.quantity),unit=coalesce(nullif(p_payload->>'unit',''),l.unit),unit_price=coalesce(public.homecare_text_to_numeric(p_payload->>'unitPrice'),l.unit_price),tax_rate=coalesce(public.homecare_text_to_numeric(p_payload->>'taxRate'),l.tax_rate),discount_type=case when p_payload?'discountType' then nullif(p_payload->>'discountType','') else l.discount_type end,discount_value=case when p_payload?'discountValue' then public.homecare_text_to_numeric(p_payload->>'discountValue') else l.discount_value end,record_data=l.record_data||p_payload,deleted_at=null where tenant_id=tenant and id=p_entity_id returning * into line; end if;
    if response is null then perform public.homecare_refresh_invoice_totals(tenant,p_resource_id); response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(line)); end if;
  elsif p_entity_type='payment' then
    select * into payment from public.homecare_payments where tenant_id=tenant and id=p_entity_id for update;
    if found then response:=case when p_operation='create' then jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(payment)) else jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(payment),'error','Zahlungen sind unveränderlich; verwenden Sie eine Gegenbuchung.') end;
    elsif p_operation<>'create' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Zahlung existiert nicht.');
    else insert into public.homecare_payments(id,tenant_id,invoice_id,amount,currency,paid_at,record_data) values(p_entity_id,tenant,p_resource_id,coalesce(public.homecare_text_to_numeric(p_payload->>'amount'),0),coalesce(nullif(p_payload->>'currency',''),'SEK'),coalesce(nullif(p_payload->>'paidAt','')::timestamptz,now()),p_payload) returning * into payment; update public.homecare_billing_items set invoice_status='bezahlt',paid_at=payment.paid_at where tenant_id=tenant and id=p_resource_id; response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(payment)); end if;
  else
    select * into export from public.homecare_accounting_exports where tenant_id=tenant and id=p_entity_id for update;
    if found then response:=case when p_operation='create' then jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(export)) else jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(export),'error','Exportereignisse sind unveränderlich.') end;
    elsif p_operation<>'create' then response:=jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Das Exportereignis existiert nicht.');
    else insert into public.homecare_accounting_exports(id,tenant_id,invoice_id,system,status,exported_at,payload) values(p_entity_id,tenant,p_resource_id,coalesce(nullif(p_payload->>'system',''),'Spiris / Visma Buchhaltung'),coalesce(nullif(p_payload->>'status',''),'gesendet'),coalesce(nullif(p_payload->>'exportedAt','')::timestamptz,now()),p_payload) returning * into export; update public.homecare_billing_items set external_export_status=export.status,external_export_system=export.system,external_exported_at=export.exported_at where tenant_id=tenant and id=p_resource_id; response:=jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(export)); end if;
  end if;
  update public.homecare_sync_mutations set status=response->>'status',response_payload=response,error=response->>'error',applied_at=case when response->>'status'='synced' then now() else applied_at end,updated_at=now() where tenant_id=tenant and mutation_id=p_mutation_id;
  return response;
end $$;

alter table public.homecare_invoice_lines enable row level security;
alter table public.homecare_payments enable row level security;
alter table public.homecare_accounting_exports enable row level security;
alter table public.homecare_financial_audit enable row level security;
do $$ declare table_name text; begin
  foreach table_name in array array['homecare_invoice_lines','homecare_payments','homecare_accounting_exports','homecare_financial_audit'] loop
    execute format('drop policy if exists tenant_member_read on public.%I',table_name);
    execute format('create policy tenant_member_read on public.%I for select to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',table_name);
    if table_name<>'homecare_financial_audit' then
      execute format('drop policy if exists tenant_member_insert on public.%I',table_name); execute format('create policy tenant_member_insert on public.%I for insert to authenticated with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''invoices.manage''))',table_name);
      execute format('drop policy if exists tenant_member_update on public.%I',table_name); execute format('create policy tenant_member_update on public.%I for update to authenticated using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''invoices.manage'')) with check (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''invoices.manage''))',table_name);
    end if;
    execute format('revoke all on table public.%I from public,anon',table_name); execute format('grant select on table public.%I to authenticated',table_name); execute format('grant all on table public.%I to service_role',table_name);
  end loop;
end $$;
revoke all on function public.homecare_apply_financial_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon;
grant execute on function public.homecare_apply_financial_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to authenticated,service_role;
revoke all on function public.homecare_allocate_invoice_number(uuid,text,date) from public,anon,authenticated;
revoke all on function public.homecare_refresh_invoice_totals(uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_allocate_invoice_number(uuid,text,date) to service_role;
grant execute on function public.homecare_refresh_invoice_totals(uuid,text) to service_role;

-- Reconciliation is deliberately fatal. A mismatch rolls back the entire migration.
do $$ declare mismatch integer; begin
  select count(*) into mismatch from wave4_financial_source source left join public.homecare_billing_items invoice on invoice.tenant_id=source.tenant_id and invoice.id=source.item->>'id' where invoice.id is null;
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % invoice records unmatched.',mismatch; end if;
  select count(*) into mismatch from wave4_financial_source source join public.homecare_billing_items invoice on invoice.tenant_id=source.tenant_id and invoice.id=source.item->>'id' where coalesce(invoice.invoice_number,'')<>coalesce(source.item->>'invoiceNumber','');
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % invoice numbers differ.',mismatch; end if;
  select count(*) into mismatch from public.homecare_billing_items invoice where (select count(*) from public.homecare_invoice_lines line where line.tenant_id=invoice.tenant_id and line.invoice_id=invoice.id)<>jsonb_array_length(case when jsonb_typeof(invoice.lines)='array' then invoice.lines else '[]' end);
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % invoice line counts differ.',mismatch; end if;
  select count(*) into mismatch from public.homecare_billing_items invoice where invoice.paid_at is not null and not exists(select 1 from public.homecare_payments payment where payment.tenant_id=invoice.tenant_id and payment.invoice_id=invoice.id and payment.amount=coalesce(invoice.amount,0));
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % payment totals differ.',mismatch; end if;
  select count(*) into mismatch from public.homecare_billing_items invoice where invoice.external_exported_at is not null and not exists(select 1 from public.homecare_accounting_exports export where export.tenant_id=invoice.tenant_id and export.invoice_id=invoice.id);
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % accounting exports are unmatched.',mismatch; end if;
  select count(*) into mismatch from public.homecare_billing_items invoice where (invoice.customer_id is not null and not exists(select 1 from public.homecare_customers c where c.tenant_id=invoice.tenant_id and c.id=invoice.customer_id)) or (invoice.job_id is not null and not exists(select 1 from public.homecare_jobs j where j.tenant_id=invoice.tenant_id and j.id=invoice.job_id)) or (invoice.report_id is not null and not exists(select 1 from public.homecare_reports r where r.tenant_id=invoice.tenant_id and r.id=invoice.report_id));
  if mismatch>0 then raise exception 'Wave 4 reconciliation failed: % financial relationships are unmatched.',mismatch; end if;
  if exists(select 1 from public.homecare_billing_items where invoice_number is not null and deleted_at is null group by tenant_id,invoice_number having count(*)>1) then raise exception 'Wave 4 reconciliation failed: duplicate invoice numbers.'; end if;
  if exists(select 1 from public.homecare_billing_items invoice where invoice.gross_total<>(select coalesce(sum(public.homecare_line_net(quantity,unit_price,discount_type,discount_value)+round(public.homecare_line_net(quantity,unit_price,discount_type,discount_value)*tax_rate/100,2)),0) from public.homecare_invoice_lines line where line.tenant_id=invoice.tenant_id and line.invoice_id=invoice.id and line.deleted_at is null)) then raise exception 'Wave 4 reconciliation failed: invoice totals differ.'; end if;
end $$;

comment on function public.homecare_apply_financial_mutation is 'Wave 4 authoritative record-level financial mutation endpoint with idempotency and revision conflicts.';

commit;
