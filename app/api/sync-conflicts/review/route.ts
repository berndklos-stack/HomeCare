import { NextResponse } from "next/server";
import { membershipAllows } from "@/lib/authModel";
import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { reviewApprovedResolution, reviewMediaConflict, reviewProgressConflict } from "@/lib/conflictReview";
import type { SyncMutation } from "@/lib/syncQueue";

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "sync.write");
  if (isAuthError(auth)) return auth;
  if (!membershipAllows(auth.membership, "jobs.manage") || !membershipAllows(auth.membership, "media.manage")) {
    return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body) || !body.length || body.length > 25 || body.some((m) =>
    !m || typeof m.id !== "string" || typeof m.entityId !== "string" || typeof m.resourceId !== "string"
    || m.status !== "conflict" || !m.payload || typeof m.payload !== "object" || Array.isArray(m.payload))) {
    return NextResponse.json({ error: "INVALID_CONFLICT_BATCH" }, { status: 400 });
  }
  const mutations = body as SyncMutation[];
  const ids = mutations.filter((m) => ["report_media", "communication_media"].includes(m.entityType)).map((m) => m.entityId);
  const { data, error } = ids.length ? await auth.serviceClient.from("homecare_media")
    .select("id,tenant_id,owner_type,owner_id,revision,deleted_at,name,storage_path,preview_url,metadata")
    .eq("tenant_id", auth.tenantId).in("id", ids) : { data: [], error: null };
  if (error) return NextResponse.json({ error: "CONFLICT_REVIEW_FAILED" }, { status: 503 });
  const progressIds = mutations.filter((m) => m.entityType === "field_progress").map((m) => m.entityId);
  const progress = progressIds.length ? await auth.serviceClient.from("homecare_field_progress")
    .select("id,tenant_id,job_id,revision,deleted_at,task_id,work_date,completed,minutes,show_work_time_in_report,note,photos")
    .eq("tenant_id", auth.tenantId).in("id", progressIds) : { data: [], error: null };
  if (progress.error) return NextResponse.json({ error: "CONFLICT_REVIEW_FAILED" }, { status: 503 });
  const progressMutationIds = mutations.filter((m) => ["field_progress", "job"].includes(m.entityType) && /^[a-f0-9-]{36}$/i.test(m.id)).map((m) => m.id);
  const journal = progressMutationIds.length ? await auth.serviceClient.from("homecare_sync_mutations")
    .select("mutation_id,tenant_id,entity_type,entity_id,operation,request_payload,response_payload")
    .eq("tenant_id", auth.tenantId).in("mutation_id", progressMutationIds) : { data: [], error: null };
  if (journal.error) return NextResponse.json({ error: "CONFLICT_REVIEW_FAILED" }, { status: 503 });
  return NextResponse.json({ reviews: mutations.map((m) => reviewApprovedResolution(m,
    journal.data?.find((row) => row.mutation_id === m.id) ?? null, auth.tenantId) ?? (m.entityType === "field_progress"
    ? reviewProgressConflict(m, progress.data?.find((row) => row.id === m.entityId) ?? null, auth.tenantId)
    : reviewMediaConflict(m, data?.find((row) => row.id === m.entityId) ?? null, auth.tenantId))) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
