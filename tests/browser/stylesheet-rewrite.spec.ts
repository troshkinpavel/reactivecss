// The compiled sheet replaces the original by changing only the rules compilation changed.
// The resulting rules, the cascade and stop()'s restoration must equal a full rewrite.
import { test, expect, type Page } from '@playwright/test';
import { open, frames } from './helpers';

/** The original rule texts before start: an inline script at the end of the body runs before deferred scripts. */
const CAPTURE = `<script>window.__orig = [...document.styleSheets].map((s) => [...s.cssRules].map((r) => r.cssText)); window.__held = [...document.styleSheets[0].cssRules];</script>`;
const rules = (page: Page) => page.evaluate(() => [...document.styleSheets].map((s) => [...s.cssRules].map((r) => r.cssText)));
const color = (page: Page, sel: string) => page.$eval(sel, (e) => getComputedStyle(e).color);

test('stop() restores every sheet rule for rule, in order', async ({ page }) => {
  const css = `@layer base, app; @layer base { .w { display: inline-flex } } .w { --n: state(0) } .w .x:on(click) { --n: increment(1) } .p { color: red } .w .v { content: var(--n) } .p { color: red } @media (min-width: 1px) { .w { --k: state(1) } .q { margin: 1px } }`;
  await open(page, { head: `<style>${css}</style>`, body: '<div class="w"><button class="x">x</button><output class="v"></output></div><p class="p">p</p>' + CAPTURE });
  await frames(page);
  await page.click('.x');
  await frames(page);
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('1');
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect(await rules(page)).toEqual(await page.evaluate(() => (window as any).__orig));
});

test('identical duplicate rules and a reordered compiled sheet align correctly', async ({ page }) => {
  const css = `.a { color: rgb(1, 0, 0) } .w { --n: state(0) } .a { color: rgb(1, 0, 0) } .w .v { content: var(--n) } .a { color: rgb(1, 0, 0) } .b { color: rgb(0, 2, 0) }`;
  await open(page, { head: `<style>${css}</style>`, body: '<div class="w"><output class="v">x</output></div><p class="a">a</p><p class="b">b</p>' });
  await frames(page);
  const after = (await rules(page))[0];
  expect(after.filter((t) => t === '.a { color: rgb(1, 0, 0); }').length).toBe(3);
  expect(after.at(-1)).toBe('.b { color: rgb(0, 2, 0); }');
  expect(after.some((t) => t.includes('--rcss-text'))).toBe(true);
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('0');
  expect(await color(page, '.b')).toBe('rgb(0, 2, 0)');
});

test('rules that compilation does not change stay the same CSSRule objects, around a changed one', async ({ page }) => {
  await open(page, {
    head: '<style>.p { color: rgb(9, 9, 9) } .w { --n: state(0) } .w .v { content: var(--n) } .q { color: rgb(8, 8, 8) }</style>',
    body: '<div class="w"><output class="v"></output></div><p class="p">p</p><p class="q">q</p>' + CAPTURE,
  });
  await frames(page);
  const kept = await page.evaluate(() => { const held = (window as any).__held as CSSRule[]; return [held[0].parentStyleSheet === document.styleSheets[0], held[3].parentStyleSheet === document.styleSheets[0]]; });
  expect(kept).toEqual([true, true]);
  await page.evaluate(() => { (document.styleSheets[0].cssRules[0] as CSSStyleRule).style.color = 'rgb(1, 2, 3)'; });
  expect(await color(page, '.p')).toBe('rgb(1, 2, 3)');
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('0');
});

test('author insertRule after start, then a dynamic reactive sheet, then stop(): everything consistent', async ({ page }) => {
  await open(page, { head: '<style id="s">.w { --n: state(0) } .w .x:on(click) { --n: increment(1) } .w .v { content: var(--n) }</style>', body: '<div class="w"><button class="x">x</button><output class="v"></output></div>' });
  await frames(page);
  await page.evaluate(() => document.styleSheets[0].insertRule('.w .v { color: rgb(0, 0, 255) }', document.styleSheets[0].cssRules.length));
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.w .x:on(dblclick) { --n: set(10) }'; document.head.append(s); });
  await frames(page);
  await page.dblclick('.x');
  await frames(page);
  expect(await page.$eval('.v', (e) => [e.textContent, getComputedStyle(e).color])).toEqual(['10', 'rgb(0, 0, 255)']);
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect((await rules(page)).flat().some((t) => t.includes('--rcss'))).toBe(false);
});

test('a sheet edited by its author after start is compiled again and restored to the edited text', async ({ page }) => {
  await open(page, { head: '<style id="s">.w { --n: state(0) } .w .v { content: var(--n) } .p { color: rgb(1, 1, 1) }</style>', body: '<div class="w"><output class="v"></output></div><p class="p">p</p>' });
  await frames(page);
  await page.evaluate(() => { document.getElementById('s')!.textContent = '.w { --n: state(5) } .w .v { content: var(--n) } .p { color: rgb(2, 2, 2) }'; });
  await frames(page);
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('5');
  expect(await color(page, '.p')).toBe('rgb(2, 2, 2)');
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect((await rules(page))[0]).toEqual(['.w { --n: state(5); }', '.w .v { content: var(--n); }', '.p { color: rgb(2, 2, 2); }']);
});

test('layers keep their order when the compiled sheet re-inserts a layer statement', async ({ page }) => {
  await open(page, {
    head: '<style>@layer a, b; .w { --n: state(0) } @layer b { .t { color: rgb(0, 0, 2) } } @layer a { .t { color: rgb(0, 0, 1) } } @layer x, a;</style>',
    body: '<div class="w"><p class="t">t</p></div>',
  });
  await frames(page);
  expect(await color(page, '.t')).toBe('rgb(0, 0, 2)');
});

test('nested rules, @media and @supports blocks: cascade and restoration exact', async ({ page }) => {
  const css = `.w { --n: state(0); & .v { content: var(--n) } & .t { color: rgb(0, 0, 3) } } @media (min-width: 1px) { .t { margin-left: 2px } } @supports (display: grid) { .w .x:on(click) { --n: increment(1) } .t { padding-left: 4px } }`;
  await open(page, { head: `<style>${css}</style>`, body: '<div class="w"><button class="x">x</button><output class="v"></output><p class="t">t</p></div>' + CAPTURE });
  await frames(page);
  await page.click('.x');
  await frames(page);
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('1');
  expect(await page.$eval('.t', (e) => { const s = getComputedStyle(e); return [s.color, s.marginLeft, s.paddingLeft]; })).toEqual(['rgb(0, 0, 3)', '2px', '4px']);
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect(await rules(page)).toEqual(await page.evaluate(() => (window as any).__orig));
});

test('rules the browser drops (unknown at-rule, invalid selector) do not break the rewrite', async ({ page }) => {
  const css = `@unknown-rule foo { .p { color: red } } .w { --n: state(2) } .w .v { content: var(--n) } .p:not-a-pseudo { color: red } .p { color: rgb(4, 4, 4) }`;
  await open(page, { head: `<style>${css}</style>`, body: '<div class="w"><output class="v"></output></div><p class="p">p</p>' + CAPTURE });
  await frames(page);
  expect(await page.$eval('.v', (e) => e.textContent)).toBe('2');
  expect(await color(page, '.p')).toBe('rgb(4, 4, 4)');
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect(await rules(page)).toEqual(await page.evaluate(() => (window as any).__orig));
});

test('a sheet with more rules than the page has elements is replaced in full (cheaper there)', async ({ page }) => {
  const filler = Array.from({ length: 60 }, (_, i) => `.f${i} { margin: ${i}px }`).join(' ');
  await open(page, { head: `<style>.p { color: rgb(9, 9, 9) } .w { --n: state(0) } ${filler}</style>`, body: '<div class="w"></div><p class="p">p</p>' + CAPTURE });
  await frames(page);
  expect(await page.evaluate(() => (window as any).__held[0].parentStyleSheet === document.styleSheets[0])).toBe(false); // detached: full rewrite
  expect(await color(page, '.p')).toBe('rgb(9, 9, 9)');
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect(await rules(page)).toEqual(await page.evaluate(() => (window as any).__orig));
});
