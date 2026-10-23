// Site behavior: links, navigation, search, copy, table of contents, mobile layout, and an
// accessibility scan. Runs against the production build (with the Pagefind index).
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/docs/getting-started/', '/docs/reference/', '/docs/reference/state/', '/docs/simplify-css/', '/docs/migration/', '/docs/reference/on-rule/', '/examples/control-center/', '/playground/', '/design-system/', '/vision/', '/docs/performance/', '/examples/score-history/', '/bundle-builder/', '/docs/custom-bundles/', '/docs/installation/', '/examples/', '/examples/counter/', '/examples/tabs/', '/examples/context-menu/', '/examples/dropdown/', '/experiments/', '/docs/mcp/'];

test('every internal link resolves', async ({ page, request }) => {
  test.setTimeout(120_000);
  const seen = new Set<string>(), queue = ['/'], broken: string[] = [];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await request.get(path);
    if (res.status() !== 200) { broken.push(`${path} → ${res.status()}`); continue; }
    if (!(res.headers()['content-type'] ?? '').includes('text/html')) continue;
    await page.setContent(await res.text());
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')!));
    for (const h of hrefs) {
      if (!h.startsWith('/') || h.startsWith('//')) continue;
      const [p, hash] = h.split('#');
      if (!seen.has(p!)) queue.push(p!);
      if (hash && p === path && !(await page.$(`[id="${hash}"]`))) broken.push(`${path} → #${hash} missing`);
    }
  }
  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(60);
});

test('anchors on other pages exist', async ({ request }) => {
  // Cross-page anchors written in content, such as /docs/binding/#initialization.
  for (const [path, id] of [['/docs/binding/', 'initialization'], ['/docs/core-concepts/', 'feature-selection-policy'], ['/docs/geometry/', 'wave-was-removed'], ['/examples/', 'interfaces'], ['/examples/', 'api'], ['/vision/', 'experiment'], ['/docs/installation/', 'es-module']]) {
    expect(await (await request.get(path!)).text(), `${path}#${id}`).toContain(`id="${id}"`);
  }
});

test('docs navigation: sidebar marks the page, prev / next follow the reading order', async ({ page }) => {
  await page.goto('/docs/getting-started/');
  const nav = page.getByRole('navigation', { name: 'Documentation' });
  await expect(nav.getByRole('link', { name: 'Getting Started' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('navigation', { name: 'Previous and next' }).getByRole('link', { name: /Installation/ }).click();
  await expect(page).toHaveURL(/\/docs\/installation\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Installation');
});

test('API categories open on the current page', async ({ page }) => {
  await page.goto('/docs/reference/when/');
  const cat = page.locator('details', { hasText: 'Conditions' }).first();
  await expect(cat).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('when()');
  await expect(page.getByText('since 0.2')).toBeVisible();
});

test('removed features say so and point to the replacement', async ({ page }) => {
  await page.goto('/docs/reference/wave/');
  await expect(page.getByText('removed in 0.5').first()).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Removed in 0.5');
});

test('search: ⌘K opens it, results come from the index, Enter navigates, Escape closes', async ({ page }) => {
  await page.goto('/docs/introduction/');
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox', { name: 'Search' });
  await expect(input).toBeFocused();
  await expect(page.getByRole('option')).toHaveCount(6);
  await input.fill('nth-var');
  await expect(page.getByRole('option').first()).toContainText(':nth-var()');
  await expect(page.locator('mark').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Search documentation' }).click();
  await input.fill('cycle');
  await expect(page.getByRole('option').first()).toContainText('cycle()');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/cycle/);
});

test('copy buttons work in static code blocks', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/installation/');
  const block = page.locator('[data-code-panel]').first();
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(block.getByText('Copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('reactive-css.min.js');
});

test('table of contents follows the scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/getting-started/');
  await page.evaluate(() => scrollTo(0, document.getElementById('5-try-changing-it')!.getBoundingClientRect().top + scrollY - 100));
  await expect(page.locator('[data-toc="5-try-changing-it"]')).toHaveAttribute('data-active', '');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('docs menu opens the sidebar as a popover', async ({ page }) => {
    await page.goto('/docs/state/');
    await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeHidden();
    await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Documentation' });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Conditions' }).click();
    await expect(page).toHaveURL(/\/docs\/conditions\/$/);
  });

  test('no page scrolls horizontally', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('homepage menu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('#site-menu')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test('no console errors on the main pages', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  for (const p of PAGES) { await page.goto(p); await page.waitForTimeout(300); }
  expect(errors).toEqual([]);
});

test('accessibility: no serious or critical axe violations', async ({ page }) => {
  test.setTimeout(120_000);
  const found: string[] = [];
  for (const p of PAGES) {
    await page.goto(p);
    // Example previews are sandboxed documents; axe scans the page around them.
    // [data-dim]: the inactive when() branch is faded on purpose (a design signature), see docs/architecture.md.
    const r = await new AxeBuilder({ page }).exclude('iframe').exclude('[data-dim]').analyze();
    for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) found.push(`${p}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`);
  }
  expect(found).toEqual([]);
});

test('search indexes the 0.5.1–0.7.0 reference, the Vision page, performance, library demos and the 0.8.0 bundle pages', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox', { name: 'Search' });
  for (const [q, href] of [['prevent', '/docs/reference/prevent/'], ['focus declaration', '/docs/reference/focus-declaration/'], ['animationend', '/docs/reference/on-value/'], ['evolving', '/vision/'], ['latency', '/docs/performance/'], ['notification center', '/examples/notification-center/'], ['bundle builder', '/bundle-builder/'], ['analyzer', '/docs/custom-bundles/'], ['jsDelivr', '/docs/installation/']] as const) {
    await input.fill(q);
    // Results arrive asynchronously; poll until one of the first five points at the page.
    await expect.poll(() => page.getByRole('option').evaluateAll((os) => os.slice(0, 5).map((o) => o.getAttribute('href') ?? '')), { message: `${q} → ${href}` })
      .toEqual(expect.arrayContaining([expect.stringContaining(href)]));
  }
});



// Production SEO files and indexing rules (pre-launch audit WP-2). The canonical origin is whatever
// config/seo.json says; these checks hold for any value.
const seo = JSON.parse(readFileSync(new URL('../../config/seo.json', import.meta.url), 'utf8'));
const robotsOf = (html: string) => /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];

test('robots.txt points at the sitemap on the canonical origin', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text();
  expect(txt).toContain('User-agent: *');
  expect(txt).toContain(`Sitemap: ${seo.canonical}/sitemap-index.xml`);
});

test('every sitemap URL is an indexable page; redirects and legacy examples are left out', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  expect(paths.length).toBeGreaterThan(100);
  expect(paths).not.toContain('/docs/');
  for (const p of paths) expect(robotsOf(await (await request.get(p)).text()), p).toBe(seo.robots);
  // A site example the docs only embed: noindex, not in the sitemap.
  for (const p of ['/examples/dice/', '/examples/pg-counter/', '/examples/switch/']) {
    expect(robotsOf(await (await request.get(p)).text()), p).toBe('noindex, follow');
    expect(paths).not.toContain(p);
  }
  // The gallery's own example pages stay indexed, Interfaces included (their ids took over docs examples' URLs).
  for (const p of ['/examples/counter/', '/examples/tabs/', '/examples/accordion/', '/examples/dropdown/', '/examples/context-menu/']) expect(paths, p).toContain(p);
  // The 0.8 reference pages still answer, but only the migration page lists them.
  for (const p of ['/docs/reference/on/', '/docs/reference/bind/', '/docs/reference/text/']) {
    expect(paths, p).not.toContain(p);
    expect((await request.get(p)).status(), p).toBe(200);
  }
});

test('the docs redirect is immediate and accessible; the 404 page is noindex', async ({ page, request }) => {
  const stub = await (await request.get('/docs/')).text();
  expect(stub).toContain('<html lang="en">');
  expect(stub).toMatch(/http-equiv="refresh" content="0;url=\/docs\/introduction\/"/);
  expect(stub).toMatch(/<h1>/);
  await page.goto('/docs/');
  await expect(page).toHaveURL(/\/docs\/introduction\/$/);
  const notFound = await (await request.get('/404.html')).text();
  expect(robotsOf(notFound)).toBe('noindex, follow');
  expect(notFound).toContain('This page doesn’t exist.');
});

test('every page carries an Open Graph image', async ({ page }) => {
  for (const p of ['/', '/docs/getting-started/', '/examples/counter/']) {
    await page.goto(p);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${seo.canonical}${seo.ogImage}`);
  }
  expect((await page.request.get(seo.ogImage)).status()).toBe(200);
});

test('reference corrections: when() optional values, every on: trigger, closest() version', async ({ page }) => {
  await page.goto('/docs/reference/when/');
  await expect(page.locator('main')).toContainText('when(<condition>[, <if-true>[, <if-false>]])');
  await expect(page.locator('main')).toContainText('`when(condition)` gives'.replace(/`/g, ''));
  await page.goto('/docs/reference/on/');
  for (const t of ['focusin()', 'transitioncancel()', 'prevent()']) await expect(page.locator('main')).toContainText(t);
  await page.goto('/docs/reference/closest/');
  await expect(page.locator('main')).toContainText('0.3');
});
