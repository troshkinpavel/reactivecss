// 0.10 step 4 (strings): length(), includes(), lower(), trim() in actions, conditions and declarations.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
/** One input event with `value`, in one task. */
const input = (page: Page, sel: string, value: string) => page.$eval(sel, (el: HTMLInputElement, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('character counter, inline: text: and :when() update in the frame after the input', async ({ page }) => {
  await open(page, {
    head: `<style>.f { --value: state("") }
      .f textarea:on(input) { --value: set(event(value)) }
      .f .count { text: length(trim(--value)); color: rgb(0, 0, 0) }
      .f:when(length(trim(--value)) > 5) .count { color: rgb(255, 0, 0) }</style>`,
    body: '<div class="f"><textarea></textarea><span class="count">?</span></div>',
  });
  await frames(page);
  expect(await text(page, '.count')).toBe('0');
  // Measured in one frame: the input event, then one requestAnimationFrame.
  const after = await page.evaluate(() => new Promise<string[]>((res) => {
    const t = document.querySelector('textarea')!;
    t.value = '  héllo 👍🏽  ';
    t.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.querySelector('.count')!;
      res([c.textContent!, getComputedStyle(c).color]);
    }));
  }));
  expect(after).toEqual(['7', 'rgb(255, 0, 0)']); // 7 graphemes after trim(); > 5
  await input(page, 'textarea', 'abc ');
  await frames(page);
  expect([await text(page, '.count'), await v(page, '.count', 'color')]).toEqual(['3', 'rgb(0, 0, 0)']);
  expect(await diagnostics(page)).toEqual([]);
});

test('search filter: includes(lower(attr()), lower(--q)) per card, Unicode', async ({ page }) => {
  await open(page, {
    head: `<style>.list { --q: state("") }
      .list input:on(input) { --q: set(trim(event(value))) }
      .list .card:when(not includes(lower(attr(data-name)), lower(--q))) { display: none }</style>`,
    body: `<div class="list"><input>
      <p class="card" data-name="Élan">1</p><p class="card" data-name="Banana">2</p><p class="card" data-name="café">3</p></div>`,
  });
  const shown = () => page.$$eval('.card', (cs) => cs.filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.textContent));
  await frames(page);
  expect(await shown()).toEqual(['1', '2', '3']); // an empty part is found
  await input(page, 'input', '  AN ');
  await frames(page);
  expect(await shown()).toEqual(['1', '2']);
  await input(page, 'input', 'é');
  await frames(page);
  expect(await shown()).toEqual(['1', '3']); // "É" lower-cased; "é" normalized (NFC)
  await input(page, 'input', 'e');
  await frames(page);
  expect(await shown()).toEqual([]); // no accent folding: "élan" and "café" do not contain "e"
  expect(await diagnostics(page)).toEqual([]);
});

test('actions: values stored as strings and numbers; synchronous', async ({ page }) => {
  await open(page, {
    head: `<style>.a { --name: state(""); --len: state(0); --has: state(false) }
      .a input:on(input) { --name: set(lower(trim(event(value)))); --len: set(length(event(value))); --has: set(includes(--name, "x")) }</style>`,
    body: '<div class="a"><input></div>',
  });
  await page.$eval('input', (el: HTMLInputElement) => {
    for (const s of [' AX ', ' Bob ']) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await frames(page);
  // --has reads --name before this event's writes (the 0.9 transaction rule): "ax" from the first event.
  expect([await v(page, '.a', '--name'), await v(page, '.a', '--len'), await v(page, '.a', '--has')]).toEqual(['"bob"', '5', '1']);
  expect(await diagnostics(page)).toEqual([]);
});

test('when() with a call: the runtime path, with native if() on and off; custom properties', async ({ page }) => {
  for (const native of [true, false]) {
    await open(page, {
      native,
      head: `<style>.w { --v: state("ab"); width: when(length(--v) > 2, 20px, 10px); --clean: trim(--v); --up: lower(--v); height: 5px }
        .w:on(click) { --v: set(" ABCD ") }</style>`,
      body: '<div class="w"></div>',
    });
    await frames(page);
    expect([await v(page, '.w', 'width'), await v(page, '.w', '--clean')]).toEqual(['10px', '"ab"']);
    await page.click('.w');
    await frames(page);
    expect([await v(page, '.w', 'width'), await v(page, '.w', '--clean'), await v(page, '.w', '--up')]).toEqual(['20px', '"ABCD"', '" abcd "']); // (0.9.1 collapses runs of spaces in a written string)
    expect(await diagnostics(page)).toEqual([]);
  }
});

test('errors: text arguments only; one diagnostic each; nothing written', async ({ page }) => {
  await open(page, {
    head: `<style>.e { --n: state(3); --s: state("ok"); --out: state("unchanged") }
      .e button:on(click) { --out: set(lower(var(--n))) }
      .e .c { text: length(--n) }
      .e:when(includes(--n, "3")) .m { color: rgb(255, 0, 0) }
      .e .m { color: rgb(0, 0, 255) }</style>`,
    body: '<div class="e"><button>b</button><span class="c">?</span><span class="m">m</span></div>',
  });
  await page.click('button');
  await page.click('button');
  await frames(page);
  expect(await v(page, '.e', '--out')).toBe('"unchanged"');
  expect(await v(page, '.m', 'color')).toBe('rgb(0, 0, 255)'); // unknown condition: :when() does not match
  const d = await diagnostics(page);
  expect(d.filter((x) => /lower\(\) takes text, not 3 \(number\)/.test(x))).toHaveLength(1); // the same message is reported once (0.9 log)
  expect(d.filter((x) => /length\(--n\): length\(\) takes text, not 3 \(number\)\. No value\./.test(x))).toHaveLength(1);
  expect(d.filter((x) => /includes\(\) takes text, not 3 \(number\)/.test(x))).toHaveLength(1);
});
