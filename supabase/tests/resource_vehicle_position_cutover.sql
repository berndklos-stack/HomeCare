-- Run after 20260928100000_resource_vehicle_position_cutover.sql in a disposable database.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants (id, slug, name)
values
  ('50000000-0000-0000-0000-000000000001', 'resource-cutover-a', 'Resource cutover A'),
  ('50000000-0000-0000-0000-000000000002', 'resource-cutover-b', 'Resource cutover B')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name;

create temporary table resource_results (key text primary key, result jsonb not null);

insert into resource_results values (
  'create',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000001', 'resource', 'RES-CUTOVER-A', 'create',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"type":"Fahrzeug","name":"Cutover vehicle","currentOdometer":"100","media":[{"id":"MED-CUTOVER-A","type":"Bild","name":"vehicle.jpg","storagePath":"tenant-a/vehicle.jpg"}]}'::jsonb,
    null
  )
);

insert into resource_results values (
  'retry',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000001', 'resource', 'RES-CUTOVER-A', 'create',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001', '{}'::jsonb, null
  )
);

do $$
begin
  if (select result->>'status' from resource_results where key = 'create') <> 'synced'
    or (select result from resource_results where key = 'create') <> (select result from resource_results where key = 'retry')
    or (select count(*) from public.homecare_resources where id = 'RES-CUTOVER-A') <> 1
    or (select count(*) from public.homecare_sync_mutations where tenant_id = '50000000-0000-0000-0000-000000000001' and mutation_id = '51000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'RESOURCE_CREATE_OR_IDEMPOTENCY_FAILED';
  end if;
  if not exists (
    select 1 from public.homecare_media
    where id = 'MED-CUTOVER-A' and tenant_id = '50000000-0000-0000-0000-000000000001' and deleted_at is null
  ) then
    raise exception 'RESOURCE_MEDIA_CREATE_FAILED';
  end if;
end;
$$;

insert into resource_results values (
  'update',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000002', 'resource', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"name":"Cutover vehicle updated","media":[]}'::jsonb, 1
  )
);

insert into resource_results values (
  'stale',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000003', 'resource', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"name":"Must not win"}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from resource_results where key = 'update') <> 'synced'
    or (select revision from public.homecare_resources where id = 'RES-CUTOVER-A') <> 2
    or (select name from public.homecare_resources where id = 'RES-CUTOVER-A') <> 'Cutover vehicle updated' then
    raise exception 'RESOURCE_UPDATE_FAILED';
  end if;
  if (select result->>'status' from resource_results where key = 'stale') <> 'conflict'
    or (select name from public.homecare_resources where id = 'RES-CUTOVER-A') = 'Must not win' then
    raise exception 'RESOURCE_STALE_REVISION_NOT_REJECTED';
  end if;
  if not exists (select 1 from public.homecare_media where id = 'MED-CUTOVER-A' and deleted_at is not null) then
    raise exception 'RESOURCE_MEDIA_TOMBSTONE_FAILED';
  end if;
end;
$$;

insert into resource_results values (
  'position-create',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000004', 'vehicle_position', 'RES-CUTOVER-A', 'create',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"entryId":"TRIP-CUTOVER-A","status":"active","source":"Start","tripDate":"2026-09-28","address":"Start","startOdometer":"100"}'::jsonb,
    null
  )
);

insert into resource_results values (
  'position-update',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000005', 'vehicle_position', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"source":"Zwischenziel","address":"Waypoint"}'::jsonb, 1
  )
);

insert into resource_results values (
  'position-stale',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000006', 'vehicle_position', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"address":"Must not win"}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from resource_results where key = 'position-create') <> 'synced'
    or (select result->>'status' from resource_results where key = 'position-update') <> 'synced'
    or (select revision from public.homecare_vehicle_positions where resource_id = 'RES-CUTOVER-A') <> 2
    or (select address from public.homecare_vehicle_positions where resource_id = 'RES-CUTOVER-A') <> 'Waypoint' then
    raise exception 'VEHICLE_POSITION_CREATE_OR_UPDATE_FAILED';
  end if;
  if (select result->>'status' from resource_results where key = 'position-stale') <> 'conflict' then
    raise exception 'VEHICLE_POSITION_STALE_REVISION_NOT_REJECTED';
  end if;
end;
$$;

insert into public.homecare_resources (id, tenant_id, type, name, current_odometer)
values ('RES-CUTOVER-B', '50000000-0000-0000-0000-000000000002', 'Fahrzeug', 'Tenant B vehicle', 200);

insert into resource_results values (
  'cross-tenant-update',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000007', 'resource', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000002',
    '{"name":"Cross tenant overwrite"}'::jsonb, 2
  )
);

insert into resource_results values (
  'cross-tenant-position-update',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000013', 'vehicle_position', 'RES-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000002',
    '{"address":"Cross tenant position overwrite"}'::jsonb, 2
  )
);

insert into resource_results values (
  'trip-start',
  public.homecare_apply_sync_mutation(
    '51000000-0000-0000-0000-000000000008', 'vehicle_trip', 'TRIP-CUTOVER-A', 'create',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-28","status":"laufend","startOdometer":"100"}'::jsonb, null
  )
);

insert into resource_results values (
  'delete-active-resource',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000009', 'resource', 'RES-CUTOVER-A', 'delete',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001', '{}'::jsonb, 2
  )
);

insert into resource_results values (
  'trip-end',
  public.homecare_apply_sync_mutation(
    '51000000-0000-0000-0000-000000000010', 'vehicle_trip', 'TRIP-CUTOVER-A', 'update',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001',
    '{"status":"abgeschlossen","endedAt":"2026-09-28T12:00:00Z","endOdometer":"110"}'::jsonb, 1
  )
);

insert into resource_results values (
  'delete-resource',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000011', 'resource', 'RES-CUTOVER-A', 'delete',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001', '{}'::jsonb, 3
  )
);

do $$
begin
  if (select result->>'status' from resource_results where key = 'cross-tenant-update') <> 'conflict'
    or (select name from public.homecare_resources where id = 'RES-CUTOVER-A') = 'Cross tenant overwrite' then
    raise exception 'RESOURCE_TENANT_ISOLATION_FAILED';
  end if;
  if (select result->>'status' from resource_results where key = 'cross-tenant-position-update') <> 'conflict'
    or (select address from public.homecare_vehicle_positions
        where tenant_id = '50000000-0000-0000-0000-000000000001'
          and resource_id = 'RES-CUTOVER-A') = 'Cross tenant position overwrite' then
    raise exception 'VEHICLE_POSITION_TENANT_ISOLATION_FAILED';
  end if;
  if (select result->>'status' from resource_results where key = 'trip-start') <> 'synced'
    or (select result->>'status' from resource_results where key = 'delete-active-resource') <> 'conflict'
    or (select result->>'status' from resource_results where key = 'trip-end') <> 'synced' then
    raise exception 'ACTIVE_TRIP_COMPATIBILITY_FAILED';
  end if;
  if (select result->>'status' from resource_results where key = 'delete-resource') <> 'synced'
    or not exists (select 1 from public.homecare_resources where id = 'RES-CUTOVER-A' and deleted_at is not null and revision = 4)
    or exists (select 1 from public.homecare_vehicle_positions where resource_id = 'RES-CUTOVER-A' and deleted_at is null) then
    raise exception 'RESOURCE_DELETE_PROPAGATION_FAILED';
  end if;
end;
$$;

insert into resource_results values (
  'restore-resource',
  public.homecare_apply_resource_mutation(
    '51000000-0000-0000-0000-000000000012', 'resource', 'RES-CUTOVER-A', 'restore',
    'RES-CUTOVER-A', '50000000-0000-0000-0000-000000000001', '{}'::jsonb, 4
  )
);

do $$
begin
  if (select result->>'status' from resource_results where key = 'restore-resource') <> 'synced'
    or not exists (select 1 from public.homecare_resources where id = 'RES-CUTOVER-A' and deleted_at is null and revision = 5)
    or exists (select 1 from public.homecare_vehicle_positions where resource_id = 'RES-CUTOVER-A' and deleted_at is null) then
    raise exception 'RESOURCE_RESTORE_OR_CHILD_TOMBSTONE_FAILED';
  end if;
end;
$$;

rollback;
