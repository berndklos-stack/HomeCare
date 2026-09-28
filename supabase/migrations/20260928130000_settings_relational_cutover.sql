-- Phase 3B: relational authority for tenant/company/mail/translation settings.

alter table public.homecare_settings
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.homecare_translations
  add column if not exists revision bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.homecare_tenants
  add column if not exists settings_revision bigint not null default 1;

drop trigger if exists bump_revision on public.homecare_settings;
create trigger bump_revision before update on public.homecare_settings
for each row execute function public.homecare_bump_revision();

drop trigger if exists bump_revision on public.homecare_translations;
create trigger bump_revision before update on public.homecare_translations
for each row execute function public.homecare_bump_revision();

create index if not exists homecare_settings_tenant_live_idx
  on public.homecare_settings(tenant_id, key)
  where deleted_at is null;

create index if not exists homecare_translations_tenant_live_idx
  on public.homecare_translations(tenant_id, key)
  where deleted_at is null;

-- Import section values first, then full-snapshot values. Existing relational
-- rows and tombstones always win.
with legacy_settings as (
  select
    state.tenant_id,
    replace(state.id, 'sync-section:', '') setting_key,
    state.data->'value' setting_value,
    state.updated_at
  from public.app_state state
  where state.id in ('sync-section:companySettings', 'sync-section:dailyMailSettings')
    and state.data ? 'value'
), full_snapshot_settings as (
  select state.tenant_id, setting.key, setting.value, state.updated_at
  from public.app_state state
  cross join lateral (values
    ('companySettings', state.data->'companySettings'),
    ('dailyMailSettings', state.data->'dailyMailSettings')
  ) setting(key, value)
  where state.id = 'kolaretorp-service-app' and setting.value is not null
), setting_candidates as (
  select distinct on (tenant_id, setting_key)
    tenant_id, setting_key, setting_value, updated_at
  from (
    select tenant_id, setting_key, setting_value, updated_at from legacy_settings
    union all
    select tenant_id, key, value, updated_at from full_snapshot_settings
  ) candidates
  order by tenant_id, setting_key, updated_at desc
)
insert into public.homecare_settings (tenant_id, key, value, updated_at)
select tenant_id, setting_key, setting_value, coalesce(updated_at, now())
from setting_candidates
on conflict (tenant_id, key) do nothing;

with section_translations as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'value') = 'array' then state.data->'value' else '[]'::jsonb end
  ) item
  where state.id = 'sync-section:translationOverrides'
), snapshot_translations as (
  select state.tenant_id, item, state.updated_at
  from public.app_state state
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(state.data->'translationOverrides') = 'array' then state.data->'translationOverrides' else '[]'::jsonb end
  ) item
  where state.id = 'kolaretorp-service-app'
), translation_candidates as (
  select distinct on (tenant_id, item->>'key') tenant_id, item, updated_at
  from (
    select * from section_translations
    union all
    select * from snapshot_translations
  ) candidates
  where nullif(item->>'key', '') is not null
  order by tenant_id, item->>'key', updated_at desc
)
insert into public.homecare_translations (tenant_id, key, de, sv, en, updated_at)
select
  tenant_id,
  item->>'key',
  coalesce(item->>'de', item->>'key'),
  coalesce(item->>'sv', item->>'key'),
  coalesce(item->>'en', item->>'key'),
  coalesce(updated_at, now())
from translation_candidates
on conflict (tenant_id, key) do nothing;

-- Recover JSON-only tenant plan/module settings without trusting a payload
-- tenant ID. app_state.tenant_id is the ownership boundary.
with tenant_candidates as (
  select distinct on (state.tenant_id)
    state.tenant_id,
    state.data->'value' value,
    state.updated_at
  from public.app_state state
  where state.id = 'sync-section:tenantSettings'
    and jsonb_typeof(state.data->'value') = 'object'
  order by state.tenant_id, state.updated_at desc
)
update public.homecare_tenants tenant
set
  name = coalesce(nullif(candidate.value->>'name', ''), tenant.name),
  subscription_status = case
    when candidate.value->>'subscriptionStatus' in ('trialing','active','past_due','paused','cancelled')
      then (candidate.value->>'subscriptionStatus')::public.homecare_subscription_status
    else tenant.subscription_status
  end,
  subscription_interval = case
    when candidate.value->>'subscriptionInterval' in ('monthly','quarterly','yearly')
      then (candidate.value->>'subscriptionInterval')::public.homecare_subscription_interval
    else tenant.subscription_interval
  end
from tenant_candidates candidate
where tenant.id = candidate.tenant_id
  and candidate.updated_at > tenant.updated_at;

with tenant_candidates as (
  select distinct on (state.tenant_id) state.tenant_id, state.data->'value' value, state.updated_at
  from public.app_state state
  where state.id = 'sync-section:tenantSettings'
    and jsonb_typeof(state.data->'value') = 'object'
  order by state.tenant_id, state.updated_at desc
)
insert into public.homecare_subscriptions (tenant_id, plan_id, status, interval, updated_at)
select
  candidate.tenant_id,
  concat(
    case when candidate.value->>'plan' in ('start','pro','business') then candidate.value->>'plan' else 'business' end,
    '_',
    case when candidate.value->>'subscriptionInterval' in ('monthly','quarterly','yearly') then candidate.value->>'subscriptionInterval' else 'monthly' end
  ),
  case when candidate.value->>'subscriptionStatus' in ('trialing','active','past_due','paused','cancelled')
    then (candidate.value->>'subscriptionStatus')::public.homecare_subscription_status else 'active' end,
  case when candidate.value->>'subscriptionInterval' in ('monthly','quarterly','yearly')
    then (candidate.value->>'subscriptionInterval')::public.homecare_subscription_interval else 'monthly' end,
  candidate.updated_at
from tenant_candidates candidate
where exists (select 1 from public.homecare_tenants tenant where tenant.id = candidate.tenant_id)
on conflict (tenant_id) do update set
  plan_id = excluded.plan_id,
  status = excluded.status,
  interval = excluded.interval,
  updated_at = excluded.updated_at
where excluded.updated_at > public.homecare_subscriptions.updated_at;

with tenant_modules as (
  select state.tenant_id, module.key module, module.value enabled, state.updated_at
  from public.app_state state
  cross join lateral jsonb_each(
    case when jsonb_typeof(state.data->'value'->'modules') = 'object'
      then state.data->'value'->'modules' else '{}'::jsonb end
  ) module
  where state.id = 'sync-section:tenantSettings'
)
insert into public.homecare_tenant_modules (tenant_id, module, enabled, source, updated_at)
select tenant_id, module::public.homecare_feature_module, coalesce((enabled #>> '{}')::boolean, true), 'legacy-import', updated_at
from tenant_modules
where module in ('jobs','reports','time_tracking','billing','inventory','logbook','customer_portal','dispatch','documents','ai','integrations')
on conflict (tenant_id, module) do update set
  enabled = excluded.enabled,
  source = excluded.source,
  updated_at = excluded.updated_at
where excluded.updated_at > public.homecare_tenant_modules.updated_at;

create table if not exists public.homecare_daily_mail_state (
  tenant_id uuid primary key references public.homecare_tenants(id) on delete cascade,
  last_sent_at timestamptz,
  last_sent_date date,
  last_sent_key text,
  sent_keys jsonb not null default '[]'::jsonb,
  pending_send_key text,
  pending_since timestamptz,
  last_open_job_count integer not null default 0,
  last_birthday_count integer not null default 0,
  last_calendar_event_count integer not null default 0,
  last_reminder_count integer not null default 0,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homecare_daily_mail_state_sent_keys_ck check (jsonb_typeof(sent_keys) = 'array')
);

drop trigger if exists set_updated_at on public.homecare_daily_mail_state;
create trigger set_updated_at before update on public.homecare_daily_mail_state
for each row execute function public.set_homecare_updated_at();
drop trigger if exists bump_revision on public.homecare_daily_mail_state;
create trigger bump_revision before update on public.homecare_daily_mail_state
for each row execute function public.homecare_bump_revision();

insert into public.homecare_daily_mail_state (
  tenant_id, last_sent_at, last_sent_date, last_sent_key, sent_keys,
  last_open_job_count, last_birthday_count, last_calendar_event_count, last_reminder_count
)
select
  state.tenant_id,
  nullif(state.data->>'lastSentAt', '')::timestamptz,
  nullif(state.data->>'lastSentDate', '')::date,
  nullif(state.data->>'lastSentKey', ''),
  case when jsonb_typeof(state.data->'sentKeys') = 'array' then state.data->'sentKeys' else '[]'::jsonb end,
  coalesce((state.data->>'lastOpenJobCount')::integer, 0),
  coalesce((state.data->>'lastBirthdayCount')::integer, 0),
  coalesce((state.data->>'lastCalendarEventCount')::integer, 0),
  coalesce((state.data->>'lastReminderCount')::integer, 0)
from public.app_state state
where state.id = 'kolaretorp-daily-job-mail'
on conflict (tenant_id) do nothing;

alter table public.homecare_daily_mail_state enable row level security;
revoke all on table public.homecare_daily_mail_state from public, anon, authenticated;
grant select, insert, update, delete on table public.homecare_daily_mail_state to service_role;

create or replace function public.homecare_claim_daily_mail_send(
  p_tenant_id uuid,
  p_send_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  state public.homecare_daily_mail_state%rowtype;
begin
  if p_tenant_id is null or nullif(p_send_key, '') is null then
    raise exception 'Mandant und Sendeschlüssel sind erforderlich.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':daily-mail:' || p_send_key));
  insert into public.homecare_daily_mail_state (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;
  select * into state from public.homecare_daily_mail_state
  where tenant_id = p_tenant_id for update;
  if state.last_sent_key = p_send_key or state.sent_keys ? p_send_key then return false; end if;
  if state.pending_send_key = p_send_key and state.pending_since > now() - interval '15 minutes' then return false; end if;
  update public.homecare_daily_mail_state
  set pending_send_key = p_send_key, pending_since = now()
  where tenant_id = p_tenant_id;
  return true;
end;
$$;

create or replace function public.homecare_complete_daily_mail_send(
  p_tenant_id uuid,
  p_send_key text,
  p_sent_date date,
  p_open_job_count integer,
  p_birthday_count integer,
  p_calendar_count integer,
  p_reminder_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.homecare_daily_mail_state
  set
    last_sent_at = now(),
    last_sent_date = p_sent_date,
    last_sent_key = p_send_key,
    sent_keys = coalesce((
      select jsonb_agg(distinct entry.value)
      from jsonb_array_elements_text(sent_keys || jsonb_build_array(p_send_key)) as entry(value)
      where entry.value like p_sent_date::text || '-%'
    ), '[]'::jsonb),
    pending_send_key = null,
    pending_since = null,
    last_open_job_count = greatest(coalesce(p_open_job_count, 0), 0),
    last_birthday_count = greatest(coalesce(p_birthday_count, 0), 0),
    last_calendar_event_count = greatest(coalesce(p_calendar_count, 0), 0),
    last_reminder_count = greatest(coalesce(p_reminder_count, 0), 0)
  where tenant_id = p_tenant_id and pending_send_key = p_send_key;
end;
$$;

create or replace function public.homecare_release_daily_mail_send(p_tenant_id uuid, p_send_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.homecare_daily_mail_state
  set pending_send_key = null, pending_since = null
  where tenant_id = p_tenant_id and pending_send_key = p_send_key;
$$;

create or replace function public.homecare_apply_settings_mutation(
  p_mutation_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_resource_id text,
  p_tenant_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_mutation public.homecare_sync_mutations%rowtype;
  setting_row public.homecare_settings%rowtype;
  translation_row public.homecare_translations%rowtype;
  tenant_row public.homecare_tenants%rowtype;
  response jsonb;
  tenant uuid := p_tenant_id;
  modules jsonb := coalesce(p_payload->'modules', '{}'::jsonb);
  plan text;
  interval_value text;
  status_value text;
begin
  if tenant is null then raise exception 'Mandant fehlt.' using errcode = '22023'; end if;
  if p_entity_type not in ('setting','tenant_settings','translation') then
    raise exception 'Nicht unterstützte Settings-Mutation: %', p_entity_type using errcode = '22023';
  end if;
  if p_operation not in ('create','update','delete','restore') then
    raise exception 'Unbekannte Settings-Operation: %', p_operation using errcode = '22023';
  end if;
  if p_entity_type = 'setting' and p_entity_id not in ('companySettings','dailyMailSettings') then
    raise exception 'Unzulässiger Settings-Schlüssel.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(tenant::text || ':' || p_mutation_id::text));
  select * into existing_mutation from public.homecare_sync_mutations
  where tenant_id = tenant and mutation_id = p_mutation_id;
  if found and existing_mutation.status in ('synced','conflict') then return existing_mutation.response_payload; end if;

  insert into public.homecare_sync_mutations (
    mutation_id, tenant_id, entity_type, entity_id, operation, status,
    expected_revision, request_payload
  ) values (
    p_mutation_id, tenant, p_entity_type, p_entity_id, p_operation, 'syncing',
    p_expected_revision, coalesce(p_payload, '{}'::jsonb)
  ) on conflict (tenant_id, mutation_id) do update set status = 'syncing', updated_at = now();

  if p_entity_type = 'setting' then
    select * into setting_row from public.homecare_settings
    where tenant_id = tenant and key = p_entity_id for update;
    if p_operation = 'create' then
      if found then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(setting_row),'error','Die Einstellung existiert bereits.');
      else
        insert into public.homecare_settings (tenant_id, key, value, revision, deleted_at)
        values (tenant, p_entity_id, coalesce(p_payload->'value', p_payload), 1, null)
        returning * into setting_row;
      end if;
    elsif not found then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Einstellung existiert nicht.');
    elsif p_expected_revision is not null and setting_row.revision <> p_expected_revision then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(setting_row),'error','Die Einstellung wurde auf einem anderen Gerät geändert.');
    elsif p_operation = 'delete' then
      update public.homecare_settings set deleted_at = now(), revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into setting_row;
    elsif p_operation = 'restore' then
      update public.homecare_settings set deleted_at = null, revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into setting_row;
    else
      update public.homecare_settings
      set value = coalesce(p_payload->'value', p_payload), deleted_at = null, revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into setting_row;
    end if;
    if response is null then response := jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(setting_row)); end if;

  elsif p_entity_type = 'translation' then
    select * into translation_row from public.homecare_translations
    where tenant_id = tenant and key = p_entity_id for update;
    if p_operation = 'create' then
      if found then
        response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(translation_row),'error','Die Übersetzung existiert bereits.');
      else
        insert into public.homecare_translations (tenant_id, key, de, sv, en, revision, deleted_at)
        values (tenant, p_entity_id, coalesce(p_payload->>'de',p_entity_id), coalesce(p_payload->>'sv',p_entity_id), coalesce(p_payload->>'en',p_entity_id), 1, null)
        returning * into translation_row;
      end if;
    elsif not found then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Die Übersetzung existiert nicht.');
    elsif p_expected_revision is not null and translation_row.revision <> p_expected_revision then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(translation_row),'error','Die Übersetzung wurde auf einem anderen Gerät geändert.');
    elsif p_operation = 'delete' then
      update public.homecare_translations set deleted_at = now(), revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into translation_row;
    elsif p_operation = 'restore' then
      update public.homecare_translations set deleted_at = null, revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into translation_row;
    else
      update public.homecare_translations
      set de = coalesce(p_payload->>'de',de), sv = coalesce(p_payload->>'sv',sv), en = coalesce(p_payload->>'en',en),
          deleted_at = null, revision = revision + 1
      where tenant_id = tenant and key = p_entity_id returning * into translation_row;
    end if;
    if response is null then response := jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(translation_row)); end if;

  else
    select * into tenant_row from public.homecare_tenants where id = tenant for update;
    if not found then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'error','Der Mandant existiert nicht.');
    elsif p_operation in ('delete','restore','create') then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(tenant_row),'error','Der Mandantenstammsatz kann über Settings nicht angelegt oder gelöscht werden.');
    elsif p_expected_revision is not null and tenant_row.settings_revision <> p_expected_revision then
      response := jsonb_build_object('status','conflict','mutationId',p_mutation_id,'record',to_jsonb(tenant_row),'error','Die Mandanteneinstellungen wurden auf einem anderen Gerät geändert.');
    else
      plan := case when p_payload->>'plan' in ('start','pro','business') then p_payload->>'plan' else 'business' end;
      interval_value := case when p_payload->>'subscriptionInterval' in ('monthly','quarterly','yearly') then p_payload->>'subscriptionInterval' else 'monthly' end;
      status_value := case when p_payload->>'subscriptionStatus' in ('trialing','active','past_due','paused','cancelled') then p_payload->>'subscriptionStatus' else 'active' end;
      update public.homecare_tenants
      set name = coalesce(nullif(p_payload->>'name',''),name),
          subscription_status = status_value::public.homecare_subscription_status,
          subscription_interval = interval_value::public.homecare_subscription_interval,
          settings_revision = settings_revision + 1
      where id = tenant returning * into tenant_row;
      insert into public.homecare_subscriptions (tenant_id, plan_id, status, interval)
      values (tenant, plan || '_' || interval_value, status_value::public.homecare_subscription_status, interval_value::public.homecare_subscription_interval)
      on conflict (tenant_id) do update set plan_id=excluded.plan_id,status=excluded.status,interval=excluded.interval;
      delete from public.homecare_tenant_modules module_row
      where module_row.tenant_id = tenant and not (modules ? module_row.module::text);
      insert into public.homecare_tenant_modules (tenant_id,module,enabled,source)
      select tenant, item.key::public.homecare_feature_module, coalesce((item.value #>> '{}')::boolean,true), 'manual'
      from jsonb_each(modules) item
      where item.key in ('jobs','reports','time_tracking','billing','inventory','logbook','customer_portal','dispatch','documents','ai','integrations')
      on conflict (tenant_id,module) do update set enabled=excluded.enabled,source='manual';
      response := jsonb_build_object('status','synced','mutationId',p_mutation_id,'record',to_jsonb(tenant_row));
    end if;
  end if;

  update public.homecare_sync_mutations
  set applied_at = case when response->>'status'='synced' then now() else null end,
      error = response->>'error', response_payload = response,
      status = response->>'status', updated_at = now()
  where tenant_id = tenant and mutation_id = p_mutation_id;
  return response;
end;
$$;

revoke all on function public.homecare_apply_settings_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.homecare_apply_settings_mutation(uuid,text,text,text,text,uuid,jsonb,bigint) to service_role;
revoke all on function public.homecare_claim_daily_mail_send(uuid,text) from public, anon, authenticated;
revoke all on function public.homecare_complete_daily_mail_send(uuid,text,date,integer,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.homecare_release_daily_mail_send(uuid,text) from public, anon, authenticated;
grant execute on function public.homecare_claim_daily_mail_send(uuid,text) to service_role;
grant execute on function public.homecare_complete_daily_mail_send(uuid,text,date,integer,integer,integer,integer) to service_role;
grant execute on function public.homecare_release_daily_mail_send(uuid,text) to service_role;
