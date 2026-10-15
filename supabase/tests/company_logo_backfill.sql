do $$ begin
 if (select logo_url from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000009') is distinct from 'https://example.invalid/legacy.png'
   or not exists(select 1 from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000009'
     and revision=9 and updated_at='2026-01-01T12:00:00Z'::timestamptz
     and value='{"name":"Legacy logo","logoUrl":"https://example.invalid/legacy.png","keep":"original"}'::jsonb)
 then raise exception 'LOGO_BACKFILL_CHANGED_LEGACY_DATA'; end if;
end $$;
delete from public.homecare_settings where tenant_id='b1520000-0000-4000-8000-000000000009';
delete from public.homecare_tenants where id='b1520000-0000-4000-8000-000000000009';
