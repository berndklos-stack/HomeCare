export type AppBrandLanguage = "de" | "sv" | "en";

export type AppBrandingSettings = {
  address?: string;
  brandNameInternational?: string;
  brandNameSweden?: string;
  claimEnglish?: string;
  claimGerman?: string;
  claimSweden?: string;
  countryCode?: string;
  vatNumber?: string;
};

export const defaultAppBranding = {
  brandNameInternational: "WorkCore",
  brandNameSweden: "Koll",
  claimEnglish: "Jobs. Projects. Service. Billing.",
  claimGerman: "Aufträge. Projekte. Service. Abrechnung.",
  claimSweden: "Full koll på jobbet.",
};

export function companyCountryCode(settings: AppBrandingSettings, _language?: AppBrandLanguage) {
  const explicitCountry = settings.countryCode?.trim().toUpperCase();
  if (["SE", "SWE", "SWEDEN", "SVERIGE", "SCHWEDEN"].includes(explicitCountry ?? "")) return "SE";
  if (explicitCountry) return explicitCountry;
  if (/^SE/i.test(settings.vatNumber?.trim() ?? "")) return "SE";
  if (/\b(sverige|sweden|schweden)\b/i.test(settings.address ?? "")) return "SE";
  return "";
}

export function resolveAppBranding(settings: AppBrandingSettings, language: AppBrandLanguage) {
  const countryCode = companyCountryCode(settings, language);
  const swedishCompany = countryCode === "SE";
  const brandName = swedishCompany
    ? settings.brandNameSweden?.trim() || defaultAppBranding.brandNameSweden
    : settings.brandNameInternational?.trim() || defaultAppBranding.brandNameInternational;
  const configuredSwedishClaim = settings.claimSweden?.trim();
  const claim = swedishCompany
    ? configuredSwedishClaim && configuredSwedishClaim !== "Full koll på jobbet"
      ? configuredSwedishClaim
      : defaultAppBranding.claimSweden
    : countryCode === "DE"
      ? settings.claimGerman?.trim() || defaultAppBranding.claimGerman
      : settings.claimEnglish?.trim() || defaultAppBranding.claimEnglish;

  return { brandName, claim, countryCode, swedishCompany };
}
