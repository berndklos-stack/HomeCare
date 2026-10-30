const stockholmClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function wallClock(value: number) {
  const parts = Object.fromEntries(stockholmClock.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

export function normalizeReportTimestampPayload(payload: Record<string, unknown>) {
  if (typeof payload.sentAt !== "string") return payload;
  const legacy = /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(payload.sentAt);
  if (!legacy) return payload;
  const [, day, month, year, hour, minute, second = "00"] = legacy;
  const local = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const expected = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  if (!Number.isFinite(local) || new Date(local).toISOString() !== expected) throw new Error("INVALID_REPORT_SENT_AT");
  // Resolve the legacy Swedish wall clock with IANA timezone rules, not the
  // device/server timezone. Prefer standard time for the repeated autumn hour.
  const candidates = [...new Set([-86400000, 0, 86400000].map(delta => {
    const probe = local + delta;
    return local - (wallClock(probe) - probe);
  }))].sort((a, b) => b - a);
  const timestamp = candidates.find(candidate => wallClock(candidate) === local);
  if (timestamp === undefined) throw new Error("INVALID_REPORT_SENT_AT");
  return { ...payload, sentAt: new Date(timestamp).toISOString() };
}
import type { SyncMutation } from "./syncQueue";


export function retryLegacyReportTimestampFailures(queue: SyncMutation[], attempted: Set<string>, now = new Date().toISOString()) {
  return queue.map(mutation => {
    if (mutation.entityType !== "report" || mutation.status !== "failed" || attempted.has(mutation.id)
      || !["create", "update"].includes(mutation.operation)
      || !["Die Änderung konnte nicht synchronisiert werden.", "Synchronisierung fehlgeschlagen."].includes(mutation.error || "")) return mutation;
    try {
      if (normalizeReportTimestampPayload(mutation.payload) === mutation.payload) return mutation;
    } catch { return mutation; }
    attempted.add(mutation.id);
    // Preserve attempted request identities and payloads. Only the server's
    // compatibility layer normalizes the value before the journalled RPC.
    return { ...mutation, status: "pending" as const, error: undefined, updatedAt: now };
  });
}
