create type public.user_role as enum ('admin', 'office', 'field_staff', 'owner');
create type public.job_status as enum (
  'planned',
  'in_progress',
  'waiting_for_approval',
  'approved',
  'completed',
  'billed',
  'paused',
  'done',
  'sent',
  'cancelled'
);
create type public.media_kind as enum ('photo', 'video', 'voice', 'document');
create type public.billing_status as enum ('not_billable', 'billable', 'billed');
create type public.message_status as enum ('draft', 'sent', 'read');

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
  size_sqm integer,
  rooms integer,
  beds integer,
  bathrooms integer,
  care_package text,
  key_safe text,
  equipment text[] not null default '{}',
  risk_notes text,
  image_urls text[] not null default '{}',
  document_urls text[] not null default '{}',
  access_notes text,
  care_notes text,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  service_type text not null default 'additional_service',
  category text,
  interval_label text,
  price_amount numeric(10,2),
  price_currency text not null default 'SEK',
  billing_unit text,
  checks_per_year integer,
  included_items text[] not null default '{}',
  sla text,
  is_active boolean not null default true
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  title text not null,
  description text,
  status public.job_status not null default 'planned',
  priority text not null default 'normal',
  due_date date,
  scheduled_for timestamptz,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  internal_notes text,
  customer_visible_notes text,
  billing_status public.billing_status not null default 'billable',
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
  customer_summary text,
  internal_summary text,
  is_customer_visible boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  report_id uuid references public.job_reports(id) on delete set null,
  kind public.media_kind not null,
  url text not null,
  caption text,
  is_customer_visible boolean not null default true,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  property_id uuid references public.properties(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  internal_note text,
  status public.message_status not null default 'draft',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.billing_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  property_id uuid references public.properties(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  description text not null,
  work_minutes integer not null default 0,
  material_amount numeric(10,2) not null default 0,
  flat_amount numeric(10,2) not null default 0,
  customer_visible_amount numeric(10,2),
  internal_cost numeric(10,2),
  status public.billing_status not null default 'billable',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.jobs enable row level security;
alter table public.job_checklist_items enable row level security;
alter table public.job_reports enable row level security;
alter table public.job_media enable row level security;
alter table public.customer_messages enable row level security;
alter table public.billing_items enable row level security;

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

create policy "owners see customer visible media"
  on public.job_media for select
  using (
    is_customer_visible
    and exists (
      select 1
      from public.jobs
      join public.properties on properties.id = jobs.property_id
      where jobs.id = job_media.job_id
      and properties.owner_id = auth.uid()
    )
  );

create policy "owners see own messages"
  on public.customer_messages for select
  using (customer_id = auth.uid());

create policy "owners see own customer visible billing"
  on public.billing_items for select
  using (
    customer_visible_amount is not null
    and customer_id = auth.uid()
  );
