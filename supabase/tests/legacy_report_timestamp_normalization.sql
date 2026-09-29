-- Run after 20260928230000_normalize_legacy_report_timestamps.sql. Always rolls back.
begin;

insert into public.homecare_tenants(id, slug, name)
values ('72823000-0000-0000-0000-000000000001', 'legacy-report-time', 'Legacy report time');

insert into public.app_state(tenant_id, id, data)
values
  (
    '72823000-0000-0000-0000-000000000001',
    'sync-section:reports',
    '{"value":[
      {"id":"REPORT-COMMA","sentAt":"16.08.2026, 21:45","title":"Comma"},
      {"id":"REPORT-ISO","sentAt":"2026-08-16T19:45:00Z","title":"ISO"},
      {"id":"REPORT-EMPTY","sentAt":"","title":"Empty"},
      {"id":"REPORT-NULL","sentAt":null,"title":"Null"}
    ],"untouched":"yes"}'::jsonb
  ),
  (
    '72823000-0000-0000-0000-000000000001',
    'kolaretorp-service-app',
    '{"reports":[
      {"id":"REPORT-SPACE","sentAt":"16.08.2026 21:45","title":"Space"}
    ],"untouched":"yes"}'::jsonb
  );

\ir ../migrations/20260928230000_normalize_legacy_report_timestamps.sql
\ir ../migrations/20260928230000_normalize_legacy_report_timestamps.sql

do $$
declare
  section_data jsonb;
  app_data jsonb;
begin
  select data into section_data
  from public.app_state
  where tenant_id = '72823000-0000-0000-0000-000000000001'
    and id = 'sync-section:reports';

  select data into app_data
  from public.app_state
  where tenant_id = '72823000-0000-0000-0000-000000000001'
    and id = 'kolaretorp-service-app';

  if section_data#>>'{value,0,sentAt}' <> '2026-08-16T19:45:00Z' then
    raise exception 'LEGACY_REPORT_COMMA_TIMESTAMP_FAILED: %', section_data#>>'{value,0,sentAt}';
  end if;
  if app_data#>>'{reports,0,sentAt}' <> '2026-08-16T19:45:00Z' then
    raise exception 'LEGACY_REPORT_SPACE_TIMESTAMP_FAILED: %', app_data#>>'{reports,0,sentAt}';
  end if;
  if section_data#>>'{value,1,sentAt}' <> '2026-08-16T19:45:00Z' then
    raise exception 'LEGACY_REPORT_ISO_TIMESTAMP_CHANGED';
  end if;
  if section_data#>>'{value,2,sentAt}' <> '' then
    raise exception 'LEGACY_REPORT_EMPTY_TIMESTAMP_CHANGED';
  end if;
  if section_data#>'{value,3,sentAt}' <> 'null'::jsonb then
    raise exception 'LEGACY_REPORT_NULL_TIMESTAMP_CHANGED';
  end if;
  if section_data->>'untouched' <> 'yes' or app_data->>'untouched' <> 'yes' then
    raise exception 'LEGACY_REPORT_UNRELATED_DATA_CHANGED';
  end if;
end
$$;

rollback;
