import { expect, test } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });

for (const width of [390, 820]) for (const days of [1, 3]) for (const photoQuota of [false, true]) test(`Vor Ort: Haken, Zeit und Hinweise bleiben erhalten ${width}px ${days} Tage Foto-Speicherfehler ${photoQuota}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1180 });
  const date = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await page.addInitScript(({ days, photoQuota, date, endDate }) => {
    if (!localStorage.getItem('field-input-fixture')) {
      localStorage.setItem('field-input-fixture', '1');
      localStorage.setItem('kolaretorp-jobs', JSON.stringify([{
        id: 'FIELD-INPUT', title: 'Vor-Ort-Eingaben', objectId: 'OBJ-1001', status: 'geplant', priority: 'normal',
        assignedTo: 'Test', dueDate: date, endDate: days === 1 ? date : endDate,
        type: 'Kontrolle', checklist: ['Tuer pruefen'], serviceIds: [], revision: 1,
        schedule: { type: 'einmalig' },
      }]));
      if (photoQuota) localStorage.setItem('kolaretorp-field-progress', JSON.stringify({
        [days === 1 ? 'FIELD-INPUT' : `FIELD-INPUT::${date}`]: {
          'Tuer pruefen': { completed: false, minutes: '', note: '', revision: 1, photos: [{
            id: 'local-photo', name: 'Baustelle.png', accepted: true, uploadStatus: 'queued',
            previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          }] },
        },
      }));
    }
    if (photoQuota) {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'kolaretorp-field-progress' && value.includes('data:image/')) throw new DOMException('Photo draft full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    }
  }, { days, photoQuota, date, endDate });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('nav-field').tap();
  await page.getByRole('button', { name: /Vor-Ort-Eingaben/ }).first().tap();
  const task = page.locator('.service-task-list article').first();
  const checkbox = task.locator('.field-task-head input[type="checkbox"]');
  await checkbox.tap();
  await expect(checkbox).toBeChecked();
  await task.getByRole('spinbutton', { name: 'Minuten Tuer pruefen', exact: true }).fill('25');
  await task.getByRole('textbox', { name: 'Hinweis Tuer pruefen', exact: true }).pressSequentially('Tuer eingestellt');
  await expect(checkbox).toBeChecked();
  await expect(task.getByRole('spinbutton', { name: 'Minuten Tuer pruefen', exact: true })).toHaveValue('25');
  await expect(task.getByRole('textbox', { name: 'Hinweis Tuer pruefen', exact: true })).toHaveValue('Tuer eingestellt');
  const material = page.getByPlaceholder('Verbrauchtes Material oder Besonderheiten');
  await material.fill('2 Schrauben und 1 Liter Reiniger');
  await page.getByRole('textbox', { name: 'Einsatznotiz', exact: true }).fill('Laubblaeser verwendet');
  await expect(material).toHaveValue('2 Schrauben und 1 Liter Reiniger');
  if (photoQuota) await expect(page.locator('.captured-photo-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('nav-field').tap();
  await expect(checkbox).toBeChecked();
  await expect(task.getByRole('spinbutton', { name: 'Minuten Tuer pruefen', exact: true })).toHaveValue('25');
  await expect(task.getByRole('textbox', { name: 'Hinweis Tuer pruefen', exact: true })).toHaveValue('Tuer eingestellt');
  await expect(material).toHaveValue('2 Schrauben und 1 Liter Reiniger');
  await expect(page.getByRole('textbox', { name: 'Einsatznotiz', exact: true })).toHaveValue('Laubblaeser verwendet');
  expect(errors).toEqual([]);
});

test('Materialentwurf uebersteht eine Auftragsaktualisierung waehrend der Eingabe', async ({ page }) => {
  const job = {
    id: 'FIELD-MATERIAL', title: 'Materialeingabe', objectId: 'OBJ-1001', status: 'in Arbeit',
    priority: 'normal', assignedTo: 'Test', dueDate: new Date().toISOString().slice(0, 10),
    type: 'Kontrolle', checklist: ['Tuer pruefen'], serviceIds: [], revision: 1,
    schedule: { type: 'einmalig' }, material: '-',
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(job => {
    localStorage.setItem('kolaretorp-jobs', JSON.stringify([job]));
    localStorage.setItem('kolaretorp-field-progress', JSON.stringify({ [job.id]: {} }));
    localStorage.setItem('kolaretorp-active-job-id', JSON.stringify(job.id));
  }, job);
  await page.goto('/');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('nav-field').tap();
  if (!await page.getByPlaceholder('Verbrauchtes Material oder Besonderheiten').isVisible()) {
    await page.getByRole('button', { name: /^Materialeingabe/ }).first().tap();
  }
  const material = page.getByPlaceholder('Verbrauchtes Material oder Besonderheiten');
  await material.fill('5 Meter Kabel');
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 503, json: { error: 'Test: Aenderungen bleiben lokal' } });
      return;
    }
    await route.fulfill({ json: { data: path === '/api/sync-sections'
      ? { jobs: { value: [{ ...job, revision: 2, notes: 'Aktualisierter Auftrag' }] } } : [] } });
  });
  // Trigger the asynchronous refresh without blurring/saving the textarea.
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.getByRole('button', { name: 'Aktualisieren', exact: true })).toBeEnabled();
  await expect(material).toHaveValue('5 Meter Kabel');
  await page.getByRole('textbox', { name: 'Einsatznotiz', exact: true }).tap();
  await expect(material).toHaveValue('5 Meter Kabel');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('workcore-sync-mutations-v1') || '[]')
    .some((mutation: { entityId: string; payload: { material?: string } }) => mutation.entityId === 'FIELD-MATERIAL' && mutation.payload.material === '5 Meter Kabel'))).toBe(true);
});
