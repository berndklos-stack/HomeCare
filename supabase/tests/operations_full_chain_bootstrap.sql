-- Minimal platform interfaces for a disposable local PostgreSQL cluster.
-- This does not simulate JWT signature verification, GoTrue or Storage APIs.
do $$ begin
  if current_database() <> 'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if;
end $$;
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key, email text);
create table storage.buckets(id text primary key, public boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
