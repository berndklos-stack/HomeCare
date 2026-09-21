import { expect, test } from "@playwright/test";
import { defaultOnboardingState, normalizeOnboardingState, onboardingInstallPlatform, onboardingSteps } from "../lib/onboarding";

test("neue Installation startet ohne Demo-Fortschritt bei der Sprache", () => {
  const state = normalizeOnboardingState(undefined, {
    companyComplete: false,
    customerCount: 0,
    jobCount: 0,
    objectCount: 0,
    personnelCount: 0,
  }, "sv");

  expect(state).toMatchObject({
    completed: false,
    currentStep: "language",
    firstCustomerCompleted: false,
    firstJobCompleted: false,
    firstObjectCompleted: false,
    language: "sv",
    legacyInstallation: false,
  });
  expect(onboardingSteps).toHaveLength(10);
});

test("neue deutsche und englische Installationen übernehmen die gewählte Sprache", () => {
  const facts = { companyComplete: false, customerCount: 0, jobCount: 0, objectCount: 0, personnelCount: 0 };
  expect(normalizeOnboardingState(undefined, facts, "de").language).toBe("de");
  expect(normalizeOnboardingState(undefined, facts, "en").language).toBe("en");
});

test("bestehende produktive Installation wird nicht erneut blockiert", () => {
  const state = normalizeOnboardingState(undefined, {
    companyComplete: true,
    customerCount: 3,
    jobCount: 5,
    objectCount: 2,
    personnelCount: 1,
  }, "de");

  expect(state).toMatchObject({
    companyCompleted: true,
    completed: true,
    currentStep: "complete",
    firstCustomerCompleted: true,
    firstJobCompleted: true,
    firstObjectCompleted: true,
    legacyInstallation: true,
    teamStepCompleted: true,
    workspaceCompleted: true,
  });
});

test("unterbrochener Fortschritt bleibt erhalten und vorhandene Daten erfüllen Schritte", () => {
  const interrupted = {
    ...defaultOnboardingState("en"),
    businessTypeCompleted: true,
    businessTypes: ["Consulting"],
    companyCompleted: true,
    currentStep: "object" as const,
    languageCompleted: true,
  };
  const state = normalizeOnboardingState(interrupted, {
    companyComplete: true,
    customerCount: 1,
    jobCount: 0,
    objectCount: 0,
    personnelCount: 0,
  }, "de");

  expect(state.currentStep).toBe("object");
  expect(state.language).toBe("en");
  expect(state.businessTypes).toEqual(["Consulting"]);
  expect(state.firstCustomerCompleted).toBe(true);
  expect(state.firstObjectCompleted).toBe(false);
  expect(state.completed).toBe(false);
});

test("Installationshinweise erkennen iOS, Android und Desktop eindeutig", () => {
  expect(onboardingInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
  expect(onboardingInstallPlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
  expect(onboardingInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
});

test("Dashboard einer bestehenden Installation bleibt ohne blockierenden Wizard erreichbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(page.getByRole("dialog", { name: /Willkommen|Välkommen|Welcome/ })).toHaveCount(0);
  await expect(page.getByText("Einrichtungshilfe verfügbar", { exact: true })).toBeVisible();
});

test("freiwillig gestartetes Onboarding wechselt die Sprache und wird nach Neustart fortgesetzt", async ({ page }) => {
  await page.route("**/api/sync-sections", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.continue();
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Einrichtung öffnen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Svenska" }).click();
  await expect(page.getByRole("heading", { name: "Välkommen till Koll" })).toBeVisible();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Konfigurera företaget" })).toBeVisible();

  const overflow = await page.locator(".onboarding-wizard").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  await page.getByRole("button", { name: "Fortsätt senare" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Konfigurera företaget" })).toBeVisible({ timeout: 5_000 });
});

test("Projekt und erster Consulting-Auftrag lassen sich mit optionalen Schritten einrichten", async ({ page }) => {
  await page.route("**/api/sync-sections", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await page.getByRole("button", { name: "Einrichtung öffnen" }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Speichern & weiter" }).click();
  await page.getByRole("button", { name: "Handwerk", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Projekt", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Überspringen" }).click();

  await page.getByLabel("Typ").selectOption({ label: "Projekt" });
  await page.getByLabel("Name", { exact: true }).fill("Onboarding Projekt");
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();

  await page.getByLabel("Auftragstitel").fill("Onboarding Consulting");
  await page.getByRole("checkbox", { name: /Laufender Auftrag/ }).check();
  await page.getByLabel("Stundensatz").fill("950");
  await page.getByLabel("Rechnungstext").fill("Beratung und Projektbegleitung");
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Mitarbeiter hinzufügen" })).toBeVisible();
  await page.getByRole("button", { name: "Das mache ich später" }).click();
  await expect(page.getByRole("heading", { name: "App installieren" })).toBeVisible();
  await page.getByRole("button", { name: "Später", exact: true }).click();

  await expect(page.getByText("Projekt / Objekt angelegt", { exact: true })).toBeVisible();
  await expect(page.getByText("Erster Auftrag erstellt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zum Dashboard" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
