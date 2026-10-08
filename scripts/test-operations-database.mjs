import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Never read .env.local or a DATABASE_URL. This owns a disposable local cluster.
const root = mkdtempSync(join(tmpdir(), "workcore-operations-test-"));
const data = join(root, "data");
const args = ["-h", root, "-p", "55437", "-U", "postgres", "-d", "workcore_operations_test", "-v", "ON_ERROR_STOP=1"];
let started = false;
try {
  execFileSync("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 55437 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  started = true;
  execFileSync("createdb", ["-h", root, "-p", "55437", "-U", "postgres", "workcore_operations_test"]);
  const sql = (file) => execFileSync("psql", [...args, "-f", resolve(file)], { stdio: "inherit" });
  if (process.argv.includes("--full-chain")) {
    sql("supabase/tests/operations_full_chain_bootstrap.sql");
    for (const migration of readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort()) {
      if (migration === "20261008100000_resource_types.sql") sql("supabase/tests/resource_types_migration_fixture.sql");
      console.log(`Applying ${migration}`);
      execFileSync("psql", [...args, "-q", "-f", resolve("supabase/migrations", migration)], { stdio: "inherit" });
    }
    sql("supabase/tests/operations_full_chain.sql");
    sql("supabase/migrations/20261008100000_resource_types.sql");
    sql("supabase/tests/resource_types.sql");
    console.log("Complete migration chain and Operations backup round trip passed (local Auth shim, not live Supabase).");
  } else {
  sql("supabase/tests/operations_foundation_fixture.sql");
  sql("supabase/migrations/20261007230000_operations_foundation.sql");
  sql("supabase/migrations/20261007230000_operations_foundation.sql");
  sql("supabase/migrations/20261008000000_operations_commands.sql");
  sql("supabase/migrations/20261008020000_operations_backup.sql");
  sql("supabase/migrations/20261008020000_operations_backup.sql");
  sql("supabase/migrations/20261008010000_operations_inventory_cutover.sql");
  sql("supabase/migrations/20261008010000_operations_inventory_cutover.sql");
  sql("supabase/migrations/20261008000000_operations_commands.sql");
  sql("supabase/tests/operations_foundation.sql");
  sql("supabase/tests/operations_commands.sql");
  sql("supabase/tests/operations_inventory_cutover.sql");
  sql("supabase/tests/operations_backup.sql");
  console.log("Operations SQL tests passed (isolated cluster, migration applied twice).");
  }
} finally {
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  rmSync(root, { recursive: true, force: true });
}
