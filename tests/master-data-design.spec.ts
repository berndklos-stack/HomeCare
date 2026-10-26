import { test, expect } from "@playwright/test";
import { defaultResourceTypes } from "../lib/resourceTypes";

for (const width of [320, 390, 820, 1440]) test(`Kompakte Firmenadresse bleibt ausgerichtet und gespeichert bei ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => {
    if (localStorage.getItem("company-compact-fixture")) return;
    localStorage.setItem("company-compact-fixture", "1");
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Musterbetrieb", email: "demo@example.invalid", phone: "010123456", countryCode: "SE", currency: "SEK", address: "Werkstatt 1, 38293 Nybro", bank: "Demo", organizationNumber: "DEMO-01", vatNumber: "DEMO-VAT", vatRate: "25", logoUrl: "" }));
  });
  await page.route("**/api/resource-types", route => route.fulfill({ json: { types: defaultResourceTypes } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("navigation", { name: "Stammdaten", exact: true }).getByRole("button", { name: "Firma", exact: true }).click();
  const address = page.getByRole("group", { name: "Firmenadresse", exact: true });
  const street = address.getByRole("textbox", { name: "Straße", exact: true });
  const postcode = address.getByRole("textbox", { name: "PLZ", exact: true });
  const city = address.getByRole("textbox", { name: "Ort", exact: true });
  await street.fill("Werkstatt 12"); await postcode.fill("12345"); await city.fill("Musterort");
  const boxes = [await street.boundingBox(), await postcode.boundingBox(), await city.boundingBox()];
  expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThan(2);
  if (width > 600) expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2);
  else expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height);
  for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await address.screenshot({ path: info.outputPath(`company-address-${width}.png`) });
  await page.locator(".company-details-form").screenshot({ path: info.outputPath(`company-form-${width}.png`) });
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await page.reload(); await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("navigation", { name: "Stammdaten", exact: true }).getByRole("button", { name: "Firma", exact: true }).click();
  await expect(street).toHaveValue("Werkstatt 12"); await expect(postcode).toHaveValue("12345"); await expect(city).toHaveValue("Musterort");
});

for (const width of [390, 820, 1440]) test(`Stammdaten: Lagerstil, Reiter und Eingaben bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(() => { localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} })); });
  await page.route("**/api/resource-types", route => route.fulfill({ json: { types: defaultResourceTypes.map(type => ({ ...type, revision: 1 })) } }));
  await page.route("**/api/operations?**", route => route.fulfill({ json: { rows: [], count: 0 } }));
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-inventory").click();
  const warehouse = page.getByRole("navigation", { name: "Operations", exact: true });
  const reference = await warehouse.getByRole("button").first().evaluate(element => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, font: style.fontSize, weight: style.fontWeight, background: style.backgroundColor, color: style.color };
  });
  await page.getByTestId("nav-masterData").click();
  const tabs = page.getByRole("navigation", { name: "Stammdaten", exact: true });
  const company = tabs.getByRole("button", { name: "Firma", exact: true });
  await company.click();
  await expect(company).toHaveCSS("border-radius", reference.radius);
  await expect(company).toHaveCSS("font-size", reference.font);
  await expect(company).toHaveCSS("font-weight", reference.weight);
  await expect(company).toHaveCSS("background-color", reference.background);
  await expect(company).toHaveCSS("color", reference.color);
  for (const button of await tabs.getByRole("button").all()) {
    const metrics = await button.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, height: element.getBoundingClientRect().height }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
    if (width === 390) expect(metrics.height).toBeGreaterThanOrEqual(44);
  }
  const panel = page.locator(".master-data-workspace > .panel").first();
  await expect(panel).toHaveCSS("box-shadow", "none");
  await expect(panel.locator(":scope > .compact-form")).toHaveCSS("border-top-width", "0px");
  await panel.getByLabel("Firmenname", { exact: true }).fill("Gepruefter Entwurf");
  await tabs.getByRole("button", { name: "Personal", exact: true }).click();
  await tabs.getByRole("button", { name: "Firma", exact: true }).click();
  await expect(panel.getByLabel("Firmenname", { exact: true })).toHaveValue("Gepruefter Entwurf");
  await page.screenshot({ path: `test-results/master-data-company-${width}-${test.info().project.name}.png` });
  await expect(tabs.getByRole("button", { name: "System / Branding", exact: true })).toHaveCount(0);
  await expect(tabs.getByRole("button", { name: "Ressourcentypen", exact: true })).toHaveCount(0);
  for (const name of ["Personal", "Ressourcen", "Leistungen", "Buchhaltung", "Tagesmail", "Sprachen"]) {
    await tabs.getByRole("button", { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const overflow = await page.locator(".master-data-workspace").evaluate(element => element.scrollWidth - element.clientWidth);
    const overflowing = await page.locator(".master-data-workspace").evaluate(element => {
      const right = element.getBoundingClientRect().right;
      return Array.from(element.querySelectorAll("*")).filter(child => (child.getBoundingClientRect().right > right + 2 || child.scrollWidth - child.clientWidth > 2) && child.getBoundingClientRect().width > 0).map(child => ({ tag: child.tagName, class: child.className, overflow: child.scrollWidth - child.clientWidth, pseudo: getComputedStyle(child, "::after").content, text: child.textContent?.slice(0, 55) })).slice(0, 18);
    });
    expect(overflow, `${name}: ${JSON.stringify(overflowing)}`).toBeLessThanOrEqual(2);
  }
  await tabs.getByRole("button", { name: "Ressourcen", exact: true }).click();
  const resourceTabs = page.getByRole("navigation", { name: "Ressourcen", exact: true });
  await resourceTabs.getByRole("button", { name: "Ressourcentypen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ressourcentypen", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/resource-type-navigation-${width}-${test.info().project.name}.png` });
  await resourceTabs.getByRole("button", { name: "Übersicht", exact: true }).click();
  await expect(page.getByRole("button", { name: "Neue Ressource anlegen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dunkelmodus", exact: true }).click();
  await tabs.getByRole("button", { name: "Firma", exact: true }).click();
  await expect(company).toHaveCSS("background-color", "rgb(41, 151, 255)");
  await page.screenshot({ path: `test-results/master-data-dark-${width}-${test.info().project.name}.png` });
});
