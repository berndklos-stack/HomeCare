create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "public read app demo state" on public.app_state;
create policy "public read app demo state"
  on public.app_state for select
  using (true);

drop policy if exists "public insert app demo state" on public.app_state;
create policy "public insert app demo state"
  on public.app_state for insert
  with check (true);

drop policy if exists "public update app demo state" on public.app_state;
create policy "public update app demo state"
  on public.app_state for update
  using (true)
  with check (true);
