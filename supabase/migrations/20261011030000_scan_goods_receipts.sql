begin;
create table public.homecare_goods_receipts (
 tenant_id uuid not null references public.homecare_tenants(id), id uuid not null,
 supplier_id uuid not null, delivery_number text not null check(length(trim(delivery_number)) between 1 and 120),
 location_id text not null, order_id uuid, actor_user_id uuid not null, created_at timestamptz not null default now(), request_payload jsonb not null,
 primary key(tenant_id,id),
 foreign key(tenant_id,supplier_id) references public.homecare_suppliers(tenant_id,id),
 foreign key(tenant_id,location_id) references public.homecare_inventory_locations(tenant_id,id),
 foreign key(tenant_id,order_id) references public.homecare_purchase_orders(tenant_id,id)
);
create unique index goods_receipt_delivery on public.homecare_goods_receipts(tenant_id,supplier_id,lower(trim(delivery_number)));
create table public.homecare_goods_receipt_items (
 tenant_id uuid not null, receipt_id uuid not null, material_id text not null, quantity numeric not null check(quantity>0),
 movement_id uuid not null, order_item_id uuid,
 primary key(tenant_id,receipt_id,material_id),
 foreign key(tenant_id,receipt_id) references public.homecare_goods_receipts(tenant_id,id),
 foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id),
 foreign key(tenant_id,movement_id) references public.homecare_stock_movements(tenant_id,id),
 foreign key(tenant_id,order_item_id) references public.homecare_purchase_order_items(tenant_id,id)
);
do $$ declare tbl text; begin
 foreach tbl in array array['homecare_goods_receipts','homecare_goods_receipt_items'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy goods_read on public.%I for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,''data.read''))',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
 end loop;
end $$;

create function public.homecare_scan_goods_receipt(p_tenant uuid,p_id uuid,p_actor uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved public.homecare_goods_receipts%rowtype; purchase public.homecare_purchase_orders%rowtype;
 line jsonb; movement uuid; result jsonb; batch jsonb; material text;
begin
 if p_actor is null or p_id is null or jsonb_typeof(p_payload) is distinct from 'object'
  or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 50
  or length(trim(coalesce(p_payload->>'delivery_number',''))) not between 1 and 120 then raise exception 'INVALID_OPERATIONS_COMMAND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':goods:'||p_id::text,0));
 select * into saved from public.homecare_goods_receipts where tenant_id=p_tenant and id=p_id;
 if found then
  if saved.actor_user_id<>p_actor or saved.request_payload is distinct from p_payload then raise exception 'RECEIPT_ID_REUSED'; end if;
  return p_id;
 end if;
 if not exists(select 1 from public.homecare_stock_cutovers where tenant_id=p_tenant) then raise exception 'STOCK_CUTOVER_REQUIRED'; end if;
 perform 1 from public.homecare_suppliers where tenant_id=p_tenant and id=(p_payload->>'supplier_id')::uuid and deleted_at is null for share;
 if not found then raise exception 'SUPPLIER_NOT_ACTIVE'; end if;
 perform 1 from public.homecare_inventory_locations where tenant_id=p_tenant and id=p_payload->>'location_id' and deleted_at is null and not archived and project_id is null for share;
 if not found then raise exception 'LOCATION_NOT_ACTIVE'; end if;
 if (select count(distinct value->>'material_id') from jsonb_array_elements(p_payload->'items'))<>jsonb_array_length(p_payload->'items') then raise exception 'INVALID_OPERATIONS_COMMAND'; end if;
 if p_payload->>'order_id' is not null then
  select * into purchase from public.homecare_purchase_orders where tenant_id=p_tenant and id=(p_payload->>'order_id')::uuid for update;
  if not found or purchase.supplier_id<>(p_payload->>'supplier_id')::uuid or purchase.deleted_at is not null then raise exception 'PURCHASE_NOT_RECEIVABLE'; end if;
  batch:='[]'::jsonb;
  for line in select value from jsonb_array_elements(p_payload->'items') loop
   select material_id into material from public.homecare_purchase_order_items where tenant_id=p_tenant and id=(line->>'item_id')::uuid and order_id=purchase.id and deleted_at is null;
   if not found or material is distinct from line->>'material_id' then raise exception 'PURCHASE_ITEM_NOT_FOUND'; end if;
   batch:=batch||jsonb_build_array(jsonb_build_object('item_id',line->>'item_id','quantity',line->'quantity'));
  end loop;
  result:=public.homecare_apply_purchase_receipt_batch(p_id,'operations',purchase.id::text,'update',purchase.id::text,p_tenant,
   jsonb_build_object('kind','receive_batch','items',batch,'location_id',p_payload->>'location_id','note','Lieferschein '||(p_payload->>'delivery_number'),'document_id',null),
   (p_payload->>'revision')::bigint,p_actor);
  if result->>'status' is distinct from 'synced' then raise exception 'REVISION_CONFLICT'; end if;
 end if;
 insert into public.homecare_goods_receipts(tenant_id,id,supplier_id,delivery_number,location_id,order_id,actor_user_id,request_payload)
 values(p_tenant,p_id,(p_payload->>'supplier_id')::uuid,trim(p_payload->>'delivery_number'),p_payload->>'location_id',purchase.id,p_actor,p_payload);
 for line in select value from jsonb_array_elements(p_payload->'items') order by value->>'material_id' loop
  if purchase.id is null then
   movement:=md5(p_id::text||':'||(line->>'material_id'))::uuid;
   perform public.homecare_stock_post(p_tenant,movement,line->>'material_id',null,p_payload->>'location_id',(line->>'quantity')::numeric,p_actor,'Lieferschein '||(p_payload->>'delivery_number'));
  else
   select id into movement from public.homecare_stock_movements where tenant_id=p_tenant and receipt_id=md5(p_id::text||':receipt:'||(line->>'item_id'))::uuid;
   if movement is null then raise exception 'RECEIPT_MOVEMENT_MISSING'; end if;
  end if;
  insert into public.homecare_goods_receipt_items(tenant_id,receipt_id,material_id,quantity,movement_id,order_item_id)
   values(p_tenant,p_id,line->>'material_id',(line->>'quantity')::numeric,movement,case when purchase.id is not null then (line->>'item_id')::uuid else null end);
 end loop;
 return p_id;
end $$;
revoke all on function public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.homecare_scan_goods_receipt(uuid,uuid,uuid,jsonb) to service_role;
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_goods;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_goods()||array['homecare_goods_receipts','homecare_goods_receipt_items']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
