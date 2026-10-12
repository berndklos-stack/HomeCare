begin;

create or replace function public.homecare_trip_neighbor_error(
  p_tenant uuid, p_resource text, p_id text, p_date date, p_started_at timestamptz, p_start numeric, p_end numeric
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_previous_end numeric;
  v_next_start numeric;
  v_mileage_order boolean;
  v_candidate_key numeric;
begin
  if p_start is null or p_start < 0 then return 'Start-Kilometerstand fehlt oder ist ungueltig.'; end if;
  if p_end is not null and p_end < p_start then return 'End-Kilometerstand darf nicht kleiner als Start-Kilometerstand sein.'; end if;
  if p_date is null then return 'Fahrtdatum fehlt.'; end if;

  -- Day boundaries must remain safe even when the candidate has a time.
  select max(t.end_odometer) into v_previous_end from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null and t.trip_date<p_date;
  select min(t.start_odometer) into v_next_start from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null and t.trip_date>p_date;
  if v_previous_end is not null and p_start<v_previous_end then
    return format('Start-Kilometerstand liegt unter dem Endstand der vorherigen Fahrt (%s km).',v_previous_end);
  end if;
  if v_next_start is not null and coalesce(p_end,p_start)>v_next_start then
    return format('Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (%s km).',v_next_start);
  end if;

  v_mileage_order := p_started_at is null
    or (p_started_at at time zone 'Europe/Stockholm')::date <> p_date
    or exists(select 1 from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and t.trip_date=p_date and (t.started_at is null
          or (t.started_at at time zone 'Europe/Stockholm')::date <> t.trip_date));
  v_candidate_key := case when v_mileage_order then p_start
    else extract(epoch from public.homecare_trip_order_time(p_date,p_started_at)) end;

  if v_mileage_order and exists(select 1 from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and t.trip_date=p_date and t.start_odometer < coalesce(p_end,p_start)
      and p_start < coalesce(t.end_odometer,t.start_odometer))
  then return 'Die Kilometerstaende dieser Fahrt ueberschneiden sich mit einer anderen Fahrt am selben Tag.'; end if;

  if v_mileage_order then
    select max(t.end_odometer) into v_previous_end from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and (t.trip_date<p_date or (t.trip_date=p_date and t.start_odometer<=p_start));
    select min(t.start_odometer) into v_next_start from public.homecare_vehicle_trips t
      where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
        and (t.trip_date>p_date or (t.trip_date=p_date and t.start_odometer>p_start));
  else
  select t.end_odometer into v_previous_end from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and (t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
        else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id)
        < (p_date,v_candidate_key,p_id)
    order by t.trip_date desc, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
      else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end desc, t.id desc limit 1;
  select t.start_odometer into v_next_start from public.homecare_vehicle_trips t
    where t.tenant_id=p_tenant and t.resource_id=p_resource and t.id<>p_id and t.deleted_at is null
      and (t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
        else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id)
        > (p_date,v_candidate_key,p_id)
    order by t.trip_date, case when v_mileage_order and t.trip_date=p_date then t.start_odometer
      else extract(epoch from public.homecare_trip_order_time(t.trip_date,t.started_at)) end, t.id limit 1;
  end if;
  if v_previous_end is not null and p_start < v_previous_end then
    return format('Start-Kilometerstand liegt unter dem Endstand der vorherigen Fahrt (%s km).',v_previous_end);
  end if;
  if v_next_start is not null and coalesce(p_end,p_start) > v_next_start then
    return format('Kilometerstand liegt ueber dem Startstand der naechsten Fahrt (%s km).',v_next_start);
  end if;
  return null;
end;
$$;

commit;

