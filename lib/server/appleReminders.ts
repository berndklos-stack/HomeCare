import { createHash, timingSafeEqual } from "node:crypto";

export const appleReminderKey = "appleRemindersBridge";
export type AppleReminder = { title: string; list: string; date: string; notes: string };
export type AppleReminderBridge = {
  tokenHash: string;
  generatedAt: string;
  receivedAt: string;
  reminders: AppleReminder[];
};

export class ReminderSnapshotError extends Error {}

export function reminderTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function reminderTokenMatches(token: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(reminderTokenHash(token), "hex"), Buffer.from(hash, "hex"));
}

export function parseReminderSnapshot(input: unknown, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ReminderSnapshotError("Die Momentaufnahme muss ein JSON-Objekt sein.");
  const payload = input as Record<string, unknown>;
  const timestamp = typeof payload.generatedAt === "string" ? Date.parse(payload.generatedAt) : NaN;
  if (!Number.isFinite(timestamp)) {
    throw new ReminderSnapshotError("generatedAt ist kein gültiger Zeitstempel. Im Kurzbefehl ISO-8601-Datum mit Uhrzeit und Zeitzone verwenden.");
  }
  if (Math.abs(now.getTime() - timestamp) > 15 * 60_000) {
    throw new ReminderSnapshotError("Bitte eine aktuelle Momentaufnahme senden (maximal 15 Minuten alt). Datum und Uhrzeit des Geräts prüfen.");
  }
  if (!Array.isArray(payload.reminders) || payload.reminders.length > 2000) {
    throw new ReminderSnapshotError(Array.isArray(payload.reminders)
      ? "Maximal 2000 offene Erinnerungen pro Übertragung."
      : "reminders muss eine JSON-Liste sein, kein Text oder einzelnes Wörterbuch.");
  }
  const reminders = payload.reminders.map((item, index): AppleReminder => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ReminderSnapshotError(`Erinnerung ${index + 1} muss ein Wörterbuch sein.`);
    const row = item as Record<string, unknown>;
    const text = (key: string, max: number) => {
      const value = row[key] ?? "";
      if (typeof value !== "string" || value.length > max) throw new ReminderSnapshotError(`Erinnerung ${index + 1}: ${key} muss Text mit maximal ${max} Zeichen sein.`);
      return value.trim();
    };
    const title = text("title", 500);
    const date = text("date", 10);
    const parsedDate = date ? new Date(`${date}T12:00:00Z`) : null;
    if (!title || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(parsedDate!.getTime()) || parsedDate!.toISOString().slice(0, 10) !== date))) {
      throw new ReminderSnapshotError(`Erinnerung ${index + 1}: Titel darf nicht leer sein; Datum muss leer oder im Format yyyy-MM-dd sein.`);
    }
    return { title, date, list: text("list", 200) || "Erinnerungen", notes: text("notes", 5000) };
  });
  return { generatedAt: new Date(timestamp).toISOString(), reminders };
}

export function remindersForMail(bridge: AppleReminderBridge | undefined, toDate: string) {
  return (bridge?.reminders ?? []).filter((row) => !row.date || row.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "de"));
}
