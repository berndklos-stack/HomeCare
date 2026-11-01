import { expect, test } from "@playwright/test";

for (const width of [320, 390, 820, 1440]) for (const withImage of [true, false]) {
  test(`Objektbild in Basisdaten und getrennte Bereiche ${width}px ${withImage ? "mit Bild" : "ohne Bild"}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.route("**/api/block-layouts", route => route.fulfill({ json: { orders: {} } }));
    await page.route("**/api/layout-preferences", route => route.fulfill({ json: { preferences: {} } }));
    await page.addInitScript(({ withImage }) => {
      const image = { id: "LAYOUT-IMAGE", type: "Bild", name: "Objektfoto.png", source: "Upload", isPrimary: true, previewUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" };
      const object = { id: "LAYOUT-OBJECT", name: "Umbau Birkenweg", owner: "Testkunde", ownerCustomerId: "", ownerEmail: "", ownerPhone: "", ownerAddress: "", address: "Nybro", billingAddressMode: "Eigentümeradresse", billingAddress: "", region: "Nybro", sizeSqm: 0, plotSqm: 0, rooms: 0, beds: 0, bathrooms: 0, buildYear: 0, carePackage: "", customFields: {}, status: "aktiv", type: "Projekt", access: { keySafe: "", alarm: "", parking: "", notes: "" }, equipment: [], utilities: { heating: "", water: "", septic: "", internet: "" }, risks: [], media: { images: withImage ? 1 : 0, documents: 0, floorPlans: 0, items: withImage ? [image] : [] }, nextVisit: "", lastVisit: "" };
      localStorage.setItem("kolaretorp-objects", JSON.stringify([object]));
    }, { withImage });
    await page.goto("/");
    await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true");
    const firstSteps = page.getByRole("button", { name: "Erste Schritte schließen", exact: true });
    if (await firstSteps.isVisible()) await firstSteps.click();
    await page.getByTestId("nav-objects").click();
    await page.getByRole("button", { name: /Projekt · Umbau Birkenweg/ }).click();
    const editor = page.locator(".object-editor-page");
    const basics = editor.locator('[data-block-id="basics"]');
    const image = basics.locator(".object-editor-image");
    await expect(image).toHaveCount(1);
    await expect(editor.locator(".editor-title .object-editor-image")).toHaveCount(0);
    expect((await editor.locator(".editor-title").boundingBox())!.height).toBeLessThanOrEqual(56);
    const imageBox = (await image.boundingBox())!, fieldsBox = (await basics.locator(".object-basics-fields").boundingBox())!;
    expect(imageBox.width).toBeLessThanOrEqual(240);
    expect(imageBox.height).toBeLessThanOrEqual(181);
    if (width > 780) expect(Math.abs(imageBox.y - fieldsBox.y)).toBeLessThan(1);
    else expect(imageBox.y).toBeGreaterThanOrEqual(fieldsBox.y + fieldsBox.height);
    if (withImage) await expect.poll(() => image.locator("img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
    else await expect(image).toContainText("Noch kein Projektbild definiert");
    const blocks = editor.locator('[data-layout-scope="object.form"] > .personal-form-block');
    expect(await blocks.count()).toBeGreaterThan(2);
    for (const block of await blocks.all()) {
      await expect(block).toHaveCSS("border-top-width", "1px");
      await expect(block).toHaveCSS("border-bottom-width", "1px");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const name = basics.getByRole("textbox", { name: "Projekt", exact: true });
    await name.fill("Umbau Birkenweg aktualisiert");
    await name.press("Tab");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kolaretorp-objects") ?? "[]")[0]?.name)).toBe("Umbau Birkenweg aktualisiert");
    await editor.locator(".editor-title").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("object-editor.png") });
    if (width === 1440) {
      await page.getByRole("button", { name: "Dunkelmodus", exact: true }).click();
      await expect(blocks.first()).toHaveCSS("background-color", "rgb(50, 53, 58)");
      await page.screenshot({ path: info.outputPath("object-editor-dark.png") });
    }
  });
}
