begin;

-- Retain the original request in the journal, but never replay legacy stock
-- history as part of a material master-data edit after the stock cutover.
do $$ declare definition text; anchor text:=E'  execute format(''select to_jsonb(row),revision'; begin
  definition:=pg_get_functiondef('public.homecare_apply_master_data_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Master-data mutation signature changed'; end if;
  definition:=replace(definition,anchor,E'  if p_entity_type=''material'' and exists(select 1 from public.homecare_stock_cutovers where tenant_id=tenant) then\n    p_payload:=p_payload-''inventoryEntries'';\n  end if;\n'||anchor);
  execute definition;
end $$;

notify pgrst,'reload schema';
commit;
