begin;
insert into public.homecare_resources(tenant_id,id,name,type,current_odometer,current_odometer_date)
values('00000000-0000-0000-0000-000000000001','chronology-car','Chronology test','Fahrzeug',203200,'2026-10-03');
do $$
declare
  tenant uuid := '00000000-0000-0000-0000-000000000001';
  mutation uuid := gen_random_uuid();
  response jsonb;
  original_previous jsonb;
  original_next jsonb;
begin
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-B','create','chronology-car',tenant,
    '{"date":"2026-10-03","startedAt":"2026-10-03T08:00:00Z","status":"abgeschlossen","startOdometer":"203132","endOdometer":"203200"}');
  if response->>'status' <> 'synced' then raise exception 'LATEST_REJECTED: %', response; end if;
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-A','create','chronology-car',tenant,
    '{"date":"2026-10-01","startedAt":"2026-10-01T07:00:00Z","status":"abgeschlossen","startOdometer":"202900","endOdometer":"202947"}');
  if response->>'status' <> 'synced' then raise exception 'HISTORICAL_REJECTED: %', response; end if;
  select to_jsonb(t) into original_previous from public.homecare_vehicle_trips t where id='CHRONO-A';
  select to_jsonb(t) into original_next from public.homecare_vehicle_trips t where id='CHRONO-B';
  response := public.homecare_apply_sync_mutation(mutation,'vehicle_trip','CHRONO-C','create','chronology-car',tenant,
    '{"date":"2026-10-02","startedAt":"2026-10-02T10:00:00Z","status":"abgeschlossen","startOdometer":"202947","endOdometer":"203000"}');
  if response->>'status' <> 'synced' then raise exception 'GAP_IS_NOT_CONFLICT: %', response; end if;
  perform public.homecare_apply_sync_mutation(mutation,'vehicle_trip','CHRONO-C','create','chronology-car',tenant,
    '{"date":"2026-10-02","startedAt":"2026-10-02T10:00:00Z","status":"abgeschlossen","startOdometer":"202947","endOdometer":"203000"}');
  if (select count(*) from public.homecare_vehicle_trips where id='CHRONO-C') <> 1 then raise exception 'RETRY_DUPLICATED'; end if;
  if original_previous is distinct from (select to_jsonb(t) from public.homecare_vehicle_trips t where id='CHRONO-A')
    or original_next is distinct from (select to_jsonb(t) from public.homecare_vehicle_trips t where id='CHRONO-B') then raise exception 'NEIGHBORS_CHANGED'; end if;
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-C','update','chronology-car',tenant,
    '{"purpose":"Historical clarification"}',1);
  if response->>'status' <> 'synced' then raise exception 'HISTORICAL_UPDATE_REJECTED: %', response; end if;
  if (select current_odometer from public.homecare_resources where id='chronology-car') <> 203200
    or (select current_odometer_date from public.homecare_resources where id='chronology-car') <> date '2026-10-03' then raise exception 'VEHICLE_STAND_MOVED_BACKWARD'; end if;
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-D','create','chronology-car',tenant,
    '{"date":"2026-10-02","startedAt":"2026-10-02T13:00:00Z","status":"abgeschlossen","startOdometer":"202950","endOdometer":"203150"}');
  if response->>'status' <> 'conflict' then raise exception 'OVERLAP_ACCEPTED'; end if;
  if exists(select 1 from public.homecare_vehicle_trips where id='CHRONO-D') then raise exception 'CONFLICT_WRITTEN'; end if;
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-C','update','chronology-car',tenant,'{"purpose":"stale"}',1);
  if response->>'status' <> 'conflict' then raise exception 'STALE_REVISION_ACCEPTED'; end if;
  response := public.homecare_apply_sync_mutation(gen_random_uuid(),'vehicle_trip','CHRONO-E','create','chronology-car',tenant,
    '{"date":"2026-10-04","status":"abgeschlossen","startOdometer":"204000","endOdometer":"203000"}');
  if response->>'status' <> 'conflict' then raise exception 'INVALID_END_ACCEPTED'; end if;
end $$;
rollback;
