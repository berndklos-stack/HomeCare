begin;

create or replace function public.homecare_location_labels()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new.record_data->'name' is distinct from old.record_data->'name' then new.name:=new.record_data->>'name'; end if;
    if new.record_data->'note' is distinct from old.record_data->'note' then new.note:=new.record_data->>'note'; end if;
  end if;
  if nullif(trim(new.name),'') is null then raise exception 'Bezeichnung fehlt.' using errcode='22023'; end if;
  new.record_data:=new.record_data||jsonb_build_object('name',new.name,'note',coalesce(new.note,''));
  return new;
end $$;
drop trigger if exists homecare_location_labels on public.homecare_inventory_locations;
create trigger homecare_location_labels before insert or update on public.homecare_inventory_locations
for each row execute function public.homecare_location_labels();

do $$
declare definition text;
begin
  select pg_get_functiondef('public.homecare_apply_operations_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)'::regprocedure) into definition;
  if position('allowed:=array[''name'',''location_code'',''location_kind'',''resource_id'',''project_id'',''note'']' in definition)=0 then
    if position('allowed:=array[''location_code'',''location_kind'',''resource_id'',''project_id'']' in definition)=0
      or position('kind<>''save'' or entity like ''%_details''' in definition)=0 then raise exception 'Location command contract not found.'; end if;
    definition:=replace(definition,'allowed:=array[''location_code'',''location_kind'',''resource_id'',''project_id'']','allowed:=array[''name'',''location_code'',''location_kind'',''resource_id'',''project_id'',''note'']');
    definition:=replace(definition,'kind<>''save'' or entity like ''%_details''','kind<>''save'' or (entity like ''%_details'' and entity<>''location_details'')');
    execute definition;
  end if;
end $$;
commit;
