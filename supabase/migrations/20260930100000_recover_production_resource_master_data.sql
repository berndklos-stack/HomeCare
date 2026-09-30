-- Recover the confirmed production license plate without overwriting newer data.
-- RES-2 has no unambiguous missing values in the available legacy sources.
update public.homecare_resources
set license_plate = 'BLB549'
where tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and id = 'RES-1'
  and deleted_at is null
  and nullif(btrim(license_plate), '') is null;
