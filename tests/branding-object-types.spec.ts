import { expect, test } from "@playwright/test";
import { resolveAppBranding } from "../lib/branding";
import { defaultObjectTypeDefinitions, normalizeObjectTypeDefinitions } from "../lib/objectTypes";

test("Branding wird aus der gewählten Sprache zentral aufgelöst", () => {
  expect(resolveAppBranding({ countryCode: "SE" }, "sv")).toMatchObject({
    brandName: "Koll",
    claim: "Full koll på jobbet",
  });
  expect(resolveAppBranding({ countryCode: "SE" }, "de")).toMatchObject({
    brandName: "WorkCore",
    claim: "Aufträge. Projekte. Service. Abrechnung.",
  });
  expect(resolveAppBranding({ countryCode: "SE" }, "en")).toMatchObject({
    brandName: "WorkCore",
    claim: "Jobs. Projects. Service. Billing.",
  });
  expect(resolveAppBranding({ countryCode: "DE" }, "sv")).toMatchObject({
    brandName: "Koll",
    claim: "Full koll på jobbet",
  });
  expect(resolveAppBranding({ countryCode: "DE" }, "en")).toMatchObject({
    brandName: "WorkCore",
    claim: "Jobs. Projects. Service. Billing.",
  });
  expect(resolveAppBranding({
    brandNameInternational: "FieldSuite",
    claimGerman: "Alles im Blick.",
    countryCode: "DE",
  }, "de")).toMatchObject({ brandName: "FieldSuite", claim: "Alles im Blick." });
});

test("Objekttypen erhalten robuste Standardfelder", () => {
  const definitions = normalizeObjectTypeDefinitions(undefined);
  expect(definitions).toEqual(defaultObjectTypeDefinitions);
  expect(definitions.find((definition) => definition.id === "Projekt")?.fieldGroups).toContain("project");
  expect(definitions.find((definition) => definition.id === "Projekt")?.fieldGroups).not.toContain("property");
  expect(definitions.find((definition) => definition.id === "Anlage")?.fieldGroups).toContain("asset");
});

test("Branding und Objekttyp bleiben nach dem Speichern erhalten", async ({ page }) => {
  const [originalSectionsResponse, originalStateResponse] = await Promise.all([
    page.request.get("/api/sync-sections?keys=companySettings,objects,customers,jobs"),
    page.request.get("/api/app-state"),
  ]);
  const originalSections = await originalSectionsResponse.json() as { data: Record<string, { updatedAt?: string; value: unknown }> };
  const originalState = await originalStateResponse.json();
  const isolatedSections = structuredClone(originalSections.data);
  const updatedAt = new Date(Date.now() + 60_000).toISOString();
  const testCustomer = {
    id: "CUS-TEST-CONSULTING",
    name: "Consulting Kunde",
    contact: "Test Kontakt",
    email: "consulting@example.com",
    phone: "",
    address: "Testweg 1, 382 30 Nybro",
    language: "Deutsch",
    portalLoginEmail: "consulting@example.com",
    portalPassword: "",
    portalLoginHistory: [],
    objects: ["OBJ-TEST-CONSULTING"],
    balance: "0 SEK",
    portalStatus: "aktiv",
    notes: "",
    reportMailBody: "",
  };
  const testObject = {
    id: "OBJ-TEST-CONSULTING",
    name: "Consulting Projekt",
    ownerCustomerId: testCustomer.id,
    owner: testCustomer.name,
    ownerEmail: testCustomer.email,
    ownerPhone: "",
    ownerAddress: testCustomer.address,
    address: "Testweg 1, 382 30 Nybro",
    billingAddressMode: "Eigentümeradresse",
    billingAddress: testCustomer.address,
    region: "Nybro",
    sizeSqm: 0,
    plotSqm: 0,
    rooms: 0,
    beds: 0,
    bathrooms: 0,
    buildYear: 0,
    carePackage: "Basis",
    customFields: {},
    status: "aktiv",
    type: "Projekt",
    access: { keySafe: "", alarm: "", parking: "", notes: "" },
    equipment: [],
    utilities: { heating: "", water: "", septic: "", internet: "" },
    risks: [],
    media: { images: 0, documents: 0, floorPlans: 0, items: [] },
    nextVisit: "",
    lastVisit: "",
  };
  const consultingJob = {
    id: "JOB-TEST-CONSULTING",
    title: "Auswahlabrechnung Test",
    objectId: testObject.id,
    customerId: testCustomer.id,
    type: "Consulting",
    status: "in Arbeit",
    priority: "normal",
    dueDate: "2026-09-01",
    startDate: "2026-09-01",
    assignedTo: "Bernd Klos",
    description: "Test der selektiven Abrechnung",
    internalNotes: "",
    billable: true,
    material: "",
    workMinutes: 0,
    resourceIds: [],
    materialItems: [],
    checklist: [],
    serviceIds: [],
    serviceQuantities: {},
    serviceDiscounts: {},
    customService: null,
    schedule: { type: "einmalig" },
    consulting: {
      enabled: true,
      openEnded: true,
      hourlyRate: "1000",
      currency: "SEK",
      invoiceText: "Consulting",
      entries: [
        { id: "CT-1", date: "2026-09-10", startTime: "08:00", endTime: "09:00", minutes: 60, description: "Analyse", billingStatus: "offen" },
        { id: "CT-2", date: "2026-09-15", startTime: "10:00", endTime: "11:30", minutes: 90, description: "Besprechung", billingStatus: "offen" },
        { id: "CT-3", date: "2026-10-01", startTime: "12:00", endTime: "13:00", minutes: 60, description: "Zukünftige Position", billingStatus: "offen" },
      ],
    },
  };
  isolatedSections.customers = { updatedAt, value: [testCustomer, ...((isolatedSections.customers?.value as unknown[]) ?? [])] };
  isolatedSections.objects = { updatedAt, value: [testObject, ...((isolatedSections.objects?.value as unknown[]) ?? [])] };
  isolatedSections.jobs = { updatedAt, value: [consultingJob, ...((isolatedSections.jobs?.value as unknown[]) ?? [])] };
  const isolatedState = structuredClone(originalState);
  isolatedState.data = {
    ...isolatedState.data,
    customers: [testCustomer, ...(isolatedState.data?.customers ?? [])],
    objects: [testObject, ...(isolatedState.data?.objects ?? [])],
    jobs: [consultingJob, ...(isolatedState.data?.jobs ?? [])],
  };

  await page.route("**/api/app-state", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(isolatedState) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }) });
  });
  await page.route("**/api/sync-sections**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { patch?: Record<string, unknown> };
      const updatedAt = new Date().toISOString();
      Object.entries(body.patch ?? {}).forEach(([key, value]) => {
        isolatedSections[key] = { updatedAt, value };
      });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, updatedAt }) });
      return;
    }
    const keys = new URL(route.request().url()).searchParams.get("keys")?.split(",") ?? Object.keys(isolatedSections);
    const data = Object.fromEntries(keys.filter((key) => isolatedSections[key]).map((key) => [key, isolatedSections[key]]));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.addInitScript(({ customers, jobs, objects, updatedAt }) => {
    if (!window.localStorage.getItem("kolaretorp-customers")) {
      window.localStorage.setItem("kolaretorp-customers", JSON.stringify(customers));
    }
    if (!window.localStorage.getItem("kolaretorp-jobs")) {
      window.localStorage.setItem("kolaretorp-jobs", JSON.stringify(jobs));
    }
    if (!window.localStorage.getItem("kolaretorp-objects")) {
      window.localStorage.setItem("kolaretorp-objects", JSON.stringify(objects));
    }
    if (!window.localStorage.getItem("kolaretorp-updated-at")) {
      window.localStorage.setItem("kolaretorp-updated-at", JSON.stringify(updatedAt));
    }
  }, {
    customers: isolatedState.data.customers,
    jobs: isolatedState.data.jobs,
    objects: isolatedState.data.objects,
    updatedAt,
  });

  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "WorkCore" })).toBeVisible();
  await expect(page.getByText("Aufträge. Projekte. Service. Abrechnung.", { exact: true })).toBeVisible();
  await page.getByLabel("Sprache").selectOption("sv");
  await expect(page.getByRole("heading", { name: "Koll" })).toBeVisible();
  await expect(page.getByText("Full koll på jobbet", { exact: true })).toBeVisible();
  await page.getByLabel("Språk").selectOption("de");
  await expect(page.getByRole("heading", { name: "WorkCore" })).toBeVisible();

  await page.getByTestId("nav-planning").click();
  const ongoingPanel = page.locator(".dispatch-ongoing-panel");
  await expect(ongoingPanel.getByText("Laufende Daueraufträge", { exact: true })).toBeVisible();
  const consultingPlanningCard = ongoingPanel.locator(".dispatch-ongoing-card").filter({ hasText: "Auswahlabrechnung Test" });
  await expect(consultingPlanningCard).toBeVisible();
  await expect(consultingPlanningCard).toContainText("3,50 h");
  await expect(page.locator(".dispatch-overdue").getByText("Auswahlabrechnung Test", { exact: true })).toHaveCount(0);

  await page.getByTestId("nav-jobs").click();
  const consultingRow = page.locator(".job-row").filter({ hasText: "Auswahlabrechnung Test" });
  await expect(consultingRow).toBeVisible();
  await consultingRow.getByRole("button", { name: "Offene Leistungen abrechnen", exact: true }).click();
  const billingDialog = page.getByRole("dialog", { name: "Offene Leistungen abrechnen" });
  await expect(billingDialog).toBeVisible();
  await expect(billingDialog.getByText("2 Positionen ausgewählt", { exact: false })).toBeVisible();
  await expect(billingDialog.getByText("Zukünftige Position", { exact: true }).locator("xpath=ancestor::label").getByRole("checkbox")).toBeDisabled();
  await billingDialog.getByText("Besprechung", { exact: true }).locator("xpath=ancestor::label").getByRole("checkbox").uncheck();
  await expect(billingDialog.getByText("1 Positionen ausgewählt", { exact: false })).toBeVisible();
  await billingDialog.getByRole("button", { name: "Ausgewählte Positionen abrechnen", exact: true }).click();
  await expect(consultingRow).toContainText("Offen: 2,50 h");

  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "System / Branding", exact: true }).click();
  await expect(page.getByRole("button", { name: "Einrichtungsassistent öffnen", exact: true })).toBeVisible();
  await page.getByLabel("Internationaler Markenname").fill("FieldSuite");
  await page.getByLabel("Deutscher Claim").fill("Alles im Blick.");
  await page.getByRole("button", { name: "Branding speichern", exact: true }).click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  await page.getByLabel("Unternehmensland (ISO)").fill("DE");
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect(page.getByRole("heading", { name: "FieldSuite" })).toBeVisible();
  await expect(page.getByText("Alles im Blick.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Projekt-/Objekttypen", exact: true }).click();
  const projectTypeCard = page.getByLabel("Deutsch Projekt").locator("xpath=ancestor::article");
  await page.getByLabel("Deutsch Projekt").fill("Kundenprojekt");
  await projectTypeCard.getByText("Felder bearbeiten", { exact: true }).click();
  await projectTypeCard.getByLabel("Feldname Projekt projectManager").fill("Verantwortlich");
  const projectFieldsBlock = projectTypeCard.locator(".object-type-block").filter({ hasText: "Projektangaben" });
  await projectFieldsBlock.getByRole("button", { name: "Feld hinzufügen", exact: true }).click();
  await projectFieldsBlock.getByRole("textbox").last().fill("Auftragsnummer");
  await page.getByRole("button", { name: "Projekt-/Objekttypen speichern", exact: true }).click();

  await page.getByTestId("nav-objects").click();
  await page.getByRole("button", { name: "Neues Projekt / Objekt", exact: true }).click();
  await page.getByLabel("Typ").selectOption("Projekt");
  await expect(page.getByLabel("Projektbeginn")).toBeVisible();
  await expect(page.getByLabel("Größe m²")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Kundenprojekt", exact: true }).fill("Logistik-Hub Süddeutschland");
  await page.getByLabel("Verantwortlich").fill("Bernd Klos");
  await page.getByLabel("Auftragsnummer").fill("AUF-42");
  await page.getByRole("button", { name: "Kundenprojekt anlegen", exact: true }).click();
  await expect(page.getByText("Kundenprojekt · Logistik-Hub Süddeutschland", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-ready", "true", { timeout: 2_000 });
  await expect(page.getByRole("heading", { name: "FieldSuite" })).toBeVisible();
  await page.getByTestId("nav-objects").click();
  const projectRow = page.getByText("Kundenprojekt · Logistik-Hub Süddeutschland", { exact: true });
  await expect(projectRow).toBeVisible();
  await projectRow.click();
  await expect(page.getByLabel("Verantwortlich")).toHaveValue("Bernd Klos");
  await expect(page.getByLabel("Auftragsnummer")).toHaveValue("AUF-42");
  await expect(page.getByRole("button", { name: "Kundenprojekt speichern", exact: true })).toBeVisible();

  await page.getByTestId("nav-customers").click();
  await page.getByRole("button", { name: "Neuer Kunde", exact: true }).click();
  await page.getByLabel("Firma", { exact: true }).fill("Musterbau AB");
  await page.getByLabel("Vorname", { exact: true }).fill("Erika");
  await page.getByLabel("Nachname", { exact: true }).fill("Muster");
  await page.getByRole("button", { name: "Kunde anlegen", exact: true }).click();
  await expect(page.getByText("Musterbau AB", { exact: true })).toBeVisible();
  await expect(page.getByText(/Erika Muster/)).toBeVisible();

});

test("Kundenportal zeigt keine Branding-Administration", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByRole("button", { name: "System / Branding", exact: true })).toHaveCount(0);
});
