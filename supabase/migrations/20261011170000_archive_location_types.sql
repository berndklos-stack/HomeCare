begin;
do $$
declare definition text;
begin
  select pg_get_functiondef('public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)'::regprocedure) into definition;
  if position('entity not in(''suppliers'',''supplier_contacts'',''maintenance_plans'',''purchase_order_items'',''location_types'')' in definition) > 0 then return; end if;
  if position('entity not in(''suppliers'',''supplier_contacts'',''maintenance_plans'',''purchase_order_items'')' in definition) = 0 then
    raise exception 'Archive command contract not found.';
  end if;
  definition := replace(definition,
    'entity not in(''suppliers'',''supplier_contacts'',''maintenance_plans'',''purchase_order_items'')',
    'entity not in(''suppliers'',''supplier_contacts'',''maintenance_plans'',''purchase_order_items'',''location_types'')');
  execute definition;
end $$;
commit;
