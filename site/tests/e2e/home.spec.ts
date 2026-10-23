// The homepage (Home v2). Every demo is Reactive CSS 0.9.0 running in the page itself, from
// public/home/home.css: these tests drive them the way a visitor does and read the real DOM.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const registry = JSON.parse(readFileSync(new URL('../../src/generated/registry.json', import.meta.url), 'utf8'));
const bundles = JSON.parse(readFileSync(new URL('../../src/generated/bundles.json', import.meta.url), 'utf8'));
const gz = (name: string) => ((bundles.sizes.measured as { name: string; gzip: number }[]).find((m) => m.name === name)!.gzip / 1000).toFixed(1);

async function open(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats?.().states > 0);
}
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
/** Pointer positions are sub-pixel: the runtime rounds them, so a reading may be one pixel off the integer we aimed at. */
const near = (got: number[], want: number[]) => got.every((g, i) => Math.abs(g - want[i]!) <= 1);
const px = (s: string | null) => parseFloat(s ?? '');

test('one runtime, no diagnostics, no console errors; the headline reads "CSS that reacts."', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  expect(await page.evaluate(() => (window as any).ReactiveCSS.version)).toBe(registry.version);
  expect(await page.evaluate(() => (window as any).ReactiveCSS.diagnostics)).toEqual([]);
  expect(await page.locator('script[src="/runtime/reactive-css.min.js"]').count()).toBe(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('CSS that reacts.');
  await expect(page.locator('footer')).toContainText(`v${registry.version} · experimental`);
  await expect(page.getByRole('complementary', { name: 'Demo version' })).toContainText(`Reactive CSS ${registry.version} is experimental`);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('hero: a tap moves the marker there, a drag follows the pointer, keys move it, previous() marks where it was', async ({ page }) => {
  await open(page);
  const field = await box(page, '.field');
  const marker = page.locator('.marker');
  const centre = async () => { const b = (await marker.boundingBox())!; return [Math.round(b.x + b.width / 2 - field.x), Math.round(b.y + b.height / 2 - field.y)]; };
  await page.mouse.click(field.x + 100, field.y + 80);
  await expect.poll(async () => near(await centre(), [100, 80])).toBe(true);
  expect(Math.abs(px(await page.locator('.hv-readout .rdx').textContent()) - 100)).toBeLessThanOrEqual(1);
  expect(Math.abs(px(await page.locator('.chip-y').textContent()) - 80)).toBeLessThanOrEqual(1);
  // The headline: x is 100 of the field's width, so the nearest letter of "reacts." turns vermilion.
  const letter = Math.min(6, Math.floor((100 / field.width) * 7));
  await expect(page.locator('.hv-g').nth(letter)).toHaveCSS('color', 'oklch(0.55 0.2 35)');
  // previous() puts the ring where the marker was before the tap.
  const ghost = await box(page, '.hv-ghost');
  expect(Math.round(ghost.x + ghost.width / 2 - field.x)).toBeGreaterThan(100);
  // Drag from the marker: it follows the pointer, the live tag says so, and no tap runs after.
  await page.mouse.move(field.x + 100, field.y + 80);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(field.x + 100 + i * 30, field.y + 80 + i * 10);
  await expect(page.locator('.hv-live span')).toHaveText('dragging');
  // The ring stays where the drag started instead of trailing the pointer.
  const held = await box(page, '.hv-ghost');
  expect(near([Math.round(held.x + held.width / 2 - field.x), Math.round(held.y + held.height / 2 - field.y)], [100, 80])).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => near(await centre(), [280, 140])).toBe(true);
  await expect(page.locator('.hv-live span')).toHaveText('idle');
  expect(Math.abs(px(await page.locator('.chip-x').textContent()) - 280)).toBeLessThanOrEqual(1);
  // Keyboard: a step is 2.5 % of the field's width.
  await marker.focus();
  const y0 = (await centre())[1]!;
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => Math.abs((await centre())[1]! - (y0 + field.height * 0.025)) <= 1).toBe(true);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0); // prevent(): no scroll
});

test('01 and 03: the menu toggles --open, aria-expanded and the list; Send a click shares the same state; the path replays', async ({ page }) => {
  await open(page);
  const button = page.locator('.nav').getByRole('button', { name: 'Menu' });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  // The state and the real attribute change at once; the replay shows the menu at its step (750 ms).
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('.menu').isVisible()).toBe(false);
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('.open-v')).toHaveText('true');
  // The replay: rows and diagram nodes animate while :changed(--open) matches.
  await expect.poll(() => page.locator('.hv-tr[data-step]').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('hv-row');
  await expect(page.locator('.hv-nodes .live.state')).toHaveText('--open: true');
  await expect(page.locator('.hv-nodes .live.dom')).toHaveText('aria-expanded="true"');
  await page.getByRole('button', { name: 'Send a click' }).click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.menu')).toBeHidden();
  await expect(page.locator('.hv-nodes .live.style')).toHaveText('.menu → display: none');
});

test('2.1 counter: increment(), decrement(), DOM text, and the 06 history and condition specimens', async ({ page }) => {
  await open(page);
  const value = page.locator('.counter .value');
  await value.scrollIntoViewIfNeeded();
  await expect(value).toHaveText('3');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(value).toHaveText('6');
  await expect(page.locator('.chip-count')).toHaveText('6');
  await expect(page.locator('.c-previous .v')).toHaveText('5');
  await expect(page.locator('.c-direction .v')).toHaveText('1  ▲ up');
  await expect(page.locator('.c-when .v')).toHaveText('many');
  await expect(page.locator('.c-whensel [data-when="yes"]')).toBeVisible();
  await expect(page.locator('.c-changed [data-when="now"]')).toBeVisible();
  await page.getByRole('button', { name: 'Decrement', exact: true }).click();
  await expect(value).toHaveText('5');
  await expect(page.locator('.c-direction .v')).toHaveText('-1  ▼ down');
  await expect(page.locator('.c-when .v')).toHaveText('few');
  await expect(page.locator('.c-changed [data-when="idle"]')).toBeVisible({ timeout: 3000 });
});

test('2.2 canvas: event(local-x/y) captured at the click; Enter captures the centre', async ({ page }) => {
  await open(page);
  const canvas = await box(page, '.canvas');
  await page.locator('.canvas').scrollIntoViewIfNeeded();
  const c = await box(page, '.canvas');
  await expect(page.locator('.canvas .cx')).toHaveText('—');
  await page.mouse.click(c.x + 120, c.y + 90);
  await expect(page.locator('.canvas .cx')).toHaveText(/px$/);
  const got = [px(await page.locator('.canvas .cx').textContent()), px(await page.locator('.canvas .cy').textContent())];
  expect(near(got, [120, 90]), String(got)).toBe(true);
  await expect(page.locator('.chip-cx')).toHaveText(`${got[0]}px`);
  await expect.poll(async () => { const d = await box(page, '.canvas .dot'); return near([d.x + d.width / 2 - c.x, d.y + d.height / 2 - c.y], got); }).toBe(true);
  await page.locator('.canvas').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.canvas .cx')).toHaveText(`${Math.round(canvas.width / 2)}px`);
});

test('2.3 theme: persist() keeps the choice across a reload; aria-pressed follows', async ({ page }) => {
  await open(page);
  const dark = page.getByRole('button', { name: 'Dark' });
  await dark.scrollIntoViewIfNeeded();
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sample')).toHaveCSS('background-color', 'rgb(28, 27, 25)');
  await expect(page.locator('.theme-v')).toHaveText('dark');
  await open(page); // reload
  await expect(page.locator('.theme-v')).toHaveText('dark');
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('.theme-v')).toHaveText('light');
});

test('04 runtime: measured sizes; Compact keeps every module; Custom toggles modules and counts them', async ({ page }) => {
  await open(page);
  const seg = page.getByRole('radiogroup', { name: 'Bundle' });
  await seg.scrollIntoViewIfNeeded();
  const num = page.locator('.hv-size .num');
  await expect(num).toHaveText(gz('dist full'), { useInnerText: true });
  await seg.getByRole('radio', { name: 'Compact' }).click();
  await expect(seg.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
  await expect(num).toHaveText(gz('dist compact'), { useInnerText: true });
  await expect(page.locator('.mod[aria-pressed="true"]')).toHaveCount(9);
  await expect(page.locator('.mod.events')).toBeDisabled();
  await seg.getByRole('radio', { name: 'Custom' }).click();
  await expect(page.locator('.mod.core')).toBeDisabled();
  await page.locator('.mod.gestures').click();
  await page.locator('.mod.history').click();
  await expect(page.locator('.mod.gestures')).toHaveAttribute('aria-pressed', 'false');
  await expect(num).toHaveText('7/9', { useInnerText: true });
  await page.locator('.mod.history').click();
  await expect(num).toHaveText('8/9', { useInnerText: true });
});

test('06 specimens: mouse(), element(), viewport(), visible() and live() read live; random() and pick() redraw on click', async ({ page }) => {
  await open(page);
  await page.locator('.hv-spec').scrollIntoViewIfNeeded();
  // The value sources are printed by native counters (::after); the computed counter-reset holds the number.
  const after = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).counterReset.replace(/^n /, ''));
  const cell = await box(page, '.c-element');
  await page.mouse.move(cell.x + 20, cell.y + 20);
  await expect.poll(async () => Math.abs(parseFloat(await after('.c-mouse .x')) - (cell.x + 20)) <= 1).toBe(true);
  await expect.poll(() => after('.c-element .w')).toBe(`${Math.round(cell.width)}`);
  await expect.poll(() => after('.c-viewport .w')).toBe(`${page.viewportSize()!.width}`);
  await expect(page.locator('.c-visible .v .yes')).toBeVisible();
  await expect.poll(() => page.locator('.c-visible .v .no').evaluate((e) => e.getBoundingClientRect().width)).toBe(0);
  const tick = await after('.c-live .t');
  await expect.poll(() => after('.c-live .t'), { timeout: 4000 }).not.toBe(tick);
  // The needles turn toward the pointer.
  expect(await page.locator('.hv-needles span').first().evaluate((e) => getComputedStyle(e).rotate)).not.toBe('none');
  const roll = page.locator('.c-random .r');
  await page.locator('.c-random').click();
  await expect(roll).not.toHaveText('0.42');
  const word = page.locator('.c-pick .p');
  for (let i = 0; i < 6 && (await word.textContent()) === 'Hello!'; i++) { await page.locator('.c-pick').click(); await page.waitForTimeout(100); }
  await expect(word).not.toHaveText('Hello!');
});

test('links: every primary call to action and next step resolves', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('main a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  for (const h of ['/docs/getting-started/', '/playground/', '/examples/', '/bundle-builder/', '/docs/simplify-css/', '/docs/reference/', '/vision/', '/docs/introduction/']) expect(hrefs, h).toContain(h);
  for (const h of hrefs) expect((await request.get(h.split('#')[0]!)).status(), h).toBe(200);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the replay and the needles stay still; the state still changes', async ({ page }) => {
    await open(page);
    const button = page.locator('.nav').getByRole('button', { name: 'Menu' });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(await page.locator('.hv-tr[data-step]').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    expect(await page.locator('.hv-needles span').first().evaluate((e) => getComputedStyle(e).rotate)).toBe('none');
  });
});

test('idle: no frame work while nothing happens, apart from the one-second live() specimen', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => (window as any).ReactiveCSS.stats());
  await page.waitForTimeout(3000);
  const b = await page.evaluate(() => (window as any).ReactiveCSS.stats());
  // live(…, 1s) ticks once a second; nothing else flushes while the page is idle.
  expect(b.flushes - a.flushes).toBeLessThanOrEqual(4);
});

test('08 Tooling: the MCP block shows what the server returns and links to the MCP Server guide', async ({ page }) => {
  await open(page);
  const s = page.locator('#mcp');
  await expect(s.getByRole('heading', { level: 2 })).toHaveText('Your AI agent speaks Reactive CSS.');
  // The session lines follow the server's real answers: legacy 0.8 warnings, not errors.
  await expect(s.locator('figure')).toContainText('legacy 0.8');
  await expect(s.locator('figure')).toContainText('custom bundle: core, events, attributes');
  await expect(s.locator('figure')).toContainText('7 tools');
  // Only the client actually run against the server is named as verified.
  await expect(s.getByRole('list', { name: 'Clients' })).toHaveText(/MCP Inspector · verified/);
  await expect(s).not.toContainText('Claude Code');
  await s.getByRole('link', { name: 'Explore MCP integration →' }).click();
  await expect(page).toHaveURL('/docs/mcp/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/MCP Server/);
  const sidebar = page.locator('nav').filter({ hasText: 'Integrations' }).first();
  await expect(sidebar.getByRole('link', { name: 'MCP Server' })).toHaveAttribute('aria-current', 'page');
  // Only clients actually run against the server are marked verified.
  const rows = page.locator('table tr');
  await expect(rows.filter({ hasText: 'MCP Inspector' })).toContainText('Verified');
  for (const c of ['Claude Code', 'Cursor']) await expect(rows.filter({ hasText: c })).toContainText('Not verified');
});
