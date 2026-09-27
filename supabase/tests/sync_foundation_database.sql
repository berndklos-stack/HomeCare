-- Run after the Sync Foundation and Auth/Tenant/RLS migrations in a disposable database.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants (id, slug, name)
values
  ('40000000-0000-0000-0000-000000000001', 'sync-db-a', 'Sync DB A'),
  ('40000000-0000-0000-0000-000000000002', 'sync-db-b', 'Sync DB B');

insert into public.homecare_resources (id, tenant_id, type, name, current_odometer)
values
  ('SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001', 'Fahrzeug', 'Sync vehicle A', 100),
  ('SYNC-VEHICLE-B', '40000000-0000-0000-0000-000000000002', 'Fahrzeug', 'Sync vehicle B', 200);

create temporary table sync_results (key text primary key, result jsonb not null);

insert into sync_results values (
  'create-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000001', 'vehicle_trip', 'SYNC-TRIP-A', 'create',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-27","status":"laufend","startOdometer":"100"}'::jsonb, null
  )
);

insert into sync_results values (
  'retry-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000001', 'vehicle_trip', 'SYNC-TRIP-A', 'create',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-27","status":"laufend","startOdometer":"100"}'::jsonb, null
  )
);

do $$
begin
  if (select result->>'status' from sync_results where key = 'create-a') <> 'synced'
    or (select result from sync_results where key = 'create-a')
      <> (select result from sync_results where key = 'retry-a') then
    raise exception 'SYNC_IDEMPOTENT_RETRY_FAILED';
  end if;
  if (select count(*) from public.homecare_vehicle_trips where id = 'SYNC-TRIP-A') <> 1
    or (select count(*) from public.homecare_sync_mutations
        where tenant_id = '40000000-0000-0000-0000-000000000001'
          and mutation_id = '41000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'SYNC_IDEMPOTENT_JOURNAL_DUPLICATED';
  end if;
end;
$$;

insert into sync_results values (
  'update-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000002', 'vehicle_trip', 'SYNC-TRIP-A', 'update',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"status":"abgeschlossen","endedAt":"2026-09-27T12:00:00Z","endOdometer":"120"}'::jsonb, 1
  )
);

insert into sync_results values (
  'stale-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000003', 'vehicle_trip', 'SYNC-TRIP-A', 'update',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"notes":"must not win"}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from sync_results where key = 'update-a') <> 'synced'
    or (select revision from public.homecare_vehicle_trips where id = 'SYNC-TRIP-A') <> 2 then
    raise exception 'SYNC_REVISION_UPDATE_FAILED';
  end if;
  if (select result->>'status' from sync_results where key = 'stale-a') <> 'conflict'
    or (select notes from public.homecare_vehicle_trips where id = 'SYNC-TRIP-A') is not null then
    raise exception 'SYNC_STALE_REVISION_WAS_NOT_REJECTED';
  end if;
end;
$$;

insert into sync_results values (
  'backwards-rejected',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000004', 'vehicle_trip', 'SYNC-TRIP-LOW', 'create',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-28","status":"laufend","startOdometer":"110"}'::jsonb, null
  )
);

insert into sync_results values (
  'backwards-authorised',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000005', 'vehicle_trip', 'SYNC-TRIP-LOW', 'create',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-28","status":"laufend","startOdometer":"110","allowOdometerCorrection":true,"correctionReason":"Verified odometer replacement"}'::jsonb, null
  )
);

do $$
begin
  if (select result->>'status' from sync_results where key = 'backwards-rejected') <> 'conflict'
    or exists (select 1 from public.homecare_vehicle_trips where id = 'SYNC-TRIP-LOW' and revision <> 1) then
    raise exception 'SYNC_BACKWARDS_ODOMETER_WAS_NOT_REJECTED';
  end if;
  if (select result->>'status' from sync_results where key = 'backwards-authorised') <> 'synced'
    or not exists (select 1 from public.homecare_vehicle_trips where id = 'SYNC-TRIP-LOW' and start_odometer = 110) then
    raise exception 'SYNC_AUTHORISED_ODOMETER_CORRECTION_FAILED';
  end if;
end;
$$;

insert into sync_results values (
  'delete-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000006', 'vehicle_trip', 'SYNC-TRIP-LOW', 'delete',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001', '{}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from sync_results where key = 'delete-a') <> 'synced'
    or not exists (select 1 from public.homecare_vehicle_trips where id = 'SYNC-TRIP-LOW' and deleted_at is not null and revision = 2)
    or exists (select 1 from public.homecare_vehicle_trips where id = 'SYNC-TRIP-LOW' and deleted_at is null) then
    raise exception 'SYNC_SOFT_DELETE_FAILED';
  end if;
end;
$$;

insert into sync_results values (
  'restore-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000007', 'vehicle_trip', 'SYNC-TRIP-LOW', 'restore',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001', '{}'::jsonb, 2
  )
);

insert into sync_results values (
  'end-restored-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000008', 'vehicle_trip', 'SYNC-TRIP-LOW', 'update',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"status":"abgeschlossen","endedAt":"2026-09-28T12:00:00Z","endOdometer":"115"}'::jsonb, 3
  )
);

insert into sync_results values (
  'subsequent-start-a',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000009', 'vehicle_trip', 'SYNC-TRIP-NEXT', 'create',
    'SYNC-VEHICLE-A', '40000000-0000-0000-0000-000000000001',
    '{"date":"2026-09-29","status":"laufend","startOdometer":"115"}'::jsonb, null
  )
);

-- Reusing a mutation UUID in another tenant is valid and creates a separate journal row.
insert into sync_results values (
  'same-mutation-b',
  public.homecare_apply_sync_mutation(
    '41000000-0000-0000-0000-000000000001', 'vehicle_trip', 'SYNC-TRIP-B', 'create',
    'SYNC-VEHICLE-B', '40000000-0000-0000-0000-000000000002',
    '{"date":"2026-09-27","status":"laufend","startOdometer":"200"}'::jsonb, null
  )
);

do $$
begin
  if (select result->>'status' from sync_results where key = 'restore-a') <> 'synced'
    or (select result->>'status' from sync_results where key = 'end-restored-a') <> 'synced'
    or (select result->>'status' from sync_results where key = 'subsequent-start-a') <> 'synced' then
    raise exception 'SYNC_RESTORE_END_OR_SUBSEQUENT_START_FAILED';
  end if;
  if (select count(*) from public.homecare_sync_mutations
      where mutation_id = '41000000-0000-0000-0000-000000000001') <> 2
    or (select result->>'status' from sync_results where key = 'same-mutation-b') <> 'synced' then
    raise exception 'SYNC_TENANT_SCOPED_MUTATION_ID_FAILED';
  end if;
  if (select count(*) from public.homecare_vehicle_trips
      where status = 'laufend' and deleted_at is null and tenant_id = '40000000-0000-0000-0000-000000000001') <> 1
    or (select count(*) from public.homecare_vehicle_trips
      where status = 'laufend' and deleted_at is null and tenant_id = '40000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'SYNC_ACTIVE_TRIP_TENANT_ISOLATION_FAILED';
  end if;
  if (select count(*) from public.homecare_vehicle_positions
      where tenant_id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'SYNC_VEHICLE_POSITION_TENANT_ISOLATION_FAILED';
  end if;
end;
$$;

rollback;
