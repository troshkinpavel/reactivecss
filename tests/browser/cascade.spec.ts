// Cascade correctness of the in-place stylesheet rewrite: the processed sheet must behave
// exactly like the original would have, had the browser understood the reactive syntax.
import { test, expect } from '@playwright/test';
import { open, style, frames, diagnostics, sheetCSS } from './helpers';

const R = 'rgb(255, 0, 0)', G = 'rgb(0, 128, 0)', B = 'rgb(0, 0, 255)';

test('cascade layers across sheets, nested layers, unlayered styles and !important', async ({ page }) => {
  await open(page, {
    head: `<style>@layer base, theme;</style>
      <link rel="stylesheet" href="/t/css/theme.css">
      <style>@layer base { .a, .b, .c, .d { color: ${B} } }</style>
      <style>.d { color: ${B} }</style>`,
    body: '<p class="a">a</p><p class="b">b</p><p class="c">c</p><p class="d">d</p>',
    css: { 'theme.css': `@layer theme { .a { color: pick(${R}) } }
      @layer theme { @layer inner { .b { color: pick(${G}) } } }
      @layer base { .c { color: pick(${R}) !important } }
      .d { color: pick(${R}) }` },
  });
  await expect.poll(() => style(page, '.a', 'color')).toBe(R); // theme layer beats base (declared order)
  expect(await style(page, '.b', 'color')).toBe(G); // nested layer theme.inner beats base
  expect(await style(page, '.c', 'color')).toBe(R); // !important in a layer
  expect(await style(page, '.d', 'color')).toBe(B); // later unlayered rule of equal specificity wins
});

test('@media, @supports, @container and nesting keep their conditions', async ({ page }) => {
  await open(page, {
    head: `<style>
      .wrap { container-type: inline-size; width: 300px }
      @media (min-width: 1px) { .m { width: pick(11px) } }
      @media (max-width: 1px) { .m { height: pick(99px) } }
      @supports (display: grid) { .s { width: pick(12px) } }
      @supports (display: nonsense) { .s { height: pick(99px) } }
      @container (min-width: 200px) { .q { width: pick(13px) } }
      @container (min-width: 900px) { .q { height: pick(99px) } }
      .n { & .k { width: pick(14px) } &.x { height: pick(15px) } }
      .m, .s, .q, .k, .n { display: block }
    </style>`,
    body: '<div class="wrap"><i class="m"></i><i class="s"></i><i class="q"></i><div class="n x"><i class="k"></i></div></div>',
  });
  const v = async (sel: string) => [await style(page, sel, 'width'), await style(page, sel, 'height')];
  expect(await v('.m')).toEqual(['11px', '0px']);
  expect(await v('.s')).toEqual(['12px', '0px']);
  expect(await v('.q')).toEqual(['13px', '0px']);
  expect(await style(page, '.k', 'width')).toBe('14px');
  expect(await style(page, '.n', 'height')).toBe('15px');
});

test(':is(), :where(), :has() and compound selectors keep their specificity and matching', async ({ page }) => {
  await open(page, {
    head: `<style>
      :where(.w) { color: pick(${R}) } .w { color: ${B} }
      :is(#i, .x) { color: pick(${G}) } #i.y { color: ${R} }
      .h:has(> b) { color: pick(${G}) }
      p.c1.c2 { color: pick(${G}) } p.c1 { color: ${R} }
    </style>`,
    body: '<p class="w">w</p><p id="i" class="y">i</p><div class="h"><b>has</b></div><div class="h">no</div><p class="c1 c2">c</p>',
  });
  expect(await style(page, '.w', 'color')).toBe(B); // :where() has zero specificity
  expect(await style(page, '#i', 'color')).toBe(R); // #i.y beats :is(#i, .x) (same id, one more class)
  expect(await page.$$eval('.h', (els) => els.map((e) => getComputedStyle(e).color))).toEqual([G, 'rgb(0, 0, 0)']);
  expect(await style(page, 'p.c1', 'color')).toBe(G);
});

test('pseudo-elements, custom property inheritance and @import', async ({ page }) => {
  await open(page, {
    head: `<style>@import url(/t/css/imp.css);
      .x::before { content: pick("pe") } .parent { --v: pick(7px) } .child { display: block; width: var(--v) }
      .imported-reactive { width: pick(5px) }</style>`,
    body: '<p class="x"></p><div class="parent"><i class="child"></i></div><p class="imp">i</p>',
    css: { 'imp.css': `.imp { color: ${G} } .x { color: pick(${R}) }` },
  });
  expect(await page.$eval('.x', (e) => getComputedStyle(e, '::before').content)).toBe('"pe"');
  expect(await style(page, '.child', 'width')).toBe('7px'); // inherited through the custom property
  await expect.poll(() => style(page, '.imp', 'color')).toBe(G); // the @import is kept and still applies
  expect(await style(page, '.x', 'color')).not.toBe(R); // reactive syntax inside an imported sheet is not processed (documented)
});

test('shadow DOM is a boundary: document rules do not reach in, and nothing breaks', async ({ page }) => {
  await open(page, {
    head: `<style>.s { width: pick(8px); display: block }</style>`,
    body: '<i class="s" id="out"></i><div id="host"></div>',
  });
  const inside = await page.evaluate(() => {
    const r = document.getElementById('host')!.attachShadow({ mode: 'open' });
    r.innerHTML = '<i class="s" style="display:block"></i>';
    return new Promise((res) => requestAnimationFrame(() => res(getComputedStyle(r.firstElementChild!).width)));
  });
  expect(await style(page, '#out', 'width')).toBe('8px');
  expect(inside).not.toBe('8px');
  expect(await diagnostics(page)).toEqual([]);
});

test('running animations and transitions are not restarted by processing a later sheet', async ({ page }) => {
  await open(page, {
    head: `<style>.spin { animation: spin 2s linear infinite; transition: width 1s linear; display: block; width: 10px }
      .spin.wide { width: 110px } @keyframes spin { to { rotate: 1turn } }</style>`,
    body: '<i class="spin"></i>',
  });
  await page.evaluate(() => document.querySelector('.spin')!.classList.add('wide'));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => document.querySelector('.spin')!.getAnimations().map((a) => [a.constructor.name, Math.round(Number(a.currentTime) / 100)]));
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.other { width: pick(1px) }'; document.head.append(s); });
  await frames(page, 2);
  const after = await page.evaluate(() => document.querySelector('.spin')!.getAnimations().map((a) => [a.constructor.name, Math.round(Number(a.currentTime) / 100)]));
  expect(after.length).toBe(before.length);
  after.forEach((a, i) => expect(Number(a[1])).toBeGreaterThanOrEqual(Number(before[i][1]))); // continued, not restarted
});

test('editing and removing a processed <style> restores the browser state exactly', async ({ page }) => {
  await open(page, { head: `<style id="s">.a { width: pick(4px); color: ${G} } .b { color: ${B} }</style>`, body: '<i class="a" style="display:block"></i><i class="b"></i>' });
  expect(await style(page, '.a', 'width')).toBe('4px');
  expect(await sheetCSS(page)).toContain('var(--rcss');
  await page.evaluate(() => (window as any).ReactiveCSS.stop());
  expect(await sheetCSS(page)).not.toContain('var(--rcss'); // original rules back
  expect([await style(page, '.a', 'color'), await style(page, '.b', 'color')]).toEqual([G, B]);
  await page.evaluate(() => (window as any).ReactiveCSS.start());
  await page.evaluate(() => { document.getElementById('s')!.textContent = '.a { width: pick(6px) }'; });
  await expect.poll(() => style(page, '.a', 'width')).toBe('6px');
});

test('a @layer order statement after the first rule is kept (0.5.2 fix)', async ({ page }) => {
  // It used to be dropped from the rewritten sheet, so the layer order fell back to first appearance.
  await open(page, {
    head: `<style>.x { --r: pick(1px) } @layer a, b; @layer b { .y { color: rgb(0, 128, 0) } } @layer a { .y.y.y { color: rgb(255, 0, 0) } }</style>`,
    body: '<p class="x y">y</p>',
  });
  expect(await style(page, '.y', 'color')).toBe('rgb(0, 128, 0)');
  expect(await sheetCSS(page)).toContain('@layer a, b;');
});
