begin;

create table public.homecare_customer_service_conditions (
  id text primary key,
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  customer_id text not null,
  service_id text not null,
  unit_price numeric(14,4),
  currency text,
  revision bigint not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references public.homecare_customers(tenant_id, id) on delete restrict,
  foreign key (tenant_id, service_id) references public.homecare_services(tenant_id, id) on delete restrict,
  constraint customer_service_price_valid check (
    (unit_price is null and currency is null) or
    (unit_price is not null and unit_price >= 0 and unit_price <= 100000000 and currency is not null and currency ~ '^[A-Z]{3}$')
  )
);
create unique index customer_service_one_live on public.homecare_customer_service_conditions(tenant_id, customer_id, service_id) where deleted_at is null;
create index customer_service_customer on public.homecare_customer_service_conditions(tenant_id, customer_id, updated_at);
create index customer_service_service on public.homecare_customer_service_conditions(tenant_id, service_id);
create trigger set_updated_at before update on public.homecare_customer_service_conditions for each row execute function public.set_homecare_updated_at();
create trigger bump_revision before update on public.homecare_customer_service_conditions for each row execute function public.homecare_bump_revision();
alter table public.homecare_customer_service_conditions enable row level security;
create policy tenant_member_read on public.homecare_customer_service_conditions for select to authenticated
  using (tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_customer_service_conditions from public,anon,authenticated;
grant select on public.homecare_customer_service_conditions to authenticated;
grant all on public.homecare_customer_service_conditions to service_role;

create function public.homecare_apply_customer_service_condition(
  p_mutation_id uuid, p_entity_type text, p_entity_id text, p_operation text,
  p_resource_id text, p_tenant_id uuid, p_payload jsonb default '{}'::jsonb,
  p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  prior public.homecare_sync_mutations%rowtype;
  condition public.homecare_customer_service_conditions%rowtype;
  response jsonb;
  price numeric;
  money text;
begin
  if p_tenant_id is null or p_entity_type <> 'customer_service_condition' or p_operation not in ('create','update','delete')
    or nullif(p_entity_id,'') is null or nullif(p_resource_id,'') is null then raise exception 'INVALID_CUSTOMER_CONDITION' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text||':'||p_mutation_id::text));
  select * into prior from public.homecare_sync_mutations where tenant_id=p_tenant_id and mutation_id=p_mutation_id;
  if found and prior.status in ('synced','conflict') then return prior.response_payload; end if;
  perform 1 from public.homecare_customers where tenant_id=p_tenant_id and id=p_resource_id and deleted_at is null for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='23503'; end if;
  if p_operation <> 'delete' then
    if coalesce(p_payload->>'unitPrice','') <> '' and coalesce(p_payload->>'unitPrice','') !~ '^\d+([.,]\d{1,4})?$' then raise exception 'INVALID_CUSTOMER_PRICE' using errcode='22023'; end if;
    price := nullif(replace(p_payload->>'unitPrice',',','.'),'')::numeric;
    money := nullif(p_payload->>'currency','');
    if (price is null) <> (money is null) or price < 0 or price > 100000000 or (money is not null and money !~ '^[A-Z]{3}$') then raise exception 'INVALID_CUSTOMER_PRICE' using errcode='22023'; end if;
    perform 1 from public.homecare_services where tenant_id=p_tenant_id and id=p_payload->>'serviceId' and deleted_at is null
      and (p_operation <> 'create' or not coalesce(archived,false));
    if not found then raise exception 'SERVICE_NOT_FOUND' using errcode='23503'; end if;
  end if;
  select * into condition from public.homecare_customer_service_conditions where tenant_id=p_tenant_id and id=p_entity_id for update;
  if p_operation='create' then
    if found or exists(select 1 from public.homecare_customer_service_conditions where tenant_id=p_tenant_id and customer_id=p_resource_id and service_id=p_payload->>'serviceId' and deleted_at is null) then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(condition),'error','Die Leistungszuordnung existiert bereits.');
    else
      insert into public.homecare_customer_service_conditions(id,tenant_id,customer_id,service_id,unit_price,currency)
      values(p_entity_id,p_tenant_id,p_resource_id,p_payload->>'serviceId',price,money) returning * into condition;
    end if;
  elsif condition.id is null or condition.customer_id <> p_resource_id then
    raise exception 'CUSTOMER_CONDITION_NOT_FOUND' using errcode='23503';
  elsif p_expected_revision is null or condition.revision <> p_expected_revision or condition.deleted_at is not null then
    response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(condition),'error','Die Kundenkondition wurde zwischenzeitlich geändert.');
  elsif p_operation='delete' then
    update public.homecare_customer_service_conditions set deleted_at=now(),revision=revision+1 where tenant_id=p_tenant_id and id=p_entity_id returning * into condition;
  else
    if condition.service_id <> p_payload->>'serviceId' then raise exception 'IMMUTABLE_SERVICE_ID' using errcode='22023'; end if;
    update public.homecare_customer_service_conditions set unit_price=price,currency=money,revision=revision+1 where tenant_id=p_tenant_id and id=p_entity_id returning * into condition;
  end if;
  response := coalesce(response,jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(condition)));
  insert into public.homecare_sync_mutations(mutation_id,tenant_id,entity_type,entity_id,operation,status,expected_revision,request_payload,response_payload,error,applied_at)
  values(p_mutation_id,p_tenant_id,p_entity_type,p_entity_id,p_operation,response->>'status',p_expected_revision,p_payload,response,response->>'error',case when response->>'status'='synced' then now() end);
  return response;
end $$;
revoke all on function public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;

-- Include the new native records in the existing tenant backup/restore registry.
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_customer_conditions;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_customer_conditions() || array['homecare_customer_service_conditions'];
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
