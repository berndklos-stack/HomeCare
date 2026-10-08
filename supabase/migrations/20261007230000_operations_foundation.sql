-- Additive operations foundation. No legacy stock import or UI cutover here.
begin;

create table if not exists public.homecare_suppliers (
  tenant_id uuid not null references public.homecare_tenants(id),
  id uuid not null default gen_random_uuid(),
  supplier_number text not null,
  company text not null check (length(trim(company)) > 0),
  email text, phone text, address text, vat_number text, payment_terms text, notes text,
  archived boolean not null default false,
  revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (tenant_id,id), unique (tenant_id,supplier_number)
);
create table if not exists public.homecare_supplier_contacts (
  tenant_id uuid not null, id uuid not null default gen_random_uuid(), supplier_id uuid not null,
  name text not null, email text, phone text, role text,
  revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (tenant_id,id),
  foreign key (tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id)
);

alter table public.homecare_materials
  add column if not exists preferred_supplier_id uuid,
  add column if not exists reorder_quantity numeric(14,3),
  add column if not exists notes text;
alter table public.homecare_inventory_locations
  add column if not exists location_kind text not null default 'warehouse',
  add column if not exists resource_id text,
  add column if not exists project_id text;
alter table public.homecare_resources
  add column if not exists equipment_kind text,
  add column if not exists availability text,
  add column if not exists purchase_date date,
  add column if not exists purchase_price numeric(14,2),
  add column if not exists warranty_until date,
  add column if not exists warranty_notes text,
  add column if not exists operating_hours numeric(14,1);

-- New constraints refer only to new nullable fields; existing records remain intact.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_materials'::regclass and conname='material_preferred_supplier_fk') then
    alter table public.homecare_materials add constraint material_preferred_supplier_fk foreign key(tenant_id,preferred_supplier_id) references public.homecare_suppliers(tenant_id,id);
    alter table public.homecare_materials add constraint material_reorder_quantity_ck check(reorder_quantity is null or reorder_quantity >= 0);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_inventory_locations'::regclass and conname='inventory_location_resource_fk') then
    alter table public.homecare_inventory_locations add constraint inventory_location_resource_fk foreign key(tenant_id,resource_id) references public.homecare_resources(tenant_id,id);
    alter table public.homecare_inventory_locations add constraint inventory_location_project_fk foreign key(tenant_id,project_id) references public.homecare_objects(tenant_id,id);
    alter table public.homecare_inventory_locations add constraint inventory_location_kind_ck check(location_kind in('warehouse','vehicle','project','other'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_resources'::regclass and conname='resource_equipment_kind_ck') then
    alter table public.homecare_resources add constraint resource_equipment_kind_ck check(equipment_kind is null or equipment_kind in('vehicle','machine','tool','equipment','trailer','other'));
    alter table public.homecare_resources add constraint resource_availability_ck check(availability is null or availability in('available','in_use','maintenance','repair','unavailable','archived'));
    alter table public.homecare_resources add constraint resource_hours_ck check(operating_hours is null or operating_hours >= 0);
  end if;
end $$;

create table if not exists public.homecare_purchase_orders (
  tenant_id uuid not null references public.homecare_tenants(id), id uuid not null default gen_random_uuid(),
  order_number text not null, supplier_id uuid not null,
  status text not null default 'draft' check(status in('draft','ordered','partially_received','received','cancelled')),
  order_date date not null default current_date, expected_delivery date,
  location_id text not null, job_id text, project_id text, resource_id text, currency text not null default 'SEK', notes text,
  revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(tenant_id,id), unique(tenant_id,order_number),
  foreign key(tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id),
  foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id),
  foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id),
  foreign key(tenant_id,project_id) references public.homecare_objects(tenant_id,id),
  foreign key(tenant_id,resource_id) references public.homecare_resources(tenant_id,id)
);
create table if not exists public.homecare_purchase_order_items (
  tenant_id uuid not null, id uuid not null default gen_random_uuid(), order_id uuid not null, material_id text not null,
  quantity numeric(14,3) not null check(quantity > 0), unit_price numeric(14,4) not null check(unit_price >= 0),
  revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,order_id) references public.homecare_purchase_orders(tenant_id,id),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id)
);
create table if not exists public.homecare_purchase_receipts (
  tenant_id uuid not null, id uuid not null, item_id uuid not null,
  quantity numeric(14,3) not null check(quantity > 0), actor_user_id uuid not null,
  note text not null, occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key(tenant_id,id),
  foreign key(tenant_id,item_id) references public.homecare_purchase_order_items(tenant_id,id)
);
create table if not exists public.homecare_resource_assignments (
  tenant_id uuid not null, id uuid not null default gen_random_uuid(), resource_id text not null,
  employee_id text, job_id text, project_id text, location_id text,
  starts_at timestamptz not null default now(), ends_at timestamptz,
  notes text, revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(tenant_id,id), check(ends_at is null or ends_at >= starts_at),
  check(employee_id is not null or job_id is not null or project_id is not null or location_id is not null),
  foreign key(tenant_id,resource_id) references public.homecare_resources(tenant_id,id),
  foreign key(tenant_id,employee_id) references public.homecare_personnel(tenant_id,id),
  foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id),
  foreign key(tenant_id,project_id) references public.homecare_objects(tenant_id,id),
  foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id)
);
create unique index if not exists resource_assignment_active_idx on public.homecare_resource_assignments(tenant_id,resource_id)
  where ends_at is null and deleted_at is null;

create table if not exists public.homecare_maintenance_plans (
  tenant_id uuid not null, id uuid not null default gen_random_uuid(), resource_id text not null,
  name text not null check(length(trim(name)) > 0), maintenance_type text not null,
  due_date date, due_mileage numeric(14,1), due_hours numeric(14,1),
  interval_days integer, interval_mileage numeric(14,1), interval_hours numeric(14,1),
  responsible_person_id text, supplier_id uuid, notes text, completed boolean not null default false,
  revision bigint not null default 1,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(tenant_id,id),
  check(due_date is not null or due_mileage is not null or due_hours is not null),
  check(due_mileage is null or due_mileage >= 0), check(due_hours is null or due_hours >= 0),
  check(interval_days is null or interval_days > 0), check(interval_mileage is null or interval_mileage > 0), check(interval_hours is null or interval_hours > 0),
  check(interval_mileage is null or due_mileage is not null), check(interval_hours is null or due_hours is not null),
  foreign key(tenant_id,resource_id) references public.homecare_resources(tenant_id,id),
  foreign key(tenant_id,responsible_person_id) references public.homecare_personnel(tenant_id,id),
  foreign key(tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id)
);
create table if not exists public.homecare_maintenance_events (
  tenant_id uuid not null, id uuid not null, plan_id uuid not null,
  completed_date date not null, mileage numeric(14,1), operating_hours numeric(14,1),
  cost numeric(14,2) not null default 0 check(cost >= 0), currency text not null default 'SEK',
  supplier_id uuid, document_id text, notes text, actor_user_id uuid not null,
  plan_revision bigint not null,
  created_at timestamptz not null default now(),
  primary key(tenant_id,id), unique(tenant_id,plan_id,plan_revision),
  check(mileage is null or mileage >= 0), check(operating_hours is null or operating_hours >= 0),
  foreign key(tenant_id,plan_id) references public.homecare_maintenance_plans(tenant_id,id),
  foreign key(tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id),
  foreign key(tenant_id,document_id) references public.homecare_media(tenant_id,id)
);

-- Append-only journal is separate from mutable legacy inventory entries until cutover.
create table if not exists public.homecare_stock_movements (
  tenant_id uuid not null, id uuid not null, material_id text not null,
  source_id text, destination_id text, quantity numeric(14,3) not null check(quantity > 0),
  job_id text, project_id text, receipt_id uuid, maintenance_event_id uuid,
  unit_price numeric(14,4), note text not null check(length(trim(note)) > 0), actor_user_id uuid not null,
  occurred_at timestamptz not null default now(), created_at timestamptz not null default now(),
  primary key(tenant_id,id), unique(tenant_id,receipt_id),
  check(source_id is distinct from destination_id), check(source_id is not null or destination_id is not null),
  check(unit_price is null or unit_price >= 0),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id),
  foreign key(tenant_id,source_id) references public.homecare_inventory_locations(tenant_id,id),
  foreign key(tenant_id,destination_id) references public.homecare_inventory_locations(tenant_id,id),
  foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id),
  foreign key(tenant_id,project_id) references public.homecare_objects(tenant_id,id),
  foreign key(tenant_id,receipt_id) references public.homecare_purchase_receipts(tenant_id,id),
  foreign key(tenant_id,maintenance_event_id) references public.homecare_maintenance_events(tenant_id,id)
);
create index if not exists stock_movement_material_idx on public.homecare_stock_movements(tenant_id,material_id,occurred_at);
create index if not exists maintenance_due_date_idx on public.homecare_maintenance_plans(tenant_id,due_date) where deleted_at is null and not completed;
create index if not exists purchase_items_order_idx on public.homecare_purchase_order_items(tenant_id,order_id);

create or replace function public.homecare_purchase_item_guard()
returns trigger language plpgsql set search_path=public as $$
declare tenant uuid; purchase_id uuid; current_status text;
begin
  if tg_op='DELETE' then tenant:=old.tenant_id; purchase_id:=old.order_id;
  else tenant:=new.tenant_id; purchase_id:=new.order_id; end if;
  if tg_op='UPDATE' and (new.tenant_id,new.id,new.order_id) is distinct from (old.tenant_id,old.id,old.order_id) then
    raise exception 'PURCHASE_ITEM_IDENTITY_IMMUTABLE' using errcode='23514';
  end if;
  select status into current_status from public.homecare_purchase_orders where tenant_id=tenant and id=purchase_id for update;
  if current_status is distinct from 'draft' then raise exception 'ORDERED_ITEMS_IMMUTABLE' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists purchase_item_guard on public.homecare_purchase_order_items;
create trigger purchase_item_guard before insert or update or delete on public.homecare_purchase_order_items
  for each row execute function public.homecare_purchase_item_guard();

-- PostgreSQL numeric considers NaN greater than ordinary numbers; reject it explicitly.
do $$ declare tbl text; col text; constraint_name text; begin
  for tbl,col in select table_name,column_name from information_schema.columns
    where table_schema='public' and data_type='numeric'
      and table_name in('homecare_purchase_order_items','homecare_purchase_receipts','homecare_maintenance_plans','homecare_maintenance_events','homecare_stock_movements') loop
    constraint_name:=tbl||'_'||col||'_finite_ck';
    if not exists(select 1 from pg_constraint where conrelid=('public.'||tbl)::regclass and conname=constraint_name) then
      execute format('alter table public.%I add constraint %I check(%I::text not in(''NaN'',''Infinity'',''-Infinity''))',tbl,constraint_name,col);
    end if;
  end loop;
end $$;

create or replace function public.homecare_operations_immutable()
returns trigger language plpgsql set search_path=public as $$ begin
  raise exception 'OPERATIONS_HISTORY_IMMUTABLE' using errcode='23514';
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array['homecare_suppliers','homecare_supplier_contacts','homecare_purchase_orders','homecare_purchase_order_items','homecare_resource_assignments','homecare_maintenance_plans','homecare_purchase_receipts','homecare_maintenance_events','homecare_stock_movements'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant select,insert,update,delete on public.%I to service_role',tbl);
    execute format('drop policy if exists operations_tenant_read on public.%I',tbl);
    execute format('create policy operations_tenant_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
    if tbl in('homecare_purchase_receipts','homecare_maintenance_events','homecare_stock_movements') then
      execute format('drop trigger if exists operations_immutable on public.%I',tbl);
      execute format('create trigger operations_immutable before update or delete on public.%I for each row execute function public.homecare_operations_immutable()',tbl);
    else
      execute format('drop trigger if exists bump_revision on public.%I',tbl);
      execute format('create trigger bump_revision before update on public.%I for each row execute function public.homecare_bump_revision()',tbl);
    end if;
  end loop;
end $$;

create or replace function public.homecare_stock_post(
  p_tenant uuid,p_id uuid,p_material text,p_source text,p_destination text,p_quantity numeric,
  p_actor uuid,p_note text,p_job text default null,p_project text default null,
  p_receipt uuid default null,p_maintenance uuid default null,p_unit_price numeric default null
) returns public.homecare_stock_movements language plpgsql security definer set search_path=public as $$
declare existing public.homecare_stock_movements%rowtype; balance numeric; result public.homecare_stock_movements%rowtype;
begin
  if p_tenant is null or p_id is null or p_actor is null or p_quantity is null or p_quantity <= 0
    or p_quantity::text in('NaN','Infinity','-Infinity') or p_quantity <> round(p_quantity,3)
    or p_source is not distinct from p_destination or nullif(trim(p_note),'') is null then
    raise exception 'INVALID_STOCK_MOVEMENT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_id::text,0));
  select * into existing from public.homecare_stock_movements where tenant_id=p_tenant and id=p_id;
  if found then
    if (existing.material_id,existing.source_id,existing.destination_id,existing.quantity,existing.actor_user_id,existing.note,existing.job_id,existing.project_id,existing.receipt_id,existing.maintenance_event_id,existing.unit_price)
      is distinct from (p_material,p_source,p_destination,p_quantity,p_actor,p_note,p_job,p_project,p_receipt,p_maintenance,p_unit_price) then
      raise exception 'MOVEMENT_ID_REUSED' using errcode='23514';
    end if;
    return existing;
  end if;
  -- Serialize all writers for this material, including transfers between locations.
  perform 1 from public.homecare_materials where tenant_id=p_tenant and id=p_material and deleted_at is null and not archived for update;
  if not found then raise exception 'MATERIAL_NOT_ACTIVE' using errcode='23514'; end if;
  if exists(select 1 from public.homecare_inventory_locations where tenant_id=p_tenant and id in(p_source,p_destination) and (deleted_at is not null or archived)) then
    raise exception 'LOCATION_NOT_ACTIVE' using errcode='23514';
  end if;
  if p_source is not null then
    select coalesce(sum(case when destination_id=p_source then quantity else 0 end)-sum(case when source_id=p_source then quantity else 0 end),0)
      into balance from public.homecare_stock_movements where tenant_id=p_tenant and material_id=p_material;
    if balance < p_quantity then raise exception 'INSUFFICIENT_STOCK' using errcode='23514'; end if;
  end if;
  insert into public.homecare_stock_movements(tenant_id,id,material_id,source_id,destination_id,quantity,actor_user_id,note,job_id,project_id,receipt_id,maintenance_event_id,unit_price)
    values(p_tenant,p_id,p_material,p_source,p_destination,p_quantity,p_actor,p_note,p_job,p_project,p_receipt,p_maintenance,p_unit_price) returning * into result;
  return result;
end $$;

create or replace function public.homecare_purchase_receive(
  p_tenant uuid,p_id uuid,p_item uuid,p_quantity numeric,p_expected_revision bigint,p_actor uuid,p_note text
) returns public.homecare_purchase_receipts language plpgsql security definer set search_path=public as $$
declare receipt public.homecare_purchase_receipts%rowtype; item public.homecare_purchase_order_items%rowtype;
  purchase public.homecare_purchase_orders%rowtype; received numeric; finished boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_id::text,0));
  select * into receipt from public.homecare_purchase_receipts where tenant_id=p_tenant and id=p_id;
  if found then
    if (receipt.item_id,receipt.quantity,receipt.actor_user_id,receipt.note) is distinct from (p_item,p_quantity,p_actor,p_note) then
      raise exception 'RECEIPT_ID_REUSED' using errcode='23514';
    end if;
    return receipt;
  end if;
  select * into item from public.homecare_purchase_order_items where tenant_id=p_tenant and id=p_item and deleted_at is null;
  if not found then raise exception 'PURCHASE_ITEM_NOT_FOUND' using errcode='23514'; end if;
  select * into purchase from public.homecare_purchase_orders where tenant_id=p_tenant and id=item.order_id and deleted_at is null for update;
  if not found or purchase.status not in('ordered','partially_received') then raise exception 'PURCHASE_NOT_RECEIVABLE' using errcode='23514'; end if;
  select * into item from public.homecare_purchase_order_items where tenant_id=p_tenant and id=p_item and deleted_at is null for update;
  if p_expected_revision is null or purchase.revision <> p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  if exists(select 1 from public.homecare_materials where tenant_id=p_tenant and id=item.material_id
    and coalesce(nullif(record_data->>'currency',''),currency,'SEK')<>purchase.currency) then
    raise exception 'PURCHASE_CURRENCY_MISMATCH' using errcode='23514'; end if;
  select coalesce(sum(quantity),0) into received from public.homecare_purchase_receipts where tenant_id=p_tenant and item_id=p_item;
  if p_quantity is null or p_quantity <= 0 or received+p_quantity > item.quantity then raise exception 'INVALID_RECEIPT_QUANTITY' using errcode='23514'; end if;
  insert into public.homecare_purchase_receipts(tenant_id,id,item_id,quantity,actor_user_id,note)
    values(p_tenant,p_id,p_item,p_quantity,p_actor,p_note) returning * into receipt;
  perform public.homecare_stock_post(p_tenant,p_id,item.material_id,null,purchase.location_id,p_quantity,p_actor,p_note,purchase.job_id,purchase.project_id,p_id,null,item.unit_price);
  select not exists(
    select 1 from public.homecare_purchase_order_items i where i.tenant_id=p_tenant and i.order_id=purchase.id and i.deleted_at is null
    and i.quantity > (select coalesce(sum(r.quantity),0) from public.homecare_purchase_receipts r where r.tenant_id=p_tenant and r.item_id=i.id)
  ) into finished;
  update public.homecare_purchase_orders set status=case when finished then 'received' else 'partially_received' end where tenant_id=p_tenant and id=purchase.id;
  update public.homecare_materials set purchase_price=item.unit_price,record_data=record_data-'purchasePrice' where tenant_id=p_tenant and id=item.material_id;
  return receipt;
end $$;

create or replace function public.homecare_maintenance_complete(
  p_tenant uuid,p_id uuid,p_plan uuid,p_expected_revision bigint,p_date date,p_mileage numeric,p_hours numeric,
  p_cost numeric,p_currency text,p_supplier uuid,p_document text,p_actor uuid,p_notes text
) returns public.homecare_maintenance_events language plpgsql security definer set search_path=public as $$
declare plan public.homecare_maintenance_plans%rowtype; event public.homecare_maintenance_events%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_id::text,0));
  select * into event from public.homecare_maintenance_events where tenant_id=p_tenant and id=p_id;
  if found then
    if (event.plan_id,event.completed_date,event.mileage,event.operating_hours,event.cost,event.currency,event.supplier_id,event.document_id,event.actor_user_id,event.notes)
      is distinct from (p_plan,p_date,p_mileage,p_hours,p_cost,p_currency,p_supplier,p_document,p_actor,p_notes) then
      raise exception 'MAINTENANCE_ID_REUSED' using errcode='23514';
    end if;
    return event;
  end if;
  select * into plan from public.homecare_maintenance_plans where tenant_id=p_tenant and id=p_plan and deleted_at is null for update;
  if not found or plan.completed then raise exception 'MAINTENANCE_NOT_ACTIVE' using errcode='23514'; end if;
  if p_expected_revision is null or plan.revision <> p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
  if p_document is not null then
    perform 1 from public.homecare_media where tenant_id=p_tenant and id=p_document and deleted_at is null for share;
    if not found then raise exception 'MAINTENANCE_DOCUMENT_NOT_ACTIVE' using errcode='23503'; end if;
  end if;
  if (plan.interval_mileage is not null and p_mileage is null) or (plan.interval_hours is not null and p_hours is null) then raise exception 'COMPLETION_READING_REQUIRED' using errcode='23514'; end if;
  insert into public.homecare_maintenance_events(tenant_id,id,plan_id,completed_date,mileage,operating_hours,cost,currency,supplier_id,document_id,actor_user_id,notes,plan_revision)
    values(p_tenant,p_id,p_plan,p_date,p_mileage,p_hours,p_cost,p_currency,p_supplier,p_document,p_actor,p_notes,plan.revision) returning * into event;
  update public.homecare_maintenance_plans set
    completed=interval_days is null and interval_mileage is null and interval_hours is null,
    due_date=case when interval_days is not null then p_date+interval_days when interval_mileage is not null or interval_hours is not null then null else due_date end,
    due_mileage=case when interval_mileage is not null then p_mileage+interval_mileage when interval_days is not null or interval_hours is not null then null else due_mileage end,
    due_hours=case when interval_hours is not null then p_hours+interval_hours when interval_days is not null or interval_mileage is not null then null else due_hours end
    where tenant_id=p_tenant and id=p_plan;
  return event;
end $$;

-- API must authorize tenant and actor before invoking these service-only routines.
revoke all on function public.homecare_stock_post(uuid,uuid,text,text,text,numeric,uuid,text,text,text,uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.homecare_purchase_receive(uuid,uuid,uuid,numeric,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.homecare_maintenance_complete(uuid,uuid,uuid,bigint,date,numeric,numeric,numeric,text,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_stock_post(uuid,uuid,text,text,text,numeric,uuid,text,text,text,uuid,uuid,numeric) to service_role;
grant execute on function public.homecare_purchase_receive(uuid,uuid,uuid,numeric,bigint,uuid,text) to service_role;
grant execute on function public.homecare_maintenance_complete(uuid,uuid,uuid,bigint,date,numeric,numeric,numeric,text,uuid,text,uuid,text) to service_role;
commit;
