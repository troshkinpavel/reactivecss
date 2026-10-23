// The bundle builder page: selection semantics, presets, output, analyzer, keyboard, layout,
// publication status, and that its code stays on its own page.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const build = (page: Page) => page.locator('[data-output="2 · Build"] code');
const state = (page: Page, id: string) => page.locator(`[data-feature="${id}"]`).getAttribute('data-state');
const hydrated = (page: Page) => page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
// Sizes and profiles as the library measured and defines them (synced by scripts/sync-runtime.mjs), never copied by hand.
const bundles = JSON.parse(readFileSync(new URL('../../src/generated/bundles.json', import.meta.url), 'utf8'));
const measured = (name: string) => (bundles.sizes.measured as { name: string; minified: number }[]).find((m) => m.name === name)!.minified.toLocaleString('en-US');

test('is reachable from the homepage, the footer (Vision too), Installation and Getting Started', async ({ page }) => {
  for (const [from, name] of [['/', 'Open the Bundle Builder →'], ['/', 'Bundle builder'], ['/vision/', 'Bundle builder'], ['/docs/installation/', 'bundle builder'], ['/docs/getting-started/', 'bundle builder']] as const) {
    await page.goto(from);
    await page.getByRole('link', { name, exact: true }).first().click();
    await expect(page, `${from} → ${name}`).toHaveURL(/\/bundle-builder\/$/);
  }
});

test('selection: core is fixed, requirements are added and locked, reset clears', async ({ page }) => {
  await page.goto('/bundle-builder/');
  await hydrated(page);
  await expect(page.getByRole('checkbox', { name: /^Core & state/ })).toBeDisabled();
  await expect(build(page)).toHaveText('npx -p @reactivecss/core -p esbuild reactive-css build --features core --out public/reactive-css.min.js');
  await expect(page.locator('[data-size]')).toContainText(measured('core')); // core alone is measured
  await page.getByRole('checkbox', { name: /^Declarative focus/ }).check();
  expect(await state(page, 'events')).toBe('required');
  await expect(page.getByRole('checkbox', { name: /^Events & actions/ })).toBeDisabled();
  await expect(page.locator('[data-added]')).toHaveText('Events & actions (required by Declarative focus)');
  await expect(build(page)).toHaveText('npx -p @reactivecss/core -p esbuild reactive-css build --features focus --out public/reactive-css.min.js');
  await expect(page.locator('[data-size]')).toContainText('Exact size available after building.');
  await expect(page).toHaveURL(/\?features=focus$/);
  await page.getByRole('checkbox', { name: /^Declarative focus/ }).uncheck();
  expect(await state(page, 'events')).toBe('off');
  await page.getByRole('checkbox', { name: /^DOM text/ }).check();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(build(page)).toContainText('--features core');
  await expect(page).toHaveURL(/\/bundle-builder\/$/);
});

test('presets: real profiles, measured sizes against the standard bundle, matching demos', async ({ page }) => {
  await page.goto('/bundle-builder/');
  await hydrated(page);
  await page.getByRole('button', { name: /^Forms/ }).click();
  await expect(page.getByRole('button', { name: /^Forms/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(build(page)).toHaveText('npx -p @reactivecss/core -p esbuild reactive-css build --profile forms --out public/reactive-css.min.js');
  const size = page.locator('[data-size]');
  await expect(size.getByRole('row', { name: /minified/ })).toContainText(measured('forms'));
  await expect(size.getByRole('row', { name: /minified/ })).toContainText(measured('dist full'));
  await expect(page.locator('[data-summary]').getByRole('link', { name: 'accessible-toggle' })).toBeVisible();
  // One more feature: no longer a profile, no longer measured.
  await page.getByRole('checkbox', { name: /^History/ }).check();
  await expect(page.getByRole('button', { name: /^Forms/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(build(page)).toContainText('--features events,history,forms,text,attributes');
  await expect(size).toContainText('Exact size available after building.');
});

test('a shared link restores the selection; unknown names are reported, not used', async ({ page }) => {
  await page.goto('/bundle-builder/?features=text,evnts');
  await hydrated(page);
  await expect(page.getByRole('alert')).toContainText('Unknown feature "evnts"');
  expect(await state(page, 'text')).toBe('selected');
  await expect(build(page)).toContainText('--features text ');
  await page.goto('/bundle-builder/?profile=stateful-ui');
  await hydrated(page);
  await expect(page.getByRole('button', { name: /^Stateful interfaces/ })).toHaveAttribute('aria-pressed', 'true');
});

test('output path, format and copy', async ({ page, browserName, context }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/bundle-builder/');
  await hydrated(page);
  const out = page.getByLabel('Output file');
  await out.fill('../escape.js');
  await expect(out).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('relative path ending in .js');
  await out.fill('static/rcss.js');
  await page.getByRole('radio', { name: 'ES module' }).click();
  await expect(build(page)).toHaveText('npx -p @reactivecss/core -p esbuild reactive-css build --features core --out static/rcss.js --format esm');
  await expect(page.locator('[data-output="3 · Import it"] code')).toContainText("import { start } from './static/rcss.js';");
  await page.getByRole('button', { name: 'Copy build command' }).click();
  await expect(page.getByRole('button', { name: 'Copy build command' })).toHaveText('Copied');
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx -p @reactivecss/core -p esbuild reactive-css build --features core --out static/rcss.js --format esm');
});

test('analyzer: the compiler loads only when used, and its result can be applied', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', (r) => { if (/reactive-css\.esm/.test(r.url())) loaded.push(r.url()); });
  await page.goto('/bundle-builder/');
  await hydrated(page);
  expect(loaded).toEqual([]);
  await page.getByLabel(/Paste every stylesheet/).fill('.tabs { --i: state(1); on: key(ArrowRight, prevent(), increment(--i)) } .tab:nth-var(--i) { color: red } .x { focus: var(--i) }');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('[data-analysis="done"]')).toContainText('Recommended: core, events, nth-var, focus.');
  expect(loaded.length).toBe(1);
  await page.getByRole('button', { name: 'Use these features' }).click();
  await expect(build(page)).toContainText('--features events,nth-var,focus');
  await page.getByLabel(/Paste every stylesheet/).fill('@import url(theme.css); .a { --n: state(0) }');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.locator('[data-analysis="done"]')).toContainText('the full runtime, because the analysis is incomplete');
  await page.getByRole('button', { name: 'Use the full runtime' }).click();
  await expect(build(page)).toContainText('--profile full');
});

test('keyboard: presets, Reset, then one stop per feature (its checkbox and its syntax disclosure); Space toggles', async ({ page, browserName }) => {
  // WebKit's Tab skips buttons and links unless the macOS "keyboard navigation" setting is on.
  test.skip(browserName === 'webkit', 'Tab order is checked in Chromium');
  await page.goto('/bundle-builder/');
  await hydrated(page);
  await page.getByRole('button', { name: /^Basic interactions/ }).focus();
  const presets = Object.keys(bundles.catalog.profiles).length;
  for (let i = 0; i < presets; i++) await page.keyboard.press('Tab'); // the other presets, then Reset
  await expect(page.getByRole('button', { name: 'Reset' })).toBeFocused();
  await page.keyboard.press('Tab'); // core's checkbox is disabled: its "Syntax and reference" disclosure comes next
  await expect(page.locator(':focus')).toHaveText(/Syntax and reference/);
  await page.keyboard.press('Enter'); // opens it: the reference links follow
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '/docs/reference/state/');
  // Closed rows add a single stop: from core's last link, events' checkbox is a few Tabs away, not dozens.
  const events = page.getByRole('checkbox', { name: /^Events & actions/ });
  let tabs = 0;
  for (; tabs < 8 && !(await events.evaluate((e) => e === document.activeElement)); tabs++) await page.keyboard.press('Tab');
  await expect(events).toBeFocused();
  await page.keyboard.press('Space');
  await expect(build(page)).toHaveText(/--profile basic/);
});

test('keyboard: Space on a focused feature checkbox', async ({ page }) => {
  await page.goto('/bundle-builder/');
  await hydrated(page);
  await page.getByRole('checkbox', { name: /^DOM text/ }).focus();
  await page.keyboard.press('Space');
  await expect(build(page)).toContainText('--features text ');
});

test('the builder island and the compiler load on the builder page only', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  for (const p of ['/', '/docs/getting-started/', '/vision/', '/docs/custom-bundles/']) await page.goto(p);
  expect(scripts.filter((s) => /BundleBuilder|reactive-css\.esm/.test(s))).toEqual([]);
});

test('npm state follows config/distribution.json: pinned CDN tags as text, never links; install from npm only once published', async ({ page }) => {
  const { version } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  const published = (JSON.parse(readFileSync(new URL('../../config/distribution.json', import.meta.url), 'utf8')).core.npmVersions as string[]).includes(version);
  await page.goto('/docs/installation/');
  await expect(page.getByText('Illustrative until published')).toHaveCount(published ? 0 : 1);
  await expect(page.getByText(`cdn.jsdelivr.net/npm/@reactivecss/core@${version}/dist/reactive-css.min.js`).first()).toBeVisible();
  expect(await page.locator('main a[href*="cdn.jsdelivr.net"], main a[href*="unpkg.com"]').count()).toBe(0);
  await expect(page.locator('main')).toContainText(published ? `npm install --save-dev @reactivecss/core@${version} esbuild` : 'npm pack');
  await page.goto('/bundle-builder/');
  await expect(page.getByText('not published yet', { exact: true })).toHaveCount(published ? 0 : 1);
  await expect(page.locator('[data-output="1 · Install"] code')).toContainText(published ? `@reactivecss/core@${version}` : 'is not published yet');
});

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px; long commands scroll inside their block`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/bundle-builder/?profile=full&features=geometry');
    await hydrated(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const pre = page.locator('[data-output="1 · Install"] pre');
    await expect(pre).toHaveAttribute('tabindex', '0');
    expect(await pre.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
  });
}

test('compatible demos link only to published pages, and each row keeps its syntax one click away', async ({ page, request }) => {
  await page.goto('/bundle-builder/');
  await hydrated(page);
  await page.getByRole('button', { name: /^Full runtime/ }).click();
  const links = await page.locator('[data-summary] a[href^="/examples/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(links.length).toBe(18);
  expect(links).not.toContain('/examples/dynamic-components/');
  for (const h of links) expect((await request.get(h)).status(), h).toBe(200);
  const row = page.locator('[data-feature="focus"]');
  const syntax = row.getByText('focus: when(condition) | var(--boolean) | true | false');
  await expect(syntax).toBeHidden();
  await row.getByText('Syntax and reference').click();
  await expect(syntax).toBeVisible();
  await expect(row.getByRole('link', { name: 'focus:' })).toHaveAttribute('href', '/docs/reference/focus-declaration/');
});

test('each feature alone: the page includes exactly what the resolver requires, marks it, and clears it again', async ({ page }) => {
  // The library's own catalog and resolver (the page's port is checked against them in tests/unit/bundles.test.ts).
  const tools = await import(new URL('../../../tools/bundle.mjs', import.meta.url).href);
  const CATALOG = tools.catalog().features as { id: string; title: string }[];
  const resolve = tools.resolve as (s: { features: string[] }) => { features: string[]; added: { id: string }[]; optionalMissing: unknown[] };
  await page.goto('/bundle-builder/');
  await hydrated(page);
  for (const f of CATALOG.filter((x) => x.id !== 'core')) {
    const box = page.locator(`[data-feature="${f.id}"] input[type=checkbox]`);
    await box.check();
    const r = resolve({ features: [f.id] });
    await expect(page.locator('[data-included]'), f.id).toHaveText(r.features.join(' · '));
    await expect(page.locator('[data-selected]'), f.id).toHaveText(f.title);
    for (const a of r.added) expect(await state(page, a.id), `${a.id} for ${f.id}`).toBe('required');
    expect(await state(page, f.id)).toBe('selected');
    if (r.optionalMissing.length) await expect(page.locator('[data-summary]')).toContainText('not added');
    await box.uncheck();
    await expect(page.locator('[data-included]')).toHaveText('core');
  }
});
