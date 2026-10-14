import { expect, test } from '@playwright/test';
import { parseStandardTripDistance, prepareStandardTrip, projectStandardTripDistances, standardTripFromDrive, standardTripOdometers, type StandardTrip } from '../lib/standardTrips';
import { defaultResourceTypes } from '../lib/resourceTypes';
import { createVehicleStandardTrip, openVehicleStandardTrips } from './helpers/vehicle-standard-trips';

test('Standardvorlage enthaelt nur Routendaten, stabile IDs und eindeutige Namen', () => {
  const draft = { id: 'STANDARD-1', label: ' Route ', startAddress: ' A ', endAddress: ' B ', purpose: ' Kunde ', tripType: 'Dienstfahrt' as const, visited: ' Name ', waypoints: [{ id: 'W', address: ' C ', note: ' Notiz ', odometer: '100', photo: { previewUrl: 'private' } }], startedAt: '2026-10-14', endOdometer: '300' };
  const result = prepareStandardTrip(draft, []);
  expect(result).toEqual({ id: 'STANDARD-1', label: 'Route', startAddress: 'A', endAddress: 'B', purpose: 'Kunde', tripType: 'Dienstfahrt', visited: 'Name', waypoints: [{ id: 'STANDARD-1-WAY-1', address: 'C', note: 'Notiz', odometer: '' }] });
  expect(prepareStandardTrip({ ...result, endAddress: 'D' }, [result]).id).toBe(result.id);
  expect(() => prepareStandardTrip({ ...result, id: 'OTHER', label: ' route ' }, [result])).toThrow('duplicate');
  expect(() => prepareStandardTrip({ ...result, label: ' ' }, [])).toThrow('required');
  expect(prepareStandardTrip({ ...result, tripType: 'Privatfahrt' }, []).visited).toBe('');
});

test('Entfernung berechnet Endstand; Vorlagen aus Fahrten enthalten keine Tachostaende oder Fotos', () => {
  expect(projectStandardTripDistances([{ id: 'A', distanceKm: 999 }, { id: 'B', distanceKm: 50 }], [{ standard_trip_id: 'A', distance_km: 12.5 }])).toEqual([{ id: 'A', distanceKm: 12.5 }, { id: 'B', distanceKm: null }]);
  expect(parseStandardTripDistance('12,5')).toBe(12.5);
  expect(parseStandardTripDistance('')).toBeNull();
  for (const invalid of ['-1', '0', 'abc', '1.1234', '1000000']) expect(() => parseStandardTripDistance(invalid)).toThrow('distance');
  expect(standardTripOdometers('203132', 16)).toEqual({ endOdometer: '203148', kilometers: '16' });
  expect(standardTripOdometers('100.1', 0.2).endOdometer).toBe('100.3');
  expect(standardTripOdometers('', 12).endOdometer).toBe('');
  expect(standardTripOdometers('100', null).endOdometer).toBe('');
  const drive = { id: 'TRIP-1', date: '2026-10-14', startAddress: 'Lager', endAddress: 'Kunde', purpose: 'Kundenbesuch', visited: 'Kunde', tripType: 'Dienstfahrt' as const, kilometers: '16', startOdometer: '203132', endOdometer: '203148', waypoints: [{ id: 'W', address: 'Stopp', note: '', odometer: '203140', photo: 'private' }], odometerPhotos: ['private'], startedAt: '12:00' };
  const template = standardTripFromDrive(drive, 'STANDARD-DRIVE');
  expect(template.distanceKm).toBe(16);
  expect(template).not.toHaveProperty('startOdometer');
  expect(template).not.toHaveProperty('endOdometer');
  expect(template).not.toHaveProperty('odometerPhotos');
  expect(template.waypoints[0]).toEqual({ id: 'STANDARD-DRIVE-WAY-1', address: 'Stopp', note: '', odometer: '' });
  expect(standardTripFromDrive({ ...drive, kilometers: '' }, 'S').distanceKm).toBe(16);
});

for (const mobile of [false, true]) {
  test('Standardentfernung und Uebernahme einer gefahrenen Route ' + (mobile ? 'iPhone' : 'Desktop'), async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const first = await openVehicleStandardTrips(page);
    await first.dialog.getByRole('button', { name: 'Ressource speichern', exact: true }).click();
    await first.dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kolaretorp-resources') ?? '[]').length)).toBeGreaterThan(0);
    await page.evaluate(() => {
      const resources = JSON.parse(localStorage.getItem('kolaretorp-resources')!);
      resources.find((r: { id: string }) => r.id === 'RES-1').logbook = [{ id: 'DRIVE-TEMPLATE', date: '2026-10-14', status: 'abgeschlossen', startAddress: 'Lager', endAddress: 'Gunnabo', purpose: 'Vorlagenbesuch', tripType: 'Dienstfahrt', visited: 'Kunde', kilometers: '16', startOdometer: '1000', endOdometer: '1016', driverId: '', notes: '', fuelOrCharge: '' }];
      localStorage.setItem('kolaretorp-resources', JSON.stringify(resources));
    });
    const { dialog, editor } = await openVehicleStandardTrips(page);
    await editor.locator('summary').click();
    await expect(editor.locator('.standard-trip-history')).toContainText('16 km');
    await expect(editor.locator('.standard-trip-history')).not.toContainText('1000');
    await editor.getByRole('button', { name: 'Als Standardfahrt übernehmen 2026-10-14 Vorlagenbesuch', exact: true }).click();
    await expect(editor.getByLabel('Entfernung (km)', { exact: true })).toHaveValue('16');
    await editor.getByLabel('Entfernung (km)', { exact: true }).fill('12,5');
    await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kolaretorp-resources')!).find((r: { id: string }) => r.id === 'RES-1').standardTrips[0]?.distanceKm)).toBe(12.5);
    await page.screenshot({ path: 'test-results/standard-distance-' + (mobile ? 'mobile' : 'desktop') + '-' + test.info().project.name + '.png' });
    await dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await page.getByRole('button', { name: 'Fahrt', exact: true }).click();
    const trip = page.locator('.quick-trip-page');
    await trip.getByLabel('Start-Km', { exact: true }).fill('2000');
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('kolaretorp-resources')!).find((r: { id: string }) => r.id === 'RES-1').standardTrips[0].id);
    await trip.getByLabel('Standardfahrt wählen', { exact: true }).selectOption(id);
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('2012.5');
    await trip.getByLabel('Start-Km', { exact: true }).fill('3000');
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('3012.5');
    await trip.getByLabel('End-Km', { exact: true }).fill('3014');
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('3014');
    await trip.getByLabel('Start-Km', { exact: true }).fill('');
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('');
    await trip.getByLabel('Start-Km', { exact: true }).fill('4000');
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('4012.5');
  });
}

test('Standardfahrt kann zusammen mit einem neuen Fahrzeug ohne echte Fahrt angelegt werden', async ({ page }) => {
  const existing = await openVehicleStandardTrips(page);
  await existing.dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
  await page.getByRole('button', { name: 'Neue Ressource anlegen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ressourcentyp', { exact: true }).selectOption(defaultResourceTypes[2].id);
  await expect(dialog.getByRole('region', { name: 'Standardfahrten', exact: true })).toHaveCount(0);
  await dialog.getByLabel('Ressourcentyp', { exact: true }).selectOption(defaultResourceTypes[0].id);
  await dialog.getByLabel('Name', { exact: true }).fill('Neues Vorlagenfahrzeug');
  await dialog.getByRole('button', { name: /^Standardfahrten\s*\d+$/ }).click();
  const editor = dialog.getByRole('region', { name: 'Standardfahrten', exact: true });
  await editor.getByRole('button', { name: 'Neue Standardfahrt anlegen', exact: true }).click();
  await editor.getByLabel('Bezeichnung der Standardfahrt', { exact: true }).fill('Neue Route');
  await editor.getByLabel('Startadresse', { exact: true }).fill('Lager');
  await editor.getByLabel('Zieladresse', { exact: true }).fill('Kunde');
  await expect(dialog.getByRole('button', { name: 'Ressource anlegen', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
  await dialog.getByRole('button', { name: 'Ressource anlegen', exact: true }).click();
  await expect(dialog.locator('p[role="status"]')).toContainText('wurde gespeichert');
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('kolaretorp-resources') ?? '[]').find((r: { name: string }) => r.name === 'Neues Vorlagenfahrzeug'));
  await expect.poll(async () => (await saved())?.standardTrips?.length).toBe(1);
  expect((await saved()).logbook).toEqual([]);
  expect((await saved()).standardTrips[0]).toMatchObject({ label: 'Neue Route', startAddress: 'Lager', endAddress: 'Kunde' });
});

for (const mobile of [false, true]) {
  test('Standardfahrten beim Fahrzeug: Anlegen, Bearbeiten, Auswahl und Loeschen ' + (mobile ? 'iPhone' : 'Desktop'), async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    const { dialog, editor } = await createVehicleStandardTrip(page);
    const vehicle = () => page.evaluate(() => JSON.parse(localStorage.getItem('kolaretorp-resources') ?? '[]').find((r: { id: string }) => r.id === 'RES-1'));
    await expect.poll(async () => (await vehicle())?.standardTrips?.length).toBe(1);
    const saved = (await vehicle()).standardTrips[0] as StandardTrip;
    const mileage = (await vehicle()).currentOdometer;
    const logbook = (await vehicle()).logbook;
    await editor.getByRole('button', { name: 'Standardfahrt bearbeiten Gunnabo Route', exact: true }).click();
    const destination = editor.getByLabel('Zieladresse', { exact: true });
    await destination.fill('Gunnabo 126, 382 91 Nybro');
    await editor.getByRole('button', { name: 'Zwischenstopp hinzufügen', exact: true }).click();
    await editor.getByLabel('Zwischenstopp 1', { exact: true }).fill('Nybro centrum');
    await expect(dialog.getByRole('button', { name: 'Ressource speichern', exact: true })).toBeDisabled();
    await destination.scrollIntoViewIfNeeded();
    expect(await destination.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    expect((await destination.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await editor.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'test-results/vehicle-standard-trips-' + (mobile ? 'mobile' : 'desktop') + '-' + test.info().project.name + '.png' });
    await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
    await expect.poll(async () => (await vehicle()).standardTrips[0].endAddress).toBe('Gunnabo 126, 382 91 Nybro');
    expect((await vehicle()).standardTrips[0].id).toBe(saved.id);
    expect((await vehicle()).currentOdometer).toBe(mileage);
    expect((await vehicle()).logbook).toEqual(logbook);
    await editor.getByRole('button', { name: 'Neue Standardfahrt anlegen', exact: true }).click();
    await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('Namen');
    await editor.getByLabel('Bezeichnung der Standardfahrt', { exact: true }).fill(' gunnabo route ');
    await editor.getByLabel('Startadresse', { exact: true }).fill('A');
    await editor.getByLabel('Zieladresse', { exact: true }).fill('B');
    await editor.getByRole('button', { name: 'Standardfahrt speichern', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('bereits vorhanden');
    await editor.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    expect((await vehicle()).standardTrips).toHaveLength(1);
    await dialog.getByRole('button', { name: 'Ressource schließen', exact: true }).click();
    await page.reload();
    await expect(page.locator('main.app')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Fahrt', exact: true }).click();
    const trip = page.locator('.quick-trip-page');
    await expect(trip.getByLabel('Als Standardfahrt speichern', { exact: true })).toHaveCount(0);
    await trip.getByLabel('Standardfahrt wählen', { exact: true }).selectOption(saved.id);
    await expect(trip.getByLabel('Zieladresse', { exact: true })).toHaveValue('Gunnabo 126, 382 91 Nybro');
    await expect(trip.getByLabel('Zwischenziel 1', { exact: true })).toHaveValue('Nybro centrum');
    await expect(trip.getByLabel('End-Km', { exact: true })).toHaveValue('');
    await trip.getByRole('button', { name: 'Fahrt erfassen Schließen', exact: true }).click();
    const reopened = await openVehicleStandardTrips(page);
    page.once('dialog', (confirmation) => confirmation.dismiss());
    await reopened.editor.getByRole('button', { name: 'Standardfahrt löschen Gunnabo Route', exact: true }).click();
    expect((await vehicle()).standardTrips).toHaveLength(1);
    page.once('dialog', (confirmation) => confirmation.accept());
    await reopened.editor.getByRole('button', { name: 'Standardfahrt löschen Gunnabo Route', exact: true }).click();
    await expect.poll(async () => (await vehicle()).standardTrips.length).toBe(0);
  });
}
