begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','review@example.invalid');
insert into public.homecare_inventory_locations(tenant_id,id,name,location_kind) values('00000000-0000-0000-0000-000000000001','review-car','Car','vehicle');
insert into public.homecare_materials(tenant_id,id,name,unit,sales_price,tax_rate,accounting_account) values
 ('00000000-0000-0000-0000-000000000001','review-material','Assigned material','Meter',40,25,'3058'),
 ('00000000-0000-0000-0000-000000000001','review-unused','Unused material','Stueck',10,25,'3058'),
 ('00000000-0000-0000-0000-000000000001','review-extra','Extra material','Stueck',20,25,'3058');
insert into public.homecare_jobs(tenant_id,id,title,status,billable) values('00000000-0000-0000-0000-000000000001','review-job','Review job','in Arbeit',true);
do $$ declare tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:='11111111-1111-4111-8111-111111111111'; review uuid:=gen_random_uuid(); picking uuid:=gen_random_uuid(); payload jsonb; rev bigint; before_count integer;
begin
 select revision into rev from public.homecare_jobs where id='review-job';
 perform public.homecare_stock_post(tenant,gen_random_uuid(),'review-material',null,'review-car',20,actor,'Receipt');
 perform public.homecare_stock_post(tenant,gen_random_uuid(),'review-unused',null,'review-car',10,actor,'Receipt');
 perform public.homecare_stock_post(tenant,gen_random_uuid(),'review-extra',null,'review-car',10,actor,'Receipt');
 insert into public.homecare_picking_orders(tenant_id,id,job_id,job_revision,title,actor_user_id,status,destination_id) values(tenant,picking,'review-job',rev,'Review job',actor,'loaded','review-car');
 insert into public.homecare_picking_items(tenant_id,order_id,material_id,quantity,picked) values(tenant,picking,'review-material',5,5),(tenant,picking,'review-unused',2,2);
 payload:='[{"material_id":"review-material","source_id":"review-car","allocated_quantity":5,"consumed_quantity":2,"additional":false},{"material_id":"review-unused","source_id":"review-car","allocated_quantity":2,"consumed_quantity":0,"additional":false},{"material_id":"review-extra","source_id":"review-car","allocated_quantity":0,"consumed_quantity":3,"additional":true}]';
 begin
  perform public.homecare_review_field_material(tenant,review,'review-job','2026-10-11',rev,true,true,payload,actor);
  raise exception 'PARTIAL_AS_ALL_ACCEPTED';
 exception when others then if sqlerrm<>'INVALID_MATERIAL_REVIEW' then raise; end if; end;
 begin
  perform public.homecare_review_field_material(tenant,review,'review-job','2026-10-11',rev,false,true,payload-1,actor);
  raise exception 'MISSING_ALLOCATED_ACCEPTED';
 exception when others then if sqlerrm<>'MATERIAL_REVIEW_CHANGED' then raise; end if; end;
 begin
  perform public.homecare_review_field_material(tenant,review,'review-job','2026-10-11',rev,false,true,jsonb_set(payload,'{2,consumed_quantity}','100'),actor);
  raise exception 'EXCESS_STOCK_ACCEPTED';
 exception when others then if sqlerrm<>'INSUFFICIENT_STOCK' then raise; end if; end;
 if exists(select 1 from public.homecare_field_material_reviews where id=review) or exists(select 1 from public.homecare_stock_movements where job_id='review-job') then raise exception 'PARTIAL_WRITE_ON_ERROR'; end if;
 perform public.homecare_review_field_material(tenant,review,'review-job','2026-10-11',rev,false,true,payload,actor);
 if (select sum(quantity) from public.homecare_stock_movements where job_id='review-job' and material_id='review-material')<>2 then raise exception 'PLANNED_INSTEAD_OF_ACTUAL'; end if;
 if (select sum(quantity) from public.homecare_stock_movements where job_id='review-job' and material_id='review-extra')<>3 then raise exception 'EXTRA_MISSING'; end if;
 if exists(select 1 from public.homecare_stock_movements where job_id='review-job' and material_id='review-unused') then raise exception 'ZERO_MOVEMENT_CREATED'; end if;
 if (select status from public.homecare_picking_orders where id=picking)<>'dispatched' then raise exception 'LOADED_NOT_RELEASED'; end if;
 if (select sum(case when destination_id='review-car' then quantity else -quantity end) from public.homecare_stock_movements where material_id='review-material')<>18 then raise exception 'LEFTOVER_REMOVED'; end if;
 select count(*) into before_count from public.homecare_stock_movements;
 update public.homecare_jobs set status='erledigt' where id='review-job';
 perform public.homecare_review_field_material(tenant,review,'review-job','2026-10-11',rev,false,true,payload,actor);
 if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'RETRY_DUPLICATED'; end if;
 begin
  perform public.homecare_review_field_material(tenant,gen_random_uuid(),'review-job','2026-10-11',rev,false,true,payload,actor);
  raise exception 'SECOND_REVIEW_ACCEPTED';
 exception when others then if sqlerrm<>'MATERIAL_REVIEW_CHANGED' then raise; end if; end;
 if not exists(select 1 from public.homecare_stock_movements where job_id='review-job' and billing_data->>'materialId'='review-extra' and billing_data->>'price'='20.00') then raise exception 'BILLING_SNAPSHOT_MISSING'; end if;
end $$;
rollback;
