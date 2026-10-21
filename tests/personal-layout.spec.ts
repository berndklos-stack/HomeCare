import { expect, test } from '@playwright/test';
import { defaultLayoutPreferences, moveLayoutItem, navigationOrder, orderedIds, validateLayoutOrder, vehicleBlockOrder } from '../lib/layoutPreferences';
import { defaultResourceTypes } from '../lib/resourceTypes';
import { dragByHold, keyboardReorder } from './helpers/personal-layout';

test('Reihenfolgen bleiben vollstaendig, eindeutig und validiert', () => {
  expect(orderedIds(['jobs', 'jobs', 'invalid'], navigationOrder)).toEqual(['jobs', ...navigationOrder.filter((id) => id !== 'jobs')]);
  expect(moveLayoutItem(['a', 'b'], 'b', -1)).toEqual(['b', 'a']);
  expect(moveLayoutItem(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
  expect(() => validateLayoutOrder('vehicleBlockOrder', [...vehicleBlockOrder])).not.toThrow();
  expect(() => validateLayoutOrder('vehicleBlockOrder', ['documents', 'documents', 'maintenance'])).toThrow();
  expect(() => validateLayoutOrder('userId', [...vehicleBlockOrder])).toThrow();
});

for (const size of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  test(`Persoenliche Reihenfolge, Einklappen und Reload ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    let saved = defaultLayoutPreferences();
    let fail = false;
    const writes: unknown[] = [];
    await page.route('**/api/layout-preferences', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON(); writes.push(body);
        if (fail) return route.fulfill({ status: 503, json: { error: 'OFFLINE' } });
        validateLayoutOrder(body.key, body.value);
        saved = { ...saved, [body.key]: body.value };
      }
      return route.fulfill({ json: { preferences: saved } });
    });
    await page.route('**/api/resource-types', (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
    await page.goto('/');
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    const sidebar = page.locator('.sidebar');
    await expect(page.getByRole('button', { name: 'Anordnen', exact: true })).toHaveCount(0);
    const navigation = sidebar.locator('.personal-navigation');
    const menuItem = page.getByTestId('nav-dashboard');
    await expect(navigation.locator('.personal-drag-handle').first()).toBeEnabled();
    await menuItem.hover();
    const originalSize = (await menuItem.boundingBox())!;
    await page.mouse.down();
    await expect(navigation).toHaveClass(/personal-arranging/);
    const heldSize = (await menuItem.boundingBox())!;
    expect(heldSize.width).toBeCloseTo(originalSize.width, 1);
    expect(heldSize.height).toBeCloseTo(originalSize.height, 1);
    await expect(navigation.locator('.personal-order-arrows')).toHaveCount(0);
    await page.screenshot({ path: `test-results/personal-menu-held-${size.width}-${test.info().project.name}.png` });
    await page.mouse.up();
    await expect(navigation).not.toHaveClass(/personal-arranging/);
    await page.waitForTimeout(80);
    await keyboardReorder(page, sidebar.locator('[data-nav-id="masterData"]'), sidebar.locator('.personal-navigation'), size.width > 1180 ? 'ArrowUp' : 'ArrowLeft');
    const visibleNavigationLength = navigationOrder.filter(id => id !== 'time').length;
    await expect.poll(() => saved.navigationOrder.indexOf('masterData')).toBe(visibleNavigationLength - 2);
    await expect(sidebar.locator('[data-nav-id]').nth(visibleNavigationLength - 2)).toHaveAttribute('data-nav-id', 'masterData');
    await expect(sidebar.locator('.personal-order-arrows')).toHaveCount(0);
    await page.getByTestId('nav-masterData').click();
    await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
    await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const blocks = dialog.locator('.personal-vehicle-blocks');
    expect(await blocks.locator('.vehicle-disclosure').first().evaluate((element) => ({ display: getComputedStyle(element).display, border: getComputedStyle(element).borderTopWidth }))).toEqual({ display: 'flex', border: '0px' });
    expect(await blocks.locator('.vehicle-disclosure > span').first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    for (const title of ['Standardfahrten', 'Fahrzeugdokumente', 'Termine / Wartung']) await expect(blocks.getByRole('button', { name: new RegExp('^' + title + '\\s*\\d+$') })).toHaveAttribute('aria-expanded', 'false');
    await keyboardReorder(page, blocks.locator('[data-block-id="maintenance"]'), blocks, 'ArrowUp');
    await expect.poll(() => saved.vehicleBlockOrder).toEqual(['standardTrips', 'maintenance', 'documents']);
    await keyboardReorder(page, blocks.locator('[data-block-id="maintenance"]'), blocks, 'ArrowUp');
    await expect.poll(() => saved.vehicleBlockOrder).toEqual(['maintenance', 'standardTrips', 'documents']);
    await expect(blocks.locator('[data-block-id]').first()).toHaveAttribute('data-block-id', 'maintenance');
    await expect(blocks).not.toHaveClass(/personal-arranging/);
    const maintenanceToggle = blocks.getByRole('button', { name: /^Termine \/ Wartung\s*\d+$/ });
    await maintenanceToggle.click();
    await blocks.locator('[data-block-id="maintenance"]').getByLabel('Termin', { exact: true }).fill('Serviceentwurf');
    await maintenanceToggle.click();
    await maintenanceToggle.click();
    await expect(blocks.locator('[data-block-id="maintenance"]').getByLabel('Termin', { exact: true })).toHaveValue('Serviceentwurf');
    await maintenanceToggle.click();
    const standardToggle = blocks.getByRole('button', { name: /^Standardfahrten\s*\d+$/ });
    await standardToggle.click();
    const editor = dialog.getByRole('region', { name: 'Standardfahrten', exact: true });
    await editor.getByRole('button', { name: 'Neue Standardfahrt anlegen', exact: true }).click();
    await editor.getByLabel('Bezeichnung der Standardfahrt', { exact: true }).fill('Unfertiger Entwurf');
    await expect(standardToggle).toBeDisabled();
    for (const grip of await blocks.locator('.personal-drag-handle').all()) await expect(grip).toBeDisabled();
    await expect(blocks.getByRole('button', { name: 'Standardreihenfolge', exact: true })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await standardToggle.click();
    await expect(editor).not.toBeVisible();
    await page.screenshot({ path: `test-results/personal-layout-${size.width}-${test.info().project.name}.png` });
    await dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await page.reload();
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await expect(sidebar.locator('[data-nav-id]').nth(visibleNavigationLength - 2)).toHaveAttribute('data-nav-id', 'masterData');
    await page.getByTestId('nav-masterData').click();
    await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
    await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
    await expect(blocks.locator('[data-block-id]').first()).toHaveAttribute('data-block-id', 'maintenance');
    await dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    fail = true;
    await keyboardReorder(page, sidebar.locator('[data-nav-id="masterData"]'), sidebar.locator('.personal-navigation'), size.width > 1180 ? 'ArrowUp' : 'ArrowLeft');
    await expect(sidebar.locator('.personal-order-toolbar').getByRole('status')).toHaveText('Nicht gespeichert');
    expect(saved.navigationOrder.indexOf('masterData')).toBe(visibleNavigationLength - 2);
    fail = false;
    await keyboardReorder(page, sidebar.locator('[data-nav-id="masterData"]'), sidebar.locator('.personal-navigation'), size.width > 1180 ? 'ArrowDown' : 'ArrowRight');
    await expect.poll(() => saved.navigationOrder).toEqual([...navigationOrder.filter(id => id !== 'time'), 'time']);
    expect(saved.vehicleBlockOrder).toEqual(['maintenance', 'standardTrips', 'documents']);
    expect(writes.length).toBeGreaterThan(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  });
}

test('Layout-API erfordert Authentifizierung und E2E schreibt keine Produktivdaten', async ({ request }) => {
  expect((await request.get('/api/layout-preferences', { headers: { 'X-WorkCore-E2E-Bypass': '0' } })).status()).toBe(401);
  expect((await request.patch('/api/layout-preferences', { headers: { 'X-WorkCore-E2E-Bypass': '0' }, data: { key: 'navigationOrder', value: [] } })).status()).toBe(401);
  expect((await request.patch('/api/layout-preferences', { data: { key: 'navigationOrder', value: [] } })).status()).toBe(503);
});

for (const width of [1440, 820, 390]) {
  test(`Drag-and-drop speichert Menue und Fahrzeugbloecke ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1180 });
    let saved = defaultLayoutPreferences();
    let writes = 0;
    let fail = false;
    await page.route('**/api/layout-preferences', route => {
      if (route.request().method() === 'PATCH') {
        writes++;
        if (fail) return route.fulfill({ status: 503, json: { error: 'OFFLINE' } });
        const { key, value } = route.request().postDataJSON();
        validateLayoutOrder(key, value);
        saved = { ...saved, [key]: value };
      }
      return route.fulfill({ json: { preferences: saved } });
    });
    await page.route('**/api/resource-types', route => route.fulfill({ json: { types: defaultResourceTypes.map(type => ({ ...type, revision: 1 })) } }));
    await page.goto('/');
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    const sidebar = page.locator('.sidebar');
    const handle = sidebar.locator('[data-nav-id="dashboard"] .personal-drag-handle');
    await expect(handle).toBeEnabled();
    await keyboardReorder(page, sidebar.locator('[data-nav-id="dashboard"]'), sidebar.locator('.personal-navigation'), width > 1180 ? 'ArrowDown' : 'ArrowRight');
    await expect.poll(() => saved.navigationOrder[1]).toBe('dashboard');
    await handle.focus();
    await page.keyboard.press('Space');
    await expect(sidebar.locator('.personal-dragging')).toHaveCount(1);
    await page.keyboard.press(width > 1180 ? 'ArrowDown' : 'ArrowRight');
    await page.keyboard.press('Escape');
    expect(writes).toBe(1);
    await expect(sidebar.locator('.personal-navigation')).not.toHaveClass(/personal-arranging/);
    await page.getByTestId('nav-masterData').click();
    await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
    await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
    const blocks = page.getByRole('dialog').locator('.personal-vehicle-blocks');
    const source = blocks.locator('[data-block-id="maintenance"] .vehicle-disclosure');
    const target = blocks.locator('[data-block-id="standardTrips"] .vehicle-disclosure');
    await dragByHold(page, source, target, blocks);
    await expect.poll(() => saved.vehicleBlockOrder).toEqual(['maintenance', 'standardTrips', 'documents']);
    await expect(blocks.locator('[data-block-id]').first()).toHaveAttribute('data-block-id', 'maintenance');
    await expect(blocks.locator('[data-block-id="maintenance"]')).toHaveCSS('transform', 'none');
    await page.screenshot({ path: `test-results/personal-layout-drag-${width}-${test.info().project.name}.png` });
    const outside = (await source.boundingBox())!;
    await page.mouse.move(outside.x + outside.width / 2, outside.y + outside.height / 2);
    await page.mouse.down();
    await expect(blocks).toHaveClass(/personal-arranging/);
    await page.mouse.move(1, 1, { steps: 15 });
    await page.mouse.up();
    await expect(blocks.locator('.personal-dragging')).toHaveCount(0);
    await expect(blocks.locator('[data-block-id="maintenance"]')).toHaveCSS('transform', 'none');
    await page.waitForTimeout(80); // Wait for dnd-kit's document click guard to release.
    expect(writes).toBe(2);
    // A failed drop must leave the confirmed order in place.
    fail = true;
    await blocks.locator('[data-block-id="maintenance"] .personal-drag-handle').focus();
    await page.keyboard.press('Space');
    await expect(blocks.locator('.personal-dragging')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(blocks.locator('[aria-live="assertive"]')).toContainText('Position 2 von');
    await page.keyboard.press('Space');
    await expect(blocks.locator('.personal-order-toolbar').getByRole('status')).toHaveText('Nicht gespeichert');
    await expect(blocks.locator('[data-block-id]').first()).toHaveAttribute('data-block-id', 'maintenance');
    fail = false;
    await page.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await page.reload();
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await expect(sidebar.locator('[data-nav-id]').nth(1)).toHaveAttribute('data-nav-id', 'dashboard');
    expect(saved.vehicleBlockOrder).toEqual(['maintenance', 'standardTrips', 'documents']);
  });
}

for (const width of [390, 820]) test(`Echte Touchgeste verschiebt Fahrzeugbloecke ${width}px`, async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP-Touchereignisse sind Chromium-spezifisch');
  const context = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width, height: 1180 }, hasTouch: true, isMobile: true, extraHTTPHeaders: { 'X-WorkCore-E2E-Bypass': '1' } });
  try {
    const page = await context.newPage();
    let saved = defaultLayoutPreferences();
    await page.route('**/api/layout-preferences', route => {
      if (route.request().method() === 'PATCH') {
        const { key, value } = route.request().postDataJSON();
        saved = { ...saved, [key]: value };
      }
      return route.fulfill({ json: { preferences: saved } });
    });
    await page.route('**/api/resource-types', route => route.fulfill({ json: { types: defaultResourceTypes.map(type => ({ ...type, revision: 1 })) } }));
    await page.goto('/');
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    const navigation = page.locator('.personal-navigation');
    const navSource = page.getByTestId('nav-dashboard');
    const navTarget = page.getByTestId('nav-objects');
    await expect(navigation.locator('.personal-drag-handle').first()).toBeEnabled();
    const navBox = (await navSource.boundingBox())!;
    const navTo = (await navTarget.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: navBox.x + navBox.width / 2, y: navBox.y + navBox.height / 2 }] });
    await expect(navigation).toHaveClass(/personal-arranging/);
    const heldNav = (await navSource.boundingBox())!;
    expect(heldNav.width).toBeCloseTo(navBox.width, 1);
    expect(heldNav.height).toBeCloseTo(navBox.height, 1);
    await expect(navigation.locator('.personal-order-arrows')).toHaveCount(0);
    await page.screenshot({ path: `test-results/personal-navigation-held-${width}.png` });
    for (let step = 1; step <= 15; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: navBox.x + navBox.width / 2 + (navTo.x + navTo.width / 2 - navBox.x - navBox.width / 2) * step / 15, y: navBox.y + navBox.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => saved.navigationOrder[0]).toBe('objects');
    await expect(navigation).not.toHaveClass(/personal-arranging/);
    await expect(navSource).toHaveClass(/active/);
    await page.waitForTimeout(80);
    await page.getByTestId('nav-masterData').click();
    await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
    await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
    const blocks = page.getByRole('dialog').locator('.personal-vehicle-blocks');
    const source = blocks.locator('[data-block-id="maintenance"] .vehicle-disclosure');
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    expect(await source.evaluate(el => getComputedStyle(el).touchAction)).not.toBe('none');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x + 22, y: from.y + 22 }] });
    await expect(blocks).toHaveClass(/personal-arranging/);
    const held = (await source.boundingBox())!;
    expect(held.width).toBeCloseTo(from.width, 1);
    expect(held.height).toBeCloseTo(from.height, 1);
    const to = (await blocks.locator('[data-block-id="standardTrips"] .vehicle-disclosure').boundingBox())!;
    for (let step = 1; step <= 15; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + 22, y: from.y + 22 + (to.y - from.y) * step / 15 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => saved.vehicleBlockOrder).toEqual(['maintenance', 'standardTrips', 'documents']);
    await expect(blocks.locator('[data-block-id]').first()).toHaveAttribute('data-block-id', 'maintenance');
  } finally { await context.close(); }
});
