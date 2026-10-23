// Vision v2 (design-source/Vision v2.dc.html): an editorial page. Native demos are native CSS, the
// Reactive CSS ones run the real runtime, and Vision v1's catalog sections are gone.
import { expect, test, type Page } from '@playwright/test';

const visible = async (page: Page, sel: string) => {
  await page.locator(sel).scrollIntoViewIfNeeded();
  await page.waitForFunction((s) => !document.querySelector(`astro-island[ssr] ${s}`), sel);
};

test('the five sections, in the design order, and one disclaimer', async ({ page }) => {
  await page.goto('/vision/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/CSS is evolving\.\s*We’re exploring what comes next\./);
  const ids = await page.locator('main > section').evaluateAll((s) => s.map((x) => x.id));
  expect(ids).toEqual(['question', 'evolution', 'native', 'experiment', 'direction']);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([/Calculate.*Relate.*Decide.*React\?/, 'If the browser already does it well, use the browser.', /The interaction doesn’t disappear\./, 'An experiment, not a standard.']);
  await expect(page.locator('main')).toContainText('not part of any specification or browser roadmap');
  await expect(page.getByText(/Not affiliated with the CSS Working Group/)).toHaveCount(1);
});

test('no Vision v1 sections: comparison, showcase, metrics, native table, bundle builder', async ({ page }) => {
  await page.goto('/vision/');
  for (const sel of ['[data-score-comparison]', '[data-timeline]', '[data-showcase]', '#engineering', '#bundle', '#compare', '#build']) await expect(page.locator(sel), sel).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Stop scripting the small stuff');
  await expect(page.locator('main')).not.toContainText('Bundle builder');
  await expect(page.locator('main')).not.toContainText('simulated');
});

test('evolution: the native steps work without the runtime', async ({ page }) => {
  await page.goto('/vision/');
  await visible(page, '[data-evolution]');
  const ev = page.locator('[data-evolution]');
  await ev.getByRole('slider', { name: 'Viewport width' }).fill('320');
  await expect(ev.locator('output').first()).toHaveText('16px');
  await ev.getByRole('slider', { name: 'Viewport width' }).fill('1440');
  await expect(ev.locator('output').first()).toHaveText('40px');
  await expect(ev.getByText('→ matches')).toBeVisible();
  await ev.getByRole('checkbox', { name: 'Card contains an image' }).uncheck();
  await expect(ev.getByText('→ no match')).toBeVisible();
  await ev.getByText('--size: large', { exact: true }).click();
  await expect(ev.getByRole('radio', { name: '--size: large' })).toBeChecked();
  await expect(ev.getByText('32px', { exact: true })).toBeVisible();
});

test('evolution: the Reactive CSS step runs the runtime', async ({ page }) => {
  await page.goto('/vision/');
  await visible(page, '[data-evolution]');
  const f = page.frameLocator('iframe[title^="Counter"]');
  await f.getByRole('button', { name: 'Click' }).click();
  await f.getByRole('button', { name: 'Click' }).click();
  await expect(f.locator('output')).toHaveText('2');
});

test('experiment: the article saves through the runtime, and the code lights by role', async ({ page }) => {
  await page.goto('/vision/');
  await visible(page, '[data-experiment]');
  const ex = page.locator('[data-experiment]');
  const f = page.frameLocator('iframe[title^="Reading list"]');
  const save = f.locator('.save');
  // The label is generated content (::after), which is the button's accessible name.
  await expect(save).toHaveAccessibleName('Save');
  await save.click();
  await expect(save).toHaveAccessibleName('Saved');
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => f.locator('.note').evaluate((n) => getComputedStyle(n, '::after').content)).toBe('"In your reading list"');
  await expect(ex.locator('[data-role="result"].bg-trace').first()).toBeVisible();
  await ex.getByRole('button', { name: 'event · :on()' }).hover();
  await expect(ex.locator('[data-role="event"].bg-trace')).toHaveCount(2); // .save:on(click) { and --saved: toggle();
  await expect(ex.locator('[data-role="state"].bg-trace')).toHaveCount(0);
});

test('links: closing actions, the moved comparison and every internal link resolve', async ({ page, request }) => {
  await page.goto('/vision/');
  await expect(page.getByRole('link', { name: 'Explore Examples' })).toHaveAttribute('href', '/examples/');
  await expect(page.getByRole('link', { name: 'Read the Documentation' })).toHaveAttribute('href', '/docs/getting-started/');
  const hrefs = await page.locator('main a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  for (const h of hrefs) expect((await request.get(h.split('#')[0]!)).status(), h).toBe(200);
  await page.goto('/examples/score-history/#vanilla');
  await expect(page.locator('#vanilla [data-score-comparison]')).toHaveCount(1);
});

test.describe('narrow screens', () => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/vision/', '/examples/score-history/']) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }
});
