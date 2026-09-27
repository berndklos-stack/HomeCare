-- Close Supabase default table grants for all existing WorkCore tables.
-- RLS remains the row-level boundary; this is an additional deny-by-default ACL.
do $$
declare
  table_record record;
begin
  for table_record in
    select format('%I.%I', schemaname, tablename) as qualified_name
    from pg_tables
    where schemaname = 'public'
      and (left(tablename, 9) = 'homecare_' or tablename = 'app_state')
  loop
    execute format('revoke all on table %s from anon', table_record.qualified_name);
  end loop;
end;
$$;
