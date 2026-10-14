import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const environment = option('--project');
const projects = { staging: 'ealfegjvbyiiporettpq', production: 'ruzsmxzxeqqcbeycfoma' };
assert(Object.hasOwn(projects, environment), 'Explicit --project staging|production required');
const project = projects[environment];
const workdir = environment === 'staging' ? '/private/tmp/workcore-security-staging-20261014' : process.cwd();
const migrationName = '20261014130000_standard_trip_distances.sql';
const source = readFileSync(resolve('supabase/migrations', migrationName), 'utf8');
const testSource = readFileSync(resolve('supabase/tests/standard_trip_distances.sql'), 'utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const migrationDigest = digest(source), testDigest = digest(testSource);
const directory = mkdtempSync(`/private/tmp/workcore-standard-distance-${environment}-`);
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
function cli(args) {
  assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), project);
  try { return JSON.parse(execFileSync('supabase', ['--workdir', workdir, ...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) { throw new Error(String(error.stderr ?? error.message).slice(-1800)); }
}
const query = (sql) => cli(['db', 'query', '--linked', sql]).rows;
const fileQuery = (name, sql) => { save(name, sql); return cli(['db', 'query', '--linked', '--file', join(directory, name)]).rows; };
const advisors = () => cli(['db', 'advisors', '--linked', '--type', 'security', '--level', 'info', '--fail-on', 'none']);
const counts = (items) => items.reduce((result, item) => { result[item.level] = (result[item.level] ?? 0) + 1; return result; }, {});
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const fingerprint = `select jsonb_build_object(
  'resources',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text,'')) from public.homecare_resources r),
  'trips',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.homecare_vehicle_trips t)
) as value`;
assert(cli(['projects', 'list']).some((p) => p.id === project && p.linked && p.status === 'ACTIVE_HEALTHY'));
if (environment === 'production') {
  const live = await (await fetch('https://homecare-xi.vercel.app/api/version', { cache: 'no-store' })).json();
  assert.equal(live.databaseProject, project, 'Live DB differs from linked project');
  const proof = JSON.parse(readFileSync(option('--verified-staging'), 'utf8'));
  assert.equal(proof.project, projects.staging);
  assert.equal(proof.migrationDigest, migrationDigest);
  assert.equal(proof.testDigest, testDigest);
  assert(proof.recordsUnchanged && proof.rlsTestsPassed && (proof.afterCounts.ERROR ?? 0) === 0);
}
const before = query(fingerprint)[0].value;
const beforeAdvisor = advisors();
save('advisors-before.json', beforeAdvisor);
save('backup-before.json', {
  project,
  resources: query('select to_jsonb(r) as record from public.homecare_resources r order by id'),
  trips: query('select to_jsonb(t) as record from public.homecare_vehicle_trips t order by id'),
  backupRegistry: query("select pg_get_functiondef('public.homecare_relational_backup_tables()'::regprocedure) as definition"),
});
const installed = query("select version from supabase_migrations.schema_migrations where version='20261014130000'").length > 0;
if (!installed) {
  fileQuery('apply.sql', `begin; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table distance_before on commit drop as ${fingerprint};
    ${source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}
    do $$ begin if (select value from distance_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_RECORDS_CHANGED'; end if; end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('20261014130000','standard_trip_distances',array[${quote(source)}]);
    notify pgrst,'reload schema'; commit; select true as applied;`);
}
let rlsTestsPassed = false;
if (environment === 'staging') {
  assert(testSource.includes("current_database()<>'workcore_operations_test'"));
  fileQuery('rls-test.sql', testSource.replace('begin;', `begin; set local workcore.distance_test_project='${project}';`)
    .replace("current_database()<>'workcore_operations_test'", `current_setting('workcore.distance_test_project',true)<>'${project}'`));
  rlsTestsPassed = true;
}
assert.deepEqual(query(fingerprint)[0].value, before, 'Resource or trip data changed');
const policies = query("select * from pg_policies where schemaname='public' and tablename='homecare_resource_standard_trip_distances'");
assert.equal(policies.length, 1);
assert.equal(policies[0].cmd, 'SELECT');
assert(query("select version from supabase_migrations.schema_migrations where version='20261014130000'").length === 1);
const security = query(`select c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') as anon_read,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as client_write,
  has_function_privilege('authenticated','public.homecare_sync_standard_trip_distances()','EXECUTE') as trigger_rpc,
  'homecare_resource_standard_trip_distances'=any(public.homecare_relational_backup_tables()) as backup_included
  from pg_class c where c.oid='public.homecare_resource_standard_trip_distances'::regclass`)[0];
assert(security.relrowsecurity && !security.anon_read && !security.client_write && !security.trigger_rpc && security.backup_included);
const afterAdvisor = advisors();
save('advisors-after.json', afterAdvisor);
const afterCounts = counts(afterAdvisor), beforeCounts = counts(beforeAdvisor);
assert.equal(afterCounts.ERROR ?? 0, 0);
assert((afterCounts.WARN ?? 0) <= (beforeCounts.WARN ?? 0), 'New security warnings');
const proof = { project, environment, migrationDigest, testDigest, recordsUnchanged: true, rlsTestsPassed, beforeCounts, afterCounts, security, policies, capturedAt: new Date().toISOString() };
save('verification.json', proof);
console.log(JSON.stringify({ directory, ...proof }));
