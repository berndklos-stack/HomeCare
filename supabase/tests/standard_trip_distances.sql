begin;
do $$ begin
  if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;

do $$ declare result jsonb; mutation uuid:=gen_random_uuid(); payload jsonb; bad jsonb; begin
  payload:='{"name":"Distance vehicle","type":"Fahrzeug","standardTrips":[{"id":"route-1","label":"Route","startAddress":"A","endAddress":"B","distanceKm":12.5}]}'::jsonb;
  result:=public.homecare_apply_resource_mutation(mutation,'resource','distance-vehicle','create','distance-vehicle','00000000-0000-0000-0000-000000000001',payload,null);
  if result->>'status'<>'synced' then raise exception 'CREATE_FAILED: %',result; end if;
  if public.homecare_apply_resource_mutation(mutation,'resource','distance-vehicle','create','distance-vehicle','00000000-0000-0000-0000-000000000001',payload,null) is distinct from result then raise exception 'RETRY_CHANGED_RESULT'; end if;
  if (select distance_km from public.homecare_resource_standard_trip_distances where resource_id='distance-vehicle')<>12.5 then raise exception 'DISTANCE_NOT_IN_TYPED_COLUMN'; end if;
  update public.homecare_resources set standard_trips='[{"id":"route-1","label":"Legacy edit"}]' where id='distance-vehicle';
  if (select standard_trips->0->>'distanceKm' from public.homecare_resources where id='distance-vehicle')<>'12.500' then raise exception 'LEGACY_EDIT_LOST_DISTANCE'; end if;
  foreach bad in array array['-1'::jsonb,'0'::jsonb,'"abc"'::jsonb,'1.1234'::jsonb,'1000000'::jsonb] loop
    begin
      update public.homecare_resources set standard_trips=jsonb_build_array(jsonb_build_object('id','route-1','distanceKm',bad)) where id='distance-vehicle';
      raise exception 'INVALID_DISTANCE_ACCEPTED';
    exception when others then if sqlerrm<>'INVALID_STANDARD_TRIP_DISTANCE' then raise; end if; end;
  end loop;
  update public.homecare_resources set standard_trips='[{"id":"route-1","distanceKm":null}]' where id='distance-vehicle';
  if exists(select 1 from public.homecare_resource_standard_trip_distances where resource_id='distance-vehicle' and distance_km is not null) then raise exception 'CLEAR_FAILED'; end if;
  update public.homecare_resources set standard_trips='[{"id":"route-1","distanceKm":8.125}]' where id='distance-vehicle';
  insert into public.homecare_resources(tenant_id,id,name,type,standard_trips)
    select tenant_id,'distance-restored','Restored','Fahrzeug',standard_trips from public.homecare_resources where id='distance-vehicle';
  if (select distance_km from public.homecare_resource_standard_trip_distances where resource_id='distance-restored')<>8.125 then raise exception 'RESTORE_MIRROR_FAILED'; end if;
  update public.homecare_resources set standard_trips='[]' where id='distance-restored';
  if exists(select 1 from public.homecare_resource_standard_trip_distances where resource_id='distance-restored') then raise exception 'DELETION_FAILED'; end if;
  result:=public.homecare_apply_resource_mutation(gen_random_uuid(),'resource','distance-vehicle','update','distance-vehicle','00000000-0000-0000-0000-000000000001','{"standardTrips":[{"id":"route-1","distanceKm":25}]}',999999);
  if result->>'status'<>'conflict' or (select distance_km from public.homecare_resource_standard_trip_distances where resource_id='distance-vehicle')<>8.125 then raise exception 'REVISION_CONFLICT_CHANGED_DISTANCE'; end if;
end $$;

insert into public.homecare_tenants(id,slug,name) values('d1413000-0000-4000-8000-000000000002','distance-b','Distance B');
insert into public.homecare_resources(tenant_id,id,name,type,standard_trips) values('d1413000-0000-4000-8000-000000000002','distance-vehicle-b','Other tenant','Fahrzeug','[{"id":"route-1","distanceKm":99}]');
insert into auth.users(id,email) values('a1413000-0000-4000-8000-000000000001','distance@example.invalid');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values('c1413000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','distance-reader','Reader',array['data.read']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values('00000000-0000-0000-0000-000000000001','a1413000-0000-4000-8000-000000000001','c1413000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','a1413000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.homecare_resource_standard_trip_distances)<>1 then raise exception 'TENANT_RLS_FAILED'; end if;
  begin update public.homecare_resource_standard_trip_distances set distance_km=1; raise exception 'DIRECT_WRITE_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.headers','{"x-workcore-tenant":"d1413000-0000-4000-8000-000000000002"}',true);
do $$ begin
  if exists(select 1 from public.homecare_resource_standard_trip_distances) then raise exception 'FORGED_TENANT_READ'; end if;
end $$;
reset role;
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.homecare_resource_standard_trip_distances'::regclass)
    or has_table_privilege('anon','public.homecare_resource_standard_trip_distances','SELECT')
    or has_function_privilege('authenticated','public.homecare_sync_standard_trip_distances()','EXECUTE') then raise exception 'UNSAFE_GRANTS'; end if;
end $$;
rollback;
