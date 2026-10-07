import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth, serviceClient } from "@/lib/server/apiAuth";
import { appleReminderKey, parseReminderSnapshot, reminderTokenHash, reminderTokenMatches, type AppleReminderBridge } from "@/lib/server/appleReminders";

export const runtime = "nodejs";
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBoundedBody(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks).toString("utf8");
      size += value.byteLength;
      if (size > 1_000_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
}

// A single integration snapshot, isolated from business records and the offline queue.
async function readBridge(client: ReturnType<typeof serviceClient>, tenantId: string) {
  const { data, error } = await client.from("homecare_settings").select("value,revision")
    .eq("tenant_id", tenantId).eq("key", appleReminderKey).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("Erinnerungsanbindung konnte nicht gelesen werden.");
  return data as { value: AppleReminderBridge; revision: number } | null;
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin");
  if (isAuthError(auth)) return auth;
  try {
    const row = await readBridge(auth.serviceClient, auth.tenantId);
    return response({ connected: Boolean(row?.value.tokenHash), receivedAt: row?.value.receivedAt || "", count: row?.value.reminders.length || 0 });
  } catch { return response({ error: "Erinnerungsanbindung konnte nicht gelesen werden." }, 500); }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin");
  if (isAuthError(auth)) return auth;
  try {
    const row = await readBridge(auth.serviceClient, auth.tenantId);
    const token = randomBytes(32).toString("hex");
    const value: AppleReminderBridge = { tokenHash: reminderTokenHash(token), generatedAt: "", receivedAt: "", reminders: [] };
    const query = row
      ? auth.serviceClient.from("homecare_settings").update({ value }).eq("tenant_id", auth.tenantId).eq("key", appleReminderKey).eq("revision", row.revision).is("deleted_at", null)
      : auth.serviceClient.from("homecare_settings").insert({ tenant_id: auth.tenantId, key: appleReminderKey, value });
    const { data, error } = await query.select("revision");
    if (error || !data?.length) return response({ error: "Einrichtung wurde gleichzeitig geändert. Bitte erneut versuchen." }, 409);
    return response({ token, tenantId: auth.tenantId });
  } catch { return response({ error: "Einrichtung fehlgeschlagen." }, 500); }
}

export async function DELETE(request: Request) {
  const auth = await requireApiAuth(request, "tenant.admin");
  if (isAuthError(auth)) return auth;
  try {
    const row = await readBridge(auth.serviceClient, auth.tenantId);
    if (!row) return response({ revoked: true });
    const { data, error } = await auth.serviceClient.from("homecare_settings")
      .update({ value: { tokenHash: "", generatedAt: "", receivedAt: "", reminders: [] } })
      .eq("tenant_id", auth.tenantId).eq("key", appleReminderKey).eq("revision", row.revision).is("deleted_at", null).select("revision");
    return error || !data?.length ? response({ error: "Anbindung wurde gleichzeitig geändert." }, 409) : response({ revoked: true });
  } catch { return response({ error: "Widerruf fehlgeschlagen." }, 500); }
}

export async function PUT(request: Request) {
  const tenantId = request.headers.get("x-workcore-tenant") || "";
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (!/^[a-f0-9-]{36}$/.test(tenantId) || !/^[a-f0-9]{64}$/.test(token)) return response({ error: "Zugang ungültig." }, 401);
  try {
    const client = serviceClient();
    const row = await readBridge(client, tenantId);
    if (!row || !reminderTokenMatches(token, row.value.tokenHash)) return response({ error: "Zugang ungültig." }, 401);
    const raw = await readBoundedBody(request);
    if (raw === null) return response({ error: "Übertragung zu groß." }, 413);
    let snapshot: ReturnType<typeof parseReminderSnapshot>;
    try { snapshot = parseReminderSnapshot(JSON.parse(raw)); }
    catch { return response({ error: "Ungültige oder veraltete Momentaufnahme." }, 400); }
    if (row.value.generatedAt && snapshot.generatedAt <= row.value.generatedAt) {
      return response({ accepted: false, reason: "Bereits empfangen oder älter als der gespeicherte Stand." });
    }
    const { data, error } = await client.from("homecare_settings")
      .update({ value: { ...snapshot, tokenHash: row.value.tokenHash, receivedAt: new Date().toISOString() } })
      .eq("tenant_id", tenantId).eq("key", appleReminderKey).eq("revision", row.revision).is("deleted_at", null).select("revision");
    if (error || !data?.length) return response({ error: "Stand wurde gleichzeitig geändert. Bitte erneut senden." }, 409);
    return response({ accepted: true, count: snapshot.reminders.length });
  } catch { return response({ error: "Übertragung fehlgeschlagen." }, 500); }
}
