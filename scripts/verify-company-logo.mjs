import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const option = name => process.argv[process.argv.indexOf(name) + 1];
const environment = option('--project');
const projects = { staging: 'ealfegjvbyiiporettpq', production: 'ruzsmxzxeqqcbeycfoma' };
assert(Object.hasOwn(projects, environment), 'Explicit --project staging|production required');
const project = projects[environment];
const workdir = environment === 'staging' ? '/private/tmp/workcore-security-staging-20261014' : process.cwd();
assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), project);
const version = '20261015200000';
const source = readFileSync(`supabase/migrations/${version}_company_logo.sql`, 'utf8');
const tests = readFileSync('supabase/tests/company_logo.sql', 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const migrationDigest = digest(source), testDigest = digest(tests);
const directory = mkdtempSync(`/private/tmp/workcore-company-logo-${environment}-`);
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
const token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    save(`error-${Date.now()}.txt`, await response.text());
    throw new Error(`Database operation failed (${response.status}); private evidence: ${directory}`);
  }
  return response.json();
}
function advisors() {
  return JSON.parse(execFileSync('supabase', ['--workdir', workdir, 'db', 'advisors', '--linked', '--type', 'security', '--level', 'info', '--fail-on', 'none', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }));
}
const counts = items => items.reduce((result, item) => ({ ...result, [item.level]: (result[item.level] ?? 0) + 1 }), {});
const quote = value => "'" + value.replaceAll("'", "''") + "'";
if (environment === 'production') {
  const live = await (await fetch('https://homecare-xi.vercel.app/api/version', { cache: 'no-store' })).json();
  assert.equal(live.databaseProject, project);
  const staging = JSON.parse(readFileSync(option('--verified-staging'), 'utf8'));
  assert.equal(staging.project, projects.staging);
  assert.equal(staging.migrationDigest, migrationDigest);
  assert.equal(staging.testDigest, testDigest);
  assert(staging.recordsUnchanged && staging.rlsTestsPassed && !(staging.afterCounts.ERROR ?? 0));
}
const advisorBefore = advisors(); save('advisors-before.json', advisorBefore);
assert(!(counts(advisorBefore).ERROR ?? 0));
const fingerprint = `select md5(coalesce(jsonb_agg(to_jsonb(s) order by to_jsonb(s)::text)::text,'')) as fingerprint from
 (select tenant_id,key,value,revision,deleted_at,updated_at from public.homecare_settings) s`;
const before = (await query(fingerprint))[0].fingerprint;
const backups = [];
if (environment === 'production') {
  for (const { id } of await query('select id from public.homecare_tenants')) {
    const backup = (await query(`select public.homecare_create_relational_backup('${id}'::uuid,'before-company-logo-20261015') as backup`))[0].backup;
    const verification = (await query(`select checksum=encode(extensions.digest(payload::text,'sha256'),'hex') as valid from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0];
    assert(verification.valid, 'Server backup checksum mismatch'); backups.push({ id: backup.id, checksumVerified: true });
  }
  save('backups.json', backups);
}
const applied = await query(`select statements from supabase_migrations.schema_migrations where version='${version}'`);
if (applied.length) assert.equal(digest(applied[0].statements[0]), migrationDigest);
else {
  const sql = `begin; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table logo_before on commit drop as ${fingerprint};
    ${source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}
    do $$ begin if (select fingerprint from logo_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_SETTINGS_CHANGED'; end if; end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','company_logo',array[${quote(source)}]);
    notify pgrst,'reload schema'; commit; select true as applied;`;
  save('apply.sql', sql); await query(sql);
}
assert.equal((await query(fingerprint))[0].fingerprint, before, 'Existing settings changed');
let rlsTestsPassed = false;
if (environment === 'staging') {
  const testSql = tests.replace('begin;', `begin; set local workcore.logo_test_project='${project}';`)
    .replace("current_database()<>'workcore_operations_test'", `current_setting('workcore.logo_test_project',true)<>'${project}'`);
  save('tests.sql', testSql); await query(testSql); rlsTestsPassed = true;
  assert.equal((await query(fingerprint))[0].fingerprint, before, 'Staging tests changed existing settings');
}
const security = (await query(`select c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_function_privilege('anon','public.homecare_project_company_logo()','EXECUTE') as anon_trigger,
  (select prosecdef from pg_proc where oid='public.homecare_project_company_logo()'::regprocedure) as definer,
  (select count(*)::int from pg_trigger where tgrelid=c.oid and tgname in('bump_revision','homecare_settings_updated_at','project_company_logo') and tgenabled='O') as active_triggers,
  (select count(*)::int from information_schema.columns where table_schema='public' and table_name='homecare_settings' and column_name='logo_url' and data_type='text') as typed_columns
  from pg_class c where c.oid='public.homecare_settings'::regclass`))[0];
assert(security.relrowsecurity && !security.anon_access && !security.anon_trigger && !security.definer && security.active_triggers === 3 && security.typed_columns === 1);
const advisorAfter = advisors(); save('advisors-after.json', advisorAfter);
const beforeCounts = counts(advisorBefore), afterCounts = counts(advisorAfter);
assert(!(afterCounts.ERROR ?? 0));
assert((afterCounts.WARN ?? 0) <= (beforeCounts.WARN ?? 0), 'New security warnings');
const proof = { environment, project, migrationDigest, testDigest, recordsUnchanged: true, rlsTestsPassed, verifiedBackups: backups.length, beforeCounts, afterCounts, security, capturedAt: new Date().toISOString() };
save('verification.json', proof); console.log(JSON.stringify({ directory, ...proof }));
