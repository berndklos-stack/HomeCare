begin;
create or replace function public.homecare_relational_backup_tables() returns text[]
language sql immutable set search_path=public as $$ select array[
  'homecare_roles','homecare_user_profiles','homecare_user_invitations','homecare_subscriptions','homecare_tenant_modules',
  'homecare_settings','homecare_translations','homecare_customers','homecare_customer_contacts','homecare_personnel',
  'homecare_suppliers','homecare_supplier_contacts',
  'homecare_accounting_accounts','homecare_inventory_locations','homecare_services','homecare_service_packages',
  'homecare_objects','homecare_resources','homecare_jobs','homecare_field_progress','homecare_job_time_entries',
  'homecare_job_notes','homecare_reports','homecare_portal_messages','homecare_portal_message_replies','homecare_media',
  'homecare_materials','homecare_inventory_movements','homecare_billing_items','homecare_invoice_lines','homecare_payments',
  'homecare_accounting_exports','homecare_vehicle_trips','homecare_vehicle_positions','homecare_daily_mail_state',
  'homecare_portal_access','homecare_odometer_history','homecare_trip_audit_log','homecare_driving_log_regulations',
  'homecare_field_progress_archive','homecare_financial_audit','homecare_sync_mutations','homecare_audit_log','homecare_tenant_memberships',
  'homecare_purchase_orders','homecare_purchase_order_items','homecare_purchase_receipts',
  'homecare_resource_assignments','homecare_maintenance_plans','homecare_maintenance_events',
  'homecare_legacy_stock_entries','homecare_stock_movements','homecare_stock_cutovers'
]::text[] $$;
revoke all on function public.homecare_relational_backup_tables() from public,anon,authenticated;
grant execute on function public.homecare_relational_backup_tables() to service_role;

-- New references can point backwards in the existing backup order (e.g. a
-- vehicle storage location). Defer only these new foreign keys until commit.
alter table public.homecare_inventory_locations alter constraint inventory_location_resource_fk deferrable initially deferred;
alter table public.homecare_inventory_locations alter constraint inventory_location_project_fk deferrable initially deferred;

create or replace function public.homecare_purchase_item_guard()
returns trigger language plpgsql set search_path=public as $$
declare tenant uuid; purchase_id uuid; current_status text;
begin
  -- Restore RPC first verifies an empty target and backups.manage permission.
  -- Ordinary clients still have no INSERT/UPDATE/DELETE grants on this table.
  if tg_op='INSERT' and current_setting('workcore.operations_restore',true)='1' then return new; end if;
  if tg_op='DELETE' then tenant:=old.tenant_id; purchase_id:=old.order_id;
  else tenant:=new.tenant_id; purchase_id:=new.order_id; end if;
  if tg_op='UPDATE' and (new.tenant_id,new.id,new.order_id) is distinct from (old.tenant_id,old.id,old.order_id) then
    raise exception 'PURCHASE_ITEM_IDENTITY_IMMUTABLE' using errcode='23514';
  end if;
  select status into current_status from public.homecare_purchase_orders where tenant_id=tenant and id=purchase_id for update;
  if current_status is distinct from 'draft' then raise exception 'ORDERED_ITEMS_IMMUTABLE' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

-- Retain the existing authorization, manifest checks and empty-target rules.
do $$ begin
  if to_regprocedure('public.homecare_restore_relational_backup_base(uuid,uuid)') is null
    and to_regprocedure('public.homecare_restore_relational_backup(uuid,uuid)') is not null then
    alter function public.homecare_restore_relational_backup(uuid,uuid) rename to homecare_restore_relational_backup_base;
  end if;
end $$;
create or replace function public.homecare_restore_relational_backup(p_backup_id uuid,p_target_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; previous_flag text:=current_setting('workcore.operations_restore',true);
begin
  perform set_config('workcore.operations_restore','1',true);
  result:=public.homecare_restore_relational_backup_base(p_backup_id,p_target_tenant_id);
  perform set_config('workcore.operations_restore',coalesce(previous_flag,''),true);
  return result;
end $$;
revoke all on function public.homecare_restore_relational_backup(uuid,uuid) from public,anon;
grant execute on function public.homecare_restore_relational_backup(uuid,uuid) to authenticated,service_role;
commit;
