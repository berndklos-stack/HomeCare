begin;
do $$ begin
  if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;

do $$ declare signature text; fn regprocedure; begin
  foreach signature in array array[
    'public.set_homecare_updated_at()','public.homecare_text_to_numeric(text)',
    'public.homecare_text_to_date(text)','public.homecare_text_to_timestamptz(text)',
    'public.homecare_text_to_boolean(text,boolean)','public.homecare_request_tenant()',
    'public.homecare_assign_request_tenant()','public.homecare_line_net(numeric,numeric,text,numeric)'
  ] loop
    fn:=signature::regprocedure;
    if not exists(select 1 from pg_proc where oid=fn and proconfig @> array['search_path=pg_catalog, public, pg_temp']) then raise exception 'UNSAFE_SEARCH_PATH: %',signature; end if;
  end loop;
  foreach signature in array array[
    'public.set_homecare_updated_at()','public.homecare_assign_request_tenant()',
    'public.homecare_financial_audit_trigger()','public.homecare_assign_picking_code()',
    'public.homecare_log_picking_change()','public.homecare_restore_relational_backup_base(uuid,uuid)'
  ] loop
    fn:=to_regprocedure(signature);
    if fn is not null and (has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')) then raise exception 'INTERNAL_FUNCTION_EXPOSED: %',signature; end if;
  end loop;
  foreach signature in array array['public.homecare_has_permission(uuid,text)','public.homecare_is_tenant_member(uuid)','public.homecare_request_tenant()'] loop
    fn:=signature::regprocedure;
    if has_function_privilege('anon',fn,'EXECUTE') or not has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'AUTH_HELPER_GRANTS: %',signature; end if;
  end loop;
  foreach signature in array array[
    'public.homecare_apply_financial_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)',
    'public.homecare_apply_master_data_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)',
    'public.homecare_create_relational_backup(uuid,text)','public.homecare_restore_relational_backup(uuid,uuid)'
  ] loop
    fn:=signature::regprocedure;
    if has_function_privilege('anon',fn,'EXECUTE') or not has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'LEGITIMATE_API_GRANTS_CHANGED: %',signature; end if;
  end loop;
  if public.homecare_text_to_numeric('12,5')<>12.5 or public.homecare_text_to_numeric('invalid') is not null
    or public.homecare_text_to_date('14.10.2026')<>date '2026-10-14'
    or public.homecare_text_to_timestamptz('invalid') is not null
    or public.homecare_text_to_boolean('invalid',true) is distinct from true
    or public.homecare_line_net(2,10,'none',0)<>20 then raise exception 'HELPER_BEHAVIOR_CHANGED'; end if;
  if exists(select 1 from pg_constraint c where c.contype='f' and c.conrelid in(
      'public.homecare_resources'::regclass,'public.homecare_resource_types'::regclass,
      'public.homecare_resource_type_fields'::regclass,'public.homecare_resource_assignments'::regclass,
      'public.homecare_maintenance_plans'::regclass,'public.homecare_maintenance_events'::regclass)
    and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indisready
      and i.indpred is null and i.indnkeyatts>=cardinality(c.conkey)
      and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)) then raise exception 'RESOURCE_FK_INDEX_MISSING'; end if;
end $$;

insert into public.homecare_tenants(id,slug,name) values('d1410000-0000-4000-8000-000000000002','security-fk-b','Security FK B');
insert into public.homecare_personnel(tenant_id,id,first_name,last_name) values
  ('00000000-0000-0000-0000-000000000001','security-person-a','Security','A'),
  ('d1410000-0000-4000-8000-000000000002','security-person-b','Security','B');
insert into public.homecare_resources(tenant_id,id,name,type,default_driver_id,odometer_last_confirmed_by)
  values('00000000-0000-0000-0000-000000000001','security-driver','Security driver','Fahrzeug','security-person-a','security-person-a');
do $$ begin
  begin update public.homecare_resources set default_driver_id='security-person-b' where id='security-driver'; raise exception 'FOREIGN_DRIVER_ACCEPTED';
  exception when foreign_key_violation then null; end;
  begin update public.homecare_resources set odometer_last_confirmed_by='security-person-b' where id='security-driver'; raise exception 'FOREIGN_CONFIRMER_ACCEPTED';
  exception when foreign_key_violation then null; end;
end $$;
delete from public.homecare_personnel where id='security-person-a';
do $$ begin
  if exists(select 1 from public.homecare_resources where id='security-driver' and (default_driver_id is not null or odometer_last_confirmed_by is not null)) then raise exception 'PERSON_DELETE_SET_NULL_CHANGED'; end if;
end $$;

-- An authenticated user cannot call the preserved administrative APIs for a
-- different request tenant. Authorization runs before lookup or data writes.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','d1410000-0000-4000-8000-000000000001',true);
select set_config('request.headers','{"x-workcore-tenant":"d1410000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ declare statement text; request_tenant text; begin
  foreach request_tenant in array array['d1410000-0000-4000-8000-000000000001','d1410000-0000-4000-8000-000000000002'] loop
  perform set_config('request.headers',jsonb_build_object('x-workcore-tenant',request_tenant)::text,true);
  foreach statement in array array[
    $q$select public.homecare_apply_financial_mutation(gen_random_uuid(),'invoice','security-probe','create',null,'d1410000-0000-4000-8000-000000000002','{}',null)$q$,
    $q$select public.homecare_apply_master_data_mutation(gen_random_uuid(),'service','security-probe','create',null,'d1410000-0000-4000-8000-000000000002','{}',null)$q$,
    $q$select public.homecare_create_relational_backup('d1410000-0000-4000-8000-000000000002','security-probe')$q$,
    $q$select public.homecare_restore_relational_backup(gen_random_uuid(),'d1410000-0000-4000-8000-000000000002')$q$,
    $q$select public.homecare_restore_relational_backup_base(gen_random_uuid(),'d1410000-0000-4000-8000-000000000002')$q$
  ] loop
    begin execute statement; raise exception 'FOREIGN_TENANT_API_ACCEPTED: %',statement;
    exception when insufficient_privilege then null; end;
  end loop;
  end loop;
  if public.homecare_has_permission('d1410000-0000-4000-8000-000000000002','data.read')
    or public.homecare_is_tenant_member('d1410000-0000-4000-8000-000000000002') then raise exception 'UNASSIGNED_USER_HAS_ACCESS'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.homecare_is_tenant_member('d1410000-0000-4000-8000-000000000001'); raise exception 'ANON_HELPER_EXECUTED';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
