import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const PAGE_SIZE = 100;
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const bucketNames = ["homecare-media", "homecare-private-media", "homecare-backups"];

function loadEnvironment() {
  const values = { ...process.env };
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || values[match[1].trim()]) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const key = values.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL/service role key missing.");
  return { key, url };
}

async function selectAll(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function listBucket(client, bucket) {
  const objects = [];
  const prefixes = [""];
  const visited = new Set();
  while (prefixes.length > 0) {
    const prefix = prefixes.shift();
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
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) objects.push({
          bucket,
          contentType: entry.metadata?.mimetype ?? null,
          path,
          size: Number(entry.metadata?.size ?? 0),
        });
        else prefixes.push(path);
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

function referencedStoragePath(value, knownPaths) {
  if (typeof value !== "string") return null;
  if (knownPaths.has(value)) return value;
  for (const marker of [
    "/storage/v1/object/public/homecare-media/",
    "/storage/v1/object/public/homecare-private-media/",
  ]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  try {
    const url = new URL(value, "https://workcore.invalid");
    if (["/api/media", "/api/private-media"].includes(url.pathname)) {
      return url.searchParams.get("path");
    }
  } catch {
    return null;
  }
  return null;
}

function portalPasswordCount(value) {
  let count = 0;
  walk(value, (key, item) => {
    if (key.toLowerCase() === "portalpassword" && typeof item === "string" && item.length > 0) count += 1;
  });
  return count;
}

function inspectCompressedBackups(rows) {
  const chunksByBackup = new Map();
  for (const row of rows) {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    if (!String(row.id).startsWith("app-backup-chunk:") || typeof data.content !== "string") continue;
    const key = String(data.backupId ?? "");
    if (!key) continue;
    const chunks = chunksByBackup.get(key) ?? [];
    chunks.push({ content: data.content, index: Number(data.index ?? 0) });
    chunksByBackup.set(key, chunks);
  }

  let readable = 0;
  let exposed = 0;
  let unreadable = 0;
  for (const chunks of chunksByBackup.values()) {
    try {
      const encoded = chunks.sort((a, b) => a.index - b.index).map((item) => item.content).join("");
      const snapshot = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
      readable += 1;
      if (portalPasswordCount(snapshot) > 0) exposed += 1;
    } catch {
      unreadable += 1;
    }
  }
  return { exposed, readable, unreadable };
}

async function main() {
  const { key, url } = loadEnvironment();
  const client = createClient(url, key, { auth: { persistSession: false } });
  const projectRef = new URL(url).hostname.split(".")[0];
  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) throw bucketError;
  const bucketById = new Map((buckets ?? []).map((bucket) => [bucket.id, bucket]));

  const tenants = await selectAll(() => client.from("homecare_tenants").select("id"));
  const tenantIds = new Set(tenants.map((tenant) => tenant.id));
  const mediaRows = await selectAll(() => client.from("homecare_media").select("id,tenant_id,storage_path,preview_url,source"));
  let appStateRows;
  const withTenant = await client.from("app_state").select("id,tenant_id").limit(1);
  if (!withTenant.error) {
    appStateRows = await selectAll(() => client.from("app_state").select("id,tenant_id,data"), 25);
  } else {
    appStateRows = await selectAll(() => client.from("app_state").select("id,data"), 25);
  }

  const objects = [];
  for (const bucket of bucketNames) {
    if (bucketById.has(bucket)) objects.push(...await listBucket(client, bucket));
  }
  const knownPaths = new Set(objects.map((object) => object.path));
  const owners = new Map(objects.map((object) => [`${object.bucket}:${object.path}`, new Set()]));
  const addOwner = (bucket, path, tenantId) => {
    if (!path || !tenantId) return;
    owners.get(`${bucket}:${path}`)?.add(tenantId);
  };

  for (const object of objects) {
    const pathTenant = object.path.split("/")[0];
    if (tenantIds.has(pathTenant)) addOwner(object.bucket, object.path, pathTenant);
  }
  for (const row of mediaRows) {
    for (const field of [row.storage_path, row.preview_url, row.source]) {
      const path = referencedStoragePath(field, knownPaths);
      if (!path) continue;
      addOwner("homecare-media", path, row.tenant_id);
      addOwner("homecare-private-media", path, row.tenant_id);
    }
  }
  for (const row of appStateRows) {
    const tenantId = row.tenant_id ?? DEFAULT_TENANT_ID;
    walk(row.data, (_key, value) => {
      const path = referencedStoragePath(value, knownPaths);
      if (!path) return;
      addOwner("homecare-media", path, tenantId);
      addOwner("homecare-private-media", path, tenantId);
    });
  }

  const manifest = objects.map((object) => {
    const assigned = [...(owners.get(`${object.bucket}:${object.path}`) ?? [])];
    return { ...object, assignedTenantIds: assigned, state: assigned.length === 1 ? "owned" : assigned.length === 0 ? "orphan" : "conflict" };
  });
  const output = {
    appState: {
      directPortalPasswordRows: appStateRows.filter((row) => portalPasswordCount(row.data) > 0).length,
      rows: appStateRows.length,
      compressedBackups: inspectCompressedBackups(appStateRows),
    },
    buckets: bucketNames.map((id) => ({
      id,
      objects: manifest.filter((item) => item.bucket === id).length,
      owned: manifest.filter((item) => item.bucket === id && item.state === "owned").length,
      orphaned: manifest.filter((item) => item.bucket === id && item.state === "orphan").length,
      conflicts: manifest.filter((item) => item.bucket === id && item.state === "conflict").length,
      public: bucketById.get(id)?.public ?? null,
    })),
    mediaRows: {
      total: mediaRows.length,
      withoutStoragePath: mediaRows.filter((row) => !row.storage_path).length,
      missingReferencedObject: mediaRows.filter((row) => row.storage_path && !knownPaths.has(row.storage_path)).length,
    },
    projectRef,
    tenants: tenantIds.size,
  };

  const manifestArg = process.argv.find((arg) => arg.startsWith("--manifest="));
  if (manifestArg) writeFileSync(manifestArg.slice("--manifest=".length), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
