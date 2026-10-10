begin;
alter table public.homecare_picking_orders drop constraint homecare_picking_orders_status_check;
alter table public.homecare_picking_orders add constraint homecare_picking_orders_status_check check(status in('open','completed','loaded','dispatched','cancelled'));
alter table public.homecare_picking_orders add column staging_id text,
  add column dispatch_id uuid, add column dispatched_at timestamptz, add column dispatched_by uuid,
  add column destination_id text, add column pickup_code uuid, add column dispatch_history jsonb not null default '{}'::jsonb,
  add constraint picking_staging_fk foreign key(tenant_id,staging_id) references public.homecare_inventory_locations(tenant_id,id),
  add constraint picking_destination_fk foreign key(tenant_id,destination_id) references public.homecare_inventory_locations(tenant_id,id);
create unique index picking_dispatch_id on public.homecare_picking_orders(tenant_id,dispatch_id) where dispatch_id is not null;
create unique index picking_pickup_code on public.homecare_picking_orders(tenant_id,pickup_code) where pickup_code is not null;

drop function public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,numeric,uuid);
create function public.homecare_pick_material(p_tenant uuid,p_id uuid,p_order uuid,p_revision integer,p_material text,p_source text,p_destination text,p_quantity numeric,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare plan public.homecare_picking_orders%rowtype; item public.homecare_picking_items%rowtype;
  old public.homecare_picking_postings%rowtype; job public.homecare_jobs%rowtype; location public.homecare_inventory_locations%rowtype;
begin
  perform 1 from public.homecare_materials where tenant_id=p_tenant and id=p_material for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order;
  if not found then raise exception 'PICKING_CHANGED'; end if;
  select * into job from public.homecare_jobs where tenant_id=p_tenant and id=plan.job_id for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order for update;
  select * into old from public.homecare_picking_postings where tenant_id=p_tenant and id=p_id;
  if found then
    if (old.order_id,old.material_id,old.source_id,old.quantity,old.actor_user_id,plan.staging_id) is distinct from (p_order,p_material,p_source,p_quantity,p_actor,p_destination) then raise exception 'PICKING_CHANGED'; end if;
    return plan.revision;
  end if;
  if job.deleted_at is not null or job.status not in('geplant','in Arbeit','pausiert') then raise exception 'JOB_NOT_OPEN'; end if;
  if plan.status<>'open' or plan.revision<>p_revision then raise exception 'PICKING_CHANGED'; end if;
  if p_actor is null or p_destination is null or p_source=p_destination then raise exception 'PICKING_INVALID_PLACE'; end if;
  select * into location from public.homecare_inventory_locations where tenant_id=p_tenant and id=p_destination and deleted_at is null and not archived for share;
  if not found or location.location_kind in('vehicle','project') or location.project_id is not null then raise exception 'PICKING_INVALID_PLACE'; end if;
  if location.job_id is not null and location.job_id<>plan.job_id then raise exception 'PICKING_WRONG_JOB'; end if;
  if plan.staging_id is not null and plan.staging_id<>p_destination then raise exception 'PICKING_INVALID_PLACE'; end if;
  select * into item from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_order and material_id=p_material for update;
  if not found or p_quantity is null or p_quantity<=0 or p_quantity>item.quantity-item.picked then raise exception 'INVALID_PICKING_QUANTITY'; end if;
  perform public.homecare_stock_post(p_tenant,p_id,p_material,p_source,p_destination,p_quantity,p_actor,'Kommissionierung '||p_order::text);
  insert into public.homecare_picking_postings(tenant_id,id,order_id,material_id,source_id,quantity,actor_user_id) values(p_tenant,p_id,p_order,p_material,p_source,p_quantity,p_actor);
  update public.homecare_picking_items set picked=picked+p_quantity where tenant_id=p_tenant and order_id=p_order and material_id=p_material;
  update public.homecare_picking_orders set staging_id=p_destination,revision=revision+1,status=case when exists(select 1 from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_order and picked<quantity) then 'open' else 'completed' end where tenant_id=p_tenant and id=p_order returning revision into p_revision;
  update public.homecare_picking_orders set pickup_code=coalesce(pickup_code,gen_random_uuid()) where tenant_id=p_tenant and id=p_order and status='completed';
  return p_revision;
end $$;

create or replace function public.homecare_dispatch_picking(p_tenant uuid,p_id uuid,p_order uuid,p_revision integer,p_destination text,p_actor uuid,p_pickup uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare plan public.homecare_picking_orders%rowtype; job public.homecare_jobs%rowtype; target public.homecare_inventory_locations%rowtype; item record; consumed numeric; required numeric;
begin
  -- All stock writers lock materials before the job and picking order.
  perform 1 from public.homecare_materials m join public.homecare_picking_items i on i.tenant_id=m.tenant_id and i.material_id=m.id
    where i.tenant_id=p_tenant and i.order_id=p_order order by m.id for update of m;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order;
  if not found then raise exception 'PICKING_CHANGED'; end if;
  select * into job from public.homecare_jobs where tenant_id=p_tenant and id=plan.job_id for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order for update;
  if p_pickup is null or plan.pickup_code is distinct from p_pickup then raise exception 'PICKING_INVALID_PICKUP'; end if;
  if plan.dispatch_history ? p_id::text then
    if plan.dispatch_history->p_id::text->>'destination' is distinct from p_destination or plan.dispatch_history->p_id::text->>'actor' is distinct from p_actor::text then raise exception 'PICKING_CHANGED'; end if;
    return (plan.dispatch_history->p_id::text->>'revision')::integer;
  end if;
  if plan.status not in('completed','loaded') or plan.revision<>p_revision or p_actor is null or plan.status='loaded' and p_destination is not null then raise exception 'PICKING_CHANGED'; end if;
  if job.deleted_at is not null or job.status not in('geplant','in Arbeit','pausiert') then raise exception 'JOB_NOT_OPEN'; end if;
  if job.billable is false then raise exception 'JOB_NOT_BILLABLE'; end if;
  if p_destination is not null then
    select * into target from public.homecare_inventory_locations where tenant_id=p_tenant and id=p_destination and deleted_at is null and not archived for share;
    if not found or target.location_kind<>'vehicle' or target.project_id is not null or p_destination=plan.staging_id then raise exception 'PICKING_INVALID_VEHICLE'; end if;
  end if;
  -- Release reservations inside this transaction only; failed postings roll everything back.
  update public.homecare_picking_orders set status='dispatched',dispatch_id=p_id,destination_id=p_destination,dispatched_by=p_actor,dispatched_at=now(),revision=revision+1
    where tenant_id=p_tenant and id=p_order returning revision into p_revision;
  for item in select * from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_order order by material_id loop
    if p_destination is null then
      select coalesce(sum(coalesce(nullif(replace(value->>'quantity',',','.'),''),'1')::numeric),0) into required
        from jsonb_array_elements(coalesce(job.material_items,'[]')) where value->>'materialId'=item.material_id;
      select coalesce(sum(case when source_id is not null then quantity else -quantity end),0) into consumed from public.homecare_stock_movements
        where tenant_id=p_tenant and job_id=plan.job_id and material_id=item.material_id and billing_data is not null;
      if item.picked>required-consumed then raise exception 'PICKING_JOB_CHANGED'; end if;
    end if;
    perform public.homecare_stock_post(p_tenant,md5(p_id::text||':'||item.material_id)::uuid,item.material_id,plan.staging_id,p_destination,item.picked,p_actor,
      'Kommissionierung verladen '||p_order::text,case when p_destination is null then plan.job_id else null end);
  end loop;
  update public.homecare_picking_orders set status=case when p_destination is null then 'dispatched' else 'loaded' end,
    staging_id=coalesce(p_destination,staging_id),
    dispatch_history=dispatch_history||jsonb_build_object(p_id::text,jsonb_build_object('destination',p_destination,'actor',p_actor,'revision',p_revision))
    where tenant_id=p_tenant and id=p_order;
  return p_revision;
end $$;

create or replace function public.homecare_protect_picking_stock() returns trigger
language plpgsql security definer set search_path=public as $$
declare reserved numeric; balance numeric;
begin
  if current_setting('workcore.operations_restore',true)='1' or new.source_id is null then return new; end if;
  select coalesce(sum(i.picked),0) into reserved from public.homecare_picking_items i join public.homecare_picking_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
    where i.tenant_id=new.tenant_id and i.material_id=new.material_id and o.staging_id=new.source_id and o.status in('open','completed','loaded');
  select coalesce(sum(case when destination_id=new.source_id then quantity else 0 end)-sum(case when source_id=new.source_id then quantity else 0 end),0)
    into balance from public.homecare_stock_movements where tenant_id=new.tenant_id and material_id=new.material_id;
  if new.quantity>balance-reserved then raise exception 'PICKING_STOCK_RESERVED'; end if;
  return new;
end $$;
create trigger protect_picking_stock before insert on public.homecare_stock_movements for each row execute function public.homecare_protect_picking_stock();

create or replace function public.homecare_cancel_picking_order(p_tenant uuid,p_id uuid,p_revision integer,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare plan public.homecare_picking_orders%rowtype;
begin
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_id;
  if not found or p_actor is null then raise exception 'PICKING_CHANGED'; end if;
  perform 1 from public.homecare_jobs where tenant_id=p_tenant and id=plan.job_id for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_id for update;
  if plan.status='cancelled' then return plan.revision; end if;
  if plan.status<>'open' or plan.revision<>p_revision then raise exception 'PICKING_CHANGED'; end if;
  if exists(select 1 from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_id and picked>0) then raise exception 'PICKING_HAS_STOCK'; end if;
  update public.homecare_picking_orders set status='cancelled',revision=revision+1 where tenant_id=p_tenant and id=p_id returning revision into p_revision;
  return p_revision;
end $$;
revoke all on function public.homecare_protect_picking_stock(),public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,text,numeric,uuid),public.homecare_dispatch_picking(uuid,uuid,uuid,integer,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,text,numeric,uuid),public.homecare_dispatch_picking(uuid,uuid,uuid,integer,text,uuid,uuid) to service_role;
commit;
