begin;

alter table public.homecare_inventory_locations add column if not exists location_code text;

-- Keep the master-data editor and the Operations editor on the same value.
create or replace function public.homecare_location_scan_code()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.location_code:=coalesce(new.location_code,new.record_data->>'locationCode');
  elsif new.record_data->'locationCode' is distinct from old.record_data->'locationCode' then
    new.location_code:=new.record_data->>'locationCode';
  end if;
  new.location_code:=nullif(trim(new.location_code),'');
  if length(new.location_code)>128 then raise exception 'Lagercode ist zu lang.' using errcode='22023'; end if;
  new.record_data:=jsonb_set(new.record_data,'{locationCode}',to_jsonb(coalesce(new.location_code,'')));
  return new;
end $$;
drop trigger if exists homecare_location_scan_code on public.homecare_inventory_locations;
create trigger homecare_location_scan_code before insert or update on public.homecare_inventory_locations
for each row execute function public.homecare_location_scan_code();

-- Materials already persist lossless relational record_data; index the text code
-- without converting EANs to numbers or introducing a second editable value.
create index if not exists homecare_material_scan_code_idx
on public.homecare_materials(tenant_id,(record_data->>'scanCode'))
where deleted_at is null and not archived;
create index if not exists homecare_location_scan_code_idx
on public.homecare_inventory_locations(tenant_id,location_code)
where deleted_at is null and not archived;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)'::regprocedure) into definition;
  if position('allowed:=array[''location_code'',''location_kind'',''resource_id'',''project_id'']' in definition)=0 then
    if position('allowed:=array[''location_kind'',''resource_id'',''project_id'']' in definition)=0 then
      raise exception 'Location command allowlist not found.';
    end if;
    definition:=replace(definition,'allowed:=array[''location_kind'',''resource_id'',''project_id'']','allowed:=array[''location_code'',''location_kind'',''resource_id'',''project_id'']');
    execute definition;
  end if;
end $$;

commit;
