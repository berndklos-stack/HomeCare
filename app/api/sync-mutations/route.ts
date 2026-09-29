import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { SyncMutation, SyncMutationResult } from "@/lib/syncQueue";
import { membershipAllows } from "@/lib/authModel";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";
const privateMediaBucket = "homecare-private-media";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

function validMutation(value: unknown): value is SyncMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<SyncMutation>;
  return Boolean(
    mutation.id
    && mutation.entityId
    && mutation.resourceId
    && ["accounting_account", "accounting_export", "communication_media", "customer", "customer_contact", "field_progress", "inventory_location", "invoice", "invoice_line", "job", "job_note", "job_time_entry", "material", "object", "object_media", "payment", "personnel", "portal_message", "portal_message_reply", "report", "report_media", "resource", "service", "service_package", "setting", "tenant_settings", "translation", "vehicle_media", "vehicle_position", "vehicle_trip"].includes(String(mutation.entityType))
    && ["create", "update", "delete", "restore"].includes(String(mutation.operation)),
  );
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "sync.write");
  if (isAuthError(auth)) return auth;
  const supabase = auth.serviceClient;

  const mutation = await request.json().catch(() => null);
  if (!validMutation(mutation)) {
    return NextResponse.json({ error: "Ungültige Synchronisierungsanfrage." }, { status: 400 });
  }
  if (["customer", "customer_contact"].includes(mutation.entityType) && !membershipAllows(auth.membership, "customers.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (mutation.entityType === "object" && !membershipAllows(auth.membership, "objects.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (mutation.entityType === "object_media" && (
    !membershipAllows(auth.membership, "objects.manage") || !membershipAllows(auth.membership, "media.manage")
  )) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (["field_progress", "job", "job_note", "job_time_entry"].includes(mutation.entityType)
    && !membershipAllows(auth.membership, "jobs.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (["report", "portal_message", "portal_message_reply"].includes(mutation.entityType)
    && !membershipAllows(auth.membership, "jobs.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (["report_media", "communication_media"].includes(mutation.entityType) && (
    !membershipAllows(auth.membership, "jobs.manage") || !membershipAllows(auth.membership, "media.manage")
  )) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  if (["accounting_export", "invoice", "invoice_line", "payment"].includes(mutation.entityType)
    && !membershipAllows(auth.membership, "invoices.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }

  const rpcName = ["customer", "customer_contact"].includes(mutation.entityType)
    ? "homecare_apply_customer_mutation"
    : ["object", "object_media"].includes(mutation.entityType)
      ? "homecare_apply_object_mutation"
    : ["field_progress", "job", "job_note", "job_time_entry"].includes(mutation.entityType)
      ? "homecare_apply_job_operation_mutation"
    : ["communication_media", "portal_message", "portal_message_reply", "report", "report_media"].includes(mutation.entityType)
      ? "homecare_apply_report_communication_mutation"
    : ["accounting_export", "invoice", "invoice_line", "payment"].includes(mutation.entityType)
      ? "homecare_apply_financial_mutation"
    : ["accounting_account", "inventory_location", "material", "personnel", "service", "service_package"].includes(mutation.entityType)
      ? "homecare_apply_master_data_mutation"
    : ["setting", "tenant_settings", "translation"].includes(mutation.entityType)
    ? "homecare_apply_settings_mutation"
    : ["resource", "vehicle_position"].includes(mutation.entityType)
      ? "homecare_apply_resource_mutation"
      : "homecare_apply_sync_mutation";
  const { data, error } = await supabase.rpc(rpcName, {
    p_entity_id: mutation.entityId,
    p_entity_type: mutation.entityType,
    p_expected_revision: mutation.expectedRevision ?? null,
    p_mutation_id: mutation.id,
    p_operation: mutation.operation,
    p_payload: mutation.payload,
    p_resource_id: mutation.resourceId,
    p_tenant_id: auth.tenantId,
  });

  if (error) {
    const migrationMissing = error.message.includes(rpcName);
    return NextResponse.json(
      { error: migrationMissing ? "Die Sync-Datenbankmigration wurde noch nicht angewendet." : "Die Änderung konnte nicht synchronisiert werden." },
      { status: migrationMissing ? 503 : 500 },
    );
  }

  const result = data as SyncMutationResult | null;
  if (!result) {
    return NextResponse.json({ error: "Der Server hat keinen Mutationsstatus zurückgegeben." }, { status: 500 });
  }
  if (result.status === "synced" && mutation.operation === "delete" && ["communication_media", "object_media", "report_media"].includes(mutation.entityType)) {
    const storagePath = typeof result.record?.storage_path === "string" ? result.record.storage_path : "";
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(privateMediaBucket).remove([storagePath]);
      if (storageError) {
        return NextResponse.json({ error: "Das Medium wurde vorgemerkt, die private Datei konnte aber noch nicht gelöscht werden." }, { status: 503 });
      }
    }
  }
  if (result.status === "synced" && mutation.operation === "delete" && mutation.entityType === "object") {
    const { data: mediaRows, error: mediaError } = await supabase
      .from("homecare_media")
      .select("storage_path")
      .eq("tenant_id", auth.tenantId)
      .eq("owner_type", "object")
      .eq("owner_id", mutation.entityId)
      .not("deleted_at", "is", null);
    if (mediaError) {
      return NextResponse.json({ error: "Die privaten Objektdateien konnten noch nicht zur Löschung geladen werden." }, { status: 503 });
    }
    const storagePaths = (mediaRows ?? [])
      .map((row) => row.storage_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(privateMediaBucket).remove(storagePaths);
      if (storageError) {
        return NextResponse.json({ error: "Das Objekt wurde vorgemerkt, seine privaten Dateien konnten aber noch nicht gelöscht werden." }, { status: 503 });
      }
    }
  }
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    status: result.status === "conflict" ? 409 : 200,
  });
}
