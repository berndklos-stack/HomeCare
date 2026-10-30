import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { SyncMutation, SyncMutationResult } from "@/lib/syncQueue";
import { membershipAllows } from "@/lib/authModel";
import { normalizeObjectDatePayload } from "@/lib/objectSync";
import { normalizeReportTimestampPayload } from "@/lib/reportTimestamp";
import { requiredOperationsPermission, validateOperationsMutation } from "@/lib/operationsCommands";
import { validateResourceType } from "@/lib/resourceTypes";
import { hasUnfinishedProgressPhotos } from "@/lib/jobOperationsSync";
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
    && ["resource_type", "operations", "accounting_account", "accounting_export", "communication_media", "customer", "customer_contact", "field_progress", "inventory_location", "invoice", "invoice_line", "job", "job_note", "job_time_entry", "material", "object", "object_media", "payment", "personnel", "portal_message", "portal_message_reply", "report", "report_media", "resource", "service", "service_package", "setting", "tenant_settings", "translation", "vehicle_media", "vehicle_position", "vehicle_trip"].includes(String(mutation.entityType))
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
  if (["job", "object"].includes(mutation.entityType) && mutation.payload?.scanCode !== undefined
    && (typeof mutation.payload.scanCode !== "string" || mutation.payload.scanCode.length > 128)) {
    return NextResponse.json({ error: "INVALID_SCAN_CODE" }, { status: 400 });
  }
  if (mutation.entityType === "operations") {
    if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") {
      return NextResponse.json({ error: "OPERATIONS_E2E_MOCK_REQUIRED" }, { status: 503 });
    }
    try {
      const command = validateOperationsMutation(mutation);
      if (command.kind === "stock" && command.project_id) return NextResponse.json({ error: "OBJECT_NOT_BOOKABLE" }, { status: 400 });
      if (command.kind === "stock" && command.job_id && command.source_id && command.destination_id) return NextResponse.json({ error: "JOB_REQUIRES_STOCK_OUT" }, { status: 400 });
      const fieldStock = command.kind === "stock" && !membershipAllows(auth.membership, "data.write");
      if (fieldStock && (!command.job_id || Boolean(command.source_id) === Boolean(command.destination_id))) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }
      const permission = requiredOperationsPermission(command, membershipAllows(auth.membership, "data.write"));
      if (!membershipAllows(auth.membership, permission)) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "INVALID_OPERATIONS_COMMAND" }, { status: 400 });
    }
  }
  if (mutation.entityType === "resource_type") {
    if (!membershipAllows(auth.membership, "resources.manage")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    if (process.env.NODE_ENV !== "production" && process.env.WORKCORE_E2E_AUTH_BYPASS === "1") return NextResponse.json({ error: "RESOURCE_TYPES_E2E_MOCK_REQUIRED" }, { status: 503 });
    try {
      validateResourceType(mutation.payload);
      if (!["create", "update"].includes(mutation.operation) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutation.entityId)
        || (mutation.operation === "update" && (!Number.isSafeInteger(mutation.expectedRevision) || Number(mutation.expectedRevision) < 1))) throw new Error("INVALID_RESOURCE_TYPE");
    } catch { return NextResponse.json({ error: "INVALID_RESOURCE_TYPE" }, { status: 400 }); }
  }
  if (mutation.entityType === "resource" && !membershipAllows(auth.membership, "resources.manage")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
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
  if (mutation.entityType === "job_time_entry" && Object.hasOwn(mutation.payload, "attachments")) {
    if (!membershipAllows(auth.membership, "media.manage")) return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
    const attachments = mutation.payload.attachments;
    if (!Array.isArray(attachments) || attachments.length > 20 || attachments.some(item => !item || typeof item !== "object" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/.test(String(item.id)))) {
      return NextResponse.json({ error: "INVALID_ATTACHMENTS" }, { status: 400 });
    }
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

  if (mutation.entityType === "field_progress" && ["create", "update"].includes(mutation.operation)
    && hasUnfinishedProgressPhotos(mutation.payload)) {
    // Attempted identities remain immutable: existing requests still return
    // their journalled result, but new upload placeholders cannot replace photos.
    const { data: previous, error: lookupError } = await supabase.from("homecare_sync_mutations")
      .select("mutation_id").eq("tenant_id", auth.tenantId).eq("mutation_id", mutation.id).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Foto-Upload konnte nicht geprüft werden." }, { status: 503 });
    if (!previous) return NextResponse.json({ error: "Unfertige Foto-Uploads bleiben lokal erhalten. Bitte Foto-Upload abschließen; gespeicherte Fotos wurden nicht ersetzt." }, { status: 422 });
  }

  const rpcName = mutation.entityType === "resource_type" ? "homecare_apply_resource_type_mutation" : mutation.entityType === "operations"
    ? mutation.payload.kind === "receive_batch" ? "homecare_apply_purchase_receipt_batch" : "homecare_apply_operations_mutation" : ["customer", "customer_contact"].includes(mutation.entityType)
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
      : mutation.entityType === "vehicle_trip" ? "homecare_apply_trip_sync_mutation" : "homecare_apply_sync_mutation";
  let payload = mutation.entityType === "object" ? normalizeObjectDatePayload(mutation.payload) : mutation.payload;
  if (mutation.entityType === "report") {
    try { payload = normalizeReportTimestampPayload(payload); }
    catch { return NextResponse.json({ error: "Der Versandzeitpunkt des Berichts ist ungültig. Die lokale Änderung bleibt erhalten." }, { status: 422 }); }
  }
  const { data, error } = await supabase.rpc(rpcName, {
    ...(["operations", "job", "job_time_entry", "job_note", "field_progress"].includes(mutation.entityType) ? { p_actor_id: auth.user.id } : {}),
    p_entity_id: mutation.entityId,
    p_entity_type: mutation.entityType,
    p_expected_revision: mutation.expectedRevision ?? null,
    p_mutation_id: mutation.id,
    p_operation: mutation.operation,
    p_payload: payload,
    p_resource_id: mutation.resourceId,
    p_tenant_id: auth.tenantId,
  });

  if (error) {
    const migrationMissing = error.message.includes(rpcName);
    const retiredStockWrite = error.message.includes("LEGACY_STOCK_WRITES_RETIRED");
    return NextResponse.json(
      { error: retiredStockWrite ? "Alte Lagerbuchungen können nicht erneut übertragen werden. Die Materialänderung bleibt lokal erhalten. Bitte die App aktualisieren und erneut versuchen." : migrationMissing ? "Die Sync-Datenbankmigration wurde noch nicht angewendet." : "Die Änderung konnte nicht synchronisiert werden." },
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
