import { expect, test } from "@playwright/test";
import { companyLogoSource, maxCompanyLogoLength } from "../lib/companyLogo";

test("Dunkles SVG-Firmenlogo bleibt im dunklen Seitenmenue lesbar", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "SVG Logo Test", logoUrl: "" }));
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  await page.getByLabel("Firmenlogo hochladen", { exact: true }).setInputFiles(process.env.WORKCORE_LOGO_TEST_FILE || {
    name: "black-logo.svg", mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 32"><g fill="#000"><svg width="32" height="32" viewBox="0 0 32 32"><path d="M4 4h24v24H4z"/></svg></g><path fill="#000" d="M40 8h250v16H40z"/></svg>'),
  });
  const preview = page.locator(".company-logo-preview img");
  await expect(preview).toHaveAttribute("src", /^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  const logo = page.locator(".sidebar .brand img");
  await expect(logo).toBeVisible();
  await expect(logo).toHaveClass(/company-brand-image-light/);
  await expect(logo).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await logo.screenshot({ path: `test-results/dark-svg-logo-${test.info().project.name}.png` });
  await page.getByLabel("Firmenlogo hochladen", { exact: true }).setInputFiles({
    name: "white-logo.svg", mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><path fill="#fff" d="M10 10h180v20H10z"/></svg>'),
  });
  await expect(preview).not.toHaveAttribute("src", await logo.getAttribute("src") || "");
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect(logo).not.toHaveClass(/company-brand-image-light/);
});

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

for (const width of [390, 820]) test(`SVG-Logo wird transparentes PNG und bleibt nach Reload erhalten ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    if (!localStorage.getItem("svg-fixture")) {
      localStorage.setItem("svg-fixture", "1");
      localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "SVG Firma", logoUrl: "" }));
    }
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" style="width:99999px;height:99999px"><style>.brand-fill{fill:#0071e3}</style><rect class="brand-fill" x="20" y="20" width="160" height="60"/></svg>';
  await page.getByLabel("Firmenlogo hochladen", { exact: true }).setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
  const image = page.locator(".company-logo-preview img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  const pixels = await image.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, corner: [...context.getImageData(0, 0, 1, 1).data], center: [...context.getImageData(100, 50, 1, 1).data] };
  });
  expect(pixels).toEqual({ width: 200, height: 100, corner: [0, 0, 0, 0], center: [0, 113, 227, 255] });
  await page.getByRole("button", { name: "Firmenstammdaten speichern", exact: true }).click();
  await expect(page.locator(".sidebar .brand img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await page.reload();
  await expect(page.locator(".sidebar .brand img")).toHaveAttribute("src", /^data:image\/png;base64,/);
});

const unsafeSvgs = {
  script: '<script>window.svgExecuted=true</script>',
  handler: '<rect width="20" height="20" onload="window.svgExecuted=true"/>',
  foreignObject: '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>',
  externalImage: '<image href="https://svg-test.invalid/tracker.png"/>',
  externalUse: '<use href="https://svg-test.invalid/logo.svg#part"/>',
  cssImport: '<style>@import "https://svg-test.invalid/style.css";</style>',
  cssEscapedUrl: '<style>rect{fill:u\\72l(https://svg-test.invalid/a.svg)}</style>',
  cssImageSet: '<style>rect{background:image-set("https://svg-test.invalid/a.png" 1x)}</style>',
};
for (const [name, content] of Object.entries(unsafeSvgs)) test(`SVG mit ${name} wird ohne Ausfuehrung oder Netzabruf abgewiesen`, async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("svg-test.invalid")) requests.push(request.url()); });
  await page.route("https://svg-test.invalid/**", route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("kolaretorp-field-progress", JSON.stringify({ fixture: {} }));
    localStorage.setItem("kolaretorp-company-settings", JSON.stringify({ name: "Sichere Firma", logoUrl: "" }));
  });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("nav-masterData").click();
  await page.getByRole("button", { name: "Firma", exact: true }).click();
  await page.getByLabel("Firmenlogo hochladen", { exact: true }).setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">${content}</svg>`) });
  await expect(page.locator(".archive-notice")).toContainText("SVG konnte nicht sicher geladen werden");
  await expect(page.locator(".company-logo-preview img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { svgExecuted?: boolean }).svgExecuted)).toBeUndefined();
  expect(requests).toEqual([]);
  await expect(page.locator(".sidebar .brand")).toHaveText("Sichere Firma");
});
