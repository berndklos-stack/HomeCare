-- Real report RPC regression, always rolled back; never uses existing records.
begin;
set local datestyle = 'ISO, MDY';
set local timezone = 'UTC';
insert into public.homecare_tenants(id,slug,name)
values ('73000000-0000-4000-8000-000000000301','report-time-regression','Report timestamp regression');
do $$
declare result jsonb;
begin
  result := public.homecare_apply_report_communication_mutation(
    '73000000-0000-4000-8000-000000000302','report','REPORT-TIMESTAMP-REGRESSION','create','REPORT-TIMESTAMP-REGRESSION',
    '73000000-0000-4000-8000-000000000301','{"title":"Timestamp regression","summary":"Preserve local contents"}',null);
  if result->>'status' <> 'synced' then raise exception 'REPORT_FIXTURE_FAILED'; end if;
  begin
    perform public.homecare_apply_report_communication_mutation(
      '73000000-0000-4000-8000-000000000303','report','REPORT-TIMESTAMP-REGRESSION','update','REPORT-TIMESTAMP-REGRESSION',
      '73000000-0000-4000-8000-000000000301','{"sentAt":"29.10.2026, 22:40"}',1);
    raise exception 'LEGACY_TIMESTAMP_UNEXPECTEDLY_ACCEPTED';
  exception when datetime_field_overflow or invalid_datetime_format then null;
  end;
  if exists(select 1 from public.homecare_sync_mutations where tenant_id='73000000-0000-4000-8000-000000000301' and mutation_id='73000000-0000-4000-8000-000000000303') then raise exception 'FAILED_MUTATION_JOURNALLED'; end if;
  result := public.homecare_apply_report_communication_mutation(
    '73000000-0000-4000-8000-000000000303','report','REPORT-TIMESTAMP-REGRESSION','update','REPORT-TIMESTAMP-REGRESSION',
    '73000000-0000-4000-8000-000000000301','{"sentAt":"2026-10-29T21:40:00.000Z"}',1);
  if result->>'status' <> 'synced' or result#>>'{record,revision}' <> '2' then raise exception 'NORMALIZED_TIMESTAMP_FAILED'; end if;
  if (select sent_at <> '2026-10-29T21:40:00Z'::timestamptz or summary <> 'Preserve local contents' from public.homecare_reports where id='REPORT-TIMESTAMP-REGRESSION') then raise exception 'REPORT_CONTENT_CHANGED'; end if;
  result := public.homecare_apply_report_communication_mutation(
    '73000000-0000-4000-8000-000000000303','report','REPORT-TIMESTAMP-REGRESSION','update','REPORT-TIMESTAMP-REGRESSION',
    '73000000-0000-4000-8000-000000000301','{"sentAt":"2026-10-29T21:40:00.000Z"}',1);
  if result->>'status' <> 'synced' or result#>>'{record,revision}' <> '2' then raise exception 'REPORT_REPLAY_CHANGED'; end if;
  result := public.homecare_apply_report_communication_mutation(
    '73000000-0000-4000-8000-000000000304','report','REPORT-TIMESTAMP-REGRESSION','update','REPORT-TIMESTAMP-REGRESSION',
    '73000000-0000-4000-8000-000000000301','{"summary":"Stale"}',1);
  if result->>'status' <> 'conflict' then raise exception 'STALE_REVISION_ACCEPTED'; end if;
end $$;
rollback;
select true as report_timestamp_regression_passed;
