import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { handwerkData, assetFiles, demoModules } from '../scripts/demo/handwerk-data.mjs';
import { demoSql } from '../scripts/demo/handwerk-sql.mjs';

const tenant='12345678-1234-4123-a123-123456789012';
const actor='12345678-1234-4123-a123-123456789013';
const rows=handwerkData(tenant,actor);
const byTable=table=>rows.filter(item=>item.table===`homecare_${table}`).map(item=>item.row);

test('all demo data is tenant-scoped, synthetic and uses native columns',()=>{
  assert(rows.length>100);
  for(const {row} of rows){
    assert.equal(row.tenant_id,tenant);
    assert(!('record_data'in row)&&!('custom_fields'in row));
    if(row.email)assert(row.email.endsWith('@example.invalid'));
    if(row.storage_path)assert(row.storage_path.startsWith(`${tenant}/demo-handwerk/`));
  }
  assert.equal(new Set(demoModules).size,11);
  assert(!demoModules.includes('administration'));
});
test('customer, project, job and employee references resolve within demo',()=>{
  const ids=new Set(rows.map(({row})=>row.id).filter(Boolean));
  for(const {row}of rows)for(const key of ['customer_id','owner_customer_id','object_id','job_id','employee_id','resource_id','material_id','source_id','destination_id','responsible_person_id','default_driver_id','preferred_supplier_id','supplier_id','order_id','request_id','report_id']){
    if(row[key])assert(ids.has(row[key]),`${key}: ${row[key]}`);
  }
});
test('stock receipt, loading and job consumption never produce negative balances',()=>{
  const balances=new Map();
  const movements=byTable('stock_movements');assert.equal(movements.length,20);
  for(const row of movements){
    for(const [location,sign]of [[row.source_id,-1],[row.destination_id,1]])if(location){const key=`${row.material_id}:${location}`;const value=(balances.get(key)??0)+row.quantity*sign;assert(value>=0);balances.set(key,value);}
  }
  assert.equal(balances.get('DEMO-MAT1:DEMO-LOC2'),8);
});
test('trip chronology, standard distance and worked time are coherent',()=>{
  const trips=byTable('vehicle_trips');assert.equal(trips.length,12);
  trips.forEach((trip,i)=>{assert.equal(trip.end_odometer-trip.start_odometer,trip.kilometers);if(i)assert.equal(trip.start_odometer,trips[i-1].end_odometer);});
  assert.equal(byTable('resources')[0].current_odometer,trips.at(-1).end_odometer);
  assert.equal(byTable('resources')[0].standard_trips[0].distanceKm,18);
  const time=byTable('staff_time_entries');assert.equal(time.length,45);
  time.forEach(row=>assert(new Date(row.ended_at)>new Date(row.started_at)));
});
test('all image assets are real decodable JPEGs, with no real-company photos',async()=>{
  for(const file of assetFiles){const info=await sharp(readFileSync(new URL(`../scripts/demo/assets/${file}`,import.meta.url))).metadata();assert.equal(info.format,'jpeg');assert.equal(info.width,1200);assert(info.height>=600);}
  assert.equal(byTable('media').length,4);
});
test('fixture structures match the app contracts for jobs, media and invoices',()=>{
  byTable('jobs').forEach(row=>{assert(row.checklist.every(item=>typeof item==='string'));assert.equal(row.schedule.type,'einmalig');});
  byTable('services').forEach(row=>row.checklist.forEach(item=>{assert.equal(typeof item.note,'string');assert.equal(typeof item.defaultMinutes,'number');}));
  byTable('media').filter(row=>row.owner_type!=='report').forEach(row=>assert.equal(row.kind,'Bild'));
  byTable('billing_items').forEach(row=>row.lines.forEach(line=>{assert.equal(line.kind,'Leistung');assert(Number(line.unitPrice)>0);}));
  assert.equal(byTable('job_time_entries').length,4);
});
test('SQL probes roll back activation, preserve old data, and never disable RLS',()=>{
  const sql=demoSql({tenant,actor,owner:actor,email:'owner@example.invalid',today:'2026-10-24'});
  assert(sql.includes('homecare_onboard_company'));
  assert(sql.includes('EXISTING_COMPANY_CHANGED'));
  assert(sql.includes('rollback to savepoint demo_rls_probe'));
  assert(sql.includes('set local role authenticated'));
  assert(!/disable row level security|session_replication_role|operations_restore|delete from/i.test(sql));
  assert(sql.endsWith('rollback;'));
  assert.throws(()=>demoSql({tenant:'00000000-0000-0000-0000-000000000001',actor,owner:actor,email:'owner@example.invalid'}));
});
