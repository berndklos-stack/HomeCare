import { expect, type Locator, type Page } from '@playwright/test';

export async function keyboardReorder(page: Page, row: Locator, scope: Locator, direction: string) {
  const handle = row.locator('.personal-drag-handle').first();
  await expect(handle).toBeEnabled();
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(row).toHaveClass(/personal-dragging/);
  await expect(scope.locator('[aria-live="assertive"]').last()).toContainText('Position');
  await page.keyboard.press(direction);
  await expect(scope.locator('.personal-drop-target')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(scope).not.toHaveClass(/personal-arranging/);
  await page.waitForTimeout(80); // dnd-kit releases its document click guard after 50 ms.
}

export async function dragByHold(page: Page, source: Locator, target: Locator, scope: Locator) {
  await expect(scope.locator('.personal-drag-handle').first()).toBeEnabled();
  await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await source.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await source.hover();
  const before = (await source.boundingBox())!;
  await page.mouse.down();
  await expect(scope).toHaveClass(/personal-arranging/);
  const held = (await source.boundingBox())!;
  expect(held.width).toBeCloseTo(before.width, 1);
  expect(held.height).toBeCloseTo(before.height, 1);
  await expect(scope.locator('.personal-order-arrows')).toHaveCount(0);
  const box = (await target.boundingBox())!;
  const header = await page.locator('.topbar').boundingBox();
  const top = Math.max(box.y, header ? header.y + header.height : 0);
  const bottom = Math.min(box.y + box.height, page.viewportSize()!.height - 5);
  expect(bottom).toBeGreaterThan(top);
  await page.mouse.move(box.x + box.width / 2, (top + bottom) / 2, { steps: 20 });
  await page.mouse.up();
  await expect(scope).not.toHaveClass(/personal-arranging/);
  await expect(scope.locator('.personal-dragging')).toHaveCount(0);
  await page.waitForTimeout(80);
}
