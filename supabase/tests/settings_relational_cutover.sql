-- Run after 20260928130000_settings_relational_cutover.sql in a disposable database.
-- The transaction always rolls back.
begin;

insert into public.homecare_tenants (id, slug, name)
values
  ('60000000-0000-0000-0000-000000000001', 'settings-cutover-a', 'Settings cutover A'),
  ('60000000-0000-0000-0000-000000000002', 'settings-cutover-b', 'Settings cutover B')
on conflict (id) do update set slug = excluded.slug, name = excluded.name;

create temporary table settings_results (key text primary key, result jsonb not null);

insert into settings_results values (
  'company-create',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000001', 'setting', 'companySettings', 'create',
    'companySettings', '60000000-0000-0000-0000-000000000001',
    '{"value":{"name":"Company A","currency":"SEK"}}'::jsonb, null
  )
);

insert into settings_results values (
  'company-retry',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000001', 'setting', 'companySettings', 'create',
    'companySettings', '60000000-0000-0000-0000-000000000001', '{}'::jsonb, null
  )
);

insert into settings_results values (
  'company-update',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000002', 'setting', 'companySettings', 'update',
    'companySettings', '60000000-0000-0000-0000-000000000001',
    '{"value":{"name":"Company A updated","currency":"EUR"}}'::jsonb, 1
  )
);

insert into settings_results values (
  'company-stale',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000003', 'setting', 'companySettings', 'update',
    'companySettings', '60000000-0000-0000-0000-000000000001',
    '{"value":{"name":"Must not win"}}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from settings_results where key = 'company-create') <> 'synced'
    or (select result from settings_results where key = 'company-create') <> (select result from settings_results where key = 'company-retry')
    or (select result->>'status' from settings_results where key = 'company-update') <> 'synced'
    or (select result->>'status' from settings_results where key = 'company-stale') <> 'conflict'
    or (select revision from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'companySettings') <> 2
    or (select value->>'name' from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'companySettings') <> 'Company A updated'
    or (select count(*) from public.homecare_sync_mutations where tenant_id = '60000000-0000-0000-0000-000000000001' and mutation_id = '61000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'SETTING_CREATE_UPDATE_IDEMPOTENCY_OR_REVISION_FAILED';
  end if;
end;
$$;

insert into settings_results values (
  'company-delete',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000004', 'setting', 'companySettings', 'delete',
    'companySettings', '60000000-0000-0000-0000-000000000001', '{}'::jsonb, 2
  )
);

insert into public.app_state (tenant_id, id, data)
values (
  '60000000-0000-0000-0000-000000000001', 'sync-section:companySettings',
  '{"value":{"name":"Legacy resurrection"}}'::jsonb
)
on conflict (tenant_id, id) do update set data = excluded.data;

insert into settings_results values (
  'company-restore',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000005', 'setting', 'companySettings', 'restore',
    'companySettings', '60000000-0000-0000-0000-000000000001', '{}'::jsonb, 3
  )
);

do $$
begin
  if (select result->>'status' from settings_results where key = 'company-delete') <> 'synced'
    or (select result->>'status' from settings_results where key = 'company-restore') <> 'synced'
    or (select revision from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'companySettings') <> 4
    or (select value->>'name' from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'companySettings') = 'Legacy resurrection' then
    raise exception 'SETTING_TOMBSTONE_RESTORE_OR_NO_RESURRECTION_FAILED';
  end if;
end;
$$;

insert into settings_results values (
  'daily-a',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000006', 'setting', 'dailyMailSettings', 'create',
    'dailyMailSettings', '60000000-0000-0000-0000-000000000001',
    '{"value":{"enabled":true,"sendTime":"06:00"}}'::jsonb, null
  )
), (
  'daily-b',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000006', 'setting', 'dailyMailSettings', 'create',
    'dailyMailSettings', '60000000-0000-0000-0000-000000000002',
    '{"value":{"enabled":false,"sendTime":"08:00"}}'::jsonb, null
  )
);

do $$
begin
  if (select value->>'sendTime' from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'dailyMailSettings') <> '06:00'
    or (select value->>'sendTime' from public.homecare_settings where tenant_id = '60000000-0000-0000-0000-000000000002' and key = 'dailyMailSettings') <> '08:00'
    or (select count(*) from public.homecare_sync_mutations where mutation_id = '61000000-0000-0000-0000-000000000006') <> 2 then
    raise exception 'DAILY_MAIL_TENANT_SCOPE_OR_MUTATION_SCOPE_FAILED';
  end if;
end;
$$;

insert into settings_results values (
  'translation-create',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000007', 'translation', 'Arbeitszeit', 'create',
    'Arbeitszeit', '60000000-0000-0000-0000-000000000001',
    '{"de":"Arbeitszeit","sv":"Arbetstid","en":"Working time"}'::jsonb, null
  )
), (
  'translation-other-tenant',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000008', 'translation', 'Arbeitszeit', 'create',
    'Arbeitszeit', '60000000-0000-0000-0000-000000000002',
    '{"de":"Mandant B","sv":"Tenant B","en":"Tenant B"}'::jsonb, null
  )
);

insert into settings_results values (
  'translation-delete',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000009', 'translation', 'Arbeitszeit', 'delete',
    'Arbeitszeit', '60000000-0000-0000-0000-000000000001', '{}'::jsonb, 1
  )
);

do $$
begin
  if not exists (
      select 1 from public.homecare_translations
      where tenant_id = '60000000-0000-0000-0000-000000000001' and key = 'Arbeitszeit' and deleted_at is not null and revision = 2
    )
    or (select de from public.homecare_translations where tenant_id = '60000000-0000-0000-0000-000000000002' and key = 'Arbeitszeit') <> 'Mandant B' then
    raise exception 'TRANSLATION_TOMBSTONE_OR_TENANT_SCOPE_FAILED';
  end if;
end;
$$;

insert into settings_results values (
  'tenant-update',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000010', 'tenant_settings', 'payload-tenant-must-be-ignored', 'update',
    'payload-tenant-must-be-ignored', '60000000-0000-0000-0000-000000000001',
    '{"id":"60000000-0000-0000-0000-000000000002","name":"Tenant A renamed","plan":"pro","subscriptionStatus":"active","subscriptionInterval":"yearly","modules":{"jobs":true,"billing":false}}'::jsonb,
    1
  )
);

insert into settings_results values (
  'tenant-stale',
  public.homecare_apply_settings_mutation(
    '61000000-0000-0000-0000-000000000011', 'tenant_settings', 'ignored', 'update',
    'ignored', '60000000-0000-0000-0000-000000000001',
    '{"name":"Must not win","modules":{}}'::jsonb, 1
  )
);

do $$
begin
  if (select result->>'status' from settings_results where key = 'tenant-update') <> 'synced'
    or (select result->>'status' from settings_results where key = 'tenant-stale') <> 'conflict'
    or (select name from public.homecare_tenants where id = '60000000-0000-0000-0000-000000000001') <> 'Tenant A renamed'
    or (select name from public.homecare_tenants where id = '60000000-0000-0000-0000-000000000002') <> 'Settings cutover B'
    or not exists (select 1 from public.homecare_subscriptions where tenant_id = '60000000-0000-0000-0000-000000000001' and plan_id = 'pro_yearly')
    or not exists (select 1 from public.homecare_tenant_modules where tenant_id = '60000000-0000-0000-0000-000000000001' and module = 'billing' and enabled = false) then
    raise exception 'TENANT_SETTINGS_REVISION_OR_SCOPE_FAILED';
  end if;
end;
$$;

do $$
declare
  first_claim boolean;
  second_claim boolean;
  other_tenant_claim boolean;
begin
  first_claim := public.homecare_claim_daily_mail_send('60000000-0000-0000-0000-000000000001', '2026-09-28-06:00');
  second_claim := public.homecare_claim_daily_mail_send('60000000-0000-0000-0000-000000000001', '2026-09-28-06:00');
  other_tenant_claim := public.homecare_claim_daily_mail_send('60000000-0000-0000-0000-000000000002', '2026-09-28-06:00');
  if not first_claim or second_claim or not other_tenant_claim then
    raise exception 'DAILY_MAIL_ATOMIC_CLAIM_OR_TENANT_ISOLATION_FAILED';
  end if;
  perform public.homecare_complete_daily_mail_send(
    '60000000-0000-0000-0000-000000000001', '2026-09-28-06:00', '2026-09-28', 4, 1, 2, 3
  );
  if public.homecare_claim_daily_mail_send('60000000-0000-0000-0000-000000000001', '2026-09-28-06:00') then
    raise exception 'DAILY_MAIL_COMPLETED_KEY_RECLAIMED';
  end if;
  perform public.homecare_release_daily_mail_send('60000000-0000-0000-0000-000000000002', '2026-09-28-06:00');
end;
$$;

do $$
begin
  if (select last_open_job_count from public.homecare_daily_mail_state where tenant_id = '60000000-0000-0000-0000-000000000001') <> 4
    or (select pending_send_key from public.homecare_daily_mail_state where tenant_id = '60000000-0000-0000-0000-000000000002') is not null then
    raise exception 'DAILY_MAIL_STATE_COMPLETION_OR_RELEASE_FAILED';
  end if;
end;
$$;

rollback;
