create or replace function public.homecare_text_to_numeric(value text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := replace(regexp_replace(coalesce(value, ''), '[^0-9,.-]', '', 'g'), ',', '.');
  if cleaned = '' or cleaned = '-' or cleaned = '.' then
    return null;
  end if;
  return cleaned::numeric;
exception
  when others then
    return null;
end;
$$;

create or replace function public.homecare_text_to_date(value text)
returns date
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  if value ~ '^\d{4}-\d{2}-\d{2}$' then
    return value::date;
  end if;
  if value ~ '^\d{2}\.\d{2}\.\d{4}$' then
    return to_date(value, 'DD.MM.YYYY');
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

create or replace function public.homecare_text_to_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function public.homecare_text_to_boolean(value text, fallback boolean)
returns boolean
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return fallback;
  end if;
  return value::boolean;
exception
  when others then
    return fallback;
end;
$$;

insert into public.homecare_customers (
  id, personal_number, name, contact, email, phone, phone2, address, billing_address,
  billing_address_mode, language, portal_login_email, portal_password, portal_status,
  balance, notes, report_mail_body, weekly_report_mail_body, offer_mail_body,
  order_confirmation_mail_body, work_time_visibility, billable, archived,
  portal_login_history, created_at, updated_at
)
select
  item->>'id',
  item->>'personalNumber',
  coalesce(nullif(item->>'name', ''), 'Unbenannter Kunde'),
  item->>'contact',
  item->>'email',
  item->>'phone',
  item->>'phone2',
  item->>'address',
  item->>'billingAddress',
  coalesce(nullif(item->>'billingAddressMode', ''), 'Kundenadresse'),
  coalesce(nullif(item->>'language', ''), 'Deutsch'),
  item->>'portalLoginEmail',
  item->>'portalPassword',
  coalesce(nullif(item->>'portalStatus', ''), 'einladen'),
  coalesce(public.homecare_text_to_numeric(item->>'balance'), 0),
  item->>'notes',
  item->>'reportMailBody',
  item->>'weeklyReportMailBody',
  item->>'offerMailBody',
  item->>'orderConfirmationMailBody',
  coalesce(nullif(item->>'workTimeVisibility', ''), 'service'),
  public.homecare_text_to_boolean(item->>'billable', true),
  public.homecare_text_to_boolean(item->>'archived', false),
  coalesce(item->'portalLoginHistory', '[]'::jsonb),
  coalesce(public.homecare_text_to_timestamptz(item->>'createdAt'), now()),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'customers', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  personal_number = excluded.personal_number,
  name = excluded.name,
  contact = excluded.contact,
  email = excluded.email,
  phone = excluded.phone,
  phone2 = excluded.phone2,
  address = excluded.address,
  billing_address = excluded.billing_address,
  billing_address_mode = excluded.billing_address_mode,
  language = excluded.language,
  portal_login_email = excluded.portal_login_email,
  portal_password = excluded.portal_password,
  portal_status = excluded.portal_status,
  balance = excluded.balance,
  notes = excluded.notes,
  report_mail_body = excluded.report_mail_body,
  weekly_report_mail_body = excluded.weekly_report_mail_body,
  offer_mail_body = excluded.offer_mail_body,
  order_confirmation_mail_body = excluded.order_confirmation_mail_body,
  work_time_visibility = excluded.work_time_visibility,
  billable = excluded.billable,
  archived = excluded.archived,
  portal_login_history = excluded.portal_login_history;

insert into public.homecare_personnel (
  id, personnel_number, first_name, last_name, role, email, phone, language, status,
  notes, archived, created_at, updated_at
)
select
  item->>'id',
  item->>'personnelNumber',
  coalesce(nullif(item->>'firstName', ''), 'Unbenannt'),
  coalesce(nullif(item->>'lastName', ''), ''),
  item->>'role',
  item->>'email',
  item->>'phone',
  coalesce(nullif(item->>'language', ''), 'Deutsch'),
  coalesce(nullif(item->>'status', ''), 'aktiv'),
  item->>'notes',
  public.homecare_text_to_boolean(item->>'archived', false),
  coalesce(public.homecare_text_to_timestamptz(item->>'createdAt'), now()),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'personnel', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  personnel_number = excluded.personnel_number,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  email = excluded.email,
  phone = excluded.phone,
  language = excluded.language,
  status = excluded.status,
  notes = excluded.notes,
  archived = excluded.archived;

insert into public.homecare_objects (
  id, owner_customer_id, name, owner_name, owner_email, owner_phone, owner_address,
  address, billing_address_mode, billing_address, region, size_sqm, plot_sqm, rooms,
  beds, bathrooms, build_year, care_package, status, key_safe, alarm, parking,
  access_notes, heating, water, septic, internet, equipment, risks, next_visit,
  last_visit, archived, created_at, updated_at
)
select
  item->>'id',
  case when exists (select 1 from public.homecare_customers c where c.id = item->>'ownerCustomerId') then item->>'ownerCustomerId' else null end,
  coalesce(nullif(item->>'name', ''), 'Unbenanntes Objekt'),
  item->>'owner',
  item->>'ownerEmail',
  item->>'ownerPhone',
  item->>'ownerAddress',
  item->>'address',
  coalesce(nullif(item->>'billingAddressMode', ''), 'Objektadresse'),
  item->>'billingAddress',
  item->>'region',
  public.homecare_text_to_numeric(item->>'sizeSqm')::integer,
  public.homecare_text_to_numeric(item->>'plotSqm')::integer,
  public.homecare_text_to_numeric(item->>'rooms')::integer,
  public.homecare_text_to_numeric(item->>'beds')::integer,
  public.homecare_text_to_numeric(item->>'bathrooms')::integer,
  public.homecare_text_to_numeric(item->>'buildYear')::integer,
  item->>'carePackage',
  item->>'status',
  item#>>'{access,keySafe}',
  item#>>'{access,alarm}',
  item#>>'{access,parking}',
  item#>>'{access,notes}',
  item#>>'{utilities,heating}',
  item#>>'{utilities,water}',
  item#>>'{utilities,septic}',
  item#>>'{utilities,internet}',
  coalesce(item->'equipment', '[]'::jsonb),
  coalesce(item->'risks', '[]'::jsonb),
  public.homecare_text_to_date(item->>'nextVisit'),
  public.homecare_text_to_date(item->>'lastVisit'),
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'objects', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  owner_customer_id = excluded.owner_customer_id,
  name = excluded.name,
  owner_name = excluded.owner_name,
  owner_email = excluded.owner_email,
  owner_phone = excluded.owner_phone,
  owner_address = excluded.owner_address,
  address = excluded.address,
  billing_address_mode = excluded.billing_address_mode,
  billing_address = excluded.billing_address,
  region = excluded.region,
  size_sqm = excluded.size_sqm,
  plot_sqm = excluded.plot_sqm,
  rooms = excluded.rooms,
  beds = excluded.beds,
  bathrooms = excluded.bathrooms,
  build_year = excluded.build_year,
  care_package = excluded.care_package,
  status = excluded.status,
  key_safe = excluded.key_safe,
  alarm = excluded.alarm,
  parking = excluded.parking,
  access_notes = excluded.access_notes,
  heating = excluded.heating,
  water = excluded.water,
  septic = excluded.septic,
  internet = excluded.internet,
  equipment = excluded.equipment,
  risks = excluded.risks,
  next_visit = excluded.next_visit,
  last_visit = excluded.last_visit,
  archived = excluded.archived;

insert into public.homecare_media (
  id, owner_type, owner_id, kind, name, description, source, storage_path, preview_url,
  is_primary, metadata, created_at, updated_at
)
select
  media->>'id',
  'object',
  object_item->>'id',
  coalesce(nullif(media->>'type', ''), 'Bild'),
  coalesce(nullif(media->>'name', ''), 'Datei'),
  media->>'description',
  media->>'source',
  media->>'storagePath',
  media->>'previewUrl',
  public.homecare_text_to_boolean(media->>'isPrimary', false),
  media,
  now(),
  now()
from public.app_state,
  jsonb_array_elements(coalesce(data->'objects', '[]'::jsonb)) object_item,
  jsonb_array_elements(coalesce(object_item#>'{media,items}', '[]'::jsonb)) media
where id = 'kolaretorp-service-app' and media ? 'id'
on conflict (id) do update set
  owner_id = excluded.owner_id,
  kind = excluded.kind,
  name = excluded.name,
  description = excluded.description,
  source = excluded.source,
  storage_path = excluded.storage_path,
  preview_url = excluded.preview_url,
  is_primary = excluded.is_primary,
  metadata = excluded.metadata;

insert into public.homecare_inventory_locations (id, name, site, note, archived, created_at, updated_at)
select
  item->>'id',
  coalesce(nullif(item->>'name', ''), 'Lagerort'),
  item->>'site',
  item->>'note',
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'inventoryLocations', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  name = excluded.name,
  site = excluded.site,
  note = excluded.note,
  archived = excluded.archived;

insert into public.homecare_accounting_accounts (account, category, label, archived, created_at, updated_at)
select
  item->>'account',
  coalesce(nullif(item->>'category', ''), 'Sonstiges'),
  coalesce(nullif(item->>'label', ''), item->>'account'),
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'accountingAccounts', '[]'::jsonb)) item
where id = 'kolaretorp-service-app' and coalesce(item->>'account', '') <> ''
on conflict (account) do update set
  category = excluded.category,
  label = excluded.label,
  archived = excluded.archived;

insert into public.homecare_services (
  id, accounting_account, name, category, unit, price, currency, tax_rate,
  show_work_time_in_reports, description, checklist, archived, created_at, updated_at
)
select
  item->>'id',
  item->>'accountingAccount',
  coalesce(nullif(item->>'name', ''), 'Leistung'),
  item->>'category',
  item->>'unit',
  public.homecare_text_to_numeric(item->>'price'),
  coalesce(nullif(item->>'currency', ''), 'SEK'),
  public.homecare_text_to_numeric(item->>'taxRate'),
  public.homecare_text_to_boolean(item->>'showWorkTimeInReports', false),
  item->>'description',
  coalesce(item->'checklist', '[]'::jsonb),
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'services', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  accounting_account = excluded.accounting_account,
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  price = excluded.price,
  currency = excluded.currency,
  tax_rate = excluded.tax_rate,
  show_work_time_in_reports = excluded.show_work_time_in_reports,
  description = excluded.description,
  checklist = excluded.checklist,
  archived = excluded.archived;

insert into public.homecare_service_packages (id, name, price, description, service_ids, archived, created_at, updated_at)
select
  item->>'id',
  coalesce(nullif(item->>'name', ''), 'Paket'),
  public.homecare_text_to_numeric(item->>'price'),
  item->>'description',
  coalesce(item->'serviceIds', '[]'::jsonb),
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'packages', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  description = excluded.description,
  service_ids = excluded.service_ids,
  archived = excluded.archived;

insert into public.homecare_materials (
  id, accounting_account, sku, name, category, unit, sales_price, purchase_price,
  currency, tax_rate, supplier, primary_location_id, min_stock, max_stock,
  description, archived, created_at, updated_at
)
select
  item->>'id',
  item->>'accountingAccount',
  item->>'sku',
  coalesce(nullif(item->>'name', ''), 'Material'),
  item->>'category',
  item->>'unit',
  public.homecare_text_to_numeric(item->>'price'),
  public.homecare_text_to_numeric(item->>'purchasePrice'),
  coalesce(nullif(item->>'currency', ''), 'SEK'),
  public.homecare_text_to_numeric(item->>'taxRate'),
  item->>'supplier',
  case when exists (select 1 from public.homecare_inventory_locations l where l.id = item->>'primaryLocation') then item->>'primaryLocation' else null end,
  public.homecare_text_to_numeric(item->>'minStock'),
  public.homecare_text_to_numeric(item->>'maxStock'),
  item->>'description',
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'materials', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  accounting_account = excluded.accounting_account,
  sku = excluded.sku,
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  sales_price = excluded.sales_price,
  purchase_price = excluded.purchase_price,
  currency = excluded.currency,
  tax_rate = excluded.tax_rate,
  supplier = excluded.supplier,
  primary_location_id = excluded.primary_location_id,
  min_stock = excluded.min_stock,
  max_stock = excluded.max_stock,
  description = excluded.description,
  archived = excluded.archived;

insert into public.homecare_inventory_movements (
  id, material_id, location_id, movement_type, quantity, counted_quantity, note,
  supplier, purchase_gross, purchase_net, purchase_tax_rate, purchase_tax_amount,
  customer_id, service_id, billable_as_service, receipt, changes, created_at, updated_at
)
select
  entry->>'id',
  material->>'id',
  case when exists (select 1 from public.homecare_inventory_locations l where l.id = entry->>'location') then entry->>'location' else null end,
  coalesce(nullif(entry->>'type', ''), 'Eingang'),
  coalesce(public.homecare_text_to_numeric(entry->>'quantity'), 0),
  public.homecare_text_to_numeric(entry->>'countedQuantity'),
  entry->>'note',
  entry->>'supplier',
  public.homecare_text_to_numeric(entry->>'purchaseGross'),
  public.homecare_text_to_numeric(entry->>'purchaseNet'),
  public.homecare_text_to_numeric(entry->>'purchaseTaxRate'),
  public.homecare_text_to_numeric(entry->>'purchaseTaxAmount'),
  case when exists (select 1 from public.homecare_customers c where c.id = entry->>'customerId') then entry->>'customerId' else null end,
  case when exists (select 1 from public.homecare_services s where s.id = entry->>'serviceId') then entry->>'serviceId' else null end,
  public.homecare_text_to_boolean(entry->>'billableAsService', false),
  entry->'receipt',
  coalesce(entry->'changes', '[]'::jsonb),
  coalesce(public.homecare_text_to_timestamptz(entry->>'createdAt'), now()),
  coalesce(public.homecare_text_to_timestamptz(entry->>'updatedAt'), now())
from public.app_state,
  jsonb_array_elements(coalesce(data->'materials', '[]'::jsonb)) material,
  jsonb_array_elements(coalesce(material->'inventoryEntries', '[]'::jsonb)) entry
where id = 'kolaretorp-service-app' and entry ? 'id' and exists (select 1 from public.homecare_materials m where m.id = material->>'id')
on conflict (id) do update set
  material_id = excluded.material_id,
  location_id = excluded.location_id,
  movement_type = excluded.movement_type,
  quantity = excluded.quantity,
  counted_quantity = excluded.counted_quantity,
  note = excluded.note,
  supplier = excluded.supplier,
  purchase_gross = excluded.purchase_gross,
  purchase_net = excluded.purchase_net,
  purchase_tax_rate = excluded.purchase_tax_rate,
  purchase_tax_amount = excluded.purchase_tax_amount,
  customer_id = excluded.customer_id,
  service_id = excluded.service_id,
  billable_as_service = excluded.billable_as_service,
  receipt = excluded.receipt,
  changes = excluded.changes;

insert into public.homecare_resources (
  id, type, build_year, name, identifier, status, responsible_person_id, location,
  notes, logbook_year, odometer_year_start, odometer_year_end, tracking,
  maintenance_items, deleted_logbook_entry_ids, archived, created_at, updated_at
)
select
  item->>'id',
  coalesce(nullif(item->>'type', ''), 'Fahrzeug'),
  item->>'buildYear',
  coalesce(nullif(item->>'name', ''), 'Ressource'),
  item->>'identifier',
  item->>'status',
  case when exists (select 1 from public.homecare_personnel p where p.id = item->>'responsiblePersonId') then item->>'responsiblePersonId' else null end,
  item->>'location',
  item->>'notes',
  item->>'logbookYear',
  public.homecare_text_to_numeric(item->>'odometerYearStart'),
  public.homecare_text_to_numeric(item->>'odometerYearEnd'),
  coalesce(item->'tracking', '{}'::jsonb),
  coalesce(item->'maintenanceItems', '[]'::jsonb),
  coalesce(item->'deletedLogbookEntryIds', '[]'::jsonb),
  public.homecare_text_to_boolean(item->>'archived', false),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'resources', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  type = excluded.type,
  build_year = excluded.build_year,
  name = excluded.name,
  identifier = excluded.identifier,
  status = excluded.status,
  responsible_person_id = excluded.responsible_person_id,
  location = excluded.location,
  notes = excluded.notes,
  logbook_year = excluded.logbook_year,
  odometer_year_start = excluded.odometer_year_start,
  odometer_year_end = excluded.odometer_year_end,
  tracking = excluded.tracking,
  maintenance_items = excluded.maintenance_items,
  deleted_logbook_entry_ids = excluded.deleted_logbook_entry_ids,
  archived = excluded.archived;

insert into public.homecare_vehicle_trips (
  id, resource_id, trip_date, driver_id, status, started_at, ended_at, trip_type,
  start_address, end_address, start_coordinates, end_coordinates, waypoints,
  start_odometer, end_odometer, kilometers, purpose, visited, fuel_or_charge,
  fuel_receipt_photo, odometer_photos, notes, created_at, updated_at
)
select
  trip->>'id',
  resource->>'id',
  coalesce(public.homecare_text_to_date(trip->>'date'), current_date),
  case when exists (select 1 from public.homecare_personnel p where p.id = trip->>'driverId') then trip->>'driverId' else null end,
  coalesce(nullif(trip->>'status', ''), 'abgeschlossen'),
  public.homecare_text_to_timestamptz(trip->>'startedAt'),
  public.homecare_text_to_timestamptz(trip->>'endedAt'),
  coalesce(nullif(trip->>'tripType', ''), 'Dienstfahrt'),
  trip->>'startAddress',
  trip->>'endAddress',
  trip->'startCoordinates',
  trip->'endCoordinates',
  coalesce(trip->'waypoints', '[]'::jsonb),
  public.homecare_text_to_numeric(trip->>'startOdometer'),
  public.homecare_text_to_numeric(trip->>'endOdometer'),
  public.homecare_text_to_numeric(trip->>'kilometers'),
  trip->>'purpose',
  trip->>'visited',
  trip->>'fuelOrCharge',
  trip->'fuelReceiptPhoto',
  coalesce(trip->'odometerPhotos', '[]'::jsonb),
  trip->>'notes',
  coalesce(public.homecare_text_to_timestamptz(trip->>'startedAt'), now()),
  now()
from public.app_state,
  jsonb_array_elements(coalesce(data->'resources', '[]'::jsonb)) resource,
  jsonb_array_elements(coalesce(resource->'logbook', '[]'::jsonb)) trip
where id = 'kolaretorp-service-app'
  and trip ? 'id'
  and exists (select 1 from public.homecare_resources r where r.id = resource->>'id')
on conflict (id) do update set
  resource_id = excluded.resource_id,
  trip_date = excluded.trip_date,
  driver_id = excluded.driver_id,
  status = excluded.status,
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  trip_type = excluded.trip_type,
  start_address = excluded.start_address,
  end_address = excluded.end_address,
  start_coordinates = excluded.start_coordinates,
  end_coordinates = excluded.end_coordinates,
  waypoints = excluded.waypoints,
  start_odometer = excluded.start_odometer,
  end_odometer = excluded.end_odometer,
  kilometers = excluded.kilometers,
  purpose = excluded.purpose,
  visited = excluded.visited,
  fuel_or_charge = excluded.fuel_or_charge,
  fuel_receipt_photo = excluded.fuel_receipt_photo,
  odometer_photos = excluded.odometer_photos,
  notes = excluded.notes;

insert into public.homecare_jobs (
  id, series_master_id, series_occurrence_date, title, object_id, customer_id, type,
  status, status_updated_at, reset_at, priority, due_date, start_date, end_date,
  execution_date, assigned_to, description, internal_notes, billable, material,
  work_minutes, resource_ids, material_items, checklist, service_ids,
  service_quantities, service_discounts, custom_service, discount, schedule,
  execution_log, offer_number, offer_sent_at, order_confirmation_number,
  order_confirmation_sent_at, series_excluded_dates, created_at, updated_at
)
select
  item->>'id',
  item->>'seriesMasterId',
  public.homecare_text_to_date(item->>'seriesOccurrenceDate'),
  coalesce(nullif(item->>'title', ''), 'Auftrag'),
  case when exists (select 1 from public.homecare_objects o where o.id = item->>'objectId') then item->>'objectId' else null end,
  case when exists (select 1 from public.homecare_customers c where c.id = item->>'customerId') then item->>'customerId' else null end,
  item->>'type',
  coalesce(nullif(item->>'status', ''), 'geplant'),
  public.homecare_text_to_timestamptz(item->>'statusUpdatedAt'),
  public.homecare_text_to_timestamptz(item->>'resetAt'),
  coalesce(nullif(item->>'priority', ''), 'normal'),
  public.homecare_text_to_date(item->>'dueDate'),
  public.homecare_text_to_date(item->>'startDate'),
  public.homecare_text_to_date(item->>'endDate'),
  public.homecare_text_to_date(item->>'executionDate'),
  item->>'assignedTo',
  item->>'description',
  item->>'internalNotes',
  public.homecare_text_to_boolean(item->>'billable', true),
  item->>'material',
  coalesce(public.homecare_text_to_numeric(item->>'workMinutes'), 0)::integer,
  coalesce(item->'resourceIds', '[]'::jsonb),
  coalesce(item->'materialItems', '[]'::jsonb),
  coalesce(item->'checklist', '[]'::jsonb),
  coalesce(item->'serviceIds', '[]'::jsonb),
  coalesce(item->'serviceQuantities', '{}'::jsonb),
  coalesce(item->'serviceDiscounts', '{}'::jsonb),
  item->'customService',
  jsonb_build_object('type', item->>'discountType', 'value', item->>'discountValue', 'reason', item->>'discountReason'),
  coalesce(item->'schedule', '{}'::jsonb),
  coalesce(item->'executionLog', '[]'::jsonb),
  item->>'offerNumber',
  public.homecare_text_to_timestamptz(item->>'offerSentAt'),
  item->>'orderConfirmationNumber',
  public.homecare_text_to_timestamptz(item->>'orderConfirmationSentAt'),
  coalesce(item->'seriesExcludedDates', '[]'::jsonb),
  now(),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'jobs', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  series_master_id = excluded.series_master_id,
  series_occurrence_date = excluded.series_occurrence_date,
  title = excluded.title,
  object_id = excluded.object_id,
  customer_id = excluded.customer_id,
  type = excluded.type,
  status = excluded.status,
  status_updated_at = excluded.status_updated_at,
  reset_at = excluded.reset_at,
  priority = excluded.priority,
  due_date = excluded.due_date,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  execution_date = excluded.execution_date,
  assigned_to = excluded.assigned_to,
  description = excluded.description,
  internal_notes = excluded.internal_notes,
  billable = excluded.billable,
  material = excluded.material,
  work_minutes = excluded.work_minutes,
  resource_ids = excluded.resource_ids,
  material_items = excluded.material_items,
  checklist = excluded.checklist,
  service_ids = excluded.service_ids,
  service_quantities = excluded.service_quantities,
  service_discounts = excluded.service_discounts,
  custom_service = excluded.custom_service,
  discount = excluded.discount,
  schedule = excluded.schedule,
  execution_log = excluded.execution_log,
  offer_number = excluded.offer_number,
  offer_sent_at = excluded.offer_sent_at,
  order_confirmation_number = excluded.order_confirmation_number,
  order_confirmation_sent_at = excluded.order_confirmation_sent_at,
  series_excluded_dates = excluded.series_excluded_dates;

insert into public.homecare_reports (
  id, job_id, object_id, title, report_date, visible_to_customer, summary,
  internal_notes, customer_comment, checklist_results, media_ids, attachments,
  sent_at, created_at, updated_at
)
select
  item->>'id',
  case when exists (select 1 from public.homecare_jobs j where j.id = item->>'jobId') then item->>'jobId' else null end,
  case when exists (select 1 from public.homecare_objects o where o.id = item->>'objectId') then item->>'objectId' else null end,
  coalesce(nullif(item->>'title', ''), 'Bericht'),
  public.homecare_text_to_date(item->>'date'),
  public.homecare_text_to_boolean(item->>'visibleToCustomer', false),
  item->>'summary',
  item->>'internalNotes',
  item->>'customerComment',
  coalesce(item->'checklistResults', '[]'::jsonb),
  coalesce(item->'media', '[]'::jsonb),
  coalesce(item->'attachments', '[]'::jsonb),
  public.homecare_text_to_timestamptz(item->>'sentAt'),
  now(),
  coalesce(public.homecare_text_to_timestamptz(item->>'updatedAt'), now())
from public.app_state, jsonb_array_elements(coalesce(data->'reports', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  job_id = excluded.job_id,
  object_id = excluded.object_id,
  title = excluded.title,
  report_date = excluded.report_date,
  visible_to_customer = excluded.visible_to_customer,
  summary = excluded.summary,
  internal_notes = excluded.internal_notes,
  customer_comment = excluded.customer_comment,
  checklist_results = excluded.checklist_results,
  media_ids = excluded.media_ids,
  attachments = excluded.attachments,
  sent_at = excluded.sent_at,
  updated_at = excluded.updated_at;

insert into public.homecare_field_progress (
  id, job_id, work_date, task_id, completed, minutes, show_work_time_in_report,
  note, photos, updated_at
)
select
  progress_key || ':' || task_key,
  split_part(progress_key, '::', 1),
  public.homecare_text_to_date(nullif(split_part(progress_key, '::', 2), '')),
  task_key,
  public.homecare_text_to_boolean(task_value->>'completed', false),
  public.homecare_text_to_numeric(task_value->>'minutes')::integer,
  public.homecare_text_to_boolean(task_value->>'showWorkTimeInReport', false),
  task_value->>'note',
  coalesce(task_value->'photos', '[]'::jsonb),
  coalesce(public.homecare_text_to_timestamptz(task_value->>'updatedAt'), now())
from public.app_state,
  jsonb_each(coalesce(data->'fieldProgress', '{}'::jsonb)) progress(progress_key, progress_value),
  jsonb_each(coalesce(progress_value, '{}'::jsonb)) task(task_key, task_value)
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  job_id = excluded.job_id,
  work_date = excluded.work_date,
  task_id = excluded.task_id,
  completed = excluded.completed,
  minutes = excluded.minutes,
  show_work_time_in_report = excluded.show_work_time_in_report,
  note = excluded.note,
  photos = excluded.photos,
  updated_at = excluded.updated_at;

insert into public.homecare_billing_items (
  id, object_id, customer_id, job_id, report_id, source, label, amount, status,
  invoice_status, invoice_number, invoice_date, due_date, service_date, lines, notes,
  external_export_status, external_export_system, external_exported_at, sent_at,
  paid_at, cancelled_at, created_at, updated_at
)
select
  item->>'id',
  case when exists (select 1 from public.homecare_objects o where o.id = item->>'objectId') then item->>'objectId' else null end,
  case when exists (select 1 from public.homecare_customers c where c.id = item->>'customerId') then item->>'customerId' else null end,
  case when exists (select 1 from public.homecare_jobs j where j.id = item->>'jobId') then item->>'jobId' else null end,
  case when exists (select 1 from public.homecare_reports r where r.id = item->>'reportId') then item->>'reportId' else null end,
  item->>'source',
  coalesce(nullif(item->>'label', ''), 'Abrechnung'),
  public.homecare_text_to_numeric(item->>'amount'),
  coalesce(nullif(item->>'status', ''), 'abrechenbar'),
  item->>'invoiceStatus',
  item->>'invoiceNumber',
  public.homecare_text_to_date(item->>'invoiceDate'),
  public.homecare_text_to_date(item->>'dueDate'),
  public.homecare_text_to_date(item->>'serviceDate'),
  coalesce(item->'lines', '[]'::jsonb),
  item->>'notes',
  item->>'externalExportStatus',
  item->>'externalExportSystem',
  public.homecare_text_to_timestamptz(item->>'externalExportedAt'),
  public.homecare_text_to_timestamptz(item->>'sentAt'),
  public.homecare_text_to_timestamptz(item->>'paidAt'),
  public.homecare_text_to_timestamptz(item->>'cancelledAt'),
  coalesce(public.homecare_text_to_timestamptz(item->>'createdAt'), now()),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'billing', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  object_id = excluded.object_id,
  customer_id = excluded.customer_id,
  job_id = excluded.job_id,
  report_id = excluded.report_id,
  source = excluded.source,
  label = excluded.label,
  amount = excluded.amount,
  status = excluded.status,
  invoice_status = excluded.invoice_status,
  invoice_number = excluded.invoice_number,
  invoice_date = excluded.invoice_date,
  due_date = excluded.due_date,
  service_date = excluded.service_date,
  lines = excluded.lines,
  notes = excluded.notes,
  external_export_status = excluded.external_export_status,
  external_export_system = excluded.external_export_system,
  external_exported_at = excluded.external_exported_at,
  sent_at = excluded.sent_at,
  paid_at = excluded.paid_at,
  cancelled_at = excluded.cancelled_at;

insert into public.homecare_portal_messages (
  id, customer_id, object_id, subject, message, status, delivery_status,
  delivery_error, origin, replies, sent_at, created_at, updated_at
)
select
  item->>'id',
  case when exists (select 1 from public.homecare_customers c where c.id = item->>'customerId') then item->>'customerId' else null end,
  case when exists (select 1 from public.homecare_objects o where o.id = item->>'objectId') then item->>'objectId' else null end,
  coalesce(nullif(item->>'subject', ''), 'Nachricht'),
  coalesce(nullif(item->>'message', ''), ''),
  coalesce(nullif(item->>'status', ''), 'neu'),
  item->>'deliveryStatus',
  item->>'deliveryError',
  item->>'origin',
  coalesce(item->'replies', '[]'::jsonb),
  public.homecare_text_to_timestamptz(item->>'sentAt'),
  coalesce(public.homecare_text_to_timestamptz(item->>'createdAt'), now()),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'portalMessages', '[]'::jsonb)) item
where id = 'kolaretorp-service-app'
on conflict (id) do update set
  customer_id = excluded.customer_id,
  object_id = excluded.object_id,
  subject = excluded.subject,
  message = excluded.message,
  status = excluded.status,
  delivery_status = excluded.delivery_status,
  delivery_error = excluded.delivery_error,
  origin = excluded.origin,
  replies = excluded.replies,
  sent_at = excluded.sent_at;

insert into public.homecare_translations (key, de, sv, en, updated_at)
select
  item->>'key',
  coalesce(nullif(item->>'de', ''), item->>'key'),
  coalesce(nullif(item->>'sv', ''), item->>'de', item->>'key'),
  coalesce(nullif(item->>'en', ''), item->>'de', item->>'key'),
  now()
from public.app_state, jsonb_array_elements(coalesce(data->'translationOverrides', '[]'::jsonb)) item
where id = 'kolaretorp-service-app' and coalesce(item->>'key', '') <> ''
on conflict (key) do update set
  de = excluded.de,
  sv = excluded.sv,
  en = excluded.en;

insert into public.homecare_vehicle_positions (
  resource_id, entry_id, status, source, trip_date, driver_id, address, coordinates,
  purpose, trip_type, visited, start_odometer, updated_at
)
select
  position->>'resourceId',
  position->>'entryId',
  coalesce(nullif(position->>'status', ''), 'active'),
  position->>'source',
  public.homecare_text_to_date(position->>'tripDate'),
  case when exists (select 1 from public.homecare_personnel p where p.id = position->>'driverId') then position->>'driverId' else null end,
  position->>'address',
  position->'coordinates',
  position->>'purpose',
  position->>'tripType',
  position->>'visited',
  public.homecare_text_to_numeric(position->>'startOdometer'),
  coalesce(public.homecare_text_to_timestamptz(position->>'updatedAt'), now())
from public.app_state,
  jsonb_array_elements(coalesce(data#>'{positions}', data->'positions', '[]'::jsonb)) position
where id = 'vehicle-positions'
  and exists (select 1 from public.homecare_resources r where r.id = position->>'resourceId')
on conflict (resource_id) do update set
  entry_id = excluded.entry_id,
  status = excluded.status,
  source = excluded.source,
  trip_date = excluded.trip_date,
  driver_id = excluded.driver_id,
  address = excluded.address,
  coordinates = excluded.coordinates,
  purpose = excluded.purpose,
  trip_type = excluded.trip_type,
  visited = excluded.visited,
  start_odometer = excluded.start_odometer,
  updated_at = excluded.updated_at;

drop policy if exists "public read homecare vehicle positions" on public.homecare_vehicle_positions;
create policy "public read homecare vehicle positions"
  on public.homecare_vehicle_positions for select
  using (true);

drop policy if exists "public insert homecare vehicle positions" on public.homecare_vehicle_positions;
create policy "public insert homecare vehicle positions"
  on public.homecare_vehicle_positions for insert
  with check (true);

drop policy if exists "public update homecare vehicle positions" on public.homecare_vehicle_positions;
create policy "public update homecare vehicle positions"
  on public.homecare_vehicle_positions for update
  using (true)
  with check (true);
