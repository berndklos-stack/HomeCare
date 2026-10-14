import { expect, test } from '@playwright/test';
import { defaultResourceTypes } from '../lib/resourceTypes';

for (const device of [
  { name: 'iPad Pro', portrait: { width: 1024, height: 1366 }, landscape: { width: 1366, height: 1024 } },
  { name: 'iPad Air', portrait: { width: 820, height: 1180 }, landscape: { width: 1180, height: 820 } },
  { name: 'iPad', portrait: { width: 768, height: 1024 }, landscape: { width: 1024, height: 768 } },
]) {
  test(`${device.name}: Arbeitsbereich und Bearbeitung bleiben beim Drehen erreichbar`, async ({ page }) => {
    await page.setViewportSize(device.portrait);
    await page.route('**/api/resource-types', (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
    await page.goto('/');
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
    const workspace = page.locator('.workspace');
    const sidebar = page.locator('.sidebar');
    const checkWorkspace = async (size: { width: number; height: number }) => {
      await expect(page.locator('.topbar')).toBeInViewport();
      const rect = (await workspace.boundingBox())!;
      expect(rect.height).toBeGreaterThan(size.height / 2);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      if (size.width <= 1180) expect((await sidebar.boundingBox())!.height).toBeLessThan(160);
    };
    await checkWorkspace(device.portrait);
    await page.getByTestId('nav-analytics').click();
    await expect(page.locator('.analytics-period-controls')).toBeInViewport();
    await page.screenshot({ path: `test-results/tablet-analytics-${device.name.replaceAll(' ', '-')}-${test.info().project.name}.png` });
    await page.getByTestId('nav-masterData').click();
    await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
    await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const name = dialog.getByLabel('Name', { exact: true });
    await name.fill('iPad Bearbeitung');
    await page.setViewportSize(device.landscape);
    await expect(name).toHaveValue('iPad Bearbeitung');
    await checkWorkspace(device.landscape);
    await page.setViewportSize(device.portrait);
    await expect(name).toHaveValue('iPad Bearbeitung');
    await dialog.getByRole('button', { name: 'Ressource speichern', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('wurde gespeichert');
    await dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ressource iPad Bearbeitung bearbeiten', exact: true })).toBeVisible();
    await workspace.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('.topbar')).toBeInViewport();
    await checkWorkspace(device.portrait);
    await page.screenshot({ path: `test-results/tablet-layout-${device.name.replaceAll(' ', '-')}-${test.info().project.name}.png` });
  });
}

test('Auch an den Layout-Grenzen bleibt der Arbeitsbereich sichtbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  for (const width of [600, 601, 780, 781, 1180, 1181]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect(page.locator('.topbar')).toBeInViewport();
    const rect = (await page.locator('.workspace').boundingBox())!;
    expect(rect.height, `Arbeitsbereich bei ${width}px`).toBeGreaterThan(512);
    expect(rect.y + rect.height).toBeLessThanOrEqual(1025);
  }
});
