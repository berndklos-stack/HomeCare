import { validUuid } from "@/lib/administration";

export type StaffTimeKind = "work" | "pause" | "interruption";
export type StaffTimeEntry = { id: string; employee_id: string; kind: StaffTimeKind; reason: string; note: string; started_at: string; ended_at: string | null; minutes: number | null; locked_at: string | null; revision: number };
export type StaffLeave = { id: string; employee_id: string; from_date: string; to_date: string; days: number; note: string; status: "requested" | "approved" | "rejected" | "cancelled"; decision_reason: string; decided_at: string | null; revision: number };
export type StaffBalance = { employee_id: string; year: number; entitlement_days: number; carryover_days: number; used_days: number; revision: number };
export type StaffLeaveEvent = { id: string; request_id: string; action: string; reason: string; created_at: string };
export type StaffTimeData = {
  employees: { id: string; name: string }[]; ownEmployeeId: string | null; canManage: boolean;
  entries: StaffTimeEntry[]; leaves: StaffLeave[]; balances: StaffBalance[]; events: StaffLeaveEvent[];
  employeeId: string; month: string;
};
export type StaffCommand = { action: string; employeeId?: string; id?: string; activeId?: string | null; revision?: number; kind?: StaffTimeKind | null; reason?: string; note?: string; startedAt?: string; endedAt?: string; from?: string; to?: string; days?: number; year?: number; entitlementDays?: number; carryoverDays?: number; usedDays?: number };

const actions = ["clock", "time_save", "time_delete", "time_lock", "time_unlock", "leave_request", "leave_approve", "leave_reject", "leave_cancel", "balance_save"];
const kinds = ["work", "pause", "interruption"];
export function validStaffDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function validateStaffCommand(input: unknown): StaffCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Eingaben fehlen.");
  const v = input as Record<string, unknown>;
  const allowed = ["action", "employeeId", "id", "activeId", "revision", "kind", "reason", "note", "startedAt", "endedAt", "from", "to", "days", "year", "entitlementDays", "carryoverDays", "usedDays"];
  if (Object.keys(v).some(key => !allowed.includes(key)) || !actions.includes(String(v.action))) throw new Error("Ungültige Aktion.");
  if (v.employeeId !== undefined && (typeof v.employeeId !== "string" || !v.employeeId.trim() || v.employeeId.length > 200)) throw new Error("Mitarbeiter prüfen.");
  if (v.id !== undefined && !validUuid(v.id)) throw new Error("Eintrag prüfen.");
  if (v.activeId !== undefined && v.activeId !== null && !validUuid(v.activeId)) throw new Error("Laufenden Eintrag prüfen.");
  if (v.revision !== undefined && (!Number.isSafeInteger(v.revision) || Number(v.revision) < 0)) throw new Error("Version prüfen.");
  for (const key of ["note", "reason"]) if (v[key] !== undefined && (typeof v[key] !== "string" || (v[key] as string).length > (key === "reason" && ["clock", "time_save"].includes(String(v.action)) ? 300 : 4000))) throw new Error("Notiz oder Grund ist zu lang.");
  if (v.action === "clock" && v.kind !== null && !kinds.includes(String(v.kind))) throw new Error("Zeitart auswählen.");
  if (v.action === "clock" && v.activeId && (!Number.isSafeInteger(v.revision) || Number(v.revision) < 1)) throw new Error("Versionsstand fehlt.");
  if (v.action === "time_save") {
    if (!kinds.includes(String(v.kind)) || typeof v.startedAt !== "string" || typeof v.endedAt !== "string"
      || !Number.isFinite(Date.parse(v.startedAt)) || !Number.isFinite(Date.parse(v.endedAt)) || v.startedAt.length > 40 || v.endedAt.length > 40
      || Date.parse(v.endedAt) <= Date.parse(v.startedAt)) throw new Error("Beginn und Ende prüfen.");
  }
  if (["time_delete", "time_lock", "time_unlock", "leave_approve", "leave_reject", "leave_cancel"].includes(String(v.action)) && (!v.id || !Number.isSafeInteger(v.revision) || Number(v.revision) < 1)) throw new Error("Eintrag und Versionsstand fehlen.");
  if (v.action === "time_save" && v.id && (!Number.isSafeInteger(v.revision) || Number(v.revision) < 1)) throw new Error("Versionsstand fehlt.");
  if (v.action === "leave_request") {
    if (!validStaffDate(v.from) || !validStaffDate(v.to) || v.to < v.from || v.from.slice(0, 4) !== v.to.slice(0, 4)) throw new Error("Urlaubszeitraum prüfen; jahresübergreifenden Urlaub bitte auf zwei Anträge aufteilen.");
    if (typeof v.days !== "number" || !Number.isFinite(v.days) || v.days <= 0 || v.days > 366 || !Number.isInteger(v.days * 2) || v.days > (Date.parse(v.to) - Date.parse(v.from)) / 86400000 + 1) throw new Error("Urlaubstage prüfen (halbe Tage sind möglich).");
  }
  if (v.action === "balance_save") {
    if (!Number.isInteger(v.year) || Number(v.year) < 2000 || Number(v.year) > 2200 || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0) throw new Error("Jahr und Versionsstand prüfen.");
    for (const key of ["entitlementDays", "carryoverDays", "usedDays"]) if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || Number(v[key]) < 0 || Number(v[key]) > (key === "usedDays" ? 732 : 366) || !Number.isInteger(Number(v[key]) * 2)) throw new Error("Urlaubskonto prüfen (halbe Tage sind möglich).");
  }
  return v as StaffCommand;
}

export function suggestedLeaveDays(from: string, to: string) {
  if (!validStaffDate(from) || !validStaffDate(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 366) return 0;
  let days = 0;
  for (let stamp = Date.parse(from); stamp <= Date.parse(to); stamp += 86400000) if (![0, 6].includes(new Date(stamp).getUTCDay())) days++;
  return days;
}
export function staffLeaveSummary(balance: StaffBalance | undefined, leaves: StaffLeave[], year: number) {
  const selected = leaves.filter(row => Number(row.from_date.slice(0, 4)) === year);
  const approved = selected.filter(row => row.status === "approved").reduce((sum, row) => sum + Number(row.days), 0);
  const requested = selected.filter(row => row.status === "requested").reduce((sum, row) => sum + Number(row.days), 0);
  return { approved, requested, remaining: balance ? Number(balance.entitlement_days) + Number(balance.carryover_days) - Number(balance.used_days) - approved : null };
}
export function formatStaffMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function staffMinutesInMonth(entry: Pick<StaffTimeEntry, "started_at" | "ended_at">, month: string) {
  if (!entry.ended_at || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 0;
  const [year, number] = month.split("-").map(Number);
  const start = new Date(year, number - 1, 1).getTime();
  const end = new Date(year, number, 1).getTime();
  return Math.max(0, Math.min(Date.parse(entry.ended_at), end) - Math.max(Date.parse(entry.started_at), start)) / 60000;
}
