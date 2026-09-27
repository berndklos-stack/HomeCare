-- Validate the tenant-scoped relationships after legacy-data reconciliation.
-- Any remaining orphan aborts the migration instead of being deleted or
-- silently detached from its business record.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select constraint_row.conrelid::regclass as table_name, constraint_row.conname
    from pg_constraint constraint_row
    join pg_namespace namespace_row
      on namespace_row.oid = constraint_row.connamespace
    where namespace_row.nspname = 'public'
      and constraint_row.contype = 'f'
      and not constraint_row.convalidated
      and constraint_row.conname like 'homecare\_%\_tenant\_fk' escape '\'
    order by constraint_row.conrelid::regclass::text, constraint_row.conname
  loop
    execute format(
      'alter table %s validate constraint %I',
      constraint_record.table_name,
      constraint_record.conname
    );
  end loop;
end
$$;
