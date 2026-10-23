// The library's demos, as the site runs them: real DOM text, real attributes, native disabled,
// aria-disabled, focus:, prevent() and reset. The site must not change their behavior.
import { expect, test, type Page } from '@playwright/test';

async function demo(page: Page, id: string) {
  await page.goto(`/examples/${id}/`);
  await page.locator(`[data-example-detail="${id}"]`).scrollIntoViewIfNeeded();
  await page.waitForFunction((x) => !document.querySelector(`astro-island[ssr] [data-example-detail="${x}"]`), id);
  const f = page.frameLocator('iframe').first();
  await expect(f.locator('main')).toBeVisible();
  await expect.poll(() => f.locator('body').evaluate(() => typeof (window as any).ReactiveCSS)).toBe('object');
  return f;
}

test('product configurator: DOM text total, aria-disabled at the bound keeps focus, native reset', async ({ page }) => {
  const f = await demo(page, 'product-configurator');
  const card = f.locator('.product').first();
  await expect(card.locator('.minus')).toHaveAttribute('aria-disabled', 'true');
  const plus = card.locator('.plus');
  // Keyboard, past the bound: native disabled would drop focus to the page, aria-disabled keeps it.
  await plus.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Enter');
  await expect(card.locator('.count')).toHaveValue('10');
  await expect(plus).toHaveAttribute('aria-disabled', 'true');
  await expect(plus).toBeFocused();
  await expect(card.locator('.dollars')).toHaveText('490');
  await card.getByRole('button', { name: 'Reset' }).click();
  await expect(card.locator('.count')).toHaveValue('1');
  await expect(card.locator('.dollars')).toHaveText('49');
});

test('multi-step wizard: focus: moves to the new step heading after Next', async ({ page }) => {
  const f = await demo(page, 'multi-step-wizard');
  const w = f.locator('#setup');
  await w.locator('.next').click();
  await expect(w.locator('.status')).toContainText('Step 2 of 4');
  await expect(w.getByRole('heading', { name: 'Preferences' })).toBeFocused();
});

test('accessible tabs: arrow keys select and focus, prevent() cancels the key default', async ({ page }) => {
  const f = await demo(page, 'accessible-tabs');
  const tabs = f.getByRole('tablist', { name: 'Account' });
  const profile = tabs.getByRole('tab', { name: 'Profile' });
  await expect(profile).toHaveAttribute('aria-selected', 'true');
  await profile.focus();
  await f.locator('body').evaluate(() => { (window as any).__prevented = []; addEventListener('keydown', (e) => (window as any).__prevented.push(e.defaultPrevented)); });
  await page.keyboard.press('ArrowRight');
  const security = tabs.getByRole('tab', { name: 'Security' });
  await expect(security).toHaveAttribute('aria-selected', 'true');
  await expect(security).toHaveAttribute('tabindex', '0');
  await expect(security).toBeFocused();
  await expect(profile).toHaveAttribute('aria-selected', 'false');
  expect(await f.locator('body').evaluate(() => (window as any).__prevented)).toEqual([true]);
  await expect(tabs.getByRole('tab', { name: /Team/ })).toBeDisabled();
});

test('form validation: submit is natively disabled until the terms are accepted', async ({ page }) => {
  const f = await demo(page, 'form-validation');
  const submit = f.getByRole('button', { name: 'Create account' });
  await expect(submit).toBeDisabled();
  await f.getByLabel('I accept the terms').check();
  await expect(submit).toBeEnabled();
  await f.getByLabel('Business').check();
  await expect(f.locator('#f-company')).toHaveAttribute('required', '');
});

test('a preview that never starts says so instead of passing for a demo', async ({ page }) => {
  // Block the runtime: the preview has nothing to run and must not look like a working demo.
  await page.route('**/runtime/reactive-css.min.js', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/examples/counter/');
  await page.locator('[data-example-detail="counter"]').scrollIntoViewIfNeeded();
  await expect(page.getByRole('alert')).toContainText('could not load the runtime');
});
