import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { SyncMutation, SyncMutationResult } from "@/lib/syncQueue";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

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
    && ["resource", "setting", "tenant_settings", "translation", "vehicle_media", "vehicle_position", "vehicle_trip"].includes(String(mutation.entityType))
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

  const rpcName = ["setting", "tenant_settings", "translation"].includes(mutation.entityType)
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
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    status: result.status === "conflict" ? 409 : 200,
  });
}
