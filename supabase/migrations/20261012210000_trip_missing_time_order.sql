-- Missing journey times must not be interpreted as midnight.
-- Existing trips are not rewritten; genuine mileage overlaps remain conflicts.
begin;

create or replace function public.homecare_trip_neighbor_error(
  p_tenant uuid, p_resource text, p_id text, p_date date, p_started_at timestamptz, p_start numeric, p_end numeric
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_previous_end numeric;
  v_next_start numeric;
  v_mileage_order boolean;
  v_candidate_key numeric;
begin
  if p_start is null or p_start < 0 then return 'Start-Kilometerstand fehlt oder ist ungueltig.'; end if;
  if p_end is not null and p_end < p_start then return 'End-Kilometerstand darf nicht kleiner als Start-Kilometerstand sein.'; end if;
  if p_date is null then return 'Fahrtdatum fehlt.'; end if;

  v_mileage_order := p_started_at is null
    or (p_started_at at time zone 'Europe/Stockholm')::date <> p_date
    or exists(select 1 from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and t.trip_date=p_date and (t.started_at is null
          or (t.started_at at time zone 'Europe/Stockholm')::date <> t.trip_date));
  v_candidate_key := case when v_mileage_order then p_start
    else extract(epoch from public.homecare_trip_order_time(p_date,p_started_at)) end;

  if v_mileage_order and exists(select 1 from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and t.trip_date=p_date and t.start_odometer < coalesce(p_end,p_start)
      and p_start < coalesce(t.end_odometer,t.start_odometer))
  then return 'Die Kilometerstaende dieser Fahrt ueberschneiden sich mit einer anderen Fahrt am selben Tag.'; end if;

  if v_mileage_order then
    select max(t.end_odometer) into v_previous_end from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and (t.trip_date<p_date or (t.trip_date=p_date and t.start_odometer<=p_start));
    select min(t.start_odometer) into v_next_start from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and (t.trip_date>p_date or (t.trip_date=p_date and t.start_odometer>p_start));
  else
  select t.end_odometer into v_previous_end from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and (t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
        else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id)
        < (p_date,v_candidate_key,p_id)
    order by t.trip_date desc, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
      else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end desc, t.id desc limit 1;
  select t.start_odometer into v_next_start from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and (t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
        else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id)
        > (p_date,v_candidate_key,p_id)
    order by t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
      else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id limit 1;
  end if;
  if v_previous_end is not null and p_start < v_previous_end then
    return format('Start-Kilometerstand liegt unter dem Endstand der vorherigen Fahrt (%s km).',v_previous_end);
  end if;
  if v_next_start is not null and coalesce(p_end,p_start) > v_next_start then
    return format('Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (%s km).',v_next_start);
  end if;
  return null;
end;
$$;

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
    and (
      prior.response_payload->>'error' ~ '^Start-Kilometerstand [0-9.]+ liegt unter dem Serverstand [0-9.]+[.]$'
      or (nullif(p_payload->>'startedAt','') is null
        and prior.response_payload->>'error' ~ '^Kilometerstand liegt ueber dem Startstand der naechsten Fahrt [(][0-9.]+ km[)][.]$')
    )
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
  v_neighbor_error text;
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
    perform pg_advisory_xact_lock(hashtext(tenant::text || ':' || p_resource_id));
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
        v_start_odometer := public.homecare_text_to_numeric(p_payload->>'startOdometer');
        v_end_odometer := public.homecare_text_to_numeric(p_payload->>'endOdometer');
        if v_start_odometer is null then
          raise exception 'Start-Kilometerstand fehlt.' using errcode = '22023';
        end if;
        v_neighbor_error := public.homecare_trip_neighbor_error(tenant, p_resource_id, p_entity_id,
          coalesce(nullif(p_payload->>'date', '')::date, current_date),
          nullif(p_payload->>'startedAt', '')::timestamptz, v_start_odometer, v_end_odometer);
        if v_neighbor_error is not null then
          mutation_response := jsonb_build_object('error', v_neighbor_error,
            'mutationId', p_mutation_id, 'status', 'conflict');
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
              nullif(p_payload->>'startedAt', '')::timestamptz,
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
        v_neighbor_error := public.homecare_trip_neighbor_error(tenant, existing_trip.resource_id, p_entity_id,
          case when p_payload ? 'date' then nullif(p_payload->>'date', '')::date else existing_trip.trip_date end,
          case when p_payload ? 'startedAt' then nullif(p_payload->>'startedAt', '')::timestamptz else existing_trip.started_at end,
          v_start_odometer, v_end_odometer);
        if v_neighbor_error is not null then
          mutation_response := jsonb_build_object(
            'error', v_neighbor_error,
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
                current_odometer = case when
                  (current_odometer is null or current_odometer <= result_trip.end_odometer)
                  and not exists (select 1 from public.homecare_vehicle_trips newer
                    where newer.tenant_id = tenant and newer.resource_id = result_trip.resource_id
                      and newer.deleted_at is null and newer.status = 'abgeschlossen'
                      and (newer.trip_date, public.homecare_trip_order_time(newer.trip_date, newer.started_at), newer.id)
                        > (result_trip.trip_date, public.homecare_trip_order_time(result_trip.trip_date, result_trip.started_at), result_trip.id))
                  then result_trip.end_odometer else current_odometer end,
                current_odometer_date = case when
                  (current_odometer is null or current_odometer <= result_trip.end_odometer)
                  and not exists (select 1 from public.homecare_vehicle_trips newer
                    where newer.tenant_id = tenant and newer.resource_id = result_trip.resource_id
                      and newer.deleted_at is null and newer.status = 'abgeschlossen'
                      and (newer.trip_date, public.homecare_trip_order_time(newer.trip_date, newer.started_at), newer.id)
                        > (result_trip.trip_date, public.homecare_trip_order_time(result_trip.trip_date, result_trip.started_at), result_trip.id))
                  then result_trip.trip_date else current_odometer_date end,
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

commit;

