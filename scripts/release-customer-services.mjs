import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const environment = option("--project");
const projects = { staging: "ealfegjvbyiiporettpq", production: "ruzsmxzxeqqcbeycfoma" };
assert(Object.hasOwn(projects, environment), "Explicit staging|production required");
if (environment === "production") assert(process.argv.includes("--apply-production"), "Production approval required");
const project = projects[environment], version = "20261116120000", name = "customer_service_conditions";
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
const tests = readFileSync(`supabase/tests/${name}.sql`, "utf8");
const digest = value => createHash("sha256").update(value).digest("hex");
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const directory = mkdtempSync(`/private/tmp/workcore-customer-release-${environment}-`);
chmodSync(directory, 0o700);
const save = (file, value) => writeFileSync(join(directory, file), typeof value === "string" ? value : JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
async function api(path, body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) { save(`error-${Date.now()}.txt`, await response.text()); throw new Error(`Database operation failed (${response.status}); diagnostics: ${directory}`); }
  return response.json();
}
const query = query => api("/database/query", { query });
const advisor = async () => { const result = await api("/advisors/security"); return Array.isArray(result) ? result : result.lints; };
const counts = rows => rows.reduce((result, row) => ({ ...result, [row.level]: (result[row.level] || 0) + 1 }), {});
const metadata = await api("");
assert.equal(metadata.id, project); assert.equal(metadata.status, "ACTIVE_HEALTHY");
assert(!(await query("select exists(select 1 from supabase_migrations.schema_migrations where version='20261020160000') as applied"))[0].applied, "Unfinished account security must remain excluded");
if (environment === "production") {
  const live = await (await fetch("https://homecare-xi.vercel.app/api/version", { cache: "no-store" })).json();
  assert.equal(live.databaseProject, project);
  const proof = JSON.parse(readFileSync(option("--verified-staging"), "utf8"));
  assert.equal(proof.project, projects.staging); assert.equal(proof.migrationDigest, digest(source)); assert.equal(proof.testDigest, digest(tests));
  assert(proof.recordsUnchanged && proof.sqlRlsTestsPassed && !proof.afterCounts.ERROR);
  assert(Date.now() - Date.parse(proof.capturedAt) < 86400000, "Staging proof expired");
}
const beforeAdvisor = await advisor(); save("advisors-before.json", beforeAdvisor);
assert(!counts(beforeAdvisor).ERROR, "Existing security error requires review");
const tables = [...new Set((await query("select unnest(public.homecare_relational_backup_tables()) as name")).map(row => row.name))];
assert(tables.length > 50 && tables.every(table => /^homecare_[a-z_]+$/.test(table)));
const fingerprint = `select jsonb_object_agg(name,value) as value from (values ${tables.map(table => `(${quote(table)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from public.${table} t))`).join(",")}) x(name,value)`;
save("schema-before.json", await query("select pg_get_functiondef('public.homecare_relational_backup_tables()'::regprocedure) as definition"));
const backups = [];
if (environment === "production") {
  for (const { id } of await query("select id from public.homecare_tenants order by id")) {
    const backup = (await query(`select public.homecare_create_relational_backup(${quote(id)}::uuid,'before-customer-services-20261116') as backup`))[0].backup;
    const metadata = (await query(`select length(payload::text)::int as length,checksum from public.homecare_relational_backups where id=${quote(backup.id)}::uuid and checksum=encode(extensions.digest(payload::text,'sha256'),'hex')`))[0];
    assert(metadata, "Server backup checksum invalid");
    const chunks = [];
    for (let start = 1; start <= metadata.length; start += 500000) chunks.push((await query(`select substring(payload::text from ${start} for 500000) as chunk from public.homecare_relational_backups where id=${quote(backup.id)}::uuid`))[0].chunk);
    const payloadText = chunks.join(""); assert.equal(digest(payloadText), metadata.checksum, "Downloaded backup checksum invalid");
    save(`backup-${id}.json`, { backup, payloadText });
    backups.push({ id: backup.id, tenant: id, checksumVerified: true, localExportVerified: true });
    console.log("Production company backup exported and checksum verified.");
  }
  save("backups.json", backups);
}
const applied = await query(`select statements from supabase_migrations.schema_migrations where version=${quote(version)}`);
if (applied.length) assert.equal(digest(applied[0].statements[0]), digest(source), "Applied migration differs");
else {
  const body = source.replace(/^begin;\s*/, "").replace(/\s*commit;\s*$/, "");
  const transaction = ending => `begin isolation level repeatable read; set local lock_timeout='10s'; set local statement_timeout='120s';
    create temporary table customer_before on commit drop as ${fingerprint};
    ${body}
    do $$ begin if (select value from customer_before) is distinct from (${fingerprint}) then raise exception 'EXISTING_RECORDS_CHANGED'; end if; end $$;
    ${ending}`;
  await query(transaction("rollback; select true as dry_run_passed;"));
  const apply = transaction(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]); notify pgrst,'reload schema'; commit; select true as applied;`);
  save("apply.sql", apply); await query(apply);
}
console.log("Migration verified; preexisting records unchanged inside transaction.");
let sqlRlsTestsPassed = false;
if (environment === "staging") {
  // Reuse the native RPC tests with isolated, fully populated staging tenants.
  const a = "b6111600-0000-4000-8000-000000000001", b = "b6111600-0000-4000-8000-000000000002";
  const user = "a6111600-0000-4000-8000-000000000001";
  let sql = tests.replaceAll("00000000-0000-0000-0000-000000000001", a).replaceAll("00000000-0000-0000-0000-000000000002", b);
  sql = sql.replace(/insert into public.homecare_tenants values[^;]+;/, `insert into auth.users(id,email,email_confirmed_at) values('${user}','customer-conditions@example.invalid',now());
    select public.homecare_onboard_company('c6111600-0000-4000-8000-000000000001','${user}','${user}','customer-conditions@example.invalid','{"name":"Condition staging","country":"SE","locale":"de","timezone":"Europe/Stockholm","accountType":"production","approved":true}',array['jobs']);
    insert into public.homecare_tenants(id,slug,name) values('${a}','condition-staging-a','Condition A'),('${b}','condition-staging-b','Condition B');
    insert into public.homecare_roles(id,tenant_id,key,name,permissions) values('d6111600-0000-4000-8000-000000000001','${a}','condition_test','Condition test',array['data.read']);
    insert into public.homecare_tenant_memberships(tenant_id,user_id,role_id,status) values('${a}','${user}','d6111600-0000-4000-8000-000000000001','active');`);
  sql = sql.replace("homecare_customers(id,tenant_id) values", "homecare_customers(id,tenant_id,name) values").replace(`('C1','${a}'),('C2','${b}')`, `('C1','${a}','Customer A'),('C2','${b}','Customer B')`);
  sql = sql.replace("homecare_services(id,tenant_id) values", "homecare_services(id,tenant_id,name) values").replace(`('S1','${a}'),('S2','${b}')`, `('S1','${a}','Service A'),('S2','${b}','Service B')`);
  const tail = sql.indexOf("set local test.tenant="); assert(tail > 0);
  sql = sql.slice(0, tail) + `
    insert into public.homecare_customer_service_conditions(id,tenant_id,customer_id,service_id) values('CSC-RLS','${a}','C1','S1');
    select set_config('request.jwt.claim.sub','${user}',true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.headers','{"x-workcore-tenant":"${a}"}',true);
    set local role authenticated;
    do $$ begin if (select count(*) from public.homecare_customer_service_conditions)<>2 then raise exception 'OWN_TENANT_READ_FAILED';end if; end $$;
    select set_config('request.headers','{"x-workcore-tenant":"${b}"}',true);
    do $$ begin if exists(select 1 from public.homecare_customer_service_conditions) then raise exception 'CROSS_TENANT_READ';end if; end $$;
    reset role; rollback;`;
  save("staging-tests.sql", sql);
  const before = (await query(fingerprint))[0].value;
  await query(sql);
  assert.deepEqual((await query(fingerprint))[0].value, before, "Staging test rollback failed");
  sqlRlsTestsPassed = true;
}
const security = (await query(`select
  (select relrowsecurity from pg_class where oid='public.homecare_customer_service_conditions'::regclass) as rls,
  not has_table_privilege('anon','public.homecare_customer_service_conditions','select,insert,update,delete') as anon_blocked,
  not has_table_privilege('authenticated','public.homecare_customer_service_conditions','insert,update,delete') as client_writes_blocked,
  not has_function_privilege('anon','public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint)','execute') and not has_function_privilege('authenticated','public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint)','execute') as rpc_clients_blocked,
  has_function_privilege('service_role','public.homecare_apply_customer_service_condition(uuid,text,text,text,text,uuid,jsonb,bigint)','execute') as rpc_server_allowed,
  'homecare_customer_service_conditions'=any(public.homecare_relational_backup_tables()) as backup_registered,
  exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as registered`))[0];
assert(Object.values(security).every(Boolean), "Security verification failed");
const afterAdvisor = await advisor(); save("advisors-after.json", afterAdvisor);
assert(!counts(afterAdvisor).ERROR, "New security error");
const key = item => JSON.stringify([item.name, item.metadata]);
const old = new Set(beforeAdvisor.filter(row => row.level === "WARN").map(key));
assert(!afterAdvisor.some(row => row.level === "WARN" && !old.has(key(row))), "New security warning requires review");
const proof = { project, migrationDigest: digest(source), testDigest: digest(tests), recordsUnchanged: true, sqlRlsTestsPassed, verifiedBackups: backups.length, security, afterCounts: counts(afterAdvisor), capturedAt: new Date().toISOString() };
save("verification.json", proof); console.log(JSON.stringify({ directory, ...proof }));
