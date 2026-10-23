// Security regressions: what CSS can and cannot do through Reactive CSS behavior.
import { test, expect } from '@playwright/test';
import { open, style, frames, stats, diagnostics } from './helpers';

test('bind: never exposes password, one-time-code or payment fields', async ({ page }) => {
  await open(page, {
    head: `<style>.f { --s: state("") } .f input { bind: --s } .f b::before { content: var(--s) }</style>`,
    body: `<div class="f"><input type="password" id="pw"><input autocomplete="cc-number" id="cc"><input autocomplete="one-time-code" id="otp"><b></b></div>`,
  });
  for (const id of ['#pw', '#cc', '#otp']) await page.fill(id, 'secret');
  await frames(page);
  expect(await page.$eval('.f b', (e) => getComputedStyle(e, '::before').content)).toBe('""');
  expect((await diagnostics(page)).filter((d) => /bind: is refused/.test(d))).toHaveLength(3);
});

test('a sensitive autocomplete token is read from the attribute, not the property (as Firefox reports it)', async ({ page }) => {
  // Firefox returns "" from .autocomplete for tokens it does not know, such as one-time-code. Emulate that
  // here, so every engine checks that bind:, bind(value) and attr() still refuse the field.
  await open(page, {
    head: `<style>.f { --s: state(""); --a: state(attr(data-x, "none")) } .f input.old { bind: --s } .f b::before { content: var(--s) }
      .f i { display: none } .f input.new { --v: state("", bind(value)) } .f input.new:when(--v != "") + i { display: block }</style>`,
    body: `<div class="f" data-x="ok"><input autocomplete="one-time-code" class="old" id="a"><input autocomplete="one-time-code" class="new" id="b"><i>seen</i><b></b></div>
      <script>for (const id of ['a', 'b']) Object.defineProperty(document.getElementById(id), 'autocomplete', { get: () => '' });</script>`,
  });
  for (const id of ['#a', '#b']) await page.fill(id, 'secret');
  await frames(page);
  expect(await page.$eval('.f b', (e) => getComputedStyle(e, '::before').content)).toBe('""');
  expect(await page.$eval('.f i', (e) => getComputedStyle(e).display)).toBe('none');
  expect((await diagnostics(page)).filter((d) => /refused/.test(d)).length).toBeGreaterThanOrEqual(2);
});

test('bound text is an inert CSS string, whatever the user types', async ({ page }) => {
  await open(page, {
    head: `<style>.f { --s: state("") } .f input { bind: --s } .f b::before { content: var(--s) } .victim { display: block; width: 5px }</style>`,
    body: '<div class="f"><input><b></b></div><i class="victim"></i>',
  });
  const evil = `"; } .victim { display: none } x { content: "\\\\ \\n url(javascript:alert(1))`;
  page.on('dialog', () => { throw new Error('a dialog opened'); });
  await page.fill('.f input', evil);
  await expect.poll(() => page.$eval('.f b', (e) => getComputedStyle(e, '::before').content)).toBe(JSON.stringify(evil)); // CSS escaping of " and \ matches JSON's for this text
  expect(await style(page, '.victim', 'display')).toBe('block');
});

test('only registered actions and events exist: no prototype names, nothing executable', async ({ page }) => {
  page.on('dialog', () => { throw new Error('a dialog opened'); });
  await open(page, {
    head: `<style>.c { --a: state(false); --v: state(x) }
      #p { on: click(constructor(--a)) } #q { on: click(__proto__(--a)) } #r { on: click(toString()) }
      #s { on: hasOwnProperty(toggle(--a)) } #t { on: click(set(--v, javascript:alert(1))) }</style>`,
    body: '<div class="c"><button id="p">p</button><button id="q">q</button><button id="r">r</button><button id="s">s</button><button id="t">t</button></div>',
  });
  for (const id of ['#p', '#q', '#r', '#s', '#t']) await page.click(id);
  await frames(page);
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/unknown action "constructor\(--a\)"/);
  expect(d).toMatch(/unknown action "__proto__\(--a\)"/);
  expect(d).toMatch(/unknown action "toString\(\)"/);
  expect(d).toMatch(/hasOwnProperty\(toggle\(--a\)\)/);
  expect(d).toMatch(/"javascript:alert\(1\)" is not supported/); // values are literals, never calls
  expect((await stats(page)).stateChanges).toBe(0);
});

test('trustInlineStyles: false accepts behavior only from same-origin linked stylesheets', async ({ page }) => {
  await open(page, {
    head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script>
      <link rel="stylesheet" href="/t/css/app.css">
      <style>#evil { on: click(set(--n, 99)) } .f input { bind: --n } .ok { width: pick(3px); display: block }</style>`,
    body: '<div class="c"><button id="good">g</button><button id="evil">e</button><div class="f"><input type="number"></div><i></i><b class="ok"></b></div>',
    css: { 'app.css': `.c { --n: state(0) } #good { on: click(increment(--n)) } .c i { display: block; width: calc(var(--n) * 1px) }` },
  });
  await expect.poll(() => style(page, '.ok', 'width')).toBe('3px'); // non-behavior reactive CSS still works inline
  await page.click('#good');
  await page.click('#evil');
  await page.fill('.f input', '50');
  await expect.poll(() => style(page, '.c i', 'width')).toBe('1px');
  expect((await diagnostics(page)).join('\n')).toMatch(/on: is ignored in untrusted stylesheets/);
});
