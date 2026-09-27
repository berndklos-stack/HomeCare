-- Phase 1/2: idempotent record mutations and authoritative vehicle trips.

alter table public.homecare_vehicle_trips
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.homecare_resources
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.homecare_media
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.homecare_vehicle_positions drop constraint if exists homecare_vehicle_positions_pkey;
alter table public.homecare_vehicle_positions add primary key (tenant_id, resource_id);

create or replace function public.homecare_bump_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.revision = old.revision then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists bump_revision on public.homecare_vehicle_trips;
create trigger bump_revision before update on public.homecare_vehicle_trips
for each row execute function public.homecare_bump_revision();

drop trigger if exists bump_revision on public.homecare_resources;
create trigger bump_revision before update on public.homecare_resources
for each row execute function public.homecare_bump_revision();

drop trigger if exists bump_revision on public.homecare_media;
create trigger bump_revision before update on public.homecare_media
for each row execute function public.homecare_bump_revision();

-- Preserve all historic rows, but close duplicate legacy active trips before
-- installing the invariant. The newest active trip remains authoritative.
with ranked_active_trips as (
  select
    id,
    row_number() over (
      partition by tenant_id, resource_id
      order by coalesce(started_at, updated_at, created_at) desc, id desc
    ) as position
  from public.homecare_vehicle_trips
  where status = 'laufend' and deleted_at is null
)
update public.homecare_vehicle_trips trip
set
  ended_at = coalesce(trip.ended_at, now()),
  notes = concat_ws(E'\n', nullif(trip.notes, ''), 'Automatisch beendet: doppelte aktive Fahrt vor Sync-Migration.'),
  revision = trip.revision + 1,
  status = 'abgeschlossen'
from ranked_active_trips ranked
where trip.id = ranked.id and ranked.position > 1;

create unique index if not exists homecare_vehicle_trips_one_active_per_resource_idx
  on public.homecare_vehicle_trips(tenant_id, resource_id)
  where status = 'laufend' and deleted_at is null;

create table if not exists public.homecare_sync_mutations (
  mutation_id uuid not null,
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references public.homecare_tenants(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  operation text not null,
  status text not null check (status in ('pending', 'syncing', 'synced', 'failed', 'conflict')),
  expected_revision bigint,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  primary key (tenant_id, mutation_id)
);

create index if not exists homecare_sync_mutations_entity_idx
  on public.homecare_sync_mutations(tenant_id, entity_type, entity_id, created_at desc);

alter table public.homecare_sync_mutations enable row level security;

create or replace function public.homecare_apply_sync_mutation(
  p_mutation_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_resource_id text,
  p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_mutation public.homecare_sync_mutations%rowtype;
  existing_trip public.homecare_vehicle_trips%rowtype;
  result_trip public.homecare_vehicle_trips%rowtype;
  existing_media public.homecare_media%rowtype;
  result_media public.homecare_media%rowtype;
  mutation_response jsonb;
  v_authoritative_odometer numeric;
  v_start_odometer numeric;
  v_end_odometer numeric;
  tenant uuid := p_tenant_id;
begin
  if tenant is null then
    raise exception 'Mandant fehlt.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_mutation_id::text));

  select * into existing_mutation
  from public.homecare_sync_mutations
  where mutation_id = p_mutation_id and tenant_id = tenant;

  if found and existing_mutation.status in ('synced', 'conflict') then
    return existing_mutation.response_payload;
  end if;

  insert into public.homecare_sync_mutations (
    mutation_id, tenant_id, entity_type, entity_id, operation, status,
    expected_revision, request_payload
  ) values (
    p_mutation_id, tenant, p_entity_type, p_entity_id, p_operation, 'syncing',
    p_expected_revision, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (tenant_id, mutation_id) do update set
    status = 'syncing',
    updated_at = now();

  if p_entity_type = 'vehicle_trip' then
    select * into existing_trip
    from public.homecare_vehicle_trips
    where id = p_entity_id and tenant_id = tenant
    for update;

    if p_operation = 'create' then
      if found then
        mutation_response := jsonb_build_object(
          'mutationId', p_mutation_id,
          'record', to_jsonb(existing_trip),
          'status', 'synced'
        );
      else
        select trip.end_odometer into v_authoritative_odometer
        from public.homecare_vehicle_trips trip
        where trip.resource_id = p_resource_id
          and trip.tenant_id = tenant
          and trip.status = 'abgeschlossen'
          and trip.deleted_at is null
          and trip.end_odometer is not null
        order by coalesce(trip.ended_at, trip.updated_at, trip.created_at) desc, trip.id desc
        limit 1;

        if v_authoritative_odometer is null then
          select current_odometer into v_authoritative_odometer
          from public.homecare_resources
          where id = p_resource_id and tenant_id = tenant;
        end if;

        v_start_odometer := public.homecare_text_to_numeric(p_payload->>'startOdometer');
        if v_start_odometer is null then
          raise exception 'Start-Kilometerstand fehlt.' using errcode = '22023';
        end if;
        if v_authoritative_odometer is not null
          and v_start_odometer < v_authoritative_odometer
          and not (
            coalesce((p_payload->>'allowOdometerCorrection')::boolean, false)
            and nullif(trim(p_payload->>'correctionReason'), '') is not null
          ) then
          mutation_response := jsonb_build_object(
            'error', format('Start-Kilometerstand %s liegt unter dem Serverstand %s.', v_start_odometer, v_authoritative_odometer),
            'mutationId', p_mutation_id,
            'record', jsonb_build_object('authoritativeOdometer', v_authoritative_odometer),
            'status', 'conflict'
          );
        else
          begin
            insert into public.homecare_vehicle_trips (
              id, resource_id, trip_date, driver_id, status, started_at, ended_at,
              trip_type, trip_category, rule_country, rule_version, rule_title,
              start_address, start_address_resolved, end_address, end_address_resolved,
              start_coordinates, end_coordinates, waypoints, start_odometer,
              end_odometer, kilometers, purpose, visited, fuel_or_charge,
              fuel_receipt_photo, odometer_photos, validation_warnings, audit_log,
              notes, revision, deleted_at, tenant_id
            ) values (
              p_entity_id,
              p_resource_id,
              coalesce(nullif(p_payload->>'date', '')::date, current_date),
              nullif(p_payload->>'driverId', ''),
              coalesce(nullif(p_payload->>'status', ''), 'laufend'),
              coalesce(nullif(p_payload->>'startedAt', '')::timestamptz, now()),
              nullif(p_payload->>'endedAt', '')::timestamptz,
              coalesce(nullif(p_payload->>'tripType', ''), 'Dienstfahrt'),
              nullif(p_payload->>'tripCategory', ''),
              nullif(p_payload->>'ruleCountry', ''),
              nullif(p_payload->>'ruleVersion', ''),
              nullif(p_payload->>'ruleTitle', ''),
              nullif(p_payload->>'startAddress', ''),
              nullif(p_payload->>'startAddressResolved', ''),
              nullif(p_payload->>'endAddress', ''),
              nullif(p_payload->>'endAddressResolved', ''),
              p_payload->'startCoordinates',
              p_payload->'endCoordinates',
              coalesce(p_payload->'waypoints', '[]'::jsonb),
              v_start_odometer,
              public.homecare_text_to_numeric(p_payload->>'endOdometer'),
              public.homecare_text_to_numeric(p_payload->>'kilometers'),
              nullif(p_payload->>'purpose', ''),
              nullif(p_payload->>'visited', ''),
              nullif(p_payload->>'fuelOrCharge', ''),
              p_payload->'fuelReceiptPhoto',
              coalesce(p_payload->'odometerPhotos', '[]'::jsonb),
              coalesce(p_payload->'validationWarnings', '[]'::jsonb),
              coalesce(p_payload->'auditLog', '[]'::jsonb),
              nullif(p_payload->>'notes', ''),
              1,
              null,
              tenant
            ) returning * into result_trip;

            if result_trip.status = 'laufend' then
              insert into public.homecare_vehicle_positions (
                resource_id, entry_id, status, source, trip_date, driver_id,
                address, coordinates, purpose, trip_type, visited,
                start_odometer, tenant_id
              ) values (
                result_trip.resource_id, result_trip.id, 'active', 'Start',
                result_trip.trip_date, result_trip.driver_id,
                result_trip.start_address, result_trip.start_coordinates,
                result_trip.purpose, result_trip.trip_type, result_trip.visited,
                result_trip.start_odometer, tenant
              )
              on conflict (tenant_id, resource_id) do update set
                entry_id = excluded.entry_id,
                status = excluded.status,
                source = excluded.source,
                trip_date = excluded.trip_date,
                driver_id = excluded.driver_id,
                address = excluded.address,
                coordinates = excluded.coordinates,
                purpose = excluded.purpose,
                trip_type = excluded.trip_type,
                visited = excluded.visited,
                start_odometer = excluded.start_odometer,
                updated_at = now();
            end if;

            mutation_response := jsonb_build_object(
              'mutationId', p_mutation_id,
              'record', to_jsonb(result_trip),
              'status', 'synced'
            );
          exception when unique_violation then
            select * into result_trip
            from public.homecare_vehicle_trips
            where resource_id = p_resource_id and tenant_id = tenant and status = 'laufend' and deleted_at is null
            order by started_at desc nulls last
            limit 1;
            mutation_response := jsonb_build_object(
              'error', 'Für dieses Fahrzeug läuft bereits eine andere Fahrt.',
              'mutationId', p_mutation_id,
              'record', to_jsonb(result_trip),
              'status', 'conflict'
            );
          end;
        end if;
      end if;
    elsif p_operation in ('update', 'delete', 'restore') then
      if not found then
        mutation_response := jsonb_build_object(
          'error', 'Die Fahrt existiert auf dem Server nicht mehr.',
          'mutationId', p_mutation_id,
          'status', 'conflict'
        );
      elsif p_expected_revision is not null and existing_trip.revision <> p_expected_revision then
        mutation_response := jsonb_build_object(
          'error', 'Die Fahrt wurde auf einem anderen Gerät geändert.',
          'mutationId', p_mutation_id,
          'record', to_jsonb(existing_trip),
          'status', 'conflict'
        );
      elsif p_operation = 'delete' then
        update public.homecare_vehicle_trips
        set deleted_at = now(), revision = revision + 1
        where id = p_entity_id and tenant_id = tenant
        returning * into result_trip;
        update public.homecare_vehicle_positions
        set status = 'canceled', updated_at = now()
        where resource_id = result_trip.resource_id and entry_id = result_trip.id and tenant_id = tenant;
        mutation_response := jsonb_build_object('mutationId', p_mutation_id, 'record', to_jsonb(result_trip), 'status', 'synced');
      elsif p_operation = 'restore' then
        begin
          update public.homecare_vehicle_trips
          set deleted_at = null, revision = revision + 1
          where id = p_entity_id and tenant_id = tenant
          returning * into result_trip;
          mutation_response := jsonb_build_object('mutationId', p_mutation_id, 'record', to_jsonb(result_trip), 'status', 'synced');
        exception when unique_violation then
          mutation_response := jsonb_build_object(
            'error', 'Die Fahrt kann nicht wiederhergestellt werden, weil bereits eine Fahrt läuft.',
            'mutationId', p_mutation_id,
            'status', 'conflict'
          );
        end;
      else
        v_end_odometer := case when p_payload ? 'endOdometer'
          then public.homecare_text_to_numeric(p_payload->>'endOdometer')
          else existing_trip.end_odometer end;
        v_start_odometer := case when p_payload ? 'startOdometer'
          then public.homecare_text_to_numeric(p_payload->>'startOdometer')
          else existing_trip.start_odometer end;
        if v_end_odometer is not null and v_start_odometer is not null and v_end_odometer < v_start_odometer then
          mutation_response := jsonb_build_object(
            'error', 'End-Kilometerstand darf nicht kleiner als Start-Kilometerstand sein.',
            'mutationId', p_mutation_id,
            'record', to_jsonb(existing_trip),
            'status', 'conflict'
          );
        else
          update public.homecare_vehicle_trips trip
          set
            trip_date = case when p_payload ? 'date' then nullif(p_payload->>'date', '')::date else trip.trip_date end,
            driver_id = case when p_payload ? 'driverId' then nullif(p_payload->>'driverId', '') else trip.driver_id end,
            status = case when p_payload ? 'status' then p_payload->>'status' else trip.status end,
            started_at = case when p_payload ? 'startedAt' then nullif(p_payload->>'startedAt', '')::timestamptz else trip.started_at end,
            ended_at = case when p_payload ? 'endedAt' then nullif(p_payload->>'endedAt', '')::timestamptz else trip.ended_at end,
            trip_type = case when p_payload ? 'tripType' then p_payload->>'tripType' else trip.trip_type end,
            trip_category = case when p_payload ? 'tripCategory' then nullif(p_payload->>'tripCategory', '') else trip.trip_category end,
            start_address = case when p_payload ? 'startAddress' then nullif(p_payload->>'startAddress', '') else trip.start_address end,
            start_address_resolved = case when p_payload ? 'startAddressResolved' then nullif(p_payload->>'startAddressResolved', '') else trip.start_address_resolved end,
            end_address = case when p_payload ? 'endAddress' then nullif(p_payload->>'endAddress', '') else trip.end_address end,
            end_address_resolved = case when p_payload ? 'endAddressResolved' then nullif(p_payload->>'endAddressResolved', '') else trip.end_address_resolved end,
            start_coordinates = case when p_payload ? 'startCoordinates' then p_payload->'startCoordinates' else trip.start_coordinates end,
            end_coordinates = case when p_payload ? 'endCoordinates' then p_payload->'endCoordinates' else trip.end_coordinates end,
            waypoints = case when p_payload ? 'waypoints' then p_payload->'waypoints' else trip.waypoints end,
            start_odometer = v_start_odometer,
            end_odometer = v_end_odometer,
            kilometers = case when p_payload ? 'kilometers' then public.homecare_text_to_numeric(p_payload->>'kilometers') else trip.kilometers end,
            purpose = case when p_payload ? 'purpose' then nullif(p_payload->>'purpose', '') else trip.purpose end,
            visited = case when p_payload ? 'visited' then nullif(p_payload->>'visited', '') else trip.visited end,
            fuel_or_charge = case when p_payload ? 'fuelOrCharge' then nullif(p_payload->>'fuelOrCharge', '') else trip.fuel_or_charge end,
            fuel_receipt_photo = case when p_payload ? 'fuelReceiptPhoto' then p_payload->'fuelReceiptPhoto' else trip.fuel_receipt_photo end,
            odometer_photos = case when p_payload ? 'odometerPhotos' then p_payload->'odometerPhotos' else trip.odometer_photos end,
            validation_warnings = case when p_payload ? 'validationWarnings' then p_payload->'validationWarnings' else trip.validation_warnings end,
            audit_log = case when p_payload ? 'auditLog' then p_payload->'auditLog' else trip.audit_log end,
            notes = case when p_payload ? 'notes' then nullif(p_payload->>'notes', '') else trip.notes end,
            revision = trip.revision + 1
          where id = p_entity_id and tenant_id = tenant
          returning * into result_trip;

          if result_trip.status = 'abgeschlossen' then
            if result_trip.end_odometer is not null then
              update public.homecare_resources
              set
                current_odometer = result_trip.end_odometer,
                current_odometer_date = result_trip.trip_date,
                revision = revision + 1
              where id = result_trip.resource_id and tenant_id = tenant;
            end if;
            update public.homecare_vehicle_positions
            set
              address = result_trip.end_address,
              coordinates = result_trip.end_coordinates,
              source = 'Ziel',
              status = 'completed',
              updated_at = now()
            where resource_id = result_trip.resource_id and entry_id = result_trip.id and tenant_id = tenant;
          end if;
          mutation_response := jsonb_build_object('mutationId', p_mutation_id, 'record', to_jsonb(result_trip), 'status', 'synced');
        end if;
      end if;
    else
      raise exception 'Unbekannte Fahrtenoperation: %', p_operation using errcode = '22023';
    end if;
  elsif p_entity_type = 'vehicle_media' and p_operation in ('delete', 'restore') then
    select * into existing_media from public.homecare_media where id = p_entity_id and tenant_id = tenant for update;
    if not found then
      mutation_response := jsonb_build_object('error', 'Die Mediendatei existiert auf dem Server nicht mehr.', 'mutationId', p_mutation_id, 'status', 'conflict');
    elsif p_expected_revision is not null and existing_media.revision <> p_expected_revision then
      mutation_response := jsonb_build_object('error', 'Die Mediendatei wurde auf einem anderen Gerät geändert.', 'mutationId', p_mutation_id, 'record', to_jsonb(existing_media), 'status', 'conflict');
    else
      update public.homecare_media
      set deleted_at = case when p_operation = 'delete' then now() else null end,
          revision = revision + 1
      where id = p_entity_id and tenant_id = tenant
      returning * into result_media;
      mutation_response := jsonb_build_object('mutationId', p_mutation_id, 'record', to_jsonb(result_media), 'status', 'synced');
    end if;
  else
    raise exception 'Nicht unterstützte Sync-Mutation: % / %', p_entity_type, p_operation using errcode = '22023';
  end if;

  update public.homecare_sync_mutations
  set
    applied_at = case when mutation_response->>'status' = 'synced' then now() else null end,
    error = mutation_response->>'error',
    response_payload = mutation_response,
    status = mutation_response->>'status',
    updated_at = now()
  where mutation_id = p_mutation_id and tenant_id = tenant;

  return mutation_response;
end;
$$;

revoke all on function public.homecare_apply_sync_mutation(uuid, text, text, text, text, uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.homecare_apply_sync_mutation(uuid, text, text, text, text, uuid, jsonb, bigint) to service_role;
