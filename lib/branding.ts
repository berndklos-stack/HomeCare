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
  claimSweden: "Full koll på jobbet",
};

export function companyCountryCode(settings: AppBrandingSettings, language: AppBrandLanguage) {
  const explicitCountry = settings.countryCode?.trim().toUpperCase();
  if (explicitCountry) return explicitCountry;
  if (/^SE/i.test(settings.vatNumber?.trim() ?? "")) return "SE";
  if (/\b(sverige|sweden|schweden)\b/i.test(settings.address ?? "")) return "SE";
  return language === "sv" ? "SE" : "";
}

export function resolveAppBranding(settings: AppBrandingSettings, language: AppBrandLanguage) {
  const swedishCompany = companyCountryCode(settings, language) === "SE";
  const brandName = language === "sv"
    ? settings.brandNameSweden?.trim() || defaultAppBranding.brandNameSweden
    : settings.brandNameInternational?.trim() || defaultAppBranding.brandNameInternational;
  const claim = language === "de"
    ? settings.claimGerman?.trim() || defaultAppBranding.claimGerman
    : language === "en"
      ? settings.claimEnglish?.trim() || defaultAppBranding.claimEnglish
      : settings.claimSweden?.trim() || defaultAppBranding.claimSweden;

  return { brandName, claim, countryCode: companyCountryCode(settings, language), swedishCompany };
}
