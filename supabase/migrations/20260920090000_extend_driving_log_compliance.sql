alter table public.homecare_resources
  add column if not exists brand text,
  add column if not exists current_odometer numeric(12,1),
  add column if not exists current_odometer_date date,
  add column if not exists default_driver_id text references public.homecare_personnel(id) on delete set null,
  add column if not exists license_plate text,
  add column if not exists logbook_active boolean not null default true,
  add column if not exists model text,
  add column if not exists odometer_history jsonb not null default '[]'::jsonb,
  add column if not exists odometer_last_confirmed numeric(12,1),
  add column if not exists odometer_last_confirmed_at timestamptz,
  add column if not exists odometer_last_confirmed_by text references public.homecare_personnel(id) on delete set null,
  add column if not exists odometer_last_confirmed_photo jsonb,
  add column if not exists owner_company text,
  add column if not exists private_use_allowed boolean not null default true,
  add column if not exists registration_country text,
  add column if not exists tax_country text;

alter table public.homecare_vehicle_trips
  add column if not exists audit_log jsonb not null default '[]'::jsonb,
  add column if not exists end_address_resolved text,
  add column if not exists rule_country text,
  add column if not exists rule_title text,
  add column if not exists rule_version text,
  add column if not exists start_address_resolved text,
  add column if not exists trip_category text,
  add column if not exists validation_warnings jsonb not null default '[]'::jsonb;

create table if not exists public.homecare_driving_log_regulations (
  id text primary key,
  country_code text not null,
  rule_version text not null unique,
  title text not null,
  valid_from date not null,
  valid_until date,
  authority text not null,
  source_url text not null,
  pdf_storage_path text not null,
  summary jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_trip_audit_log (
  id text primary key,
  trip_id text not null references public.homecare_vehicle_trips(id) on delete cascade,
  resource_id text not null references public.homecare_resources(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  reason text not null,
  changed_by text references public.homecare_personnel(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.homecare_odometer_history (
  id text primary key,
  resource_id text not null references public.homecare_resources(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  odometer numeric(12,1) not null,
  source text not null,
  photo_present boolean not null default false,
  photo_reference text,
  user_id text references public.homecare_personnel(id) on delete set null,
  changed_reason text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists homecare_driving_log_regulations_country_validity_idx
  on public.homecare_driving_log_regulations(country_code, valid_from, valid_until);
create index if not exists homecare_trip_audit_log_trip_idx
  on public.homecare_trip_audit_log(trip_id, changed_at);
create index if not exists homecare_odometer_history_resource_idx
  on public.homecare_odometer_history(resource_id, recorded_at);

drop trigger if exists set_updated_at on public.homecare_driving_log_regulations;
create trigger set_updated_at
  before update on public.homecare_driving_log_regulations
  for each row execute function public.set_homecare_updated_at();

alter table public.homecare_driving_log_regulations enable row level security;
alter table public.homecare_trip_audit_log enable row level security;
alter table public.homecare_odometer_history enable row level security;

insert into public.homecare_driving_log_regulations (
  id, country_code, rule_version, title, valid_from, authority, source_url,
  pdf_storage_path, summary, active
) values
  (
    'REG-DE-2026', 'DE', 'DE-Fahrtenbuch-2026', 'Vorgaben Fahrtenbuch - Deutschland',
    '2026-01-01', 'Bundesministerium der Finanzen / Finanzverwaltung',
    'https://amtliche-handbuecher.bundesfinanzministerium.de/lsth/2025/A-Einkommensteuergesetz/II-Einkommen-2-24b/4-Ueberschuss-d-Einnahmen-ueber-die-Werbungsk-8-9a/Paragraf-8/h-8-1-9-10.html', '/regulations/DE-Fahrtenbuch-2026.pdf',
    '["Fahrtenbuch zeitnah und fortlaufend führen","Kilometerstände nachvollziehbar erfassen","Betriebliche Fahrten mit Zweck und Geschäftspartner dokumentieren","Änderungen nachvollziehbar protokollieren"]'::jsonb,
    true
  ),
  (
    'REG-SE-2026', 'SE', 'SE-Körjournal-2026', 'Vorgaben Körjournal - Schweden',
    '2026-01-01', 'Skatteverket',
    'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/formaner/bilforman/korjournal.4.18e1b10334ebe8bc8000695.html', '/regulations/SE-Korjournal-2026.pdf',
    '["Datum und Kilometerstände erfassen","Start, Ziel und Zweck der Fahrt dokumentieren","Private und dienstliche Fahrten trennen","Unterlagen nachvollziehbar aufbewahren"]'::jsonb,
    true
  )
on conflict (rule_version) do update set
  title = excluded.title,
  authority = excluded.authority,
  source_url = excluded.source_url,
  pdf_storage_path = excluded.pdf_storage_path,
  summary = excluded.summary,
  active = excluded.active;
