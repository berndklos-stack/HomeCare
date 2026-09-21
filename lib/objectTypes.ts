export type ObjectFieldGroup =
  | "customer"
  | "address"
  | "billing"
  | "property"
  | "project"
  | "asset"
  | "service"
  | "access"
  | "utilities"
  | "equipment"
  | "risks"
  | "planning"
  | "documentation";

export type ObjectFieldInputType = "text" | "number" | "date" | "textarea";

export type ObjectTypeCustomField = {
  active: boolean;
  group: ObjectFieldGroup;
  id: string;
  inputType: ObjectFieldInputType;
  names: {
    de: string;
    en: string;
    sv: string;
  };
};

export type ObjectTypeDefinition = {
  active: boolean;
  customFields?: ObjectTypeCustomField[];
  fieldGroups: ObjectFieldGroup[];
  fieldLabels?: Record<string, Partial<Record<"de" | "sv" | "en", string>>>;
  hiddenFields?: string[];
  id: string;
  names: {
    de: string;
    en: string;
    sv: string;
  };
};

export const objectFieldGroups: Array<{ id: ObjectFieldGroup; label: string }> = [
  { id: "customer", label: "Kunde / Eigentümer" },
  { id: "address", label: "Adresse / Region" },
  { id: "billing", label: "Rechnungsadresse" },
  { id: "property", label: "Gebäude / Flächen" },
  { id: "project", label: "Projektangaben" },
  { id: "asset", label: "Anlagendaten" },
  { id: "service", label: "Betreuungspaket" },
  { id: "access", label: "Zugang" },
  { id: "utilities", label: "Technik / Versorgung" },
  { id: "equipment", label: "Ausstattung" },
  { id: "risks", label: "Hinweise / Risiken" },
  { id: "planning", label: "Planung / Besuche" },
  { id: "documentation", label: "Fotos / Dokumente" },
];

export const objectTypeBuiltInFields: Array<{ group: ObjectFieldGroup; id: string; label: string }> = [
  { group: "customer", id: "ownerCustomerId", label: "Kunde / Eigentümer auswählen" },
  { group: "customer", id: "owner", label: "Kunde / Eigentümer" },
  { group: "customer", id: "ownerEmail", label: "E-Mail" },
  { group: "customer", id: "ownerPhone", label: "Telefon" },
  { group: "customer", id: "ownerAddress", label: "Kunden-/Eigentümeradresse" },
  { group: "address", id: "region", label: "Ort/Region" },
  { group: "address", id: "address", label: "Projekt-/Objektadresse" },
  { group: "billing", id: "billingAddressMode", label: "Rechnungsadresse verwenden" },
  { group: "billing", id: "billingAddress", label: "Rechnungsadresse" },
  { group: "property", id: "sizeSqm", label: "Größe m²" },
  { group: "property", id: "plotSqm", label: "Grundstück m²" },
  { group: "property", id: "buildYear", label: "Baujahr" },
  { group: "property", id: "rooms", label: "Zimmer" },
  { group: "property", id: "beds", label: "Betten" },
  { group: "property", id: "bathrooms", label: "Bäder" },
  { group: "project", id: "projectStart", label: "Projektbeginn" },
  { group: "project", id: "projectEnd", label: "Projektende" },
  { group: "project", id: "projectManager", label: "Projektleitung" },
  { group: "project", id: "budget", label: "Budget" },
  { group: "asset", id: "manufacturer", label: "Hersteller" },
  { group: "asset", id: "model", label: "Modell" },
  { group: "asset", id: "serialNumber", label: "Seriennummer" },
  { group: "asset", id: "maintenanceInterval", label: "Wartungsintervall" },
  { group: "service", id: "carePackage", label: "Betreuungspaket" },
  { group: "access", id: "keySafe", label: "Zugang / Schlüssel" },
  { group: "access", id: "alarm", label: "Alarmanlage" },
  { group: "access", id: "parking", label: "Parken" },
  { group: "access", id: "accessNotes", label: "Zugangshinweise" },
  { group: "utilities", id: "heating", label: "Heizung" },
  { group: "utilities", id: "water", label: "Wasser" },
  { group: "utilities", id: "septic", label: "Abwasser" },
  { group: "utilities", id: "internet", label: "Internet" },
  { group: "equipment", id: "equipment", label: "Ausstattung" },
  { group: "risks", id: "risks", label: "Hinweise / Risiken" },
  { group: "planning", id: "lastVisit", label: "Letzter Besuch" },
  { group: "planning", id: "nextVisit", label: "Nächster Besuch" },
  { group: "documentation", id: "photos", label: "Fotos zum Objekt" },
  { group: "documentation", id: "documents", label: "Dokumente zum Objekt" },
];

const commonGroups: ObjectFieldGroup[] = ["customer", "address", "billing", "planning", "documentation"];

export const defaultObjectTypeDefinitions: ObjectTypeDefinition[] = [
  {
    active: true,
    fieldGroups: [...commonGroups, "property", "service", "access", "utilities", "equipment", "risks"],
    id: "Objekt",
    names: { de: "Objekt", en: "Object", sv: "Objekt" },
  },
  {
    active: true,
    fieldGroups: [...commonGroups, "project", "service", "equipment", "risks"],
    id: "Projekt",
    names: { de: "Projekt", en: "Project", sv: "Projekt" },
  },
  {
    active: true,
    fieldGroups: [...commonGroups, "project", "access", "equipment", "risks"],
    id: "Baustelle",
    names: { de: "Baustelle", en: "Construction site", sv: "Byggplats" },
  },
  {
    active: true,
    fieldGroups: [...commonGroups, "access", "utilities", "equipment", "risks"],
    id: "Standort",
    names: { de: "Standort", en: "Location", sv: "Plats" },
  },
  {
    active: true,
    fieldGroups: [...commonGroups, "asset", "access", "utilities", "equipment", "risks"],
    id: "Anlage",
    names: { de: "Anlage", en: "Asset", sv: "Anläggning" },
  },
  {
    active: true,
    fieldGroups: [...commonGroups, "equipment", "risks"],
    id: "Sonstiges",
    names: { de: "Sonstiges", en: "Other", sv: "Övrigt" },
  },
];

export function normalizeObjectTypeDefinitions(value: unknown): ObjectTypeDefinition[] {
  if (!Array.isArray(value) || value.length === 0) return defaultObjectTypeDefinitions;

  const validGroups = new Set(objectFieldGroups.map((group) => group.id));
  const normalized = value.flatMap((item): ObjectTypeDefinition[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ObjectTypeDefinition>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    if (!id) return [];
    const fallback = defaultObjectTypeDefinitions.find((definition) => definition.id === id);
    const names = candidate.names && typeof candidate.names === "object" ? candidate.names : fallback?.names;
    const fieldGroups = Array.isArray(candidate.fieldGroups)
      ? candidate.fieldGroups.filter((group): group is ObjectFieldGroup => validGroups.has(group as ObjectFieldGroup))
      : fallback?.fieldGroups ?? commonGroups;

    return [{
      active: candidate.active !== false,
      customFields: Array.isArray(candidate.customFields)
        ? candidate.customFields.flatMap((field): ObjectTypeCustomField[] => {
            if (!field || typeof field !== "object") return [];
            const customField = field as Partial<ObjectTypeCustomField>;
            const fieldId = typeof customField.id === "string" ? customField.id.trim() : "";
            if (!fieldId || !validGroups.has(customField.group as ObjectFieldGroup)) return [];
            const inputType = ["text", "number", "date", "textarea"].includes(String(customField.inputType))
              ? customField.inputType as ObjectFieldInputType
              : "text";
            return [{
              active: customField.active !== false,
              group: customField.group as ObjectFieldGroup,
              id: fieldId,
              inputType,
              names: {
                de: customField.names?.de || "Neues Feld",
                en: customField.names?.en || customField.names?.de || "New field",
                sv: customField.names?.sv || customField.names?.de || "Nytt fält",
              },
            }];
          })
        : [],
      fieldGroups: Array.from(new Set(fieldGroups)),
      fieldLabels: candidate.fieldLabels && typeof candidate.fieldLabels === "object" ? candidate.fieldLabels : {},
      hiddenFields: Array.isArray(candidate.hiddenFields) ? candidate.hiddenFields.filter((field): field is string => typeof field === "string") : [],
      id,
      names: {
        de: typeof names?.de === "string" && names.de.trim() ? names.de.trim() : id,
        en: typeof names?.en === "string" && names.en.trim() ? names.en.trim() : id,
        sv: typeof names?.sv === "string" && names.sv.trim() ? names.sv.trim() : id,
      },
    }];
  });

  return normalized.length > 0 ? normalized : defaultObjectTypeDefinitions;
}

export function objectTypeName(definitions: ObjectTypeDefinition[], id: string | undefined, language: "de" | "sv" | "en") {
  const definition = definitions.find((item) => item.id === id);
  return definition?.names[language] || id || definitions[0]?.names[language] || "Objekt";
}
