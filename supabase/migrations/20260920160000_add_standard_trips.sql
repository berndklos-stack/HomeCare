alter table public.homecare_resources
  add column if not exists standard_trips jsonb not null default '[]'::jsonb;
