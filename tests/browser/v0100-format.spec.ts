// 0.10 step 5 (format): format(number, style [, currency]) in the nearest lang; numeric strings;
// @font-face format("woff2") stays CSS, in the full bundle and in a bundle without the feature.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, stats, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
const NBSP = ' ';

test('invoice: currency, percent and integer in the nearest lang; updates with the state', async ({ page }) => {
  await open(page, {
    head: `<style>.inv { --qty: state(1); --rate: state(0.19) }
      .inv button:on(click) { --qty: increment(1) }
      .inv .total { text: format(--qty * 1234567.89, "currency", "EUR") }
      .inv .tax { text: format(--rate, "percent") }
      .inv .n { text: format(--qty * 1000.5, "integer") }</style>`,
    body: `<div class="inv"><button>+</button><b class="total"></b><i class="tax"></i><s class="n"></s></div>
      <div class="inv" lang="de-DE"><button>+</button><b class="total"></b><i class="tax"></i><s class="n"></s></div>
      <div class="inv" lang="not a tag!"><b class="total"></b></div>`,
  });
  await page.evaluate(() => document.documentElement.setAttribute('lang', 'en-US'));
  await frames(page);
  const read = (i: number) => page.$$eval('.inv', (els, i) => [...els[i].querySelectorAll('b, i, s')].map((e) => e.textContent), i);
  expect(await read(1)).toEqual([`1.234.567,89${NBSP}€`, `19${NBSP}%`, '1.001']); // the section's lang
  await page.click('.inv >> nth=1 >> button');
  await frames(page);
  expect(await read(1)).toEqual([`2.469.135,78${NBSP}€`, `19${NBSP}%`, '2.001']);
  // An invalid lang falls back to the browser's locale (not an error).
  const fallback = await page.evaluate(() => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', signDisplay: 'negative' } as any).format(1234567.89));
  expect(await text(page, '.inv >> nth=2 >> b')).toBe(fallback);
  expect(await diagnostics(page)).toEqual([]);
});

test('numeric strings: a trimmed input value compares and calculates as a number', async ({ page }) => {
  await open(page, {
    head: `<style>.f { --raw: state("0"); --next: state(0) }
      .f input:on(input) { --raw: set(trim(event(value))); --next: set(trim(event(value)) + 1) }
      .f .ok { display: none }
      .f:when(--raw >= 18) .ok { display: inline }
      .f .out { text: format(--raw, "decimal") }</style>`,
    body: '<div class="f"><input><span class="ok">adult</span><span class="out"></span></div>',
  });
  const set = (s: string) => page.$eval('input', (el: HTMLInputElement, s) => { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }, s);
  await set(' 021 ');
  await frames(page);
  expect([await v(page, '.ok', 'display'), await v(page, '.f', '--next')]).toEqual(['inline', '22']);
  await set('17');
  await frames(page);
  expect(await v(page, '.ok', 'display')).toBe('none');
  expect(await diagnostics(page)).toEqual([]);
  await set('abc'); // not a number: the condition is unknown, the write is dropped, one diagnostic each
  await frames(page);
  expect([await v(page, '.ok', 'display'), await v(page, '.f', '--next')]).toEqual(['none', '18']);
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/cannot compare "abc" \(string\) with 18 \(number\)/);
  expect(d).toMatch(/"abc" is not a number\. Nothing is changed\./);
  expect(d).toMatch(/format\(\): "decimal" formats numbers; "abc" is a string\. No value\./);
});

test('@font-face format() stays CSS: a font-only sheet is never processed', async ({ page }) => {
  await open(page, {
    head: `<style>@font-face { font-family: A; src: url(/none.woff2) format("woff2"), url(/none.woff) format(woff) }
      body { font-family: A, sans-serif }</style>
      <style>.p { --n: state(3) } .p .t { text: format(--n / 4, "percent") }</style>`,
    body: '<div class="p"><span class="t"></span></div>',
  });
  await frames(page);
  expect((await stats(page)).sheets).toBe(1); // only the reactive sheet
  expect(await text(page, '.t')).toMatch(/75/);
  expect(await page.evaluate(() => (document.styleSheets[0].cssRules[0] as CSSFontFaceRule).style.getPropertyValue('src'))).toMatch(/format\("woff2"\).*format\("?woff"?\)/);
  expect(await diagnostics(page)).toEqual([]);
});

test('a bundle without format: fonts are left alone, format(--n, …) is reported', async ({ page }) => {
  // @ts-expect-error: plain ESM tooling
  const { build } = await import('../../tools/bundle.mjs');
  const r = await build({ features: ['events', 'strings', 'text'] });
  expect(r.ok).toBe(true);
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: r.code }));
  await open(page, {
    head: `<style>@font-face { font-family: A; src: url(/none.woff2) format("woff2") }</style>
      <style>@font-face { font-family: B; src: url(/none.woff) format(woff) } .p { --n: state(3) } .p .t { text: length(trim(" ab ")) } .p .u { text: format(--n, "integer") }</style>`,
    body: '<div class="p"><span class="t"></span><span class="u"></span></div>',
  });
  await frames(page);
  expect((await stats(page)).sheets).toBe(1);
  expect(await text(page, '.t')).toBe('2');
  const d = await diagnostics(page);
  expect(d).toHaveLength(1);
  expect(d[0]).toMatch(/format\(\).*"format"/); // the missing feature is named, once; nothing about the fonts
});
