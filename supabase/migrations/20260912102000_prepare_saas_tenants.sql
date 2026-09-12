do $$
begin
  if not exists (select 1 from pg_type where typname = 'homecare_user_role') then
    create type public.homecare_user_role as enum ('owner', 'admin', 'office', 'field_staff', 'customer');
  end if;
  if not exists (select 1 from pg_type where typname = 'homecare_subscription_interval') then
    create type public.homecare_subscription_interval as enum ('monthly', 'quarterly', 'yearly');
  end if;
  if not exists (select 1 from pg_type where typname = 'homecare_subscription_status') then
    create type public.homecare_subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'homecare_feature_module') then
    create type public.homecare_feature_module as enum (
      'jobs',
      'reports',
      'time_tracking',
      'billing',
      'inventory',
      'logbook',
      'customer_portal',
      'dispatch',
      'documents',
      'ai',
      'integrations'
    );
  end if;
end $$;

create table if not exists public.homecare_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  organization_number text,
  vat_number text,
  email text,
  phone text,
  address text,
  default_language text not null default 'Deutsch',
  default_currency text not null default 'SEK',
  logo_media_id text,
  logo_storage_path text,
  brand_color text not null default '#007aff',
  billing_email text,
  billing_address text,
  stripe_customer_id text,
  subscription_status public.homecare_subscription_status not null default 'trialing',
  subscription_interval public.homecare_subscription_interval not null default 'monthly',
  trial_ends_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.homecare_tenants (
  id,
  slug,
  name,
  legal_name,
  organization_number,
  vat_number,
  email,
  address,
  default_language,
  default_currency,
  brand_color
) values (
  '00000000-0000-0000-0000-000000000001',
  'kolaretorp',
  'Kolaretorp Service AB',
  'Kolaretorp Service AB',
  null,
  null,
  null,
  null,
  'Deutsch',
  'SEK',
  '#007aff'
) on conflict (id) do nothing;

create table if not exists public.homecare_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  role public.homecare_user_role not null default 'customer',
  display_name text,
  email text,
  phone text,
  personnel_id text,
  customer_id text,
  status text not null default 'aktiv',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  email text not null,
  role public.homecare_user_role not null,
  personnel_id text,
  customer_id text,
  token_hash text not null,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homecare_subscription_plans (
  id text primary key,
  name text not null,
  interval public.homecare_subscription_interval not null,
  price_amount numeric(12,2) not null,
  currency text not null default 'SEK',
  included_users integer,
  included_objects integer,
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.homecare_subscription_plans (
  id,
  name,
  interval,
  price_amount,
  currency,
  included_users,
  included_objects,
  active
) values
  ('start_monthly', 'Start', 'monthly', 590, 'SEK', 3, 25, true),
  ('start_quarterly', 'Start kvartalsvis', 'quarterly', 1680, 'SEK', 3, 25, true),
  ('start_yearly', 'Start årligen', 'yearly', 5900, 'SEK', 3, 25, true),
  ('pro_monthly', 'Pro', 'monthly', 1190, 'SEK', 8, 100, true),
  ('pro_quarterly', 'Pro kvartalsvis', 'quarterly', 3390, 'SEK', 8, 100, true),
  ('pro_yearly', 'Pro årligen', 'yearly', 11900, 'SEK', 8, 100, true),
  ('business_monthly', 'Business', 'monthly', 2090, 'SEK', 20, 300, true),
  ('business_quarterly', 'Business kvartalsvis', 'quarterly', 5960, 'SEK', 20, 300, true),
  ('business_yearly', 'Business årligen', 'yearly', 20900, 'SEK', 20, 300, true)
on conflict (id) do update set
  name = excluded.name,
  interval = excluded.interval,
  price_amount = excluded.price_amount,
  currency = excluded.currency,
  included_users = excluded.included_users,
  included_objects = excluded.included_objects,
  active = excluded.active;

create table if not exists public.homecare_plan_modules (
  plan_id text not null references public.homecare_subscription_plans(id) on delete cascade,
  module public.homecare_feature_module not null,
  included boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (plan_id, module)
);

create table if not exists public.homecare_tenant_modules (
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  module public.homecare_feature_module not null,
  enabled boolean not null default true,
  source text not null default 'plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module)
);

create table if not exists public.homecare_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  plan_id text references public.homecare_subscription_plans(id) on delete set null,
  status public.homecare_subscription_status not null default 'trialing',
  interval public.homecare_subscription_interval not null default 'monthly',
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.homecare_plan_modules (plan_id, module, included)
select plan.id, module::public.homecare_feature_module, true
from public.homecare_subscription_plans plan
cross join unnest(array['jobs', 'reports', 'time_tracking', 'documents']::text[]) module
where plan.id like 'start_%'
on conflict (plan_id, module) do update set included = excluded.included;

insert into public.homecare_plan_modules (plan_id, module, included)
select plan.id, module::public.homecare_feature_module, true
from public.homecare_subscription_plans plan
cross join unnest(array['jobs', 'reports', 'time_tracking', 'documents', 'billing', 'inventory', 'logbook']::text[]) module
where plan.id like 'pro_%'
on conflict (plan_id, module) do update set included = excluded.included;

insert into public.homecare_plan_modules (plan_id, module, included)
select plan.id, module::public.homecare_feature_module, true
from public.homecare_subscription_plans plan
cross join unnest(array['jobs', 'reports', 'time_tracking', 'documents', 'billing', 'inventory', 'logbook', 'customer_portal', 'dispatch', 'ai', 'integrations']::text[]) module
where plan.id like 'business_%'
on conflict (plan_id, module) do update set included = excluded.included;

insert into public.homecare_subscriptions (
  tenant_id,
  plan_id,
  status,
  interval,
  current_period_start,
  current_period_end
) values (
  '00000000-0000-0000-0000-000000000001',
  'business_monthly',
  'active',
  'monthly',
  now(),
  now() + interval '1 month'
) on conflict do nothing;

insert into public.homecare_tenant_modules (tenant_id, module, enabled, source)
select
  '00000000-0000-0000-0000-000000000001',
  module::public.homecare_feature_module,
  true,
  'manual'
from unnest(array['jobs', 'reports', 'time_tracking', 'documents', 'billing', 'inventory', 'logbook', 'customer_portal', 'dispatch', 'ai', 'integrations']::text[]) module
on conflict (tenant_id, module) do update set
  enabled = excluded.enabled,
  source = excluded.source;

create table if not exists public.homecare_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'homecare_accounting_accounts',
    'homecare_billing_items',
    'homecare_customers',
    'homecare_field_progress',
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
    'homecare_settings',
    'homecare_translations',
    'homecare_vehicle_positions',
    'homecare_vehicle_trips'
  ] loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid not null default %L references public.homecare_tenants(id) on delete restrict',
      table_name,
      '00000000-0000-0000-0000-000000000001'
    );
    execute format('create index if not exists %I on public.%I(tenant_id)', table_name || '_tenant_id_idx', table_name);
  end loop;
end $$;

create index if not exists homecare_user_profiles_tenant_id_idx on public.homecare_user_profiles(tenant_id);
create index if not exists homecare_user_profiles_role_idx on public.homecare_user_profiles(role);
create index if not exists homecare_user_invitations_tenant_email_idx on public.homecare_user_invitations(tenant_id, email);
create index if not exists homecare_plan_modules_module_idx on public.homecare_plan_modules(module);
create index if not exists homecare_tenant_modules_module_idx on public.homecare_tenant_modules(module);
create index if not exists homecare_subscriptions_tenant_id_idx on public.homecare_subscriptions(tenant_id);
create unique index if not exists homecare_subscriptions_tenant_unique_idx on public.homecare_subscriptions(tenant_id);
create index if not exists homecare_audit_log_tenant_created_idx on public.homecare_audit_log(tenant_id, created_at desc);

drop trigger if exists set_updated_at on public.homecare_tenants;
create trigger set_updated_at before update on public.homecare_tenants for each row execute function public.set_homecare_updated_at();
drop trigger if exists set_updated_at on public.homecare_user_profiles;
create trigger set_updated_at before update on public.homecare_user_profiles for each row execute function public.set_homecare_updated_at();
drop trigger if exists set_updated_at on public.homecare_user_invitations;
create trigger set_updated_at before update on public.homecare_user_invitations for each row execute function public.set_homecare_updated_at();
drop trigger if exists set_updated_at on public.homecare_subscription_plans;
create trigger set_updated_at before update on public.homecare_subscription_plans for each row execute function public.set_homecare_updated_at();
drop trigger if exists set_updated_at on public.homecare_tenant_modules;
create trigger set_updated_at before update on public.homecare_tenant_modules for each row execute function public.set_homecare_updated_at();
drop trigger if exists set_updated_at on public.homecare_subscriptions;
create trigger set_updated_at before update on public.homecare_subscriptions for each row execute function public.set_homecare_updated_at();

alter table public.homecare_tenants enable row level security;
alter table public.homecare_user_profiles enable row level security;
alter table public.homecare_user_invitations enable row level security;
alter table public.homecare_subscription_plans enable row level security;
alter table public.homecare_plan_modules enable row level security;
alter table public.homecare_tenant_modules enable row level security;
alter table public.homecare_subscriptions enable row level security;
alter table public.homecare_audit_log enable row level security;
