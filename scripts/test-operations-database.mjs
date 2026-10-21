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
    const through = process.argv.find(argument => argument.startsWith("--through="))?.slice("--through=".length);
    if (through && !/^\d{14}$/.test(through)) throw new Error("INVALID_MIGRATION_CUTOFF");
    sql("supabase/tests/operations_full_chain_bootstrap.sql");
    for (const migration of readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql") && (!through || file.slice(0, 14) <= through)).sort()) {
      if (migration === "20261008100000_resource_types.sql") sql("supabase/tests/resource_types_migration_fixture.sql");
      if (migration === "20261011070000_master_data_columns.sql") sql("supabase/tests/master_data_columns_fixture.sql");
      if (migration === "20261015200000_company_logo.sql") sql("supabase/tests/company_logo_migration_fixture.sql");
      console.log(`Applying ${migration}`);
      execFileSync("psql", [...args, "-q", "-f", resolve("supabase/migrations", migration)], { stdio: "inherit" });
      if (migration === "20261011070000_master_data_columns.sql") sql("supabase/tests/master_data_columns_backfill.sql");
      if (migration === "20261015200000_company_logo.sql") sql("supabase/tests/company_logo_backfill.sql");
    }
    sql("supabase/tests/company_administration.sql");
    sql("supabase/tests/company_logo.sql");
    if (!through || through >= "20261020150000") sql("supabase/tests/platform_company_editor.sql");
    sql("supabase/tests/operations_full_chain.sql");
    sql("supabase/tests/job_stock_billing.sql");
    sql("supabase/tests/scan_target_projections.sql");
    sql("supabase/tests/picking_codes.sql");
    sql("supabase/tests/damage_complaint.sql");
    sql("supabase/tests/purchase_order_emails.sql");
    sql("supabase/tests/archive_location_types.sql");
    sql("supabase/tests/field_material_review.sql");
    sql("supabase/tests/vehicle_trip_chronology.sql");
    sql("supabase/tests/trip_validation_recheck.sql");
    sql("supabase/tests/trip_missing_time_order.sql");
    sql("supabase/tests/master_data_columns.sql");
    sql("supabase/migrations/20261008100000_resource_types.sql");
    sql("supabase/tests/resource_types.sql");
    sql("supabase/tests/resource_field_catalog_rls.sql");
    sql("supabase/migrations/20261014100000_resource_field_catalog_rls.sql");
    sql("supabase/tests/resource_field_catalog_rls.sql");
    sql("supabase/tests/security_advisor_hardening.sql");
    sql("supabase/migrations/20261014110000_security_advisor_function_hardening.sql");
    sql("supabase/migrations/20261014120000_resource_foreign_keys_and_indexes.sql");
    sql("supabase/tests/security_advisor_hardening.sql");
    sql("supabase/tests/standard_trip_distances.sql");
    sql("supabase/migrations/20261014130000_standard_trip_distances.sql");
    sql("supabase/tests/standard_trip_distances.sql");
    sql("supabase/migrations/20261014140000_personal_layout_preferences.sql");
    sql("supabase/tests/personal_layout_preferences.sql");
    sql("supabase/migrations/20261014140000_personal_layout_preferences.sql");
    sql("supabase/tests/personal_layout_preferences.sql");
    sql("supabase/migrations/20261014150000_personal_block_layouts.sql");
    sql("supabase/tests/personal_block_layouts.sql");
    sql("supabase/migrations/20261014150000_personal_block_layouts.sql");
    sql("supabase/tests/personal_block_layouts.sql");
    console.log(`Migration chain${through ? ` through ${through}` : " (complete)"} and Operations backup round trip passed (local Auth shim, not live Supabase).`);
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
  sql("supabase/migrations/20261008230000_purchase_receipt_batch.sql");
  sql("supabase/migrations/20261008230000_purchase_receipt_batch.sql");
  sql("supabase/tests/purchase_receipt_batch.sql");
  sql("supabase/tests/operations_commands.sql");
  sql("supabase/tests/operations_inventory_cutover.sql");
  sql("supabase/tests/operations_backup.sql");
  sql("supabase/migrations/20261010130000_stock_inventory.sql");
  sql("supabase/migrations/20261010130000_stock_inventory.sql");
  sql("supabase/tests/stock_inventory.sql");
  sql("supabase/migrations/20261010180000_inventory_plans.sql");
  sql("supabase/migrations/20261010180000_inventory_plans.sql");
  sql("supabase/tests/inventory_plans.sql");
  console.log("Operations SQL tests passed (isolated cluster, migration applied twice).");
  }
} finally {
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
  rmSync(root, { recursive: true, force: true });
}
