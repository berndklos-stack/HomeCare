begin;
alter table public.homecare_stock_movements
  add column if not exists billing_data jsonb,
  add column if not exists billing_source_id uuid;
create index if not exists stock_job_billing_idx on public.homecare_stock_movements(tenant_id,job_id,occurred_at) where billing_data is not null;

create or replace function public.homecare_stock_job_billing() returns trigger
language plpgsql security definer set search_path=public as $$
declare job public.homecare_jobs%rowtype; material public.homecare_materials%rowtype;
  original public.homecare_stock_movements%rowtype; original_id text; returned numeric;
begin
  if current_setting('workcore.operations_restore',true)='1' then return new; end if;
  -- Purchase receipts and maintenance have their own allocation semantics.
  if new.receipt_id is not null or new.maintenance_event_id is not null or new.legacy_entry_id is not null then return new; end if;
  if new.project_id is not null then raise exception 'OBJECT_NOT_BOOKABLE' using errcode='23514'; end if;
  if new.job_id is null then return new; end if;
  select * into job from public.homecare_jobs where tenant_id=new.tenant_id and id=new.job_id for update;
  if not found or job.deleted_at is not null or job.status not in('geplant','in Arbeit','pausiert') then
    raise exception 'JOB_NOT_OPEN' using errcode='23514';
  end if;
  if job.billable is false then raise exception 'JOB_NOT_BILLABLE' using errcode='23514'; end if;
  if new.source_id is not null and new.destination_id is not null then raise exception 'JOB_REQUIRES_STOCK_OUT' using errcode='23514'; end if;
  if new.source_id is not null then
    select * into material from public.homecare_materials where tenant_id=new.tenant_id and id=new.material_id;
    new.billing_data:=jsonb_build_object('materialId',material.id,'name',material.name,'category',coalesce(material.category,'Material'),
      'unit',coalesce(material.unit,''),'price',coalesce(material.record_data->>'price',material.sales_price::text,'0'),
      'currency',coalesce(material.currency,'SEK'),'taxRate',coalesce(material.record_data->>'taxRate',material.tax_rate::text,'25'),
      'accountingAccount',coalesce(material.accounting_account,'3058'));
  else
    -- Returns must reference an original consumption and retain its sales snapshot.
    original_id:=substring(new.note from '\[([0-9a-fA-F-]{36})\]');
    if original_id is null then raise exception 'JOB_RETURN_REQUIRES_ORIGINAL' using errcode='23514'; end if;
    select * into original from public.homecare_stock_movements where tenant_id=new.tenant_id and id=original_id::uuid
      and material_id=new.material_id and job_id=new.job_id and source_id=new.destination_id and destination_id is null and billing_data is not null for update;
    if not found then raise exception 'JOB_RETURN_REQUIRES_ORIGINAL' using errcode='23514'; end if;
    select coalesce(sum(quantity),0) into returned from public.homecare_stock_movements where tenant_id=new.tenant_id and billing_source_id=original.id;
    if returned+new.quantity>original.quantity then raise exception 'JOB_RETURN_EXCEEDS_CONSUMPTION' using errcode='23514'; end if;
    new.billing_source_id:=original.id; new.billing_data:=original.billing_data;
  end if;
  return new;
end $$;
revoke all on function public.homecare_stock_job_billing() from public,anon,authenticated;
drop trigger if exists stock_job_billing on public.homecare_stock_movements;
create trigger stock_job_billing before insert on public.homecare_stock_movements for each row execute function public.homecare_stock_job_billing();
commit;
