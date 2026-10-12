import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const backupPath = process.argv[2];
if (!backupPath?.startsWith("/private/tmp/") || !process.argv.includes("--apply")) throw new Error("Verified private backup and explicit --apply required");
const bytes = readFileSync(backupPath);
const snapshot = JSON.parse(bytes);
const proof = JSON.parse(readFileSync(`${backupPath}.verification.json`, "utf8"));
if (!proof.fullRelationalRestoreVerified || !proof.originalFunctionRollbackVerified
  || proof.sha256 !== createHash("sha256").update(bytes).digest("hex") || proof.backupId !== snapshot.backup.id) throw new Error("Backup verification mismatch");
const projects = JSON.parse(execFileSync("supabase", ["projects", "list", "--output", "json"], { encoding: "utf8" }));
if (!projects.some((project) => project.linked && project.id === "ruzsmxzxeqqcbeycfoma")) throw new Error("Unexpected linked project");
const missingTime = process.argv.includes("--missing-time");
if (missingTime && !["homecare_apply_sync_mutation", "homecare_apply_trip_sync_mutation", "homecare_trip_neighbor_error"].every((name) => snapshot.functions.some((fn) => fn.name === name))) throw new Error("All replaced functions must be backed up");
const migrations = (missingTime ? ["20261012210000_trip_missing_time_order.sql"] : ["20261012120000_vehicle_trip_chronology.sql", "20261012190000_trip_validation_recheck.sql"]).map((name) => {
  let sql = readFileSync(`supabase/migrations/${name}`, "utf8");
  if (/^(?:--[^\n]*\n)*begin;\n/.test(sql) && /commit;\s*$/.test(sql)) {
    sql = sql.replace(/^(?:--[^\n]*\n)*begin;\n/, "").replace(/commit;\s*$/, "");
  }
  return { name, sql, encoded: Buffer.from(sql).toString("base64") };
});
const original = Buffer.from(snapshot.functions.find((fn) => fn.name === "homecare_apply_sync_mutation").definition).toString("base64");
const signatures = {
  homecare_apply_trip_sync_mutation: "uuid,text,text,text,text,uuid,jsonb,bigint",
  homecare_trip_neighbor_error: "uuid,text,text,date,timestamptz,numeric,numeric",
};
const additionalGuards = missingTime ? Object.entries(signatures).map(([name, signature]) => {
  const encoded = Buffer.from(snapshot.functions.find((fn) => fn.name === name).definition).toString("base64");
  return `if md5(pg_get_functiondef('public.${name}(${signature})'::regprocedure))<>md5(convert_from(decode('${encoded}','base64'),'UTF8')) then raise exception 'FUNCTION_CHANGED_SINCE_BACKUP'; end if;`;
}).join("\n") : "";
const root = mkdtempSync(join(tmpdir(), "workcore-verified-trip-migration-"));
try {
  const file = join(root, "apply.sql");
  writeFileSync(file, `begin;
    set local lock_timeout='10s';
    do $$ declare before_hash text; after_hash text; begin
      if not exists(select 1 from public.homecare_relational_backups where id='${proof.backupId}' and checksum=encode(extensions.digest(payload::text,'sha256'),'hex')) then raise exception 'VERIFIED_BACKUP_NOT_AVAILABLE'; end if;
      if md5(pg_get_functiondef('public.homecare_apply_sync_mutation(uuid,text,text,text,text,uuid,jsonb,bigint)'::regprocedure))<>md5(convert_from(decode('${original}','base64'),'UTF8')) then raise exception 'FUNCTION_CHANGED_SINCE_BACKUP'; end if;
      select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) into before_hash from public.homecare_vehicle_trips t;
      ${additionalGuards}
      ${migrations.map((migration) => `if exists(select 1 from supabase_migrations.schema_migrations where version='${migration.name.split("_")[0]}') then raise exception 'MIGRATION_ALREADY_APPLIED'; end if;
        execute convert_from(decode('${migration.encoded}','base64'),'UTF8');
        insert into supabase_migrations.schema_migrations(version,name,statements) values('${migration.name.split("_")[0]}','${migration.name.replace(/^\d+_|\.sql$/g, "")}',array[convert_from(decode('${migration.encoded}','base64'),'UTF8')]);`).join("\n")}
      select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) into after_hash from public.homecare_vehicle_trips t;
      if before_hash is distinct from after_hash then raise exception 'EXISTING_TRIPS_CHANGED'; end if;
    end $$;
    notify pgrst,'reload schema';
    commit;
    select true as migrations_applied, true as existing_trips_unchanged;`, { mode: 0o600 });
  const result = execFileSync("supabase", ["db", "query", "--linked", "--file", file, "--output", "json"], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  console.log(result);
} finally {
  rmSync(root, { recursive: true, force: true });
}
