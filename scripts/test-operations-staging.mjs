import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const project = "ealfegjvbyiiporettpq";
const base = "http://127.0.0.1:3102";
const migrations = ["20261007230000_operations_foundation.sql", "20261008000000_operations_commands.sql",
  "20261008010000_operations_inventory_cutover.sql", "20261008020000_operations_backup.sql"];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const identifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
function linked() {
  assert.equal(readFileSync("supabase/.temp/project-ref", "utf8").trim(), project, "Only WorkCore Staging is allowed");
}
function cli(args) {
  linked();
  try {
    return JSON.parse(execFileSync("supabase", [...args, "--output", "json"], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) {
    throw new Error("Staging CLI failed: " + String(error.stderr ?? "No diagnostic available").slice(-1800));
  }
}
function sql(query) { return cli(["db", "query", "--linked", query]).rows; }
function check(result) { if (result.error) throw new Error(result.error.message); return result.data; }
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  linked();
  const projects = cli(["projects", "list"]);
  assert(projects.some((p) => p.id === project && p.name === "WorkCore Staging" && p.status === "ACTIVE_HEALTHY"));
  const directory = mkdtempSync(join(tmpdir(), "workcore-operations-staging-"));
  chmodSync(directory, 0o700);
  const columns = sql("select table_name, column_name from information_schema.columns where table_schema='public' and table_name like 'homecare_%' order by table_name,ordinal_position");
  const tables = new Map();
  for (const row of columns) tables.set(row.table_name, [...(tables.get(row.table_name) ?? []), row.column_name]);
  const snapshotQuery = () => "select jsonb_object_agg(key,value) as snapshot from (values " + [...tables].map(([table, fields]) =>
    `(${quote(table)},(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb) from (select ${fields.map(identifier).join(",")} from public.${identifier(table)}) r))`).join(",") + ") data(key,value)";
  const before = sql(snapshotQuery())[0].snapshot;
  const functions = sql("select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'");
  writeFileSync(join(directory, "before.json"), JSON.stringify({ project, columns, functions, rows: before }), { mode: 0o600 });
  console.log("Protected pre-migration logical snapshot saved:", directory);
  const applyMigrations = process.argv.includes("--apply-migrations");
  if (!applyMigrations && !process.argv.includes("--verify-only")) throw new Error("Use --apply-migrations or --verify-only for WorkCore Staging");
  if (!applyMigrations) {
    const installed = sql("select version from supabase_migrations.schema_migrations").map((row) => row.version);
    assert(migrations.every((name) => installed.includes(name.split("_")[0])), "Operations migrations must already be installed");
  }
  for (let pass = 0; applyMigrations && pass < 2; pass++) {
    for (const name of migrations) {
      cli(["db", "query", "--linked", "--file", join("supabase/migrations", name)]);
      if (!pass) sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(name.split("_")[0])},${quote(name.slice(15, -4))},array[]::text[]) on conflict(version) do nothing`);
    }
  }
  assert.deepEqual(sql(snapshotQuery())[0].snapshot, before, "Migrations changed existing staging records");
  sql("notify pgrst,'reload schema'");
  console.log(`PASS: four migrations ${applyMigrations ? "applied twice" : "verified installed"}; all pre-existing staging records unchanged`);

  const rawKeys = cli(["projects", "api-keys", "--project-ref", project]);
  const keys = Array.isArray(rawKeys) ? rawKeys : rawKeys.api_keys;
  const anon = keys.find((key) => key.name === "anon")?.api_key;
  const service = keys.find((key) => key.name === "service_role")?.api_key;
  assert(anon && service, "Staging API keys unavailable");
  const url = `https://${project}.supabase.co`;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const tenants = [randomUUID(), randomUUID()];
  const users = [];
  let server;
  let path;
  try {
    for (let i = 0; i < 2; i++) {
      check(await admin.from("homecare_tenants").insert({ id: tenants[i], slug: `operations-test-${tenants[i]}`, name: "Operations synthetic staging test" }));
      const password = "Wc!9-" + randomUUID();
      const email = `operations-${randomUUID()}@example.invalid`;
      const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
      users.push(created.user.id);
      const role = randomUUID();
      check(await admin.from("homecare_roles").insert({ id: role, tenant_id: tenants[i], key: "operations-test", name: "Operations test",
        permissions: ["data.read", "data.write", "resources.manage", "media.manage", "sync.write", "backups.manage"] }));
      check(await admin.from("homecare_tenant_memberships").insert({ tenant_id: tenants[i], user_id: created.user.id, role_id: role }));
      const user = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { "X-WorkCore-Tenant": tenants[i] } } });
      const session = check(await user.auth.signInWithPassword({ email, password }));
      users[i] = { id: created.user.id, role, client: user, token: session.session.access_token };
    }
    server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3102"], {
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
        NEXT_PUBLIC_DISABLE_SUPABASE_SYNC: "0", NEXT_PUBLIC_E2E_AUTH_BYPASS: "0", WORKCORE_E2E_AUTH_BYPASS: "0",
        RESEND_API_KEY: "", CRON_SECRET: "", VERCEL_OIDC_TOKEN: "" }, stdio: "ignore", detached: true,
    });
    for (let i = 0; i < 90; i++) {
      if (server.exitCode != null) throw new Error("Isolated staging app exited before startup");
      try { if ((await fetch(`${base}/api/version`)).ok) break; } catch { /* Startup is asynchronous. */ }
      if (i === 89) throw new Error("Isolated staging app startup timed out");
      await delay(1000);
    }
    async function request(route, body, userIndex = 0, tenant = tenants[userIndex]) {
      return fetch(base + route, { method: body === undefined ? "GET" : "POST", headers: {
        Authorization: `Bearer ${users[userIndex].token}`, "X-WorkCore-Tenant": tenant,
        ...(body instanceof FormData || body === undefined ? {} : { "Content-Type": "application/json" }),
      }, body: body instanceof FormData || body === undefined ? body : JSON.stringify(body) });
    }
    async function mutation(entityId, payload, expectedRevision, operation = expectedRevision == null ? "create" : "update") {
      const now = new Date().toISOString();
      const command = { id: randomUUID(), entityId, resourceId: entityId, entityType: "operations", payload, operation,
        expectedRevision, createdAt: now, updatedAt: now, attempts: 0, status: "pending" };
      const response = await request("/api/sync-mutations", command);
      const result = await response.json();
      assert.equal(response.status, result.status === "conflict" ? 409 : 200, JSON.stringify(result));
      return { command, result };
    }
    assert.equal((await fetch(base + "/api/operations?entity=suppliers")).status, 401);
    assert.equal((await request("/api/operations?entity=suppliers", undefined, 0, tenants[1])).status, 403);
    const supplier = randomUUID();
    const saved = await mutation(supplier, { kind: "save", entity: "suppliers", values: { supplier_number: "OPS-1", company: "Operations test supplier" } });
    assert.equal(saved.result.status, "synced");
    assert.equal(saved.result.record.revision, 1);
    const retry = await request("/api/sync-mutations", saved.command);
    assert.deepEqual(await retry.json(), saved.result);
    const updated = await mutation(supplier, { kind: "save", entity: "suppliers", values: { company: "Updated test supplier" } }, 1);
    assert.equal(updated.result.record.revision, 2);
    const stale = await mutation(supplier, { kind: "save", entity: "suppliers", values: { company: "Must not overwrite" } }, 1);
    assert.equal(stale.result.status, "conflict");
    const foreign = await request("/api/operations?entity=suppliers&id=" + supplier, undefined, 1);
    assert.equal(foreign.status, 200);
    assert.equal((await foreign.json()).rows.length, 0);
    assert.equal(check(await users[1].client.from("homecare_suppliers").select("id").eq("id", supplier)).length, 0);
    const deniedRpc = await users[0].client.rpc("homecare_apply_operations_mutation", {
      p_mutation_id: randomUUID(), p_entity_type: "operations", p_entity_id: supplier, p_operation: "update", p_resource_id: supplier,
      p_tenant_id: tenants[0], p_payload: { kind: "save", entity: "suppliers", values: { company: "Denied direct write" } },
      p_expected_revision: 2, p_actor_id: users[0].id,
    });
    assert.equal(deniedRpc.error?.code, "42501");
    console.log("PASS: real GoTrue login, authenticated app commands, PostgREST RLS, retries and revision conflicts");

    const material = "MAT-" + randomUUID(), location = "LOC-" + randomUUID(), resource = "RES-" + randomUUID();
    check(await admin.from("homecare_materials").insert({ tenant_id: tenants[0], id: material, name: "Test material", purchase_price: 5 }));
    check(await admin.from("homecare_inventory_locations").insert({ tenant_id: tenants[0], id: location, name: "Test warehouse" }));
    check(await admin.from("homecare_resources").insert({ tenant_id: tenants[0], id: resource, name: "Test tool", type: "Sonstiges" }));
    check(await admin.rpc("homecare_import_legacy_stock", { p_tenant: tenants[0] }));
    const stock = await mutation(randomUUID(), { kind: "stock", material_id: material, source_id: null, destination_id: location, quantity: 5, note: "Synthetic receipt" });
    assert.equal(stock.result.status, "synced");
    assert.equal(stock.result.record.material_record.stockTotal, 5);
    const stockRetry = await request("/api/sync-mutations", stock.command);
    assert.deepEqual(await stockRetry.json(), stock.result);
    const balances = await request("/api/operations?entity=stock_balances&parent=" + material);
    assert.equal((await balances.json()).rows[0].quantity, 5);
    console.log("PASS: tenant-isolated stock activation and repeat-safe real stock booking");
    const sameNameLocation = "LOC-" + randomUUID(), specialNameLocation = "LOC-" + randomUUID();
    check(await admin.from("homecare_inventory_locations").insert([
      { tenant_id: tenants[0], id: sameNameLocation, name: "Test warehouse" },
      { tenant_id: tenants[0], id: specialNameLocation, name: "__proto__" },
    ]));
    assert.equal((await mutation(randomUUID(), { kind: "stock", material_id: material, source_id: location, destination_id: sameNameLocation, quantity: 2, note: "Synthetic transfer" })).result.status, "synced");
    assert.equal((await mutation(randomUUID(), { kind: "stock", material_id: material, source_id: location, destination_id: specialNameLocation, quantity: 1, note: "Special location name" })).result.status, "synced");
    const reloaded = await request("/api/sync-sections?keys=materials");
    assert.equal(reloaded.status, 200);
    const reloadedMaterial = (await reloaded.json()).data.materials.value.find((row) => row.id === material);
    assert.equal(reloadedMaterial.stockTotal, 5);
    assert.equal(reloadedMaterial.stockByLocation["Test warehouse"], 4);
    assert.equal(reloadedMaterial.stockByLocation.__proto__, 1);
    console.log("PASS: reloaded stock sums duplicate location labels and preserves special property names");

    const order = randomUUID(), item = randomUUID();
    assert.equal((await mutation(order, { kind: "save", entity: "purchase_orders", values: {
      order_number: "OPS-PO-1", supplier_id: supplier, location_id: location, order_date: "2026-10-08", currency: "SEK",
    } })).result.status, "synced");
    assert.equal((await mutation(item, { kind: "save", entity: "purchase_order_items", values: {
      order_id: order, material_id: material, quantity: 5, unit_price: 5,
    } })).result.status, "synced");
    const orderState = await request("/api/operations?entity=purchase_orders&id=" + order);
    const orderRevision = (await orderState.json()).rows[0].revision;
    const ordered = await mutation(order, { kind: "order" }, orderRevision);
    assert.equal(ordered.result.record.status, "ordered");
    const partial = await mutation(order, { kind: "receive", item_id: item, quantity: 2, note: "First partial receipt" }, ordered.result.record.revision);
    assert.equal(partial.result.record.status, "partially_received");
    assert.equal(partial.result.record.material_record.stockTotal, 7);
    assert.deepEqual(await (await request("/api/sync-mutations", partial.command)).json(), partial.result);
    const received = await mutation(order, { kind: "receive", item_id: item, quantity: 3, note: "Final partial receipt" }, partial.result.record.revision);
    assert.equal(received.result.record.status, "received");
    assert.equal(received.result.record.material_record.stockTotal, 10);
    const receipts = await request("/api/operations?entity=purchase_receipts&parent=" + item);
    assert.equal((await receipts.json()).rows.length, 2);
    const foreignReceipts = await request("/api/operations?entity=purchase_receipts&parent=" + item, undefined, 1);
    assert.equal(foreignReceipts.status, 200);
    assert.equal((await foreignReceipts.json()).rows.length, 0);
    console.log("PASS: real purchase order, two partial receipts and repeat-safe stock integration");

    const media = "MEDIA-" + randomUUID();
    const form = new FormData();
    form.set("file", new Blob(["%PDF-1.4\nOperations staging test\n%%EOF"], { type: "application/pdf" }), "inspection.pdf");
    form.set("scope", "resource-documents"); form.set("mediaId", media);
    const uploaded = await request("/api/media", form);
    assert.equal(uploaded.status, 200, await uploaded.clone().text());
    const document = await uploaded.json(); path = document.path;
    assert(path.startsWith(tenants[0] + "/resource-documents/"));
    assert.equal(document.id, media);
    const duplicateUpload = await request("/api/media", form);
    assert.equal((await duplicateUpload.json()).path, path);
    const privateRoute = "/api/private-media?path=" + encodeURIComponent(path);
    assert.equal((await request(privateRoute)).status, 200);
    assert.equal((await fetch(base + privateRoute)).status, 401);
    assert([403, 404].includes((await request(privateRoute, undefined, 1)).status));
    assert.equal(check(await admin.storage.getBucket("homecare-private-media")).public, false);
    assert(!(await fetch(`${url}/storage/v1/object/public/homecare-private-media/${path}`)).ok);

    const plan = randomUUID();
    const planned = await mutation(plan, { kind: "save", entity: "maintenance_plans", values: { resource_id: resource, name: "Inspection", maintenance_type: "inspection", due_date: "2026-10-08", interval_days: 30 } });
    assert.equal(planned.result.status, "synced");
    const resourceState = await request("/api/operations?entity=resource_details&id=" + resource);
    const resourceRevision = (await resourceState.json()).rows[0].revision;
    const started = await mutation(plan, { kind: "start", resource_revision: resourceRevision }, planned.result.record.revision);
    assert.equal(started.result.record.in_progress, true);
    const availability = await request("/api/operations?entity=resource_details&id=" + resource);
    assert.equal((await availability.json()).rows[0].availability, "maintenance");
    const completed = await mutation(plan, { kind: "complete", completed_date: "2026-10-08", mileage: 0, operating_hours: 10,
      cost: 20, currency: "SEK", supplier_id: null, document_id: media, notes: "Synthetic inspection", materials: [{ material_id: material, location_id: location, quantity: 2 }] }, started.result.record.revision);
    assert.equal(completed.result.status, "synced");
    assert.equal(completed.result.record.material_records[0].stockTotal, 8);
    assert.equal(completed.result.record.due_date, "2026-11-07");
    assert.equal(completed.result.record.in_progress, false);
    const history = await request("/api/operations?entity=maintenance_events&parent=" + plan);
    const historyRows = (await history.json()).rows;
    assert.equal(historyRows.length, 1);
    assert.equal(historyRows[0].document.id, media);
    console.log("PASS: real private Storage upload/retry/download, cross-tenant protection and documented maintenance consumption");
    check(await admin.from("homecare_roles").update({ permissions: ["data.read", "data.write", "sync.write"] }).eq("id", users[0].role).eq("tenant_id", tenants[0]));
    const forbiddenArchive = await request("/api/sync-mutations", { ...saved.command, id: randomUUID(), entityId: plan, resourceId: resource,
      operation: "delete", expectedRevision: completed.result.record.revision, payload: { kind: "archive", entity: "maintenance_plans" } });
    assert.equal(forbiddenArchive.status, 403);
    console.log("PASS: maintenance-plan archive requires resources.manage with a real authenticated session");
  } finally {
    if (server?.pid) {
      try { process.kill(-server.pid, "SIGTERM"); } catch { /* Already stopped. */ }
      if (server.exitCode == null) await new Promise((resolve) => server.once("exit", resolve));
    }
    if (path) check(await admin.storage.from("homecare-private-media").remove([path]));
    // Immutable journals cannot be deleted through ordinary application routes.
    // Disable triggers only in this cleanup transaction, scoped to our random tenants.
    const names = sql("select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.table_schema='public' and c.column_name='tenant_id' and c.table_name like 'homecare_%' and t.table_type='BASE TABLE'");
    sql("begin; set local session_replication_role=replica; " + names.map(({ table_name }) =>
      `delete from public.${identifier(table_name)} where tenant_id in (${tenants.map(quote).join(",")});`).join("\n") +
      `delete from public.homecare_tenants where id in (${tenants.map(quote).join(",")}); commit;`);
    for (const user of users) check(await admin.auth.admin.deleteUser(typeof user === "string" ? user : user.id));
    assert.deepEqual(sql(snapshotQuery())[0].snapshot, before, "Existing staging records changed during tests");
    console.log("PASS: synthetic tenants/users/files removed; pre-existing staging records unchanged");
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
