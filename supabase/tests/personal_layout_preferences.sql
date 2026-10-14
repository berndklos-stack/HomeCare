begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;
insert into auth.users(id,email) values
 ('a1414000-0000-4000-8000-000000000001','layout-a@example.invalid'),
 ('a1414000-0000-4000-8000-000000000002','layout-b@example.invalid');
insert into public.homecare_tenants(id,slug,name) values('b1414000-0000-4000-8000-000000000002','layout-other','Layout other');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
 ('c1414000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','layout-reader','Reader',array['data.read']),
 ('c1414000-0000-4000-8000-000000000002','b1414000-0000-4000-8000-000000000002','layout-reader','Reader',array['data.read']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id) values
 ('00000000-0000-0000-0000-000000000001','a1414000-0000-4000-8000-000000000001','c1414000-0000-4000-8000-000000000001'),
 ('00000000-0000-0000-0000-000000000001','a1414000-0000-4000-8000-000000000002','c1414000-0000-4000-8000-000000000001');
insert into public.homecare_user_layout_preferences(tenant_id,user_id,navigation_order) values
 ('00000000-0000-0000-0000-000000000001','a1414000-0000-4000-8000-000000000002',array['jobs']),
 ('b1414000-0000-4000-8000-000000000002','a1414000-0000-4000-8000-000000000001',array['field']);
select set_config('request.jwt.claim.sub','a1414000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ declare bad text[]; before_nav text[]; begin
 if exists(select 1 from public.homecare_user_layout_preferences) then raise exception 'OTHER_USER_OR_TENANT_READ'; end if;
 perform public.homecare_update_layout_preference('00000000-0000-0000-0000-000000000001','navigationOrder',array['jobs','dashboard']);
 select navigation_order into before_nav from public.homecare_user_layout_preferences;
 perform public.homecare_update_layout_preference('00000000-0000-0000-0000-000000000001','vehicleBlockOrder',array['maintenance','documents','standardTrips']);
 if (select navigation_order from public.homecare_user_layout_preferences) is distinct from before_nav then raise exception 'UNRELATED_ORDER_OVERWRITTEN'; end if;
 if (select count(*) from public.homecare_user_layout_preferences)<>1 then raise exception 'SELF_RLS_FAILED'; end if;
 foreach bad slice 1 in array array[array['jobs','jobs'],array['unknown','dashboard'],array['jobs',null]] loop
   begin perform public.homecare_update_layout_preference('00000000-0000-0000-0000-000000000001','navigationOrder',bad); raise exception 'INVALID_ORDER_ACCEPTED'; exception when check_violation then null; end;
 end loop;
 begin perform public.homecare_update_layout_preference('00000000-0000-0000-0000-000000000001','navigationOrder',array[array['jobs','dashboard']]); raise exception 'MULTIDIMENSIONAL_ORDER_ACCEPTED'; exception when check_violation then null; end;
 begin perform public.homecare_update_layout_preference('00000000-0000-0000-0000-000000000001','user_id',array['jobs']); raise exception 'UNSAFE_COLUMN_ALLOWED'; exception when check_violation then null; end;
 begin perform public.homecare_update_layout_preference('b1414000-0000-4000-8000-000000000002','navigationOrder',array['jobs']); raise exception 'FOREIGN_TENANT_WRITE'; exception when insufficient_privilege then null; end;
 begin insert into public.homecare_user_layout_preferences(tenant_id,user_id) values('00000000-0000-0000-0000-000000000001','a1414000-0000-4000-8000-000000000002'); raise exception 'FOREIGN_USER_WRITE'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.headers','{"x-workcore-tenant":"b1414000-0000-4000-8000-000000000002"}',true);
do $$ begin if exists(select 1 from public.homecare_user_layout_preferences) then raise exception 'FORGED_MEMBERSHIP_READ'; end if; end $$;
reset role;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.homecare_user_layout_preferences'::regclass)
   or has_table_privilege('anon','public.homecare_user_layout_preferences','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('anon','public.homecare_update_layout_preference(uuid,text,text[])','EXECUTE')
   or not ('homecare_user_layout_preferences'=any(public.homecare_relational_backup_tables())) then raise exception 'UNSAFE_LAYOUT_SECURITY_OR_BACKUP'; end if;
 if (select navigation_order from public.homecare_user_layout_preferences where user_id='a1414000-0000-4000-8000-000000000002')<>array['jobs'] then raise exception 'OTHER_USER_CHANGED'; end if;
end $$;
rollback;
