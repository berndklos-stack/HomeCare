import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const option = name => process.argv[process.argv.indexOf(name) + 1];
const environment = option('--project');
const projects = { staging: 'ealfegjvbyiiporettpq', production: 'ruzsmxzxeqqcbeycfoma' };
assert(Object.hasOwn(projects, environment), 'Explicit --project staging|production required');
const project = projects[environment];
const workdir = environment === 'staging' ? '/private/tmp/workcore-security-staging-20261014' : process.cwd();
const version = '20261014150000';
const source = readFileSync(resolve(`supabase/migrations/${version}_personal_block_layouts.sql`), 'utf8');
const testSource = readFileSync(resolve('supabase/tests/personal_block_layouts.sql'), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const migrationDigest = digest(source), testDigest = digest(testSource);
const directory = mkdtempSync(`/private/tmp/workcore-block-layout-${environment}-`);
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
function cli(args) {
  assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), project);
  try { return JSON.parse(execFileSync('supabase', ['--workdir', workdir, ...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) { throw new Error(String(error.stderr ?? error.message).slice(-1800)); }
}
const query = sql => cli(['db', 'query', '--linked', sql]).rows;
const fileQuery = (name, sql) => { save(name, sql); return cli(['db', 'query', '--linked', '--file', join(directory, name)]).rows; };
const advisors = () => cli(['db', 'advisors', '--linked', '--type', 'security', '--level', 'info', '--fail-on', 'none']);
const counts = items => items.reduce((result, item) => { result[item.level] = (result[item.level] ?? 0) + 1; return result; }, {});
const quote = value => "'" + value.replaceAll("'", "''") + "'";
assert(cli(['projects', 'list']).some(p => p.id === project && p.linked && p.status === 'ACTIVE_HEALTHY'));
if (environment === 'production') {
  const live = await (await fetch('https://homecare-xi.vercel.app/api/version', { cache: 'no-store' })).json();
  assert.equal(live.databaseProject, project, 'Live DB differs from linked project');
  const proof = JSON.parse(readFileSync(option('--verified-staging'), 'utf8'));
  assert.equal(proof.project, projects.staging);
  assert.equal(proof.migrationDigest, migrationDigest);
  assert.equal(proof.testDigest, testDigest);
  assert(proof.recordsUnchanged && proof.rlsTestsPassed && (proof.afterCounts.ERROR ?? 0) === 0);
}
const tables = query('select unnest(public.homecare_relational_backup_tables()) as name').map(row => row.name);
assert(tables.length > 0 && tables.every(name => /^homecare_[a-z_]+$/.test(name)));
const fingerprint = `select jsonb_object_agg(name,value) as value from (values ${tables.map(name => `(${quote(name)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from public.${name} t))`).join(',')}) x(name,value)`;
const before = query(fingerprint)[0].value;
const beforeAdvisor = advisors();
save('advisors-before.json', beforeAdvisor);
save('before.json', { project, tableFingerprints: before, backupRegistry: query("select pg_get_functiondef('public.homecare_relational_backup_tables()'::regprocedure) as definition") });
if (!query(`select version from supabase_migrations.schema_migrations where version='${version}'`).length) {
  fileQuery('apply.sql', `begin; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table layout_before on commit drop as ${fingerprint};
    ${source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}
    do $$ begin if (select value from layout_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_RECORDS_CHANGED'; end if; end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','personal_block_layouts',array[${quote(source)}]);
    notify pgrst,'reload schema'; commit; select true as applied;`);
}
let rlsTestsPassed = false;
if (environment === 'staging') {
  assert(testSource.includes("current_database()<>'workcore_operations_test'"));
  fileQuery('rls-test.sql', testSource.replace('begin;', `begin; set local workcore.layout_test_project='${project}';`)
    .replace("current_database()<>'workcore_operations_test'", `current_setting('workcore.layout_test_project',true)<>'${project}'`));
  rlsTestsPassed = true;
}
assert.deepEqual(query(fingerprint)[0].value, before, 'Existing business data changed');
const policies = query("select * from pg_policies where schemaname='public' and tablename='homecare_user_block_layouts'");
assert.deepEqual(policies.map(p => p.policyname).sort(), ['personal_block_layout_insert', 'personal_block_layout_select', 'personal_block_layout_update']);
const security = query(`select c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated',c.oid,'DELETE') as client_delete,
  has_function_privilege('anon','public.homecare_update_block_layout(uuid,text,text[])','EXECUTE') as anon_rpc,
  (select prosecdef from pg_proc where oid='public.homecare_update_block_layout(uuid,text,text[])'::regprocedure) as definer,
  'homecare_user_block_layouts'=any(public.homecare_relational_backup_tables()) as backup_included
  from pg_class c where c.oid='public.homecare_user_block_layouts'::regclass`)[0];
assert(security.relrowsecurity && !security.anon_access && !security.client_delete && !security.anon_rpc && !security.definer && security.backup_included);
assert.equal(query("select count(*)::int as count from information_schema.columns where table_schema='public' and table_name='homecare_user_block_layouts' and ((column_name in('tenant_id','user_id') and udt_name='uuid') or (column_name='scope_key' and udt_name='text') or (column_name='block_order' and udt_name='_text')) and is_nullable='NO'")[0].count, 4);
assert.equal(query(`select count(*)::int as count from supabase_migrations.schema_migrations where version='${version}'`)[0].count, 1);
const afterAdvisor = advisors();
save('advisors-after.json', afterAdvisor);
const afterCounts = counts(afterAdvisor), beforeCounts = counts(beforeAdvisor);
assert.equal(afterCounts.ERROR ?? 0, 0);
assert((afterCounts.WARN ?? 0) <= (beforeCounts.WARN ?? 0), 'New security warnings');
const proof = { project, environment, migrationDigest, testDigest, recordsUnchanged: true, rlsTestsPassed, checkedTableCount: tables.length, beforeCounts, afterCounts, security, policies, capturedAt: new Date().toISOString() };
save('verification.json', proof);
console.log(JSON.stringify({ directory, ...proof }));
