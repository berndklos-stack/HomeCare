begin;

-- Preserve existing SET NULL behavior on the legacy single-column FKs, while
-- also preventing cross-tenant person references. Never rewrite existing data.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_resources'::regclass and conname='resource_default_driver_tenant_fk') then
    alter table public.homecare_resources add constraint resource_default_driver_tenant_fk
      foreign key(tenant_id,default_driver_id) references public.homecare_personnel(tenant_id,id)
      deferrable initially immediate not valid;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.homecare_resources'::regclass and conname='resource_odometer_confirmer_tenant_fk') then
    alter table public.homecare_resources add constraint resource_odometer_confirmer_tenant_fk
      foreign key(tenant_id,odometer_last_confirmed_by) references public.homecare_personnel(tenant_id,id)
      deferrable initially immediate not valid;
  end if;
end $$;
alter table public.homecare_resources validate constraint resource_default_driver_tenant_fk;
alter table public.homecare_resources validate constraint resource_odometer_confirmer_tenant_fk;

-- Only resource-domain foreign keys. Keep existing indexes and constraints.
-- A partial/INCLUDE-only index is not sufficient for arbitrary FK parent changes.
do $$ declare fk record; columns_sql text; index_name text; begin
  for fk in
    select c.oid,c.conname,c.conrelid,c.conkey from pg_constraint c
    where c.contype='f' and c.conrelid in (
      'public.homecare_resources'::regclass,'public.homecare_resource_types'::regclass,
      'public.homecare_resource_type_fields'::regclass,'public.homecare_resource_assignments'::regclass,
      'public.homecare_maintenance_plans'::regclass,'public.homecare_maintenance_events'::regclass)
      and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indisready
        and i.indpred is null and i.indnkeyatts>=cardinality(c.conkey)
        and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
    order by c.conrelid,c.conname
  loop
    select string_agg(format('%I',a.attname),',' order by k.ordinality) into columns_sql
      from unnest(fk.conkey) with ordinality k(attnum,ordinality)
      join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
    index_name:=left(fk.conrelid::regclass::text||'_'||replace(columns_sql,',','_'),43)
      ||'_'||substr(md5(fk.conrelid::regclass::text||':'||fk.conname),1,8)||'_fk_idx';
    execute format('create index %I on %s (%s)',index_name,fk.conrelid::regclass,columns_sql);
  end loop;
end $$;

commit;
