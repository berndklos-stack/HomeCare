begin;

create table public.homecare_staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id),
  employee_id text not null,
  kind text not null check(kind in ('work','pause','interruption')),
  reason text not null default '' check(length(reason)<=300),
  note text not null default '' check(length(note)<=4000),
  started_at timestamptz not null,
  ended_at timestamptz check(ended_at>started_at),
  minutes numeric,
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  deleted_at timestamptz,
  foreign key(tenant_id,employee_id) references public.homecare_personnel(tenant_id,id),
  check((locked_at is null)=(locked_by is null)),
  check(locked_at is null or ended_at is not null)
);
create index staff_time_employee_start_idx on public.homecare_staff_time_entries(tenant_id,employee_id,started_at desc);
create unique index staff_time_one_running on public.homecare_staff_time_entries(tenant_id,employee_id) where ended_at is null and deleted_at is null;
create index staff_time_created_by_idx on public.homecare_staff_time_entries(created_by);
create index staff_time_updated_by_idx on public.homecare_staff_time_entries(updated_by);
create index staff_time_locked_by_idx on public.homecare_staff_time_entries(locked_by);
create function public.homecare_staff_time_duration() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.minutes:=case when new.ended_at is not null then round(extract(epoch from (new.ended_at-new.started_at))/60,2) end;
  return new;
end $$;
revoke all on function public.homecare_staff_time_duration() from public,anon,authenticated;
create trigger staff_time_duration before insert or update on public.homecare_staff_time_entries for each row execute function public.homecare_staff_time_duration();

create table public.homecare_staff_leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id),
  employee_id text not null,
  from_date date not null,
  to_date date not null check(to_date>=from_date),
  days numeric(6,2) not null check(days>0 and days<=366 and days*2=trunc(days*2)),
  note text not null default '' check(length(note)<=4000),
  status text not null default 'requested' check(status in ('requested','approved','rejected','cancelled')),
  requested_by uuid not null references auth.users(id),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  decision_reason text not null default '' check(length(decision_reason)<=4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  unique(tenant_id,id),
  foreign key(tenant_id,employee_id) references public.homecare_personnel(tenant_id,id),
  check(extract(year from from_date)=extract(year from to_date)),
  check(days<=to_date-from_date+1)
);
create index staff_leave_employee_dates_idx on public.homecare_staff_leave_requests(tenant_id,employee_id,from_date,to_date);
create index staff_leave_status_idx on public.homecare_staff_leave_requests(tenant_id,status,from_date);
create index staff_leave_requested_by_idx on public.homecare_staff_leave_requests(requested_by);
create index staff_leave_decided_by_idx on public.homecare_staff_leave_requests(decided_by);

create table public.homecare_staff_leave_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.homecare_tenants(id),
  request_id uuid not null,
  action text not null check(action in ('requested','approved','rejected','cancelled')),
  actor_id uuid not null references auth.users(id),
  reason text not null default '' check(length(reason)<=4000),
  created_at timestamptz not null default now(),
  foreign key(tenant_id,request_id) references public.homecare_staff_leave_requests(tenant_id,id)
);
create index staff_leave_events_request_idx on public.homecare_staff_leave_events(tenant_id,request_id,created_at);
create index staff_leave_events_actor_idx on public.homecare_staff_leave_events(actor_id);

create table public.homecare_staff_leave_balances (
  tenant_id uuid not null references public.homecare_tenants(id),
  employee_id text not null,
  year integer not null check(year between 2000 and 2200),
  entitlement_days numeric(6,2) not null check(entitlement_days between 0 and 366),
  carryover_days numeric(6,2) not null default 0 check(carryover_days between 0 and 366),
  used_days numeric(6,2) not null default 0 check(used_days between 0 and 732),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  primary key(tenant_id,employee_id,year),
  foreign key(tenant_id,employee_id) references public.homecare_personnel(tenant_id,id)
);
create index staff_balance_updated_by_idx on public.homecare_staff_leave_balances(updated_by);

create table public.homecare_staff_mutations (
  tenant_id uuid not null references public.homecare_tenants(id),
  id uuid not null,
  actor_id uuid not null references auth.users(id),
  command_digest text not null,
  created_at timestamptz not null default now(),
  primary key(tenant_id,id)
);
create index staff_mutations_actor_idx on public.homecare_staff_mutations(actor_id);

do $$ declare tab text; begin
  foreach tab in array array['homecare_staff_time_entries','homecare_staff_leave_requests','homecare_staff_leave_balances'] loop
    execute format('create trigger bump_revision before update on public.%I for each row execute function public.homecare_bump_revision()',tab);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_homecare_updated_at()',tab);
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated',tab);
    execute format('grant select on public.%I to authenticated',tab);
    execute format('grant all on public.%I to service_role',tab);
    execute format($policy$create policy staff_read on public.%I for select to authenticated using(
      tenant_id=public.homecare_request_tenant() and public.homecare_is_tenant_member(tenant_id)
      and exists(select 1 from public.homecare_tenant_modules f where f.tenant_id=%I.tenant_id and f.module='time_tracking' and f.enabled)
      and (public.homecare_has_permission(tenant_id,'tenant.admin') or exists(select 1 from public.homecare_tenant_memberships m
        where m.tenant_id=%I.tenant_id and m.user_id=(select auth.uid()) and m.status='active' and m.employee_id=%I.employee_id)))$policy$,tab,tab,tab,tab);
  end loop;
end $$;
alter table public.homecare_staff_leave_events enable row level security;
alter table public.homecare_staff_mutations enable row level security;
revoke all on public.homecare_staff_leave_events,public.homecare_staff_mutations from public,anon,authenticated;
grant select on public.homecare_staff_leave_events to authenticated;
grant all on public.homecare_staff_leave_events,public.homecare_staff_mutations to service_role;
create policy staff_leave_event_read on public.homecare_staff_leave_events for select to authenticated using(
  tenant_id=public.homecare_request_tenant() and exists(select 1 from public.homecare_staff_leave_requests r
    where r.tenant_id=homecare_staff_leave_events.tenant_id and r.id=homecare_staff_leave_events.request_id));

create function public.homecare_staff_command(p_tenant uuid,p_actor uuid,p_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare own_employee text; employee text; manager boolean; action text:=p_command->>'action';
  entry public.homecare_staff_time_entries%rowtype; leave_row public.homecare_staff_leave_requests%rowtype;
  balance public.homecare_staff_leave_balances%rowtype; journal public.homecare_staff_mutations%rowtype;
  stamp timestamptz; start_stamp timestamptz; end_stamp timestamptz;
  approved_days numeric; target uuid; year_number integer; revision_number bigint;
begin
  select m.employee_id,'tenant.admin'=any(r.permissions) into own_employee,manager
    from public.homecare_tenant_memberships m join public.homecare_roles r on r.tenant_id=m.tenant_id and r.id=m.role_id
    join public.homecare_tenants t on t.id=m.tenant_id
    where m.tenant_id=p_tenant and m.user_id=p_actor and m.status='active' and not t.archived;
  if not found then raise exception 'STAFF_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.homecare_tenant_modules where tenant_id=p_tenant and module='time_tracking' and enabled) then
    raise exception 'STAFF_MODULE_DISABLED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_id::text,0));
  select * into journal from public.homecare_staff_mutations where tenant_id=p_tenant and id=p_id;
  if found then
    if journal.actor_id<>p_actor or journal.command_digest<>md5(p_command::text) then raise exception 'STAFF_MUTATION_MISMATCH' using errcode='23514'; end if;
    return jsonb_build_object('ok',true);
  end if;
  employee:=coalesce(nullif(p_command->>'employeeId',''),own_employee);
  if employee is null or (not manager and employee is distinct from own_employee) then raise exception 'STAFF_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.homecare_personnel where tenant_id=p_tenant and id=employee and not archived and deleted_at is null) then
    raise exception 'STAFF_EMPLOYEE_MISSING' using errcode='23514'; end if;
  -- One lock serializes clock switches, manual corrections and leave decisions for this employee.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':staff:'||employee,0));
  stamp:=clock_timestamp();
  target:=nullif(p_command->>'id','')::uuid;
  revision_number:=(p_command->>'revision')::bigint;
  if action='clock' then
    select * into entry from public.homecare_staff_time_entries where tenant_id=p_tenant and employee_id=employee and ended_at is null and deleted_at is null for update;
    if found then
      if nullif(p_command->>'activeId','')::uuid is distinct from entry.id or revision_number is distinct from entry.revision then raise exception 'STAFF_CONFLICT' using errcode='40001'; end if;
      if p_command->>'kind'=entry.kind then raise exception 'STAFF_ALREADY_RUNNING' using errcode='23514'; end if;
      update public.homecare_staff_time_entries set ended_at=greatest(stamp,entry.started_at+interval '1 microsecond'),updated_by=p_actor,
        note=case when p_command->>'kind' is null then coalesce(nullif(p_command->>'note',''),entry.note) else entry.note end,
        reason=case when p_command->>'kind' is null then coalesce(nullif(p_command->>'reason',''),entry.reason) else entry.reason end where id=entry.id;
    elsif p_command->>'activeId' is not null then raise exception 'STAFF_CONFLICT' using errcode='40001';
    elsif p_command->>'kind' is null then raise exception 'STAFF_NOT_RUNNING' using errcode='23514'; end if;
    if p_command->>'kind' is not null then
      insert into public.homecare_staff_time_entries(tenant_id,employee_id,kind,reason,note,started_at,created_by,updated_by)
        values(p_tenant,employee,p_command->>'kind',coalesce(p_command->>'reason',''),coalesce(p_command->>'note',''),stamp,p_actor,p_actor);
    end if;
  elsif action in ('time_save','time_delete','time_lock','time_unlock') then
    if target is not null then
      select * into entry from public.homecare_staff_time_entries where tenant_id=p_tenant and employee_id=employee and id=target and deleted_at is null for update;
      if not found then raise exception 'STAFF_ENTRY_MISSING' using errcode='P0002'; end if;
      if revision_number is null or entry.revision<>revision_number then raise exception 'STAFF_CONFLICT' using errcode='40001'; end if;
      if entry.ended_at is null then raise exception 'STAFF_STOP_FIRST' using errcode='23514'; end if;
    elsif action<>'time_save' then raise exception 'STAFF_ENTRY_MISSING' using errcode='P0002'; end if;
    if action in ('time_lock','time_unlock') then
      if not manager then raise exception 'STAFF_FORBIDDEN' using errcode='42501'; end if;
      update public.homecare_staff_time_entries set locked_at=case when action='time_lock' then stamp end,
        locked_by=case when action='time_lock' then p_actor end,updated_by=p_actor where id=target;
    else
      if entry.locked_at is not null then raise exception 'STAFF_LOCKED' using errcode='23514'; end if;
      if action='time_delete' then
        update public.homecare_staff_time_entries set deleted_at=stamp,updated_by=p_actor where id=target;
      else
        start_stamp:=(p_command->>'startedAt')::timestamptz; end_stamp:=(p_command->>'endedAt')::timestamptz;
        if start_stamp is null or end_stamp is null or end_stamp<=start_stamp or end_stamp>stamp then raise exception 'STAFF_TIME_INVALID' using errcode='23514'; end if;
        if exists(select 1 from public.homecare_staff_time_entries e where tenant_id=p_tenant and employee_id=employee and deleted_at is null
          and (target is null or e.id<>target) and tstzrange(e.started_at,e.ended_at,'[)') && tstzrange(start_stamp,end_stamp,'[)')) then
          raise exception 'STAFF_TIME_OVERLAP' using errcode='23514'; end if;
        if target is null then
          insert into public.homecare_staff_time_entries(tenant_id,employee_id,kind,reason,note,started_at,ended_at,created_by,updated_by)
            values(p_tenant,employee,p_command->>'kind',coalesce(p_command->>'reason',''),coalesce(p_command->>'note',''),start_stamp,end_stamp,p_actor,p_actor);
        else
          update public.homecare_staff_time_entries set kind=p_command->>'kind',reason=coalesce(p_command->>'reason',''),note=coalesce(p_command->>'note',''),
            started_at=start_stamp,ended_at=end_stamp,updated_by=p_actor where id=target;
        end if;
      end if;
    end if;
  elsif action='leave_request' then
    if exists(select 1 from public.homecare_staff_leave_requests where tenant_id=p_tenant and employee_id=employee and status in ('requested','approved')
      and daterange(from_date,to_date,'[]') && daterange((p_command->>'from')::date,(p_command->>'to')::date,'[]')) then
      raise exception 'STAFF_LEAVE_OVERLAP' using errcode='23514'; end if;
    insert into public.homecare_staff_leave_requests(tenant_id,employee_id,from_date,to_date,days,note,requested_by)
      values(p_tenant,employee,(p_command->>'from')::date,(p_command->>'to')::date,(p_command->>'days')::numeric,coalesce(p_command->>'note',''),p_actor) returning * into leave_row;
    insert into public.homecare_staff_leave_events(tenant_id,request_id,action,actor_id) values(p_tenant,leave_row.id,'requested',p_actor);
  elsif action in ('leave_approve','leave_reject','leave_cancel') then
    select * into leave_row from public.homecare_staff_leave_requests where tenant_id=p_tenant and employee_id=employee and id=target for update;
    if not found then raise exception 'STAFF_ENTRY_MISSING' using errcode='P0002'; end if;
    if revision_number is null or leave_row.revision<>revision_number then raise exception 'STAFF_CONFLICT' using errcode='40001'; end if;
    if action<>'leave_cancel' and not manager then raise exception 'STAFF_FORBIDDEN' using errcode='42501'; end if;
    if leave_row.status<>'requested' and not (manager and action='leave_cancel' and leave_row.status='approved') then raise exception 'STAFF_LEAVE_DECIDED' using errcode='23514'; end if;
    if action='leave_approve' then
      select * into balance from public.homecare_staff_leave_balances where tenant_id=p_tenant and employee_id=employee and year=extract(year from leave_row.from_date);
      if not found then raise exception 'STAFF_BALANCE_MISSING' using errcode='23514'; end if;
      select coalesce(sum(days),0) into approved_days from public.homecare_staff_leave_requests where tenant_id=p_tenant and employee_id=employee and status='approved' and extract(year from from_date)=balance.year;
      if balance.entitlement_days+balance.carryover_days-balance.used_days-approved_days<leave_row.days then raise exception 'STAFF_BALANCE_EXCEEDED' using errcode='23514'; end if;
    end if;
    update public.homecare_staff_leave_requests set status=case action when 'leave_approve' then 'approved' when 'leave_reject' then 'rejected' else 'cancelled' end,
      decided_at=stamp,decided_by=p_actor,decision_reason=coalesce(p_command->>'reason','') where id=target returning * into leave_row;
    insert into public.homecare_staff_leave_events(tenant_id,request_id,action,actor_id,reason) values(p_tenant,target,leave_row.status,p_actor,leave_row.decision_reason);
  elsif action='balance_save' then
    if not manager then raise exception 'STAFF_FORBIDDEN' using errcode='42501'; end if;
    year_number:=(p_command->>'year')::integer;
    select * into balance from public.homecare_staff_leave_balances where tenant_id=p_tenant and employee_id=employee and year=year_number for update;
    if revision_number is null or coalesce(balance.revision,0)<>revision_number then raise exception 'STAFF_CONFLICT' using errcode='40001'; end if;
    select coalesce(sum(days),0) into approved_days from public.homecare_staff_leave_requests where tenant_id=p_tenant and employee_id=employee and status='approved' and extract(year from from_date)=year_number;
    if (p_command->>'entitlementDays')::numeric+(p_command->>'carryoverDays')::numeric-(p_command->>'usedDays')::numeric<approved_days then raise exception 'STAFF_BALANCE_EXCEEDED' using errcode='23514'; end if;
    insert into public.homecare_staff_leave_balances(tenant_id,employee_id,year,entitlement_days,carryover_days,used_days,updated_by)
      values(p_tenant,employee,year_number,(p_command->>'entitlementDays')::numeric,(p_command->>'carryoverDays')::numeric,(p_command->>'usedDays')::numeric,p_actor)
      on conflict(tenant_id,employee_id,year) do update set entitlement_days=excluded.entitlement_days,carryover_days=excluded.carryover_days,used_days=excluded.used_days,updated_by=excluded.updated_by;
  else raise exception 'STAFF_ACTION_INVALID' using errcode='23514'; end if;
  insert into public.homecare_staff_mutations(tenant_id,id,actor_id,command_digest) values(p_tenant,p_id,p_actor,md5(p_command::text));
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.homecare_staff_command(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.homecare_staff_command(uuid,uuid,uuid,jsonb) to service_role;

do $$ declare constraint_name text; begin
  for constraint_name in select conname from pg_constraint where conrelid='public.homecare_user_layout_preferences'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%navigation_order%' loop
    execute format('alter table public.homecare_user_layout_preferences drop constraint %I',constraint_name);
  end loop;
end $$;
alter table public.homecare_user_layout_preferences add constraint staff_navigation_order_check
  check(public.homecare_valid_layout_order(navigation_order,array['dashboard','objects','customers','jobs','planning','field','time','tracking','communication','billing','analytics','inventory','portal','masterData']::text[]));

alter function public.homecare_relational_backup_tables() rename to homecare_relational_backup_tables_before_staff;
create function public.homecare_relational_backup_tables() returns text[] language sql immutable set search_path=public,pg_temp as $$
  select public.homecare_relational_backup_tables_before_staff()||array['homecare_staff_time_entries','homecare_staff_leave_requests','homecare_staff_leave_balances','homecare_staff_leave_events','homecare_staff_mutations']::text[]
$$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;
commit;
