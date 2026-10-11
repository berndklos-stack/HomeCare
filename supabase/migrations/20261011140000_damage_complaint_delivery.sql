begin;
alter table public.homecare_supplier_damage_cases
 add column complaint_sent_at timestamptz,
 add column complaint_sent_to text,
 add column complaint_message_id text,
 add column complaint_subject text,
 add column complaint_body text;
alter table public.homecare_supplier_damage_cases add constraint damage_complaint_delivery_complete check (
 (complaint_sent_at is null and complaint_sent_to is null and complaint_message_id is null)
 or (complaint_sent_at is not null and complaint_sent_to is not null and complaint_message_id is not null and length(trim(complaint_sent_to)) > 0 and length(trim(complaint_message_id)) > 0)
);
create function public.homecare_record_damage_complaint(p_tenant uuid,p_id uuid,p_to text,p_message_id text,p_subject text,p_body text,p_actor uuid,p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare item public.homecare_supplier_damage_cases%rowtype;
begin
 if p_actor is null or p_to is null or p_message_id is null or p_subject is null or p_body is null or length(trim(p_to)) not between 3 and 320 or length(trim(p_message_id)) not between 1 and 200 or length(trim(p_subject)) not between 1 and 200 or length(trim(p_body)) not between 1 and 12000 or length(coalesce(p_note,''))>4000 then raise exception 'INVALID_OPERATIONS_COMMAND'; end if;
 select * into item from public.homecare_supplier_damage_cases where tenant_id=p_tenant and id=p_id for update;
 if not found then raise exception 'DAMAGE_CASE_NOT_FOUND'; end if;
 if item.complaint_sent_at is not null then return; end if;
 update public.homecare_supplier_damage_cases set complaint_sent_at=now(),complaint_sent_to=trim(p_to),complaint_message_id=p_message_id,complaint_subject=trim(p_subject),complaint_body=trim(p_body),revision=revision+1,updated_at=now(),updated_by=p_actor where tenant_id=p_tenant and id=p_id;
 insert into public.homecare_supplier_damage_events(tenant_id,case_id,status,note,actor_user_id) values(p_tenant,p_id,item.status,coalesce(p_note,''),p_actor);
end $$;
revoke all on function public.homecare_record_damage_complaint(uuid,uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.homecare_record_damage_complaint(uuid,uuid,text,text,text,text,uuid,text) to service_role;
commit;
