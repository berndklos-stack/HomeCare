create or replace function public.homecare_text_to_numeric(value text)
returns numeric
language sql
immutable
as $$
  select case
    when nullif(trim(replace(coalesce(value, ''), ',', '.')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then nullif(trim(replace(coalesce(value, ''), ',', '.')), '')::numeric
    else null
  end;
$$;

create or replace function public.homecare_resources_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'type', r.type,
      'buildYear', r.build_year,
      'name', r.name,
      'identifier', coalesce(r.identifier, ''),
      'status', coalesce(r.status, ''),
      'responsiblePersonId', coalesce(r.responsible_person_id, ''),
      'location', coalesce(r.location, ''),
      'notes', coalesce(r.notes, ''),
      'logbookYear', coalesce(r.logbook_year, ''),
      'odometerYearStart', case when r.odometer_year_start is null then '' else r.odometer_year_start::text end,
      'odometerYearEnd', case when r.odometer_year_end is null then '' else r.odometer_year_end::text end,
      'tracking', r.tracking,
      'maintenanceItems', r.maintenance_items,
      'deletedLogbookEntryIds', r.deleted_logbook_entry_ids,
      'archived', r.archived,
      'media', '[]'::jsonb,
      'logbook', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'date', t.trip_date::text,
            'driverId', coalesce(t.driver_id, ''),
            'status', t.status,
            'startedAt', t.started_at,
            'endedAt', t.ended_at,
            'tripType', t.trip_type,
            'startAddress', coalesce(t.start_address, ''),
            'endAddress', coalesce(t.end_address, ''),
            'startCoordinates', t.start_coordinates,
            'endCoordinates', t.end_coordinates,
            'waypoints', t.waypoints,
            'startOdometer', case when t.start_odometer is null then '' else t.start_odometer::text end,
            'endOdometer', case when t.end_odometer is null then '' else t.end_odometer::text end,
            'kilometers', case when t.kilometers is null then '' else t.kilometers::text end,
            'purpose', coalesce(t.purpose, ''),
            'visited', coalesce(t.visited, ''),
            'fuelOrCharge', coalesce(t.fuel_or_charge, ''),
            'fuelReceiptPhoto', t.fuel_receipt_photo,
            'odometerPhotos', t.odometer_photos,
            'notes', coalesce(t.notes, '')
          )
          order by t.trip_date, t.id
        )
        from public.homecare_vehicle_trips t
        where t.resource_id = r.id
      ), '[]'::jsonb)
    )
    order by r.name
  ), '[]'::jsonb)
  from public.homecare_resources r;
$$;

create or replace function public.homecare_save_resources_snapshot(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resource_item jsonb;
  trip_item jsonb;
  resource_id text;
begin
  if jsonb_typeof(payload) <> 'array' then
    return;
  end if;

  for resource_item in select value from jsonb_array_elements(payload)
  loop
    resource_id := resource_item->>'id';
    if nullif(resource_id, '') is null then
      continue;
    end if;

    insert into public.homecare_resources (
      id, type, build_year, name, identifier, status, responsible_person_id,
      location, notes, logbook_year, odometer_year_start, odometer_year_end,
      tracking, maintenance_items, deleted_logbook_entry_ids, archived
    )
    values (
      resource_id,
      coalesce(nullif(resource_item->>'type', ''), 'Fahrzeug'),
      nullif(resource_item->>'buildYear', ''),
      coalesce(nullif(resource_item->>'name', ''), 'Ressource'),
      nullif(resource_item->>'identifier', ''),
      nullif(resource_item->>'status', ''),
      nullif(resource_item->>'responsiblePersonId', ''),
      nullif(resource_item->>'location', ''),
      nullif(resource_item->>'notes', ''),
      nullif(resource_item->>'logbookYear', ''),
      public.homecare_text_to_numeric(resource_item->>'odometerYearStart'),
      public.homecare_text_to_numeric(resource_item->>'odometerYearEnd'),
      coalesce(resource_item->'tracking', '{}'::jsonb),
      coalesce(resource_item->'maintenanceItems', '[]'::jsonb),
      coalesce(resource_item->'deletedLogbookEntryIds', '[]'::jsonb),
      coalesce((resource_item->>'archived')::boolean, false)
    )
    on conflict (id) do update set
      type = excluded.type,
      build_year = excluded.build_year,
      name = excluded.name,
      identifier = excluded.identifier,
      status = excluded.status,
      responsible_person_id = excluded.responsible_person_id,
      location = excluded.location,
      notes = excluded.notes,
      logbook_year = excluded.logbook_year,
      odometer_year_start = excluded.odometer_year_start,
      odometer_year_end = excluded.odometer_year_end,
      tracking = excluded.tracking,
      maintenance_items = excluded.maintenance_items,
      deleted_logbook_entry_ids = excluded.deleted_logbook_entry_ids,
      archived = excluded.archived;

    if jsonb_typeof(resource_item->'logbook') = 'array' then
      for trip_item in select value from jsonb_array_elements(resource_item->'logbook')
      loop
        if nullif(trip_item->>'id', '') is null then
          continue;
        end if;

        insert into public.homecare_vehicle_trips (
          id, resource_id, trip_date, driver_id, status, started_at, ended_at,
          trip_type, start_address, end_address, start_coordinates, end_coordinates,
          waypoints, start_odometer, end_odometer, kilometers, purpose, visited,
          fuel_or_charge, fuel_receipt_photo, odometer_photos, notes
        )
        values (
          trip_item->>'id',
          resource_id,
          coalesce(nullif(trip_item->>'date', '')::date, current_date),
          nullif(trip_item->>'driverId', ''),
          coalesce(nullif(trip_item->>'status', ''), 'abgeschlossen'),
          nullif(trip_item->>'startedAt', '')::timestamptz,
          nullif(trip_item->>'endedAt', '')::timestamptz,
          coalesce(nullif(trip_item->>'tripType', ''), 'Dienstfahrt'),
          nullif(trip_item->>'startAddress', ''),
          nullif(trip_item->>'endAddress', ''),
          trip_item->'startCoordinates',
          trip_item->'endCoordinates',
          coalesce(trip_item->'waypoints', '[]'::jsonb),
          public.homecare_text_to_numeric(trip_item->>'startOdometer'),
          public.homecare_text_to_numeric(trip_item->>'endOdometer'),
          public.homecare_text_to_numeric(trip_item->>'kilometers'),
          nullif(trip_item->>'purpose', ''),
          nullif(trip_item->>'visited', ''),
          nullif(trip_item->>'fuelOrCharge', ''),
          trip_item->'fuelReceiptPhoto',
          coalesce(trip_item->'odometerPhotos', '[]'::jsonb),
          nullif(trip_item->>'notes', '')
        )
        on conflict (id) do update set
          resource_id = excluded.resource_id,
          trip_date = excluded.trip_date,
          driver_id = excluded.driver_id,
          status = excluded.status,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          trip_type = excluded.trip_type,
          start_address = excluded.start_address,
          end_address = excluded.end_address,
          start_coordinates = excluded.start_coordinates,
          end_coordinates = excluded.end_coordinates,
          waypoints = excluded.waypoints,
          start_odometer = excluded.start_odometer,
          end_odometer = excluded.end_odometer,
          kilometers = excluded.kilometers,
          purpose = excluded.purpose,
          visited = excluded.visited,
          fuel_or_charge = excluded.fuel_or_charge,
          fuel_receipt_photo = excluded.fuel_receipt_photo,
          odometer_photos = excluded.odometer_photos,
          notes = excluded.notes;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.homecare_resources_snapshot() from public;
revoke all on function public.homecare_save_resources_snapshot(jsonb) from public;
grant execute on function public.homecare_resources_snapshot() to service_role;
grant execute on function public.homecare_save_resources_snapshot(jsonb) to service_role;
