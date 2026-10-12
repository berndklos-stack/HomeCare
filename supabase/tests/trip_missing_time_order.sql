begin;
insert into public.homecare_resources(tenant_id,id,name,type,current_odometer,current_odometer_date)
values('00000000-0000-0000-0000-000000000001','untimed-car','Untimed test','Fahrzeug',203132,'2026-10-12');
do $$ declare
  tenant uuid := '00000000-0000-0000-0000-000000000001';
  mutation uuid := gen_random_uuid();
  response jsonb;
  original jsonb;
  body jsonb := '{"date":"2026-10-12","status":"abgeschlossen","startOdometer":"203132","endOdometer":"203148"}';
begin
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','UNTIMED-A','create','untimed-car',tenant,
    '{"date":"2026-10-12","startedAt":"2026-10-12T10:03:30Z","status":"abgeschlossen","startOdometer":"203126","endOdometer":"203129"}');
  if response->>'status'<>'synced' then raise exception 'EARLY_TRIP_FAILED: %',response; end if;
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','UNTIMED-B','create','untimed-car',tenant,
    '{"date":"2026-10-12","startedAt":"2026-10-12T10:04:36Z","status":"abgeschlossen","startOdometer":"203129","endOdometer":"203132"}');
  if response->>'status'<>'synced' then raise exception 'SECOND_TRIP_FAILED: %',response; end if;
  original := jsonb_build_object('mutationId',mutation,'status','conflict','error','Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (203126.0 km).');
  insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,request_payload,response_payload)
    values(tenant,mutation,'vehicle_trip','UNTIMED-C','create','conflict',body,original);
  response := public.homecare_apply_trip_sync_mutation(mutation,'vehicle_trip','UNTIMED-C','create','untimed-car',tenant,body);
  if response->>'status'<>'synced' then raise exception 'UNTIMED_CURRENT_REJECTED: %',response; end if;
  if (select started_at from public.homecare_vehicle_trips where id='UNTIMED-C') is not null then raise exception 'START_TIME_INVENTED'; end if;
  if public.homecare_apply_trip_sync_mutation(mutation,'vehicle_trip','UNTIMED-C','create','untimed-car',tenant,body) is distinct from response then raise exception 'RETRY_NOT_IDEMPOTENT'; end if;
  if (select original_response from public.homecare_trip_validation_rechecks where mutation_id=mutation) is distinct from original then raise exception 'ORIGINAL_RESPONSE_LOST'; end if;
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','UNTIMED-OVERLAP','create','untimed-car',tenant,
    body||'{"startOdometer":"203130","endOdometer":"203140"}');
  if response->>'status'<>'conflict' then raise exception 'TRUE_OVERLAP_ACCEPTED'; end if;
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','UNTIMED-D','create','untimed-car',tenant,
    body||'{"startOdometer":"203148","endOdometer":"203150"}');
  if response->>'status'<>'synced' then raise exception 'ADJACENT_UNTIMED_REJECTED: %',response; end if;
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','UNTIMED-NEXT-DAY','create','untimed-car',tenant,
    body||'{"date":"2026-10-13","startOdometer":"203140","endOdometer":"203151"}');
  if response->>'status'<>'conflict' then raise exception 'CROSS_DAY_OVERLAP_ACCEPTED'; end if;
  response := public.homecare_apply_trip_sync_mutation(gen_random_uuid(),'vehicle_trip','TIMED-NEXT-DAY','create','untimed-car',tenant,
    body||'{"date":"2026-10-13","startedAt":"2026-10-13T08:00:00Z","startOdometer":"203140","endOdometer":"203151"}');
  if response->>'status'<>'conflict' then raise exception 'TIMED_CROSS_DAY_OVERLAP_ACCEPTED'; end if;
end $$;
rollback;
