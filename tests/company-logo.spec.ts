import { expect, test } from "@playwright/test";
import { companyLogoSource, maxCompanyLogoLength } from "../lib/companyLogo";

test("Firmenlogo erlaubt nur sichere Bildquellen", () => {
  for (const source of ["javascript:alert(1)", "data:image/svg+xml;base64,AAAA", "http://example.invalid/logo.png", "https://user:password@example.invalid/a.png", "not-a-url", "data:image/png;base64," + "A".repeat(maxCompanyLogoLength)]) {
    expect(companyLogoSource(source)).toBe("");
  }
  expect(companyLogoSource("https://example.invalid/logo.png")).toBe("https://example.invalid/logo.png");
  expect(companyLogoSource("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
});

for (const width of [390, 820, 1440]) test(`Firmenlogo aus Stammdaten hochladen, laden und entfernen bei ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => {
    if (!localStorage.getItem("company-logo-fixture")) {
      localStorage.setItem("company-logo-fixture", "1");
      localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "logo-fixture": {} }));
      localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Logo Test GmbH", email: "", address: "", bank: "", organizationNumber: "", vatNumber: "", logoUrl: "" }));
    }
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  const brand = page.locator(".sidebar .brand");
  await expect(brand).toHaveText("Logo Test GmbH");
  await expect(brand.locator("img")).toHaveCount(0);
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 240; canvas.height = 60;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#0071e3"; context.fillRect(0, 0, 240, 60);
    context.fillStyle = "#fff"; context.font = "bold 28px sans-serif"; context.fillText("TEST FIRMA", 20, 40);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Firmenlogo hochladen", { exact: true }).setInputFiles({ name: "firmenlogo.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await expect(page.locator(".company-logo-preview img")).toBeVisible();
  const editor = page.locator(".company-logo-editor");
  const preview = (await editor.locator(".company-logo-preview").boundingBox())!;
  const actions = (await editor.locator(".row-actions").boundingBox())!;
  const upload = editor.locator(".company-logo-upload");
  expect(await upload.evaluate(element => getComputedStyle(element).display)).toMatch(/^(inline-)?flex$/);
  expect(await upload.evaluate(element => getComputedStyle(element).flexDirection)).toBe("row");
  expect((await upload.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const remove = (await editor.getByRole("button", { name: "Firmenlogo entfernen", exact: true }).boundingBox())!;
  expect(remove.width).toBe(44);
  expect(remove.height).toBe(44);
  expect(remove.x).toBeGreaterThanOrEqual((await upload.boundingBox())!.x + (await upload.boundingBox())!.width);
  if (width > 600) {
    expect(Math.abs(preview.y + preview.height / 2 - actions.y - actions.height / 2)).toBeLessThan(2);
    expect(actions.x - preview.x - preview.width).toBeGreaterThanOrEqual(12);
    expect(actions.x - preview.x - preview.width).toBeLessThanOrEqual(20);
  } else {
    expect(actions.y).toBeGreaterThanOrEqual(preview.y + preview.height);
    expect(Math.abs(actions.x - preview.x)).toBeLessThan(2);
  }
  await editor.scrollIntoViewIfNeeded();
  await editor.screenshot({ path: `test-results/company-logo-editor-${width}-${test.info().project.name}.png` });
  await expect(brand.locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect(brand.getByRole("img", { name: "Logo Test GmbH", exact: true })).toBeVisible();
  await expect.poll(() => brand.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (width <= 1180) expect((await page.locator(".sidebar").boundingBox())!.height).toBeLessThan(160);
  await page.locator(".workspace").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `test-results/company-logo-${width}-${test.info().project.name}.png` });
  await page.reload();
  await expect(brand.getByRole("img", { name: "Logo Test GmbH", exact: true })).toBeVisible();
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  await page.getByRole("button", { name: "Firmenlogo entfernen", exact: true }).click();
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect(brand).toHaveText("Logo Test GmbH");
  await expect(brand.locator("img")).toHaveCount(0);
});

test("Defektes Firmenlogo zeigt nur den Namen dieser Firma", async ({ page }) => {
  await page.route("https://logo.example.invalid/**", route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ "logo-fixture": {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Andere Firma", logoUrl: "https://logo.example.invalid/missing.png" }));
  });
  await page.goto("/");
  await expect(page.locator(".sidebar .brand")).toHaveText("Andere Firma");
  await expect(page.locator(".sidebar .brand img")).toHaveCount(0);
});
