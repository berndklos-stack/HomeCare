-- Human-approved resolution of the 19 field-progress orphans found during the
-- V1 staging rehearsal. Business evidence is either linked or archived; none
-- of the records is discarded.

create table if not exists public.homecare_field_progress_archive (
  tenant_id uuid not null references public.homecare_tenants(id) on delete restrict,
  source_record_id text not null,
  source_job_id text not null,
  source_updated_at timestamptz,
  source_record jsonb not null,
  archive_reason text not null,
  decision_reference text not null,
  archived_at timestamptz not null default now(),
  primary key (tenant_id, source_record_id)
);

comment on table public.homecare_field_progress_archive is
  'Lossless evidence archive for field-progress rows whose parent job cannot be reconstructed.';

alter table public.homecare_field_progress_archive enable row level security;
revoke all on table public.homecare_field_progress_archive from anon, authenticated;
grant select, insert on table public.homecare_field_progress_archive to service_role;

do $$
declare
  expected_assign_ids constant text[] := array[
    'JOB-2407:Bericht',
    'JOB-2407:Wasserwerte',
    'JOB-2407:Vorher-Fotos',
    'JOB-2407:Material',
    'JOB-2407:REP-044-3',
    'JOB-2407:Zugang dokumentieren',
    'JOB-2408:REP-041-1',
    'JOB-2407:REP-044-1',
    'JOB-2407:REP-044-2'
  ];
  expected_archive_ids constant text[] := array[
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
  assign_count integer;
begin
  select count(*) into assign_count
  from public.homecare_field_progress
  where id = any(expected_assign_ids)
    and not exists (
      select 1
      from public.homecare_jobs job
      where job.tenant_id = homecare_field_progress.tenant_id
        and job.id = homecare_field_progress.job_id
    );

  if assign_count > 0 then
    with state_jobs as (
      select
        state.tenant_id,
        state.updated_at,
        job.value as payload,
        row_number() over (
          partition by state.tenant_id, job.value->>'id'
          order by (state.id = 'sync-section:jobs') desc, state.updated_at desc
        ) as source_rank
      from public.app_state state
      cross join lateral jsonb_array_elements(
        case
          when state.id = 'sync-section:jobs' then coalesce(state.data->'value', '[]'::jsonb)
          else coalesce(state.data->'jobs', '[]'::jsonb)
        end
      ) job(value)
      where job.value->>'id' in ('JOB-2407', 'JOB-2408')
    )
    insert into public.homecare_jobs (
      tenant_id, id, series_master_id, series_occurrence_date, title, object_id,
      customer_id, type, status, status_updated_at, reset_at, priority, due_date,
      start_date, end_date, execution_date, assigned_to, description,
      internal_notes, billable, material, work_minutes, resource_ids,
      material_items, checklist, service_ids, service_quantities,
      service_discounts, custom_service, discount, schedule, execution_log,
      offer_number, offer_sent_at, order_confirmation_number,
      order_confirmation_sent_at, series_excluded_dates, created_at, updated_at
    )
    select
      source.tenant_id,
      source.payload->>'id',
      source.payload->>'seriesMasterId',
      public.homecare_text_to_date(source.payload->>'seriesOccurrenceDate'),
      coalesce(nullif(source.payload->>'title', ''), 'Auftrag'),
      case when exists (
        select 1 from public.homecare_objects object
        where object.tenant_id = source.tenant_id
          and object.id = source.payload->>'objectId'
      ) then source.payload->>'objectId' end,
      case when exists (
        select 1 from public.homecare_customers customer
        where customer.tenant_id = source.tenant_id
          and customer.id = source.payload->>'customerId'
      ) then source.payload->>'customerId' end,
      source.payload->>'type',
      coalesce(nullif(source.payload->>'status', ''), 'geplant'),
      public.homecare_text_to_timestamptz(source.payload->>'statusUpdatedAt'),
      public.homecare_text_to_timestamptz(source.payload->>'resetAt'),
      coalesce(nullif(source.payload->>'priority', ''), 'normal'),
      public.homecare_text_to_date(source.payload->>'dueDate'),
      public.homecare_text_to_date(source.payload->>'startDate'),
      public.homecare_text_to_date(source.payload->>'endDate'),
      public.homecare_text_to_date(source.payload->>'executionDate'),
      source.payload->>'assignedTo',
      source.payload->>'description',
      source.payload->>'internalNotes',
      public.homecare_text_to_boolean(source.payload->>'billable', true),
      source.payload->>'material',
      coalesce(public.homecare_text_to_numeric(source.payload->>'workMinutes'), 0)::integer,
      coalesce(source.payload->'resourceIds', '[]'::jsonb),
      coalesce(source.payload->'materialItems', '[]'::jsonb),
      coalesce(source.payload->'checklist', '[]'::jsonb),
      coalesce(source.payload->'serviceIds', '[]'::jsonb),
      coalesce(source.payload->'serviceQuantities', '{}'::jsonb),
      coalesce(source.payload->'serviceDiscounts', '{}'::jsonb),
      source.payload->'customService',
      jsonb_build_object(
        'type', source.payload->>'discountType',
        'value', source.payload->>'discountValue',
        'reason', source.payload->>'discountReason'
      ),
      coalesce(source.payload->'schedule', '{}'::jsonb),
      coalesce(source.payload->'executionLog', '[]'::jsonb),
      source.payload->>'offerNumber',
      public.homecare_text_to_timestamptz(source.payload->>'offerSentAt'),
      source.payload->>'orderConfirmationNumber',
      public.homecare_text_to_timestamptz(source.payload->>'orderConfirmationSentAt'),
      coalesce(source.payload->'seriesExcludedDates', '[]'::jsonb),
      source.updated_at,
      source.updated_at
    from state_jobs source
    where source.source_rank = 1
      and exists (
        select 1
        from public.homecare_field_progress progress
        where progress.id = any(expected_assign_ids)
          and progress.tenant_id = source.tenant_id
          and progress.job_id = source.payload->>'id'
      )
    on conflict do nothing;

    if exists (
      select 1
      from public.homecare_field_progress progress
      where progress.id = any(expected_assign_ids)
        and not exists (
          select 1 from public.homecare_jobs job
          where job.tenant_id = progress.tenant_id
            and job.id = progress.job_id
        )
    ) then
      raise exception 'FIELD_PROGRESS_ASSIGN_SOURCE_MISSING: % records required reconstruction', assign_count;
    end if;
  end if;

  insert into public.homecare_field_progress_archive (
    tenant_id, source_record_id, source_job_id, source_updated_at,
    source_record, archive_reason, decision_reference
  )
  select
    progress.tenant_id,
    progress.id,
    progress.job_id,
    progress.updated_at,
    to_jsonb(progress),
    'Parent occurrence is absent; preserve the approved record losslessly outside the active job relationship.',
    'docs/security/Field-Progress-Orphans.md#final-decision'
  from public.homecare_field_progress progress
  where progress.id = any(expected_archive_ids)
  on conflict (tenant_id, source_record_id) do nothing;

  if exists (
    select 1
    from public.homecare_field_progress progress
    join public.homecare_field_progress_archive archive
      on archive.tenant_id = progress.tenant_id
     and archive.source_record_id = progress.id
    where progress.id = any(expected_archive_ids)
      and archive.source_record <> to_jsonb(progress)
  ) then
    raise exception 'FIELD_PROGRESS_ARCHIVE_SNAPSHOT_MISMATCH';
  end if;

  delete from public.homecare_field_progress progress
  where progress.id = any(expected_archive_ids)
    and exists (
      select 1
      from public.homecare_field_progress_archive archive
      where archive.tenant_id = progress.tenant_id
        and archive.source_record_id = progress.id
        and archive.source_record = to_jsonb(progress)
    );

  if exists (
    select 1
    from public.homecare_field_progress progress
    where not exists (
      select 1
      from public.homecare_jobs job
      where job.tenant_id = progress.tenant_id
        and job.id = progress.job_id
    )
  ) then
    raise exception 'FIELD_PROGRESS_ORPHANS_REMAIN';
  end if;
end
$$;

alter table public.homecare_field_progress
  validate constraint homecare_field_progress_job_tenant_fk;
