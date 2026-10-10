begin;
insert into public.homecare_stock_cutovers(tenant_id,imported_entries) values('00000000-0000-0000-0000-000000000001',0) on conflict do nothing;
do $$ declare
 tenant uuid:='00000000-0000-0000-0000-000000000001'; actor uuid:=gen_random_uuid(); plan uuid:=gen_random_uuid(); items jsonb; revision integer; before_count bigint;
begin
 if has_function_privilege('authenticated','public.homecare_save_inventory_plan(uuid,uuid,uuid,text,integer,jsonb,boolean)','execute') then raise exception 'UNTRUSTED_PLAN_RPC'; end if;
 perform public.homecare_stock_post(tenant,gen_random_uuid(),'material',null,'warehouse',10,actor,'Initial');
 items:='[{"location_id":"warehouse","material_id":"material","expected":10,"counted":null},{"location_id":"vehicle","material_id":"material","expected":0,"counted":null}]';
 revision:=public.homecare_save_inventory_plan(tenant,plan,actor,'Count',0,items,false);
 if revision<>1 or (select count(*) from public.homecare_inventory_plan_items where tenant_id=tenant and plan_id=plan)<>2 then raise exception 'PLAN_NOT_SAVED'; end if;
 begin
   perform public.homecare_save_inventory_plan(tenant,plan,actor,'Count',1,items,true);
   raise exception 'INCOMPLETE_ACCEPTED';
 exception when others then if sqlerrm<>'COUNT_INCOMPLETE' then raise; end if; end;
 items:='[{"location_id":"warehouse","material_id":"material","expected":10,"counted":8},{"location_id":"vehicle","material_id":"material","expected":0,"counted":2}]';
 revision:=public.homecare_save_inventory_plan(tenant,plan,actor,'Count',1,items,false);
 if revision<>2 then raise exception 'WRONG_REVISION'; end if;
 begin
   perform public.homecare_save_inventory_plan(tenant,plan,actor,'Changed note',1,items,false);
   raise exception 'STALE_PLAN_ACCEPTED';
 exception when others then if sqlerrm<>'PLAN_CHANGED' then raise; end if; end;
 if (select counted_quantity from public.homecare_inventory_plan_items where tenant_id=tenant and plan_id=plan and location_id='warehouse')<>8 then raise exception 'COUNT_LOST'; end if;
 if public.homecare_save_inventory_plan(tenant,plan,actor,'Count',1,items,false)<>2 then raise exception 'SAVE_RETRY_FAILED'; end if;
 revision:=public.homecare_save_inventory_plan(tenant,plan,actor,'Count',2,items,true);
 if revision<>3 or (select completed_at from public.homecare_inventory_plans where tenant_id=tenant and id=plan) is null then raise exception 'COMPLETION_NOT_SAVED'; end if;
 if (select quantity from public.homecare_stock_balances(tenant,'material') where location_id='warehouse')<>8 or (select quantity from public.homecare_stock_balances(tenant,'material') where location_id='vehicle')<>2 then raise exception 'WRONG_PLAN_BALANCES'; end if;
 select count(*) into before_count from public.homecare_stock_movements;
 perform public.homecare_save_inventory_plan(tenant,plan,actor,'Count',2,items,true);
 if (select count(*) from public.homecare_stock_movements)<>before_count then raise exception 'DOUBLE_PLAN_POSTING'; end if;
 begin
   perform public.homecare_save_inventory_plan(tenant,plan,actor,'Changed completed count',2,items,true);
   raise exception 'COMPLETED_PLAN_CHANGED';
 exception when others then if sqlerrm<>'PLAN_COMPLETED' then raise; end if; end;
 plan:=gen_random_uuid();
 items:='[{"location_id":"vehicle","material_id":"material","expected":2,"counted":4},{"location_id":"warehouse","material_id":"material","expected":9,"counted":7}]';
 perform public.homecare_save_inventory_plan(tenant,plan,actor,'Stale stock',0,items,false);
 begin
   perform public.homecare_save_inventory_plan(tenant,plan,actor,'Stale stock',1,items,true);
   raise exception 'STALE_STOCK_ACCEPTED';
 exception when others then if sqlerrm<>'INVENTORY_STOCK_CHANGED' then raise; end if; end;
 if (select count(*) from public.homecare_stock_movements)<>before_count or (select p.revision from public.homecare_inventory_plans p where tenant_id=tenant and id=plan)<>1 then raise exception 'PARTIAL_POSTING'; end if;
 begin
   perform public.homecare_save_inventory_plan(tenant,gen_random_uuid(),actor,'Foreign',0,'[{"location_id":"foreign","material_id":"material","expected":0,"counted":null}]',false);
   raise exception 'FOREIGN_LOCATION_ACCEPTED';
 exception when others then if sqlerrm<>'LOCATION_NOT_ACTIVE' then raise; end if; end;
 perform set_config('test.tenant','00000000-0000-0000-0000-000000000002',true);
 perform set_config('test.permission','allowed',true);
end $$;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.homecare_inventory_plans) or exists(select 1 from public.homecare_inventory_plan_items) then raise exception 'PLAN_RLS_LEAK'; end if;
end $$;
reset role;
rollback;
