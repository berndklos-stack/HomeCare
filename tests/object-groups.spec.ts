import { expect, test } from "@playwright/test";
import { defaultObjectTypeDefinitions, groupObjectsByType } from "../lib/objectTypes";

test("Typgruppen sortieren Projekte und Objekte natuerlich ohne Eingaben zu veraendern", () => {
  const entries = [
    { id: "o10", name: "Objekt 10", type: "Objekt" }, { id: "p2", name: "Projekt 2", type: "Projekt" },
    { id: "o2", name: "Objekt 2", type: "Objekt" }, { id: "p1", name: "Projekt 1", type: "Projekt" },
    { id: "custom", name: "Eigen", type: "Sondertyp" }, { id: "legacy", name: "Alt" },
  ];
  const before = JSON.stringify(entries);
  const grouped = groupObjectsByType(entries, defaultObjectTypeDefinitions, "de");
  expect(grouped.map(group => group.type)).toEqual(["Projekt", "Objekt", "Sondertyp"]);
  expect(grouped[0].items.map(item => item.id)).toEqual(["p1", "p2"]);
  expect(grouped[1].items.map(item => item.id)).toEqual(["legacy", "o2", "o10"]);
  expect(JSON.stringify(entries)).toBe(before);
});

for (const width of [390, 820, 1440]) test(`Uebersicht trennt Projekte und Objekte in allen Statusgruppen bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => {
    const base = { owner: "Testkunde", ownerCustomerId: "", ownerEmail: "", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "Nybro", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, access: { keySafe: "", alarm: "", parking: "", notes: "" }, equipment: [], utilities: { heating: "", water: "", septic: "", internet: "" }, risks: [], media: { images: 0, documents: 0, floorPlans: 0, items: [] }, nextVisit: "", lastVisit: "" };
    const entries = ["active", "inactive", "archived"].flatMap((status, index) => [
      { ...base, id: `GROUP-O-${index}`, type: "Objekt", name: `Objekt ${index}`, status: status === "inactive" ? "inaktiv" : "aktiv", archived: status === "archived" },
      { ...base, id: `GROUP-PB-${index}`, type: "Projekt", name: `Projekt B ${index}`, status: status === "inactive" ? "inaktiv" : "laufend", archived: status === "archived" },
      { ...base, id: `GROUP-PA-${index}`, type: "Projekt", name: `Projekt A ${index}`, status: status === "inactive" ? "inaktiv" : "laufend", archived: status === "archived" },
    ]);
    localStorage.setItem("kolaretorp-objects", JSON.stringify(entries));
  });
  await page.reload();
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-objects").click();
  await page.getByRole("button", { name: /Inaktive Projekte & Objekte/ }).click();
  await page.getByRole("button", { name: /Archivierte Projekte & Objekte/ }).click();
  const groups = page.locator(".object-type-groups");
  await expect(groups).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const group = groups.nth(i);
    await expect(group.locator("h3")).toHaveText(["Projekte 2", "Objekte 1"]);
    await expect(group.locator("article strong")).toHaveText([`Projekt · Projekt A ${i}`, `Projekt · Projekt B ${i}`, `Objekt · Objekt ${i}`]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`object-groups-${width}.png`) });
  await groups.first().getByRole("button", { name: /Projekt · Projekt A 0/ }).click();
  await expect(page.getByRole("textbox", { name: "Projekt", exact: true })).toHaveValue("Projekt A 0");
});
