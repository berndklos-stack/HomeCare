import { expect, test } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });

for (const width of [390, 820]) for (const days of [1, 3]) for (const photoQuota of [false, true]) test(`Vor Ort: Haken, Zeit und Hinweise bleiben erhalten ${width}px ${days} Tage Foto-Speicherfehler ${photoQuota}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1180 });
  await page.addInitScript(({ days, photoQuota }) => {
    if (!localStorage.getItem('field-input-fixture')) {
      localStorage.setItem('field-input-fixture', '1');
      localStorage.setItem('kolaretorp-jobs', JSON.stringify([{
        id: 'FIELD-INPUT', title: 'Vor-Ort-Eingaben', objectId: 'OBJ-1001', status: 'geplant', priority: 'normal',
        assignedTo: 'Test', dueDate: '2026-10-15', endDate: days === 1 ? '2026-10-15' : '2026-10-17',
        type: 'Kontrolle', checklist: ['Tuer pruefen'], serviceIds: [], revision: 1,
        schedule: { type: 'einmalig' },
      }]));
      if (photoQuota) localStorage.setItem('kolaretorp-field-progress', JSON.stringify({
        [days === 1 ? 'FIELD-INPUT' : 'FIELD-INPUT::2026-10-15']: {
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
  }, { days, photoQuota });
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
  if (photoQuota) await expect(page.locator('.captured-photo-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('nav-field').tap();
  await expect(checkbox).toBeChecked();
  await expect(task.getByRole('spinbutton', { name: 'Minuten Tuer pruefen', exact: true })).toHaveValue('25');
  await expect(task.getByRole('textbox', { name: 'Hinweis Tuer pruefen', exact: true })).toHaveValue('Tuer eingestellt');
  expect(errors).toEqual([]);
});
