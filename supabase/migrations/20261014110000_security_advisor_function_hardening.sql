begin;

-- Pin lookup order without changing conversion, accounting or tenant behavior.
-- public is not client-writable; pg_temp is explicit and last.
alter function public.set_homecare_updated_at() set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_text_to_numeric(text) set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_text_to_date(text) set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_text_to_timestamptz(text) set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_text_to_boolean(text,boolean) set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_request_tenant() set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_assign_request_tenant() set search_path=pg_catalog,public,pg_temp;
alter function public.homecare_line_net(numeric,numeric,text,numeric) set search_path=pg_catalog,public,pg_temp;

-- Authenticated RLS evaluation needs these helpers. Anonymous callers do not.
revoke execute on function public.homecare_has_permission(uuid,text),
  public.homecare_is_tenant_member(uuid),public.homecare_request_tenant()
  from public,anon;
grant execute on function public.homecare_has_permission(uuid,text),
  public.homecare_is_tenant_member(uuid),public.homecare_request_tenant()
  to authenticated,service_role;

-- The authenticated restore entry point retains its authorization/transaction
-- wrapper. The underlying implementation is not a separate client API.
revoke execute on function public.homecare_restore_relational_backup_base(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.homecare_restore_relational_backup_base(uuid,uuid) to service_role;

-- Existing triggers keep running: EXECUTE is checked when a trigger is created,
-- not when it fires. Older Staging versions may not have the picking triggers.
do $$ declare signature text; fn regprocedure; begin
  foreach signature in array array[
    'public.set_homecare_updated_at()',
    'public.homecare_assign_request_tenant()',
    'public.homecare_financial_audit_trigger()',
    'public.homecare_assign_picking_code()',
    'public.homecare_log_picking_change()'
  ] loop
    fn:=to_regprocedure(signature);
    if fn is not null then
      if (select prorettype from pg_proc where oid=fn)<>'trigger'::regtype then raise exception 'EXPECTED_TRIGGER_FUNCTION: %',signature; end if;
      execute format('revoke execute on function %s from public,anon,authenticated',fn);
      execute format('grant execute on function %s to service_role',fn);
    end if;
  end loop;
end $$;

commit;
