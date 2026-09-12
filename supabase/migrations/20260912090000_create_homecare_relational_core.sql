create extension if not exists pgcrypto;

create table if not exists public.homecare_customers (
  id text primary key,
  personal_number text,
  name text not null,
  contact text,
  email text,
  phone text,
  phone2 text,
  address text,
  billing_address text,
  billing_address_mode text not null default 'Kundenadresse',
  language text not null default 'Deutsch',
  portal_login_email text,
  portal_password text,
  portal_status text not null default 'einladen',
  balance numeric(12,2) not null default 0,
  notes text,
  report_mail_body text,
  weekly_report_mail_body text,
  offer_mail_body text,
  order_confirmation_mail_body text,
  work_time_visibility text not null default 'service',
  billable boolean not null default true,
  archived boolean not null default false,
  portal_login_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_objects (
  id text primary key,
  owner_customer_id text references public.homecare_customers(id) on delete set null,
  name text not null,
  owner_name text,
  owner_email text,
  owner_phone text,
  owner_address text,
  address text,
  billing_address_mode text not null default 'Objektadresse',
  billing_address text,
  region text,
  size_sqm integer,
  plot_sqm integer,
  rooms integer,
  beds integer,
  bathrooms integer,
  build_year integer,
  care_package text,
  status text,
  key_safe text,
  alarm text,
  parking text,
  access_notes text,
  heating text,
  water text,
  septic text,
  internet text,
  equipment jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_visit date,
  last_visit date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_media (
  id text primary key,
  owner_type text not null,
  owner_id text not null,
  kind text not null,
  name text not null,
  description text,
  source text,
  storage_path text,
  preview_url text,
  is_primary boolean not null default false,
  customer_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_personnel (
  id text primary key,
  personnel_number text,
  first_name text not null,
  last_name text not null,
  role text,
  email text,
  phone text,
  language text not null default 'Deutsch',
  status text not null default 'aktiv',
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_services (
  id text primary key,
  accounting_account text,
  name text not null,
  category text,
  unit text,
  price numeric(12,2),
  currency text not null default 'SEK',
  tax_rate numeric(5,2),
  show_work_time_in_reports boolean,
  description text,
  checklist jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_service_packages (
  id text primary key,
  name text not null,
  price numeric(12,2),
  description text,
  service_ids jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_jobs (
  id text primary key,
  series_master_id text,
  series_occurrence_date date,
  title text not null,
  object_id text references public.homecare_objects(id) on delete set null,
  customer_id text references public.homecare_customers(id) on delete set null,
  type text,
  status text not null default 'geplant',
  status_updated_at timestamptz,
  reset_at timestamptz,
  priority text not null default 'normal',
  due_date date,
  start_date date,
  end_date date,
  execution_date date,
  assigned_to text,
  description text,
  internal_notes text,
  billable boolean not null default true,
  material text,
  work_minutes integer not null default 0,
  resource_ids jsonb not null default '[]'::jsonb,
  material_items jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  service_ids jsonb not null default '[]'::jsonb,
  service_quantities jsonb not null default '{}'::jsonb,
  service_discounts jsonb not null default '{}'::jsonb,
  custom_service jsonb,
  discount jsonb,
  schedule jsonb not null default '{}'::jsonb,
  execution_log jsonb not null default '[]'::jsonb,
  offer_number text,
  offer_sent_at timestamptz,
  order_confirmation_number text,
  order_confirmation_sent_at timestamptz,
  series_excluded_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_field_progress (
  id text primary key,
  job_id text not null,
  work_date date,
  task_id text not null,
  completed boolean not null default false,
  minutes integer,
  show_work_time_in_report boolean,
  note text,
  photos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_reports (
  id text primary key,
  job_id text references public.homecare_jobs(id) on delete set null,
  object_id text references public.homecare_objects(id) on delete set null,
  title text not null,
  report_date date,
  visible_to_customer boolean not null default false,
  summary text,
  internal_notes text,
  customer_comment text,
  checklist_results jsonb not null default '[]'::jsonb,
  media_ids jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_billing_items (
  id text primary key,
  object_id text references public.homecare_objects(id) on delete set null,
  customer_id text references public.homecare_customers(id) on delete set null,
  job_id text references public.homecare_jobs(id) on delete set null,
  report_id text references public.homecare_reports(id) on delete set null,
  source text,
  label text not null,
  amount numeric(12,2),
  status text not null default 'abrechenbar',
  invoice_status text,
  invoice_number text,
  invoice_date date,
  due_date date,
  service_date date,
  lines jsonb not null default '[]'::jsonb,
  notes text,
  external_export_status text,
  external_export_system text,
  external_exported_at timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_accounting_accounts (
  account text primary key,
  category text not null,
  label text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_inventory_locations (
  id text primary key,
  name text not null,
  site text,
  note text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_materials (
  id text primary key,
  accounting_account text,
  sku text,
  name text not null,
  category text,
  unit text,
  sales_price numeric(12,2),
  purchase_price numeric(12,2),
  currency text not null default 'SEK',
  tax_rate numeric(5,2),
  supplier text,
  primary_location_id text references public.homecare_inventory_locations(id) on delete set null,
  min_stock numeric(12,3),
  max_stock numeric(12,3),
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_inventory_movements (
  id text primary key,
  material_id text not null references public.homecare_materials(id) on delete cascade,
  location_id text references public.homecare_inventory_locations(id) on delete set null,
  movement_type text not null,
  quantity numeric(12,3) not null,
  counted_quantity numeric(12,3),
  note text,
  supplier text,
  purchase_gross numeric(12,2),
  purchase_net numeric(12,2),
  purchase_tax_rate numeric(5,2),
  purchase_tax_amount numeric(12,2),
  customer_id text references public.homecare_customers(id) on delete set null,
  service_id text references public.homecare_services(id) on delete set null,
  billable_as_service boolean not null default false,
  receipt jsonb,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_resources (
  id text primary key,
  type text not null,
  build_year text,
  name text not null,
  identifier text,
  status text,
  responsible_person_id text references public.homecare_personnel(id) on delete set null,
  location text,
  notes text,
  logbook_year text,
  odometer_year_start numeric(12,1),
  odometer_year_end numeric(12,1),
  tracking jsonb not null default '{}'::jsonb,
  maintenance_items jsonb not null default '[]'::jsonb,
  deleted_logbook_entry_ids jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_vehicle_trips (
  id text primary key,
  resource_id text not null references public.homecare_resources(id) on delete cascade,
  trip_date date not null,
  driver_id text references public.homecare_personnel(id) on delete set null,
  status text not null default 'abgeschlossen',
  started_at timestamptz,
  ended_at timestamptz,
  trip_type text not null default 'Dienstfahrt',
  start_address text,
  end_address text,
  start_coordinates jsonb,
  end_coordinates jsonb,
  waypoints jsonb not null default '[]'::jsonb,
  start_odometer numeric(12,1),
  end_odometer numeric(12,1),
  kilometers numeric(12,1),
  purpose text,
  visited text,
  fuel_or_charge text,
  fuel_receipt_photo jsonb,
  odometer_photos jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_vehicle_positions (
  resource_id text primary key references public.homecare_resources(id) on delete cascade,
  entry_id text,
  status text not null default 'active',
  source text,
  trip_date date,
  driver_id text references public.homecare_personnel(id) on delete set null,
  address text,
  coordinates jsonb,
  purpose text,
  trip_type text,
  visited text,
  start_odometer numeric(12,1),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_portal_messages (
  id text primary key,
  customer_id text references public.homecare_customers(id) on delete set null,
  object_id text references public.homecare_objects(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'neu',
  delivery_status text,
  delivery_error text,
  origin text,
  replies jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_translations (
  key text primary key,
  de text not null,
  sv text not null,
  en text not null,
  updated_at timestamptz not null default now()
);

create index if not exists homecare_objects_owner_customer_id_idx on public.homecare_objects(owner_customer_id);
create index if not exists homecare_jobs_object_id_idx on public.homecare_jobs(object_id);
create index if not exists homecare_jobs_customer_id_idx on public.homecare_jobs(customer_id);
create index if not exists homecare_jobs_due_date_idx on public.homecare_jobs(due_date);
create index if not exists homecare_jobs_status_idx on public.homecare_jobs(status);
create index if not exists homecare_reports_job_date_idx on public.homecare_reports(job_id, report_date);
create index if not exists homecare_field_progress_job_date_idx on public.homecare_field_progress(job_id, work_date);
create index if not exists homecare_media_owner_idx on public.homecare_media(owner_type, owner_id);
create index if not exists homecare_inventory_movements_material_idx on public.homecare_inventory_movements(material_id, created_at);
create index if not exists homecare_inventory_movements_location_idx on public.homecare_inventory_movements(location_id);
create index if not exists homecare_vehicle_trips_resource_date_idx on public.homecare_vehicle_trips(resource_id, trip_date);
create index if not exists homecare_vehicle_positions_updated_at_idx on public.homecare_vehicle_positions(updated_at);

create or replace function public.set_homecare_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'homecare_accounting_accounts',
    'homecare_billing_items',
    'homecare_customers',
    'homecare_inventory_locations',
    'homecare_inventory_movements',
    'homecare_jobs',
    'homecare_materials',
    'homecare_media',
    'homecare_objects',
    'homecare_personnel',
    'homecare_portal_messages',
    'homecare_reports',
    'homecare_resources',
    'homecare_service_packages',
    'homecare_services',
    'homecare_translations',
    'homecare_vehicle_trips',
    'homecare_vehicle_positions'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_homecare_updated_at()',
      table_name
    );
  end loop;
end $$;

alter table public.homecare_customers enable row level security;
alter table public.homecare_objects enable row level security;
alter table public.homecare_media enable row level security;
alter table public.homecare_personnel enable row level security;
alter table public.homecare_services enable row level security;
alter table public.homecare_service_packages enable row level security;
alter table public.homecare_jobs enable row level security;
alter table public.homecare_field_progress enable row level security;
alter table public.homecare_reports enable row level security;
alter table public.homecare_billing_items enable row level security;
alter table public.homecare_accounting_accounts enable row level security;
alter table public.homecare_inventory_locations enable row level security;
alter table public.homecare_materials enable row level security;
alter table public.homecare_inventory_movements enable row level security;
alter table public.homecare_resources enable row level security;
alter table public.homecare_vehicle_trips enable row level security;
alter table public.homecare_vehicle_positions enable row level security;
alter table public.homecare_portal_messages enable row level security;
alter table public.homecare_translations enable row level security;
