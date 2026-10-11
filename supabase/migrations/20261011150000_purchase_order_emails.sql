begin;
create table public.homecare_purchase_order_emails (
 tenant_id uuid not null,
 order_id uuid not null,
 order_revision integer not null check(order_revision>0),
 recipient text not null check(length(trim(recipient)) between 3 and 320),
 subject text not null check(length(trim(subject)) between 1 and 200),
 body text not null check(length(trim(body)) between 1 and 12000),
 provider_message_id text not null check(length(trim(provider_message_id)) between 1 and 200),
 sent_at timestamptz not null default now(),
 actor_user_id uuid not null references auth.users(id),
 primary key(tenant_id,order_id,order_revision),
 foreign key(tenant_id,order_id) references public.homecare_purchase_orders(tenant_id,id)
);
alter table public.homecare_purchase_order_emails enable row level security;
create policy purchase_order_email_read on public.homecare_purchase_order_emails for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_purchase_order_emails from anon,authenticated;
grant select on public.homecare_purchase_order_emails to authenticated;
grant all on public.homecare_purchase_order_emails to service_role;
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_order_emails;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_order_emails()||array['homecare_purchase_order_emails']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
