begin;
alter table public.homecare_picking_orders add column cancellation_reason text,
  add column cancelled_by uuid, add column cancelled_at timestamptz;
create table public.homecare_picking_events (
  tenant_id uuid not null, id uuid not null default gen_random_uuid(), order_id uuid not null,
  revision integer not null, action text not null, previous_status text, status text not null,
  actor_user_id uuid, occurred_at timestamptz not null default now(), note text,
  primary key(tenant_id,id), unique(tenant_id,order_id,revision),
  foreign key(tenant_id,order_id) references public.homecare_picking_orders(tenant_id,id)
);
alter table public.homecare_picking_events enable row level security;
create policy picking_events_read on public.homecare_picking_events for select to authenticated
using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_picking_events from anon,authenticated;
grant select on public.homecare_picking_events to authenticated;
grant all on public.homecare_picking_events to service_role;

create function public.homecare_log_picking_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if current_setting('workcore.operations_restore',true)='1' then return new; end if;
  if tg_op='UPDATE' and new.revision=old.revision then return new; end if;
  insert into public.homecare_picking_events(tenant_id,order_id,revision,action,previous_status,status,actor_user_id,note)
  values(new.tenant_id,new.id,new.revision,
    case when tg_op='INSERT' then 'created' else coalesce(nullif(current_setting('homecare.picking_action',true),''),'changed') end,
    case when tg_op='UPDATE' then old.status else null end,new.status,
    case when tg_op='INSERT' then new.actor_user_id else nullif(current_setting('homecare.picking_actor',true),'')::uuid end,
    case when new.status='cancelled' then new.cancellation_reason else null end);
  return new;
end $$;
revoke all on function public.homecare_log_picking_change() from public;
create trigger log_picking_change after insert or update on public.homecare_picking_orders
for each row execute function public.homecare_log_picking_change();

alter function public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,text,numeric,uuid) rename to homecare_pick_material_before_audit;
create function public.homecare_pick_material(p_tenant uuid,p_id uuid,p_order uuid,p_revision integer,p_material text,p_source text,p_destination text,p_quantity numeric,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare result integer; begin
  perform set_config('homecare.picking_actor',p_actor::text,true);
  perform set_config('homecare.picking_action','picked',true);
  result:=public.homecare_pick_material_before_audit(p_tenant,p_id,p_order,p_revision,p_material,p_source,p_destination,p_quantity,p_actor);
  perform set_config('homecare.picking_actor','',true); perform set_config('homecare.picking_action','',true);
  return result;
end $$;
alter function public.homecare_dispatch_picking(uuid,uuid,uuid,integer,text,uuid,uuid) rename to homecare_dispatch_picking_before_audit;
create function public.homecare_dispatch_picking(p_tenant uuid,p_id uuid,p_order uuid,p_revision integer,p_destination text,p_actor uuid,p_pickup uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare result integer; begin
  perform set_config('homecare.picking_actor',p_actor::text,true);
  perform set_config('homecare.picking_action','dispatched',true);
  result:=public.homecare_dispatch_picking_before_audit(p_tenant,p_id,p_order,p_revision,p_destination,p_actor,p_pickup);
  perform set_config('homecare.picking_actor','',true); perform set_config('homecare.picking_action','',true);
  return result;
end $$;
drop function public.homecare_cancel_picking_order(uuid,uuid,integer,uuid);
create function public.homecare_cancel_picking_order(p_tenant uuid,p_id uuid,p_revision integer,p_actor uuid,p_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare plan public.homecare_picking_orders%rowtype; begin
  if p_actor is null or p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then raise exception 'PICKING_REASON_REQUIRED'; end if;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_id;
  if not found then raise exception 'PICKING_CHANGED'; end if;
  perform 1 from public.homecare_jobs where tenant_id=p_tenant and id=plan.job_id for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_id for update;
  if plan.status='cancelled' then
    if plan.cancelled_by=p_actor and plan.cancellation_reason=btrim(p_reason) and plan.revision=p_revision+1 then return plan.revision; end if;
    raise exception 'PICKING_CHANGED';
  end if;
  if plan.status<>'open' or plan.revision<>p_revision then raise exception 'PICKING_CHANGED'; end if;
  if exists(select 1 from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_id and picked>0) then raise exception 'PICKING_HAS_STOCK'; end if;
  perform set_config('homecare.picking_actor',p_actor::text,true); perform set_config('homecare.picking_action','cancelled',true);
  update public.homecare_picking_orders set status='cancelled',revision=revision+1,
    cancellation_reason=btrim(p_reason),cancelled_by=p_actor,cancelled_at=now()
    where tenant_id=p_tenant and id=p_id returning revision into p_revision;
  perform set_config('homecare.picking_actor','',true); perform set_config('homecare.picking_action','',true);
  return p_revision;
end $$;
revoke all on function public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,text,numeric,uuid),
 public.homecare_dispatch_picking(uuid,uuid,uuid,integer,text,uuid,uuid),public.homecare_cancel_picking_order(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,text,numeric,uuid),
 public.homecare_dispatch_picking(uuid,uuid,uuid,integer,text,uuid,uuid),public.homecare_cancel_picking_order(uuid,uuid,integer,uuid,text) to service_role;
-- Renamed implementations remain inaccessible to clients.
revoke all on function public.homecare_pick_material_before_audit(uuid,uuid,uuid,integer,text,text,text,numeric,uuid),
 public.homecare_dispatch_picking_before_audit(uuid,uuid,uuid,integer,text,uuid,uuid) from public,anon,authenticated,service_role;
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_picking_audit;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_picking_audit()||array['homecare_picking_events']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
