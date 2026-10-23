// The reference examples, run as they are shown, with the production runtime the site ships.
// Each test adds only markup and, where the snippet has no trigger of its own, one interaction rule.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import api from '../../src/content/api/entries.json' with { type: 'json' };

type Entry = (typeof api)[number];
const entry = (id: string) => api.find((e) => e.id === id)! as Entry & { usage?: { title: string; code: string }[] };
const code = (id: string) => (entry(id).example as { code: string }).code;
const usage = (id: string, title: string) => entry(id).usage!.find((u) => u.title.startsWith(title))!.code;

/** A blank page with the snippet, the markup and the site's runtime bundle. */
async function run(page: Page, css: string, html: string, extraCss = '') {
  const runtime = new URL('/runtime/reactive-css.min.js', test.info().project.use.baseURL ?? 'http://localhost:4400').href;
  await page.goto('/');
  await page.setContent(`<!doctype html><style>${css}\n${extraCss}</style><body>${html}<script src="${runtime}"></script></body>`);
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats);
  const diagnostics = await page.evaluate(() => ((window as any).ReactiveCSS.diagnostics as { message?: string }[]).map((d) => String(d.message ?? d)));
  return diagnostics;
}
/** scrollY once it has not changed for 300 ms. */
async function settled(page: Page) {
  let last = -1;
  for (let i = 0; i < 40; i++) { const y = await page.evaluate(() => scrollY); if (y === last) return y; last = y; await page.waitForTimeout(300); }
  return last;
}
const prop = (page: Page, sel: string, name: string) => page.locator(sel).evaluate((el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);

test('prevent(): the reference example cancels ArrowRight and still cycles the state', async ({ page }) => {
  expect(await run(page, code('prevent'), '<div class="tabs"><div role="tablist" tabindex="0">tabs</div></div>')).toEqual([]);
  await page.evaluate(() => { (window as any).seen = []; addEventListener('keydown', (e) => (window as any).seen.push([e.key, e.defaultPrevented])); });
  await page.locator('[role=tablist]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft'); // not handled: not cancelled
  expect(await page.evaluate(() => (window as any).seen)).toEqual([['ArrowRight', true], ['ArrowLeft', false]]);
  await expect.poll(() => prop(page, '.tabs', '--active')).toBe('2');
});

test('prevent(): a conditional rule stops real page scrolling only while its condition holds', async ({ page }) => {
  expect(await run(page, usage('prevent', 'Cancel only while'), '<div class="reader"><div class="page" tabindex="0">page</div></div>', 'body { height: 6000px; margin: 0; }')).toEqual([]);
  await page.locator('.page').focus();
  await page.keyboard.press('PageDown'); // --locked false: scrolls, then locks
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const y = await settled(page); // PageDown scrolls smoothly: wait for it to stop
  await page.keyboard.press('PageDown'); // --locked true: cancelled, then unlocks
  expect(await settled(page)).toBe(y);
  await page.keyboard.press('PageDown'); // unlocked again: scrolls
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
});

test('prevent(): the incorrect container rule also cancels a link inside it', async ({ page }) => {
  await run(page, usage('prevent', 'A click rule on a container'), '<div class="card"><a href="#moved">link</a></div>');
  await page.getByRole('link', { name: 'link' }).click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('text: writes real DOM text', async ({ page }) => {
  const html = '<div class="score"><span class="current">x</span> <span class="prev">x</span> <span class="delta">x</span> <span class="direction">—</span> <button class="up">+1</button></div>';
  expect(await run(page, code('text'), html, '.score .up { on: click(increment(--points)); }')).toEqual([]);
  await page.getByRole('button', { name: '+1' }).click();
  await expect(page.locator('.current')).toHaveText('1');
  await expect(page.locator('.prev')).toHaveText('0');
  await expect(page.locator('.delta')).toHaveText('1');
  await expect(page.locator('.direction')).toHaveText('▲ up');
});

test('attr: writes the real disabled attribute', async ({ page }) => {
  const html = '<div class="stepper"><button class="minus">−</button><button class="plus">+</button></div>';
  await run(page, code('attr-declaration'), html);
  await expect(page.locator('.minus')).toBeDisabled();
  for (let i = 0; i < 9; i++) await page.locator('.plus').click();
  await expect(page.locator('.plus')).toBeDisabled();
  await expect(page.locator('.plus')).toHaveAttribute('disabled', '');
  await expect(page.locator('.minus')).toBeEnabled();
});

test('focus: moves document.activeElement after a user action, never on load', async ({ page }) => {
  // The reference page's live example (docs-focus), run as it is.
  const dir = new URL('../../src/examples/docs-focus/', import.meta.url);
  expect(await run(page, readFileSync(new URL('style.css', dir), 'utf8'), readFileSync(new URL('index.html', dir), 'utf8'))).toEqual([]);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.placeholder)).toBe('Find a page');
});

test('animationend(): the reference example hides the toast when its own animation ends', async ({ page }) => {
  expect(await run(page, code('lifecycle-triggers'), '<div class="toast">Saved</div>')).toEqual([]);
  await expect(page.locator('.toast')).toBeVisible();
  await expect.poll(() => prop(page, '.toast', '--shown'), { timeout: 6000 }).toMatch(/^(0|false)$/);
  await expect(page.locator('.toast')).toBeHidden();
});
