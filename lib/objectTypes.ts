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

export type ObjectTypeDefinition = {
  active: boolean;
  fieldGroups: ObjectFieldGroup[];
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
      fieldGroups: Array.from(new Set(fieldGroups)),
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
