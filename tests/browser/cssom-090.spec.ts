// 0.9.0 hardening: the compiler and CSSOM pipeline with the new rule-level syntax
// (docs/release-0.9.0-hardening.md, section E).
import { test, expect, type Page } from '@playwright/test';
import { open, frames, diagnostics, stats } from './helpers';

const COUNTER = '<div class="c"><button class="b">b</button></div>';
const n = (page: Page) => page.$eval('.c', (e) => getComputedStyle(e).getPropertyValue('--n').trim());
const click = async (page: Page, times = 1) => { for (let i = 0; i < times; i++) await page.click('.b'); await frames(page); };

test('@media, @supports and @layer decide which mutation applies, like any declaration', async ({ page }) => {
  await open(page, { head: `<style>
    .c { --n: state(0) }
    .c .b:on(click) { --n: increment(1) }
    @media (min-width: 600px) { .c .b:on(click) { --n: increment(10) } }
    @supports (display: grid) { .c .b:on(click) { --n: increment(100) } }
    @layer base { .c .b:on(click) { --n: increment(1000) } }
  </style>`, body: COUNTER });
  await click(page);
  expect(await n(page)).toBe('100'); // the last unlayered winner; the layered rule loses to every unlayered one
  await page.setViewportSize({ width: 500, height: 600 });
  await click(page);
  expect(await n(page)).toBe('200');
});

test('@container: a conditional event rule follows its container query', async ({ page }) => {
  await open(page, { head: `<style>
    .w { container-type: inline-size; width: 300px }
    .c { --n: state(0) }
    .c .b:on(click) { --n: increment(1) }
    @container (min-width: 400px) { .c .b:on(click) { --n: increment(5) } }
  </style>`, body: `<div class="w">${COUNTER}</div>` });
  await click(page);
  expect(await n(page)).toBe('1');
  await page.$eval('.w', (e) => { (e as HTMLElement).style.setProperty('width', '500px'); });
  await click(page);
  expect(await n(page)).toBe('6');
});

test('CSS nesting: &:on(), nested focus:, nested --attr-* and content', async ({ page }) => {
  await open(page, { head: `<style>
    .c { --n: state(0); --o: state(false);
      & .b { --attr-data-n: var(--n); &:on(click) { --n: increment(2); --o: set(true) } }
      & .v { content: var(--n) }
      & input { focus: when(--o) }
    }</style>`, body: '<div class="c"><button class="b">b</button><span class="v">0</span><input></div>' });
  await page.click('.b');
  await expect(page.locator('.c input')).toBeFocused();
  await frames(page);
  expect(await page.textContent('.v')).toBe('2');
  await expect(page.locator('.b')).toHaveAttribute('data-n', '2');
  expect(await diagnostics(page)).toEqual([]);
});

test('linked same-origin and cross-origin (CORS) sheets work; cross-origin without CORS is skipped with a note', async ({ page }) => {
  // A cross-origin sheet with CORS is read and compiled (its state works); its behavior is untrusted (next test).
  await page.route('http://cdn.test/ok.css', (r) => r.fulfill({ contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: '.c { --n: state(7) }' }));
  await page.route('**/t/css/same.css', (r) => r.fulfill({ contentType: 'text/css', body: '.c .b:on(click) { --n: increment(1) }' }));
  await page.route('http://cdn.test/no.css', (r) => r.fulfill({ contentType: 'text/css', body: '.d { --m: state(0) } .d b:on(click) { --m: increment(1) }' }));
  await open(page, { head: '<link rel="stylesheet" href="http://cdn.test/ok.css" crossorigin><link rel="stylesheet" href="/t/css/same.css"><link rel="stylesheet" href="http://cdn.test/no.css">', body: COUNTER });
  await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 2);
  await click(page, 2);
  expect(await n(page)).toBe('9');
  expect((await diagnostics(page)).join('\n')).toMatch(/Skipped cross-origin stylesheet http:\/\/cdn\.test\/no\.css/);
});

test('cross-origin sheets are untrusted: their :on() rules are dropped, never run', async ({ page }) => {
  await page.route('http://cdn.test/ev.css', (r) => r.fulfill({ contentType: 'text/css', headers: { 'Access-Control-Allow-Origin': '*' }, body: '.c { --n: state(0) } .c .b:on(click) { --n: increment(1) }' }));
  await open(page, { head: '<link rel="stylesheet" href="http://cdn.test/ev.css" crossorigin>', body: COUNTER });
  await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 1);
  await click(page);
  expect(await n(page)).toBe('0');
  expect((await diagnostics(page)).join('\n')).toMatch(/:on\(\) is ignored in untrusted stylesheets/);
});

test('disabled sheets: their event rules apply only while enabled', async ({ page }) => {
  await page.route('**/t/css/extra.css', (r) => r.fulfill({ contentType: 'text/css', body: '.c .b:on(click) { --n: increment(10) } .c .b { color: rgb(1, 1, 1) }' }));
  await open(page, { head: '<style>.c { --n: state(0) } .c .b:on(click) { --n: increment(1) }</style><link rel="stylesheet" href="/t/css/extra.css" id="x" disabled>', body: COUNTER });
  await frames(page);
  await click(page);
  expect(await n(page)).toBe('1');
  await page.$eval('#x', (l) => { (l as HTMLLinkElement).disabled = false; });
  await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 2);
  await click(page);
  expect(await n(page)).toBe('11'); // the later sheet wins by source order
  await page.$eval('#x', (l) => { (l as HTMLLinkElement).disabled = true; });
  await frames(page);
  await click(page);
  expect(await n(page)).toBe('12');
});

test('alternate sheets: event rules follow whether the browser applies the sheet', async ({ page }) => {
  await page.route('**/t/css/alt.css', (r) => r.fulfill({ contentType: 'text/css', body: '.c .b:on(click) { --n: increment(10) } .c .b { color: rgb(2, 2, 2) }' }));
  await open(page, { head: '<style>.c { --n: state(0) } .c .b:on(click) { --n: increment(1) }</style><link rel="alternate stylesheet" title="alt" href="/t/css/alt.css">', body: COUNTER });
  await frames(page);
  const applied = (await page.$eval('.b', (e) => getComputedStyle(e).color)) === 'rgb(2, 2, 2)';
  await click(page);
  expect(await n(page)).toBe(applied ? '10' : '1');
});

test('inserting, replacing and removing sheets: rules, candidates and listeners follow; nothing accumulates', async ({ page }) => {
  await open(page, { head: '<style>.c { --n: state(0) }</style>', body: COUNTER });
  const before = await stats(page);
  for (let i = 1; i <= 30; i++) {
    await page.evaluate((i) => {
      document.getElementById('dyn')?.remove();
      const s = document.createElement('style'); s.id = 'dyn'; s.textContent = `.c .b:on(click) { --n: increment(${i}) } .c .b:on(pointermove) { --n: set(var(--n)) }`;
      document.head.append(s);
    }, i);
  }
  await frames(page);
  await click(page);
  expect(await n(page)).toBe('30');
  const mid = await stats(page);
  expect(mid.internal.actionListeners).toBe(2); // click, pointermove: once each
  await page.evaluate(() => document.getElementById('dyn')!.remove());
  await frames(page);
  const after = await stats(page);
  expect(after.internal.actionListeners).toBe(0);
  expect(after.bindings).toBe(before.bindings);
  expect(after.internal.watchers).toBe(before.internal.watchers);
  await click(page);
  expect(await n(page)).toBe('30');
});

test('a large, mostly native sheet keeps every native rule; the reactive rules in it work', async ({ page }) => {
  const native = Array.from({ length: 3000 }, (_, i) => `.u${i} > .v:hover, .x${i} { color: #${(i * 4099 % 0xffffff).toString(16).padStart(6, '0')}; margin: ${i % 7}px }`).join('\n');
  await open(page, { head: `<style>${native}\n.c { --n: state(0) } .c .b:on(click) { --n: increment(1) } .x2999 { padding: 3px }</style>`, body: COUNTER + '<i class="x1234"></i><i class="x2999"></i>' });
  await click(page);
  expect(await n(page)).toBe('1');
  expect(await page.$eval('.x1234', (e) => getComputedStyle(e).marginTop)).toBe(`${1234 % 7}px`);
  expect(await page.$eval('.x2999', (e) => getComputedStyle(e).padding)).toBe('3px');
  expect(await page.evaluate(() => document.styleSheets[0].cssRules.length)).toBe(3003);
});

test('selector lists: native and :when() mix; an :on() list mixed with a plain selector is rejected like any invalid selector list', async ({ page }) => {
  await open(page, { head: `<style>.c { --n: state(0); --on: state(true) } .c .b:on(click) { --n: increment(1) }
    .p:hover, .c:when(--on) .q { color: rgb(1, 2, 3) }
    .c .b:on(click), .r { --n: toggle() } .r { color: rgb(4, 5, 6) }</style>`, body: '<div class="c"><button class="b">b</button><i class="q"></i><i class="r"></i></div>' });
  await frames(page);
  expect(await page.$eval('.q', (e) => getComputedStyle(e).color)).toBe('rgb(1, 2, 3)');
  expect(await page.$eval('.r', (e) => getComputedStyle(e).color)).toBe('rgb(4, 5, 6)');
  expect((await diagnostics(page)).join('\n')).toMatch(/every selector of the rule must use :on\(\)/);
  await click(page);
  expect(await n(page)).toBe('1');
});

test('@import: the imported sheet is not processed (documented); its native rules still apply', async ({ page }) => {
  await page.route('**/t/css/imported.css', (r) => r.fulfill({ contentType: 'text/css', body: '.c .b { color: rgb(7, 8, 9) } .c .b:on(click) { --n: increment(5) }' }));
  await open(page, { head: '<style>@import "/t/css/imported.css"; .c { --n: state(0) } .c .b:on(click) { --n: increment(1) }</style>', body: COUNTER });
  await click(page);
  expect(await n(page)).toBe('1');
  expect(await page.$eval('.b', (e) => getComputedStyle(e).color)).toBe('rgb(7, 8, 9)');
});

test('empty rule-level rules survive the pipeline when the source keeps them (compiled from source, not from the CSSOM)', async ({ page }) => {
  await open(page, { head: `<style>.d { --o: state(false) } .d .b:on(click) { --o: toggle() } .d input { focus: when(--o) } .d a:on(click, prevent()) {}</style>`,
    body: '<div class="d"><button class="b">b</button><input><a href="#gone">a</a></div>' });
  await page.click('.d .b');
  await expect(page.locator('.d input')).toBeFocused();
  await page.click('.d a');
  expect(page.url()).not.toContain('#gone');
  // The browser itself drops them: they never reach the CSSOM in their original form.
  expect(await page.evaluate(() => [...document.styleSheets[0].cssRules].some((r) => r.cssText.includes(':on(') || r.cssText.includes(':focus(')))).toBe(false);
});
