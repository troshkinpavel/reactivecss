// The Examples gallery and its detail pages, with the real runtime: filtering, lazy previews,
// every API example route, DOM text, attributes, prevent(), focus:, reset, source, breadcrumbs.
import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openSearch } from './search';

// 0.9: the site's own API examples plus the two library ones the catalog reuses (src/lib/content/catalog.ts).
const dirs = (p: string) => readdirSync(new URL(p, import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const API = [...dirs('../../src/catalog/api/'), 'live-values', 'mouse-tracker'];
const INTERFACES = dirs('../../src/catalog/interfaces/');

async function detail(page: Page, id: string) {
  await page.goto(`/examples/${id}/`);
  await page.waitForFunction((x) => !document.querySelector(`astro-island[ssr] [data-example-detail="${x}"]`), id);
  const root = page.locator(`[data-example-detail="${id}"]`);
  const f = root.frameLocator('iframe').first();
  await expect.poll(() => f.locator('body').evaluate(() => typeof (window as any).ReactiveCSS)).toBe('object');
  return { root, f };
}

test('category tabs filter the gallery and keep the choice in the URL', async ({ page }) => {
  await page.goto('/examples/');
  const tabs = page.getByRole('tablist', { name: 'Categories' });
  await expect(page.locator('[data-group=interfaces] .gallery-extra').first()).toBeHidden(); // "All" shows three
  await tabs.getByRole('tab', { name: /Interfaces/ }).click();
  await expect(page).toHaveURL(/#interfaces$/);
  await expect(page.locator('[data-group=interfaces]')).toBeVisible();
  await expect(page.locator('[data-group=api]')).toBeHidden();
  await expect(page.locator('[data-group=interfaces] [data-gallery-card]')).toHaveCount(INTERFACES.length);
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: /Advanced/ })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab', { name: /Advanced/ })).toBeFocused();
  await expect(page.locator('[data-group=advanced] a[href="/examples/control-center-deep-dive/"]').first()).toBeVisible();
  await page.goto('/examples/#lab');
  await expect(page.locator('[data-group=lab]')).toBeVisible();
  await expect(page.locator('[data-group=api]')).toBeHidden();
});

test('card previews run only while on screen', async ({ page }) => {
  await page.goto('/examples/');
  const live = page.locator('[data-card-preview=live] iframe');
  await expect.poll(() => live.count()).toBeGreaterThan(0);
  const first = await live.count();
  expect(first).toBeLessThan(16);
  // A live card works: the counter's + changes its DOM text.
  const counter = page.locator('[data-gallery-card]').filter({ hasText: 'Counter' }).first().frameLocator('iframe');
  await counter.getByRole('button', { name: 'Increase' }).click();
  await expect(counter.locator('.value')).toHaveText('1');
  // Scrolled away, the first cards stop: their frames (and live() timers) are gone.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.locator('[data-group=api] [data-gallery-card]').first().locator('iframe').count()).toBe(0);
});

test('a card opens its example from anywhere below the preview; the preview stays interactive', async ({ page }) => {
  await page.goto('/examples/#api');
  const card = page.locator('[data-gallery-card]').filter({ hasText: 'Attribute sync' }).first();
  await expect(card.getByRole('link')).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  const toggle = card.frameLocator('iframe').getByRole('button', { name: 'Shipping details' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page).toHaveURL(/\/examples\/#api$/);
  // The stretched link covers the text: a mouse click there lands on the link, as for a user.
  await card.locator('p').first().click({ force: true });
  await expect(page).toHaveURL(/\/examples\/attribute-sync\/$/);
});

test('the detail page copies its source', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const { root } = await detail(page, 'attribute-sync');
  await root.locator('#source').getByRole('button', { name: 'Copy code' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('--attr-aria-expanded: var(--open)');
});

test('group links and the footer follow the design', async ({ page }) => {
  await page.goto('/examples/');
  await expect(page.locator('[data-group=interfaces] .gallery-more')).toHaveText(`View all ${INTERFACES.length} →`);
  await expect(page.locator('[data-group=api] .gallery-more')).toHaveText('View API examples →');
  await expect(page.locator('footer')).toContainText('Learn');
  await page.goto('/examples/counter/');
  await expect(page.locator('footer')).toContainText('Learn');
});

for (const id of [...API, ...INTERFACES]) {
  test(`example ${id}: page, live preview without diagnostics, breadcrumb`, async ({ page }) => {
    const { root } = await detail(page, id);
    await page.waitForTimeout(300);
    // persist() cannot store anything in the sandboxed preview: that one note is expected (see protocol.ts explainSandbox).
    await expect(root.locator('[role=status]').filter({ hasNotText: 'Expected in this preview' })).toHaveCount(0);
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('link', { name: 'Examples', exact: true })).toHaveAttribute('href', '/examples/');
    await expect(crumbs.locator('[aria-current=page]')).toHaveText(await page.getByRole('heading', { level: 1 }).textContent() ?? '');
  });
}

test('counter: DOM text, Reset, inspector collapsed until asked', async ({ page }) => {
  const { root, f } = await detail(page, 'counter');
  await f.getByRole('button', { name: 'Increase' }).click();
  await f.getByRole('button', { name: 'Increase' }).click();
  await expect(f.locator('.value')).toHaveText('2');
  await expect(root.locator('[id$="-inspect"]')).toBeHidden();
  await root.getByRole('button', { name: 'Inspect' }).click();
  await expect(root.getByRole('table')).toContainText('--count');
  await root.getByRole('button', { name: 'Reset' }).click();
  await expect(root.frameLocator('iframe').first().locator('.value')).toHaveText('0');
});

test('attribute sync: real aria-expanded and hidden attributes', async ({ page }) => {
  const { f } = await detail(page, 'attribute-sync');
  const toggle = f.getByRole('button', { name: 'Shipping details' });
  await expect(f.locator('#shipping-details')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(f.locator('#shipping-details')).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(f.locator('#shipping-details')).toHaveAttribute('hidden', '');
});

test('tabs: arrow keys move selection and focus, prevent() cancels them, one tab stop', async ({ page }) => {
  const { f } = await detail(page, 'tabs');
  await f.locator('body').evaluate(() => { (window as any).seen = []; addEventListener('keydown', (e) => (window as any).seen.push([e.key, e.defaultPrevented])); });
  const tab = (n: string) => f.getByRole('tab', { name: n });
  await expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
  await expect(tab('Syntax')).toHaveAttribute('tabindex', '-1');
  await tab('Overview').click();
  await page.keyboard.press('ArrowRight');
  await expect(tab('Syntax')).toHaveAttribute('aria-selected', 'true');
  await expect(tab('Syntax')).toBeFocused();
  await expect(f.getByRole('tabpanel')).toHaveCount(1);
  await expect(f.locator('#panel-2')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft'); // wraps to the last tab
  await expect(tab('Support')).toBeFocused();
  await page.keyboard.press('Tab'); // not handled by a rule: not cancelled
  expect(await f.locator('body').evaluate(() => (window as any).seen)).toEqual([['ArrowRight', true], ['ArrowLeft', true], ['ArrowLeft', true], ['Tab', false]]);
});

test('focus & blur: opening the search focuses its field after the click', async ({ page }) => {
  const { f } = await detail(page, 'focus-blur');
  await expect(f.locator('.field')).toBeHidden();
  await f.getByRole('button', { name: 'Search' }).click();
  await expect(f.getByRole('searchbox', { name: 'Search' })).toBeFocused();
});

test('source tabs, the full source and focus after "Show all"', async ({ page }) => {
  const { root } = await detail(page, 'tabs');
  await expect(root.locator('#source pre')).toContainText('prevent()');
  await root.getByRole('tab', { name: 'index.html' }).click();
  await expect(root.locator('#source pre')).toContainText('role="tablist"');
  const all = root.getByRole('button', { name: /^Show all/ });
  if (await all.count()) { await all.click(); await expect(root.locator('#source pre')).toBeFocused(); }
});

test('Open in Playground loads the example stylesheet', async ({ page }) => {
  await page.goto('/playground/?example=counter');
  await expect(page.getByRole('radio', { name: 'Counter' }).last()).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel(/^CSS editor/)).toHaveValue(/--count: state\(0\)/);
  await expect(page.getByLabel(/^HTML editor/)).toHaveValue(/class="value"/);
  await expect(page.getByText('No diagnostics · running')).toBeVisible({ timeout: 10_000 });
  // Long lines scroll inside the editor card; the card's frame does not scroll with them.
  await page.goto('/playground/?example=live-values');
  await page.setViewportSize({ width: 1000, height: 900 });
  const frame = await page.locator('#pg-css').evaluate((t) => {
    const s = t.closest('.overflow-auto')!;
    return { scrolls: s.scrollWidth > s.clientWidth, border: getComputedStyle(s.closest('.rounded-block')!).borderTopWidth, page: document.documentElement.scrollWidth - innerWidth };
  });
  expect(frame).toEqual({ scrolls: true, border: '1px', page: 0 });
});

test('breadcrumbs: no repeated labels, no self links, Advanced under Examples', async ({ page }) => {
  for (const path of ['/examples/counter/', '/examples/tabs/', '/docs/introduction/', '/docs/reference/state/']) {
    await page.goto(path);
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link');
    const labels = await crumbs.allTextContents();
    const hrefs = await crumbs.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(new Set(labels).size, `${path}: ${labels.join(' / ')}`).toBe(labels.length);
    expect(hrefs, path).not.toContain(path);
  }
  await page.goto('/examples/control-center/');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Examples\s*\/\s*Advanced/);
});

test('search: one result per example, no generated anchors', async ({ page }) => {
  await page.goto('/');
  const input = await openSearch(page);
  for (const q of ['attribute sync', 'dropdown menu', 'counter']) {
    await input.fill(q);
    await expect.poll(() => page.getByRole('option').count()).toBeGreaterThan(0);
    const hrefs = await page.getByRole('option').evaluateAll((os) => os.map((o) => o.getAttribute('href') ?? ''));
    expect(hrefs.filter((h) => /#_r|:r/.test(h)), q).toEqual([]);
    const pages = hrefs.filter((h) => !h.includes('#'));
    expect(new Set(pages).size, `${q}: ${pages.join(' ')}`).toBe(pages.length);
  }
  await input.fill('attribute sync');
  await expect.poll(() => page.getByRole('option').evaluateAll((os) => os.slice(0, 5).map((o) => o.getAttribute('href')))).toContain('/examples/attribute-sync/');
});

test.describe('screen widths', () => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    test(`gallery and a detail page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/examples/', '/examples/tabs/', '/examples/product-configurator/', '/playground/']) {
        await page.goto(path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test('every published library demo page runs without runtime diagnostics', async ({ page }) => {
  test.setTimeout(120_000);
  const demoIds = readdirSync(new URL('../../src/generated/demos/', import.meta.url));
  // The library demos the site publishes: the Test lab group of the gallery (0.8 syntax).
  await page.goto('/examples/');
  const ids = (await page.locator('[data-group=interfaces] h3 a, [data-group=lab] h3 a').evaluateAll((as) => as.map((a) => a.getAttribute('href')!)))
    .map((h) => h.split('/')[2]!).filter((id) => demoIds.includes(id));
  expect(ids.length).toBeGreaterThanOrEqual(12);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const id of ids) {
    const { f } = await detail(page, id);
    await expect(f.locator('main')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator('[role=status]', { hasText: 'diagnostics' }), id).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
