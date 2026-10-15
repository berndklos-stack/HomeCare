export const companyModules = ["jobs", "reports", "time_tracking", "billing", "inventory", "logbook", "customer_portal", "dispatch", "documents", "ai", "integrations"] as const;
export type CompanyModule = typeof companyModules[number];
export type CompanyInput = {
  name: string; country: string; locale: "de" | "sv" | "en"; timezone: string;
  organizationNumber: string; vatNumber: string; ownerEmail: string;
  accountType: "production" | "pilot" | "demo"; pilotStartDate: string; pilotEndDate: string;
  contactPerson: string; internalLabel: string; notes: string; modules: CompanyModule[];
};
export type AdministrationRole = { id: string; key: string; name: string; permissions: string[]; system_role: boolean };
export type AdministrationMember = {
  id: string; user_id: string; status: string; role_id: string; employee_id: string | null;
  name: string; email: string; lastLogin: string | null;
  invitation: { id: string; delivery_status: string; expires_at: string } | null;
};
export type AdministrationData = {
  company: Record<string, string | null>;
  members: AdministrationMember[]; roles: AdministrationRole[];
  employees: { id: string; first_name: string; last_name: string; assignedUserId?: string | null }[];
  modules: { module: CompanyModule; enabled: boolean }[];
  feedback: { id: string; category: string; message: string; created_at: string; app_version?: string; page_path?: string; user_agent?: string }[];
  canManageMembers: boolean; canManageCompany: boolean; canManageRoles: boolean; platformAdmin: boolean; owner: boolean;
  memberTotal?: number;
};
export const permissionDomains: Record<string, string[]> = {
  "Allgemein": ["data.read", "data.write", "sync.write"],
  "Kunden & Objekte": ["customers.manage", "objects.manage"],
  "Aufträge & Berichte": ["jobs.manage"],
  "Ressourcen": ["resources.manage"], "Abrechnung": ["invoices.manage"],
  "Medien & Kommunikation": ["media.manage", "communication.send"],
  "Firma & Einstellungen": ["tenant.admin", "backups.manage"], "Benutzer & Rollen": ["members.manage", "roles.manage"],
};
export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validateCompany(value: unknown): CompanyInput {
  if (!value || typeof value !== "object") throw new Error("Firmendaten fehlen.");
  const v = value as Record<string, unknown>;
  for (const key of ["name", "country", "locale", "timezone", "organizationNumber", "vatNumber", "ownerEmail", "accountType", "pilotStartDate", "pilotEndDate", "contactPerson", "internalLabel", "notes"]) {
    if (typeof v[key] !== "string" || (v[key] as string).length > (key === "notes" ? 4000 : 254)) throw new Error("Ungültige Firmendaten.");
  }
  if (!(v.name as string).trim() || (v.name as string).length > 200 || !["SE", "DE", "AT", "CH", "GB", "US"].includes(v.country as string) || !["de", "sv", "en"].includes(v.locale as string)
    || !["production", "pilot", "demo"].includes(v.accountType as string) || !validEmail(v.ownerEmail)) throw new Error("Firma, Land, Sprache und Eigentümer-E-Mail prüfen.");
  try { new Intl.DateTimeFormat("en", { timeZone: v.timezone as string }); } catch { throw new Error("Ungültige Zeitzone."); }
  for (const key of ["pilotStartDate", "pilotEndDate"]) {
    const date = v[key] as string;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Pilotdatum prüfen.");
  }
  if (v.accountType === "pilot" && !v.pilotStartDate) throw new Error("Pilotbeginn fehlt.");
  if (v.pilotEndDate && (!v.pilotStartDate || (v.pilotEndDate as string) < (v.pilotStartDate as string))) throw new Error("Pilotende liegt vor dem Beginn.");
  if (!Array.isArray(v.modules) || new Set(v.modules).size !== v.modules.length || !v.modules.every(item => companyModules.includes(item))) throw new Error("Ungültige Modulauswahl.");
  return { ...v, name: (v.name as string).trim(), ownerEmail: (v.ownerEmail as string).trim().toLowerCase() } as CompanyInput;
}
export function feedbackPath(path: string) {
  // Only a fixed page category; never a query, customer ID, object title or URL fragment.
  const categories = ["/", "/administration", "/feedback", "/auth/accept", ...["dashboard", "objects", "customers", "jobs", "planning", "field", "tracking", "communication", "billing", "analytics", "inventory", "portal", "masterData"].map(section => `/app/${section}`)];
  return categories.includes(path) ? path : "/app";
}
