export type OnboardingStep =
  | "language"
  | "company"
  | "business"
  | "workspace"
  | "customer"
  | "object"
  | "job"
  | "team"
  | "pwa"
  | "complete";

export type OnboardingHelpKey = "billing" | "consulting" | "logbook";

export type OnboardingInstallPlatform = "android" | "desktop" | "ios";

export type OnboardingState = {
  businessTypeCompleted: boolean;
  businessTypes: string[];
  companyCompleted: boolean;
  completed: boolean;
  contextHelpDismissed: Partial<Record<OnboardingHelpKey, boolean>>;
  currentStep: OnboardingStep;
  firstCustomerCompleted: boolean;
  firstJobCompleted: boolean;
  firstObjectCompleted: boolean;
  firstStepsDismissed: boolean;
  language: "de" | "en" | "sv";
  languageCompleted: boolean;
  legacyInstallation: boolean;
  pwaInstallDismissed: boolean;
  pwaInstalled: boolean;
  teamStepCompleted: boolean;
  workspaceCompleted: boolean;
  workspaceTypes: string[];
};

export type OnboardingFacts = {
  companyComplete: boolean;
  customerCount: number;
  jobCount: number;
  objectCount: number;
  personnelCount: number;
};

export const onboardingSteps: OnboardingStep[] = [
  "language",
  "company",
  "business",
  "workspace",
  "customer",
  "object",
  "job",
  "team",
  "pwa",
  "complete",
];

export function defaultOnboardingState(language: OnboardingState["language"] = "de"): OnboardingState {
  return {
    businessTypeCompleted: false,
    businessTypes: [],
    companyCompleted: false,
    completed: false,
    contextHelpDismissed: {},
    currentStep: "language",
    firstCustomerCompleted: false,
    firstJobCompleted: false,
    firstObjectCompleted: false,
    firstStepsDismissed: false,
    language,
    languageCompleted: false,
    legacyInstallation: false,
    pwaInstallDismissed: false,
    pwaInstalled: false,
    teamStepCompleted: false,
    workspaceCompleted: false,
    workspaceTypes: [],
  };
}

export function normalizeOnboardingState(value: unknown, facts: OnboardingFacts, fallbackLanguage: OnboardingState["language"]): OnboardingState {
  const defaults = defaultOnboardingState(fallbackLanguage);
  const input = value && typeof value === "object" ? value as Partial<OnboardingState> : undefined;
  const hasProductiveData = facts.customerCount > 0 || facts.objectCount > 0 || facts.jobCount > 0;
  const legacyInstallation = !input && hasProductiveData;
  const language = input?.language === "sv" || input?.language === "en" || input?.language === "de"
    ? input.language
    : fallbackLanguage;

  return {
    ...defaults,
    ...input,
    businessTypes: Array.isArray(input?.businessTypes) ? input.businessTypes.filter((item): item is string => typeof item === "string") : [],
    companyCompleted: Boolean(input?.companyCompleted || facts.companyComplete),
    completed: input?.completed === true || legacyInstallation,
    contextHelpDismissed: input?.contextHelpDismissed && typeof input.contextHelpDismissed === "object" ? input.contextHelpDismissed : {},
    currentStep: onboardingSteps.includes(input?.currentStep as OnboardingStep) ? input?.currentStep as OnboardingStep : legacyInstallation ? "complete" : "language",
    firstCustomerCompleted: Boolean(input?.firstCustomerCompleted || facts.customerCount > 0),
    firstJobCompleted: Boolean(input?.firstJobCompleted || facts.jobCount > 0),
    firstObjectCompleted: Boolean(input?.firstObjectCompleted || facts.objectCount > 0),
    language,
    languageCompleted: Boolean(input?.languageCompleted || legacyInstallation),
    legacyInstallation: Boolean(input?.legacyInstallation || legacyInstallation),
    teamStepCompleted: Boolean(input?.teamStepCompleted || facts.personnelCount > 0),
    workspaceCompleted: Boolean(input?.workspaceCompleted || facts.objectCount > 0),
    workspaceTypes: Array.isArray(input?.workspaceTypes) ? input.workspaceTypes.filter((item): item is string => typeof item === "string") : [],
  };
}

export function onboardingStepIndex(step: OnboardingStep) {
  return Math.max(0, onboardingSteps.indexOf(step));
}

export function onboardingInstallPlatform(userAgent: string): OnboardingInstallPlatform {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
