import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Deliberately staging-only. Never accepts a production project or DATABASE_URL.
const project = 'ealfegjvbyiiporettpq';
const workdir = '/private/tmp/workcore-security-staging-20261014';
assert(process.argv.includes('--apply-staging'), 'Explicit --apply-staging required');
assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), project);
const directory = mkdtempSync('/private/tmp/workcore-administration-staging-'); chmodSync(directory, 0o700);
function cli(args) {
  try { return JSON.parse(execFileSync('supabase', ['--workdir', workdir, ...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) { throw new Error(String(error.stderr ?? error.message).slice(-1500)); }
}
const query = sql => cli(['db', 'query', '--linked', sql]).rows;
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
const fileQuery = (name, sql) => { save(name, sql); return cli(['db', 'query', '--linked', '--file', join(directory, name)]).rows; };
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const advisors = () => cli(['db', 'advisors', '--linked', '--type', 'security', '--level', 'info', '--fail-on', 'none']);
const counts = items => items.reduce((all, item) => ({ ...all, [item.level]: (all[item.level] ?? 0) + 1 }), {});
const source = readFileSync(resolve('supabase/migrations/20261015140000_company_administration.sql'), 'utf8');
const directorySource = readFileSync(resolve('supabase/migrations/20261015143000_administration_directory.sql'), 'utf8');
const testSource = readFileSync(resolve('supabase/tests/company_administration.sql'), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const tables = query('select unnest(public.homecare_relational_backup_tables()) as name').map(row => row.name);
assert(tables.length > 50 && tables.every(name => /^homecare_[a-z_]+$/.test(name)));
const columnRows = query(`select table_name,array_agg(column_name::text order by ordinal_position) as columns from information_schema.columns where table_schema='public' and table_name in (${tables.map(quote).join(',')}) group by table_name`);
const columns = Object.fromEntries(columnRows.map(row => [row.table_name,row.columns]));
const fingerprints = () => query(`select jsonb_object_agg(name,value) as value from (values ${tables.map(name => {
  const fields = columns[name]; assert(fields.every(field => /^[a-z_][a-z0-9_]*$/.test(field)));
  return `(${quote(name)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from (select ${fields.map(f => `"${f}"`).join(',')} from public.${name}) t))`;
}).join(',')}) x(name,value)`)[0].value;
const before = fingerprints(); const advisorBefore = advisors();
console.log('Staging: Bestandsfingerprints und Sicherheitsmeldungen erfasst.');
save('before.json', { fingerprints: before, advisors: advisorBefore });
for (const [version,name,sqlSource] of [['20261015140000','company_administration',source],['20261015143000','administration_directory',directorySource]]) {
const applied = query(`select statements from supabase_migrations.schema_migrations where version='${version}'`);
if (applied.length) assert.equal(digest(applied[0].statements[0]),digest(sqlSource),'Staging migration source differs; create a follow-up migration instead of rewriting history');
if (!applied.length) {
  fileQuery(`apply-${version}.sql`, `begin; set local lock_timeout='10s'; set local statement_timeout='120s';
    ${sqlSource.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}
    insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(sqlSource)}]);
    notify pgrst,'reload schema'; commit; select true as applied;`);
}
}
assert.deepEqual(fingerprints(), before, 'Existing business columns changed');
console.log('Staging: Migration angewendet; bisherige Daten unverändert.');
fileQuery('rls-tests.sql', testSource.replace("current_database()<>'workcore_operations_test'", `current_database()<>'postgres' or current_setting('workcore.administration_test_project',true)<>'${project}'`)
  .replace('begin;', `begin; set local workcore.administration_test_project='${project}';`));
console.log('Staging: SQL/RLS-Tests bestanden; prüfe echte Auth-Sitzungen.');

const keys = cli(['projects', 'api-keys', '--project-ref', project]);
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
const anonKey = keys.find(key => key.name === 'anon')?.api_key;
assert(serviceKey && anonKey, 'Staging Auth keys unavailable');
const url = `https://${project}.supabase.co`;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const authUsers = []; const tenants = [randomUUID(), randomUUID()];
const emails = [0, 1, 2].map(i => `workcore-wave-${randomUUID()}-${i}@example.invalid`);
let authFlowPassed = false;
async function rpc(client, name, args) {
  const result = await client.rpc(name, args); if (result.error) throw new Error(`${name}: ${result.error.message}`); return result.data;
}
async function identity(index) {
  const link = await admin.auth.admin.generateLink({ type: 'invite', email: emails[index] });
  if (link.error) throw new Error(`Staging Auth identity: ${link.error.message}`);
  authUsers.push(link.data.user.id);
  // Resending an invitation uses a Supabase-generated magic link for the existing identity.
  const resend = await admin.auth.admin.generateLink({ type: 'magiclink', email: emails[index] });
  if (resend.error) throw new Error(`Staging Auth resend: ${resend.error.message}`);
  assert.equal(resend.data.user.id, link.data.user.id, 'Duplicate Auth identity created');
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const verified = await client.auth.verifyOtp({ token_hash: resend.data.properties.hashed_token, type: 'magiclink' });
  if (verified.error) throw new Error(`Staging Auth acceptance: ${verified.error.message}`);
  assert(verified.data.session?.access_token, 'No authenticated session');
  return { id: link.data.user.id, token: verified.data.session.access_token };
}
function userClient(identity, tenant) {
  return createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${identity.token}`, 'X-WorkCore-Tenant': tenant } } });
}
try {
  const ownerA = await identity(0); const ownerB = await identity(1); const worker = await identity(2);
  for (const [index, owner] of [ownerA, ownerB].entries()) {
    await rpc(admin, 'homecare_onboard_company', { p_id: tenants[index], p_actor: ownerA.id, p_owner: owner.id, p_email: emails[index],
      p_company: { name: `Isolated administration test ${index}`, country: 'SE', locale: 'de', timezone: 'Europe/Stockholm', accountType: 'pilot', pilotStartDate: '2026-10-15' }, p_modules: ['jobs','reports'] });
  }
  const a = userClient(ownerA, tenants[0]), b = userClient(ownerB, tenants[1]);
  assert.equal(await rpc(a, 'homecare_accept_invitations'), 1);
  assert.equal(await rpc(b, 'homecare_accept_invitations'), 1);
  assert.equal(await rpc(a, 'homecare_accept_invitations'), 0);
  const own = await a.from('homecare_tenants').select('id'); assert.ifError(own.error); assert.deepEqual(own.data.map(t => t.id), [tenants[0]]);
  const foreign = await a.from('homecare_tenants').select('id').eq('id', tenants[1]); assert.ifError(foreign.error); assert.equal(foreign.data.length, 0);
  const roles = await a.from('homecare_roles').select('id,key'); assert.ifError(roles.error);
  const memberships = await a.from('homecare_tenant_memberships').select('tenant:homecare_tenants!inner(id,name,slug),role:homecare_roles!homecare_tenant_memberships_role_id_fkey!inner(key,name,permissions)');
  assert.ifError(memberships.error); assert.equal(memberships.data.length,1);
  const directory = await rpc(admin,'homecare_admin_directory',{p_tenant:tenants[0],p_actor:ownerA.id,p_search:emails[0]});
  assert.equal(directory.total,1); assert.equal(directory.members[0].email,emails[0]);
  const role = roles.data.find(r => r.key === 'field_worker').id;
  await rpc(admin, 'homecare_admin_member', { p_tenant: tenants[0], p_actor: ownerA.id, p_action: 'invite', p_role: role, p_email: emails[2], p_user: worker.id });
  const duplicate = await admin.rpc('homecare_admin_member', { p_tenant: tenants[0], p_actor: ownerA.id, p_action: 'invite', p_role: role, p_email: emails[2], p_user: worker.id });
  assert.equal(duplicate.error?.code, '23505');
  const w = userClient(worker, tenants[0]); assert.equal(await rpc(w, 'homecare_accept_invitations'), 1);
  const members = await w.from('homecare_tenant_memberships').select('user_id'); assert.ifError(members.error); assert.deepEqual(members.data.map(m => m.user_id), [worker.id]);
  const disallowed = await w.rpc('homecare_find_auth_user', { p_email: emails[1] }); assert(disallowed.error, 'Global Auth enumeration allowed');
  const privilege = await w.from('homecare_tenant_memberships').update({ status: 'active' }).eq('user_id', ownerA.id); assert(privilege.error, 'Direct client membership write allowed');
  const feedback = await w.from('homecare_feedback').insert({ tenant_id: tenants[0], user_id: worker.id, category: 'problem', message: 'Explicit staging feedback', app_version: 'test', page_path: '/', user_agent: 'staging-test' }); assert.ifError(feedback.error);
  const foreignFeedback = await b.from('homecare_feedback').select('id'); assert.ifError(foreignFeedback.error); assert.equal(foreignFeedback.data.length, 0);
  const adminFeedback = await a.from('homecare_feedback').select('id'); assert.ifError(adminFeedback.error); assert.equal(adminFeedback.data.length, 1);
  authFlowPassed = true;
} finally {
  // Only random, tracked test companies. No shared rows or real email delivery.
  const ids = tenants.map(quote).join(',');
  fileQuery('cleanup.sql', `begin; update public.homecare_roles set key='cleanup-'||key where tenant_id in (${ids});
    ${['homecare_feedback','homecare_user_invitations','homecare_tenant_memberships','homecare_resource_type_fields','homecare_resource_types','homecare_settings','homecare_tenant_modules','homecare_audit_log','homecare_roles'].map(table => `delete from public.${table} where tenant_id in (${ids});`).join('\n')}
    delete from public.homecare_tenants where id in (${ids}); commit;`);
  for (const id of authUsers) { const deleted = await admin.auth.admin.deleteUser(id); if (deleted.error) throw new Error('Staging test identity cleanup failed'); }
}
assert.deepEqual(fingerprints(), before, 'Existing records changed during staging tests');
const advisorAfter = advisors(); const afterCounts = counts(advisorAfter), beforeCounts = counts(advisorBefore);
save('advisors-after.json', advisorAfter);
assert.equal(afterCounts.ERROR ?? 0, 0);
const warningKey = item => `${item.name}:${item.metadata?.name ?? item.metadata?.entity ?? ''}`;
const previousWarnings = new Set(advisorBefore.filter(item => item.level === 'WARN').map(warningKey));
const newWarnings = advisorAfter.filter(item => item.level === 'WARN' && !previousWarnings.has(warningKey(item)));
assert(newWarnings.every(item => warningKey(item) === 'authenticated_security_definer_function_executable:homecare_accept_invitations'), 'Unexpected new Security Advisor warning');
const proof = { project, migrationDigest: digest(source), directoryMigrationDigest: digest(directorySource), testDigest: digest(testSource), recordsUnchanged: true, sqlRlsTestsPassed: true, authFlowPassed, beforeCounts, afterCounts,
  intentionalWarning: 'homecare_accept_invitations: bounded self-acceptance using auth.uid(), confirmed matching email, expiry, pending state and row locks; no tenant/user arguments and no anon execution', capturedAt: new Date().toISOString() };
save('verification.json', proof); console.log(JSON.stringify({ directory, ...proof }));
