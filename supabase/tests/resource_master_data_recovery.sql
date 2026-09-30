-- Run after the complete migration chain in a disposable database.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'resource-recovery-test', 'Resource recovery test')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name;

insert into public.homecare_resources (
  id, tenant_id, type, name, identifier, license_plate,
  current_odometer, current_odometer_date, responsible_person_id,
  odometer_year_start, standard_trips, deleted_logbook_entry_ids,
  tracking, maintenance_items, revision, deleted_at
)
values
  (
    'RES-1', '00000000-0000-0000-0000-000000000001', 'Fahrzeug',
    'Servicebil Kolaretorp', 'ABC123', '', 202745, '2026-09-25', null,
    12500, '[{"id":"STANDARD-KEEP"}]'::jsonb, '["TRIP-KEEP"]'::jsonb,
    '{"mode":"phone"}'::jsonb, '[{"id":"MAINTENANCE-KEEP"}]'::jsonb, 7, null
  ),
  (
    'RES-2', '00000000-0000-0000-0000-000000000001', 'Maschine',
    'Rasenmäher Husqvarna', 'HM-01', '', 0, null, null,
    null, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, 4, null
  ),
  (
    'RES-RECOVERY-OTHER', '00000000-0000-0000-0000-000000000001', 'Fahrzeug',
    'Unrelated vehicle', 'OTHER', '', 123, '2026-09-24', null,
    100, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, 3, null
  )
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  type = excluded.type,
  name = excluded.name,
  identifier = excluded.identifier,
  license_plate = excluded.license_plate,
  current_odometer = excluded.current_odometer,
  current_odometer_date = excluded.current_odometer_date,
  responsible_person_id = excluded.responsible_person_id,
  odometer_year_start = excluded.odometer_year_start,
  standard_trips = excluded.standard_trips,
  deleted_logbook_entry_ids = excluded.deleted_logbook_entry_ids,
  tracking = excluded.tracking,
  maintenance_items = excluded.maintenance_items,
  revision = excluded.revision,
  deleted_at = excluded.deleted_at;

create temporary table resource_recovery_before as
select id, to_jsonb(resource) - 'updated_at' as snapshot
from public.homecare_resources resource
where id in ('RES-1', 'RES-2', 'RES-RECOVERY-OTHER');

\ir ../migrations/20260930100000_recover_production_resource_master_data.sql

do $$
declare
  first_revision bigint;
begin
  if (select license_plate from public.homecare_resources where id = 'RES-1') <> 'BLB549' then
    raise exception 'RESOURCE_LICENSE_PLATE_RECOVERY_FAILED';
  end if;

  if (select current_odometer from public.homecare_resources where id = 'RES-1') <> 202745
    or (select current_odometer_date from public.homecare_resources where id = 'RES-1') <> '2026-09-25'::date
    or (select standard_trips from public.homecare_resources where id = 'RES-1') <> '[{"id":"STANDARD-KEEP"}]'::jsonb
    or (select deleted_logbook_entry_ids from public.homecare_resources where id = 'RES-1') <> '["TRIP-KEEP"]'::jsonb
    or (select tracking from public.homecare_resources where id = 'RES-1') <> '{"mode":"phone"}'::jsonb
    or (select maintenance_items from public.homecare_resources where id = 'RES-1') <> '[{"id":"MAINTENANCE-KEEP"}]'::jsonb then
    raise exception 'RESOURCE_RECOVERY_CHANGED_PROTECTED_FIELDS';
  end if;

  if (select to_jsonb(resource) - 'updated_at' from public.homecare_resources resource where id = 'RES-2')
      is distinct from (select snapshot from resource_recovery_before where id = 'RES-2')
    or (select to_jsonb(resource) - 'updated_at' from public.homecare_resources resource where id = 'RES-RECOVERY-OTHER')
      is distinct from (select snapshot from resource_recovery_before where id = 'RES-RECOVERY-OTHER') then
    raise exception 'RESOURCE_RECOVERY_CHANGED_UNRELATED_ROWS';
  end if;

  select revision into first_revision from public.homecare_resources where id = 'RES-1';
  create temporary table resource_recovery_first_revision(value bigint) on commit drop;
  insert into resource_recovery_first_revision values (first_revision);
end;
$$;

\ir ../migrations/20260930100000_recover_production_resource_master_data.sql

do $$
begin
  if (select revision from public.homecare_resources where id = 'RES-1')
      <> (select value from resource_recovery_first_revision) then
    raise exception 'RESOURCE_RECOVERY_NOT_IDEMPOTENT';
  end if;
end;
$$;

update public.homecare_resources
set license_plate = 'NEWER999'
where id = 'RES-1';

\ir ../migrations/20260930100000_recover_production_resource_master_data.sql

do $$
begin
  if (select license_plate from public.homecare_resources where id = 'RES-1') <> 'NEWER999' then
    raise exception 'RESOURCE_RECOVERY_OVERWROTE_NEWER_VALUE';
  end if;
end;
$$;

rollback;
