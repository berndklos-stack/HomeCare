import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());
const tenant = process.env.WORKCORE_AUDIT_TENANT ?? "00000000-0000-0000-0000-000000000001";
const output = process.argv[2];
if (!output || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Output path and database configuration required");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function all(table, columns, filter = (query) => query) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await filter(client.from(table).select(columns).eq("tenant_id", tenant)).order("id").range(offset, offset + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
const objects = await all("homecare_objects", "id,name,object_type,revision,deleted_at,archived");
const media = await all("homecare_media", "*", (query) => query.eq("owner_type", "object"));
const trips = await all("homecare_vehicle_trips", "*", (query) => query.in("id", ["TRIP-088b2e22-767f-4d18-93cc-806c34836825", "TRIP-dc53675e-06ba-4d21-b7aa-2ce8869d6d48"]));
const checks = [];
for (const row of media) {
  let path = row.storage_path;
  if (!path && row.preview_url?.startsWith("/api/private-media?")) path = new URL(row.preview_url, "https://workcore.local").searchParams.get("path");
  let file = "no-path";
  if (path) {
    const { data, error } = await client.storage.from("homecare-private-media").info(path);
    file = error ? `unverified: ${error.message}` : data ? "exists" : "unverified";
  }
  checks.push({ id: row.id, owner: row.owner_id, deletedAt: row.deleted_at, path, file, ownerExists: objects.some((object) => object.id === row.owner_id), inlinePreview: row.preview_url?.startsWith("data:image/") ?? false });
}
const snapshot = { capturedAt: new Date().toISOString(), tenant, mode: "READ_ONLY_NO_RESTORE", objects, media, trips, checks };
await writeFile(output, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: "wx" });
const digest = createHash("sha256").update(await readFile(output)).digest("hex");
console.log(JSON.stringify({ output, sha256: digest, objects: objects.length, projectObjects: objects.filter((row) => row.object_type === "Projekt").length, media: media.length, activeMedia: media.filter((row) => !row.deleted_at).length, filesConfirmed: checks.filter((row) => row.file === "exists").length, filesUnverified: checks.filter((row) => row.file.startsWith("unverified")).length, mediaWithoutPath: checks.filter((row) => row.file === "no-path").length, missingOwners: checks.filter((row) => !row.ownerExists).length, concreteTripsOnServer: trips.length }));
