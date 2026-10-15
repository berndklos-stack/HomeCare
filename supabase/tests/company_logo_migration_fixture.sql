do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into public.homecare_tenants(id,slug,name) values('b1520000-0000-4000-8000-000000000009','legacy-logo','Legacy logo');
insert into public.homecare_settings(tenant_id,key,value,revision,updated_at) values
 ('b1520000-0000-4000-8000-000000000009','companySettings','{"name":"Legacy logo","logoUrl":"https://example.invalid/legacy.png","keep":"original"}',9,'2026-01-01T12:00:00Z');
