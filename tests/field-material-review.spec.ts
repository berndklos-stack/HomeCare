import { expect, test, type Page } from "@playwright/test";
import { reviewedStockMaterials } from "../lib/fieldMaterialReview";
import { billableJobMaterials } from "../lib/jobStock";

test("Nicht verbrauchtes Material ersetzt die Planmenge mit null statt abgerechnet zu werden", () => {
  const material = { name: "Latten", unit: "Meter", sales_price: 40, currency: "SEK" };
  const reviewed = reviewedStockMaterials([], [{ material_id: "MAT-R", material }]);
  expect(reviewed[0].quantity).toBe("0");
  expect(billableJobMaterials([{ ...reviewed[0], quantity: "5" }], reviewed)).toEqual([]);
});

async function open(page: Page, finish = true) {
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-jobs", JSON.stringify([{
      id: "REVIEW-JOB", title: "Material-Abschlusstest", objectId: "OBJ-1001", customerId: "CUST-1", status: "in Arbeit", priority: "normal", revision: 4,
      assignedTo: "Bernd Klos", dueDate: "2026-10-11", type: "Reparatur", checklist: ["Montage"], serviceIds: [],
      description: "", internalNotes: "", billable: true, material: "-", workMinutes: 0,
      materialItems: [{ id: "PLAN-1", materialId: "MAT-R", name: "Latten", category: "Holz", unit: "Meter", quantity: "5", price: "40", currency: "SEK" }],
      schedule: { type: "einmalig", frequency: "monatlich", interval: 1, weekdays: [], end: "nie", endDate: "", occurrences: 1 },
    }]));
    localStorage.setItem("kolaretorp-materials", JSON.stringify([
      { id: "MAT-R", sku: "L2838", name: "Latten", category: "Holz", unit: "Meter", price: "40", currency: "SEK", description: "" },
      { id: "MAT-E", sku: "SCHR", name: "Schrauben", category: "Material", unit: "Stueck", price: "2", currency: "SEK", description: "" },
    ]));
    localStorage.setItem("kolaretorp-inventory-locations", JSON.stringify([{ id: "CAR", name: "BLB549" }]));
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-field").click();
  await page.getByRole("button", { name: /Material-Abschlusstest/ }).first().click();
  await expect(page.getByRole("region", { name: "Material auf dem Fahrzeug", exact: true })).toBeVisible();
  if (!finish) return;
  await page.getByRole("button", { name: "Einsatz abschließen", exact: true }).click();
  const check = page.getByRole("region", { name: "Abschluss prüfen", exact: true });
  await expect(check.getByRole("button", { name: "Angaben bestätigen und fortfahren" })).toBeDisabled();
  await check.getByRole("checkbox", { name: "Material vollständig und korrekt erfasst" }).check();
  await check.getByRole("checkbox", { name: "Arbeitszeiten vollständig und korrekt erfasst" }).check();
  await check.getByRole("radio", { name: "Fotos nicht erforderlich" }).check();
  await check.getByRole("button", { name: "Angaben bestätigen und fortfahren" }).click();
}

for (const width of [1440, 390]) test(`Fahrzeugmaterial vor Abschluss sichtbar und Abschlusspruefung abbrechbar ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/field-material-review?**", (route) => route.fulfill({ json: { lines: [{ material_id: "MAT-R", source_id: "CAR", allocated_quantity: 5, material: { name: "Latten", sku: "L2838", unit: "Meter" } }] } }));
  await open(page, false);
  const assigned = page.getByRole("region", { name: "Material auf dem Fahrzeug", exact: true });
  await expect(assigned).toContainText("L2838 · Latten");
  await expect(assigned).toContainText("BLB549"); await expect(assigned).toContainText("5 Meter");
  await expect(page.getByRole("region", { name: "Materialverbrauch beim Abschluss" })).toHaveCount(0);
  await page.getByRole("button", { name: "Einsatz abschließen", exact: true }).click();
  const check = page.getByRole("region", { name: "Abschluss prüfen" });
  await check.getByRole("checkbox", { name: "Material vollständig und korrekt erfasst" }).check();
  await check.getByRole("checkbox", { name: "Arbeitszeiten vollständig und korrekt erfasst" }).check();
  await expect(check.getByRole("button", { name: "Angaben bestätigen und fortfahren" })).toBeDisabled();
  await check.getByRole("radio", { name: "Fotos nicht erforderlich" }).check();
  await expect(check.getByRole("button", { name: "Angaben bestätigen und fortfahren" })).toBeEnabled();
  await page.screenshot({ path: `test-results/field-completion-check-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await check.getByRole("button", { name: "Zurück zur Bearbeitung" }).click();
  await expect(check).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-jobs") ?? "[]")[0].status)).toBe("in Arbeit");
});

for (const width of [1440, 390]) test(`Teilverbrauch, Zusatzmaterial und Wiederholung beim Auftragsabschluss ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/field-material-review?**", (route) => route.fulfill({ json: { lines: [{ material_id: "MAT-R", source_id: "CAR", allocated_quantity: 5, material: { name: "Latten", sku: "L2838", unit: "Meter" } }] } }));
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/field-material-review", async (route) => {
    posts.push(route.request().postDataJSON());
    if (posts.length === 1) return route.fulfill({ status: 409, json: { error: "INSUFFICIENT_STOCK" } });
    return route.fulfill({ json: { stockMaterialItems: [
      { id: "STOCK-1", materialId: "MAT-R", name: "Latten", category: "Holz", unit: "Meter", quantity: "2", price: "40", currency: "SEK" },
      { id: "STOCK-2", materialId: "MAT-E", name: "Schrauben", category: "Material", unit: "Stueck", quantity: "3", price: "2", currency: "SEK" },
    ] } });
  });
  await open(page);
  const review = page.getByRole("region", { name: "Materialverbrauch beim Abschluss", exact: true });
  await expect(review).toBeVisible();
  await expect(review.getByRole("button", { name: "Verbrauch bestätigen und Auftrag abschließen", exact: true })).toBeDisabled();
  await review.getByRole("radio", { name: "Nein, Mengen anpassen", exact: true }).check();
  await review.getByRole("spinbutton", { name: "Verbraucht: Latten", exact: true }).fill("2");
  await review.getByRole("radio", { name: "Ja", exact: true }).last().check();
  await review.getByRole("button", { name: "Zusatzmaterial hinzufügen", exact: true }).click();
  await review.getByRole("combobox", { name: /^Zusatzmaterial/ }).selectOption("MAT-E");
  await review.getByRole("spinbutton", { name: "Menge", exact: true }).fill("3");
  await page.screenshot({ path: `test-results/field-material-review-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await review.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  const finish = review.getByRole("button", { name: "Verbrauch bestätigen und Auftrag abschließen", exact: true });
  await finish.click();
  await expect(review.getByRole("alert")).toContainText("Fahrzeugbestand reicht nicht aus");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-jobs") ?? "[]").find((job: { id: string }) => job.id === "REVIEW-JOB").status)).toBe("in Arbeit");
  await finish.click();
  await expect(review).not.toBeVisible();
  expect(posts[0]).toEqual(posts[1]);
  expect(posts[1]).toMatchObject({ job: "REVIEW-JOB", revision: 5, allConsumed: false, additionalUsed: true, lines: [
    { material_id: "MAT-R", source_id: "CAR", allocated_quantity: 5, consumed_quantity: 2, additional: false },
    { material_id: "MAT-E", source_id: "CAR", allocated_quantity: 0, consumed_quantity: 3, additional: true },
  ] });
  const job = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-jobs") ?? "[]").find((job: { id: string }) => job.id === "REVIEW-JOB"));
  expect(job.status).toBe("erledigt");
  expect(job.stockMaterialItems.map((line: { quantity: string }) => line.quantity)).toEqual(["2", "3"]);
  const billing = await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-billing") ?? "[]").find((bill: { jobId: string }) => bill.jobId === "REVIEW-JOB"));
  expect(billing.lines.filter((line: { kind: string }) => line.kind === "Material").map((line: { quantity: string }) => line.quantity)).toEqual(["2", "3"]);
});

test("Materialprüfung abbrechen lässt Auftrag und Bestände unverändert", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/field-material-review?**", (route) => route.fulfill({ json: { lines: [{ material_id: "MAT-R", source_id: "CAR", allocated_quantity: 5, material: { name: "Latten" } }] } }));
  await page.route("**/api/field-material-review", (route) => { posts++; return route.fulfill({ json: {} }); });
  await open(page);
  await page.getByRole("region", { name: "Materialverbrauch beim Abschluss", exact: true }).getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(posts).toBe(0);
  await expect(page.getByRole("button", { name: "Einsatz abschließen", exact: true })).toBeEnabled();
});

test("Vollständiger Verbrauch ohne Zusatzmaterial wird ausdrücklich bestätigt", async ({ page }) => {
  await page.route("**/api/field-material-review?**", (route) => route.fulfill({ json: { lines: [{ material_id: "MAT-R", source_id: "CAR", allocated_quantity: 5, material: { name: "Latten" } }] } }));
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/field-material-review", (route) => { posted = route.request().postDataJSON(); return route.fulfill({ json: { stockMaterialItems: [{ id: "S", materialId: "MAT-R", name: "Latten", category: "Holz", unit: "Meter", quantity: "5", price: "40", currency: "SEK" }] } }); });
  await open(page);
  const review = page.getByRole("region", { name: "Materialverbrauch beim Abschluss", exact: true });
  await review.getByRole("radio", { name: "Ja", exact: true }).first().check();
  await review.getByRole("radio", { name: "Nein", exact: true }).check();
  await review.getByRole("button", { name: "Verbrauch bestätigen und Auftrag abschließen", exact: true }).click();
  expect(posted).toMatchObject({ allConsumed: true, additionalUsed: false, lines: [{ consumed_quantity: 5, additional: false }] });
});

test("Nicht erreichbare Materialprüfung schließt den Auftrag nicht ab", async ({ page }) => {
  await page.route("**/api/field-material-review?**", (route) => route.fulfill({ status: 503, json: {} }));
  await open(page);
  const review = page.getByRole("region", { name: "Materialverbrauch beim Abschluss", exact: true });
  await expect(review.getByRole("alert")).toContainText("Verbindung prüfen");
  await expect(review.getByRole("button", { name: "Verbrauch bestätigen und Auftrag abschließen", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-jobs") ?? "[]").find((job: { id: string }) => job.id === "REVIEW-JOB").status)).toBe("in Arbeit");
});
