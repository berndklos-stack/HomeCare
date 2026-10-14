import { expect, type Page } from '@playwright/test';
import { defaultResourceTypes } from '../../lib/resourceTypes';

export async function openVehicleStandardTrips(page: Page) {
  await page.route('**/api/resource-types', (route) => route.fulfill({ json: { types: defaultResourceTypes.map((type) => ({ ...type, revision: 1 })) } }));
  await page.goto('/');
  await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.getByTestId('nav-masterData').click();
  await page.getByRole('button', { name: 'Ressourcen', exact: true }).click();
  await page.getByRole('button', { name: 'Ressource Servicebil Kolaretorp bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^Standardfahrten\s*\d+$/ }).click();
  const editor = dialog.getByRole('region', { name: 'Standardfahrten', exact: true });
  await expect(editor).toBeVisible();
  return { dialog, editor };
}

export async function createVehicleStandardTrip(page: Page, label = 'Gunnabo Route') {
  const { dialog, editor } = await openVehicleStandardTrips(page);
  await editor.getByRole('button', { name: 'Neue Standardfahrt anlegen', exact: true }).click();
  await editor.getByLabel('Bezeichnung der Standardfahrt', { exact: true }).fill(label);
  await editor.getByLabel('Startadresse', { exact: true }).fill('Kolaretorp 106');
  await editor.getByLabel('Zieladresse', { exact: true }).fill('Gunnabo');
  await editor.getByLabel('Zweck / Anlass', { exact: true }).fill('Kundenauftrag Gunnabo');
  await editor.getByLabel('Name / besucht bei', { exact: true }).fill('Testkunde');
  await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Standardfahrt bearbeiten ' + label, exact: true })).toBeVisible();
  return { dialog, editor };
}
