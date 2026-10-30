begin;
insert into public.homecare_tenants(id,slug,name) values
 ('87000000-0000-0000-0000-000000000001','travel-costs-a','Travel costs A'),
 ('87000000-0000-0000-0000-000000000002','travel-costs-b','Travel costs B');
insert into public.homecare_jobs(id,tenant_id,title) values ('TRAVEL-J','87000000-0000-0000-0000-000000000001','Ongoing job');
do $$ declare result jsonb; begin
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000101','job_time_entry','TRAVEL-E','create','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"minutes":60,"description":"Work","travelKilometers":"25,5","travelRate":"3,75","attachments":[]}',null,null);
 if result->>'status'<>'synced' or result#>>'{record,revision}'<>'1' or (result#>>'{record,travel_kilometers}')::numeric<>25.5 or (result#>>'{record,travel_rate}')::numeric<>3.75 then raise exception 'TRAVEL_NATIVE_CREATE_FAILED: %',result; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000101','job_time_entry','TRAVEL-E','create','TRAVEL-J','87000000-0000-0000-0000-000000000001','{}',null,null);
 if result#>>'{record,revision}'<>'1' then raise exception 'TRAVEL_REPLAY_CHANGED_REVISION'; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000102','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"travelKilometers":"30","travelRate":"4"}',1,null);
 if result#>>'{record,revision}'<>'2' or (result#>>'{record,travel_kilometers}')::numeric<>30 then raise exception 'TRAVEL_UPDATE_FAILED'; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000103','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"travelKilometers":"99","travelRate":"99"}',1,null);
 if result->>'status'<>'conflict' then raise exception 'STALE_TRAVEL_UPDATE_ALLOWED'; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000104','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"description":"Changed"}',2,null);
 if (result#>>'{record,travel_rate}')::numeric<>4 or result#>>'{record,revision}'<>'3' then raise exception 'LEGACY_CLIENT_CLEARED_TRAVEL'; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000105','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"travelKilometers":"","travelRate":""}',3,null);
 if result#>'{record,travel_kilometers}'<>'null'::jsonb or result#>'{record,travel_rate}'<>'null'::jsonb then raise exception 'TRAVEL_CLEAR_FAILED'; end if;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000106','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"travelKilometers":"42","travelRate":"5","billingStatus":"abgerechnet"}',4,null);
 if result->>'status'<>'synced' then raise exception 'TRAVEL_BILLING_FAILED'; end if;
 begin
  perform public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000107','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000001','{"travelKilometers":"1","travelRate":"1"}',5,null);
  raise exception 'BILLED_TRAVEL_MUTABLE';
 exception when check_violation then null; end;
 begin update public.homecare_job_time_entries set travel_rate=-1 where id='TRAVEL-E'; raise exception 'NEGATIVE_TRAVEL_ALLOWED'; exception when check_violation then null; end;
 result:=public.homecare_apply_job_operation_mutation('87000000-0000-0000-0000-000000000108','job_time_entry','TRAVEL-E','update','TRAVEL-J','87000000-0000-0000-0000-000000000002','{"travelKilometers":"1","travelRate":"1"}',5,null);
 if result->>'status'<>'conflict' then raise exception 'CROSS_TENANT_TRAVEL_ALLOWED'; end if;
end $$;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.homecare_job_time_entries'::regclass) then raise exception 'TRAVEL_RLS_DISABLED'; end if;
 if has_function_privilege('anon','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','execute') or
 has_function_privilege('authenticated','public.homecare_apply_job_operation_before_picking(uuid,text,text,text,text,uuid,jsonb,bigint)','execute') then raise exception 'TRAVEL_RPC_EXPOSED'; end if;
end $$;
rollback;
