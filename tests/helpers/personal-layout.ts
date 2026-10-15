import { expect, type Locator, type Page } from '@playwright/test';

export async function holdToArrange(page: Page, target: Locator, scope: Locator) {
  await expect(scope.locator('.personal-drag-handle').first()).toBeEnabled();
  await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const box = (await target.boundingBox())!;
  await target.hover({ position: { x: Math.min(32, box.width / 2), y: box.height / 2 } });
  await page.mouse.down();
  await expect(scope).toHaveClass(/personal-arranging/);
  await page.mouse.up();
  await expect(scope.locator('.personal-dragging')).toHaveCount(0);
  await page.waitForTimeout(80); // dnd-kit releases its delayed document click suppression after 50ms.
}
