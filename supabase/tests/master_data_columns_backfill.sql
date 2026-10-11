do $$ begin
  if not exists(select 1 from public.homecare_materials where id='legacy-location-label' and primary_location_name='Hauptlager' and primary_location_id is null and sku='LEGACY-001') then
    raise exception 'LEGACY_LOCATION_BACKFILL_FAILED';
  end if;
end $$;
delete from public.homecare_materials where id='legacy-location-label';
