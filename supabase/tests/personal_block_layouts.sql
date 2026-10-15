begin;
do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'ISOLATED_TEST_DATABASE_REQUIRED'; end if; end $$;

insert into auth.users(id,email) values
 ('a1415000-0000-4000-8000-000000000001','blocks-a@example.invalid'),
 ('a1415000-0000-4000-8000-000000000002','blocks-b@example.invalid');
insert into public.homecare_tenants(id,slug,name) values
 ('b1415000-0000-4000-8000-000000000002','blocks-other','Blocks other');
insert into public.homecare_roles(id,tenant_id,key,name,permissions) values
 ('c1415000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','blocks-reader','Reader',array['data.read']),
 ('c1415000-0000-4000-8000-000000000002','b1415000-0000-4000-8000-000000000002','blocks-reader','Reader',array['data.read']);
insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status) values
 ('00000000-0000-0000-0000-000000000001','a1415000-0000-4000-8000-000000000001','c1415000-0000-4000-8000-000000000001','active'),
 ('00000000-0000-0000-0000-000000000001','a1415000-0000-4000-8000-000000000002','c1415000-0000-4000-8000-000000000001','active'),
 ('b1415000-0000-4000-8000-000000000002','a1415000-0000-4000-8000-000000000001','c1415000-0000-4000-8000-000000000002','suspended');
insert into public.homecare_user_block_layouts(tenant_id,user_id,scope_key,block_order) values
 ('00000000-0000-0000-0000-000000000001','a1415000-0000-4000-8000-000000000002','custom.screen',array['otherUser']),
 ('b1415000-0000-4000-8000-000000000002','a1415000-0000-4000-8000-000000000001','custom.screen',array['otherTenant']);
select set_config('request.jwt.claim.sub','a1415000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.headers','{"x-workcore-tenant":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ declare bad text[]; scope text; saved jsonb; affected integer; begin
 if exists(select 1 from public.homecare_user_block_layouts) then raise exception 'OTHER_USER_OR_TENANT_READ'; end if;
 saved:=public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','custom.screen',array['first','second']);
 if saved->>'scope_key'<>'custom.screen' or saved->'block_order'<>'["first","second"]'::jsonb then raise exception 'RPC_CONFIRMATION_FAILED'; end if;
 perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','anotherScope',array['unlistedBlock']);
 perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','custom.screen',array['second','first']);
 if (select count(*) from public.homecare_user_block_layouts)<>2
   or (select block_order from public.homecare_user_block_layouts where scope_key='anotherScope')<>array['unlistedBlock']
   or (select block_order from public.homecare_user_block_layouts where scope_key='custom.screen')<>array['second','first'] then
   raise exception 'ATOMIC_SCOPE_UPSERT_FAILED';
 end if;
 perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','emptyScope','{}');
 perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001',repeat('a',80),
   array(select 'block-'||n from generate_series(1,64) n));
 foreach scope in array array[null,'','Uppercase','with space','a_b','a/b','a'||chr(10),repeat('a',81),'a'||chr(233)] loop
   begin
     perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001',scope,array['block']);
     raise exception 'INVALID_SCOPE_ACCEPTED';
   exception when check_violation then null; end;
 end loop;
 for bad in select value from (values
   (null::text[]),(array['duplicate','duplicate']),(array['block',null]),
   (array['Uppercase']),(array['']),(array['a_b']),(array['a/b']),(array['with space']),
   (array['a'||chr(10)]),(array['a'||chr(233)]),(array[repeat('a',81)]),
   (array[array['first','second']]),
   (array(select 'block-'||n from generate_series(1,65) n))
 ) invalid(value) loop
   begin
     perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','invalidScope',bad);
     raise exception 'INVALID_ORDER_ACCEPTED';
   exception when check_violation then null; end;
 end loop;
 -- Constraints sichern auch direkte Schreibwege ohne RPC.
 begin
   insert into public.homecare_user_block_layouts values('00000000-0000-0000-0000-000000000001','a1415000-0000-4000-8000-000000000001','direct',array['bad','bad']);
   raise exception 'DIRECT_INVALID_ACCEPTED';
 exception when check_violation then null; end;
 begin
   update public.homecare_user_block_layouts set block_order=null where scope_key='custom.screen';
   raise exception 'DIRECT_NULL_ACCEPTED';
 exception when not_null_violation then null; end;
 begin
   perform public.homecare_update_block_layout('b1415000-0000-4000-8000-000000000002','custom.screen',array['bad']);
   raise exception 'FOREIGN_TENANT_RPC_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.homecare_user_block_layouts values('00000000-0000-0000-0000-000000000001','a1415000-0000-4000-8000-000000000002','foreign',array['bad']);
   raise exception 'FOREIGN_USER_INSERT_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.homecare_user_block_layouts values('b1415000-0000-4000-8000-000000000002','a1415000-0000-4000-8000-000000000001','foreign',array['bad']);
   raise exception 'FOREIGN_TENANT_INSERT_ALLOWED';
 exception when insufficient_privilege then null; end;
 update public.homecare_user_block_layouts set block_order=array['bad'] where user_id='a1415000-0000-4000-8000-000000000002';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FOREIGN_USER_UPDATE_ALLOWED'; end if;
 begin
   update public.homecare_user_block_layouts set user_id='a1415000-0000-4000-8000-000000000002' where scope_key='custom.screen';
   raise exception 'OWNER_CHANGE_ALLOWED';
 exception when insufficient_privilege then null; end;
 begin
   delete from public.homecare_user_block_layouts;
   raise exception 'DELETE_ALLOWED';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.headers','{"x-workcore-tenant":"b1415000-0000-4000-8000-000000000002"}',true);
do $$ begin
 if exists(select 1 from public.homecare_user_block_layouts) then raise exception 'SUSPENDED_MEMBERSHIP_READ'; end if;
 begin
   perform public.homecare_update_block_layout('b1415000-0000-4000-8000-000000000002','custom.screen',array['bad']);
   raise exception 'SUSPENDED_MEMBERSHIP_WRITE';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1415000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.homecare_user_block_layouts) then raise exception 'NONMEMBER_READ'; end if;
 begin
   perform public.homecare_update_block_layout('b1415000-0000-4000-8000-000000000002','custom.screen',array['bad']);
   raise exception 'NONMEMBER_WRITE';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.homecare_user_block_layouts; raise exception 'ANON_READ_ALLOWED'; exception when insufficient_privilege then null; end;
 begin
   perform public.homecare_update_block_layout('00000000-0000-0000-0000-000000000001','custom.screen',array['bad']);
   raise exception 'ANON_RPC_ALLOWED';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.homecare_user_block_layouts'::regclass)
   or has_table_privilege('anon','public.homecare_user_block_layouts','SELECT,INSERT,UPDATE,DELETE')
   or has_table_privilege('authenticated','public.homecare_user_block_layouts','DELETE')
   or not has_table_privilege('authenticated','public.homecare_user_block_layouts','SELECT')
   or not has_table_privilege('authenticated','public.homecare_user_block_layouts','INSERT')
   or not has_table_privilege('authenticated','public.homecare_user_block_layouts','UPDATE')
   or has_function_privilege('anon','public.homecare_update_block_layout(uuid,text,text[])','EXECUTE')
   or (select prosecdef from pg_proc where oid='public.homecare_update_block_layout(uuid,text,text[])'::regprocedure)
   or has_function_privilege('authenticated','public.homecare_relational_backup_tables()','EXECUTE') then
   raise exception 'UNSAFE_BLOCK_LAYOUT_SECURITY';
 end if;
 if (select block_order from public.homecare_user_block_layouts where user_id='a1415000-0000-4000-8000-000000000002')<>array['otherUser']
   or (select block_order from public.homecare_user_block_layouts where tenant_id='b1415000-0000-4000-8000-000000000002')<>array['otherTenant'] then
   raise exception 'FOREIGN_LAYOUT_CHANGED';
 end if;
end $$;
set local role service_role;
do $$ declare tables text[]:=public.homecare_relational_backup_tables(); begin
 if not ('homecare_user_block_layouts'=any(tables)) or not ('homecare_user_layout_preferences'=any(tables))
   or cardinality(tables)<>cardinality(public.homecare_relational_backup_tables_before_block_layouts())+1 then
   raise exception 'BLOCK_LAYOUT_BACKUP_MISSING';
 end if;
end $$;
reset role;
rollback;
