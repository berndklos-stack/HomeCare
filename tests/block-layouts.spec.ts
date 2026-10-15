import { expect, test, type Locator, type Page } from '@playwright/test';
import { mergeVisibleBlockOrder, validateBlockLayout, type BlockLayouts } from '../lib/blockLayouts';
import { holdToArrange } from './helpers/personal-layout';

test('Block-IDs sind begrenzt und ausgeblendete Positionen bleiben erhalten', () => {
  expect(mergeVisibleBlockOrder(['a', 'hidden', 'b'], ['a', 'b', 'new'], ['new', 'b', 'a'])).toEqual(['new', 'hidden', 'b', 'a']);
  for (const [scope, order] of [['bad_scope', ['a']], ['page', ['a', 'a']], ['page', [null]], ['page', [['a']]], ['page', ['bad\n']], ['page', Array.from({ length: 65 }, (_, i) => `a${i}`)]]) {
    expect(() => validateBlockLayout(scope, order)).toThrow('INVALID_BLOCK_LAYOUT');
  }
  expect(() => mergeVisibleBlockOrder(['a'], ['a'], ['other'])).toThrow();
  expect(validateBlockLayout('object.form', ['basics', 'billing']).order).toEqual(['basics', 'billing']);
});

async function setup(page: Page) {
  let orders: BlockLayouts = { 'dashboard.content': ['workboard', 'futureHidden', 'upcomingJobs'] };
  const writes: { scope: string; order: string[] }[] = [];
  let fail = false;
  let failRead = false, reads = 0;
  await page.route('**/api/block-layouts', route => {
    if (route.request().method() === 'PATCH') {
      const layout = validateBlockLayout(route.request().postDataJSON().scope, route.request().postDataJSON().order);
      writes.push(layout);
      if (fail) return route.fulfill({ status: 503, json: { error: 'OFFLINE' } });
      orders = { ...orders, [layout.scope]: layout.order };
      return route.fulfill({ json: layout });
    }
    reads++;
    return route.fulfill(failRead ? { status: 503, json: { error: 'OFFLINE' } } : { json: { orders } });
  });
  await page.goto('/');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  return { orders: () => orders, writes, reads: () => reads, fail: (value: boolean) => { fail = value; }, failRead: (value: boolean) => { failRead = value; } };
}

async function move(page: Page, source: Locator, target: Locator) {
  await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await source.scrollIntoViewIfNeeded();
  const a = (await source.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await expect(source.locator('xpath=ancestor::*[@data-sort-id][1]')).toHaveClass(/personal-dragging/);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  await expect(target.locator('xpath=ancestor::*[@data-sort-id][1]')).toHaveClass(/personal-drop-target/);
  await page.mouse.up();
}

for (const width of [1440, 820, 390]) test(`Bereiche per Halten umordnen, getrennt speichern und neu laden ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1180 });
  const state = await setup(page);
  await expect(page.getByRole('button', { name: 'Anordnen', exact: true })).toHaveCount(0);
  const group = page.locator('[data-layout-scope="dashboard.content"]');
  const source = group.locator(':scope > [data-block-id="upcomingJobs"]');
  await holdToArrange(page, source.getByRole('heading', { name: 'Nächste Einsätze', exact: true }), group);
  expect(state.writes).toHaveLength(0);
  await move(page, source.locator(':scope > .personal-block-controls .personal-drag-handle'), group.locator(':scope > [data-block-id="workboard"] > .personal-block-controls .personal-drag-handle'));
  await expect.poll(() => state.orders()['dashboard.content'][0]).toBe('upcomingJobs');
  expect(state.orders()['dashboard.content'][1]).toBe('futureHidden');
  await expect(group.locator(':scope > [data-block-id]').first()).toHaveAttribute('data-block-id', 'upcomingJobs');
  await group.locator(':scope > .personal-order-toolbar').getByRole('button', { name: 'Verschieben beenden', exact: true }).click();
  const shortcuts = page.locator('[data-layout-scope="dashboard.shortcuts"]');
  const card = shortcuts.locator('[data-block-id="objects"] .workboard-card');
  await holdToArrange(page, card, shortcuts);
  await expect(group).not.toHaveClass(/personal-arranging/);
  await expect(page.getByTestId('nav-dashboard')).toHaveClass(/active/);
  await move(page, shortcuts.locator('[data-block-id="objects"] .personal-drag-handle'), shortcuts.locator('[data-block-id="planning"] .personal-drag-handle'));
  await expect.poll(() => state.orders()['dashboard.shortcuts']?.[0]).toBe('objects');
  expect(state.orders()['dashboard.content'][0]).toBe('upcomingJobs');
  await shortcuts.getByRole('button', { name: 'Verschieben beenden', exact: true }).click();
  await expect(shortcuts.locator(':scope > [data-block-id="objects"]')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: `test-results/block-layout-dashboard-${width}-${test.info().project.name}.png` });
  await page.reload();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(group.locator(':scope > [data-block-id]').first()).toHaveAttribute('data-block-id', 'upcomingJobs');
  await expect(shortcuts.locator(':scope > [data-block-id]').first()).toHaveAttribute('data-block-id', 'objects');
  state.fail(true);
  await holdToArrange(page, source.getByRole('heading', { name: 'Nächste Einsätze', exact: true }), group);
  await group.getByRole('button', { name: 'Nächste Einsätze nach unten verschieben', exact: true }).click();
  await expect(group.locator(':scope > .personal-order-toolbar').getByRole('status')).toHaveText('Nicht gespeichert');
  await expect(group.locator(':scope > [data-block-id]').first()).toHaveAttribute('data-block-id', 'upcomingJobs');
  const reads = state.reads();
  state.failRead(true);
  await group.locator(':scope > .personal-order-toolbar').getByRole('button', { name: 'Einstellungen erneut laden', exact: true }).click();
  await expect.poll(() => state.reads()).toBe(reads + 1);
  await expect(source.locator(':scope > .personal-block-controls .personal-drag-handle')).toBeDisabled();
  await expect(group.locator(':scope > .personal-order-toolbar').getByRole('status')).toHaveText('Nicht gespeichert');
  await expect(group.locator(':scope > [data-block-id]').first()).toHaveAttribute('data-block-id', 'upcomingJobs');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

for (const width of [1440, 390]) test(`Formulare behalten Eingaben beim Verschieben ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1180 });
  const state = await setup(page);
  await page.getByTestId('nav-jobs').click();
  await page.getByRole('button', { name: 'Neuer Auftrag', exact: true }).click();
  const group = page.locator('[data-layout-scope="job.form"]');
  const title = group.getByLabel('Titel', { exact: true });
  await title.fill('Entwurf bleibt erhalten');
  const materials = group.locator(':scope > [data-block-id="materials"]');
  await holdToArrange(page, materials.getByText('Material', { exact: true }).first(), group);
  await group.getByRole('button', { name: 'Material nach oben verschieben', exact: true }).click();
  await expect.poll(() => state.orders()['job.form']?.indexOf('materials')).toBe(1);
  await expect(title).toHaveValue('Entwurf bleibt erhalten');
  await group.getByRole('button', { name: 'Verschieben beenden', exact: true }).click();
  await title.scrollIntoViewIfNeeded();
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + 15, box.y + 15);
  await page.mouse.down();
  await page.waitForTimeout(650); // Prove holding an input does not activate sorting.
  await page.mouse.up();
  await expect(group).not.toHaveClass(/personal-arranging/);
  await expect(title).toHaveValue('Entwurf bleibt erhalten');
  await page.screenshot({ path: `test-results/block-layout-form-${width}-${test.info().project.name}.png` });
});

test('Neue Block-API sperrt Anon und schreibt im Testbypass keine echten Daten', async ({ request }) => {
  expect((await request.get('/api/block-layouts', { headers: { 'X-WorkCore-E2E-Bypass': '0' } })).status()).toBe(401);
  expect((await request.patch('/api/block-layouts', { headers: { 'X-WorkCore-E2E-Bypass': '0' }, data: { scope: 'dashboard.content', order: ['workboard'] } })).status()).toBe(401);
  expect((await request.get('/api/block-layouts')).status()).toBe(200);
  expect((await request.patch('/api/block-layouts', { data: { scope: 'dashboard.content', order: ['workboard'] } })).status()).toBe(503);
});

test('iPhone: echtes langes Druecken bewegt einen Bereich, Scrollgeste aktiviert nichts', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP-Touchereignisse sind Chromium-spezifisch');
  const context = await browser.newContext({ baseURL: 'http://localhost:3100', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: { 'X-WorkCore-E2E-Bypass': '1', 'X-WorkCore-Tenant': '00000000-0000-0000-0000-000000000001' } });
  try {
    const page = await context.newPage();
    const state = await setup(page);
    const group = page.locator('[data-layout-scope="dashboard.content"]');
    const heading = group.getByRole('heading', { name: 'Nächste Einsätze', exact: true });
    await heading.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const before = (await heading.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before.x + 20, y: before.y + 10 }] });
    await expect(group).toHaveClass(/personal-arranging/);
    const to = (await group.locator(':scope > [data-block-id="workboard"]').boundingBox())!;
    const headerBottom = ((await page.locator('.topbar').boundingBox())!);
    const visibleTop = Math.max(to.y, headerBottom.y + headerBottom.height + 10);
    const visibleBottom = Math.min(to.y + to.height, 834);
    expect(visibleBottom).toBeGreaterThan(visibleTop);
    const targetY = (visibleTop + visibleBottom) / 2;
    for (let i = 1; i <= 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before.x + 20, y: before.y + 10 + (targetY - before.y - 10) * i / 20 }] });
    await expect(group.locator(':scope > [data-block-id="workboard"]')).toHaveClass(/personal-drop-target/);
    await page.screenshot({ path: 'test-results/block-layout-touch-drag-390.png' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => state.orders()['dashboard.content'][0]).toBe('upcomingJobs');
    await expect(group.locator(':scope > [data-block-id="upcomingJobs"]')).toHaveCSS('transform', 'none');
    await group.locator(':scope > .personal-order-toolbar').getByRole('button', { name: 'Verschieben beenden', exact: true }).tap();
    await heading.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const box = (await heading.boundingBox())!;
    const start = await page.locator('.workspace').evaluate(el => el.scrollTop);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 20, y: box.y + 10 }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 20, y: Math.max(10, box.y + 10 - i * 12) }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(650); // The cancelled hold must remain inactive after its original deadline.
    await expect(group).not.toHaveClass(/personal-arranging/);
    expect(state.writes).toHaveLength(1);
    expect(await page.locator('.workspace').evaluate(el => el.scrollTop)).toBeGreaterThan(start);
  } finally { await context.close(); }
});
