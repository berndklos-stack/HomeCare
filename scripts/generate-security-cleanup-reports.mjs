import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const PAGE_SIZE = 100;
const APPROVED_UNOWNED_MEDIA_SNAPSHOT_COUNT = 2036;
const HUMAN_ARCHIVE_DECISIONS = new Set([
  "JOB-2407-OCC-20260814:Bericht",
  "JOB-2407-OCC-20260814:Wasserwerte",
  "JOB-2407-OCC-20260814:Vorher-Fotos",
]);

function environment() {
  const values = { ...process.env };
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !values[match[1].trim()]) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  if (!values.NEXT_PUBLIC_SUPABASE_URL || !values.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase environment missing.");
  return values;
}

async function selectAll(client, table, columns = "*", pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function listBucket(client, bucket) {
  const objects = [];
  const queue = [""];
  const visited = new Set();
  while (queue.length > 0) {
    const prefix = queue.shift();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      for (const entry of data ?? []) {
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) objects.push({
          createdAt: entry.created_at ?? null,
          path: objectPath,
          size: Number(entry.metadata?.size ?? 0),
          updatedAt: entry.updated_at ?? null,
        });
        else queue.push(objectPath);
      }
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return objects;
}

function walk(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    visitor(key, item);
    walk(item, visitor);
  }
}

function storagePath(value, knownPaths) {
  if (typeof value !== "string") return null;
  if (knownPaths.has(value)) return value;
  const marker = "/storage/v1/object/public/homecare-media/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return decodeURIComponent(value.slice(markerIndex + marker.length).split("?")[0]);
  try {
    const url = new URL(value, "https://workcore.invalid");
    if (["/api/media", "/api/private-media"].includes(url.pathname)) return url.searchParams.get("path");
  } catch {
    return null;
  }
  return null;
}

function arraysFromState(rows, key) {
  const values = [];
  for (const row of rows) {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    if (Array.isArray(data[key])) values.push(...data[key]);
    if (row.id === `sync-section:${key}` && Array.isArray(data.value)) values.push(...data.value);
  }
  return values.filter((item) => item && typeof item === "object");
}

function text(value, max = 180) {
  const normalized = String(value ?? "").replace(/[\r\n|]+/g, " ").trim();
  if (!normalized) return "-";
  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

function code(value) {
  return `\`${String(value ?? "-").replace(/`/g, "'")}\``;
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fieldProgressDecision(row, legacyJob) {
  if (legacyJob) return { action: "assign", reason: "Auftrag ist noch im Legacy-/Sync-JSON vorhanden; zuerst relational rekonstruieren und fachlich bestätigen." };
  if (HUMAN_ARCHIVE_DECISIONS.has(String(row.id))) {
    return { action: "archive", reason: "Fachlich entschieden: gehört zur Vorgangsstruktur vom 14.08.2026 und wird mangels sicherem Elternauftrag verlustfrei archiviert." };
  }
  const photos = Array.isArray(row.photos) ? row.photos.length : 0;
  const substantive = row.completed || Number(row.minutes ?? 0) > 0 || String(row.note ?? "").trim() || photos > 0;
  if (substantive) return { action: "archive", reason: "Arbeitsnachweis enthält fachliche Daten, aber kein Elternobjekt; verlustfrei archivieren und manuell prüfen." };
  return { action: "unknown", reason: "Kein Elternauftrag und wenig Kontext; erst nach fachlicher Prüfung entfernen oder archivieren." };
}

async function fieldProgressReport(client, stateRows, output) {
  const [progress, jobs, objects, customers] = await Promise.all([
    selectAll(client, "homecare_field_progress"),
    selectAll(client, "homecare_jobs", "id,tenant_id,object_id,customer_id,title,status,description,due_date"),
    selectAll(client, "homecare_objects", "id,tenant_id,owner_customer_id,name"),
    selectAll(client, "homecare_customers", "id,tenant_id,name,company_name"),
  ]);
  const jobKeys = new Set(jobs.map((job) => `${job.tenant_id}:${job.id}`));
  const orphaned = progress.filter((row) => row.job_id && !jobKeys.has(`${row.tenant_id}:${row.job_id}`));
  const legacyJobs = new Map(arraysFromState(stateRows, "jobs").map((job) => [String(job.id ?? ""), job]));
  const legacyObjects = new Map(arraysFromState(stateRows, "objects").map((object) => [String(object.id ?? ""), object]));
  const legacyCustomers = new Map(arraysFromState(stateRows, "customers").map((customer) => [String(customer.id ?? ""), customer]));
  const objectRows = new Map(objects.map((object) => [object.id, object]));
  const customerRows = new Map(customers.map((customer) => [customer.id, customer]));

  const lines = [
    "# Field Progress Orphans",
    "",
    "> Internal security/data-quality document. Do not publish. No record was modified.",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Orphaned records: **${orphaned.length}**`,
    "",
    "Final human decision: **9 assign, 10 archive, 0 remove, 0 unknown**. No record may be deleted.",
    "",
    "A record is listed when `(tenant_id, job_id)` has no matching relational job. Proposed actions are decision support only.",
    "",
    "| Record ID | Tenant | Date / updated | Job reference | Customer reference | Object reference | Description / status | Proposed action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of orphaned.sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))) {
    const legacyJob = legacyJobs.get(String(row.job_id));
    const objectId = String(legacyJob?.objectId ?? legacyJob?.object_id ?? "");
    const customerId = String(legacyJob?.customerId ?? legacyJob?.customer_id ?? "");
    const object = objectRows.get(objectId) ?? legacyObjects.get(objectId);
    const resolvedCustomerId = customerId || String(object?.owner_customer_id ?? object?.ownerCustomerId ?? "");
    const customer = customerRows.get(resolvedCustomerId) ?? legacyCustomers.get(resolvedCustomerId);
    const decision = fieldProgressDecision(row, legacyJob);
    const status = legacyJob
      ? `${text(legacyJob.title)} / ${text(legacyJob.status)} / ${text(legacyJob.description || row.note)}`
      : `completed=${Boolean(row.completed)}, minutes=${Number(row.minutes ?? 0)}, task=${text(row.task_id)}, note=${text(row.note)}`;
    lines.push(`| ${code(row.id)} | ${code(row.tenant_id)} | ${text(row.work_date || row.updated_at)} | ${code(row.job_id)}${legacyJob ? " (Legacy-JSON gefunden)" : " (nicht gefunden)"} | ${resolvedCustomerId ? `${code(resolvedCustomerId)} ${text(customer?.name || customer?.companyName || customer?.company_name)}` : "-"} | ${objectId ? `${code(objectId)} ${text(object?.name)}` : "-"} | ${status} | **${decision.action}**: ${decision.reason} |`);
  }
  lines.push("", "## Final decision", "", "- `assign`: 9 records; reconstruct the two matching legacy jobs and retain the progress records.", "- `archive`: 10 records; preserve the complete source rows outside the active foreign-key relationship.", "- `remove`: 0 records.", "- `unknown`: 0 records.", "");
  writeFileSync(output, lines.join("\n"));
  return orphaned.length;
}

async function unownedMediaReport(client, stateRows, output) {
  const [objects, tenants, mediaRows] = await Promise.all([
    listBucket(client, "homecare-media"),
    selectAll(client, "homecare_tenants", "id,name"),
    selectAll(client, "homecare_media", "id,tenant_id,storage_path,preview_url,source"),
  ]);
  const tenantIds = new Set(tenants.map((tenant) => tenant.id));
  const knownPaths = new Set(objects.map((object) => object.path));
  const evidence = new Map(objects.map((object) => [object.path, { activeJson: 0, backupJson: 0, db: 0, tenants: new Set() }]));
  const addEvidence = (objectPath, tenantId, kind) => {
    const item = evidence.get(objectPath);
    if (!item) return;
    item[kind] += 1;
    if (tenantId) item.tenants.add(tenantId);
  };
  for (const object of objects) {
    const prefixTenant = object.path.split("/")[0];
    if (tenantIds.has(prefixTenant)) evidence.get(object.path).tenants.add(prefixTenant);
  }
  for (const row of mediaRows) {
    for (const value of [row.storage_path, row.preview_url, row.source]) {
      const objectPath = storagePath(value, knownPaths);
      if (objectPath) addEvidence(objectPath, row.tenant_id, "db");
    }
  }
  for (const row of stateRows) {
    const tenantId = row.tenant_id ?? DEFAULT_TENANT_ID;
    const backup = String(row.id).startsWith("app-backup");
    walk(row.data, (_key, value) => {
      const objectPath = storagePath(value, knownPaths);
      if (objectPath) addEvidence(objectPath, tenantId, backup ? "backupJson" : "activeJson");
    });
  }

  const unowned = objects.filter((object) => evidence.get(object.path).tenants.size === 0);
  const soleTenant = tenants.length === 1 ? tenants[0] : null;
  const lines = [
    "# Unowned Media Classification",
    "",
    "> Internal security document containing object paths. Do not publish. No object or tenant assignment was modified.",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Unowned objects: **${unowned.length}** of ${objects.length} objects in \`homecare-media\`.`,
    "",
    `Final human decision for the audited ${APPROVED_UNOWNED_MEDIA_SNAPSHOT_COUNT}-object snapshot: **0 migrate, ${APPROVED_UNOWNED_MEDIA_SNAPSHOT_COUNT} quarantine, 0 delete-later, 0 unknown**.`,
    "",
    unowned.length === APPROVED_UNOWNED_MEDIA_SNAPSHOT_COUNT
      ? "The current inventory matches the approved snapshot. No object may be assigned or deleted automatically."
      : `Inventory drift detected: the current count is ${unowned.length}. New or missing objects require a separate human decision; quarantine remains the safe default.`,
    "",
    "`Likely tenant` is evidence for human review, never an automatic assignment.",
    "",
    "| Path | Size | Created | Updated | Matching reference | Likely tenant | Confidence | Proposed action |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const object of unowned.sort((a, b) => a.path.localeCompare(b.path))) {
    const item = evidence.get(object.path);
    const likelyTenant = soleTenant ? `${soleTenant.id} (${text(soleTenant.name)})` : "unknown";
    const confidence = soleTenant ? "low (single-tenant instance only)" : "none";
    const action = "quarantine";
    const refs = item.db + item.activeJson + item.backupJson === 0
      ? "none"
      : `db=${item.db}, active-json=${item.activeJson}, backup-json=${item.backupJson}`;
    lines.push(`| ${code(object.path)} | ${humanSize(object.size)} | ${text(object.createdAt)} | ${text(object.updatedAt)} | ${refs} | ${text(likelyTenant)} | ${confidence} | **${action}** |`);
  }
  lines.push("", "## Final decision and handling", "", "- `migrate`: 0 objects from the approved snapshot.", `- \`quarantine\`: ${APPROVED_UNOWNED_MEDIA_SNAPSHOT_COUNT} objects; preserve losslessly in a private, non-application-readable namespace.`, "- `delete-later`: 0 objects.", "- `unknown`: 0 objects.", "- Do not infer ownership from the current single-tenant instance or the `Likely tenant` column.", "- Do not expose quarantined objects through `/api/private-media`.", "- Do not delete source objects until private-media migration, checksum verification, reference migration, removal of public access, the approved retention period and a separate human deletion approval are all complete.", "");
  writeFileSync(output, lines.join("\n"));
  return { total: objects.length, unowned: unowned.length };
}

async function main() {
  const env = environment();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const stateRows = await selectAll(client, "app_state", "id,data", 25);
  const outputDir = path.resolve("docs/security");
  mkdirSync(outputDir, { recursive: true });
  const orphanCount = await fieldProgressReport(client, stateRows, path.join(outputDir, "Field-Progress-Orphans.md"));
  const media = await unownedMediaReport(client, stateRows, path.join(outputDir, "Unowned-Media-Classification.md"));
  console.log(JSON.stringify({ orphanCount, ...media }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
