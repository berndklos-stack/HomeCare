import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const environment = option('--project');
assert(['staging', 'production'].includes(environment), 'Choose staging or production explicitly');
const projects = { staging: 'ealfegjvbyiiporettpq', production: 'ruzsmxzxeqqcbeycfoma' };
const project = projects[environment];
const workdir = environment === 'staging' ? '/private/tmp/workcore-security-staging-20261014' : process.cwd();
const directory = mkdtempSync(`/private/tmp/workcore-security-${environment}-`);
chmodSync(directory, 0o700);
const names = ['20261014100000_resource_field_catalog_rls.sql', '20261014110000_security_advisor_function_hardening.sql', '20261014120000_resource_foreign_keys_and_indexes.sql'];
const migrations = names.map((name) => {
  const source = readFileSync(join('supabase/migrations', name), 'utf8');
  return { name, version: name.split('_')[0], source, body: source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, ''), sha256: createHash('sha256').update(source).digest('hex') };
});
const digests = Object.fromEntries(migrations.map((m) => [m.name, m.sha256]));
const testDigests = Object.fromEntries(['resource_field_catalog_rls.sql', 'security_advisor_hardening.sql'].map((name) => [name,
  createHash('sha256').update(readFileSync(resolve('supabase/tests', name))).digest('hex')]));
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
function cli(args) {
  assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), project, 'Wrong linked project');
  try {
    return JSON.parse(execFileSync('supabase', ['--workdir', workdir, ...args, '--output', 'json'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    throw new Error(String(error.stderr ?? error.message).slice(-1600));
  }
}
const query = (sql) => cli(['db', 'query', '--linked', sql]).rows;
const fileQuery = (name, sql) => { save(name, sql); return cli(['db', 'query', '--linked', '--file', join(directory, name)]).rows; };
const advisors = () => cli(['db', 'advisors', '--linked', '--type', 'all', '--level', 'info', '--fail-on', 'none']);
const counts = (items) => items.reduce((r, x) => { const key = `${x.categories.join('+')}:${x.level}`; r[key] = (r[key] ?? 0) + 1; return r; }, {});
const tables = ['homecare_resource_field_catalog', 'homecare_resources', 'homecare_resource_types', 'homecare_resource_type_fields', 'homecare_resource_assignments', 'homecare_maintenance_plans', 'homecare_maintenance_events'];
const fingerprints = `select jsonb_object_agg(name,value) as fingerprint from (values ${tables.map((name) => `('${name}',(select jsonb_build_object('count',count(*),'sha',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.${name} t))`).join(',')}) x(name,value)`;
const functionBodies = "select jsonb_object_agg(p.oid::regprocedure::text,md5(p.prosrc)) as fingerprint from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'";
const listed = cli(['projects', 'list']);
assert(listed.some((p) => p.id === project && p.linked && p.status === 'ACTIVE_HEALTHY'), 'Project must be active and explicitly linked');
if (environment === 'production' && process.argv.includes('--apply')) {
  assert(process.argv.includes('--verified-staging'), 'Production requires verified Staging evidence');
  const proof = JSON.parse(readFileSync(option('--verified-staging'), 'utf8'));
  assert.equal(proof.project, projects.staging);
  assert.deepEqual(proof.migrationDigests, digests);
  assert.deepEqual(proof.testDigests, testDigests);
  assert(proof.recordsUnchanged && proof.functionBodiesUnchanged && proof.rlsTestsPassed);
  assert.equal(proof.afterCounts['SECURITY:ERROR'] ?? 0, 0);
}
const beforeAdvisors = advisors();
save('advisors-before.json', beforeAdvisors);
const before = query(fingerprints)[0].fingerprint;
const bodies = query(functionBodies)[0].fingerprint;
save('before.json', { project, rows: before, bodies,
  functions: query("select p.oid::regprocedure::text as signature,p.proacl::text,p.proconfig,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'"),
  policies: query("select * from pg_policies where schemaname in('public','storage')"),
  tables: query("select c.oid::regclass::text as name,c.relrowsecurity,c.relacl::text,obj_description(c.oid,'pg_class') as comment from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p')"),
  constraints: query("select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace"),
  indexes: query("select * from pg_indexes where schemaname='public'") });
if (process.argv.includes('--apply')) {
  const installed = new Set(query("select version from supabase_migrations.schema_migrations").map((r) => r.version));
  const pending = migrations.filter((m) => !installed.has(m.version));
  const sql = `begin; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table security_before_rows on commit drop as ${fingerprints};
    create temporary table security_before_functions on commit drop as ${functionBodies};
    ${pending.map((m) => `${m.body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(m.version)},${quote(m.name.replace(/^\d+_|\.sql$/g, ''))},array[${quote(m.source)}]);`).join('\n')}
    do $$ begin
      if (select fingerprint from security_before_rows) is distinct from (${fingerprints}) then raise exception 'RESOURCE_RECORDS_CHANGED'; end if;
      if (select fingerprint from security_before_functions) is distinct from (${functionBodies}) then raise exception 'FUNCTION_BODIES_CHANGED'; end if;
    end $$; notify pgrst,'reload schema'; commit; select true as migrations_applied;`;
  fileQuery('apply.sql', sql);
}
let rlsTestsPassed = false;
if (environment === 'staging' && process.argv.includes('--apply')) {
  for (const name of ['resource_field_catalog_rls.sql', 'security_advisor_hardening.sql']) {
    const original = readFileSync(resolve('supabase/tests', name), 'utf8');
    assert(original.includes("current_database()<>'workcore_operations_test'"));
    const test = original.replace('begin;', `begin; set local workcore.security_test_project='${project}';`)
      .replace("current_database()<>'workcore_operations_test'", `current_setting('workcore.security_test_project',true)<>'${project}'`);
    fileQuery(`test-${name}`, test);
  }
  rlsTestsPassed = true;
}
const after = query(fingerprints)[0].fingerprint;
assert.deepEqual(after, before, 'Existing resource/catalog rows changed');
assert.deepEqual(query(functionBodies)[0].fingerprint, bodies, 'Existing function bodies changed');
const afterAdvisors = advisors();
save('advisors-after.json', afterAdvisors);
const proof = { project, environment, migrationDigests: digests, testDigests, recordsUnchanged: true, functionBodiesUnchanged: true, rlsTestsPassed,
  beforeCounts: counts(beforeAdvisors), afterCounts: counts(afterAdvisors), capturedAt: new Date().toISOString() };
save('verification.json', proof);
console.log(JSON.stringify({ directory, ...proof }));
