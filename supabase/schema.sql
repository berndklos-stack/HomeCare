create type public.user_role as enum ('admin', 'field_staff', 'owner');
create type public.job_status as enum (
  'planned',
  'in_progress',
  'waiting_for_approval',
  'approved',
  'sent',
  'completed',
  'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'owner',
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  region text not null default 'Småland',
  access_notes text,
  care_notes text,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  title text not null,
  description text,
  status public.job_status not null default 'planned',
  priority text not null default 'normal',
  scheduled_for timestamptz,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  report_text text not null,
  materials jsonb not null default '[]'::jsonb,
  work_minutes integer not null default 0,
  photo_urls text[] not null default '{}',
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.jobs enable row level security;
alter table public.job_checklist_items enable row level security;
alter table public.job_reports enable row level security;

create policy "profiles self access"
  on public.profiles for select
  using (auth.uid() = id);

create policy "owners see own properties"
  on public.properties for select
  using (owner_id = auth.uid());

create policy "owners see own jobs"
  on public.jobs for select
  using (
    exists (
      select 1 from public.properties
      where properties.id = jobs.property_id
      and properties.owner_id = auth.uid()
    )
  );

create policy "owners see own approved reports"
  on public.job_reports for select
  using (
    approved_at is not null
    and exists (
      select 1
      from public.jobs
      join public.properties on properties.id = jobs.property_id
      where jobs.id = job_reports.job_id
      and properties.owner_id = auth.uid()
    )
  );
