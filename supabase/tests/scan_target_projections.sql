begin;

-- Exercise the same projections as the scan-target API against the real schema.
select id,title,status,billable,record_data from public.homecare_jobs limit 0;
select id,name,custom_fields from public.homecare_objects limit 0;
select id,name,note,revision,archived,location_code,location_kind,
  location_type_id,parent_location_id,job_id,resource_id,project_id
from public.homecare_inventory_locations limit 0;

rollback;
