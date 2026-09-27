-- Run after 20260927110000_resolve_field_progress_orphans.sql.
-- Read-only assertions; suitable for the real-data staging rehearsal and an
-- empty/synthetic staging database.

do $$
declare
  archive_ids constant text[] := array[
    'JOB-2407-OCC-20260807:Wasserwerte',
    'JOB-2407-OCC-20260807:Material',
    'JOB-2407-OCC-20260807:Vorher-Fotos',
    'JOB-2407-OCC-20260807:Zugang dokumentieren',
    'JOB-2407-OCC-20260807:Bericht',
    'JOB-2407-OCC-20260814:Bericht',
    'JOB-2407-OCC-20260814:Material',
    'JOB-2407-OCC-20260814:Wasserwerte',
    'JOB-2407-OCC-20260814:Vorher-Fotos',
    'JOB-2407-OCC-20260814:Zugang dokumentieren'
  ];
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.homecare_field_progress'::regclass
      and conname = 'homecare_field_progress_job_tenant_fk'
      and convalidated
  ) then
    raise exception 'FIELD_PROGRESS_TENANT_FK_NOT_VALIDATED';
  end if;

  if exists (
    select 1
    from public.homecare_field_progress progress
    where not exists (
      select 1 from public.homecare_jobs job
      where job.tenant_id = progress.tenant_id
        and job.id = progress.job_id
    )
  ) then
    raise exception 'FIELD_PROGRESS_ORPHAN_REMAINS';
  end if;

  if exists (
    select 1 from public.homecare_field_progress
    where id = any(archive_ids)
  ) then
    raise exception 'APPROVED_ARCHIVE_RECORD_REMAINS_ACTIVE';
  end if;

  if exists (
    select 1
    from public.homecare_field_progress_archive
    where source_record_id = any(archive_ids)
      and (source_record is null or source_record->>'id' <> source_record_id)
  ) then
    raise exception 'ARCHIVED_FIELD_PROGRESS_IS_NOT_LOSSLESS';
  end if;
end
$$;
