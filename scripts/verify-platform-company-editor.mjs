import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const option = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const environment = option('--project');
const projects = { staging: 'ealfegjvbyiiporettpq', production: 'ruzsmxzxeqqcbeycfoma' };
assert(Object.hasOwn(projects, environment), 'Explicit --project staging|production required');
if (environment === 'production') assert(process.argv.includes('--apply-production'), 'Explicit production approval required');
const project = projects[environment];
const version = '20261020150000';
const source = readFileSync(`supabase/migrations/${version}_platform_company_editor.sql`, 'utf8');
const tests = readFileSync('supabase/tests/platform_company_editor.sql', 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const migrationDigest = digest(source), testDigest = digest(tests);
const directory = mkdtempSync(`/private/tmp/workcore-platform-company-${environment}-`);
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
const token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function api(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    save(`error-${Date.now()}.txt`, await response.text());
    throw new Error(`Database operation failed (${response.status}); inspect private evidence in ${directory}`);
  }
  return response.json();
}
const query = sql => api('/database/query', { query: sql });
const advisor = async () => { const result = await api('/advisors/security'); return Array.isArray(result) ? result : result.lints; };
const counts = items => items.reduce((result, item) => ({ ...result, [item.level]: (result[item.level] ?? 0) + 1 }), {});
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const metadata = await api('');
assert.equal(metadata.id, project);
assert.equal(metadata.status, 'ACTIVE_HEALTHY');
assert.equal((await query("select count(*)::int as count from supabase_migrations.schema_migrations where version='20261020160000'"))[0].count, 0, 'Unfinished password migration must remain excluded');
if (environment === 'production') {
  const live = await (await fetch('https://homecare-xi.vercel.app/api/version', { cache: 'no-store' })).json();
  assert.equal(live.databaseProject, project);
  const proof = JSON.parse(readFileSync(option('--verified-staging'), 'utf8'));
  assert.equal(proof.project, projects.staging);
  assert.equal(proof.migrationDigest, migrationDigest);
  assert.equal(proof.testDigest, testDigest);
  assert(proof.recordsUnchanged && proof.rlsTestsPassed && !(proof.afterCounts.ERROR ?? 0));
  assert(Date.now() - Date.parse(proof.capturedAt) < 24 * 60 * 60 * 1000, 'Staging proof expired');
}
const beforeAdvisor = await advisor(); save('advisors-before.json', beforeAdvisor);
assert(!(counts(beforeAdvisor).ERROR ?? 0), 'Existing security errors require review');
const tables = ['homecare_tenants', 'homecare_settings', 'homecare_tenant_modules', 'homecare_roles', 'homecare_tenant_memberships'];
const fingerprint = `select jsonb_build_object(${tables.flatMap(table => [quote(table), `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from public.${table} t)`]).join(',')}) as fingerprint`;
save('schema-before.json', await query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('homecare_platform_company_detail','homecare_platform_company_update')"));
const backups = [];
if (environment === 'production') {
  for (const { id } of await query('select id from public.homecare_tenants')) {
    const backup = (await query(`select public.homecare_create_relational_backup(${quote(id)}::uuid,'before-platform-company-editor-20261021') as backup`))[0].backup;
    const verified = (await query(`select checksum=encode(extensions.digest(payload::text,'sha256'),'hex') as valid from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0].valid;
    assert(verified, 'Server backup checksum mismatch'); backups.push({ id: backup.id, checksumVerified: true });
  }
  save('backups.json', backups);
}
const applied = await query(`select statements from supabase_migrations.schema_migrations where version=${quote(version)}`);
if (applied.length) assert.equal(digest(applied[0].statements[0]), migrationDigest, 'Applied migration differs');
else {
  const sql = `begin isolation level repeatable read; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table company_before on commit drop as ${fingerprint};
    ${source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}
    do $$ begin if (select fingerprint from company_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_COMPANY_DATA_CHANGED'; end if; end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},'platform_company_editor',array[${quote(source)}]);
    notify pgrst,'reload schema'; commit; select true as applied;`;
  save('apply.sql', sql); await query(sql);
}
let rlsTestsPassed = false;
if (environment === 'staging') {
  const testSql = tests.replace('begin;', `begin isolation level repeatable read; set local workcore.company_test_project='${project}'; create temporary table company_test_before on commit drop as ${fingerprint};`)
    .replace("current_database()<>'workcore_operations_test'", `current_setting('workcore.company_test_project',true)<>'${project}'`);
  const before = (await query(fingerprint))[0].fingerprint;
  save('tests.sql', testSql); await query(testSql);
  assert.deepEqual((await query(fingerprint))[0].fingerprint, before, 'Staging fixtures were not rolled back');
  rlsTestsPassed = true;
}
const security = (await query(`select
  not has_function_privilege('anon','public.homecare_platform_company_detail(uuid,uuid,uuid)','execute') and
  not has_function_privilege('authenticated','public.homecare_platform_company_detail(uuid,uuid,uuid)','execute') and
  not has_function_privilege('anon','public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])','execute') and
  not has_function_privilege('authenticated','public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])','execute') as clients_blocked,
  has_function_privilege('service_role','public.homecare_platform_company_detail(uuid,uuid,uuid)','execute') and
  has_function_privilege('service_role','public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])','execute') as server_allowed,
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.homecare_tenants'::regclass,'public.homecare_settings'::regclass,'public.homecare_tenant_modules'::regclass)) as rls_enabled,
  (select count(*)::int from pg_proc where oid in ('public.homecare_platform_company_detail(uuid,uuid,uuid)'::regprocedure,'public.homecare_platform_company_update(uuid,uuid,uuid,bigint,bigint,jsonb,text[])'::regprocedure) and prosecdef and proconfig @> array['search_path=public, pg_temp']) as hardened_functions`))[0];
assert(security.clients_blocked && security.server_allowed && security.rls_enabled && security.hardened_functions === 2);
const afterAdvisor = await advisor(); save('advisors-after.json', afterAdvisor);
assert(!(counts(afterAdvisor).ERROR ?? 0));
const warningKey = item => JSON.stringify([item.name, item.metadata]);
const existingWarnings = new Set(beforeAdvisor.filter(item => item.level === 'WARN').map(warningKey));
assert(!afterAdvisor.some(item => item.level === 'WARN' && !existingWarnings.has(warningKey(item))), 'New security warning');
const proof = { environment, project, migrationDigest, testDigest, recordsUnchanged: true, rlsTestsPassed, verifiedBackups: backups.length, security, beforeCounts: counts(beforeAdvisor), afterCounts: counts(afterAdvisor), capturedAt: new Date().toISOString() };
save('verification.json', proof); console.log(JSON.stringify({ directory, ...proof }));
