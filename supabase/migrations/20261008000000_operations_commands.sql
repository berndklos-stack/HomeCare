begin;
alter table public.homecare_maintenance_plans add column if not exists in_progress boolean not null default false,
  add column if not exists started_resource_revision bigint;
create unique index if not exists maintenance_active_resource_idx on public.homecare_maintenance_plans(tenant_id,resource_id)
  where in_progress and deleted_at is null;
create or replace function public.homecare_purchase_items_touch_order()
returns trigger language plpgsql set search_path=public as $$ begin
  if current_setting('workcore.operations_restore',true) is distinct from '1' then
    update public.homecare_purchase_orders set updated_at=now() where tenant_id=new.tenant_id and id=new.order_id;
  end if;
  return new;
end $$;
drop trigger if exists purchase_items_touch_order on public.homecare_purchase_order_items;
create trigger purchase_items_touch_order after insert or update on public.homecare_purchase_order_items
  for each row execute function public.homecare_purchase_items_touch_order();

-- Only this gateway is exposed to the authenticated server. New commands use the
-- existing durable mutation journal; no secondary delivery mechanism is added.
create or replace function public.homecare_operations_material_state(p_tenant uuid,p_material text)
returns jsonb language plpgsql stable set search_path=public as $$
declare result jsonb;
begin
  select jsonb_build_object('id',id,'revision',revision,'purchase_price',purchase_price) into result
    from public.homecare_materials where tenant_id=p_tenant and id=p_material;
  return result||jsonb_build_object(
    'stockTotal',(select coalesce(sum(quantity),0) from public.homecare_stock_balances(p_tenant,p_material)),
    'stockByLocation',(
      select coalesce(jsonb_object_agg(location,quantity),'{}'::jsonb) from (
        select coalesce(l.name,b.location_id) location,sum(b.quantity) quantity
        from public.homecare_stock_balances(p_tenant,p_material) b
        left join public.homecare_inventory_locations l on l.tenant_id=p_tenant and l.id=b.location_id
        group by coalesce(l.name,b.location_id)
      ) balances
    )
  );
end $$;
revoke all on function public.homecare_operations_material_state(uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_operations_material_state(uuid,text) to service_role;

create or replace function public.homecare_apply_operations_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,
  p_tenant_id uuid,p_payload jsonb,p_expected_revision bigint,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  saved public.homecare_sync_mutations%rowtype;
  kind text:=p_payload->>'kind'; entity text:=p_payload->>'entity'; tbl text;
  allowed text[]; values_json jsonb; current_row jsonb; result_row jsonb;
  result jsonb; cols text; selections text; assignments text; key text;
  old_revision bigint; row_exists boolean; purchase_status text;
  plan_resource text; material jsonb; index_no integer:=0;
  resource_row jsonb;
  changed_material text; material_row jsonb; item_order uuid;
begin
  if p_entity_type<>'operations' or p_actor_id is null or p_tenant_id is null or p_mutation_id is null
    or nullif(p_entity_id,'') is null or nullif(p_resource_id,'') is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'INVALID_OPERATIONS_COMMAND' using errcode='22023';
  end if;
  if (kind in('stock','receive') or (kind='complete' and jsonb_array_length(coalesce(p_payload->'materials','[]'))>0))
    and not exists(select 1 from public.homecare_stock_cutovers where tenant_id=p_tenant_id) then
    raise exception 'STOCK_CUTOVER_REQUIRED' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':operations:'||p_mutation_id::text,0));
  select * into saved from public.homecare_sync_mutations where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
  if found then
    if (saved.entity_type,saved.entity_id,saved.operation,saved.request_payload,saved.expected_revision)
      is distinct from (p_entity_type,p_entity_id,p_operation,p_payload,p_expected_revision) then
      raise exception 'MUTATION_ID_REUSED' using errcode='23514';
    end if;
    return saved.response_payload;
  end if;

  if kind in('save','archive') then
    case entity
      when 'suppliers' then tbl:='homecare_suppliers'; allowed:=array['supplier_number','company','email','phone','address','vat_number','payment_terms','notes','archived'];
      when 'supplier_contacts' then tbl:='homecare_supplier_contacts'; allowed:=array['supplier_id','name','email','phone','role'];
      when 'purchase_orders' then tbl:='homecare_purchase_orders'; allowed:=array['order_number','supplier_id','order_date','expected_delivery','location_id','job_id','project_id','resource_id','currency','notes'];
      when 'purchase_order_items' then tbl:='homecare_purchase_order_items'; allowed:=array['order_id','material_id','quantity','unit_price'];
      when 'resource_assignments' then tbl:='homecare_resource_assignments'; allowed:=array['resource_id','employee_id','job_id','project_id','location_id','starts_at','ends_at','notes'];
      when 'maintenance_plans' then tbl:='homecare_maintenance_plans'; allowed:=array['resource_id','name','maintenance_type','due_date','due_mileage','due_hours','interval_days','interval_mileage','interval_hours','responsible_person_id','supplier_id','notes'];
      when 'resource_details' then tbl:='homecare_resources'; allowed:=array['equipment_kind','availability','purchase_date','purchase_price','warranty_until','warranty_notes','operating_hours'];
      when 'material_details' then tbl:='homecare_materials'; allowed:=array['preferred_supplier_id','reorder_quantity','notes'];
      when 'location_details' then tbl:='homecare_inventory_locations'; allowed:=array['location_kind','resource_id','project_id'];
      else raise exception 'INVALID_OPERATIONS_ENTITY' using errcode='22023';
    end case;
  elsif kind in('order','cancel','receive') then tbl:='homecare_purchase_orders';
  elsif kind in('start','complete') then tbl:='homecare_maintenance_plans';
  elsif kind='stock' then tbl:=null;
  else raise exception 'INVALID_OPERATIONS_COMMAND' using errcode='22023'; end if;

  if tbl is not null then
    if tbl='homecare_purchase_order_items' then
      if p_operation='create' then item_order:=(p_payload#>>'{values,order_id}')::uuid;
      else select order_id into item_order from public.homecare_purchase_order_items where tenant_id=p_tenant_id and id=p_entity_id::uuid; end if;
      perform 1 from public.homecare_purchase_orders where tenant_id=p_tenant_id and id=item_order for update;
    end if;
    execute format('select to_jsonb(t) from public.%I t where tenant_id=$1 and id::text=$2 for update',tbl)
      into current_row using p_tenant_id,p_entity_id;
    row_exists:=current_row is not null;
    old_revision:=(current_row->>'revision')::bigint;
  end if;

  -- The subtransaction rolls back all receipts, stock and plan changes on conflict.
  begin
    if kind='stock' then
      if p_operation<>'create' then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
      result_row:=to_jsonb(public.homecare_stock_post(p_tenant_id,p_mutation_id,p_payload->>'material_id',
        p_payload->>'source_id',p_payload->>'destination_id',(p_payload->>'quantity')::numeric,p_actor_id,p_payload->>'note',
        p_payload->>'job_id',p_payload->>'project_id'));
    else
      if p_operation='create' then
        if kind<>'save' or entity like '%_details' then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
        if row_exists then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
      elsif not row_exists or current_row->>'deleted_at' is not null or p_expected_revision is null or old_revision<>p_expected_revision then
        raise exception 'REVISION_CONFLICT' using errcode='40001';
      end if;

      if kind='save' then
        values_json:=p_payload->'values';
        if jsonb_typeof(values_json)<>'object' or values_json='{}'::jsonb then raise exception 'INVALID_VALUES' using errcode='22023'; end if;
        for key in select jsonb_object_keys(values_json) loop
          if not key=any(allowed) then raise exception 'UNSAFE_COLUMN: %',key using errcode='22023'; end if;
        end loop;
        if entity='purchase_orders' and row_exists and current_row->>'status'<>'draft' then
          raise exception 'ORDERED_HEADER_IMMUTABLE' using errcode='23514';
        end if;
        if entity='maintenance_plans' and row_exists and (current_row->>'in_progress')::boolean then
          raise exception 'MAINTENANCE_IN_PROGRESS' using errcode='23514'; end if;
        if entity='resource_assignments' then
          perform 1 from public.homecare_resources where tenant_id=p_tenant_id and id=coalesce(values_json->>'resource_id',current_row->>'resource_id')
            and deleted_at is null and not archived for update;
          if not found then raise exception 'RESOURCE_NOT_ACTIVE' using errcode='23514'; end if;
        end if;
        -- Vehicle odometers, active trips and their legacy type are not editable here.
        if entity='resource_details' and values_json ? 'operating_hours'
          and (((values_json->>'operating_hours')::numeric < coalesce((current_row->>'operating_hours')::numeric,0))
            or (values_json->>'operating_hours' is null and current_row->>'operating_hours' is not null)) then
          raise exception 'OPERATING_HOURS_DECREASE' using errcode='23514';
        end if;
        select string_agg(format('%I',k),',' order by k),
          string_agg(format('v.%I',k),',' order by k),
          string_agg(format('%I=v.%I',k,k),',' order by k)
          into cols,selections,assignments from jsonb_object_keys(values_json) k;
        if p_operation='create' then
          execute format('insert into public.%I(tenant_id,id,%s) select $1,$2::uuid,%s from jsonb_populate_record(null::public.%I,$3) v returning to_jsonb(%I.*)',tbl,cols,selections,tbl,tbl)
            into result_row using p_tenant_id,p_entity_id,values_json;
        else
          execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$3) v where t.tenant_id=$1 and t.id::text=$2 returning to_jsonb(t.*)',tbl,assignments,tbl)
            into result_row using p_tenant_id,p_entity_id,values_json;
        end if;
      elsif kind='archive' then
        if p_operation<>'delete' or entity not in('suppliers','supplier_contacts','maintenance_plans','purchase_order_items') then
          raise exception 'INVALID_ARCHIVE' using errcode='22023'; end if;
        execute format('update public.%I set deleted_at=now() where tenant_id=$1 and id::text=$2 returning to_jsonb(%I.*)',tbl,tbl)
          into result_row using p_tenant_id,p_entity_id;
      elsif kind in('order','cancel') then
        if p_operation<>'update' then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
        purchase_status:=current_row->>'status';
        if kind='order' then
          if purchase_status<>'draft' or not exists(select 1 from public.homecare_purchase_order_items where tenant_id=p_tenant_id and order_id=p_entity_id::uuid and deleted_at is null) then
            raise exception 'ORDER_REQUIRES_DRAFT_ITEMS' using errcode='23514'; end if;
          purchase_status:='ordered';
        else
          if purchase_status not in('draft','ordered') then raise exception 'RECEIVED_ORDER_CANNOT_CANCEL' using errcode='23514'; end if;
          purchase_status:='cancelled';
        end if;
        if entity='maintenance_plans' and (current_row->>'in_progress')::boolean then raise exception 'MAINTENANCE_IN_PROGRESS' using errcode='23514'; end if;
        update public.homecare_purchase_orders set status=purchase_status where tenant_id=p_tenant_id and id=p_entity_id::uuid returning to_jsonb(homecare_purchase_orders.*) into result_row;
      elsif kind='receive' then
        if p_operation<>'update' or not exists(select 1 from public.homecare_purchase_order_items where tenant_id=p_tenant_id and id=(p_payload->>'item_id')::uuid and order_id=p_entity_id::uuid) then
          raise exception 'PURCHASE_ITEM_NOT_IN_ORDER' using errcode='23514'; end if;
        perform public.homecare_purchase_receive(p_tenant_id,p_mutation_id,(p_payload->>'item_id')::uuid,
          (p_payload->>'quantity')::numeric,p_expected_revision,p_actor_id,p_payload->>'note');
        select to_jsonb(t) into result_row from public.homecare_purchase_orders t where tenant_id=p_tenant_id and id=p_entity_id::uuid;
      elsif kind='start' then
        if p_operation<>'update' or (current_row->>'completed')::boolean or (current_row->>'in_progress')::boolean then raise exception 'MAINTENANCE_NOT_STARTABLE' using errcode='23514'; end if;
        plan_resource:=current_row->>'resource_id';
        select to_jsonb(r) into resource_row from public.homecare_resources r where tenant_id=p_tenant_id and id=plan_resource and deleted_at is null and not archived for update;
        if resource_row is null or (resource_row->>'revision')::bigint is distinct from (p_payload->>'resource_revision')::bigint then
          raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
        if coalesce(resource_row->>'availability','available')<>'available' or exists(
          select 1 from public.homecare_vehicle_trips where tenant_id=p_tenant_id and resource_id=plan_resource and status='laufend' and deleted_at is null
        ) then raise exception 'RESOURCE_NOT_AVAILABLE' using errcode='23514'; end if;
        update public.homecare_resources set availability='maintenance' where tenant_id=p_tenant_id and id=plan_resource returning to_jsonb(homecare_resources.*) into resource_row;
        update public.homecare_maintenance_plans set in_progress=true,started_resource_revision=(resource_row->>'revision')::bigint
          where tenant_id=p_tenant_id and id=p_entity_id::uuid returning to_jsonb(homecare_maintenance_plans.*) into result_row;
      elsif kind='complete' then
        if p_operation<>'update' then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
        plan_resource:=current_row->>'resource_id';
        -- Lock materials in a consistent order before consumption to avoid deadlocks.
        perform 1 from public.homecare_materials where tenant_id=p_tenant_id and id in(
          select m->>'material_id' from jsonb_array_elements(coalesce(p_payload->'materials','[]')) m
        ) order by id for update;
        result_row:=to_jsonb(public.homecare_maintenance_complete(p_tenant_id,p_mutation_id,p_entity_id::uuid,p_expected_revision,
          (p_payload->>'completed_date')::date,(p_payload->>'mileage')::numeric,(p_payload->>'operating_hours')::numeric,
          (p_payload->>'cost')::numeric,p_payload->>'currency',(p_payload->>'supplier_id')::uuid,p_payload->>'document_id',p_actor_id,p_payload->>'notes'));
        for material in select value from jsonb_array_elements(coalesce(p_payload->'materials','[]')) loop
          index_no:=index_no+1;
          perform public.homecare_stock_post(p_tenant_id,md5(p_mutation_id::text||':material:'||index_no)::uuid,
            material->>'material_id',material->>'location_id',null,(material->>'quantity')::numeric,p_actor_id,
            'Maintenance '||p_entity_id,null,null,null,p_mutation_id);
        end loop;
        -- Do not undo a subsequent status change by another user/device.
        if p_payload->>'operating_hours' is not null or (current_row->>'in_progress')::boolean then
          update public.homecare_resources set
            operating_hours=case when p_payload->>'operating_hours' is not null then greatest(coalesce(operating_hours,0),(p_payload->>'operating_hours')::numeric) else operating_hours end,
            availability=case when availability='maintenance' and revision=(current_row->>'started_resource_revision')::bigint then 'available' else availability end
            where tenant_id=p_tenant_id and id=plan_resource;
        end if;
        if (current_row->>'in_progress')::boolean then
          update public.homecare_maintenance_plans set in_progress=false,started_resource_revision=null where tenant_id=p_tenant_id and id=p_entity_id::uuid;
        end if;
        select to_jsonb(t) into result_row from public.homecare_maintenance_plans t where tenant_id=p_tenant_id and id=p_entity_id::uuid;
      end if;
    end if;
    if kind in('start','complete') then
      select revision into old_revision from public.homecare_resources where tenant_id=p_tenant_id and id=plan_resource;
      result_row:=result_row||jsonb_build_object('resource_revision',old_revision);
    end if;
    if kind='stock' then changed_material:=p_payload->>'material_id';
    elsif kind='receive' then select material_id into changed_material from public.homecare_purchase_order_items where tenant_id=p_tenant_id and id=(p_payload->>'item_id')::uuid;
    end if;
    if changed_material is not null then
      material_row:=public.homecare_operations_material_state(p_tenant_id,changed_material);
      result_row:=result_row||jsonb_build_object('material_record',material_row);
    elsif kind='complete' then
      select coalesce(jsonb_agg(public.homecare_operations_material_state(p_tenant_id,material_id)),'[]'::jsonb) into material_row
        from (select distinct value->>'material_id' material_id from jsonb_array_elements(coalesce(p_payload->'materials','[]'::jsonb))) consumed;
      result_row:=result_row||jsonb_build_object('material_records',material_row);
    end if;
    result:=jsonb_build_object('mutationId',p_mutation_id,'status','synced','record',result_row);
  exception when serialization_failure then
    result:=jsonb_build_object('mutationId',p_mutation_id,'status','conflict','record',current_row,'error','REVISION_CONFLICT');
  end;
  insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,expected_revision,request_payload,response_payload,applied_at)
    values(p_tenant_id,p_mutation_id,p_entity_type,p_entity_id,p_operation,result->>'status',p_expected_revision,p_payload,result,
      case when result->>'status'='synced' then now() else null end);
  return result;
end $$;
revoke all on function public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) to service_role;

-- Finite checks also cover the nullable extension fields on existing records.
do $$ declare tbl text; col text; ck text; begin
  for tbl,col in select table_name,column_name from information_schema.columns where table_schema='public'
    and (table_name='homecare_resources' and column_name in('operating_hours','purchase_price')
      or table_name='homecare_materials' and column_name='reorder_quantity') loop
    ck:=tbl||'_'||col||'_operations_finite';
    if not exists(select 1 from pg_constraint where conrelid=('public.'||tbl)::regclass and conname=ck) then
      execute format('alter table public.%I add constraint %I check(%I is null or (%I>=0 and %I::text not in(''NaN'',''Infinity'',''-Infinity'')))',tbl,ck,col,col,col);
    end if;
  end loop;
end $$;
commit;
