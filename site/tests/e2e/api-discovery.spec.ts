// Every API reference entry can be found without knowing its name: from the reference index, from
// the docs sidebar, from related pages and examples, and through search.
import { expect, test } from '@playwright/test';
import api from '../../src/content/api/entries.json' with { type: 'json' };
import { openSearch } from './search';

// 0.9: the 0.8 declarations are kept at their URLs but listed only on the migration page.
const shipped = api.filter((e) => !('removal' in e) && e.category !== 'Legacy');
const legacy = api.filter((e) => e.category === 'Legacy');

test('the reference index and the sidebar link every shipped entry', async ({ page }) => {
  await page.goto('/docs/reference/');
  const main = await page.locator('article a[href^="/docs/reference/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const nav = await page.getByRole('navigation', { name: 'Documentation' }).locator('a[href^="/docs/reference/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const e of shipped) {
    expect(main, `index → ${e.id}`).toContain(`/docs/reference/${e.id}/`);
    expect(nav, `sidebar → ${e.id}`).toContain(`/docs/reference/${e.id}/`);
  }
  for (const e of legacy) expect(nav, `sidebar ↛ legacy ${e.id}`).not.toContain(`/docs/reference/${e.id}/`);
  await page.goto('/docs/migration/');
  const migration = await page.locator('#legacy-08x-compatibility ~ div a, #legacy-08x-compatibility ~ table a, article a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const e of legacy) expect(migration, `migration → ${e.id}`).toContain(`/docs/reference/${e.id}/`);
});

test('prevent() and stop() are reachable from Events, :on(), outside() and the examples that use them', async ({ page }) => {
  for (const path of ['/docs/events/', '/docs/reference/on-rule/', '/docs/reference/outside/', '/examples/context-menu/', '/examples/accessible-tabs/', '/examples/keyboard-playground/']) {
    await page.goto(path);
    await expect(page.locator('main a[href="/docs/reference/prevent/"], article a[href="/docs/reference/prevent/"]').first(), path).toBeAttached();
  }
  await page.goto('/docs/reference/prevent/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('prevent() and stop()');
  await expect(page.getByText('since 0.7.0')).toBeVisible();
  await expect(page.getByText('experimental', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-usage="incorrect"]')).toHaveCount(3);
  for (const id of ['context-menu', 'accessible-tabs', 'keyboard-navigation', 'keyboard-playground']) await expect(page.locator(`a[href="/examples/${id}/"]`).first()).toBeAttached();
});

test('search finds the features by name', async ({ page }) => {
  await page.goto('/docs/introduction/');
  const input = await openSearch(page);
  for (const [q, href] of [['prevent', '/docs/reference/prevent/'], ['prevent()', '/docs/reference/prevent/'], ['focus', '/docs/reference/focus-declaration/'], ['aria-disabled', '/docs/reference/attr-property/'], ['stop()', '/docs/reference/prevent/'], ['attr', '/docs/reference/attr'], ['custom bundle', '/docs/custom-bundles/']] as const) {
    await input.fill(q);
    await expect.poll(() => page.getByRole('option').evaluateAll((os) => os.slice(0, 6).map((o) => o.getAttribute('href') ?? '')), { message: `${q} → ${href}` })
      .toEqual(expect.arrayContaining([expect.stringContaining(href)]));
  }
});
