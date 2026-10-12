begin;
insert into public.homecare_resources(tenant_id,id,name,type,current_odometer,current_odometer_date)
values('00000000-0000-0000-0000-000000000001','recheck-car','Recheck test','Fahrzeug',203132,'2026-10-12');
do $$ declare
  tenant uuid := '00000000-0000-0000-0000-000000000001';
  mutation uuid := gen_random_uuid();
  second_mutation uuid := gen_random_uuid();
  body jsonb := '{"date":"2026-10-05","startedAt":"2026-10-05T07:00:00Z","status":"abgeschlossen","startOdometer":"202947","endOdometer":"202949"}';
  original jsonb;
  response jsonb;
begin
  original := jsonb_build_object('mutationId',mutation,'status','conflict','error','Start-Kilometerstand 202947 liegt unter dem Serverstand 203132.0.');
  insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,request_payload,response_payload)
    values(tenant,mutation,'vehicle_trip','RECHECK-1','create','conflict',body,original);
  response := public.homecare_apply_trip_sync_mutation(mutation,'vehicle_trip','RECHECK-1','create','recheck-car',tenant,body||'{"endOdometer":"202950"}');
  if response->>'status'<>'conflict' or exists(select 1 from public.homecare_trip_validation_rechecks where mutation_id=mutation) then raise exception 'CHANGED_PAYLOAD_RETRIED'; end if;
  response := public.homecare_apply_trip_sync_mutation(mutation,'vehicle_trip','RECHECK-1','create','recheck-car',tenant,body);
  if response->>'status'<>'synced' then raise exception 'OLD_VALIDATION_NOT_RECHECKED: %',response; end if;
  if (select original_response from public.homecare_trip_validation_rechecks where mutation_id=mutation) is distinct from original then raise exception 'ORIGINAL_CONFLICT_LOST'; end if;
  if public.homecare_apply_trip_sync_mutation(mutation,'vehicle_trip','RECHECK-1','create','recheck-car',tenant,body) is distinct from response then raise exception 'RETRY_NOT_IDEMPOTENT'; end if;
  if (select count(*) from public.homecare_vehicle_trips where id='RECHECK-1')<>1 then raise exception 'DUPLICATE_TRIP'; end if;
  if (select current_odometer from public.homecare_resources where id='recheck-car')<>203132 then raise exception 'CURRENT_ODOMETER_CHANGED'; end if;
  insert into public.homecare_sync_mutations(tenant_id,mutation_id,entity_type,entity_id,operation,status,request_payload,response_payload)
    values(tenant,second_mutation,'vehicle_trip','RECHECK-2','create','conflict',body||'{"startedAt":"2026-10-05T08:00:00Z"}',original);
  response := public.homecare_apply_trip_sync_mutation(second_mutation,'vehicle_trip','RECHECK-2','create','recheck-car',tenant,body||'{"startedAt":"2026-10-05T08:00:00Z"}');
  if response->>'status'<>'conflict' or response->>'error' not like '%vorherigen Fahrt%' then raise exception 'REAL_OVERLAP_NOT_PRESERVED: %',response; end if;
  if exists(select 1 from public.homecare_vehicle_trips where id='RECHECK-2') then raise exception 'REAL_CONFLICT_INSERTED'; end if;
end $$;
rollback;
