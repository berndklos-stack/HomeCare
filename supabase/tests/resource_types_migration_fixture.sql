do $$ begin
 if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
insert into public.homecare_resources(tenant_id,id,name,type,revision,identifier,notes,current_odometer,archived,tracking,standard_trips)
values
 ('00000000-0000-0000-0000-000000000001','migration-vehicle','Original vehicle','Fahrzeug',17,'KEEP-1','Original notes',12345,true,'{"mode":"tracker","deviceId":"original"}','[{"id":"route-original","name":"Keep route"}]'),
 ('00000000-0000-0000-0000-000000000001','migration-machine','Original machine','Maschine',9,'KEEP-2','Machine notes',null,false,'{}','[]'),
 ('00000000-0000-0000-0000-000000000001','migration-equipment','Original equipment','Gerät',4,'KEEP-3','Equipment notes',null,false,'{}','[]'),
 ('00000000-0000-0000-0000-000000000001','migration-unknown','Unknown legacy type','Custom legacy type',3,'KEEP-4','Do not guess type',null,false,'{}','[]');
create table public.resource_types_test_snapshot as select id,to_jsonb(resource) as original
 from public.homecare_resources resource where id like 'migration-%';
