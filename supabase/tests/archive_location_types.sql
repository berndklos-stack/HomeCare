begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111199','archive-type@example.invalid');
do $$ declare
  tenant uuid := '00000000-0000-0000-0000-000000000001';
  actor uuid := '11111111-1111-4111-8111-111111111199';
  type_id uuid := gen_random_uuid();
  mutation uuid := gen_random_uuid();
  response jsonb;
begin
  insert into public.homecare_storage_location_types(tenant_id,id,name) values(tenant,type_id,'Archivtest');
  insert into public.homecare_inventory_locations(tenant_id,id,name,location_type_id) values(tenant,'archive-type-location','Bestehender Lagerplatz',type_id);
  response := public.homecare_apply_operations_mutation(gen_random_uuid(),'operations',type_id::text,'delete',type_id::text,tenant,'{"kind":"archive","entity":"location_types"}',2,actor);
  if response->>'status' <> 'conflict' then raise exception 'REVISION_PROTECTION_FAILED'; end if;
  response := public.homecare_apply_operations_mutation(mutation,'operations',type_id::text,'delete',type_id::text,tenant,'{"kind":"archive","entity":"location_types"}',1,actor);
  if response->>'status' <> 'synced' or response#>>'{record,deleted_at}' is null then raise exception 'TYPE_ARCHIVE_FAILED: %',response; end if;
  if (select location_type_id from public.homecare_inventory_locations where tenant_id=tenant and id='archive-type-location') <> type_id then raise exception 'EXISTING_ASSIGNMENT_CHANGED'; end if;
  if (select revision from public.homecare_inventory_locations where tenant_id=tenant and id='archive-type-location') <> 1 then raise exception 'LOCATION_REVISION_CHANGED'; end if;
  if public.homecare_apply_operations_mutation(mutation,'operations',type_id::text,'delete',type_id::text,tenant,'{"kind":"archive","entity":"location_types"}',1,actor) <> response then raise exception 'ARCHIVE_NOT_IDEMPOTENT'; end if;
  if (select revision from public.homecare_storage_location_types where tenant_id=tenant and id=type_id) <> 2 then raise exception 'ARCHIVE_REVISION_FAILED'; end if;
  insert into public.homecare_storage_location_types(tenant_id,name) values(tenant,'Archivtest');
end $$;
rollback;
