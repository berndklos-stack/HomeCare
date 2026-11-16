import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assetFiles, quote, handwerkData, demoName } from './handwerk-data.mjs';
import { demoSql } from './handwerk-sql.mjs';

const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const production=process.argv.includes('--apply-production');
assert(production||process.argv.includes('--check-staging'),'Explicit --check-staging or --apply-production required');
const project=production?'ruzsmxzxeqqcbeycfoma':'ealfegjvbyiiporettpq';
const email=production?option('--email'):`workcore-handwerk-${randomUUID()}@example.invalid`;
assert(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Valid owner email required');
const tenant=option('--tenant')??randomUUID(), today=new Date().toISOString().slice(0,10);
assert.match(tenant,/^[0-9a-f-]{36}$/i);
const directory=mkdtempSync('/private/tmp/workcore-handwerk-demo-');chmodSync(directory,0o700);
const save=(name,value)=>writeFileSync(`${directory}/${name}`,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
const digest=createHash('sha256');
for(const name of ['handwerk-data.mjs','handwerk-sql.mjs','provision-handwerk.mjs',...assetFiles.map(name=>`assets/${name}`)])digest.update(readFileSync(new URL(name,import.meta.url)));
const fixtureDigest=digest.digest('hex');
const token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function api(path,body){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(150000)});
  if(!response.ok)throw new Error(`Supabase management ${response.status}: ${(await response.text()).slice(0,2000)}`);
  return response.json();
}
const query=query=>api('/database/query',{query});
const metadata=await api('');assert.equal(metadata.id,project);assert.equal(metadata.status,'ACTIVE_HEALTHY');
if(production){
  assert(option('--tenant'),'Explicit new demo tenant UUID required');
  const live=await(await fetch('https://homecare-xi.vercel.app/api/version',{cache:'no-store'})).json();assert.equal(live.databaseProject,project);
  const proof=JSON.parse(readFileSync(option('--staging-proof'),'utf8'));
  assert.equal(proof.fixtureDigest,fixtureDigest);assert(proof.passed&&proof.project==='ealfegjvbyiiporettpq');assert(Date.now()-Date.parse(proof.createdAt)<86400000);
  assert(!email.endsWith('.invalid'),'Real owner address required for invitation');
  const duplicate=await query(`select id from public.homecare_tenants where id=${quote(tenant)}::uuid or (account_type='demo' and lower(email)=lower(${quote(email)}))`);
  assert.equal(duplicate.length,0,'Demo already exists; use its invitation instead of creating duplicates');
}
const keys=await api('/api-keys');
const service=keys.find(key=>key.name==='service_role')?.api_key;assert(service,'No trusted server key available');
const admin=createClient(`https://${project}.supabase.co`,service,{auth:{persistSession:false,autoRefreshToken:false}});
const existing=await admin.rpc('homecare_find_auth_user',{p_email:email});assert.ifError(existing.error);
let owner=existing.data,createdIdentity=false;
if(!owner){
  const result=await admin.auth.admin.generateLink({type:'invite',email,options:{redirectTo:'https://homecare-xi.vercel.app/auth/accept'}});
  if(result.error)throw new Error(`Auth identity: ${result.error.message}`);
  owner=result.data.user.id;createdIdentity=true;
}
assert(owner);
let actor=owner;
if(production){
  const found=await query("select m.user_id from public.homecare_tenant_memberships m join public.homecare_roles r on r.id=m.role_id and r.tenant_id=m.tenant_id where m.tenant_id='00000000-0000-0000-0000-000000000001'::uuid and m.status='active' and r.key='owner' order by m.user_id limit 1");
  assert(found[0]?.user_id,'No authorized platform company owner');actor=found[0].user_id;
}
save('operation.json',{project,tenant,email,owner,actor,fixtureDigest,createdIdentity});
console.log(`Geprueftes Ziel: ${production?'Produktion':'Staging'}; neue Demo-Firma ${tenant}.`);
const uploaded=[];
try{
  for(const file of assetFiles){
    const path=`${tenant}/demo-handwerk/${file}`;
    const result=await admin.storage.from('homecare-private-media').upload(path,readFileSync(new URL(`assets/${file}`,import.meta.url)),{contentType:'image/jpeg',upsert:false,cacheControl:'0'});
    if(result.error&&!/already exists|duplicate/i.test(result.error.message))throw new Error(`Demo image upload: ${result.error.message}`);uploaded.push(path);
    const check=await admin.storage.from('homecare-private-media').download(path);if(check.error)throw new Error('Demo image readback failed');
    assert.equal(createHash('sha256').update(Buffer.from(await check.data.arrayBuffer())).digest('hex'),createHash('sha256').update(readFileSync(new URL(`assets/${file}`,import.meta.url))).digest('hex'));
  }
  const result=await query(demoSql({tenant,actor,owner,email,today,commit:production}));
  const verification=result.find(row=>row.verification)?.verification;
  assert(verification?.existingCompaniesUnchanged&&verification?.rlsProbePassed&&verification?.pendingInvitation);
  if(production){
    const counts={};
    for(const table of new Set(handwerkData(tenant,owner,today).map(x=>x.table))){
      const result=await admin.from(table).select('*',{count:'exact',head:true}).eq('tenant_id',tenant);assert.ifError(result.error);counts[table]=result.count;
    }
    save('counts.json',counts);
    const invitations=await admin.from('homecare_user_invitations').select('id').eq('tenant_id',tenant).eq('auth_user_id',owner).single();assert.ifError(invitations.error);
    save('invitation.json',{tenant,owner,email,id:invitations.data.id});
    console.log(`Demo angelegt: ${demoName}; ${verification.records} Datensaetze, Bilder rueckgelesen; Einladung wartet auf Versand. Nachweis: ${directory}`);
  }
  const proof={project,tenant,fixtureDigest,passed:true,createdAt:new Date().toISOString(),...verification};save('verification.json',proof);console.log(JSON.stringify({proof:`${directory}/verification.json`,...proof}));
}finally{
  // Staging SQL rolls back everything; only tracked synthetic Auth and Storage are removed.
  if(!production){
    if(uploaded.length){const removed=await admin.storage.from('homecare-private-media').remove(uploaded);assert.ifError(removed.error);}
    if(createdIdentity){const removed=await admin.auth.admin.deleteUser(owner);assert.ifError(removed.error);}
  }
}
