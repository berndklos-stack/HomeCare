import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = mkdtempSync("/private/tmp/workcore-customer-condition-db-");
const data = join(root, "data"), port = "55449";
let started = false;
try {
  execFileSync("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p ${port} -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  started = true;
  for (const file of ["supabase/tests/customer_service_conditions_fixture.sql", "supabase/migrations/20261116120000_customer_service_conditions.sql", "supabase/tests/customer_service_conditions.sql"]) {
    execFileSync("psql", ["-h", root, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", resolve(file)], { stdio: "inherit" });
  }
  console.log("Kundenkonditionen: Migration, Revisionen, Mandantentrennung und Berechtigungen lokal geprueft.");
} finally {
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  rmSync(root, { recursive: true, force: true });
}
