// 0.10 step 8: the limits of "CSS shows the computed state". A computed custom property is
// written inline on its owners; it is not a general CSS cascade. These tests pin down, for
// declarations the runtime does not process (external, constructed, cross-origin stylesheets,
// inline styles), where CSS and the state agree, where they do not, and what is reported.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { open, frames, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const diag = async (page: Page) => (await diagnostics(page)).join('\n');
const FORM = `.form { --value: state(" hello "); --clean: trim(--value) }
  .inner:when(--clean == "hello") { color: rgb(255, 0, 0) }`;
const BODY = '<div class="form" id="f"><div class="inner" id="i"></div></div>';
/** Lets the development check run (100 ms after new owners). */
const settle = async (page: Page) => { await frames(page); await page.waitForTimeout(250); };
const css = (page: Page, url: string, text: string) => page.route(url, (x) => x.fulfill({ contentType: 'text/css', body: text }));

test('a same-origin stylesheet without reactive syntax, on a descendant: CSS and state disagree there; development builds say so', async ({ page }) => {
  await css(page, '**/theme.css', '.form .inner { --clean: "theme" }');
  await open(page, { head: `<link rel="stylesheet" href="/theme.css"><style>${FORM}</style>`, body: BODY });
  await settle(page);
  expect(await v(page, '#f', '--clean')).toBe('"hello"'); // the owner agrees
  expect(await v(page, '#i', '--clean')).toBe('"theme"'); // CSS inside the owner shows the other value…
  expect(await v(page, '#i', 'color')).toBe('rgb(255, 0, 0)'); // …while the state there is still "hello"
  expect(await diag(page)).toMatch(/--clean is computed, and http:\/\/localhost:\d+\/theme\.css also declares it \(\.form \.inner\)\. Reactive CSS does not process that stylesheet/);
});

test('the same case in a production build: not reported (the documented limit)', async ({ page }) => {
  const min = readFileSync(new URL('../../dist/reactive-css.min.js', import.meta.url), 'utf8');
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: min }));
  await css(page, '**/theme.css', '.form .inner { --clean: "theme" }');
  await open(page, { head: `<link rel="stylesheet" href="/theme.css"><style>${FORM}</style>`, body: BODY });
  await settle(page);
  expect([await v(page, '#f', '--clean'), await v(page, '#i', '--clean')]).toEqual(['"hello"', '"theme"']);
  expect(await diagnostics(page)).toEqual([]);
});

test('on the owner: a normal declaration loses to the inline value (agree); !important wins (reported in development)', async ({ page }) => {
  await css(page, '**/theme.css', '.form { --clean: "theme" } .form.forced { --clean: "forced" !important }');
  await open(page, { head: `<link rel="stylesheet" href="/theme.css"><style>${FORM}</style>`, body: BODY + BODY.replace('class="form" id="f"', 'class="form forced" id="g"').replace('id="i"', 'id="j"') });
  await settle(page);
  expect(await v(page, '#f', '--clean')).toBe('"hello"');
  expect(await v(page, '#g', '--clean')).toBe('"forced"');
  const d = await diag(page);
  expect(d).toMatch(/--clean on div#g\.form\.forced: CSS shows "forced", its computed state is "hello"/);
  expect(d).toMatch(/theme\.css also declares it \(\.form\)/);
});

test('a processed stylesheet (it has reactive syntax) is enforced: the name is not computed, in every build', async ({ page }) => {
  await css(page, '**/theme.css', '.x { --n: state(0) } .form .inner { --clean: "theme" }');
  await open(page, { head: `<link rel="stylesheet" href="/theme.css"><style>${FORM}</style>`, body: BODY });
  await settle(page);
  expect(await diag(page)).toMatch(/--clean is declared 2 times in the processed stylesheets/);
  expect(await page.$eval('#f', (e) => (e as HTMLElement).style.getPropertyValue('--clean'))).toBe('');
});

test('a constructed stylesheet and an inline style inside an owner: reported in development', async ({ page }) => {
  await open(page, { head: `<style>${FORM}</style>`, body: BODY.replace('id="i"', 'id="i" style="--clean: \'inline\'"') + BODY.replace('id="f"', 'id="f2"').replace('id="i"', 'id="i2"') });
  await page.evaluate(() => { const s = new CSSStyleSheet(); s.replaceSync('#f2 .inner { --clean: "constructed" }'); document.adoptedStyleSheets = [s]; });
  await page.evaluate(() => document.body.append(Object.assign(document.createElement('div'), { className: 'form', id: 'f3' }))); // a new owner: the check runs again
  await settle(page);
  expect(await v(page, '#i', '--clean')).toMatch(/^['"]inline['"]$/); // engines differ in the quotes they keep
  expect(await v(page, '#i2', '--clean')).toBe('"constructed"');
  const d = await diag(page);
  expect(d).toMatch(/--clean on div#i\.inner has an inline style value inside a computed owner \(div#f\.form\)/);
  expect(d).toMatch(/--clean is computed, and a constructed stylesheet also declares it \(#f2 \.inner\)/);
});

test('a cross-origin stylesheet cannot be checked: development builds say so instead of staying silent', async ({ page }) => {
  await css(page, 'http://other.test/theme.css', '.form .inner { --clean: "theme" }');
  await open(page, { head: `<link rel="stylesheet" href="http://other.test/theme.css"><style>${FORM}</style>`, body: BODY });
  await settle(page);
  expect(await v(page, '#i', '--clean')).toBe('"theme"');
  expect(await diag(page)).toMatch(/http:\/\/other\.test\/theme\.css cannot be read \(cross-origin without CORS\), so Reactive CSS cannot check whether it declares --clean/);
});
