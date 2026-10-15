begin;

alter table public.homecare_settings add column if not exists logo_url text;
alter table public.homecare_settings add constraint company_logo_setting_only
  check (logo_url is null or key='companySettings');
alter table public.homecare_settings add constraint company_logo_source_valid check (
  logo_url is null or logo_url='' or
  (length(logo_url)<=1500000 and logo_url ~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$') or
  (length(logo_url)<=2048 and logo_url ~ '^https://[^[:space:]@]+$')
);

-- Stop on unrecognised legacy values rather than silently discarding them.
do $$ begin
  if exists(select 1 from public.homecare_settings where key='companySettings' and value ? 'logoUrl'
    and value->'logoUrl'<>'null'::jsonb and not (
      jsonb_typeof(value->'logoUrl')='string' and (
        value->>'logoUrl'='' or
        (length(value->>'logoUrl')<=1500000 and value->>'logoUrl' ~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$') or
        (length(value->>'logoUrl')<=2048 and value->>'logoUrl' ~ '^https://[^[:space:]@]+$')
      ))) then raise exception 'LEGACY_COMPANY_LOGO_REQUIRES_REVIEW'; end if;
end $$;

alter table public.homecare_settings disable trigger bump_revision;
alter table public.homecare_settings disable trigger homecare_settings_updated_at;
update public.homecare_settings set logo_url=value->>'logoUrl'
where key='companySettings' and logo_url is null and jsonb_typeof(value->'logoUrl')='string'
  and ((length(value->>'logoUrl')<=1500000 and value->>'logoUrl' ~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$')
    or (length(value->>'logoUrl')<=2048 and value->>'logoUrl' ~ '^https://[^[:space:]@]+$')
    or value->>'logoUrl'='');
alter table public.homecare_settings enable trigger bump_revision;
alter table public.homecare_settings enable trigger homecare_settings_updated_at;

create function public.homecare_project_company_logo() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.key<>'companySettings' then return new; end if;
  if tg_op='INSERT' then
    if new.logo_url is null and new.value ? 'logoUrl' then
      if jsonb_typeof(new.value->'logoUrl') not in ('string','null') then raise exception 'INVALID_COMPANY_LOGO' using errcode='23514'; end if;
      new.logo_url:=new.value->>'logoUrl';
    end if;
  elsif new.logo_url is not distinct from old.logo_url
    and new.value ? 'logoUrl' and new.value->'logoUrl' is distinct from old.value->'logoUrl' then
    if jsonb_typeof(new.value->'logoUrl') not in ('string','null') then raise exception 'INVALID_COMPANY_LOGO' using errcode='23514'; end if;
    new.logo_url:=new.value->>'logoUrl';
  end if;
  if new.logo_url is not null or new.value ? 'logoUrl' then
    new.value:=jsonb_set(coalesce(new.value,'{}'::jsonb),'{logoUrl}',coalesce(to_jsonb(new.logo_url),'null'::jsonb));
  end if;
  return new;
end $$;
revoke all on function public.homecare_project_company_logo() from public,anon,authenticated;
create trigger project_company_logo before insert or update on public.homecare_settings
  for each row execute function public.homecare_project_company_logo();

commit;
