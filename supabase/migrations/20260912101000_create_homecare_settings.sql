create table if not exists public.homecare_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists homecare_settings_updated_at on public.homecare_settings;
create trigger homecare_settings_updated_at
before update on public.homecare_settings
for each row execute function public.set_homecare_updated_at();

alter table public.homecare_settings enable row level security;

insert into public.homecare_settings (key, value, updated_at)
select
  replace(id, 'sync-section:', '') as key,
  coalesce(data->'value', 'null'::jsonb) as value,
  coalesce(updated_at, now()) as updated_at
from public.app_state
where id in (
  'sync-section:activeJobId',
  'sync-section:companySettings',
  'sync-section:dailyMailSettings',
  'sync-section:deletedEntityIds',
  'sync-section:deletedReportIds',
  'sync-section:fieldNotes'
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = greatest(public.homecare_settings.updated_at, excluded.updated_at);
