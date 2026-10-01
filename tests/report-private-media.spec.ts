import { expect, test } from "@playwright/test";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("Private Berichtsfotos werden authentifiziert geladen, Fehler bleiben begrenzt", async ({ page }) => {
  const requests: string[] = [];
  await page.route(/\/api\/(private-media|media)\?/, async (route) => {
    const request = route.request();
    requests.push(request.url());
    expect(request.headers()["x-workcore-e2e-bypass"]).toBe("1");
    expect(request.resourceType()).toBe("fetch");
    if (request.url().includes("missing.jpg")) {
      await route.fulfill({ status: 404, body: "Not found" });
    } else {
      await route.fulfill({ contentType: "image/png", body: Buffer.from(pixel, "base64") });
    }
  });
  await page.addInitScript((image) => {
    localStorage.setItem("kolaretorp-reports", JSON.stringify([{
      id: "REP-PRIVATE-TEST", jobId: "JOB-2407", objectId: "OBJ-1001",
      title: "Private Fotopruefung", date: "2026-09-29", visibleToCustomer: true,
      summary: "Drei Testreferenzen", media: ["3 Fotos"], customerComment: "",
      checklistResults: [{ id: "TASK-PRIVATE", title: "Kontrolle", meta: "", description: "",
        completed: true, minutes: 15, note: "", photos: [
          { id: "PRIVATE-1", name: "private.png", accepted: true, storagePath: "test/photos/private.png" },
          { id: "PRIVATE-2", name: "missing.jpg", accepted: true, storagePath: "test/photos/missing.jpg" },
          { id: "INLINE-3", name: "inline.png", accepted: true, storagePath: `data:image/png;base64,${image}`, previewUrl: `data:image/png;base64,${image}` },
        ] }],
    }]));
  }, pixel);
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.getByRole("button", { name: /^1 Berichte$/ }).click();
  await page.getByRole("button", { name: /Private Fotopruefung/ }).click();
  const photo = page.locator('img[alt*="private.png"]').first();
  await expect(photo).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('img[alt*="inline.png"]').first()).toHaveAttribute("src", /^data:image/);
  await expect(page.getByText("Bild nicht lesbar", { exact: true }).first()).toBeVisible();
  const settled = requests.length;
  await page.waitForTimeout(3000);
  expect(requests.length).toBe(settled);
});
