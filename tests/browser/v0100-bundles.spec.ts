// 0.10 optimization: custom bundles without the event runtime still run value functions, computed
// custom properties and formatting, and report what they left out.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, diagnostics } from './helpers';

async function bundle(page: Page, features: string[]) {
  // @ts-expect-error: plain ESM tooling
  const { build } = await import('../../tools/bundle.mjs');
  const r = await build({ features });
  expect(r.ok).toBe(true);
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: r.code }));
}
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);

test('strings + text, no events: value functions, in text: and from a computed chain', async ({ page }) => {
  await bundle(page, ['derived', 'text', 'conditions']);
  await open(page, { head: `<style>.f { --v: state("  Héllo "); --c: lower(trim(--v)); --n: length(--c) }
    .f .t { text: var(--c) } .f .n { text: var(--n) } .f:when(--n > 3) .w { color: rgb(255, 0, 0) }</style>`, body: '<div class="f"><i class="t"></i><i class="n"></i><b class="w"></b></div>' });
  await frames(page);
  expect([await text(page, '.t'), await text(page, '.n')]).toEqual(['héllo', '5']);
  expect(await page.$eval('.w', (e) => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)');
  expect(await diagnostics(page)).toEqual([]);
});

test('format + text, no strings or events: numbers format; what is left out is reported by feature', async ({ page }) => {
  await bundle(page, ['format', 'text']);
  await open(page, { head: `<style>.f { --n: state(1234.5) } .f .a { text: format(--n, "integer") } .f .b { text: length("abc") } .f .c { text: format(--n, "HH:mm") } .f button:on(click) { --n: set(1) }</style>`,
    body: '<div class="f" lang="en-US"><i class="a"></i><i class="b"></i><i class="c"></i><button>x</button></div>' });
  await frames(page);
  expect(await text(page, '.a')).toBe('1,235');
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/length\(\) is not included in this bundle \(feature "strings"\)/);
  expect(d).toMatch(/:on\(\) is not included in this bundle \(feature "events"\)/);
  expect(d).toMatch(/"HH:mm" is not a format\(\) style .*date patterns are not included in this bundle \(feature "datetime"\)/);
});

test('a clock with no events: datetime, dynamic, derived and text', async ({ page }) => {
  await bundle(page, ['datetime', 'dynamic', 'derived', 'text']);
  const at = new Date('2026-10-28T10:00:58Z');
  await page.clock.install({ time: new Date(at.getTime() - 10_000) });
  await page.clock.pauseAt(at);
  await open(page, { head: `<style>.k { --now: live(time(), 1s); --tokyo: timezone(--now, "Asia/Tokyo") } .k .t { text: format(--tokyo, "HH:mm:ss") }</style>`, body: '<div class="k"><span class="t"></span></div>' });
  await page.clock.runFor(50);
  expect(await text(page, '.t')).toBe('19:00:58');
  await page.clock.runFor(1000);
  expect(await text(page, '.t')).toBe('19:00:59');
  expect(await diagnostics(page)).toEqual([]);
});

test('events without event-timing reports debounce(); with it, it runs', async ({ page }) => {
  const css = '.s { --q: state("") } .s input:on(input, debounce(100ms)) { --q: set(event(value)) } .s .t { text: var(--q) }';
  const body = '<div class="s"><input><span class="t"></span></div>';
  await bundle(page, ['events', 'text']);
  await open(page, { head: `<style>${css}</style>`, body });
  await frames(page);
  expect((await diagnostics(page)).join('\n')).toMatch(/debounce\(\) and throttle\(\) is not included in this bundle \(feature "event-timing"\)/);
  await page.unroute('**/dist/reactive-css.js');
  await bundle(page, ['event-timing', 'text']);
  await open(page, { head: `<style>${css}</style>`, body });
  await page.fill('input', 'hi');
  await page.waitForTimeout(250);
  expect(await text(page, '.t')).toBe('hi');
  expect(await diagnostics(page)).toEqual([]);
});
