begin;
create table if not exists public.homecare_picking_orders (
  tenant_id uuid not null references public.homecare_tenants(id), id uuid not null,
  job_id text not null, job_revision bigint not null, title text not null,
  actor_user_id uuid not null, created_at timestamptz not null default now(),
  revision integer not null default 1, status text not null default 'open' check(status in('open','completed','cancelled')),
  primary key(tenant_id,id), foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id)
);
create table if not exists public.homecare_picking_items (
  tenant_id uuid not null, order_id uuid not null, material_id text not null,
  quantity numeric not null check(quantity>0), picked numeric not null default 0 check(picked>=0 and picked<=quantity),
  primary key(tenant_id,order_id,material_id),
  foreign key(tenant_id,order_id) references public.homecare_picking_orders(tenant_id,id),
  foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id)
);
create table if not exists public.homecare_picking_postings (
  tenant_id uuid not null, id uuid not null, order_id uuid not null, material_id text not null,
  source_id text not null, quantity numeric not null, actor_user_id uuid not null,
  primary key(tenant_id,id),
  foreign key(tenant_id,id) references public.homecare_stock_movements(tenant_id,id),
  foreign key(tenant_id,order_id,material_id) references public.homecare_picking_items(tenant_id,order_id,material_id)
);
do $$ declare tbl text; begin
  foreach tbl in array array['homecare_picking_orders','homecare_picking_items','homecare_picking_postings'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('drop policy if exists picking_read on public.%I',tbl);
    execute format('create policy picking_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
end $$;

create or replace function public.homecare_create_picking_order(p_tenant uuid,p_id uuid,p_job text,p_revision bigint,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare job public.homecare_jobs%rowtype; old public.homecare_picking_orders%rowtype;
  item record; consumed numeric; planned numeric; amount numeric;
begin
  select * into job from public.homecare_jobs where tenant_id=p_tenant and id=p_job for update;
  if not found then raise exception 'JOB_NOT_OPEN'; end if;
  select * into old from public.homecare_picking_orders where tenant_id=p_tenant and id=p_id;
  if found then
    if old.job_id<>p_job or old.job_revision<>p_revision or old.actor_user_id<>p_actor then raise exception 'PICKING_CHANGED'; end if;
    return old.id;
  end if;
  if job.deleted_at is not null or job.status not in('geplant','in Arbeit','pausiert') then raise exception 'JOB_NOT_OPEN'; end if;
  if job.billable is false then raise exception 'JOB_NOT_BILLABLE'; end if;
  if job.revision<>p_revision then raise exception 'PICKING_JOB_CHANGED'; end if;
  insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id) values(p_tenant,p_id,p_job,p_revision,job.title,p_actor);
  for item in select value->>'materialId' material_id,sum(coalesce(nullif(replace(value->>'quantity',',','.'),''),'1')::numeric) quantity
    from jsonb_array_elements(coalesce(job.material_items,'[]')) where nullif(value->>'materialId','') is not null group by value->>'materialId' loop
    if item.quantity::text in('NaN','Infinity','-Infinity') or item.quantity<>round(item.quantity,3) then raise exception 'INVALID_PICKING_QUANTITY'; end if;
    select coalesce(sum(case when source_id is not null then quantity else -quantity end),0) into consumed
      from public.homecare_stock_movements where tenant_id=p_tenant and job_id=p_job and material_id=item.material_id and billing_data is not null;
    select coalesce(sum(i.quantity),0) into planned from public.homecare_picking_items i
      join public.homecare_picking_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
      where i.tenant_id=p_tenant and o.job_id=p_job and o.status in('open','completed','loaded') and i.material_id=item.material_id;
    amount:=item.quantity-consumed-planned;
    if amount>0 then
      perform 1 from public.homecare_materials where tenant_id=p_tenant and id=item.material_id and deleted_at is null and not archived;
      if not found then raise exception 'MATERIAL_NOT_ACTIVE'; end if;
      insert into public.homecare_picking_items(tenant_id,order_id,material_id,quantity) values(p_tenant,p_id,item.material_id,amount);
    end if;
  end loop;
  if not exists(select 1 from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_id) then raise exception 'NO_PICKING_REQUIRED'; end if;
  return p_id;
end $$;

create or replace function public.homecare_pick_material(p_tenant uuid,p_id uuid,p_order uuid,p_revision integer,p_material text,p_source text,p_quantity numeric,p_actor uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare plan public.homecare_picking_orders%rowtype; item public.homecare_picking_items%rowtype;
  old public.homecare_picking_postings%rowtype; needed numeric; consumed numeric;
begin
  -- Materials, then jobs: same lock order as stock_post.
  perform 1 from public.homecare_materials where tenant_id=p_tenant and id=p_material for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order;
  if not found then raise exception 'PICKING_CHANGED'; end if;
  perform 1 from public.homecare_jobs where tenant_id=p_tenant and id=plan.job_id for update;
  select * into plan from public.homecare_picking_orders where tenant_id=p_tenant and id=p_order for update;
  select * into old from public.homecare_picking_postings where tenant_id=p_tenant and id=p_id;
  if found then
    if (old.order_id,old.material_id,old.source_id,old.quantity,old.actor_user_id) is distinct from (p_order,p_material,p_source,p_quantity,p_actor) then raise exception 'PICKING_CHANGED'; end if;
    return plan.revision;
  end if;
  if plan.status<>'open' or plan.revision<>p_revision then raise exception 'PICKING_CHANGED'; end if;
  select * into item from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_order and material_id=p_material for update;
  if not found or p_quantity is null or p_quantity<=0 or p_quantity>item.quantity-item.picked then raise exception 'INVALID_PICKING_QUANTITY'; end if;
  select coalesce(sum(coalesce(nullif(replace(value->>'quantity',',','.'),''),'1')::numeric),0) into needed from public.homecare_jobs j,
    lateral jsonb_array_elements(coalesce(j.material_items,'[]')) where j.tenant_id=p_tenant and j.id=plan.job_id and value->>'materialId'=p_material;
  select coalesce(sum(case when source_id is not null then quantity else -quantity end),0) into consumed
    from public.homecare_stock_movements where tenant_id=p_tenant and job_id=plan.job_id and material_id=p_material and billing_data is not null;
  if p_quantity>needed-consumed then raise exception 'PICKING_JOB_CHANGED'; end if;
  perform public.homecare_stock_post(p_tenant,p_id,p_material,p_source,null,p_quantity,p_actor,'Kommissionierung '||p_order::text,plan.job_id);
  insert into public.homecare_picking_postings(tenant_id,id,order_id,material_id,source_id,quantity,actor_user_id) values(p_tenant,p_id,p_order,p_material,p_source,p_quantity,p_actor);
  update public.homecare_picking_items set picked=picked+p_quantity where tenant_id=p_tenant and order_id=p_order and material_id=p_material;
  update public.homecare_picking_orders set revision=revision+1,status=case when exists(select 1 from public.homecare_picking_items where tenant_id=p_tenant and order_id=p_order and picked<quantity) then 'open' else 'completed' end where tenant_id=p_tenant and id=p_order returning revision into p_revision;
  return p_revision;
end $$;
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
  update public.homecare_picking_orders set status='cancelled',revision=revision+1 where tenant_id=p_tenant and id=p_id returning revision into p_revision;
  return p_revision;
end $$;
revoke all on function public.homecare_cancel_picking_order(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.homecare_cancel_picking_order(uuid,uuid,integer,uuid) to service_role;
do $$ begin
  if to_regprocedure('public.homecare_apply_job_operation_before_picking(uuid,text,text,text,text,uuid,jsonb,bigint)') is null then
    alter function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) rename to homecare_apply_job_operation_before_picking;
  end if;
end $$;
create or replace function public.homecare_apply_job_operation_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,p_expected_revision bigint default null,p_actor_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  result:=public.homecare_apply_job_operation_before_picking(p_mutation_id,p_entity_type,p_entity_id,p_operation,p_resource_id,p_tenant_id,p_payload,p_expected_revision);
  if result->>'status'='synced' and p_entity_type='job' and p_operation in('create','update') and p_payload->>'createPicking'='true' and not (result?'picking_order_id') then
    if p_actor_id is null then raise exception 'PICKING_ACTOR_REQUIRED'; end if;
    begin
      perform public.homecare_create_picking_order(p_tenant_id,p_mutation_id,p_entity_id,(result#>>'{record,revision}')::bigint,p_actor_id);
      result:=result||jsonb_build_object('picking_order_id',p_mutation_id);
    exception when others then
      if sqlerrm='NO_PICKING_REQUIRED' then result:=result||jsonb_build_object('picking_notice','NO_PICKING_REQUIRED'); else raise; end if;
    end;
    update public.homecare_sync_mutations set response_payload=result where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
  end if;
  return result;
end $$;
revoke all on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) to service_role;
revoke all on function public.homecare_create_picking_order(uuid,uuid,text,bigint,uuid),public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.homecare_create_picking_order(uuid,uuid,text,bigint,uuid),public.homecare_pick_material(uuid,uuid,uuid,integer,text,text,numeric,uuid) to service_role;
do $$ begin
  if to_regprocedure('public.homecare_relational_backup_tables_before_picking()') is null then
    alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_picking;
  end if;
end $$;
create or replace function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
  select public.homecare_relational_backup_tables_before_picking()||array['homecare_picking_orders','homecare_picking_items','homecare_picking_postings']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
