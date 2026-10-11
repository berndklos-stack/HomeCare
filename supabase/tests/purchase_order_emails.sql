begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111118','order-email@example.invalid');
insert into public.homecare_suppliers(tenant_id,id,supplier_number,company) values('00000000-0000-0000-0000-000000000001','33333333-3333-4333-8333-333333333338','ORDER-EMAIL','Email supplier');
insert into public.homecare_inventory_locations(tenant_id,id,name) values('00000000-0000-0000-0000-000000000001','order-email-location','Order warehouse');
insert into public.homecare_purchase_orders(tenant_id,id,order_number,supplier_id,location_id,revision) values('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555558','ORDER-EMAIL','33333333-3333-4333-8333-333333333338','order-email-location',4);
insert into public.homecare_purchase_order_emails(tenant_id,order_id,order_revision,recipient,subject,body,provider_message_id,actor_user_id) values('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555558',4,'supplier@example.invalid','Edited subject','Edited body','mail-id','11111111-1111-4111-8111-111111111118');
do $$ begin
 if not exists(select 1 from public.homecare_purchase_orders where id='55555555-5555-4555-8555-555555555558' and revision=4 and status='draft') then raise exception 'ORDER_EMAIL_CHANGED_ORDER'; end if;
 if not exists(select 1 from public.homecare_purchase_order_emails where order_id='55555555-5555-4555-8555-555555555558' and subject='Edited subject' and body='Edited body' and sent_at is not null) then raise exception 'ORDER_EMAIL_RECORD_MISSING'; end if;
 if has_table_privilege('authenticated','public.homecare_purchase_order_emails','INSERT') then raise exception 'ORDER_EMAIL_CLIENT_WRITE_ALLOWED'; end if;
 if not 'homecare_purchase_order_emails'=any(public.homecare_relational_backup_tables()) then raise exception 'ORDER_EMAIL_NOT_IN_BACKUP'; end if;
 begin
  insert into public.homecare_purchase_order_emails(tenant_id,order_id,order_revision,recipient,subject,body,provider_message_id,actor_user_id) values('00000000-0000-0000-0000-000000000001','55555555-5555-4555-8555-555555555558',4,'supplier@example.invalid','Duplicate','Duplicate','mail-id','11111111-1111-4111-8111-111111111118');
  raise exception 'ORDER_EMAIL_DUPLICATE_ACCEPTED';
 exception when unique_violation then null; end;
end $$;
rollback;
