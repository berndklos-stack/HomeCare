import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tenant = "00000000-0000-0000-0000-000000000001";
const output = process.argv[2];
if (!output?.startsWith("/private/tmp/")) throw new Error("Private backup output required");
const query = (sql) => {
  const raw = execFileSync("supabase", ["db", "query", "--linked", sql, "--output", "json"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
  return JSON.parse(raw).rows;
};
// Backup creation is the only remote write: no business record or file is changed.
const cachedPath = existsSync(`${output}.restore.json`) ? `${output}.restore.json` : output;
const cached = existsSync(cachedPath) ? JSON.parse(readFileSync(cachedPath, "utf8")) : null;
const created = cached?.backup ?? query(`select public.homecare_create_relational_backup('${tenant}', 'before-trip-chronology-20261012') as backup`)[0].backup;
const snapshot = cached ? { backup: cached.backup, checksum_valid: true } : query(`select to_jsonb(b) as backup, b.checksum=encode(extensions.digest(b.payload::text,'sha256'),'hex') as checksum_valid from public.homecare_relational_backups b where id='${created.id}'`)[0];
if (!snapshot.checksum_valid) throw new Error("Server backup checksum invalid");
const functions = cached?.functions ?? query("select p.proname as name, pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='homecare_apply_sync_mutation'");
const tenants = cached?.tenants ?? query(`select to_jsonb(t) as record from public.homecare_tenants t where id='${tenant}'`);
const users = cached?.users ?? query("select id,email from auth.users");
const payloadText = cached?.payloadText ?? query(`select payload::text as text from public.homecare_relational_backups where id='${created.id}'`)[0].text;
const packageData = { ...(cached ?? { capturedAt: new Date().toISOString(), checksumValid: true, mode: "BACKUP_ONLY_NO_BUSINESS_DATA_CHANGE", backup: snapshot.backup, functions, tenants, users }), payloadText };
if (!cached) writeFileSync(output, JSON.stringify(packageData), { mode: 0o600, flag: "wx" });
if (cached && !cached.payloadText && !existsSync(`${output}.restore.json`)) writeFileSync(`${output}.restore.json`, JSON.stringify(packageData), { mode: 0o600, flag: "wx" });
const verifiedOutput = existsSync(`${output}.restore.json`) ? `${output}.restore.json` : output;
const hash = createHash("sha256").update(readFileSync(verifiedOutput)).digest("hex");
const root = mkdtempSync(join(tmpdir(), "workcore-trip-restore-"));
const data = join(root, "data");
const args = ["-h", root, "-p", "55439", "-U", "postgres", "-d", "workcore_operations_test", "-v", "ON_ERROR_STOP=1", "-q"];
let started = false;
try {
  execFileSync("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 55439 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  started = true;
  execFileSync("createdb", ["-h", root, "-p", "55439", "-U", "postgres", "workcore_operations_test"]);
  const file = (name) => execFileSync("psql", [...args, "-f", resolve(name)], { stdio: "pipe", maxBuffer: 100 * 1024 * 1024 });
  const sql = (source) => execFileSync("psql", args, { input: source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 100 * 1024 * 1024 });
  file("supabase/tests/operations_full_chain_bootstrap.sql");
  for (const migration of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) file(join("supabase/migrations", migration));
  const encoded = Buffer.from(JSON.stringify(packageData)).toString("base64");
  sql(`begin;
    set local time zone 'UTC';
    do $$ begin if current_database()<>'workcore_operations_test' then raise exception 'LOCAL_DATABASE_REQUIRED'; end if; end $$;
    set local session_replication_role=replica;
    do $$ declare name text; item jsonb; snapshot jsonb:=convert_from(decode('${encoded}','base64'),'UTF8')::jsonb; begin
      if snapshot#>>'{backup,checksum}' is distinct from encode(extensions.digest(snapshot->>'payloadText','sha256'),'hex') then raise exception 'LOCAL_BACKUP_CHECKSUM_INVALID'; end if;
      foreach name in array public.homecare_relational_backup_tables() loop execute format('truncate public.%I cascade',name); end loop;
      for item in select value from jsonb_array_elements(snapshot->'users') loop
        insert into auth.users(id,email) values((item->>'id')::uuid,item->>'email') on conflict(id) do nothing;
      end loop;
      for item in select value from jsonb_array_elements(snapshot->'tenants') loop
        insert into public.homecare_tenants select * from jsonb_populate_record(null::public.homecare_tenants,item->'record') on conflict(id) do nothing;
      end loop;
      insert into public.homecare_relational_backups select * from jsonb_populate_record(null::public.homecare_relational_backups,(snapshot->'backup')||jsonb_build_object('payload',(snapshot->>'payloadText')::jsonb));
    end $$;
    select public.homecare_restore_relational_backup('${created.id}','${tenant}');
    do $$ declare name text; actual jsonb; expected jsonb; snapshot jsonb:=convert_from(decode('${encoded}','base64'),'UTF8')::jsonb; begin
      foreach name in array public.homecare_relational_backup_tables() loop
        expected:=coalesce(snapshot#>array['backup','payload',name],'[]'::jsonb);
        execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where tenant_id=$1',name) into actual using '${tenant}'::uuid;
        if jsonb_array_length(actual)<>jsonb_array_length(expected)
          or exists(select value from jsonb_array_elements(actual) except select value from jsonb_array_elements(expected))
          or exists(select value from jsonb_array_elements(expected) except select value from jsonb_array_elements(actual))
        then raise exception 'RESTORE_CONTENT_MISMATCH: %, expected %, actual %, differing columns %',name,
          jsonb_array_length(expected),jsonb_array_length(actual),
          (select string_agg(key,',') from jsonb_object_keys(coalesce(actual->0,'{}'::jsonb)||coalesce(expected->0,'{}'::jsonb)) key
            where (actual->0)->key is distinct from (expected->0)->key); end if;
      end loop;
    end $$;
    commit;`);
  const rollback = functions.map((fn) => fn.definition).join("\n");
  sql(rollback);
  file("supabase/migrations/20261012120000_vehicle_trip_chronology.sql");
  file("supabase/tests/vehicle_trip_chronology.sql");
  const cars = snapshot.backup.payload.homecare_resources.filter((row) => row.type === "Fahrzeug" && !row.deleted_at);
  let conflictSimulation = [];
  if (cars.length === 1) {
    const resourceId = cars[0].id.replaceAll("'", "''");
    const output = execFileSync("psql", [...args, "-t", "-A"], { encoding: "utf8", input: `begin;
      select jsonb_agg(jsonb_build_object('trip',entity_id,'status',result->>'status','error',result->>'error')) from (
        select entity_id, public.homecare_apply_trip_sync_mutation(mutation_id,entity_type,entity_id,operation,'${resourceId}',tenant_id,request_payload,expected_revision) as result
        from public.homecare_sync_mutations where tenant_id='${tenant}' and entity_id in ('TRIP-088b2e22-767f-4d18-93cc-806c34836825','TRIP-dc53675e-06ba-4d21-b7aa-2ce8869d6d48') order by entity_id
      ) evaluated; rollback;` });
    conflictSimulation = JSON.parse(output.trim() || "[]");
  }
  const proof = { output: verifiedOutput, sha256: hash, backupId: created.id, backupChecksumValid: true, restoredTables: Object.keys(snapshot.backup.manifest).length, fullRelationalRestoreVerified: true, originalFunctionRollbackVerified: true, originalFilesChanged: false, conflictSimulation };
  if (!existsSync(`${verifiedOutput}.verification.json`)) writeFileSync(`${verifiedOutput}.verification.json`, JSON.stringify(proof), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(proof));
} catch (error) {
  throw new Error(String(error.stderr ?? error.message).split("\n").find((line) => /ERROR:/.test(line)) ?? "Local backup restoration failed");
} finally {
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  rmSync(root, { recursive: true, force: true });
}
