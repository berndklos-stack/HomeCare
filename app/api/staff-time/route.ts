import { isAuthError, requireApiAuth } from "@/lib/server/apiAuth";
import { administrationResponse, preventAdministrationTestWrites } from "@/lib/server/administration";
import { validUuid } from "@/lib/administration";
import { validateStaffCommand } from "@/lib/staffTime";

const messages: Record<string, string> = {
  STAFF_FORBIDDEN: "Keine Berechtigung für diesen Mitarbeiter.", STAFF_MODULE_DISABLED: "Das Modul Zeiterfassung ist für diese Firma nicht freigeschaltet.",
  STAFF_EMPLOYEE_MISSING: "Bitte einen aktiven Mitarbeiter im Firmenzugang zuordnen.", STAFF_CONFLICT: "Der Eintrag wurde inzwischen geändert. Bitte neu laden; dein Entwurf bleibt erhalten.",
  STAFF_LOCKED: "Dieser Eintrag ist freigegeben und gesperrt. Ein Firmenadministrator muss ihn zuerst entsperren.", STAFF_STOP_FIRST: "Bitte die laufende Zeit zuerst beenden.",
  STAFF_TIME_OVERLAP: "Der Zeitraum überschneidet sich mit einem vorhandenen Eintrag.", STAFF_TIME_INVALID: "Beginn und Ende prüfen. Zeiten dürfen nicht in der Zukunft liegen.",
  STAFF_ALREADY_RUNNING: "Diese Zeitart läuft bereits. Bitte aktualisieren.", STAFF_NOT_RUNNING: "Es läuft keine Zeit mehr. Bitte aktualisieren.",
  STAFF_LEAVE_OVERLAP: "Für diesen Zeitraum liegt bereits ein Urlaubsantrag vor.", STAFF_LEAVE_DECIDED: "Dieser Antrag wurde bereits bearbeitet.",
  STAFF_BALANCE_MISSING: "Bitte zuerst das Urlaubskonto für dieses Jahr einrichten.", STAFF_BALANCE_EXCEEDED: "Das Urlaubskonto reicht dafür nicht aus oder würde bereits genehmigten Urlaub unterschreiten.",
  STAFF_ENTRY_MISSING: "Eintrag nicht gefunden.", STAFF_MUTATION_MISMATCH: "Die Vorgangskennung wurde bereits verwendet. Bitte neu laden.",
};
function failure(error: { code?: string; message?: string }) {
  const key = Object.keys(messages).find(key => error.message?.includes(key));
  return administrationResponse({ error: key ? messages[key] : "Änderung nicht gespeichert. Bitte Angaben prüfen." }, error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "P0002" ? 404 : 400);
}

async function collect<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await query.range(offset, offset + 99);
    if (result.error) return { data: rows, error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 100) return { data: rows, error: null };
  }
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(request, "data.read"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const client = auth.serviceClient;
  const feature = await client.from("homecare_tenant_modules").select("enabled").eq("tenant_id", auth.tenantId).eq("module", "time_tracking").maybeSingle();
  if (feature.error) return administrationResponse({ error: "Modulstatus konnte nicht geladen werden." }, 503);
  if (!feature.data?.enabled) return administrationResponse({ error: messages.STAFF_MODULE_DISABLED }, 403);
  const membership = await client.from("homecare_tenant_memberships").select("employee_id").eq("tenant_id", auth.tenantId).eq("user_id", auth.user.id).eq("status", "active").single();
  if (membership.error) return administrationResponse({ error: "Mitarbeiterzuordnung konnte nicht geladen werden." }, 503);
  const ownEmployeeId = membership.data.employee_id as string | null;
  const canManage = auth.membership.permissions.includes("tenant.admin");
  const params = new URL(request.url).searchParams;
  const companyReport = params.get("scope") === "company";
  if (companyReport && !canManage) return administrationResponse({ error: messages.STAFF_FORBIDDEN }, 403);
  const employeeId = params.get("employeeId") || ownEmployeeId || "";
  const month = params.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || employeeId.length > 200) return administrationResponse({ error: "Monat oder Mitarbeiter prüfen." }, 400);
  if (!canManage && employeeId !== (ownEmployeeId ?? "")) return administrationResponse({ error: messages.STAFF_FORBIDDEN }, 403);
  let directory = client.from("homecare_personnel").select("id,first_name,last_name").eq("tenant_id", auth.tenantId).is("deleted_at", null).order("last_name");
  if (!companyReport) directory = directory.eq("archived", false);
  if (!canManage) directory = directory.eq("id", ownEmployeeId || "__unassigned__");
  const employees = await collect(directory.order("id"));
  if (employees.error) return administrationResponse({ error: "Personal konnte nicht geladen werden." }, 503);
  const result = { employees: (employees.data ?? []).map(row => ({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim() })), ownEmployeeId, canManage, employeeId, month };
  if (!employeeId && !companyReport) return administrationResponse({ ...result, entries: [], leaves: [], balances: [], events: [] });
  if (!companyReport && !result.employees.some(row => row.id === employeeId)) return administrationResponse({ error: messages.STAFF_EMPLOYEE_MISSING }, 404);
  const year = Number(month.slice(0, 4));
  // UTC month boundaries are widened by a day, then the UI groups in local time.
  const start = new Date(`${month}-01T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${month}-01T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(end.getUTCDate() + 1);
  let timeQuery = client.from("homecare_staff_time_entries").select("id,employee_id,kind,reason,note,started_at,ended_at,minutes,locked_at,revision")
    .eq("tenant_id", auth.tenantId).is("deleted_at", null);
  if (!companyReport) timeQuery = timeQuery.eq("employee_id", employeeId);
  const entries = await collect(timeQuery
    .or(`and(started_at.lt.${end.toISOString()},ended_at.gt.${start.toISOString()}),ended_at.is.null`).order("started_at", { ascending: false }).order("id"));
  let leaveQuery = client.from("homecare_staff_leave_requests").select("id,employee_id,from_date,to_date,days,note,status,decision_reason,decided_at,revision")
    .eq("tenant_id", auth.tenantId).gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`);
  let balanceQuery = client.from("homecare_staff_leave_balances").select("employee_id,year,entitlement_days,carryover_days,used_days,revision").eq("tenant_id", auth.tenantId).eq("year", year);
  if (!companyReport) { leaveQuery = leaveQuery.eq("employee_id", employeeId); balanceQuery = balanceQuery.eq("employee_id", employeeId); }
  const leaves = await collect(leaveQuery.order("from_date", { ascending: false }).order("id"));
  const balances = await collect(balanceQuery.order("employee_id"));
  const events: unknown[] = [];
  for (let offset = 0; !companyReport && offset < (leaves.data?.length ?? 0); offset += 100) {
    const batch = await collect(client.from("homecare_staff_leave_events").select("id,request_id,action,reason,created_at").eq("tenant_id", auth.tenantId).in("request_id", leaves.data!.slice(offset, offset + 100).map(row => row.id)).order("created_at").order("id"));
    if (batch.error) return administrationResponse({ error: "Urlaubsverlauf konnte nicht geladen werden." }, 503);
    events.push(...(batch.data ?? []));
  }
  if ([entries, leaves, balances].some(result => result.error)) return administrationResponse({ error: "Zeiten oder Urlaub konnten nicht geladen werden. Bitte Datenbankmigration prüfen." }, 503);
  return administrationResponse({ ...result, entries: entries.data, leaves: leaves.data, balances: balances.data, events });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, "data.read"); if (isAuthError(auth)) return auth;
  const blocked = preventAdministrationTestWrites(request); if (blocked) return blocked;
  const body = await request.json().catch(() => null);
  if (!body || !validUuid(body.mutationId)) return administrationResponse({ error: "Vorgangskennung fehlt." }, 400);
  let command;
  try { command = validateStaffCommand(body.command); } catch (cause) { return administrationResponse({ error: (cause as Error).message }, 400); }
  const result = await auth.serviceClient.rpc("homecare_staff_command", { p_tenant: auth.tenantId, p_actor: auth.user.id, p_id: body.mutationId, p_command: command });
  return result.error ? failure(result.error) : administrationResponse({ ok: true });
}
