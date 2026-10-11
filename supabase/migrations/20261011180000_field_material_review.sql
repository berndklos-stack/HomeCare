begin;
create table public.homecare_field_material_reviews (
 tenant_id uuid not null,
 id uuid not null,
 job_id text not null,
 execution_date date not null,
 job_revision bigint not null,
 all_consumed boolean not null,
 additional_used boolean not null,
 actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(tenant_id,id),
 unique(tenant_id,job_id,execution_date),
 foreign key(tenant_id,job_id) references public.homecare_jobs(tenant_id,id)
);
create table public.homecare_field_material_review_items (
 tenant_id uuid not null,
 review_id uuid not null,
 material_id text not null,
 source_id text not null,
 allocated_quantity numeric not null check(allocated_quantity>=0 and allocated_quantity=round(allocated_quantity,3)),
 consumed_quantity numeric not null check(consumed_quantity>=0 and consumed_quantity=round(consumed_quantity,3)),
 additional boolean not null,
 primary key(tenant_id,review_id,material_id,source_id,additional),
 foreign key(tenant_id,review_id) references public.homecare_field_material_reviews(tenant_id,id),
 foreign key(tenant_id,material_id) references public.homecare_materials(tenant_id,id),
 foreign key(tenant_id,source_id) references public.homecare_inventory_locations(tenant_id,id),
 check((additional and allocated_quantity=0 and consumed_quantity>0) or (not additional and consumed_quantity<=allocated_quantity))
);
alter table public.homecare_field_material_reviews enable row level security;
alter table public.homecare_field_material_review_items enable row level security;
create policy field_material_review_read on public.homecare_field_material_reviews for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
create policy field_material_review_item_read on public.homecare_field_material_review_items for select to authenticated using(tenant_id=public.homecare_request_tenant() and public.homecare_has_permission(tenant_id,'data.read'));
revoke all on public.homecare_field_material_reviews,public.homecare_field_material_review_items from anon,authenticated;
grant select on public.homecare_field_material_reviews,public.homecare_field_material_review_items to authenticated;
grant all on public.homecare_field_material_reviews,public.homecare_field_material_review_items to service_role;

create function public.homecare_review_field_material(p_tenant uuid,p_id uuid,p_job text,p_date date,p_revision bigint,p_all boolean,p_additional boolean,p_lines jsonb,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare saved public.homecare_field_material_reviews%rowtype; job public.homecare_jobs%rowtype; line record; loaded integer;
begin
 if p_tenant is null or p_id is null or p_actor is null or p_date is null or p_all is null or p_additional is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>100 then raise exception 'INVALID_MATERIAL_REVIEW'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':field-review:'||p_job||':'||p_date::text,0));
 select * into saved from public.homecare_field_material_reviews where tenant_id=p_tenant and job_id=p_job and execution_date=p_date;
 if found then
   if saved.id<>p_id or saved.actor_user_id<>p_actor or saved.all_consumed<>p_all or saved.additional_used<>p_additional or exists(
     (select material_id,source_id,allocated_quantity,consumed_quantity,additional from public.homecare_field_material_review_items where tenant_id=p_tenant and review_id=p_id
      except select * from jsonb_to_recordset(p_lines) as x(material_id text,source_id text,allocated_quantity numeric,consumed_quantity numeric,additional boolean))
     union all
     (select * from jsonb_to_recordset(p_lines) as x(material_id text,source_id text,allocated_quantity numeric,consumed_quantity numeric,additional boolean)
      except select material_id,source_id,allocated_quantity,consumed_quantity,additional from public.homecare_field_material_review_items where tenant_id=p_tenant and review_id=p_id)
   ) then raise exception 'MATERIAL_REVIEW_CHANGED'; end if;
   return saved.id;
 end if;
 select * into job from public.homecare_jobs where tenant_id=p_tenant and id=p_job for update;
 if not found or job.deleted_at is not null or job.status not in('geplant','in Arbeit','pausiert') or job.revision<>p_revision then raise exception 'JOB_NOT_OPEN'; end if;
 if job.billable is false then raise exception 'JOB_NOT_BILLABLE'; end if;
 perform 1 from public.homecare_picking_orders where tenant_id=p_tenant and job_id=p_job and status='loaded' order by id for update;
 select count(*) into loaded from public.homecare_picking_orders where tenant_id=p_tenant and job_id=p_job and status='loaded';
 if loaded=0 then raise exception 'MATERIAL_REVIEW_CHANGED'; end if;
 if exists(
   (select i.material_id,o.destination_id,sum(i.picked) from public.homecare_picking_items i join public.homecare_picking_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id where o.tenant_id=p_tenant and o.job_id=p_job and o.status='loaded' group by i.material_id,o.destination_id
    except select material_id,source_id,allocated_quantity from jsonb_to_recordset(p_lines) as x(material_id text,source_id text,allocated_quantity numeric,additional boolean) where not additional)
   union all
   (select material_id,source_id,allocated_quantity from jsonb_to_recordset(p_lines) as x(material_id text,source_id text,allocated_quantity numeric,additional boolean) where not additional
    except select i.material_id,o.destination_id,sum(i.picked) from public.homecare_picking_items i join public.homecare_picking_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id where o.tenant_id=p_tenant and o.job_id=p_job and o.status='loaded' group by i.material_id,o.destination_id)
 ) then raise exception 'MATERIAL_REVIEW_CHANGED'; end if;
 if p_all and exists(select 1 from jsonb_to_recordset(p_lines) as x(allocated_quantity numeric,consumed_quantity numeric,additional boolean) where not additional and allocated_quantity<>consumed_quantity)
   or p_additional is distinct from exists(select 1 from jsonb_to_recordset(p_lines) as x(additional boolean) where additional) then raise exception 'INVALID_MATERIAL_REVIEW'; end if;
 insert into public.homecare_field_material_reviews(tenant_id,id,job_id,execution_date,job_revision,all_consumed,additional_used,actor_user_id) values(p_tenant,p_id,p_job,p_date,p_revision,p_all,p_additional,p_actor);
 for line in select * from jsonb_to_recordset(p_lines) as x(material_id text,source_id text,allocated_quantity numeric,consumed_quantity numeric,additional boolean) order by material_id,source_id,additional loop
   if not exists(select 1 from public.homecare_inventory_locations where tenant_id=p_tenant and id=line.source_id and location_kind='vehicle' and not archived and deleted_at is null) then raise exception 'PICKING_INVALID_VEHICLE'; end if;
   insert into public.homecare_field_material_review_items values(p_tenant,p_id,line.material_id,line.source_id,line.allocated_quantity,line.consumed_quantity,line.additional);
   if line.consumed_quantity>0 then
     perform public.homecare_stock_post(p_tenant,md5(p_id::text||':'||line.material_id||':'||line.source_id||':'||line.additional::text)::uuid,line.material_id,line.source_id,null,line.consumed_quantity,p_actor,'Materialverbrauch beim Auftragsabschluss '||p_date::text,p_job);
   end if;
 end loop;
 perform set_config('homecare.picking_action','dispatched',true);
 perform set_config('homecare.picking_actor',p_actor::text,true);
 update public.homecare_picking_orders set status='dispatched',revision=revision+1,dispatched_at=now(),dispatched_by=p_actor where tenant_id=p_tenant and job_id=p_job and status='loaded';
 perform set_config('homecare.picking_action','',true);
 perform set_config('homecare.picking_actor','',true);
 return p_id;
end $$;
revoke all on function public.homecare_review_field_material(uuid,uuid,text,date,bigint,boolean,boolean,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.homecare_review_field_material(uuid,uuid,text,date,bigint,boolean,boolean,jsonb,uuid) to service_role;
alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_field_review;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public as $$
 select public.homecare_relational_backup_tables_before_field_review()||array['homecare_field_material_reviews','homecare_field_material_review_items']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
