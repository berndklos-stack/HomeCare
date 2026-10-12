begin;

create table public.homecare_trip_validation_rechecks (
  tenant_id uuid not null references public.homecare_tenants(id),
  mutation_id uuid not null,
  entity_id text not null,
  resource_id text not null,
  original_response jsonb not null,
  result_response jsonb,
  rechecked_at timestamptz not null default now(),
  primary key (tenant_id, mutation_id),
  foreign key (tenant_id, mutation_id) references public.homecare_sync_mutations(tenant_id, mutation_id)
);
alter table public.homecare_trip_validation_rechecks enable row level security;
revoke all on public.homecare_trip_validation_rechecks from public, anon, authenticated;
grant select, insert, update on public.homecare_trip_validation_rechecks to service_role;

create or replace function public.homecare_apply_trip_sync_mutation(
  p_mutation_id uuid, p_entity_type text, p_entity_id text, p_operation text,
  p_resource_id text, p_tenant_id uuid, p_payload jsonb default '{}'::jsonb,
  p_expected_revision bigint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prior public.homecare_sync_mutations%rowtype;
  response jsonb;
begin
  if p_tenant_id is null or p_entity_type <> 'vehicle_trip' then
    raise exception 'INVALID_TRIP_MUTATION' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_mutation_id::text));
  select * into prior from public.homecare_sync_mutations
    where tenant_id = p_tenant_id and mutation_id = p_mutation_id for update;
  if found and (prior.entity_type <> p_entity_type or prior.entity_id <> p_entity_id
    or prior.operation <> p_operation or prior.request_payload is distinct from p_payload
    or prior.expected_revision is distinct from p_expected_revision) then
    return jsonb_build_object('mutationId', p_mutation_id, 'status', 'conflict',
      'error', 'Die urspruengliche Uebertragung wurde veraendert. Lokale Daten bleiben erhalten.');
  end if;
  if prior.status = 'conflict' and p_operation = 'create'
    and prior.response_payload->>'error' ~ '^Start-Kilometerstand [0-9.]+ liegt unter dem Serverstand [0-9.]+[.]$'
    and exists(select 1 from public.homecare_resources where tenant_id = p_tenant_id and id = p_resource_id and deleted_at is null)
    and not exists(select 1 from public.homecare_trip_validation_rechecks where tenant_id = p_tenant_id and mutation_id = p_mutation_id)
    and not exists(select 1 from public.homecare_vehicle_trips where tenant_id = p_tenant_id and id = p_entity_id)
  then
    insert into public.homecare_trip_validation_rechecks(tenant_id, mutation_id, entity_id, resource_id, original_response)
      values(p_tenant_id, p_mutation_id, p_entity_id, p_resource_id, prior.response_payload);
    update public.homecare_sync_mutations set status = 'syncing', updated_at = now()
      where tenant_id = p_tenant_id and mutation_id = p_mutation_id;
  end if;
  response := public.homecare_apply_sync_mutation(p_mutation_id, p_entity_type, p_entity_id,
    p_operation, p_resource_id, p_tenant_id, p_payload, p_expected_revision);
  update public.homecare_trip_validation_rechecks set result_response = response
    where tenant_id = p_tenant_id and mutation_id = p_mutation_id and result_response is null;
  return response;
end $$;
revoke all on function public.homecare_apply_trip_sync_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.homecare_apply_trip_sync_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;

alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_trip_recheck;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
  select public.homecare_relational_backup_tables_before_trip_recheck() || array['homecare_trip_validation_rechecks']::text[];
$$;
revoke all on function public.homecare_relational_backup_tables() from public, anon, authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;

commit;
