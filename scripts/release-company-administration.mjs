import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

assert(process.argv.includes('--apply-production'), 'Explicit production approval required');
const project = 'ruzsmxzxeqqcbeycfoma';
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), project);
const proofPath = process.argv[process.argv.indexOf('--verified-staging') + 1];
const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
const migrations = [['20261015140000', 'company_administration'], ['20261015143000', 'administration_directory']]
  .map(([version, name]) => ({ version, name, source: readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8') }));
const digest = value => createHash('sha256').update(value).digest('hex');
assert.equal(proof.project, 'ealfegjvbyiiporettpq');
assert.equal(proof.migrationDigest, digest(migrations[0].source));
assert.equal(proof.directoryMigrationDigest, digest(migrations[1].source));
assert.equal(proof.testDigest, digest(readFileSync('supabase/tests/company_administration.sql', 'utf8')));
assert(proof.recordsUnchanged && proof.sqlRlsTestsPassed && proof.authFlowPassed && !(proof.afterCounts.ERROR ?? 0));
const live = await (await fetch('https://homecare-xi.vercel.app/api/version', { cache: 'no-store' })).json();
assert.equal(live.databaseProject, project);
const directory = mkdtempSync('/private/tmp/workcore-administration-production-');
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
function cli(args) {
  try { return JSON.parse(execFileSync('supabase', [...args, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024, timeout: 120000 })); }
  catch (error) {
    save(`cli-error-${Date.now()}.txt`, String(error.stderr ?? error.message));
    throw new Error(`Production CLI operation failed; inspect private evidence in ${directory} before retrying.`);
  }
}
const query = sql => cli(['db', 'query', '--linked', sql]).rows;
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const advisor = () => cli(['db', 'advisors', '--linked', '--type', 'security', '--level', 'info', '--fail-on', 'none']);
const beforeAdvisor = advisor(); save('advisors-before.json', beforeAdvisor);
assert(!beforeAdvisor.some(item => item.level === 'ERROR'));
const tables = query('select unnest(public.homecare_relational_backup_tables()) as name').map(row => row.name);
assert(tables.length > 50 && tables.every(name => /^homecare_[a-z_]+$/.test(name)));
const columns = query(`select table_name,array_agg(column_name::text order by ordinal_position) as columns from information_schema.columns where table_schema='public' and table_name in (${tables.map(quote).join(',')}) group by table_name`);
const fingerprint = `select jsonb_object_agg(name,value) as value from (values ${columns.map(row => {
  assert(row.columns.every(name => /^[a-z_][a-z0-9_]*$/.test(name)));
  return `(${quote(row.table_name)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from (select ${row.columns.map(name => `"${name}"`).join(',')} from public.${row.table_name}) t))`;
}).join(',')}) x(name,value)`;
// Export a checksummed, private relational backup for every existing company.
const tenants = query('select id from public.homecare_tenants');
const managementToken = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function exportQuery(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${managementToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(60000),
  });
  assert(response.ok, `Backup export request failed: ${response.status}`);
  return response.json();
}
for (const { id } of tenants) {
  const recent = query(`select to_jsonb(b)-'payload' as backup from public.homecare_relational_backups b where tenant_id='${id}'::uuid and reason='before-company-administration-20261015' and created_at>now()-interval '15 minutes' order by created_at desc limit 1`);
  const backup = recent[0]?.backup ?? query(`select public.homecare_create_relational_backup('${id}'::uuid,'before-company-administration-20261015') as backup`)[0].backup;
  const metadata = (await exportQuery(`select length(payload::text) as length,checksum from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0];
  assert(metadata.length > 0);
  const chunks = [];
  for (let start = 1; start <= metadata.length; start += 1000000) {
    chunks.push((await exportQuery(`select substring(payload::text from ${start} for 1000000) as chunk from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0].chunk);
  }
  const payloadText = chunks.join('');
  assert.equal(digest(payloadText), metadata.checksum, 'Exported backup checksum invalid');
  save(`backup-${id}.json`, { backup, payloadText });
  console.log('Private production backup exported and checksum verified.');
}
save('schema-before.json', query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'"));
save('columns-before.json', columns);
let source = `begin; set local lock_timeout='10s'; set local statement_timeout='120s'; create temporary table admin_before on commit drop as ${fingerprint};\n`;
for (const migration of migrations) {
  const applied = query(`select statements from supabase_migrations.schema_migrations where version=${quote(migration.version)}`);
  if (applied.length) { assert.equal(digest(applied[0].statements[0]), digest(migration.source)); continue; }
  source += migration.source.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '');
  source += `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(migration.version)},${quote(migration.name)},array[${quote(migration.source)}]);\n`;
}
source += `do $$ begin if (select value from admin_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_RECORDS_CHANGED'; end if; end $$; notify pgrst,'reload schema'; commit; select true as applied;`;
save('apply.sql', source);
cli(['db', 'query', '--linked', '--file', join(directory, 'apply.sql')]);
const security = query(`select c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
 has_table_privilege('authenticated','public.homecare_tenant_memberships','INSERT,UPDATE,DELETE') as membership_write,
 has_function_privilege('anon','public.homecare_accept_invitations()','EXECUTE') as anon_accept,
 has_function_privilege('authenticated','public.homecare_admin_directory(uuid,uuid,text,text,uuid,integer)','EXECUTE') as client_directory
 from pg_class c where c.oid='public.homecare_feedback'::regclass`)[0];
assert(security.relrowsecurity && !security.anon_access && !security.membership_write && !security.anon_accept && !security.client_directory);
assert.equal(query("select count(*)::int as count from supabase_migrations.schema_migrations where version in ('20261015140000','20261015143000')")[0].count, 2);
const afterAdvisor = advisor(); save('advisors-after.json', afterAdvisor);
assert(!afterAdvisor.some(item => item.level === 'ERROR'));
const key = item => `${item.name}:${item.metadata?.name ?? item.metadata?.entity ?? ''}`;
const old = new Set(beforeAdvisor.filter(item => item.level === 'WARN').map(key));
assert(afterAdvisor.filter(item => item.level === 'WARN' && !old.has(key(item))).every(item => key(item) === 'authenticated_security_definer_function_executable:homecare_accept_invitations'));
const counts = items => items.reduce((result, item) => ({ ...result, [item.level]: (result[item.level] ?? 0) + 1 }), {});
const result = { project, migrationDigest: proof.migrationDigest, directoryMigrationDigest: proof.directoryMigrationDigest, recordsUnchanged: true, backupsVerified: tenants.length, beforeCounts: counts(beforeAdvisor), afterCounts: counts(afterAdvisor), security, capturedAt: new Date().toISOString() };
save('verification.json', result); console.log(JSON.stringify({ directory, ...result }));
