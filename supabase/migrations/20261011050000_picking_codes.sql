begin;

alter table public.homecare_picking_orders add column picking_code text;
with numbered as (
  select tenant_id,id,
    to_char(created_at at time zone 'Europe/Stockholm','YYYY-MM-DD') as day,
    row_number() over (partition by tenant_id,(created_at at time zone 'Europe/Stockholm')::date order by created_at,id) as number
  from public.homecare_picking_orders
)
update public.homecare_picking_orders o
set picking_code=n.day||'-'||case when n.number<=99999 then lpad(n.number::text,5,'0') else n.number::text end
from numbered n where o.tenant_id=n.tenant_id and o.id=n.id;
alter table public.homecare_picking_orders
  alter column picking_code set not null,
  add constraint picking_code_format check(picking_code ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{5}$'),
  add constraint picking_code_unique unique(tenant_id,picking_code);

create function public.homecare_assign_picking_code()
returns trigger language plpgsql security definer set search_path=public as $$
declare prefix text; next_number integer;
begin
  if tg_op='UPDATE' then
    if new.picking_code is distinct from old.picking_code then raise exception 'PICKING_CODE_IMMUTABLE'; end if;
    return new;
  end if;
  prefix:=to_char(new.created_at at time zone 'Europe/Stockholm','YYYY-MM-DD')||'-';
  -- Serialise allocation per tenant/day, including restored orders.
  perform pg_advisory_xact_lock(hashtextextended('picking-code:'||new.tenant_id::text||':'||prefix,0));
  if new.picking_code is null then
    select coalesce(max(substring(picking_code from 12)::integer),0)+1 into next_number
    from public.homecare_picking_orders where tenant_id=new.tenant_id and picking_code like prefix||'%';
    if next_number>99999 then raise exception 'PICKING_CODE_EXHAUSTED'; end if;
    new.picking_code:=prefix||lpad(next_number::text,5,'0');
  elsif new.picking_code not like prefix||'%' then raise exception 'PICKING_CODE_DATE_INVALID'; end if;
  return new;
end $$;
revoke all on function public.homecare_assign_picking_code() from public;
create trigger assign_picking_code before insert or update on public.homecare_picking_orders
for each row execute function public.homecare_assign_picking_code();
commit;
