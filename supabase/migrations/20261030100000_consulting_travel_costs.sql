begin;

alter table public.homecare_job_time_entries
  add column if not exists travel_kilometers numeric(12,3),
  add column if not exists travel_rate numeric(12,4),
  add constraint homecare_time_entry_travel_valid check (
    (travel_kilometers is null and travel_rate is null) or
    (travel_kilometers is not null and travel_rate is not null and
      travel_kilometers > 0 and travel_kilometers <= 1000000 and travel_rate >= 0 and travel_rate <= 1000000)
  );

-- Extend the native write itself so distance, rate and time share one revision
-- and one idempotency journal entry, including existing attachment wrappers.
do $$
declare definition text; before_definition text;
begin
  definition := pg_get_functiondef('public.homecare_apply_job_operation_before_picking(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure);
  before_definition := definition;
  if position('minutes,description,billing_status,billed_at,billing_record_id) values' in definition)=0
    or position('description=coalesce(p_payload->>''description'',description),billing_status=' in definition)=0 then
    raise exception 'UNEXPECTED_TIME_ENTRY_WRITE_DEFINITION';
  end if;
  definition := replace(definition,'minutes,description,billing_status,billed_at,billing_record_id) values',
    'minutes,description,travel_kilometers,travel_rate,billing_status,billed_at,billing_record_id) values');
  definition := replace(definition,'nullif(p_payload->>''description'',''''),coalesce(nullif(p_payload->>''billingStatus'',''''),''offen'')',
    'nullif(p_payload->>''description'',''''),public.homecare_text_to_numeric(p_payload->>''travelKilometers''),public.homecare_text_to_numeric(p_payload->>''travelRate''),coalesce(nullif(p_payload->>''billingStatus'',''''),''offen'')');
  definition := replace(definition,'description=coalesce(p_payload->>''description'',description),billing_status=',
    'description=coalesce(p_payload->>''description'',description),travel_kilometers=case when p_payload?''travelKilometers'' then public.homecare_text_to_numeric(p_payload->>''travelKilometers'') else travel_kilometers end,travel_rate=case when p_payload?''travelRate'' then public.homecare_text_to_numeric(p_payload->>''travelRate'') else travel_rate end,billing_status=');
  if definition=before_definition or position('public.homecare_text_to_numeric(p_payload->>''travelRate''),coalesce' in definition)=0 then raise exception 'TIME_ENTRY_TRAVEL_WRITE_NOT_EXTENDED'; end if;
  execute definition;
end $$;

create function public.homecare_protect_billed_travel_costs() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.billing_status <> 'offen' and
    (new.travel_kilometers is distinct from old.travel_kilometers or new.travel_rate is distinct from old.travel_rate) then
    raise exception 'BILLED_ENTRY_TRAVEL_READ_ONLY' using errcode='23514';
  end if;
  return new;
end $$;
create trigger protect_billed_travel_costs before update on public.homecare_job_time_entries
  for each row execute function public.homecare_protect_billed_travel_costs();
revoke all on function public.homecare_protect_billed_travel_costs() from public,anon,authenticated;

commit;
