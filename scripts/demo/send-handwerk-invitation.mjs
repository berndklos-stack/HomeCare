import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { demoName } from './handwerk-data.mjs';

assert(process.argv.includes('--send-production'),'Explicit --send-production required');
const file=process.argv[process.argv.indexOf('--invitation')+1];
assert(file?.startsWith('/private/tmp/workcore-handwerk-demo-'),'Private operation evidence required');
const {tenant,owner,email,id}=JSON.parse(readFileSync(file,'utf8'));
nextEnv.loadEnvConfig(process.cwd());
const sender=process.env.RESEND_FROM_EMAIL||process.env.REPORT_SENDER_EMAIL;
const useResend=Boolean(process.env.RESEND_API_KEY&&sender);
const project='ruzsmxzxeqqcbeycfoma';
const live=await(await fetch('https://homecare-xi.vercel.app/api/version',{cache:'no-store'})).json();assert.equal(live.databaseProject,project);
const token=execFileSync('security',['find-generic-password','-s','Supabase CLI','-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`,{headers:{Authorization:`Bearer ${token}`}});assert(response.ok);
const keys=await response.json();const service=keys.find(key=>key.name==='service_role')?.api_key;assert(service);
const admin=createClient(`https://${project}.supabase.co`,service,{auth:{persistSession:false,autoRefreshToken:false}});
const company=await admin.from('homecare_tenants').select('name,account_type').eq('id',tenant).single();assert.ifError(company.error);assert.equal(company.data.name,demoName);assert.equal(company.data.account_type,'demo');
const invitation=await admin.from('homecare_user_invitations').select('email,auth_user_id,delivery_status,last_sent_at').eq('tenant_id',tenant).eq('id',id).single();assert.ifError(invitation.error);
assert.equal(invitation.data.email,email);assert.equal(invitation.data.auth_user_id,owner);assert(['pending','failed'].includes(invitation.data.delivery_status),'Invitation already sent; do not send duplicates');
const user=await admin.auth.admin.getUserById(owner);assert.ifError(user.error);assert.equal(user.data.user.email?.toLowerCase(),email.toLowerCase());
const now=new Date().toISOString();
let claim=admin.from('homecare_user_invitations').update({delivery_status:'pending',last_sent_at:now,expires_at:new Date(Date.now()+7*86400000).toISOString()}).eq('id',id).eq('tenant_id',tenant).in('delivery_status',['pending','failed']);
claim=invitation.data.last_sent_at?claim.eq('last_sent_at',invitation.data.last_sent_at).lt('last_sent_at',new Date(Date.now()-60000).toISOString()):claim.is('last_sent_at',null);
const lease=await claim.select('id');assert.ifError(lease.error);assert.equal(lease.data.length,1,'Invitation delivery already in progress');
try{
  if(!useResend){
    const invited=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:'https://homecare-xi.vercel.app/auth/accept'});
    if(invited.error)throw new Error(`Supabase Auth invitation mail: ${invited.error.message}`);
    assert.equal(invited.data.user.id,owner,'Invitation must not create another identity');
  }else{
  const link=await admin.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:'https://homecare-xi.vercel.app/auth/accept'}});
  if(link.error)throw new Error('Supabase invitation link generation failed');assert.equal(link.data.user.id,owner);
  assert(link.data.properties.action_link);
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`handwerk-demo-invitation-${id}`},body:JSON.stringify({from:sender,to:[email],subject:'WorkCore: Dein separater Demo-Zugang',text:`Deine Vorfuehrfirma "${demoName}" ist vorbereitet. Sie enthaelt ausschliesslich fiktive Geschaeftsdaten und eigene Demo-Bilder.\n\nOeffne diesen Link und aktiviere den Firmenzugang. Dort kannst du dein eigenes Passwort festlegen:\n\n${link.data.properties.action_link}\n\nLogin: ${email}\nApp: https://homecare-xi.vercel.app\n\nEs wurden keine Zugriffsrechte auf deine echte Firma vergeben. Externe Integrationen und Versand an echte Kunden sind nicht eingerichtet.\n\nDer Firmenzugangslink ist sieben Tage gueltig; falls der Anmeldelink zuvor ablaeuft, kann eine neue Einladung angefordert werden.`}),signal:AbortSignal.timeout(15000)});
  if(!sent.ok)throw new Error(`Invitation mail provider returned ${sent.status}`);
  }
  const result=await admin.from('homecare_user_invitations').update({delivery_status:'sent',delivery_error:null}).eq('id',id).eq('tenant_id',tenant).eq('last_sent_at',now);assert.ifError(result.error);
  console.log(`Demo-Einladung ueber ${useResend?'bestehenden Mailabsender':'Supabase Auth-Mailversand'} an die bestaetigte Adresse versandt. Kein Passwort und kein Anmeldetoken ausgegeben.`);
}catch(error){
  await admin.from('homecare_user_invitations').update({delivery_status:'failed',delivery_error:'Demo-Einladung konnte nicht versandt werden.'}).eq('id',id).eq('tenant_id',tenant).eq('last_sent_at',now);
  throw error;
}
