// The Custom Bundles guide (design-source/Custom Bundles.dc.html) in the docs shell: its facts come
// from the library's catalog and size report, and it links to the one Bundle Builder. The commands
// it shows are run with the CLI in bundle-cli.spec.ts.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openSearch } from './search';

const data = JSON.parse(readFileSync(new URL('../../src/generated/bundles.json', import.meta.url), 'utf8'));
const nf = new Intl.NumberFormat('en-US');

test('docs shell: breadcrumb, header, release status and table of contents', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Custom Bundles');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link')).toHaveText(['Docs', 'Start']);
  await expect(page.getByRole('list', { name: 'About this feature' })).toContainText("Introduced in v0.8.0");
  const h2 = await page.locator('article h2').allTextContents();
  expect(h2.map((t) => t.trim())).toEqual(['How it works', 'Quick start', 'Features and dependencies', 'Analyzer', 'Bundle sizes', 'Advanced configuration', 'Hosting', 'FAQ']);
  // Release status follows config/distribution.json: the current core version is either listed there or not yet.
  const published = (JSON.parse(readFileSync(new URL('../../config/distribution.json', import.meta.url), 'utf8')).core.npmVersions as string[]).includes(data.package.version);
  await expect(page.locator('main')).toContainText('The full and compact bundles and the CLI, from the package.');
  for (const text of ['Not on npm yet', 'These URLs work once the package is on npm.']) {
    if (published) await expect(page.locator('main')).not.toContainText(text);
    else await expect(page.locator('main')).toContainText(text);
  }
  await expect(page.locator('article a[href*="cdn.jsdelivr"], article a[href*="unpkg.com"]')).toHaveCount(0);
});

test('links to the one Bundle Builder from the hero, dependencies, configuration and next steps', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  const builder = page.locator('article a[href="/bundle-builder/"]');
  expect(await builder.count()).toBeGreaterThanOrEqual(5);
  await page.getByRole('link', { name: 'Open Bundle Builder →' }).first().click();
  await expect(page).toHaveURL(/\/bundle-builder\/$/);
});

test('quick start: the path switch shows one version of step 2', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  const qs = page.locator('[data-quick-start]');
  await expect(qs.getByRole('heading', { name: 'Analyze your CSS' })).toBeVisible();
  await expect(qs.getByRole('heading', { name: 'Choose features' })).toBeHidden();
  await qs.getByText('Choose features', { exact: true }).first().click();
  await expect(qs.getByRole('heading', { name: 'Choose features' })).toBeVisible();
  await expect(qs.getByRole('heading', { name: 'Analyze your CSS' })).toBeHidden();
});

test('copy: a command block copies its command', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/custom-bundles/');
  const block = page.locator('[data-quick-start] li').filter({ hasText: 'Build the bundle' }).locator('figure, div').filter({ hasText: 'reactive-css build' }).first();
  await block.getByRole('button', { name: /Copy/ }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx -p @reactivecss/core -p esbuild reactive-css build --features events,conditions,focus --out public/reactive-css.min.js');
});

test('the selection illustration resolves with the catalog and writes the real command', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  const r = page.locator('[data-resolver]');
  await r.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr] [data-resolver]'));
  await expect(r.getByRole('button', { name: 'events · auto' })).toBeVisible();
  await expect(r).toContainText('events required by focus');
  await expect(r.locator('pre')).toHaveText('npx -p @reactivecss/core -p esbuild reactive-css build --features conditions,focus --out public/reactive-css.min.js');
  await r.getByRole('button', { name: 'forms' }).click();
  await expect(r).not.toContainText('forms is useful with focus');
  await r.getByRole('button', { name: 'focus' }).click();
  await expect(r.getByRole('button', { name: 'events · auto' })).toHaveCount(0);
  await expect(r).toContainText('nothing is built');
});

test('feature rows match the catalog: ids, requirements, status', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  const rows = page.locator('[data-feature-list] > details');
  expect(await rows.evaluateAll((r) => r.map((x) => x.getAttribute('data-feature')))).toEqual(data.catalog.features.map((f: { id: string }) => f.id));
  const focus = page.locator('[data-feature-list] > [data-feature="focus"]');
  await focus.locator('summary').click();
  await expect(focus).toContainText('core, events');
  await expect(focus).toContainText('forms (never added automatically)');
  await expect(focus).toContainText('experimental');
  await expect(focus.getByRole('link').first()).toHaveAttribute('href', /\/docs\/reference\//);
});

test('sizes are the release report’s, one metric at a time', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  const bars = page.locator('[data-size-bars]');
  const m = (name: string) => data.sizes.measured.find((x: { name: string }) => x.name === name);
  for (const n of ['core', 'basic', 'full', 'dist full']) await expect(bars.getByText(nf.format(m(n).minified), { exact: true })).toBeVisible();
  await bars.getByText('brotli', { exact: true }).click();
  await expect(bars.getByText(nf.format(m('dist full').brotli), { exact: true })).toBeVisible();
  await expect(bars.getByText(nf.format(m('dist full').minified), { exact: true })).toBeHidden();
});

test('the analyzer’s limits and the diagnostics are stated', async ({ page }) => {
  await page.goto('/docs/custom-bundles/');
  await expect(page.getByText('Static analysis sees only what you give it')).toBeVisible();
  await expect(page.locator('main')).toContainText('stylesheets loaded or created by scripts');
  await expect(page.locator('main')).toContainText('is not included in this bundle (feature "text")');
});

test('search finds the guide', async ({ page }) => {
  await page.goto('/');
  const input = await openSearch(page);
  for (const q of ['custom bundles', 'modular runtime', 'css analyzer', 'feature dependencies', 'cli build']) {
    await input.fill(q);
    await expect.poll(() => page.getByRole('option').evaluateAll((os) => os.slice(0, 5).map((o) => o.getAttribute('href') ?? '')), { message: q })
      .toEqual(expect.arrayContaining([expect.stringContaining('/docs/custom-bundles/')]));
  }
});

test.describe('screen widths', () => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/docs/custom-bundles/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }
});
