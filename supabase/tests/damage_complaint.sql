begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111119','complaint@example.invalid');
insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values('00000000-0000-0000-0000-000000000001','33333333-3333-4333-8333-333333333339','COMPLAINT','Complaint supplier');
insert into public.homecare_inventory_locations(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','complaint-location','Complaint warehouse');
insert into public.homecare_goods_receipts(tenant_id,id,supplier_id,delivery_number,location_id,actor_user_id,request_payload) values('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555559','33333333-3333-4333-8333-333333333339','COMPLAINT-NOTE','complaint-location','11111111-1111-4111-8111-111111111119','{}');
insert into public.homecare_supplier_damage_cases(tenant_id,id,receipt_id,supplier_id,description,created_by,updated_by) values('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555559','55555555-5555-4555-8555-555555555559','33333333-3333-4333-8333-333333333339','Broken delivery','11111111-1111-4111-8111-111111111119','11111111-1111-4111-8111-111111111119');
select public.homecare_record_damage_complaint('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555559','supplier@example.invalid','message-1','Replacement requested','Please replace the delivery.','11111111-1111-4111-8111-111111111119','Reklamation: supplier@example.invalid');
select public.homecare_record_damage_complaint('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555559','other@example.invalid','message-2','Other subject','Other body','11111111-1111-4111-8111-111111111119','Duplicate');
do $$ begin
 if not exists(select 1 from public.homecare_supplier_damage_cases where id='55555555-5555-4555-8555-555555555559' and complaint_sent_at is not null and complaint_sent_to='supplier@example.invalid' and complaint_message_id='message-1' and complaint_subject='Replacement requested' and complaint_body='Please replace the delivery.' and revision=2 and status='open') then raise exception 'COMPLAINT_RECORD_FAILED'; end if;
 if (select count(*) from public.homecare_supplier_damage_events where case_id='55555555-5555-4555-8555-555555555559')<>1 then raise exception 'COMPLAINT_DUPLICATE_EVENT'; end if;
 if has_function_privilege('authenticated','public.homecare_record_damage_complaint(uuid,uuid,text,text,text,text,uuid,text)','execute') then raise exception 'COMPLAINT_UNSAFE_PRIVILEGE'; end if;
 begin
  perform public.homecare_record_damage_complaint('00000000-0000-0000-0000-000000000002','55555555-5555-4555-8555-555555555559','supplier@example.invalid','message-1','Subject','Body','11111111-1111-4111-8111-111111111119','Foreign tenant');
  raise exception 'COMPLAINT_TENANT_LEAK';
 exception when others then if sqlerrm<>'DAMAGE_CASE_NOT_FOUND' then raise; end if; end;
end $$;
rollback;
