import { createHash, timingSafeEqual } from "node:crypto";

export const appleReminderKey = "appleRemindersBridge";
export type AppleReminder = { title: string; list: string; date: string; notes: string };
export type AppleReminderBridge = {
  tokenHash: string;
  generatedAt: string;
  receivedAt: string;
  reminders: AppleReminder[];
};

export function reminderTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function reminderTokenMatches(token: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(reminderTokenHash(token), "hex"), Buffer.from(hash, "hex"));
}

export function parseReminderSnapshot(input: unknown, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("Ungültige Erinnerungen.");
  const payload = input as Record<string, unknown>;
  const timestamp = typeof payload.generatedAt === "string" ? Date.parse(payload.generatedAt) : NaN;
  if (!Number.isFinite(timestamp) || Math.abs(now.getTime() - timestamp) > 15 * 60_000) {
    throw new Error("Bitte eine aktuelle Momentaufnahme senden (maximal 15 Minuten alt).");
  }
  if (!Array.isArray(payload.reminders) || payload.reminders.length > 2000) {
    throw new Error("Maximal 2000 offene Erinnerungen pro Übertragung.");
  }
  const reminders = payload.reminders.map((item): AppleReminder => {
    if (!item || typeof item !== "object") throw new Error("Ungültige Erinnerung.");
    const row = item as Record<string, unknown>;
    const text = (key: string, max: number) => {
      const value = row[key] ?? "";
      if (typeof value !== "string" || value.length > max) throw new Error(`Ungültiges Feld: ${key}`);
      return value.trim();
    };
    const title = text("title", 500);
    const date = text("date", 10);
    if (!title || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date))) {
      throw new Error("Titel oder Datum ist ungültig.");
    }
    return { title, date, list: text("list", 200) || "Erinnerungen", notes: text("notes", 5000) };
  });
  return { generatedAt: new Date(timestamp).toISOString(), reminders };
}

export function remindersForMail(bridge: AppleReminderBridge | undefined, toDate: string) {
  return (bridge?.reminders ?? []).filter((row) => !row.date || row.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "de"));
}
