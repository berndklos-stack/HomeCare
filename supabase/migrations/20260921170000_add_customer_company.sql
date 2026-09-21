alter table public.homecare_customers
  add column if not exists company_name text;
