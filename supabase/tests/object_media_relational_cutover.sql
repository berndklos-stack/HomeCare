-- Run after 20260928190000_objects_media_relational_cutover.sql. Always rolls back.
begin;

insert into public.homecare_tenants(id,slug,name) values
  ('80000000-0000-0000-0000-000000000001','object-cutover-a','Object cutover A'),
  ('80000000-0000-0000-0000-000000000002','object-cutover-b','Object cutover B')
on conflict(id) do update set slug=excluded.slug,name=excluded.name;

create temporary table object_results(key text primary key,result jsonb not null);
insert into object_results values
('create',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000001','object','OBJECT-A','create','OBJECT-A','80000000-0000-0000-0000-000000000001','{"name":"Object A","type":"Projekt","customFields":{"manager":"Anna"}}',null)),
('retry',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000001','object','OBJECT-A','create','OBJECT-A','80000000-0000-0000-0000-000000000001','{}',null)),
('other-tenant',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000001','object','OBJECT-B','create','OBJECT-B','80000000-0000-0000-0000-000000000002','{"name":"Object B"}',null));

insert into object_results values
('update',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000002','object','OBJECT-A','update','OBJECT-A','80000000-0000-0000-0000-000000000001','{"name":"Object A updated"}',1)),
('stale',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000003','object','OBJECT-A','update','OBJECT-A','80000000-0000-0000-0000-000000000001','{"name":"Must not win"}',1)),
('cross-tenant',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000004','object','OBJECT-A','update','OBJECT-A','80000000-0000-0000-0000-000000000002','{"name":"Cross tenant"}',2));

insert into object_results values
('media-create',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000005','object_media','MEDIA-A','create','OBJECT-A','80000000-0000-0000-0000-000000000001','{"type":"Bild","name":"a.jpg","source":"Kamera","storagePath":"80000000-0000-0000-0000-000000000001/object-photos/a.jpg"}',null)),
('media-stale',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000006','object_media','MEDIA-A','update','OBJECT-A','80000000-0000-0000-0000-000000000001','{"name":"stale.jpg"}',0)),
('media-cross-path',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000007','object_media','MEDIA-B','create','OBJECT-A','80000000-0000-0000-0000-000000000001','{"type":"Bild","name":"b.jpg","storagePath":"80000000-0000-0000-0000-000000000002/object-photos/b.jpg"}',null)),
('media-delete',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000008','object_media','MEDIA-A','delete','OBJECT-A','80000000-0000-0000-0000-000000000001','{}',1));

do $$ begin
  if (select result->>'status' from object_results where key='create')<>'synced'
    or (select result from object_results where key='create')<>(select result from object_results where key='retry')
    or (select result->>'status' from object_results where key='update')<>'synced'
    or (select result->>'status' from object_results where key='stale')<>'conflict'
    or (select result->>'status' from object_results where key='cross-tenant')<>'conflict'
    or (select result->>'status' from object_results where key='media-create')<>'synced'
    or (select result->>'status' from object_results where key='media-stale')<>'conflict'
    or (select result->>'status' from object_results where key='media-cross-path')<>'conflict'
    or (select result->>'status' from object_results where key='media-delete')<>'synced'
    or not exists(select 1 from public.homecare_objects where tenant_id='80000000-0000-0000-0000-000000000001' and id='OBJECT-A' and name='Object A updated' and object_type='Projekt' and custom_fields->>'manager'='Anna' and revision=2)
    or not exists(select 1 from public.homecare_media where tenant_id='80000000-0000-0000-0000-000000000001' and id='MEDIA-A' and deleted_at is not null and revision=2) then
    raise exception 'OBJECT_MEDIA_CRUD_IDEMPOTENCY_REVISION_SCOPE_FAILED';
  end if;
end $$;

insert into public.homecare_jobs(tenant_id,id,object_id,title,status,priority)
values('80000000-0000-0000-0000-000000000001','OBJECT-JOB-A','OBJECT-A','Active job','geplant','normal');
insert into object_results values
('archive',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000009','object','OBJECT-A','update','OBJECT-A','80000000-0000-0000-0000-000000000001','{"archived":true}',2)),
('delete-blocked',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000010','object','OBJECT-A','delete','OBJECT-A','80000000-0000-0000-0000-000000000001','{}',3));
update public.homecare_jobs set status='erledigt' where tenant_id='80000000-0000-0000-0000-000000000001' and id='OBJECT-JOB-A';
insert into object_results values
('delete',public.homecare_apply_object_mutation('81000000-0000-0000-0000-000000000011','object','OBJECT-A','delete','OBJECT-A','80000000-0000-0000-0000-000000000001','{}',3));

do $$ begin
  if (select result->>'status' from object_results where key='delete-blocked')<>'conflict'
    or (select result->>'status' from object_results where key='delete')<>'synced'
    or not exists(select 1 from public.homecare_objects where tenant_id='80000000-0000-0000-0000-000000000001' and id='OBJECT-A' and deleted_at is not null and revision=4)
    or not exists(select 1 from public.homecare_jobs where tenant_id='80000000-0000-0000-0000-000000000001' and id='OBJECT-JOB-A' and object_id='OBJECT-A') then
    raise exception 'OBJECT_DELETE_GUARD_TOMBSTONE_OR_REFERENCE_FAILED';
  end if;
end $$;

do $$ begin
  begin
    delete from public.homecare_objects where tenant_id='80000000-0000-0000-0000-000000000001' and id='OBJECT-A';
    raise exception 'OBJECT_HARD_DELETE_WAS_NOT_BLOCKED';
  exception when check_violation then null;
  end;
end $$;

rollback;
