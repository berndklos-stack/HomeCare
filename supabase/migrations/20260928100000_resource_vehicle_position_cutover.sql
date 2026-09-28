-- Phase 3A: record-level resource and vehicle-position mutations.

alter table public.homecare_vehicle_positions
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

drop trigger if exists bump_revision on public.homecare_vehicle_positions;
create trigger bump_revision before update on public.homecare_vehicle_positions
for each row execute function public.homecare_bump_revision();

create index if not exists homecare_resources_tenant_live_idx
  on public.homecare_resources(tenant_id, updated_at desc)
  where deleted_at is null;

create index if not exists homecare_vehicle_positions_tenant_live_idx
  on public.homecare_vehicle_positions(tenant_id, updated_at desc)
  where deleted_at is null;

-- Preserve records that reached the legacy fallback while a relational mirror
-- write was unavailable. Existing relational rows, including tombstones, win.
with legacy_resources as (
  select state.tenant_id, item
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value') = 'array' then state.data->'value' else '[]'::jsonb end
  ) item
  where state.id = 'sync-section:resources'
)
insert into public.homecare_resources (
  id, tenant_id, type, build_year, name, identifier, status,
  responsible_person_id, location, notes, logbook_year,
  odometer_year_start, odometer_year_end, tracking, maintenance_items,
  deleted_logbook_entry_ids, archived, brand, current_odometer,
  current_odometer_date, default_driver_id, license_plate, logbook_active,
  model, odometer_history, odometer_last_confirmed,
  odometer_last_confirmed_at, odometer_last_confirmed_by,
  odometer_last_confirmed_photo, owner_company, private_use_allowed,
  registration_country, tax_country, standard_trips
)
select
  item->>'id', legacy.tenant_id,
  coalesce(nullif(item->>'type', ''), 'Fahrzeug'), nullif(item->>'buildYear', ''),
  coalesce(nullif(item->>'name', ''), 'Ressource'), nullif(item->>'identifier', ''),
  nullif(item->>'status', ''),
  case when exists (
    select 1 from public.homecare_personnel person
    where person.tenant_id = legacy.tenant_id and person.id = item->>'responsiblePersonId'
  ) then item->>'responsiblePersonId' end,
  nullif(item->>'location', ''), nullif(item->>'notes', ''), nullif(item->>'logbookYear', ''),
  public.homecare_text_to_numeric(item->>'odometerYearStart'),
  public.homecare_text_to_numeric(item->>'odometerYearEnd'),
  coalesce(item->'tracking', '{}'::jsonb), coalesce(item->'maintenanceItems', '[]'::jsonb),
  coalesce(item->'deletedLogbookEntryIds', '[]'::jsonb),
  case when item->>'archived' in ('true', 'false') then (item->>'archived')::boolean else false end,
  nullif(item->>'brand', ''), public.homecare_text_to_numeric(item->>'currentOdometer'),
  case when item->>'currentOdometerDate' ~ '^\d{4}-\d{2}-\d{2}$' then (item->>'currentOdometerDate')::date end,
  case when exists (
    select 1 from public.homecare_personnel person
    where person.tenant_id = legacy.tenant_id and person.id = item->>'defaultDriverId'
  ) then item->>'defaultDriverId' end,
  nullif(item->>'licensePlate', ''),
  case when item->>'logbookActive' in ('true', 'false') then (item->>'logbookActive')::boolean else true end,
  nullif(item->>'model', ''), coalesce(item->'odometerHistory', '[]'::jsonb),
  public.homecare_text_to_numeric(item->>'odometerLastConfirmed'),
  case when nullif(item->>'odometerLastConfirmedAt', '') is not null then (item->>'odometerLastConfirmedAt')::timestamptz end,
  case when exists (
    select 1 from public.homecare_personnel person
    where person.tenant_id = legacy.tenant_id and person.id = item->>'odometerLastConfirmedBy'
  ) then item->>'odometerLastConfirmedBy' end,
  item->'odometerLastConfirmedPhoto', nullif(item->>'ownerCompany', ''),
  case when item->>'privateUseAllowed' in ('true', 'false') then (item->>'privateUseAllowed')::boolean else true end,
  nullif(item->>'registrationCountry', ''), nullif(item->>'taxCountry', ''),
  coalesce(item->'standardTrips', '[]'::jsonb)
from legacy_resources legacy
where nullif(legacy.item->>'id', '') is not null
on conflict (id) do nothing;

with legacy_resource_media as (
  select state.tenant_id, resource.item->>'id' resource_id, media.item
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value') = 'array' then state.data->'value' else '[]'::jsonb end
  ) resource(item)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(resource.item->'media') = 'array' then resource.item->'media' else '[]'::jsonb end
  ) media(item)
  where state.id = 'sync-section:resources'
)
insert into public.homecare_media (
  id, tenant_id, owner_type, owner_id, kind, name, description,
  source, storage_path, preview_url, is_primary
)
select
  media.item->>'id', media.tenant_id, 'resource', media.resource_id,
  coalesce(nullif(media.item->>'type', ''), 'Dokument'),
  coalesce(nullif(media.item->>'name', ''), 'Datei'),
  nullif(media.item->>'description', ''), nullif(media.item->>'source', ''),
  nullif(media.item->>'storagePath', ''), nullif(media.item->>'previewUrl', ''),
  case when media.item->>'isPrimary' in ('true', 'false') then (media.item->>'isPrimary')::boolean else false end
from legacy_resource_media media
where nullif(media.item->>'id', '') is not null
  and exists (
    select 1 from public.homecare_resources resource
    where resource.tenant_id = media.tenant_id and resource.id = media.resource_id
  )
on conflict (id) do nothing;

with legacy_positions as (
  select state.tenant_id, position
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'positions') = 'array' then state.data->'positions' else '[]'::jsonb end
  ) position
  where state.id = 'vehicle-positions'
)
insert into public.homecare_vehicle_positions (
  tenant_id, resource_id, entry_id, status, source, trip_date, driver_id,
  address, coordinates, purpose, trip_type, visited, start_odometer
)
select
  position.tenant_id, position.position->>'resourceId', nullif(position.position->>'entryId', ''),
  coalesce(nullif(position.position->>'status', ''), 'active'), nullif(position.position->>'source', ''),
  case when position.position->>'tripDate' ~ '^\d{4}-\d{2}-\d{2}$' then (position.position->>'tripDate')::date end,
  case when exists (
    select 1 from public.homecare_personnel person
    where person.tenant_id = position.tenant_id and person.id = position.position->>'driverId'
  ) then position.position->>'driverId' end,
  nullif(position.position->>'address', ''), position.position->'coordinates',
  nullif(position.position->>'purpose', ''), nullif(position.position->>'tripType', ''),
  nullif(position.position->>'visited', ''),
  public.homecare_text_to_numeric(position.position->>'startOdometer')
from legacy_positions position
where nullif(position.position->>'resourceId', '') is not null
  and exists (
    select 1 from public.homecare_resources resource
    where resource.tenant_id = position.tenant_id
      and resource.id = position.position->>'resourceId'
      and resource.deleted_at is null
  )
on conflict (tenant_id, resource_id) do nothing;

alter table public.homecare_vehicle_positions
  drop constraint if exists homecare_vehicle_positions_deleted_not_active_ck;
alter table public.homecare_vehicle_positions
  add constraint homecare_vehicle_positions_deleted_not_active_ck
  check (deleted_at is null or status <> 'active') not valid;
alter table public.homecare_vehicle_positions
  validate constraint homecare_vehicle_positions_deleted_not_active_ck;

create or replace function public.homecare_prevent_active_resource_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and exists (
    select 1
    from public.homecare_vehicle_trips trip
    where trip.tenant_id = old.tenant_id
      and trip.resource_id = old.id
      and trip.status = 'laufend'
      and trip.deleted_at is null
  ) then
    raise exception 'Eine Ressource mit aktiver Fahrt kann nicht gelöscht werden.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_active_resource_delete on public.homecare_resources;
create trigger prevent_active_resource_delete
before update of deleted_at on public.homecare_resources
for each row execute function public.homecare_prevent_active_resource_delete();

create or replace function public.homecare_apply_resource_mutation(
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
  existing_resource public.homecare_resources%rowtype;
  result_resource public.homecare_resources%rowtype;
  existing_position public.homecare_vehicle_positions%rowtype;
  result_position public.homecare_vehicle_positions%rowtype;
  media_item jsonb;
  current_media_ids text[] := array[]::text[];
  mutation_response jsonb;
  tenant uuid := p_tenant_id;
begin
  if tenant is null then
    raise exception 'Mandant fehlt.' using errcode = '22023';
  end if;
  if p_entity_type not in ('resource', 'vehicle_position') then
    raise exception 'Nicht unterstützte Ressourcen-Mutation: %', p_entity_type using errcode = '22023';
  end if;
  if p_operation not in ('create', 'update', 'delete', 'restore') then
    raise exception 'Unbekannte Ressourcenoperation: %', p_operation using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(tenant::text || ':' || p_mutation_id::text));

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

  if p_entity_type = 'resource' then
    select * into existing_resource
    from public.homecare_resources
    where id = p_entity_id and tenant_id = tenant
    for update;

    if p_operation = 'create' then
      if found then
        mutation_response := jsonb_build_object(
          'error', 'Die Ressource existiert bereits.',
          'mutationId', p_mutation_id,
          'record', to_jsonb(existing_resource),
          'status', 'conflict'
        );
      else
        insert into public.homecare_resources (
          id, tenant_id, type, build_year, name, identifier, status,
          responsible_person_id, location, notes, logbook_year,
          odometer_year_start, odometer_year_end, tracking, maintenance_items,
          deleted_logbook_entry_ids, archived, brand, current_odometer,
          current_odometer_date, default_driver_id, license_plate, logbook_active,
          model, odometer_history, odometer_last_confirmed,
          odometer_last_confirmed_at, odometer_last_confirmed_by,
          odometer_last_confirmed_photo, owner_company, private_use_allowed,
          registration_country, tax_country, standard_trips, revision, deleted_at
        ) values (
          p_entity_id, tenant,
          coalesce(nullif(p_payload->>'type', ''), 'Fahrzeug'),
          nullif(p_payload->>'buildYear', ''),
          coalesce(nullif(p_payload->>'name', ''), 'Ressource'),
          nullif(p_payload->>'identifier', ''), nullif(p_payload->>'status', ''),
          nullif(p_payload->>'responsiblePersonId', ''), nullif(p_payload->>'location', ''),
          nullif(p_payload->>'notes', ''), nullif(p_payload->>'logbookYear', ''),
          public.homecare_text_to_numeric(p_payload->>'odometerYearStart'),
          public.homecare_text_to_numeric(p_payload->>'odometerYearEnd'),
          coalesce(p_payload->'tracking', '{}'::jsonb),
          coalesce(p_payload->'maintenanceItems', '[]'::jsonb),
          coalesce(p_payload->'deletedLogbookEntryIds', '[]'::jsonb),
          coalesce((p_payload->>'archived')::boolean, false),
          nullif(p_payload->>'brand', ''),
          public.homecare_text_to_numeric(p_payload->>'currentOdometer'),
          nullif(p_payload->>'currentOdometerDate', '')::date,
          nullif(p_payload->>'defaultDriverId', ''), nullif(p_payload->>'licensePlate', ''),
          coalesce((p_payload->>'logbookActive')::boolean, true), nullif(p_payload->>'model', ''),
          coalesce(p_payload->'odometerHistory', '[]'::jsonb),
          public.homecare_text_to_numeric(p_payload->>'odometerLastConfirmed'),
          nullif(p_payload->>'odometerLastConfirmedAt', '')::timestamptz,
          nullif(p_payload->>'odometerLastConfirmedBy', ''), p_payload->'odometerLastConfirmedPhoto',
          nullif(p_payload->>'ownerCompany', ''),
          coalesce((p_payload->>'privateUseAllowed')::boolean, true),
          nullif(p_payload->>'registrationCountry', ''), nullif(p_payload->>'taxCountry', ''),
          coalesce(p_payload->'standardTrips', '[]'::jsonb), 1, null
        ) returning * into result_resource;
      end if;
    elsif not found then
      mutation_response := jsonb_build_object(
        'error', 'Die Ressource existiert auf dem Server nicht mehr.',
        'mutationId', p_mutation_id,
        'status', 'conflict'
      );
    elsif p_expected_revision is not null and existing_resource.revision <> p_expected_revision then
      mutation_response := jsonb_build_object(
        'error', 'Die Ressource wurde auf einem anderen Gerät geändert.',
        'mutationId', p_mutation_id,
        'record', to_jsonb(existing_resource),
        'status', 'conflict'
      );
    elsif p_operation = 'delete' then
      if exists (
        select 1 from public.homecare_vehicle_trips
        where tenant_id = tenant and resource_id = p_entity_id
          and status = 'laufend' and deleted_at is null
      ) then
        mutation_response := jsonb_build_object(
          'error', 'Eine Ressource mit aktiver Fahrt kann nicht gelöscht werden.',
          'mutationId', p_mutation_id,
          'record', to_jsonb(existing_resource),
          'status', 'conflict'
        );
      else
        update public.homecare_resources
        set deleted_at = now(), revision = revision + 1
        where id = p_entity_id and tenant_id = tenant
        returning * into result_resource;
        update public.homecare_media
        set deleted_at = coalesce(deleted_at, now()), revision = revision + 1
        where owner_type = 'resource' and owner_id = p_entity_id
          and tenant_id = tenant and deleted_at is null;
        update public.homecare_vehicle_positions
        set deleted_at = coalesce(deleted_at, now()), status = 'canceled', revision = revision + 1
        where resource_id = p_entity_id and tenant_id = tenant and deleted_at is null;
      end if;
    elsif p_operation = 'restore' then
      update public.homecare_resources
      set deleted_at = null, revision = revision + 1
      where id = p_entity_id and tenant_id = tenant
      returning * into result_resource;
    else
      update public.homecare_resources resource
      set
        type = case when p_payload ? 'type' then coalesce(nullif(p_payload->>'type', ''), resource.type) else resource.type end,
        build_year = case when p_payload ? 'buildYear' then nullif(p_payload->>'buildYear', '') else resource.build_year end,
        name = case when p_payload ? 'name' then coalesce(nullif(p_payload->>'name', ''), resource.name) else resource.name end,
        identifier = case when p_payload ? 'identifier' then nullif(p_payload->>'identifier', '') else resource.identifier end,
        status = case when p_payload ? 'status' then nullif(p_payload->>'status', '') else resource.status end,
        responsible_person_id = case when p_payload ? 'responsiblePersonId' then nullif(p_payload->>'responsiblePersonId', '') else resource.responsible_person_id end,
        location = case when p_payload ? 'location' then nullif(p_payload->>'location', '') else resource.location end,
        notes = case when p_payload ? 'notes' then nullif(p_payload->>'notes', '') else resource.notes end,
        logbook_year = case when p_payload ? 'logbookYear' then nullif(p_payload->>'logbookYear', '') else resource.logbook_year end,
        odometer_year_start = case when p_payload ? 'odometerYearStart' then public.homecare_text_to_numeric(p_payload->>'odometerYearStart') else resource.odometer_year_start end,
        odometer_year_end = case when p_payload ? 'odometerYearEnd' then public.homecare_text_to_numeric(p_payload->>'odometerYearEnd') else resource.odometer_year_end end,
        tracking = case when p_payload ? 'tracking' then coalesce(p_payload->'tracking', '{}'::jsonb) else resource.tracking end,
        maintenance_items = case when p_payload ? 'maintenanceItems' then coalesce(p_payload->'maintenanceItems', '[]'::jsonb) else resource.maintenance_items end,
        deleted_logbook_entry_ids = case when p_payload ? 'deletedLogbookEntryIds' then coalesce(p_payload->'deletedLogbookEntryIds', '[]'::jsonb) else resource.deleted_logbook_entry_ids end,
        archived = case when p_payload ? 'archived' then (p_payload->>'archived')::boolean else resource.archived end,
        brand = case when p_payload ? 'brand' then nullif(p_payload->>'brand', '') else resource.brand end,
        current_odometer = case when p_payload ? 'currentOdometer' then public.homecare_text_to_numeric(p_payload->>'currentOdometer') else resource.current_odometer end,
        current_odometer_date = case when p_payload ? 'currentOdometerDate' then nullif(p_payload->>'currentOdometerDate', '')::date else resource.current_odometer_date end,
        default_driver_id = case when p_payload ? 'defaultDriverId' then nullif(p_payload->>'defaultDriverId', '') else resource.default_driver_id end,
        license_plate = case when p_payload ? 'licensePlate' then nullif(p_payload->>'licensePlate', '') else resource.license_plate end,
        logbook_active = case when p_payload ? 'logbookActive' then (p_payload->>'logbookActive')::boolean else resource.logbook_active end,
        model = case when p_payload ? 'model' then nullif(p_payload->>'model', '') else resource.model end,
        odometer_history = case when p_payload ? 'odometerHistory' then coalesce(p_payload->'odometerHistory', '[]'::jsonb) else resource.odometer_history end,
        odometer_last_confirmed = case when p_payload ? 'odometerLastConfirmed' then public.homecare_text_to_numeric(p_payload->>'odometerLastConfirmed') else resource.odometer_last_confirmed end,
        odometer_last_confirmed_at = case when p_payload ? 'odometerLastConfirmedAt' then nullif(p_payload->>'odometerLastConfirmedAt', '')::timestamptz else resource.odometer_last_confirmed_at end,
        odometer_last_confirmed_by = case when p_payload ? 'odometerLastConfirmedBy' then nullif(p_payload->>'odometerLastConfirmedBy', '') else resource.odometer_last_confirmed_by end,
        odometer_last_confirmed_photo = case when p_payload ? 'odometerLastConfirmedPhoto' then p_payload->'odometerLastConfirmedPhoto' else resource.odometer_last_confirmed_photo end,
        owner_company = case when p_payload ? 'ownerCompany' then nullif(p_payload->>'ownerCompany', '') else resource.owner_company end,
        private_use_allowed = case when p_payload ? 'privateUseAllowed' then (p_payload->>'privateUseAllowed')::boolean else resource.private_use_allowed end,
        registration_country = case when p_payload ? 'registrationCountry' then nullif(p_payload->>'registrationCountry', '') else resource.registration_country end,
        tax_country = case when p_payload ? 'taxCountry' then nullif(p_payload->>'taxCountry', '') else resource.tax_country end,
        standard_trips = case when p_payload ? 'standardTrips' then coalesce(p_payload->'standardTrips', '[]'::jsonb) else resource.standard_trips end,
        revision = resource.revision + 1
      where id = p_entity_id and tenant_id = tenant
      returning * into result_resource;
    end if;

    if result_resource.id is not null and p_operation in ('create', 'update') and jsonb_typeof(p_payload->'media') = 'array' then
      for media_item in select value from jsonb_array_elements(p_payload->'media')
      loop
        if nullif(media_item->>'id', '') is null then
          continue;
        end if;
        current_media_ids := array_append(current_media_ids, media_item->>'id');
        insert into public.homecare_media (
          id, tenant_id, owner_type, owner_id, kind, name, description,
          source, storage_path, preview_url, is_primary, deleted_at
        ) values (
          media_item->>'id', tenant, 'resource', p_entity_id,
          coalesce(nullif(media_item->>'type', ''), 'Dokument'),
          coalesce(nullif(media_item->>'name', ''), 'Datei'),
          nullif(media_item->>'description', ''), nullif(media_item->>'source', ''),
          nullif(media_item->>'storagePath', ''), nullif(media_item->>'previewUrl', ''),
          coalesce((media_item->>'isPrimary')::boolean, false), null
        )
        on conflict (id) do update set
          owner_type = excluded.owner_type,
          owner_id = excluded.owner_id,
          kind = excluded.kind,
          name = excluded.name,
          description = excluded.description,
          source = excluded.source,
          storage_path = excluded.storage_path,
          preview_url = excluded.preview_url,
          is_primary = excluded.is_primary,
          deleted_at = null
        where public.homecare_media.tenant_id = tenant;
      end loop;

      update public.homecare_media
      set deleted_at = now(), revision = revision + 1
      where tenant_id = tenant and owner_type = 'resource' and owner_id = p_entity_id
        and deleted_at is null and not (id = any(current_media_ids));
    end if;

    if mutation_response is null and result_resource.id is not null then
      mutation_response := jsonb_build_object(
        'mutationId', p_mutation_id,
        'record', to_jsonb(result_resource),
        'status', 'synced'
      );
    end if;
  else
    select * into existing_position
    from public.homecare_vehicle_positions
    where resource_id = p_resource_id and tenant_id = tenant
    for update;

    if p_operation = 'create' then
      if found then
        mutation_response := jsonb_build_object(
          'error', 'Die Fahrzeugposition existiert bereits.',
          'mutationId', p_mutation_id,
          'record', to_jsonb(existing_position),
          'status', 'conflict'
        );
      elsif not exists (
        select 1 from public.homecare_resources
        where id = p_resource_id and tenant_id = tenant and deleted_at is null
      ) then
        mutation_response := jsonb_build_object(
          'error', 'Das Fahrzeug existiert auf dem Server nicht.',
          'mutationId', p_mutation_id,
          'status', 'conflict'
        );
      else
        insert into public.homecare_vehicle_positions (
          tenant_id, resource_id, entry_id, status, source, trip_date, driver_id,
          address, coordinates, purpose, trip_type, visited, start_odometer,
          revision, deleted_at
        ) values (
          tenant, p_resource_id, nullif(p_payload->>'entryId', ''),
          coalesce(nullif(p_payload->>'status', ''), 'active'),
          nullif(p_payload->>'source', ''), nullif(p_payload->>'tripDate', '')::date,
          nullif(p_payload->>'driverId', ''), nullif(p_payload->>'address', ''),
          p_payload->'coordinates', nullif(p_payload->>'purpose', ''),
          nullif(p_payload->>'tripType', ''), nullif(p_payload->>'visited', ''),
          public.homecare_text_to_numeric(p_payload->>'startOdometer'), 1, null
        ) returning * into result_position;
      end if;
    elsif not found then
      mutation_response := jsonb_build_object(
        'error', 'Die Fahrzeugposition existiert auf dem Server nicht mehr.',
        'mutationId', p_mutation_id,
        'status', 'conflict'
      );
    elsif p_expected_revision is not null and existing_position.revision <> p_expected_revision then
      mutation_response := jsonb_build_object(
        'error', 'Die Fahrzeugposition wurde auf einem anderen Gerät geändert.',
        'mutationId', p_mutation_id,
        'record', to_jsonb(existing_position),
        'status', 'conflict'
      );
    elsif p_operation = 'delete' then
      update public.homecare_vehicle_positions
      set deleted_at = now(), status = 'canceled', revision = revision + 1
      where resource_id = p_resource_id and tenant_id = tenant
      returning * into result_position;
    elsif p_operation = 'restore' then
      update public.homecare_vehicle_positions
      set deleted_at = null, revision = revision + 1
      where resource_id = p_resource_id and tenant_id = tenant
      returning * into result_position;
    else
      update public.homecare_vehicle_positions position
      set
        entry_id = case when p_payload ? 'entryId' then nullif(p_payload->>'entryId', '') else position.entry_id end,
        status = case when p_payload ? 'status' then coalesce(nullif(p_payload->>'status', ''), position.status) else position.status end,
        source = case when p_payload ? 'source' then nullif(p_payload->>'source', '') else position.source end,
        trip_date = case when p_payload ? 'tripDate' then nullif(p_payload->>'tripDate', '')::date else position.trip_date end,
        driver_id = case when p_payload ? 'driverId' then nullif(p_payload->>'driverId', '') else position.driver_id end,
        address = case when p_payload ? 'address' then nullif(p_payload->>'address', '') else position.address end,
        coordinates = case when p_payload ? 'coordinates' then p_payload->'coordinates' else position.coordinates end,
        purpose = case when p_payload ? 'purpose' then nullif(p_payload->>'purpose', '') else position.purpose end,
        trip_type = case when p_payload ? 'tripType' then nullif(p_payload->>'tripType', '') else position.trip_type end,
        visited = case when p_payload ? 'visited' then nullif(p_payload->>'visited', '') else position.visited end,
        start_odometer = case when p_payload ? 'startOdometer' then public.homecare_text_to_numeric(p_payload->>'startOdometer') else position.start_odometer end,
        deleted_at = null,
        revision = position.revision + 1
      where resource_id = p_resource_id and tenant_id = tenant
      returning * into result_position;
    end if;

    if mutation_response is null and result_position.resource_id is not null then
      mutation_response := jsonb_build_object(
        'mutationId', p_mutation_id,
        'record', to_jsonb(result_position),
        'status', 'synced'
      );
    end if;
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

revoke all on function public.homecare_apply_resource_mutation(uuid, text, text, text, text, uuid, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.homecare_apply_resource_mutation(uuid, text, text, text, text, uuid, jsonb, bigint) to service_role;

revoke all on function public.homecare_prevent_active_resource_delete() from public, anon, authenticated;

-- The former whole-resource writer remains defined for rollback inspection,
-- but no runtime role may execute it after the write cutover.
revoke all on function public.homecare_save_resources_snapshot(jsonb) from public, anon, authenticated, service_role;
