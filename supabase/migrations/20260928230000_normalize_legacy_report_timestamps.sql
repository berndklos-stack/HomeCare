-- Normalize the known pre-Wave-3 local report timestamp formats without
-- changing valid ISO values. Legacy wall-clock values are Swedish local time;
-- Europe/Stockholm makes DST handling explicit before storing UTC ISO 8601.

with normalized as (
  select
    state.tenant_id,
    state.id,
    jsonb_agg(
      case
        when report->>'sentAt' ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}, [0-9]{2}:[0-9]{2}$' then
          jsonb_set(
            report,
            '{sentAt}',
            to_jsonb(to_char(
              (
                to_date(report->>'sentAt', 'DD.MM.YYYY')
                + to_timestamp(report->>'sentAt', 'DD.MM.YYYY, HH24:MI')::time
              ) at time zone 'Europe/Stockholm' at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS"Z"'
            ))
          )
        when report->>'sentAt' ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4} [0-9]{2}:[0-9]{2}$' then
          jsonb_set(
            report,
            '{sentAt}',
            to_jsonb(to_char(
              (
                to_date(report->>'sentAt', 'DD.MM.YYYY')
                + to_timestamp(report->>'sentAt', 'DD.MM.YYYY HH24:MI')::time
              ) at time zone 'Europe/Stockholm' at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS"Z"'
            ))
          )
        else report
      end
      order by ordinality
    ) as reports
  from public.app_state state
  cross join lateral jsonb_array_elements(state.data->'value') with ordinality source(report, ordinality)
  where state.id = 'sync-section:reports'
    and jsonb_typeof(state.data->'value') = 'array'
  group by state.tenant_id, state.id
)
update public.app_state state
set data = jsonb_set(state.data, '{value}', normalized.reports, false)
from normalized
where state.tenant_id = normalized.tenant_id
  and state.id = normalized.id
  and state.data->'value' is distinct from normalized.reports;

with normalized as (
  select
    state.tenant_id,
    state.id,
    jsonb_agg(
      case
        when report->>'sentAt' ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}, [0-9]{2}:[0-9]{2}$' then
          jsonb_set(
            report,
            '{sentAt}',
            to_jsonb(to_char(
              (
                to_date(report->>'sentAt', 'DD.MM.YYYY')
                + to_timestamp(report->>'sentAt', 'DD.MM.YYYY, HH24:MI')::time
              ) at time zone 'Europe/Stockholm' at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS"Z"'
            ))
          )
        when report->>'sentAt' ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4} [0-9]{2}:[0-9]{2}$' then
          jsonb_set(
            report,
            '{sentAt}',
            to_jsonb(to_char(
              (
                to_date(report->>'sentAt', 'DD.MM.YYYY')
                + to_timestamp(report->>'sentAt', 'DD.MM.YYYY HH24:MI')::time
              ) at time zone 'Europe/Stockholm' at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS"Z"'
            ))
          )
        else report
      end
      order by ordinality
    ) as reports
  from public.app_state state
  cross join lateral jsonb_array_elements(state.data->'reports') with ordinality source(report, ordinality)
  where state.id = 'kolaretorp-service-app'
    and jsonb_typeof(state.data->'reports') = 'array'
  group by state.tenant_id, state.id
)
update public.app_state state
set data = jsonb_set(state.data, '{reports}', normalized.reports, false)
from normalized
where state.tenant_id = normalized.tenant_id
  and state.id = normalized.id
  and state.data->'reports' is distinct from normalized.reports;
