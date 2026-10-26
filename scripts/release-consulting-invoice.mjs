import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const environment = option("--project");
const projects = { staging: "ealfegjvbyiiporettpq", production: "ruzsmxzxeqqcbeycfoma" };
assert(Object.hasOwn(projects, environment), "Explicit --project staging|production required");
const project = projects[environment];
const inspect = process.argv.includes("--inspect");
if (!inspect && environment === "production") assert(process.argv.includes("--apply-production"), "Production approval required");
const version = "20261026140000";
const source = readFileSync(`supabase/migrations/${version}_consulting_attachments_invoice_fields.sql`, "utf8");
const tests = readFileSync("supabase/tests/consulting_attachments_invoice_fields.sql", "utf8");
const digest = value => createHash("sha256").update(value).digest("hex");
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const directory = mkdtempSync(`/private/tmp/workcore-invoice-release-${environment}-`);
chmodSync(directory, 0o700);
const save = (name, value) => writeFileSync(join(directory, name), typeof value === "string" ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
async function api(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    save(`error-${Date.now()}.txt`, await response.text());
    throw new Error(`Database operation failed (${response.status}); private diagnostics: ${directory}`);
  }
  return response.json();
}
const query = sql => api("/database/query", { query: sql });
const advisor = async () => { const result = await api("/advisors/security"); return Array.isArray(result) ? result : result.lints; };
const counts = rows => rows.reduce((value, row) => ({ ...value, [row.level]: (value[row.level] || 0) + 1 }), {});
assert.equal((await api("")).status, "ACTIVE_HEALTHY");
const state = (await query(`select
  exists(select 1 from supabase_migrations.schema_migrations where version=${quote(version)}) as applied,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261020160000') as unfinished_password_migration,
  to_regprocedure('public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)') is not null as required_job_rpc,
  (select count(*)::int from public.homecare_billing_items where record_data ?| array['customerReference','ourReference','orderReference']) as legacy_headers,
  (select count(*)::int from public.homecare_invoice_lines where record_data ?| array['articleNumber','comment','discountPercent']) as legacy_lines`))[0];
assert(!state.unfinished_password_migration && state.required_job_rpc, "Unexpected schema prerequisites");
if (inspect) { console.log(JSON.stringify({ project, directory, ...state })); process.exit(0); }
if (environment === "production") {
  const live = await (await fetch("https://homecare-xi.vercel.app/api/version", { cache: "no-store" })).json();
  assert.equal(live.databaseProject, project);
  const proof = JSON.parse(readFileSync(option("--verified-staging"), "utf8"));
  assert.equal(proof.project, projects.staging);
  assert.equal(proof.migrationDigest, digest(source));
  assert.equal(proof.testDigest, digest(tests));
  assert(proof.recordsUnchanged && proof.sqlRlsTestsPassed && !proof.afterCounts.ERROR);
  assert(Date.now() - Date.parse(proof.capturedAt) < 86400000, "Staging proof expired");
}
const beforeAdvisor = await advisor(); save("advisors-before.json", beforeAdvisor);
assert(!counts(beforeAdvisor).ERROR, "Security errors require review");
const tables = [...new Set((await query("select unnest(public.homecare_relational_backup_tables()) as name")).map(row => row.name))];
assert(tables.length > 50 && tables.every(name => /^homecare_[a-z_]+$/.test(name)));
const columns = await query(`select table_name,array_agg(column_name::text order by ordinal_position) as columns from information_schema.columns where table_schema='public' and table_name in (${tables.map(quote).join(",")}) group by table_name`);
const fingerprint = `select jsonb_object_agg(name,value) as value from (values ${columns.map(row => {
  assert(row.columns.every(name => /^[a-z_][a-z0-9_]*$/.test(name)));
  return `(${quote(row.table_name)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from (select ${row.columns.map(name => `"${name}"`).join(",")} from public.${row.table_name}) t))`;
}).join(",")}) x(name,value)`;
save("columns-before.json", columns);
save("functions-before.json", await query("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('homecare_apply_job_operation_mutation','homecare_refresh_invoice_totals')"));
const backups = [];
if (environment === "production") {
  for (const { id } of await query("select id from public.homecare_tenants")) {
    const backup = (await query(`select public.homecare_create_relational_backup(${quote(id)}::uuid,'before-consulting-invoice-20261026') as backup`))[0].backup;
    assert((await query(`select checksum=encode(extensions.digest(payload::text,'sha256'),'hex') as valid from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0].valid, "Backup checksum mismatch");
    backups.push({ id: backup.id, checksumVerified: true });
  }
  save("backups.json", backups);
}
if (state.applied) {
  const applied = (await query(`select statements from supabase_migrations.schema_migrations where version=${quote(version)}`))[0];
  assert.equal(digest(applied.statements[0]), digest(source), "Applied migration differs");
} else {
  const body = source.replace(/^begin;\s*/, "").replace(/\s*commit;\s*$/, "");
  const transaction = ending => `begin isolation level repeatable read; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table invoice_before on commit drop as ${fingerprint};
    ${body}
    do $$ begin if (select value from invoice_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_RECORDS_CHANGED'; end if; end $$;
    ${ending}`;
  save("dry-run.sql", transaction("rollback; select true as dry_run_passed;"));
  await query(transaction("rollback; select true as dry_run_passed;"));
  const apply = transaction(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},'consulting_attachments_invoice_fields',array[${quote(source)}]); notify pgrst,'reload schema'; commit; select true as applied;`);
  save("apply.sql", apply); await query(apply);
}
let sqlRlsTestsPassed = false;
if (environment === "staging") {
  const before = (await query(fingerprint))[0].value;
  await query(tests);
  assert.deepEqual((await query(fingerprint))[0].value, before, "Staging fixture rollback failed");
  sqlRlsTestsPassed = true;
}
const security = (await query(`select
  (select bool_and(relrowsecurity) from pg_class where oid in('public.homecare_media'::regclass,'public.homecare_invoice_lines'::regclass,'public.homecare_billing_items'::regclass)) as rls_enabled,
  not has_table_privilege('anon','public.homecare_media','select,insert,update,delete') as anon_media_blocked,
  not has_function_privilege('anon','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','execute') and not has_function_privilege('authenticated','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','execute') as clients_blocked,
  has_function_privilege('service_role','public.homecare_apply_job_operation_mutation(uuid,text,text,text,text,uuid,jsonb,bigint,uuid)','execute') as server_allowed,
  exists(select 1 from pg_constraint where conname='homecare_media_time_entry_fk' and convalidated) as tenant_fk_validated`))[0];
assert(Object.values(security).every(Boolean), "Security verification failed");
const afterAdvisor = await advisor(); save("advisors-after.json", afterAdvisor);
assert(!counts(afterAdvisor).ERROR, "Post-migration security error");
const warningKey = item => JSON.stringify([item.name, item.metadata]);
const oldWarnings = new Set(beforeAdvisor.filter(row => row.level === "WARN").map(warningKey));
assert(!afterAdvisor.some(row => row.level === "WARN" && !oldWarnings.has(warningKey(row))), "New advisor warning requires review");
const proof = { project, environment, migrationDigest: digest(source), testDigest: digest(tests), recordsUnchanged: true, sqlRlsTestsPassed, verifiedBackups: backups.length, security, beforeCounts: counts(beforeAdvisor), afterCounts: counts(afterAdvisor), capturedAt: new Date().toISOString() };
save("verification.json", proof); console.log(JSON.stringify({ directory, ...proof }));
