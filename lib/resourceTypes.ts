export type ResourceCategory = "vehicle" | "machine" | "equipment";
export type ResourceField = { key: string; kind: "text" | "number" | "date" | "boolean" | "employee" | "country" | "language" | "intervalUnit"; labels: readonly [string, string, string] };
export const resourceFieldCatalog: ResourceField[] = [
  { key: "name", kind: "text", labels: ["Name", "Namn", "Name"] },
  { key: "identifier", kind: "text", labels: ["Inventarnummer", "Inventarienummer", "Inventory number"] },
  { key: "serialNumber", kind: "text", labels: ["Seriennummer", "Serienummer", "Serial number"] },
  { key: "licensePlate", kind: "text", labels: ["Kennzeichen", "Registreringsnummer", "License plate"] },
  { key: "brand", kind: "text", labels: ["Hersteller", "Tillverkare", "Manufacturer"] },
  { key: "model", kind: "text", labels: ["Modell", "Modell", "Model"] },
  { key: "buildYear", kind: "number", labels: ["Baujahr", "Tillverkningsår", "Year"] },
  { key: "purchaseDate", kind: "date", labels: ["Kaufdatum", "Inköpsdatum", "Purchase date"] },
  { key: "purchasePrice", kind: "number", labels: ["Kaufpreis", "Inköpspris", "Purchase price"] },
  { key: "currentOdometer", kind: "number", labels: ["Kilometerstand aktuell", "Aktuell mätarställning", "Current mileage"] },
  { key: "operatingHours", kind: "number", labels: ["Betriebsstunden", "Drifttimmar", "Operating hours"] },
  { key: "currentOdometerDate", kind: "date", labels: ["Datum Kilometerstand", "Mätarställningens datum", "Mileage reading date"] },
  { key: "operatingHoursDate", kind: "date", labels: ["Datum Betriebsstunden", "Drifttimmarnas datum", "Hours reading date"] },
  { key: "registrationCountry", kind: "text", labels: ["Land der Zulassung", "Registreringsland", "Registration country"] },
  { key: "taxCountry", kind: "country", labels: ["Steuerland Fahrtenbuch", "Skatteland körjournal", "Logbook tax country"] },
  { key: "ownerCompany", kind: "text", labels: ["Eigentümer / Firma", "Ägare / företag", "Owner company"] },
  { key: "defaultDriverId", kind: "employee", labels: ["Standardfahrer", "Standardförare", "Assigned driver"] },
  { key: "responsiblePersonId", kind: "employee", labels: ["Verantwortlicher Mitarbeiter", "Ansvarig medarbetare", "Assigned employee"] },
  { key: "location", kind: "text", labels: ["Standort", "Plats", "Location"] },
  { key: "status", kind: "text", labels: ["Status", "Status", "Status"] },
  { key: "warrantyUntil", kind: "date", labels: ["Garantie bis", "Garanti till", "Warranty until"] },
  { key: "warrantyNotes", kind: "text", labels: ["Garantieinformationen", "Garantiinformation", "Warranty information"] },
  { key: "logbookActive", kind: "boolean", labels: ["Fahrtenbuch aktiv", "Körjournal aktiv", "Logbook active"] },
  { key: "logbookLanguage", kind: "language", labels: ["Fahrtenbuchsprache", "Körjournalens språk", "Logbook language"] },
  { key: "privateUseAllowed", kind: "boolean", labels: ["Privatnutzung erlaubt", "Privat användning tillåten", "Private use allowed"] },
  { key: "maintenanceIntervalValue", kind: "number", labels: ["Wartungsintervall", "Underhållsintervall", "Maintenance interval"] },
  { key: "maintenanceIntervalUnit", kind: "intervalUnit", labels: ["Intervalleinheit", "Intervallenhet", "Interval unit"] },
  { key: "notes", kind: "text", labels: ["Notizen", "Anteckningar", "Notes"] },
  { key: "logbookYear", kind: "number", labels: ["Fahrtenbuchjahr", "Körjournalår", "Logbook year"] },
  { key: "odometerYearStart", kind: "number", labels: ["Km-Stand Jahresbeginn", "Mätarställning vid årets början", "Mileage at year start"] },
  { key: "odometerYearEnd", kind: "number", labels: ["Km-Stand Jahresende", "Mätarställning vid årets slut", "Mileage at year end"] },
  { key: "trackingMode", kind: "text", labels: ["Tracking-Modus", "Spårningsläge", "Tracking mode"] },
  { key: "trackerProvider", kind: "text", labels: ["Tracker-Anbieter", "Spårningsleverantör", "Tracker provider"] },
  { key: "trackerDeviceId", kind: "text", labels: ["Tracker-ID", "Spårnings-ID", "Tracker ID"] },
];
export type ResourceTypeField = { key: string; enabled: boolean; required: boolean; order: number };
export type ResourceType = { id: string; name: string; category: ResourceCategory; revision?: number; archived: boolean; fields: ResourceTypeField[] };
export const resourceTypesText = {
  title: ["Ressourcentypen", "Resurstyper", "Resource types"], type: ["Ressourcentyp", "Resurstyp", "Resource type"],
  new: ["Neuer Ressourcentyp", "Ny resurstyp", "New resource type"], fields: ["Felder", "Fält", "Fields"],
  enabled: ["Aktiviert", "Aktiverat", "Enabled"], required: ["Pflichtfeld", "Obligatoriskt", "Required"], order: ["Reihenfolge", "Ordning", "Order"],
  category: ["Technische Kategorie", "Teknisk kategori", "Technical category"],
  choose: ["Typ auswählen", "Välj typ", "Select type"], unavailable: ["Ressourcentypen konnten nicht geladen werden. Bitte erneut versuchen.", "Resurstyper kunde inte hämtas. Försök igen.", "Resource types could not be loaded. Please retry."],
  vehicle: ["Fahrzeug", "Fordon", "Vehicle"], machine: ["Maschine", "Maskin", "Machine"], equipment: ["Gerät", "Utrustning", "Equipment"],
  days: ["Tage", "Dagar", "Days"], hours: ["Stunden", "Timmar", "Hours"], km: ["Kilometer", "Kilometer", "Kilometers"],
} as const;
export const resourceLanguageIndex = (language: string) => language === "sv" ? 1 : language === "en" ? 2 : 0;
export const legacyResourceCategory = (type: string): ResourceCategory => type === "Fahrzeug" ? "vehicle" : type === "Maschine" ? "machine" : "equipment";
export const legacyResourceType = (category: ResourceCategory) => category === "vehicle" ? "Fahrzeug" : category === "machine" ? "Maschine" : "Gerät";
export function resourceIsVehicle<T extends { type?: string; resourceTypeCategory?: string }>(resource: T | undefined | null): resource is T & { type: "Fahrzeug" } {
  return Boolean(resource && (resource.resourceTypeCategory ? resource.resourceTypeCategory === "vehicle" : resource.type === "Fahrzeug"));
}
const common = ["name", "identifier", "brand", "model", "buildYear", "status", "responsiblePersonId", "location", "notes"];
const vehicle = [...common, "licensePlate", "currentOdometer", "currentOdometerDate", "registrationCountry", "taxCountry", "ownerCompany", "defaultDriverId", "logbookActive", "logbookLanguage", "privateUseAllowed", "logbookYear", "odometerYearStart", "odometerYearEnd", "trackingMode", "trackerProvider", "trackerDeviceId"];
const machine = [...common, "serialNumber", "operatingHours", "operatingHoursDate", "maintenanceIntervalValue", "maintenanceIntervalUnit"];
export const defaultResourceTypes: ResourceType[] = [
  ["Fahrzeug", "vehicle", vehicle], ["Anhänger", "equipment", [...common, "licensePlate", "serialNumber"]],
  ["Rasenmäher", "machine", machine], ["Maschine", "machine", machine],
  ["Werkzeug", "equipment", [...common, "serialNumber"]], ["Gerät", "equipment", [...common, "serialNumber"]], ["Sonstiges", "equipment", common],
].map(([name, category, keys], index) => ({ id: `00000000-0000-4000-8000-00000000000${index + 1}`, name: name as string,
  category: category as ResourceCategory, archived: false, fields: resourceFieldCatalog.map((field, order) => ({ key: field.key, enabled: (keys as string[]).includes(field.key), required: field.key === "name", order })) }));
export function visibleResourceFields(type: ResourceType) {
  return type.fields.filter((field) => field.enabled).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((setting) => ({ ...resourceFieldCatalog.find((field) => field.key === setting.key)!, ...setting }));
}
export function validateResourceType(value: unknown): asserts value is ResourceType {
  const type = value as ResourceType;
  if (!type || typeof type.name !== "string" || !type.name.trim() || type.name.length > 200 || !["vehicle", "machine", "equipment"].includes(type.category)
    || typeof type.archived !== "boolean" || !Array.isArray(type.fields) || type.fields.length !== resourceFieldCatalog.length) throw new Error("INVALID_RESOURCE_TYPE");
  const seen = new Set<string>();
  for (const field of type.fields) {
    if (!resourceFieldCatalog.some((catalog) => catalog.key === field.key) || seen.has(field.key) || typeof field.enabled !== "boolean"
      || typeof field.required !== "boolean" || !Number.isInteger(field.order) || field.order < 0 || field.order > 1000
      || (!field.enabled && field.required) || (field.key === "name" && (!field.enabled || !field.required))) throw new Error("INVALID_RESOURCE_TYPE_FIELDS");
    seen.add(field.key);
  }
}
export function missingResourceFields(type: ResourceType, values: Record<string, unknown>) {
  return visibleResourceFields(type).filter((field) => field.required && (values[field.key] == null || String(values[field.key]).trim() === ""));
}
