import { createClient } from "@supabase/supabase-js";
import { appendFileSync, chmodSync, readFileSync, writeFileSync } from "node:fs";

const defaultTables = [
  "homecare_tenants",
  "homecare_customers",
  "homecare_objects",
  "homecare_media",
  "homecare_personnel",
  "homecare_services",
  "homecare_service_packages",
  "homecare_jobs",
  "homecare_field_progress",
  "homecare_reports",
  "homecare_billing_items",
  "homecare_accounting_accounts",
  "homecare_inventory_locations",
  "homecare_materials",
  "homecare_inventory_movements",
  "homecare_resources",
  "homecare_vehicle_trips",
  "homecare_vehicle_positions",
  "homecare_portal_messages",
  "homecare_translations",
  "homecare_settings",
  "homecare_user_profiles",
  "homecare_user_invitations",
  "homecare_subscription_plans",
  "homecare_plan_modules",
  "homecare_tenant_modules",
  "homecare_subscriptions",
  "homecare_audit_log",
  "homecare_driving_log_regulations",
  "homecare_trip_audit_log",
  "homecare_odometer_history",
  "app_state",
];

function environment() {
  const values = { ...process.env };
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !values[match[1].trim()]) {
      values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL/service role key missing.");
  }
  return values;
}

async function exportTable(client, table, output) {
  const pageSize = table === "app_state" ? 25 : 500;
  let count = 0;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data?.length) {
      appendFileSync(output, `${insertStatements(table, data).join("\n")}\n`);
      count += data.length;
    }
    if (!data || data.length < pageSize) return count;
  }
}

function insertStatements(table, rows) {
  const statements = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    const encoded = Buffer.from(JSON.stringify(rows.slice(offset, offset + 100))).toString("base64");
    statements.push(
      `insert into public."${table}" select * from jsonb_populate_recordset(null::public."${table}", convert_from(decode('${encoded}','base64'),'UTF8')::jsonb);`,
    );
  }
  return statements;
}

async function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  if (!outputArg) throw new Error("Use --output=/private/path.sql");
  const output = outputArg.slice("--output=".length);
  const env = environment();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const header = [
    "begin;",
    "set local session_replication_role = replica;",
    `truncate table ${defaultTables.map((table) => `public."${table}"`).join(", ")} restart identity cascade;`,
    "",
  ];
  writeFileSync(output, header.join("\n"), { mode: 0o600 });
  chmodSync(output, 0o600);
  const counts = {};
  for (const table of defaultTables) counts[table] = await exportTable(client, table, output);
  appendFileSync(output, "commit;\n");
  console.log(JSON.stringify({
    output,
    projectRef: new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0],
    rows: counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
