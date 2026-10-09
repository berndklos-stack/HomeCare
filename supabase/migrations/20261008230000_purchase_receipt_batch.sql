begin;

alter table public.homecare_purchase_receipts add column if not exists document_id text;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_purchase_receipts'::regclass and conname='purchase_receipt_document_fk') then
    alter table public.homecare_purchase_receipts add constraint purchase_receipt_document_fk
      foreign key(tenant_id,document_id) references public.homecare_media(tenant_id,id);
  end if;
end $$;

-- A single durable command books all selected lines in one transaction. Existing
-- single-line receipts and immutable stock movements retain their original APIs.
create or replace function public.homecare_apply_purchase_receipt_batch(
  p_mutation_id uuid,p_entity_type text,p_entity_id text,p_operation text,p_resource_id text,
  p_tenant_id uuid,p_payload jsonb,p_expected_revision bigint,p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  saved public.homecare_sync_mutations%rowtype;
  purchase public.homecare_purchase_orders%rowtype;
  item public.homecare_purchase_order_items%rowtype;
  line jsonb; receipt_id uuid; amount numeric; received numeric;
  current_row jsonb; result_row jsonb; result jsonb; materials jsonb;
begin
  if p_entity_type is distinct from 'operations' or p_operation is distinct from 'update'
    or p_payload->>'kind' is distinct from 'receive_batch' or p_tenant_id is null or p_actor_id is null
    or p_mutation_id is null or nullif(p_entity_id,'') is null or nullif(p_resource_id,'') is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or jsonb_typeof(p_payload->'items') is distinct from 'array'
    or nullif(trim(p_payload->>'location_id'),'') is null or nullif(trim(p_payload->>'note'),'') is null then
    raise exception 'INVALID_OPERATIONS_COMMAND' using errcode='22023';
  end if;
  if jsonb_array_length(p_payload->'items') not between 1 and 50
    or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('kind','items','location_id','note','document_id'))
    or (select count(distinct l->>'item_id') from jsonb_array_elements(p_payload->'items') l) <> jsonb_array_length(p_payload->'items') then
    raise exception 'INVALID_OPERATIONS_COMMAND' using errcode='22023';
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
  select * into purchase from public.homecare_purchase_orders where tenant_id=p_tenant_id and id=p_entity_id::uuid for update;
  current_row:=case when purchase.id is not null then to_jsonb(purchase) else null end;
  begin
    if purchase.id is null or purchase.deleted_at is not null or p_expected_revision is null or purchase.revision<>p_expected_revision then
      raise exception 'REVISION_CONFLICT' using errcode='40001';
    end if;
    if purchase.status not in('ordered','partially_received') then raise exception 'PURCHASE_NOT_RECEIVABLE' using errcode='23514'; end if;
    if not exists(select 1 from public.homecare_stock_cutovers where tenant_id=p_tenant_id) then
      raise exception 'STOCK_CUTOVER_REQUIRED' using errcode='23514'; end if;
    perform 1 from public.homecare_inventory_locations where tenant_id=p_tenant_id and id=p_payload->>'location_id'
      and deleted_at is null and not archived for share;
    if not found then raise exception 'LOCATION_NOT_ACTIVE' using errcode='23514'; end if;
    if p_payload->>'document_id' is not null then
      perform 1 from public.homecare_media where tenant_id=p_tenant_id and id=p_payload->>'document_id' and deleted_at is null
        and storage_path like p_tenant_id::text||'/purchase-documents/%' and metadata->>'contentType'='application/pdf' for share;
      if not found then raise exception 'INVALID_RECEIPT_DOCUMENT' using errcode='23514'; end if;
    end if;
    -- All material writers acquire locks in the same order, including maintenance.
    perform 1 from public.homecare_materials where tenant_id=p_tenant_id and id in(
      select i.material_id from public.homecare_purchase_order_items i where i.tenant_id=p_tenant_id and i.order_id=purchase.id
        and i.id in(select (l->>'item_id')::uuid from jsonb_array_elements(p_payload->'items') l)
    ) order by id for update;
    for line in select value from jsonb_array_elements(p_payload->'items') order by value->>'item_id' loop
      if jsonb_typeof(line) is distinct from 'object' or jsonb_typeof(line->'quantity') is distinct from 'number'
        or exists(select 1 from jsonb_object_keys(line) k where k not in('item_id','quantity')) then
        raise exception 'INVALID_OPERATIONS_COMMAND' using errcode='22023';
      end if;
      select * into item from public.homecare_purchase_order_items where tenant_id=p_tenant_id and id=(line->>'item_id')::uuid
        and order_id=purchase.id and deleted_at is null for update;
      if not found then raise exception 'PURCHASE_ITEM_NOT_IN_ORDER' using errcode='23514'; end if;
      if exists(select 1 from public.homecare_materials where tenant_id=p_tenant_id and id=item.material_id
        and coalesce(nullif(record_data->>'currency',''),currency,'SEK')<>purchase.currency) then
        raise exception 'PURCHASE_CURRENCY_MISMATCH' using errcode='23514'; end if;
      amount:=(line->>'quantity')::numeric;
      select coalesce(sum(quantity),0) into received from public.homecare_purchase_receipts where tenant_id=p_tenant_id and item_id=item.id;
      if amount is null or amount<=0 or amount::text in('NaN','Infinity','-Infinity') or amount<>round(amount,3) or received+amount>item.quantity then
        raise exception 'INVALID_RECEIPT_QUANTITY' using errcode='23514'; end if;
      receipt_id:=md5(p_mutation_id::text||':receipt:'||item.id::text)::uuid;
      insert into public.homecare_purchase_receipts(tenant_id,id,item_id,quantity,actor_user_id,note,document_id)
        values(p_tenant_id,receipt_id,item.id,amount,p_actor_id,p_payload->>'note',p_payload->>'document_id');
      perform public.homecare_stock_post(p_tenant_id,receipt_id,item.material_id,null,p_payload->>'location_id',amount,p_actor_id,
        p_payload->>'note',purchase.job_id,purchase.project_id,receipt_id,null,item.unit_price);
      update public.homecare_materials set purchase_price=item.unit_price,record_data=record_data-'purchasePrice'
        where tenant_id=p_tenant_id and id=item.material_id;
    end loop;
    update public.homecare_purchase_orders set status=case when not exists(
      select 1 from public.homecare_purchase_order_items i where i.tenant_id=p_tenant_id and i.order_id=purchase.id and i.deleted_at is null
        and i.quantity>(select coalesce(sum(r.quantity),0) from public.homecare_purchase_receipts r where r.tenant_id=p_tenant_id and r.item_id=i.id)
    ) then 'received' else 'partially_received' end where tenant_id=p_tenant_id and id=purchase.id returning to_jsonb(homecare_purchase_orders.*) into result_row;
    select jsonb_agg(public.homecare_operations_material_state(p_tenant_id,material_id)) into materials from (
      select distinct i.material_id from public.homecare_purchase_order_items i where i.tenant_id=p_tenant_id and i.order_id=purchase.id
        and i.id in(select (l->>'item_id')::uuid from jsonb_array_elements(p_payload->'items') l)
    ) changed;
    result:=jsonb_build_object('mutationId',p_mutation_id,'status','synced','record',result_row||jsonb_build_object('material_records',materials));
  exception when serialization_failure then
    result:=jsonb_build_object('mutationId',p_mutation_id,'status','conflict','record',current_row,'error','REVISION_CONFLICT');
  end;
  insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,expected_revision,request_payload,response_payload,applied_at)
    values(p_tenant_id,p_mutation_id,p_entity_type,p_entity_id,p_operation,result->>'status',p_expected_revision,p_payload,result,
      case when result->>'status'='synced' then now() else null end);
  return result;
end $$;
revoke all on function public.homecare_apply_purchase_receipt_batch(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.homecare_apply_purchase_receipt_batch(uuid,text,text,text,text,uuid,jsonb,bigint,uuid) to service_role;
commit;
